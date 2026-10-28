import type { Tone } from "../../engine/format";

/**
 * How a sparkline draws its values: a line (rates, money, ratios), bars from a
 * zero baseline (counts), or diverging bars that split at zero (series that
 * cross it, such as profit or a net change).
 */
export type SparklineVariant = "line" | "bars" | "diverging";

export interface SparklineProps {
  /** Recent values, oldest first. Two or more draw a line. */
  values: number[];
  /**
   * @deprecated Ignored: sparklines always draw in the accent, and the delta
   * beside one says whether the change is good.
   */
  tone?: Tone;
  /** Height in px. The width fills the container. Default 36. */
  height?: number;
  /** Glide to new values when the data changes. Default true. */
  isAnimationActive?: boolean;
  className?: string;
  /** Line (default), bars from zero, or bars that diverge at zero. */
  variant?: SparklineVariant;
  /**
   * What the sparkline shows, e.g. "Orders". Makes it focusable, with an
   * aria-label built from it, so arrow keys read each point.
   */
  label?: string;
  /** A label per value (dates), read out with the hovered value. */
  labels?: string[];
  /** Formats the hovered value for the live readout. */
  formatValue?: (value: number) => string;
  /**
   * The hovered index, for a parent that drives the crosshair (synced tiles).
   * Leave it undefined to let the sparkline keep its own; null hides it.
   */
  hoveredIndex?: number | null;
  /** Called when the pointer or the arrow keys move to a point, and with null on leave. */
  onHover?: (index: number | null) => void;
}
