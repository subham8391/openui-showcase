import clsx from "clsx";
import { scalePoint } from "d3-scale";
import { pointer } from "d3-selection";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { useDrill } from "../../blocks/Drill";
import { changeTone, formatChange } from "../../engine/format";
import { useChartHover, useContainerSize, useKitPalette, useSeriesFocus } from "../../engine/hooks";
import { ChartCrosshair, ChartLegend, ChartTooltip, type LegendGuide } from "../shared";
import { ChartEmpty } from "../shared/ChartEmpty";
import { linePatterns } from "../shared/linePatterns";
import { colorSeries, comparisonInSeriesColor, paletteCount } from "../shared/seriesColors";
import { DEFAULT_TREND_HEIGHT, KIT_CHART_PREFIX, X_LABEL_SPACING } from "../utils/constants";
import { formatAxis, formatValue } from "../utils/format";
import { findNearestDataIndex } from "../utils/mouseUtils";
import { fitsWithoutZero, labelIndexes, labelWidth, valueScale } from "../utils/scale";
import { EventBands, eventAt } from "./parts/EventBands";
import { SelectionBand } from "./parts/SelectionBand";
import { SelectionAnnouncer, SelectionReadout } from "./parts/SelectionReadout";
import { TrendAxes } from "./parts/TrendAxes";
import { TrendSeries, type GapTone } from "./parts/TrendSeries";
import { packTrend } from "./trendGeometry";
import {
  extendSelection,
  isDrag,
  selectionBand,
  selectionReadout,
  selectionSpan,
  snapToIndex,
  summarizeSelection,
  type TrendSelection,
} from "./trendSelection";
import type { TrendChartProps, TrendCompareDirection } from "./types";

const P = `${KIT_CHART_PREFIX}-trend-chart`;
const MARGIN_TOP = 14;
const MARGIN_BOTTOM = 26;
const MIN_WIDTH = 240;

/**
 * Empty-data guard in a hook-free dispatcher, as react-ui's charts do: the
 * implementation calls hooks unconditionally, so "no data" must short-circuit
 * before any hook runs.
 */
export function TrendChart(props: TrendChartProps) {
  const hasData =
    props.labels.length > 0 &&
    props.series.some((s) => s.values.slice(0, props.labels.length).some(Number.isFinite));
  if (!hasData) {
    return <ChartEmpty prefix={P} className={props.className} />;
  }
  return <TrendChartImpl {...props} />;
}

function gapTones(compare: TrendCompareDirection): { ahead: GapTone; behind: GapTone } {
  if (compare === "neutral") return { ahead: "neutral", behind: "neutral" };
  return compare === "up" ? { ahead: "good", behind: "bad" } : { ahead: "bad", behind: "good" };
}

