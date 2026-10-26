"use client";

import { Renderer, type OpenUIError } from "@openuidev/react-lang";
import { useEffect, useMemo, useRef, useState } from "react";
import { KITS } from "../kits";
import { createToolProvider, KIT_LIBRARIES, type ToolCall } from "../kits/client";
import { ScaledFrame } from "./scaled-frame";
import { SiteShell } from "./site-shell";

type View = "gallery" | "generate" | "prompt";

/** Where this example's API routes live (src/app/api/dashboard-kits). */
const API = "/api/dashboard-kits";

const KIT_ICONS: Record<string, string> = {
  ecommerce:
    "M4 6h16l-1.5 9.5a2 2 0 0 1-2 1.5H7.5a2 2 0 0 1-2-1.5L4 6Zm0 0L3.2 3H1.5M9 21h.01M16 21h.01",
  analytics: "M4 20V10m6 10V4m6 16v-7m6 7V8",
};

export function KitWorkspace() {
  const [kitId, setKitId] = useState(KITS[0].id);
  const [view, setView] = useState<View>("gallery");
  // The gallery dashboard a link asked for (?kit=ecommerce&dashboard=2).
  const [startAt, setStartAt] = useState(0);
  const kit = KITS.find((k) => k.id === kitId)!;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const linked = KITS.find((k) => k.id === params.get("kit"));
    if (!linked) return;
    const index = Number(params.get("dashboard"));
    setKitId(linked.id);
    setView("gallery");
    if (Number.isInteger(index) && index >= 0 && index < linked.gallery.length) setStartAt(index);
  }, []);

  return (
    <SiteShell crumb="Dashboard kits">
      <section className="kits-head">
        <h1>Dashboard kits</h1>
        <p>
          Two domains a model can build dashboards in. Browse the gallery, generate one from a
          sentence, or read the prompt the model gets.
        </p>
      </section>

      <div className="toolbar">
        <div className="kit-switch" role="radiogroup" aria-label="Kit">
          {KITS.map((k) => (
            <button
              key={k.id}
              type="button"
              role="radio"
              aria-checked={k.id === kitId}
              onClick={() => {
                setKitId(k.id);
                setStartAt(0);
              }}
            >
              <svg viewBox="0 0 24 24" aria-hidden>
                <path d={KIT_ICONS[k.id] ?? KIT_ICONS.analytics} />
              </svg>
              {k.name}
              <span className="kit-switch__count">{k.gallery.length}</span>
            </button>
          ))}
        </div>

        <div className="tabs" role="tablist" aria-label="Views">
          {(["gallery", "generate", "prompt"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={v === view}
              className="tabs__tab"
              onClick={() => setView(v)}
            >
              {{ gallery: "Gallery", generate: "Generate", prompt: "Prompt" }[v]}
            </button>
          ))}
        </div>
      </div>
      <p className="kit-summary">
        {kit.tagline} <span>{kit.tools.length} data tools</span>
      </p>

      {view === "gallery" && (
        <GalleryView key={`${kit.id}-${startAt}`} kitId={kit.id} startAt={startAt} />
      )}
      {view === "generate" && <GenerateView key={kit.id} kitId={kit.id} />}
      {view === "prompt" && <PromptView key={kit.id} kitId={kit.id} />}
    </SiteShell>
  );
}

function useKitRenderer(kitId: string) {
  const kit = KITS.find((k) => k.id === kitId)!;
  const [calls, setCalls] = useState<ToolCall[]>([]);
  const [errors, setErrors] = useState<OpenUIError[]>([]);
  const toolProvider = useMemo(
    () =>
      createToolProvider(kit, {
        endpoint: `${API}/tools`,
        onCall: (call) => setCalls((prev) => [...prev.slice(-49), call]),
      }),
    [kit],
  );
  return {
    kit,
    library: KIT_LIBRARIES[kitId],
    toolProvider,
    calls,
    errors,
    onError: setErrors,
    reset: () => {
      setCalls([]);
      setErrors([]);
    },
  };
}

/** One gallery dashboard rendered as it is in the gallery, for previews elsewhere. */
export function KitPreview({ kitId, index = 0 }: { kitId: string; index?: number }) {
  const { kit, library, toolProvider } = useKitRenderer(kitId);
  return (
    <Renderer
      response={kit.gallery[index].program}
      library={library}
      isStreaming={false}
      toolProvider={toolProvider}
    />
  );
}

