"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Lays its children out at desktop `width` and scales them down to fit the
 * frame, for live thumbnails of dashboards. Read-only: nothing inside can be
 * focused or clicked, and screen readers skip it.
 */
export function ScaledFrame({
  width = 1280,
  className,
  children,
}: {
  width?: number;
  className?: string;
  children: ReactNode;
}) {
  const frame = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const fit = () => el.style.setProperty("--frame-scale", String(el.clientWidth / width));
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, [width]);

  return (
    <div ref={frame} className={className ? `scaled ${className}` : "scaled"} aria-hidden inert>
      <div className="scaled__stage" style={{ width }}>
        {children}
      </div>
    </div>
  );
}
