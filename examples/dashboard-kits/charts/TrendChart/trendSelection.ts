// Range selection on a trend: drag (or Shift+arrow) across the plot to pick a
// span of points, then read what happened over it — where it started and
// ended, the change, and the total when adding the values up makes sense.
//
// Pure (no DOM, no React) — unit-tested directly.

import { formatChange, formatPoints } from "../../engine/format";
import type { ValueFormat } from "../../engine/schemas";
import { formatValue } from "../utils/format";

/** A selection by data index: where it was started and where it now reaches. */
export interface TrendSelection {
  anchor: number;
  focus: number;
}

/** How far (px) a press must travel before it is a drag rather than a click. */
export const DRAG_THRESHOLD = 4;

/** A press that has travelled past the threshold is a drag; less is a click. */
export function isDrag(startX: number, x: number, threshold = DRAG_THRESHOLD): boolean {
  return Math.abs(x - startX) >= threshold;
}

/** The index of the point nearest `x`, given each point's x position. */
export function snapToIndex(x: number, xs: ArrayLike<number>): number {
  let nearest = 0;
  let best = Infinity;
  for (let i = 0; i < xs.length; i++) {
    const d = Math.abs(x - xs[i]!);
    if (d < best) {
      best = d;
      nearest = i;
    }
  }
  return nearest;
}

function clamp(i: number, count: number): number {
  return Math.max(0, Math.min(count - 1, Math.round(i)));
}

/**
 * The selected span as ordered `[start, end]` indexes, clamped to the points
 * there are: a drag to the left reads the same as one to the right.
 */
export function selectionSpan(selection: TrendSelection, count: number): [number, number] {
  const a = clamp(selection.anchor, count);
  const b = clamp(selection.focus, count);
  return a <= b ? [a, b] : [b, a];
}

/**
 * Shift+arrow: move the selection's free end one point. With no selection, it
 * starts at the current point (the hovered one), or at the end the arrow
 * points away from when nothing is hovered.
 */
export function extendSelection(
  selection: TrendSelection | null,
  current: number | null,
  step: -1 | 1,
  count: number,
): TrendSelection {
  if (selection) {
    return {
      anchor: clamp(selection.anchor, count),
      focus: clamp(selection.focus + step, count),
    };
  }
  const anchor = clamp(current ?? (step > 0 ? 0 : count - 1), count);
  return { anchor, focus: clamp(anchor + step, count) };
}

/** The band's pixel extent between the two selected points. */
export function selectionBand(
  span: [number, number],
  xs: ArrayLike<number>,
): { x: number; width: number } {
  const x0 = xs[span[0]]!;
  const x1 = xs[span[1]]!;
  return { x: Math.min(x0, x1), width: Math.abs(x1 - x0) };
}

/**
 * Change unit by format: a rate (`percent`) changes in percentage points, so
 * 3.1% → 3.4% is +0.3 pts, not +9.7%. Every other format — counts, currency,
 * ratios, durations — changes by a relative percentage.
 */
export function changeUnit(format: ValueFormat): "%" | "pts" {
  return format === "percent" ? "pts" : "%";
}

/**
 * Whether the values over a span add up to something meaningful. Only flows
 * do: orders and revenue per day sum to the orders and revenue of the span.
 * Levels don't: a conversion rate, a ROAS ratio, or an average session
 * duration summed over days is not a quantity anyone reads. So `number` and
 * `currency` are summable; `percent`, `ratio`, and `duration` are not.
 */
export function isSummable(format: ValueFormat): boolean {
  return format === "number" || format === "currency";
}

export interface SelectionSummary {
  /** The first and last points in the span that have a value (gaps skipped). */
  startIndex: number;
  endIndex: number;
  startValue: number;
  endValue: number;
  /** % (or pts for rates) from start to end; undefined for one point or a zero start. */
  change?: number;
  unit: "%" | "pts";
  /** Sum of the span's values, gaps skipped; only for summable formats. */
  total?: number;
}

/**
 * What a span of one series says: its first and last values (skipping gaps,
 * so a span that starts or ends on a missing day reads from the nearest day
 * inside it that has data), the change between them, and the total. Undefined
 * when the span holds no data at all.
 */
export function summarizeSelection(
  values: ArrayLike<number>,
  span: [number, number],
  format: ValueFormat,
): SelectionSummary | undefined {
  const [a, b] = span;
  let startIndex = -1;
  let endIndex = -1;
  let total = 0;
  for (let i = a; i <= b; i++) {
    const v = values[i];
    if (v == null || !Number.isFinite(v)) continue;
    if (startIndex < 0) startIndex = i;
    endIndex = i;
    total += v;
  }
  if (startIndex < 0) return undefined;
  const startValue = values[startIndex]!;
  const endValue = values[endIndex]!;
  const unit = changeUnit(format);
  let change: number | undefined;
  if (endIndex > startIndex) {
    if (unit === "pts") change = endValue - startValue;
    else if (startValue !== 0) change = ((endValue - startValue) / Math.abs(startValue)) * 100;
  }
  return {
    startIndex,
    endIndex,
    startValue,
    endValue,
    change,
    unit,
    total: isSummable(format) ? total : undefined,
  };
}

/** The readout's parts, so the chart can tone the change; `text` is the whole line. */
export interface SelectionReadoutParts {
  range: string;
  values: string;
  change?: string;
  total?: string;
  text: string;
}

/**
 * The readout line for a span:
 * "Sep 11 → Sep 18: $4.2K → $5.1K · +21.4% · $32.1K total". One point (or a
 * span with a single day of data) reads just "Sep 11: $4.2K"; a span with no
 * data reads "Sep 11 → Sep 18: no data". `endNote` marks the last point
 * (an in-progress day) when the readout ends on it.
 */
export function selectionReadout(
  values: ArrayLike<number>,
  labels: string[],
  span: [number, number],
  format: ValueFormat,
  endNote?: { index: number; note: string },
): SelectionReadoutParts {
  const label = (i: number) =>
    `${labels[i] ?? ""}${endNote && endNote.index === i ? ` (${endNote.note})` : ""}`;
  const summary = summarizeSelection(values, span, format);
  if (!summary) {
    const range = span[0] === span[1] ? label(span[0]) : `${label(span[0])} → ${label(span[1])}`;
    return { range, values: "no data", text: `${range}: no data` };
  }
  if (summary.startIndex === summary.endIndex) {
    const range = label(summary.startIndex);
    const value = formatValue(summary.startValue, format);
    return { range, values: value, text: `${range}: ${value}` };
  }
  const range = `${label(summary.startIndex)} → ${label(summary.endIndex)}`;
  const valuesText = `${formatValue(summary.startValue, format)} → ${formatValue(summary.endValue, format)}`;
  const change =
    summary.change == null
      ? undefined
      : summary.unit === "pts"
        ? formatPoints(summary.change)
        : formatChange(summary.change);
  const total = summary.total == null ? undefined : `${formatValue(summary.total, format)} total`;
  const text = [`${range}: ${valuesText}`, change, total].filter(Boolean).join(" · ");
  return { range, values: valuesText, change, total, text };
}