function GalleryView({ kitId, startAt = 0 }: { kitId: string; startAt?: number }) {
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
          {dashboard.description} <span className="badge">Hand-written · no model needed</span>
        </p>
      </div>
      <div className="canvas">
        <Renderer
          key={`${kitId}-${index}`}
          response={dashboard.program}
          library={library}
          isStreaming={false}
          toolProvider={toolProvider}
          onError={onError}
        />
      </div>
      <RunDetails program={dashboard.program} calls={calls} errors={errors} />
    </section>
  );
}

/**
 * The part of a streaming program that is safe to render. A `$variable`
 * declaration still arriving (`$range = "3`) parses as that partial value, and
 * react-lang's store keeps the first default it sees for a variable, so the
 * filter would stick at "3" and every Query reading it would fail. Holding back
 * an unfinished declaration line until its newline arrives avoids that; the
 * finished program renders in full.
 */
function renderable(text: string, streaming: boolean): string {
  if (!streaming) return text;
  const lineStart = text.lastIndexOf("\n") + 1;
  return /^\s*\$[\w]+\s*=/.test(text.slice(lineStart)) ? text.slice(0, lineStart) : text;
}

type RunStatus = "idle" | "waiting" | "writing" | "done" | "stopped" | "error";

function statusLabel(status: RunStatus): string {
  return {
    idle: "",
    waiting: "Waiting for the model",
    writing: "Writing the dashboard",
    done: "Done",
    stopped: "Stopped",
    error: "Failed",
  }[status];
}

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

