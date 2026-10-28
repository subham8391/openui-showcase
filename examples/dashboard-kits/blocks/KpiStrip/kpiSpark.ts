// What a KPI tile's sparkline draws, how it is drawn, and what the tile shows
// for the hovered day. Pure (no DOM, no React), so the rules are unit-tested.

import type { SparklineVariant } from "../../charts/Sparkline";
import { formatValue } from "../../charts/utils/format";
import type { Kpi, ValueFormat } from "../../engine/schemas";

/** The points a tile's sparkline draws, with the dates and comparison when known. */
export interface SparkPoints {
  values: number[];
  /** A date (or week) per value; only a KPI's trend has them. */
  labels?: string[];
  /** The comparison per value (prior period, last year, or plan). */
  previous?: number[];
  format?: ValueFormat;
  /** The last point is still in progress (today). */
  partial?: boolean;
}

/**
 * A KPI with a trend draws the trend's own daily (or weekly) values, so every
 * point has a date and a comparison the tile can show; one without draws its
 * `series`, which has neither.
 */
export function sparkPoints(kpi: Kpi): SparkPoints | undefined {
  const t = kpi.trend;
  if (t && t.current.length > 1 && t.labels.length === t.current.length) {
    return {
      values: t.current,
      labels: t.labels,
      previous: t.previous?.length === t.current.length ? t.previous : undefined,
      format: t.format ?? inferFormat(kpi.value),
      partial: t.partial,
    };
  }
  if (kpi.series && kpi.series.length > 1) {
    return { values: kpi.series, format: inferFormat(kpi.value) };
  }
  return undefined;
}

/** A value printed as a bare count: "527", "15.8K", "+2,292". */
const BARE_COUNT = /^[+−-]?[\d,]+(\.\d+)?[KMB]?$/;

/** The format a formatted value reads as, when the KPI doesn't say. */
export function inferFormat(value: string): ValueFormat | undefined {
  const v = value.trim();
  if (v.includes("$")) return "currency";
  if (v.endsWith("%")) return "percent";
  if (/\dx$/.test(v)) return "ratio";
  if (/^\d+m \d+s$|\d (h|days)$/.test(v)) return "duration";
  if (BARE_COUNT.test(v)) return "number";
  return undefined;
}

const wholeNumbers = (values: number[]) =>
  values.every((v) => !Number.isFinite(v) || Math.abs(v - Math.round(v)) < 1e-6);

/**
 * How a tile's sparkline draws, from the metric itself (no prop, so the
 * model's prompt is unchanged):
 * - "diverging" when the series crosses zero (profit, a net change): bars
 *   from a zero line, negatives in the "money out" colour.
 * - "bars" for counts (orders, sessions, visitors, signups): a "number"
 *   format and a value printed as a bare count, with either a "number" trend
 *   or whole-number values. "3.4 / week" (a rate) and "$1.2M" are not counts.
 * - "line" for everything else: rates, money, ratios, durations.
 */
export function sparkVariant(kpi: Kpi, points: SparkPoints): SparklineVariant {
  const finite = points.values.filter(Number.isFinite);
  if (finite.some((v) => v < 0) && finite.some((v) => v > 0)) return "diverging";
  const bareCount = BARE_COUNT.test(kpi.value.trim());
  if (
    points.format === "number" &&
    bareCount &&
    (kpi.trend?.format === "number" || wholeNumbers(finite))
  ) {
    return "bars";
  }
  return "line";
}

/**
 * A number printed the way the KPI prints its own value: money and durations
 * through the chart formatter; a value with its own unit text ("36.1%",
 * "3.93x", "3.4 / week", "+2,292") keeps that text and its decimals; a value
 * shortened to K or M takes the formatter's own shortening.
 */
export function formatLike(value: number, like: string, format?: ValueFormat): string {
  if (format === "currency" || format === "duration") return formatValue(value, format);
  const m = /^(\D*?)([+−-]?)([\d,]+(?:\.(\d+))?)([KMB]?)(.*)$/.exec(like.trim());
  const signed = m?.[2] === "+";
  if (!m || m[5]) {
    const text = formatValue(value, format ?? "number");
    return signed && value >= 0 ? `+${text}` : text;
  }
  const decimals = m[4]?.length ?? 0;
  const digits = Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  const sign = value < 0 ? "−" : signed ? "+" : "";
  return `${m[1]}${sign}${digits}${m[6]}`;
}

/** What a tile shows for one day of its trend. */
export interface TileDay {
  value: string;
  /** Percent change against the comparison that day; absent without one. */
  change?: number;
  previous?: string;
  date: string;
}

/**
 * The tile's figures for one point of its trend: the value, and the change
 * and comparison only when the comparison has that day. Undefined for a tile
 * whose points have no dates (a bare series), which keeps its latest figures.
 */
export function tileDay(kpi: Kpi, points: SparkPoints, index: number): TileDay | undefined {
  const date = points.labels?.[index];
  const current = points.values[index];
  if (date == null || current == null || !Number.isFinite(current)) return undefined;
  const fmt = (v: number) => formatLike(v, kpi.value, points.format);
  const prev = points.previous?.[index];
  const last = index === points.values.length - 1;
  const day: TileDay = {
    value: fmt(current),
    date: last && points.partial ? `${date} · so far` : date,
  };
  if (prev != null && Number.isFinite(prev)) {
    day.previous = fmt(prev);
    if (prev !== 0) day.change = Number((((current - prev) / Math.abs(prev)) * 100).toFixed(1));
  }
  return day;
}