function TrendChartImpl({
  labels,
  series: seriesProp,
  format = "number",
  variant: variantProp,
  events: eventsProp,
  target,
  band,
  partial = false,
  compare,
  height = DEFAULT_TREND_HEIGHT,
  fill = false,
  maxHeight = Infinity,
  legend = true,
  isAnimationActive = true,
  className,
}: TrendChartProps) {
  const [frameRef, size] = useContainerSize<HTMLDivElement>(640, height);
  const frameNode = useRef<HTMLDivElement | null>(null);
  const setFrame = useCallback(
    (el: HTMLDivElement | null) => {
      frameNode.current = el;
      frameRef(el);
    },
    [frameRef],
  );
  const svgRef = useRef<SVGSVGElement>(null);
  const focus = useSeriesFocus();
  const gradientId = `${P}-g${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  // Mid-stream (here or through a hero), the list or an event in it can still
  // be null or half written: draw only the events that are whole.
  const events = useMemo(
    () =>
      (Array.isArray(eventsProp) ? eventsProp : []).filter(
        (e) =>
          e != null &&
          typeof e.label === "string" &&
          typeof e.start === "string" &&
          typeof e.end === "string",
      ),
    [eventsProp],
  );

  const n = labels.length;
  // One value per label: a longer series is cut, a shorter one padded with
  // gaps, so every line breaks where its data ends instead of overrunning the
  // morph buffer or diving to an empty slot.
  const drawn = useMemo(
    () =>
      seriesProp
        .slice(0, 4)
        .map((s) =>
          s.values.length === n
            ? s
            : { ...s, values: Array.from({ length: n }, (_, j) => s.values[j] ?? Number.NaN) },
        ),
    [seriesProp, n],
  );
  const palette = useKitPalette(paletteCount(drawn), "lineChartPalette");
  const series = useMemo(
    () => comparisonInSeriesColor(colorSeries(drawn, palette), drawn),
    [drawn, palette],
  );
  // Three or more strong lines are told apart by dash as well as color.
  const patterns = useMemo(() => linePatterns(series), [series]);
  const variant = variantProp ?? (series.length > 2 ? "line" : "area");
  const width = Math.max(size.width, MIN_WIDTH);
  const plotHeight = fill ? Math.min(maxHeight, Math.max(height, size.height)) : height;
  const plotBottom = plotHeight - MARGIN_BOTTOM;

  const explicit = series.findIndex((s) => s.emphasis === "primary");
  const firstStrong = series.findIndex((s) => s.emphasis !== "muted");
  const primary = explicit >= 0 ? explicit : Math.max(0, firstStrong);
  const comparison = series.findIndex((s, i) => s.emphasis === "muted" && i !== primary);
  const tones = compare != null && comparison >= 0 && variant === "area" ? gapTones(compare) : null;

  // Area charts label their primary series; line charts label every strong one.
  const { labelled, endLabels } = useMemo(() => {
    const picked = (
      variant === "area"
        ? [primary]
        : series.map((s, i) => (s.emphasis === "muted" ? -1 : i)).filter((i) => i >= 0)
    )
      .filter((i) => Number.isFinite(series[i]!.values[n - 1]))
      .slice(0, 4);
    return {
      labelled: picked,
      endLabels: picked.map((i) => formatValue(series[i]!.values[n - 1]!, format)),
    };
  }, [variant, primary, series, n, format]);

  const geometry = useMemo(() => {
    const values = series.flatMap((s) => s.values);
    const guides = [target?.value, band?.from, band?.to].filter(
      (v): v is number => v != null && Number.isFinite(v),
    );
    // Lines of a level far from zero (a rate near 110%) fit their range; areas keep zero.
    const all = [...values, ...guides];
    const zero = variant === "area" || !fitsWithoutZero(all);
    const { scale: y, ticks } = valueScale(all, [plotBottom, MARGIN_TOP], 4, zero);
    const left = labelWidth(ticks.map((t) => formatAxis(t, format))) + 10;
    const right = width - Math.max(16, labelWidth(endLabels) + 14);
    const x = scalePoint<number>()
      .domain(Array.from({ length: n }, (_, i) => i))
      .range([left, right]);
    const xs = Float64Array.from({ length: n }, (_, i) => x(i)!);
    const ys = series.map((s) => Float64Array.from(s.values, (v) => y(v)));
    const flat = packTrend(xs, ys, [y(target?.value ?? 0), y(band?.from ?? 0), y(band?.to ?? 0)]);
    return { x, y, ticks, left, right, flat, xs };
  }, [
    series,
    variant,
    width,
    plotBottom,
    format,
    n,
    target?.value,
    band?.from,
    band?.to,
    endLabels,
  ]);

  const { x, y, left, right } = geometry;
  const at = (i: number) => x(i)!;
  const findIndex = useCallback((px: number) => findNearestDataIndex(x, px), [x]);
  const hover = useChartHover(n);
  const handlers = hover.createHandlers(findIndex);
  const hovered = hover.hoveredIndex;
  const { setHoveredIndex } = hover;

  // Range selection (see trendSelection.ts). A mouse or pen press-and-drag
  // selects; touch never starts one, so a swipe over the chart still scrolls
  // the page (Shift+arrows select from the keyboard).
  const [selection, setSelection] = useState<TrendSelection | null>(null);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ startX: number; anchor: number; moved: boolean } | null>(null);
  // A touch press: a tap (no travel) offers its day to dig into; a swipe scrolls.
  const tap = useRef<{ x: number; y: number } | null>(null);
  // A different dataset (a hero switching metric, a new period) drops the selection.
  const dataKey = `${n}|${labels[0]}|${labels[n - 1]}|${format}|${series[primary]?.name}`;
  const [selectionKey, setSelectionKey] = useState(dataKey);
  if (selectionKey !== dataKey) {
    setSelectionKey(dataKey);
    setSelection(null);
  }
  const span = selection ? selectionSpan(selection, n) : null;
  const selected = span ? selectionBand(span, geometry.xs) : null;
  const tail = partial && n > 2;
  const primaryValues = series[primary]!.values;
  const readout = span
    ? selectionReadout(
        primaryValues,
        labels,
        span,
        format,
        tail ? { index: n - 1, note: "in progress" } : undefined,
      )
    : null;
  const readoutChange = span ? summarizeSelection(primaryValues, span, format)?.change : undefined;

  // Dig-in (see blocks/Drill): a click on a day, or Enter on the focused
  // chart, offers questions about that day; inside a selected range, about
  // the range. Only where the page can generate (a DrillProvider above).
  const drill = useDrill();
  const pointAt = (i: number) => {
    const frame = frameNode.current!.getBoundingClientRect();
    const v = primaryValues[i]!;
    return { x: frame.left + at(i), y: frame.top + (Number.isFinite(v) ? y(v)! : MARGIN_TOP) };
  };
  const offerDay = (i: number, where: { x: number; y: number }, keyboard = false) => {
    if (!drill || !frameNode.current) return;
    const v = primaryValues[i]!;
    const p = primaryValues[i - 1];
    drill.offer(
      {
        kind: "point",
        metric: series[primary]!.name,
        label: labels[i]!,
        value: Number.isFinite(v) ? formatValue(v, format) : undefined,
        previous:
          i > 0 && p != null && Number.isFinite(p)
            ? { label: labels[i - 1]!, value: formatValue(p, format) }
            : undefined,
      },
      where,
      frameNode.current,
      { keyboard },
    );
  };
  const offerRange = (where: { x: number; y: number }, keyboard = false) => {
    if (!drill || !frameNode.current || !readout || !span || span[0] === span[1]) return;
    drill.offer(
      {
        kind: "range",
        metric: series[primary]!.name,
        label: readout.range,
        value: readout.values,
        change: readout.change,
      },
      where,
      frameNode.current,
      { keyboard },
    );
  };

  // A press anywhere outside the chart clears the selection.
  useEffect(() => {
    if (!selection) return;
    const onDown = (event: globalThis.PointerEvent) => {
      if (!frameNode.current?.contains(event.target as Node)) setSelection(null);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [selection]);

  const endDrag = (event: PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    setDragging(false);
    // A click without a drag clears (or, inside a selected range, asks about
    // it); a cancelled press leaves things as they were. A click offers the
    // day under it to dig into.
    if (!d.moved && !cancelled) {
      const where = { x: event.clientX, y: event.clientY };
      if (drill && span && span[0] !== span[1] && d.anchor >= span[0] && d.anchor <= span[1]) {
        offerRange(where);
      } else {
        setSelection(null);
        offerDay(d.anchor, where);
      }
    }
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const frameHandlers = {
    ...handlers,
    onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
      if (event.pointerType === "touch") {
        tap.current = { x: event.clientX, y: event.clientY };
        return;
      }
      if (event.button !== 0) return;
      const [px] = pointer(event.nativeEvent, event.currentTarget);
      drag.current = { startX: px, anchor: snapToIndex(px, geometry.xs), moved: false };
      // No text selection while dragging; keep keyboard focus on the chart,
      // without the keyboard ring a mouse user didn't ask for (focusVisible
      // isn't in TypeScript's DOM types yet).
      event.preventDefault();
      event.currentTarget.focus({ preventScroll: true, focusVisible: false } as FocusOptions);
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
      handlers.onPointerMove(event);
      const d = drag.current;
      if (!d) return;
      const [px] = pointer(event.nativeEvent, event.currentTarget);
      if (!d.moved && !isDrag(d.startX, px)) return;
      if (!d.moved) {
        d.moved = true;
        setDragging(true);
      }
      const focusIndex = snapToIndex(px, geometry.xs);
      setSelection((prev) =>
        prev && prev.anchor === d.anchor && prev.focus === focusIndex
          ? prev
          : { anchor: d.anchor, focus: focusIndex },
      );
    },
    onPointerUp: (event: PointerEvent<HTMLDivElement>) => {
      const t = tap.current;
      tap.current = null;
      if (event.pointerType === "touch") {
        if (t && Math.hypot(event.clientX - t.x, event.clientY - t.y) < 10) {
          const [px] = pointer(event.nativeEvent, event.currentTarget);
          offerDay(snapToIndex(px, geometry.xs), { x: event.clientX, y: event.clientY });
        }
        return;
      }
      endDrag(event, false);
    },
    onPointerCancel: (event: PointerEvent<HTMLDivElement>) => {
      tap.current = null;
      endDrag(event, true);
    },
    onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.shiftKey && (event.key === "ArrowRight" || event.key === "ArrowLeft")) {
        const next = extendSelection(selection, hovered, event.key === "ArrowRight" ? 1 : -1, n);
        setSelection(next);
        setHoveredIndex(next.focus);
        event.preventDefault();
        return;
      }
      if (event.key === "Escape") setSelection(null);
      if (drill && (event.key === "Enter" || event.key === " ")) {
        if (span && span[0] !== span[1]) {
          const band = frameNode.current!.getBoundingClientRect();
          offerRange(
            { x: band.left + (selected ? selected.x : left), y: band.top + MARGIN_TOP },
            true,
          );
        } else if (hovered != null) {
          offerDay(hovered, pointAt(hovered), true);
        }
        event.preventDefault();
        return;
      }
      handlers.onKeyDown(event);
    },
  };
  // The crosshair stays mounted and rests where it was last shown, so it fades
  // out in place and glides in from there on the next hover.
  const shown = Math.min(hover.restingIndex ?? n - 1, n - 1);

  const hoveredEvent = hovered == null ? undefined : eventAt(events, labels, hovered);
  const legendGuides: LegendGuide[] = [
    ...(band ? [{ name: band.label, kind: "band" as const }] : []),
    ...(target ? [{ name: target.label, kind: "target" as const }] : []),
  ];
  let gapFooter: ReactNode;
  if (hovered != null && tones) {
    const c = series[primary]!.values[hovered]!;
    const p = series[comparison]!.values[hovered]!;
    if (Number.isFinite(c) && Number.isFinite(p) && p !== 0) {
      const change = ((c - p) / Math.abs(p)) * 100;
      gapFooter = (
        <>
          <span>vs {series[comparison]!.name.toLowerCase()}</span>
          <strong className={`kit-text-${changeTone(change, compare)}`}>
            {formatChange(change)}
          </strong>
        </>
      );
    }
  }

  return (
    <div className={clsx(P, fill && `${P}--fill`, className)} data-kit-fill={fill ? "" : undefined}>
      {legend && series.length > 1 && (
        <ChartLegend
          items={series.map((s, i) => ({
            name: s.name,
            color: s.color,
            dashed: s.dashed || s.emphasis === "muted",
            pattern: patterns?.[i],
          }))}
          guides={legendGuides}
          {...focus.legend}
        />
      )}
      <div
        ref={setFrame}
        className={clsx(
          `${P}-frame`,
          fill && `${P}-frame--fill`,
          dragging && `${P}-frame--selecting`,
        )}
        style={
          fill
            ? { minHeight: height, maxHeight: Number.isFinite(maxHeight) ? maxHeight : undefined }
            : { height }
        }
        tabIndex={0}
        role="img"
        aria-label={`${series.map((s) => s.name).join(", ")} from ${labels[0]} to ${labels[n - 1]}. Use the arrow keys to read values and Shift with the arrow keys to select a range.${drill ? " Press Enter to ask about the day or range." : ""}`}
        {...frameHandlers}
      >
        <svg ref={svgRef} width={width} height={plotHeight} className={`${P}-svg`}>
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop
                offset="0%"
                stopColor={series[primary]!.color}
                stopOpacity={tones ? 0.12 : 0.2}
              />
              <stop offset="100%" stopColor={series[primary]!.color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <EventBands
            events={events}
            labels={labels}
            x={at}
            top={MARGIN_TOP}
            height={plotBottom - MARGIN_TOP}
            halfStep={x.step() / 2 || 8}
            active={hoveredEvent}
          />
          <SelectionBand
            x0={selected?.x ?? 0}
            x1={(selected?.x ?? 0) + (selected?.width ?? 0)}
            visible={selected != null}
            top={MARGIN_TOP}
            bottom={plotBottom}
          />
          <TrendAxes
            ticks={geometry.ticks}
            y={y}
            left={left}
            right={right}
            height={plotHeight}
            format={format}
            labels={labels}
            xTicks={labelIndexes(
              n,
              right - left,
              Math.max(X_LABEL_SPACING, labelWidth(labels) + 16),
            )}
            x={at}
          />
          <TrendSeries
            flat={geometry.flat}
            pointCount={n}
            series={series}
            patterns={patterns}
            primary={primary}
            comparison={comparison}
            area={variant === "area"}
            partial={partial}
            hasTarget={target != null}
            hasBand={band != null}
            top={MARGIN_TOP}
            bottom={plotBottom}
            left={left}
            right={right}
            baseY={y(Math.max(y.domain()[0]!, 0))}
            labelled={labelled}
            endLabels={endLabels}
            hideEnds={hovered != null}
            focused={focus.active}
            gradientId={gradientId}
            // Width alone: a filling plot's height follows its card, which
            // changes with the data (a hero switching metric), so it glides.
            layoutKey={String(width)}
            isAnimationActive={isAnimationActive}
          />
          <EventBands
            events={events}
            labels={labels}
            x={at}
            top={MARGIN_TOP}
            height={plotBottom - MARGIN_TOP}
            halfStep={x.step() / 2 || 8}
            active={hoveredEvent}
            layer="labels"
          />
          <ChartCrosshair
            classPrefix={P}
            x={at(shown)}
            visible={hovered != null && !dragging}
            top={MARGIN_TOP}
            bottom={plotBottom}
            dots={series.map((s, i) => ({
              key: s.name,
              color: s.color,
              fallbackY: y(s.values[shown]!),
              opacity: focus.opacity(s.name),
              getPath: () =>
                svgRef.current?.querySelector<SVGPathElement>(`[data-series="${i}"]`) ?? null,
            }))}
          />
        </svg>
        <SelectionReadout
          readout={readout}
          center={selected ? selected.x + selected.width / 2 : 0}
          start={left}
          end={right}
          change={readoutChange}
          compare={compare}
          onAsk={
            drill && span && span[0] !== span[1] && !dragging ? (at) => offerRange(at) : undefined
          }
        />
        {hovered != null && !dragging && (
          <ChartTooltip
            x={at(hovered)}
            y={MARGIN_TOP}
            width={width}
            title={labels[hovered]!}
            note={
              hoveredEvent
                ? `${hoveredEvent.label}${hoveredEvent.detail ? ` · ${hoveredEvent.detail}` : ""}`
                : tail && hovered === n - 1
                  ? "In progress · projected from the pace so far"
                  : undefined
            }
            rows={series.map((s, i) => ({
              color: s.color,
              name: s.name,
              value: formatValue(s.values[hovered]!, format),
              dashed: s.dashed || s.emphasis === "muted",
              pattern: patterns?.[i],
            }))}
            footer={gapFooter}
            hint={drill ? "Click to ask why" : undefined}
          />
        )}
      </div>
      {/* Announced on release and on each Shift+arrow, not on every point a drag crosses. */}
      <SelectionAnnouncer text={dragging ? "" : (readout?.text ?? "")} />
    </div>
  );
}
