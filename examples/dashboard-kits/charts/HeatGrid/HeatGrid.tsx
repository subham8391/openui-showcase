import clsx from "clsx";
import { scaleBand } from "d3-scale";
import { pointer } from "d3-selection";
import { useCallback, useMemo, useRef, type KeyboardEvent, type MouseEvent } from "react";
import { useDrill } from "../../blocks/Drill";
import { useChartHover, useContainerSize } from "../../engine/hooks";
import { ChartTooltip } from "../shared";
import { ChartEmpty } from "../shared/ChartEmpty";
import { FadeFollower } from "../shared/spring";
import { KIT_CHART_PREFIX, SERIES_COLORS } from "../utils/constants";
import { formatValue } from "../utils/format";
import { labelIndexes, labelWidth } from "../utils/scale";
import { cellAt, HEAT_STEPS, heatMix, heatStep } from "./heatGeometry";
import type { HeatGridProps } from "./types";

const P = `${KIT_CHART_PREFIX}-heat-grid`;
const MARGIN_BOTTOM = 20;
const GAP = 2;
const MIN_WIDTH = 240;
/** How much the hovered cell grows about its centre; kept in step with heatGrid.scss. */
const LIFT = 1.15;

/** A shade step as a fill: the accent mixed into the card, so both themes recede at the low end. */
const shade = (step: number) =>
  step === 0
    ? "var(--kit-sunk)"
    : `color-mix(in oklab, ${SERIES_COLORS[0]} ${heatMix(step)}%, var(--kit-card))`;

/**
 * Rows by columns of cells (weekday by hour) on two d3 band scales, shaded in
 * one hue from the card color to the accent, quantized to the steps the legend
 * names. Hovering a cell lifts it — it grows a little about its centre while
 * the other cells step back — and rings it (the ring glides between cells on
 * the kit's crosshair spring), bolds its row and column labels, and reads out
 * its value and share of the busiest cell in the shared tooltip. The lift is a
 * transform, so nothing around it moves; a copy drawn over the grid keeps the
 * grown cell above its neighbours. Arrow keys walk the
 * grid in all four directions. Shades ease to new values when a filter changes.
 */
export function HeatGrid(props: HeatGridProps) {
  const hasData = props.rows.length > 0 && props.columns.length > 0;
  if (!hasData) {
    return <ChartEmpty prefix={P} className={props.className} />;
  }
  return <HeatGridImpl {...props} />;
}

