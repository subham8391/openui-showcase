"use client";

import { Renderer } from "@openuidev/react-lang";
import { useEffect, useRef, useState } from "react";
import { DrillProvider } from "../blocks/Drill";
import { RunDetails } from "./run-details";
import { useKitRenderer } from "./use-kit-renderer";

export function GalleryView({
  kitId,
  startAt = 0,
  onAsk,
}: {
  kitId: string;
  startAt?: number;
  /**
   * A question about a clicked chart point, with the gallery dashboard it was
   * asked from; the page generates a dashboard that answers it.
   */
  onAsk: (prompt: string, from: { title: string; index: number }) => void;
}) {
  const { kit, library, toolProvider, calls, errors, onError, reset } = useKitRenderer(kitId);
  const [index, setIndex] = useState(startAt);
  const dashboard = kit.gallery[index];
  const picker = useRef<HTMLDivElement>(null);

  // A linked dashboard can sit past the row's edge: bring it into view.
  useEffect(() => {
    picker.current
      ?.querySelector('[aria-pressed="true"]')
      ?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [index]);

  // Fade the row's right edge while more dashboards sit past it.
  useEffect(() => {
    const row = picker.current;
    if (!row) return;
    const mark = () =>
      row.toggleAttribute("data-more", row.scrollLeft + row.clientWidth < row.scrollWidth - 2);
    mark();
    row.addEventListener("scroll", mark, { passive: true });
    const observer = new ResizeObserver(mark);
    observer.observe(row);
    return () => {
      row.removeEventListener("scroll", mark);
      observer.disconnect();
    };
  }, []);

  return (
    <section className="view">
      <div className="view__bar">
        <div ref={picker} className="chips chips--row" aria-label="Dashboards">
          {kit.gallery.map((d, i) => (
            <button
              key={d.title}
              type="button"
              className="chip"
              aria-pressed={i === index}
              onClick={() => {
                reset();
                setIndex(i);
              }}
            >
              {d.title}
            </button>
          ))}
        </div>
        <p className="view__hint">
          {dashboard.description} <span className="badge">Hand-written · no model needed</span>{" "}
          <span className="badge badge--accent">Click a chart point to ask why</span>
        </p>
      </div>
      <div className="canvas">
        <DrillProvider onAsk={(prompt) => onAsk(prompt, { title: dashboard.title, index })}>
          <Renderer
            key={`${kitId}-${index}`}
            response={dashboard.program}
            library={library}
            isStreaming={false}
            toolProvider={toolProvider}
            onError={onError}
          />
        </DrillProvider>
      </div>
      <RunDetails program={dashboard.program} calls={calls} errors={errors} />
    </section>
  );
}
