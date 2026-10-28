import clsx from "clsx";
import { pointer } from "d3-selection";
import {
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useContainerSize, useIsomorphicLayoutEffect } from "../../engine/hooks";
import { AnimatedPath } from "../shared/AnimatedPath";
import { ChartCrosshair } from "../shared/ChartCrosshair/ChartCrosshair";
import { lineD, packGeometry, seriesCurve, unpackGeometry } from "../shared/seriesGeometry";
import { springPresets, useDataMorph } from "../shared/spring";
import { KIT_CHART_PREFIX } from "../utils/constants";
import { nearestIndex, sparkLayout } from "./sparklineGeometry";
import type { SparklineProps } from "./types";

const P = `${KIT_CHART_PREFIX}-sparkline`;
const CURVE = seriesCurve("natural");

/**
 * A sparkline is a quiet companion to its KPI: a thin muted line, no wash, and
 * only the latest value in the accent. The delta beside it says whether the
 * change is good; a row of coloured, filled lines turned the KPI strip into
 * the loudest thing on the dashboard. Bars follow the same rule: muted, the
 * latest in the accent, and negatives in the "money out" colour.
 */
const LINE_COLOR = "var(--kit-spark)";
const DOT_COLOR = "var(--kit-accent)";

/**
 * A KPI's recent trend: a d3 monotone line with a dot on the latest value, or
 * bars from a zero baseline (counts, or a series that crosses zero). Unlike
 * react-ui's MiniAreaChart it keeps every point and fits a line's range to the
 * data, so a metric moving between 40K and 45K still reads as a trend. Drawn
 * at the container's real width (no stretched viewBox, so the dot stays round)
 * and morphed on the spring when the values change; a resize snaps.
 *
 * With a `label` (or a hover handler) it reads its points: the pointer
 * anywhere in its box, or Left/Right once focused, moves a crosshair to the
 * nearest point on the crosshair spring (snapping under reduced motion), and
 * the value is read out in a polite live region. `hoveredIndex` lets a parent
 * drive the crosshair, so a strip of tiles can share the hovered day.
 */
export function Sparkline(props: SparklineProps) {
  if (props.values.filter(Number.isFinite).length < 2) return null;
  return <SparklineImpl {...props} />;
}