function HeatGridImpl({
  rows,
  columns,
  format = "number",
  unit,
  cellHeight = 22,
  isAnimationActive = true,
  className,
}: HeatGridProps) {
  const [frameRef, size] = useContainerSize<HTMLDivElement>(640);
  const frameNode = useRef<HTMLDivElement | null>(null);
  const setFrame = useCallback(
    (el: HTMLDivElement | null) => {
      frameNode.current = el;
      frameRef(el);
    },
    [frameRef],
  );
  const cols = columns.length;
  const count = rows.length * cols;
  const width = Math.max(size.width, MIN_WIDTH);
  const height = rows.length * cellHeight + MARGIN_BOTTOM;
  const max = useMemo(() => Math.max(0, ...rows.flatMap((r) => r.values)), [rows]);

  const left = labelWidth(rows.map((r) => r.label)) + 8;
  const x = useMemo(
    () =>
      scaleBand<number>()
        .domain(Array.from({ length: cols }, (_, c) => c))
        .range([left, width]),
    [cols, left, width],
  );
  const y = useMemo(
    () =>
      scaleBand<number>()
        .domain(rows.map((_, r) => r))
        .range([0, rows.length * cellHeight]),
    [rows, cellHeight],
  );

  const findIndex = useCallback(
    (px: number, py: number) => {
      const cell = cellAt(px, py, {
        left,
        top: 0,
        cellWidth: x.step(),
        cellHeight: y.step(),
        rows: rows.length,
        cols,
      });
      return cell ? cell.row * cols + cell.col : null;
    },
    [left, x, y, cols, rows.length],
  );
  const hover = useChartHover(count);
  const handlers = hover.createHandlers(findIndex);

  // Dig-in (see blocks/Drill): a click on a cell, or Enter on the focused
  // grid, offers questions about that cell, measured in the grid's unit.
  // Only where the page can generate (a DrillProvider above).
  const drill = useDrill();
  const metric = unit ? unit.charAt(0).toUpperCase() + unit.slice(1) : "Value";
  const offerCell = (index: number, where: { x: number; y: number }, keyboard = false) => {
    if (!drill || !frameNode.current) return;
    const row = Math.floor(index / cols);
    const col = index % cols;
    const v = rows[row]!.values[col] ?? 0;
    const p = col > 0 ? rows[row]!.values[col - 1] : undefined;
    drill.offer(
      {
        kind: "cell",
        metric,
        label: `${rows[row]!.label} ${columns[col]}`,
        value: formatValue(v, format),
        previous:
          p != null && Number.isFinite(p)
            ? { label: `${rows[row]!.label} ${columns[col - 1]}`, value: formatValue(p, format) }
            : undefined,
      },
      where,
      frameNode.current,
      { keyboard },
    );
  };
  const onClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!drill) return;
    const [px, py] = pointer(event.nativeEvent, event.currentTarget);
    const index = findIndex(px, py);
    if (index != null) offerCell(index, { x: event.clientX, y: event.clientY });
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (drill && hover.hoveredIndex != null && (event.key === "Enter" || event.key === " ")) {
      // Anchored at the cell's top right, where the tooltip points.
      const index = hover.hoveredIndex;
      const frame = frameNode.current!.getBoundingClientRect();
      offerCell(
        index,
        { x: frame.left + x(index % cols)! + cw, y: frame.top + y(Math.floor(index / cols))! },
        true,
      );
      event.preventDefault();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      const down = event.key === "ArrowDown";
      hover.setHoveredIndex((h) =>
        h == null ? 0 : Math.max(0, Math.min(count - 1, h + (down ? cols : -cols))),
      );
      event.preventDefault();
    } else handlers.onKeyDown(event);
  };
  const hovered = hover.hoveredIndex;
  const resting = hover.restingIndex ?? 0;
  const at = { row: Math.floor(resting / cols), col: resting % cols };
  const active = hovered == null ? null : { row: Math.floor(hovered / cols), col: hovered % cols };
  const xTicks = labelIndexes(cols, width - left, labelWidth(columns) + 12);
  const cw = x.bandwidth() - GAP;
  const ch = y.bandwidth() - GAP;
  const stagger = Math.min(18, 360 / Math.max(1, cols));

  const value = active ? (rows[active.row]!.values[active.col] ?? 0) : 0;

  return (
    <div className={clsx(P, className)}>
      <div
        ref={setFrame}
        className={clsx(`${P}-frame`, drill && `${P}-frame--drill`)}
        style={{ height }}
        tabIndex={0}
        role="img"
        aria-label={`${rows.length} rows by ${cols} columns, shaded by ${unit ?? "value"}. Use the arrow keys to read each cell.${drill ? " Press Enter to ask about the cell." : ""}`}
        {...handlers}
        onKeyDown={onKeyDown}
        onClick={onClick}
      >
        <svg width={width} height={height} className={`${P}-svg`}>
          {rows.map((row, r) => (
            <text
              key={row.label}
              x={left - 8}
              y={y(r)! + ch / 2}
              dy="0.32em"
              textAnchor="end"
              className={clsx(`${P}-tick`, active?.row === r && `${P}-tick--active`)}
            >
              {row.label}
            </text>
          ))}
          {rows.map((row, r) =>
            Array.from({ length: cols }, (_, c) => (
              <rect
                key={`${r}-${c}`}
                x={x(c)!}
                y={y(r)!}
                width={Math.max(1, cw)}
                height={Math.max(1, ch)}
                rx={Math.min(3, cw / 4)}
                fill={shade(heatStep(row.values[c] ?? 0, max))}
                className={clsx(
                  `${P}-cell`,
                  hovered === r * cols + c && `${P}-cell--active`,
                  hovered != null && hovered !== r * cols + c && `${P}-cell--dimmed`,
                  isAnimationActive && `${P}-cell--animated`,
                )}
                style={isAnimationActive ? { animationDelay: `${c * stagger}ms` } : undefined}
              />
            )),
          )}
          {active && (
            // Keyed by cell, so each newly hovered cell grows in from its slot.
            <rect
              key={hovered}
              x={x(active.col)!}
              y={y(active.row)!}
              width={Math.max(1, cw)}
              height={Math.max(1, ch)}
              rx={Math.min(3, cw / 4)}
              fill={shade(heatStep(value, max))}
              className={`${P}-lift`}
              aria-hidden
            />
          )}
          <FadeFollower x={x(at.col)!} y={y(at.row)!} visible={active != null}>
            <rect
              x={-(cw * (LIFT - 1)) / 2 - 1.5}
              y={-(ch * (LIFT - 1)) / 2 - 1.5}
              width={cw * LIFT + 3}
              height={ch * LIFT + 3}
              rx={Math.min(4, cw / 3)}
              className={`${P}-ring`}
            />
          </FadeFollower>
          {xTicks.map((c) => (
            <text
              key={c}
              x={x(c)! + cw / 2}
              y={height - 5}
              textAnchor="middle"
              className={clsx(`${P}-tick`, active?.col === c && `${P}-tick--active`)}
            >
              {columns[c]}
            </text>
          ))}
        </svg>
        {active && (
          <ChartTooltip
            x={x(active.col)! + cw}
            y={y(active.row)!}
            width={width}
            title={`${rows[active.row]!.label} ${columns[active.col]}`}
            note={max > 0 ? `${Math.round((value / max) * 100)}% of the busiest cell` : undefined}
            rows={[
              {
                color: shade(heatStep(value, max)),
                name: unit ?? "",
                value: formatValue(value, format),
                kind: "rect",
              },
            ]}
            hint={drill ? "Click to ask why" : undefined}
          />
        )}
      </div>
      <div className={`${P}-legend`} aria-hidden>
        <span>Fewer</span>
        {Array.from({ length: HEAT_STEPS }, (_, k) => (
          <i key={k} className={`${P}-swatch`} style={{ background: shade(k + 1) }} />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}
