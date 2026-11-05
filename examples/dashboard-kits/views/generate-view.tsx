"use client";

import { OpenUICloudProvider, type ArtifactSummary } from "@openuidev/react-ui/cloud";
import { useCallback, useEffect, useRef, useState } from "react";
import { KITS } from "../kits";
import { KIT_LIBRARIES } from "../kits/client";
import { artifactIdOf, cloudRoutes, createDashboard, editDashboard } from "./cloud";
import { DashboardViewer, type ViewerRun } from "./dashboard-viewer";
import { MyDashboards } from "./my-dashboards";

/** Seconds since `since`, ticking while `active`. */
function useElapsed(since: number, active: boolean) {
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    if (!active) return;
    setNow(performance.now());
    const id = setInterval(() => setNow(performance.now()), 250);
    return () => clearInterval(id);
  }, [active, since]);
  return Math.max(0, (now - since) / 1000);
}

/** A dashboard the viewer can step back to after digging into it. */
interface Visited {
  id: string;
  asked: string;
  title: string;
}

/** The dashboard's title in a create response (`name=` on its content line). */
function titleIn(response: string): string | undefined {
  const name = /[?&]name=([^&\s]+)/.exec(response)?.[1];
  return name ? decodeURIComponent(name.replace(/\+/g, " ")) : undefined;
}

/**
 * Generate, on OpenUI Dashboards: a request goes to OpenUI Cloud, which builds
 * the dashboard from the kit's library, tools and examples and saves it for
 * this visitor. The viewer streams it, keeps it live, and changes it on
 * request; saved dashboards are listed below the form.
 */
export function GenerateView(props: {
  kitId: string;
  /** OpenUI Cloud's origin, which the browser reads dashboards from. */
  cloudUrl: string;
  /** A question asked from elsewhere (a gallery chart): generated as soon as it arrives. */
  ask?: { prompt: string; id: number; from: { title: string } };
  /** Back to where `ask` came from. */
  onReturn?: () => void;
}) {
  // One provider per kit: each kit is its own OpenUI app with its own token.
  return (
    <OpenUICloudProvider token={cloudRoutes(props.kitId).token} apiBaseUrl={props.cloudUrl}>
      <Generate {...props} />
    </OpenUICloudProvider>
  );
}