function GenerateView({ kitId }: { kitId: string }) {
  const { kit, library, toolProvider, calls, errors, onError, reset } = useKitRenderer(kitId);
  const [prompt, setPrompt] = useState("");
  const [asked, setAsked] = useState("");
  const [program, setProgram] = useState("");
  const [status, setStatus] = useState<RunStatus>("idle");
  const [error, setError] = useState("");
  const [model, setModel] = useState("");
  const [started, setStarted] = useState(0);
  const [took, setTook] = useState(0);
  const [copied, setCopied] = useState(false);
  const [run, setRun] = useState(0);
  const abort = useRef<AbortController | null>(null);
  const [open, setOpen] = useState(false);
  // The card's thumbnail runs its own tools, so the run details count only the viewer's calls.
  const thumbTools = useMemo(() => createToolProvider(kit, { endpoint: `${API}/tools` }), [kit]);
  const opener = useRef<HTMLButtonElement>(null);
  const closer = useRef<HTMLButtonElement>(null);
  const busy = status === "waiting" || status === "writing";
  const elapsed = useElapsed(started, busy);
  const title = /DashboardHeader\(\s*"([^"]+)"/.exec(program)?.[1];

  useEffect(() => () => abort.current?.abort(), []);

  // Full-page viewer: Escape closes it, the page behind doesn't scroll, and
  // focus moves to its close button and back to the card's open button.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    closer.current?.focus();
    const card = opener.current;
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
      card?.focus();
    };
  }, [open]);

  async function generate(text = prompt) {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    reset();
    setProgram("");
    setError("");
    setModel("");
    setAsked(text);
    setRun((r) => r + 1);
    setStatus("waiting");
    const t0 = performance.now();
    setStarted(t0);
    try {
      const response = await fetch(`${API}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kit: kit.id, prompt: text }),
        signal: controller.signal,
      });
      if (!response.ok || !response.body) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? `Generation failed (${response.status})`);
      }
      setModel(response.headers.get("X-Model") ?? "");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let out = "";
      let writing = false;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        out += decoder.decode(value, { stream: true });
        if (!writing && out.trim()) {
          writing = true;
          setStatus("writing");
          // The model has started writing: switch to full screen to watch it
          // build. Only once, so closing the viewer mid-run keeps it closed.
          setOpen(true);
        }
        setProgram(out);
      }
      setTook((performance.now() - t0) / 1000);
      setStatus(out.trim() ? "done" : "error");
      if (!out.trim()) setError("The model returned nothing. Try again or rephrase the question.");
    } catch (err) {
      setTook((performance.now() - t0) / 1000);
      if (controller.signal.aborted) {
        setStatus("stopped");
        return;
      }
      setStatus("error");
      setError((err as Error).message);
    }
  }

  async function copyProgram() {
    try {
      await navigator.clipboard.writeText(program);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be refused; the program is still under "openui-lang program".
    }
  }

  const article = /^[aeiou]/i.test(kit.name) ? "an" : "a";

  return (
    <section className="view">
      <form
        className="composer"
        onSubmit={(event) => {
          event.preventDefault();
          if (!busy && prompt.trim()) void generate();
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
              disabled={busy || !prompt.trim()}
            >
              {busy ? "Generating…" : "Generate"}
            </button>
          </div>
        </div>
        <details className="suggestions" open={status === "idle" ? true : undefined}>
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
      </form>

      {!program && !open && status === "waiting" && (
        <div className="pending run--waiting">
          <div className="pending__bar" role="status" aria-live="polite">
            <span className="run__dot" aria-hidden />
            <strong>Waiting for the model</strong>
            <span className="run__meta">
              {[model, `${elapsed.toFixed(1)} s`].filter(Boolean).join(" · ")}
            </span>
            <button type="button" className="button" onClick={() => abort.current?.abort()}>
              Stop
            </button>
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

      {!program && !open && (status === "error" || status === "stopped") && (
        <div className={`pending run--${status}`}>
          <div className="pending__bar" role="status">
            <span className="run__dot" aria-hidden />
            <strong>{status === "error" ? "Generation failed" : "Stopped"}</strong>
            <span className="run__meta">
              {status === "error" ? error : "before the model wrote anything"}
            </span>
            <button
              type="button"
              className="button button--primary"
              onClick={() => void generate(asked)}
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {(program || open) && (
        <>
          {/* The card stands for the run once the viewer is closed; while it is
              open the card isn't drawn, so it can't flash behind the viewer. */}
          <div className={`artifact run--${status}`} hidden={open}>
            <span className="artifact__thumb">
              {program && !open ? (
                <ScaledFrame className="artifact__frame">
                  <Renderer
                    response={renderable(program, status === "writing")}
                    library={library}
                    isStreaming={status === "writing"}
                    toolProvider={thumbTools}
                  />
                </ScaledFrame>
              ) : (
                <span className="artifact__shimmer" aria-hidden>
                  <span className="skeleton skeleton--title" />
                  <span className="skeleton-row">
                    <span className="skeleton skeleton--hero" />
                    <span className="skeleton skeleton--side" />
                  </span>
                </span>
              )}
              <span className="artifact__chip">
                <span className="run__dot" aria-hidden />
                {statusLabel(status)} · {(busy ? elapsed : took).toFixed(1)} s
              </span>
              <span className="artifact__play" aria-hidden>
                <svg viewBox="0 0 24 24">
                  <path d="M8 5.5v13l11-6.5z" />
                </svg>
              </span>
            </span>
            <span className="artifact__foot">
              <span className="artifact__text">
                <span className="artifact__title">{title ?? (busy ? "New dashboard" : asked)}</span>
                <span className="artifact__meta">
                  {[
                    `${kit.name} dashboard`,
                    model,
                    program && `${program.length.toLocaleString()} characters`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
              <span className="artifact__open">
                Open
                <svg viewBox="0 0 24 24" aria-hidden>
                  <path d="M14 4h6v6M20 4l-8 8M10 6H5a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5" />
                </svg>
              </span>
            </span>
            {/* Stretched over the whole card; a sibling of the thumbnail, so the
                dashboard's own buttons never sit inside it. */}
            <button
              ref={opener}
              type="button"
              className="artifact__hit"
              onClick={() => setOpen(true)}
              aria-label={`Open ${title ?? "the dashboard"} full screen`}
            />
          </div>

          <div
            className={`viewer run--${status}`}
            role="dialog"
            aria-modal="true"
            aria-label={title ?? "Generated dashboard"}
            hidden={!open}
          >
            <header className="viewer__bar">
              <div className="viewer__heading">
                <strong className="viewer__title">{title ?? "New dashboard"}</strong>
                <span className="viewer__status" role="status" aria-live="polite">
                  <span className="run__dot" aria-hidden />
                  {statusLabel(status)}
                  <span className="run__meta">
                    {[
                      model,
                      `${(busy ? elapsed : took).toFixed(1)} s`,
                      program && `${program.length.toLocaleString()} characters`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                <span className="run__asked" title={asked}>
                  “{asked}”
                </span>
              </div>
              <div className="viewer__actions">
                {busy ? (
                  <button type="button" className="button" onClick={() => abort.current?.abort()}>
                    Stop
                  </button>
                ) : (
                  <>
                    {program && (
                      <button type="button" className="button" onClick={() => void copyProgram()}>
                        {copied ? "Copied" : "Copy program"}
                      </button>
                    )}
                    <button
                      type="button"
                      className="button button--primary"
                      onClick={() => void generate(asked)}
                    >
                      {status === "error" ? "Try again" : "Regenerate"}
                    </button>
                  </>
                )}
                <button
                  ref={closer}
                  type="button"
                  className="viewer__close"
                  aria-label="Close"
                  onClick={() => setOpen(false)}
                >
                  <svg viewBox="0 0 24 24" aria-hidden>
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>
            </header>

            <div className="viewer__body">
              {status === "error" && <p className="run__error">{error}</p>}
              {status === "waiting" && (
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
              )}
              {program && (
                <div className="canvas">
                  <Renderer
                    key={run}
                    response={renderable(program, status === "writing")}
                    library={library}
                    isStreaming={status === "writing"}
                    toolProvider={toolProvider}
                    onError={onError}
                  />
                </div>
              )}
              {program && !busy && <RunDetails program={program} calls={calls} errors={errors} />}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function RunDetails({
  program,
  calls,
  errors,
}: {
  program: string;
  calls: ToolCall[];
  errors: OpenUIError[];
}) {
  const failed = calls.filter((c) => !c.ok).length;
  return (
    <div className="details">
      <p className="details__summary">
        {calls.length} tool {calls.length === 1 ? "call" : "calls"}
        {failed > 0 && <span className="details__bad"> · {failed} failed</span>}
        {" · "}
        {errors.length === 0 ? (
          "no renderer errors"
        ) : (
          <span className="details__bad">
            {errors.length} renderer {errors.length === 1 ? "error" : "errors"}
          </span>
        )}
      </p>
      {errors.length > 0 && (
        <ul className="details__errors">
          {errors.map((error, i) => (
            <li key={i}>
              <code>{error.code}</code> {error.message}
            </li>
          ))}
        </ul>
      )}
      <details>
        <summary>Tool calls</summary>
        <ul className="details__calls">
          {calls.map((call, i) => (
            <li key={i}>
              <code>{call.tool}</code> {JSON.stringify(call.args)} · {call.ms} ms
              {call.ok ? "" : " · failed"}
            </li>
          ))}
        </ul>
      </details>
      <details>
        <summary>openui-lang program</summary>
        <pre className="code">{program}</pre>
      </details>
    </div>
  );
}

function PromptView({ kitId }: { kitId: string }) {
  const kit = KITS.find((k) => k.id === kitId)!;
  const library = KIT_LIBRARIES[kitId];
  const [data, setData] = useState<{
    prompt: string;
    tools: { name: string; description?: string }[];
  } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${API}/prompt?kit=${kitId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`Prompt failed (${r.status})`))))
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, [kitId]);

  const kitGroup = library.componentGroups?.at(-1);
  return (
    <section className="view">
      <div className="stats">
        <Stat
          label="Components"
          value={`${Object.keys(library.components).length}`}
          detail={`${kitGroup?.components.length ?? 0} from this kit`}
        />
        <Stat label="Data tools" value={`${kit.tools.length}`} detail="read-only, via Query()" />
        <Stat label="Examples" value={`${kit.gallery.length}`} detail="the gallery dashboards" />
        <Stat
          label="System prompt"
          value={data ? `${(data.prompt.length / 1000).toFixed(1)}K` : "…"}
          detail="characters"
        />
      </div>
      {error && <p className="run__error">{error}</p>}
      <div className="prompt-grid">
        <div>
          <h2>Kit components</h2>
          <ul className="plain-list">
            {kitGroup?.components.map((name) => (
              <li key={name}>
                <code>{name}</code> {library.components[name]?.description}
              </li>
            ))}
          </ul>
          <h2>Data tools</h2>
          <ul className="plain-list">
            {data?.tools.map((tool) => (
              <li key={tool.name}>
                <code>{tool.name}</code> {tool.description}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2>System prompt</h2>
          <pre className="code code--tall">{data?.prompt ?? "Loading…"}</pre>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="stat">
      <span className="stat__label">{label}</span>
      <span className="stat__value">{value}</span>
      <span className="stat__detail">{detail}</span>
    </div>
  );
}