function SparklineImpl({
  values,
  height = 36,
  isAnimationActive = true,
  className,
  variant = "line",
  label,
  labels,
  formatValue,
  hoveredIndex,
  onHover,
}: SparklineProps) {
  const [frameRef, size] = useContainerSize<HTMLDivElement>(160, height);
  const width = Math.max(size.width, 40);
  const n = values.length;
  const isLine = variant === "line";

  const layout = useMemo(
    () => sparkLayout(values, width, height, variant),
    [values, width, height, variant],
  );
  // Morph layout: the x of each point, its value y, and the baseline under it.
  const flat = useMemo(
    () => packGeometry(layout.xs, [layout.ys, layout.xs.map(() => layout.base)]),
    [layout],
  );

  const draw = (geometry: Float64Array) => {
    const { xs, ys } = unpackGeometry(geometry, n);
    const top = ys[0]!;
    const base = ys[1]!;
    return {
      line: isLine ? lineD(xs, top, CURVE) : "",
      dot: { x: xs[n - 1]!, y: top[n - 1]! },
      bars: isLine
        ? []
        : Array.from({ length: n }, (_, i) => ({
            y: Math.min(top[i]!, base[i]!),
            height: Math.abs(base[i]! - top[i]!),
          })),
    };
  };
  const target = draw(flat);

  const lineRef = useRef<SVGPathElement>(null);
  const dotRef = useRef<SVGCircleElement>(null);
  const barRefs = useRef<(SVGRectElement | null)[]>([]);
  const drawRef = useRef(draw);
  drawRef.current = draw;
  const aim = useDataMorph(springPresets.dataMorph, (animated) => {
    const g = drawRef.current(animated);
    lineRef.current?.setAttribute("d", g.line);
    dotRef.current?.setAttribute("cx", String(g.dot.x));
    dotRef.current?.setAttribute("cy", String(g.dot.y));
    g.bars.forEach((bar, i) => {
      const rect = barRefs.current[i];
      rect?.setAttribute("y", String(bar.y));
      rect?.setAttribute("height", String(bar.height));
    });
  });
  // The first aim, any resize, and a change of variant snap; only a change
  // in the values glides.
  const last = useRef<{ width: number; variant: string } | null>(null);
  useIsomorphicLayoutEffect(() => {
    const snap =
      !isAnimationActive || last.current?.width !== width || last.current?.variant !== variant;
    last.current = { width, variant };
    aim(flat, snap, isAnimationActive);
  }, [flat, width, variant, isAnimationActive, aim]);

  // Hover: the parent's index when it drives one, else this sparkline's own.
  const interactive = label != null || onHover != null || hoveredIndex !== undefined;
  const [ownIndex, setOwnIndex] = useState<number | null>(null);
  const controlled = hoveredIndex !== undefined;
  const raw = controlled ? hoveredIndex : ownIndex;
  const hovered = raw != null && raw >= 0 && raw < n ? raw : null;
  // Where the crosshair rests once hidden, so the next hover glides from there.
  const resting = useRef(n - 1);
  if (hovered != null) resting.current = hovered;
  const shown = Math.min(resting.current, n - 1);
  // Only the sparkline under the pointer or holding focus reads out its value;
  // the tiles that follow it stay quiet.
  const [isSource, setIsSource] = useState(false);

  const move = (index: number | null) => {
    if (index === hovered) return;
    if (!controlled) setOwnIndex(index);
    onHover?.(index);
  };
  const handlers = interactive
    ? {
        onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => {
          const [x] = pointer(event.nativeEvent, event.currentTarget);
          setIsSource(true);
          move(nearestIndex(layout.xs, x));
        },
        onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => {
          const [x] = pointer(event.nativeEvent, event.currentTarget);
          setIsSource(true);
          move(nearestIndex(layout.xs, x));
        },
        onPointerLeave: () => {
          setIsSource(false);
          move(null);
        },
        onFocus: () => setIsSource(true),
        onBlur: () => {
          setIsSource(false);
          move(null);
        },
        onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => {
          if (event.key === "ArrowRight") move(hovered == null ? 0 : Math.min(n - 1, hovered + 1));
          else if (event.key === "ArrowLeft")
            move(hovered == null ? n - 1 : Math.max(0, hovered - 1));
          else if (event.key === "Home") move(0);
          else if (event.key === "End") move(n - 1);
          else if (event.key === "Escape") move(null);
          else return;
          setIsSource(true);
          event.preventDefault();
        },
      }
    : {};

  const pointName = (i: number) => labels?.[i] ?? `Point ${i + 1} of ${n}`;
  const valueText = (v: number) => (formatValue ? formatValue(v) : String(v));
  const readout =
    isSource && hovered != null ? `${pointName(hovered)}: ${valueText(values[hovered]!)}` : "";
  const span = labels?.length === n ? ` from ${labels[0]} to ${labels[n - 1]}` : "";
  const ariaLabel = `${label ?? "Trend"}: ${n} points${span}, latest ${valueText(values[n - 1]!)}. Use the arrow keys to read each point.`;

  const crosshair = (
    <ChartCrosshair
      x={layout.xs[shown] ?? 0}
      visible={hovered != null}
      top={0}
      bottom={height}
      classPrefix={P}
      dots={
        isLine
          ? [
              {
                key: "value",
                color: DOT_COLOR,
                fallbackY: layout.ys[shown] ?? 0,
                getPath: () => lineRef.current,
              },
            ]
          : []
      }
    />
  );

  return (
    <div className={clsx(P, `${P}--${variant}`, className)}>
      <div
        ref={frameRef}
        className={clsx(`${P}-frame`, interactive && `${P}-frame--interactive`)}
        style={{ height }}
        {...(interactive
          ? { role: "img", tabIndex: 0, "aria-label": ariaLabel }
          : { "aria-hidden": true })}
        {...handlers}
      >
        <svg width={width} height={height} className={`${P}-svg`}>
          {!isLine && crosshair}
          {isLine ? (
            <>
              <AnimatedPath
                pathRef={lineRef}
                d={target.line}
                className={`${P}-line`}
                isAnimationActive={isAnimationActive}
                stroke={LINE_COLOR}
              />
              {/* The latest value's dot steps aside while the crosshair reads a point. */}
              <g className={clsx(`${P}-end`, hovered != null && `${P}-end--away`)}>
                <circle
                  ref={dotRef}
                  cx={target.dot.x}
                  cy={target.dot.y}
                  r={2.75}
                  fill={DOT_COLOR}
                  className={clsx(`${P}-dot`, isAnimationActive && `${P}-late--animated`)}
                />
              </g>
            </>
          ) : (
            <g className={clsx(`${P}-bars`, hovered != null && `${P}-bars--hovering`)}>
              {variant === "diverging" && (
                <line className={`${P}-zero`} x1={0} x2={width} y1={layout.base} y2={layout.base} />
              )}
              {values.map((v, i) => (
                <rect
                  key={i}
                  ref={(el) => {
                    barRefs.current[i] = el;
                  }}
                  x={layout.xs[i]! - layout.barWidth / 2}
                  width={layout.barWidth}
                  y={target.bars[i]!.y}
                  height={target.bars[i]!.height}
                  rx={Math.min(1.5, layout.barWidth / 2)}
                  className={clsx(
                    `${P}-bar`,
                    v < 0 ? `${P}-bar--down` : i === n - 1 && `${P}-bar--latest`,
                    i === hovered && `${P}-bar--active`,
                  )}
                />
              ))}
            </g>
          )}
          {isLine && crosshair}
        </svg>
      </div>
      {interactive && (
        <span className="kit-sr" aria-live="polite">
          {readout}
        </span>
      )}
    </div>
  );
}