function Generate({
  kitId,
  ask,
  onReturn,
}: {
  kitId: string;
  ask?: { prompt: string; id: number; from: { title: string } };
  onReturn?: () => void;
}) {
  const kit = KITS.find((k) => k.id === kitId)!;
  const library = KIT_LIBRARIES[kitId]!;
  const [prompt, setPrompt] = useState("");
  const [run, setRun] = useState<ViewerRun | null>(null);
  const [starting, setStarting] = useState(false);
  const [failed, setFailed] = useState<string>("");
  const [open, setOpen] = useState(false);
  // A new dashboard is on its way: the progress shows below the form until its
  // first part appears, then the viewer opens on it.
  const [waiting, setWaiting] = useState(false);
  const [startedAt, setStartedAt] = useState(0);
  const elapsed = useElapsed(startedAt, waiting && !open);
  // The dashboards dug out of, newest last: the viewer's Back steps through them.
  const [trail, setTrail] = useState<Visited[]>([]);
  // The gallery dashboard the first question came from, the trail's far end.
  const [origin, setOrigin] = useState<string | null>(null);
  // Bumped when a new dashboard is saved, so the list shows it.
  const [saved, setSaved] = useState(0);
  const abort = useRef<AbortController | null>(null);
  const closer = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => () => abort.current?.abort(), []);

  /**
   * Asks OpenUI Cloud for a dashboard. The viewer opens once the dashboard's
   * first part appears (from a chart in the viewer, it is open already).
   */
  async function start(text: string) {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setRun({ asked: text });
    setFailed("");
    setStarting(true);
    setWaiting(true);
    setStartedAt(performance.now());
    try {
      const response = await createDashboard(kitId, text, controller.signal);
      setRun({ id: artifactIdOf(response), response, asked: text, created: true });
    } catch (err) {
      if (!controller.signal.aborted) {
        setFailed((err as Error).message);
        setWaiting(false);
      }
    } finally {
      if (abort.current === controller) setStarting(false);
    }
  }

  // While a new dashboard is on its way, watch the (hidden) viewer: when the
  // dashboard's first part, or an error, appears, open it full screen.
  useEffect(() => {
    if (!waiting || !run?.response) return;
    const viewer = document.querySelector(".viewer");
    if (!viewer) return;
    const check = () => {
      if (!viewer.querySelector(".openui-dashboard, .run__error")) return false;
      setWaiting(false);
      setOpen(true);
      return true;
    };
    if (check()) return;
    const observer = new MutationObserver(() => {
      if (check()) observer.disconnect();
    });
    observer.observe(viewer, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [waiting, run?.response]);

  // A question from a gallery chart: build it straight into the viewer.
  // Started a tick later, so a development double mount (whose unmount
  // aborts the request) cancels the timer instead.
  const handled = useRef(0);
  useEffect(() => {
    if (!ask || handled.current === ask.id) return;
    const timer = setTimeout(() => {
      handled.current = ask.id;
      setTrail([]);
      setOrigin(ask.from.title);
      setPrompt(ask.prompt);
      void start(ask.prompt);
    });
    return () => clearTimeout(timer);
    // start is redefined each render; only a new question should run it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ask]);

  /** A question from a chart in the viewer: keep this dashboard to go back to, then answer it. */
  function dig(question: string) {
    if (run?.id) {
      const title = (run.response && titleIn(run.response)) || run.asked;
      setTrail((prev) => [...prev, { id: run.id!, asked: run.asked, title }]);
    }
    setPrompt(question);
    void start(question);
  }

  /** Back to the dashboard this one was dug out of, as saved (no new generation). */
  function back() {
    const last = trail[trail.length - 1];
    if (!last) return;
    abort.current?.abort();
    setStarting(false);
    setWaiting(false);
    setFailed("");
    setTrail((prev) => prev.slice(0, -1));
    setRun({ id: last.id, asked: last.asked });
  }

  /** A change to the open dashboard: OpenUI patches it in place, and the viewer switches to it. */
  async function edit(change: string) {
    if (!run?.id) return;
    const response = await editDashboard(kitId, run.id, change);
    setRun({ id: run.id, response, asked: change });
  }

  // The list shows a dashboard once it's built and saved.
  const onSaved = useCallback(() => setSaved((n) => n + 1), []);

  /** Opens a saved dashboard from the list. */
  function openSaved(item: ArtifactSummary) {
    opener.current = document.activeElement as HTMLElement | null;
    abort.current?.abort();
    setStarting(false);
    setWaiting(false);
    setFailed("");
    setTrail([]);
    setOrigin(null);
    setRun({ id: item.id, asked: "" });
    setOpen(true);
  }

  // Full-page viewer: Escape closes it, the page behind doesn't scroll, and
  // focus moves to its close button and back where it was.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    closer.current?.focus();
    const returnTo = opener.current;
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
      returnTo?.focus();
    };
  }, [open]);

  const previous = trail[trail.length - 1];
  const backTo = previous
    ? { label: previous.title, onClick: back }
    : origin && onReturn
      ? { label: origin, onClick: onReturn }
      : undefined;
  const article = /^[aeiou]/i.test(kit.name) ? "an" : "a";

  return (
    <section className="view">
      <form
        className="composer"
        onSubmit={(event) => {
          event.preventDefault();
          if (starting || !prompt.trim()) return;
          opener.current = document.activeElement as HTMLElement | null;
          setTrail([]);
          setOrigin(null);
          void start(prompt.trim());
        }}
      >
        <label htmlFor="prompt" className="composer__label">
          Ask for {article} {kit.name.toLowerCase()} dashboard
        </label>
        <div className="composer__box">
          <textarea
            id="prompt"
            rows={3}
            value={prompt}
            placeholder="Describe the dashboard you want, or pick an example below"
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <div className="composer__actions">
            <span className="composer__keys" aria-hidden>
              ⌘ Enter
            </span>
            <button
              type="submit"
              className="button button--primary"
              disabled={starting || !prompt.trim()}
            >
              {starting ? "Starting…" : "Generate"}
            </button>
          </div>
        </div>
        <details className="suggestions" open={run ? undefined : true}>
          <summary className="suggestions__label">Try one of these</summary>
          <ul className="suggestions__list">
            {kit.starters.map((starter) => (
              <li key={starter}>
                <button
                  type="button"
                  className="suggestion"
                  title={starter}
                  aria-pressed={prompt === starter}
                  onClick={() => setPrompt(starter)}
                >
                  {starter}
                </button>
              </li>
            ))}
          </ul>
        </details>
        <p className="composer__note">
          Built and saved with <strong>OpenUI Dashboards</strong>: the model writes the dashboard
          once, and it loads live data every time it opens.
        </p>
      </form>

      {!open && waiting && (
        <div className="pending run--waiting">
          <div className="pending__bar" role="status" aria-live="polite">
            <span className="run__dot" aria-hidden />
            <strong>{starting ? "Starting" : "Waiting for the model"}</strong>
            <span className="run__meta">{elapsed.toFixed(1)} s</span>
          </div>
          <div className="run__waiting" aria-hidden>
            <div className="skeleton skeleton--title" />
            <div className="skeleton-row">
              <div className="skeleton skeleton--hero" />
              <div className="skeleton skeleton--side" />
            </div>
            <div className="skeleton-row skeleton-row--kpis">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="skeleton skeleton--kpi" />
              ))}
            </div>
          </div>
        </div>
      )}

      {!open && failed && (
        <div className="pending run--error">
          <div className="pending__bar" role="status">
            <span className="run__dot" aria-hidden />
            <strong>Generation failed</strong>
            <span className="run__meta">{failed}</span>
            <button
              type="button"
              className="button button--primary"
              onClick={() => void start(run?.asked ?? prompt)}
            >
              Try again
            </button>
          </div>
        </div>
      )}

      <MyDashboards kitId={kitId} library={library} onOpen={openSaved} refreshKey={saved} />

      <DashboardViewer
        kitId={kitId}
        library={library}
        open={open}
        onClose={() => setOpen(false)}
        closer={closer}
        run={run}
        starting={starting}
        failed={
          failed ? { message: failed, retry: () => void start(run?.asked ?? prompt) } : undefined
        }
        back={backTo}
        onDig={dig}
        onEdit={edit}
        onSaved={onSaved}
      />
    </section>
  );
}
