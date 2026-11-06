"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useIsomorphicLayoutEffect } from "../../engine/hooks/useIsomorphicLayoutEffect";
import { clampToWindow, KitLayer } from "../KitLayer";
import {
  drillMetric,
  drillPlaceOf,
  drillQuestions,
  type DrillQuestion,
  type DrillTarget,
} from "./drill";

export interface DrillApi {
  /**
   * Offer questions about `target`: opens the dig-in menu at `at` (window
   * coordinates, the click or the keyboard's point). `from` is the chart
   * element; the menu reads the card and dashboard titles around it, and
   * focus returns to it when the menu closes.
   */
  offer(
    target: DrillTarget,
    at: { x: number; y: number },
    from: HTMLElement,
    options?: { keyboard?: boolean },
  ): void;
}

const DrillContext = createContext<DrillApi | null>(null);

/**
 * The dig-in hook for charts. Null outside a DrillProvider (a thumbnail, a
 * test, a page without generation), so a chart offers nothing there.
 */
export function useDrill(): DrillApi | null {
  return useContext(DrillContext);
}

interface Offer {
  target: DrillTarget;
  /** The measure's name as the questions say it (see drillMetric). */
  metric: string;
  keyboard: boolean;
  at: { x: number; y: number };
  from: HTMLElement;
  questions: DrillQuestion[];
}

/**
 * Lets the charts inside it be dug into: a chart calls `offer` with what was
 * clicked, a small menu offers two questions about it, and choosing one calls
 * `onAsk` with the question's prompt (the page then generates a dashboard
 * that answers it).
 */
export function DrillProvider({
  onAsk,
  disabled = false,
  children,
}: {
  onAsk: (prompt: string, question: DrillQuestion) => void;
  /** Offer nothing for now (a dashboard still being written), without remounting the charts. */
  disabled?: boolean;
  children: ReactNode;
}) {
  const [offer, setOffer] = useState<Offer | null>(null);
  const ask = useRef(onAsk);
  ask.current = onAsk;

  const api = useMemo<DrillApi>(
    () => ({
      offer: (target, at, from, options) => {
        const place = drillPlaceOf(from);
        setOffer({
          target,
          metric: drillMetric(target, place),
          keyboard: options?.keyboard ?? false,
          at,
          from,
          questions: drillQuestions(target, place),
        });
      },
    }),
    [],
  );

  const current = useRef(offer);
  current.current = offer;
  const close = useCallback((refocus: boolean) => {
    if (refocus) current.current?.from.focus({ preventScroll: true });
    setOffer(null);
  }, []);

  return (
    <DrillContext.Provider value={disabled ? null : api}>
      {children}
      {offer && !disabled && (
        <DrillMenu
          offer={offer}
          onClose={close}
          onPick={(question) => {
            setOffer(null);
            ask.current(question.prompt, question);
          }}
        />
      )}
    </DrillContext.Provider>
  );
}

function DrillMenu({
  offer,
  onClose,
  onPick,
}: {
  offer: Offer;
  onClose: (refocus: boolean) => void;
  onPick: (question: DrillQuestion) => void;
}) {
  const panel = useRef<HTMLDivElement | null>(null);
  const anchor = useRef<HTMLElement | null>(offer.from);
  anchor.current = offer.from;
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const { target, metric, keyboard, at, questions } = offer;

  const bind = useCallback(
    (el: HTMLDivElement | null) => {
      panel.current = el;
      if (!el) return;
      const p = clampToWindow(at.x + 8, at.y + 8, el.offsetWidth, el.offsetHeight);
      setPos({ left: p.x, top: p.y });
      // Focus the first question; the keyboard ring only when the keyboard opened it.
      el.querySelector<HTMLButtonElement>("button")?.focus({
        preventScroll: true,
        focusVisible: keyboard,
      } as FocusOptions);
    },
    [at.x, at.y, keyboard],
  );

  // A new target reuses the panel: place it again.
  useIsomorphicLayoutEffect(() => {
    const el = panel.current;
    if (!el) return;
    const p = clampToWindow(at.x + 8, at.y + 8, el.offsetWidth, el.offsetHeight);
    setPos({ left: p.x, top: p.y });
  }, [at.x, at.y, target]);

  // A press outside, a scroll, or a resize closes it; Escape closes it and
  // returns focus to the chart.
  useEffect(() => {
    const onDown = (event: PointerEvent) => {
      if (!panel.current?.contains(event.target as Node)) onClose(false);
    };
    const onScroll = (event: Event) => {
      if (!panel.current?.contains(event.target as Node)) onClose(false);
    };
    const onResize = () => onClose(false);
    document.addEventListener("pointerdown", onDown, true);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [onClose]);

  // A part that names itself ("Web") reads "Web · +$316", not "Web · Web +$316".
  const named = target.metric === target.label;
  const heading = [
    target.label,
    target.value && (named ? target.value : `${metric} ${target.value}`),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <KitLayer anchor={anchor}>
      <div
        ref={bind}
        className="kit-drill"
        role="dialog"
        aria-label={`Ask about ${target.label}`}
        data-placed={pos ? "" : undefined}
        style={pos ?? undefined}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            // Not the viewer's Escape: only the menu closes.
            event.stopPropagation();
            onClose(true);
            return;
          }
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            const buttons = [...event.currentTarget.querySelectorAll("button")];
            const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
            const next =
              buttons[(i + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length];
            next?.focus();
            event.preventDefault();
          }
        }}
      >
        <div className="kit-drill__head">{heading}</div>
        {questions.map((q) => (
          <button key={q.id} type="button" className="kit-drill__ask" onClick={() => onPick(q)}>
            <svg viewBox="0 0 24 24" aria-hidden>
              {q.id === "why" ? (
                <path d="M12 3l1.8 4.9L19 9.7l-4.2 3 1.5 5.3L12 15l-4.3 3 1.5-5.3L5 9.7l5.2-1.8z" />
              ) : (
                <path d="M4 20V10m6 10V4m6 16v-7m6 7V8" />
              )}
            </svg>
            <span>{q.label}</span>
          </button>
        ))}
        <div className="kit-drill__foot">Builds a new dashboard with AI</div>
      </div>
    </KitLayer>
  );
}
