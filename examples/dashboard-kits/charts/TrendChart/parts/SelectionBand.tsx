import { useRef } from "react";
import { springPresets, useSeededAim, useSpring } from "../../shared/spring";
import { KIT_CHART_PREFIX } from "../../utils/constants";

const P = `${KIT_CHART_PREFIX}-trend-chart`;

/**
 * The selected span: a quiet accent band between the two selected points with
 * a line at each edge. Always mounted, like the crosshair: each edge rides its
 * own crosshair spring, jumping into place when a selection starts and gliding
 * as it grows point by point, and the whole band fades out in place when the
 * selection clears. Drawn under the lines, so the data stays on top.
 */
export function SelectionBand({
  x0,
  x1,
  visible,
  top,
  bottom,
}: {
  /** Pixel x of the selection's start and end points (x0 ≤ x1). */
  x0: number;
  x1: number;
  visible: boolean;
  top: number;
  bottom: number;
}) {
  const rectRef = useRef<SVGRectElement>(null);
  const startRef = useRef<SVGLineElement>(null);
  const endRef = useRef<SVGLineElement>(null);
  // Geometry is written by the springs only (never by React), so a re-render
  // mid-glide can't snap the band to its target.
  const edges = useRef({ start: x0, end: x1 });

  const draw = () => {
    const { start, end } = edges.current;
    rectRef.current?.setAttribute("x", String(Math.min(start, end)));
    rectRef.current?.setAttribute("width", String(Math.abs(end - start)));
    startRef.current?.setAttribute("transform", `translate(${start},0)`);
    endRef.current?.setAttribute("transform", `translate(${end},0)`);
  };
  const start = useSpring(springPresets.crosshair, (v) => {
    edges.current.start = v;
    draw();
  });
  const end = useSpring(springPresets.crosshair, (v) => {
    edges.current.end = v;
    draw();
  });
  useSeededAim(visible, [x0, x1], (first) => {
    if (first) {
      start.jump(x0);
      end.jump(x1);
    } else {
      start.set(x0);
      end.set(x1);
    }
  });

  return (
    <g
      className={`${P}-selection`}
      aria-hidden
      style={{ opacity: visible ? 1 : 0, transition: "opacity 120ms ease" }}
    >
      <rect
        ref={rectRef}
        className={`${P}-selection-band`}
        y={top}
        height={Math.max(0, bottom - top)}
      />
      <line ref={startRef} className={`${P}-selection-edge`} x1={0} x2={0} y1={top} y2={bottom} />
      <line ref={endRef} className={`${P}-selection-edge`} x1={0} x2={0} y1={top} y2={bottom} />
    </g>
  );
}
