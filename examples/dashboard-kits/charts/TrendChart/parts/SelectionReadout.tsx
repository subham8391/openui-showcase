import { useRef } from "react";
import { changeTone } from "../../../engine/format";
import { useIsomorphicLayoutEffect } from "../../../engine/hooks";
import { KIT_CHART_PREFIX } from "../../utils/constants";
import type { SelectionReadoutParts } from "../trendSelection";

const P = `${KIT_CHART_PREFIX}-trend-chart`;

/**
 * The selection's readout, pinned at the top of the plot and centred over the
 * band, kept between the plot's edges so it never covers the axis labels
 * beside them (it wraps rather than overflow a narrow card).
 * It sits inside the chart's `role="img"` frame, where assistive tech reads no
 * children, so it is hidden from them: `SelectionAnnouncer` speaks the same
 * line from outside the frame.
 */
export function SelectionReadout({
  readout,
  center,
  start,
  end,
  change,
  compare,
  onAsk,
}: {
  readout: SelectionReadoutParts | null;
  /** Pixel x the readout centres on (the middle of the band). */
  center: number;
  /** The plot's left and right edges in pixels, which the readout stays between. */
  start: number;
  end: number;
  /** The signed change behind `readout.change`, for its tone. */
  change?: number;
  compare?: "up" | "down" | "neutral";
  /**
   * Offers questions about the range (see blocks/Drill), from a button at the
   * readout's end. Mouse only: the chart's Enter key does the same.
   */
  onAsk?: (where: { x: number; y: number }) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useIsomorphicLayoutEffect(() => {
    const el = ref.current;
    if (!el || !readout) return;
    el.style.maxWidth = `${end - start}px`;
    const w = el.offsetWidth;
    const left = Math.max(start, Math.min(end - w, center - w / 2));
    el.style.left = `${left}px`;
  }, [readout?.text, center, start, end]);

  const tone = compare ? changeTone(change, compare) : "neutral";
  return (
    <div ref={ref} className={`${P}-readout${readout ? "" : ` ${P}-readout--empty`}`} aria-hidden>
      {readout && (
        <>
          {/* Each part keeps to one line; a narrow card wraps between parts. */}
          <span className={`${P}-readout-part`}>
            <span className={`${P}-readout-range`}>{readout.range}: </span>
            <strong>{readout.values}</strong>
          </span>
          {readout.change && (
            <>
              <span className={`${P}-readout-sep`}>{" · "}</span>
              <strong className={`${P}-readout-part kit-text-${tone}`}>{readout.change}</strong>
            </>
          )}
          {readout.total && (
            <>
              <span className={`${P}-readout-sep`}>{" · "}</span>
              <span className={`${P}-readout-part`}>{readout.total}</span>
            </>
          )}
          {onAsk && (
            <button
              type="button"
              tabIndex={-1}
              className={`${P}-readout-ask`}
              // Not a drag start for the chart under it.
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                const box = event.currentTarget.getBoundingClientRect();
                onAsk({ x: box.left - 8, y: box.bottom });
              }}
            >
              Ask why
            </button>
          )}
        </>
      )}
    </div>
  );
}

/**
 * The chart's live region for the selection: always mounted (a region that
 * appears with its text is often not announced) and visually hidden, so a
 * keyboard reader hears the span each time Shift+arrow extends it.
 */
export function SelectionAnnouncer({ text }: { text: string }) {
  return (
    <div className="kit-visually-hidden" aria-live="polite" aria-atomic="true">
      {text}
    </div>
  );
}
