// Where a sparkline's points and bars sit, in pixels. Pure (no DOM, no React),
// so the layout and the hover hit-test are unit-tested directly.

import { scaleLinear } from "d3-scale";
import type { SparklineVariant } from "./types";

/** Room at the line's ends and above and below it, so its dots aren't clipped. */
export const PAD_X = 3;
export const PAD_Y = 4;
/** Space between bars, whatever their count. */
export const BAR_GAP = 2;
/** Headroom above the tallest bar. */
const BAR_TOP = 2;

export interface SparkLayout {
  /** The x of each point: on the line, or the centre of its bar. */
  xs: number[];
  /** The y of each value: on the line, or the bar's value end. */
  ys: number[];
  /** The zero line bars grow from; unused by a line. */
  base: number;
  /** Each bar's width; 0 for a line. */
  barWidth: number;
}

function extent(values: number[]): [number, number] | undefined {
  const finite = values.filter(Number.isFinite);
  return finite.length ? [Math.min(...finite), Math.max(...finite)] : undefined;
}

/**
 * A line fits its range to the data, so a metric moving between 40K and 45K
 * still reads as a trend. Bars encode length, so they always start at zero:
 * counts grow up from the bottom edge, and a series that crosses zero splits
 * at a zero line, negatives below it.
 */
export function sparkLayout(
  values: number[],
  width: number,
  height: number,
  variant: SparklineVariant,
): SparkLayout {
  const n = values.length;
  const [min, max] = extent(values) ?? [0, 1];
  if (variant === "line") {
    const x = scaleLinear()
      .domain([0, Math.max(1, n - 1)])
      .range([PAD_X, width - PAD_X]);
    const y = scaleLinear()
      .domain(min === max ? [min - 1, max + 1] : [min, max])
      .range([height - PAD_Y, PAD_Y]);
    return { xs: values.map((_, i) => x(i)), ys: values.map((v) => y(v)), base: 0, barWidth: 0 };
  }
  const lo = Math.min(0, min);
  const hi = Math.max(0, max);
  const y = scaleLinear()
    .domain(lo === hi ? [0, 1] : [lo, hi])
    .range([height, BAR_TOP]);
  const step = width / Math.max(1, n);
  const barWidth = Math.max(1, step - BAR_GAP);
  const base = y(0);
  return {
    xs: values.map((_, i) => step * (i + 0.5)),
    ys: values.map((v) => (Number.isFinite(v) ? y(v) : base)),
    base,
    barWidth,
  };
}

/** The index of the point (or bar) nearest `x`. */
export function nearestIndex(xs: ArrayLike<number>, x: number): number {
  let nearest = 0;
  let best = Infinity;
  for (let i = 0; i < xs.length; i++) {
    const dist = Math.abs(x - xs[i]!);
    if (dist < best) {
      best = dist;
      nearest = i;
    }
  }
  return nearest;
}
