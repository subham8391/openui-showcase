"use client";

import type { Library } from "@openuidev/react-lang";
import {
  LiveArtifactRenderer,
  useArtifactRenderer,
  useArtifactUpdate,
} from "@openuidev/react-ui/cloud";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { DrillProvider } from "../blocks/Drill";
import { cloudRoutes } from "./cloud";

/** The dashboard the viewer shows: by its create or edit response, else by id. */
export interface ViewerRun {
  id?: string;
  response?: string;
  /** The request it was built from, shown under the title. */
  asked: string;
  /** Just created: once built, it takes its header's title in place of the request's. */
  created?: boolean;
}

interface ViewerProps {
  kitId: string;
  library: Library;
  open: boolean;
  onClose: () => void;
  closer: RefObject<HTMLButtonElement | null>;
  run: ViewerRun | null;
  /** The create call is in flight: no response to stream yet. */
  starting: boolean;
  /** Why the create call failed, with a retry. */
  failed?: { message: string; retry: () => void };
  /** Back to the dashboard this one was dug out of, or the gallery it began on. */
  back?: { label: string; onClick: () => void };
  /** A question from a chart: build a dashboard that answers it. */
  onDig: (question: string) => void;
  /** A change to this dashboard, in words. */
  onEdit: (change: string) => Promise<void>;
  /** The dashboard finished building and is saved. */
  onSaved: () => void;
}

/** What the renderer is doing, in words, with the dot's tone. */
function statusOf(state: { isStreaming: boolean; isFetching: boolean; error: unknown }): {
  label: string;
  tone: "busy" | "done" | "error";
} {
  if (state.error) return { label: "Couldn't load", tone: "error" };
  if (state.isStreaming) return { label: "Building", tone: "busy" };
  if (state.isFetching) return { label: "Loading data", tone: "busy" };
  return { label: "Live", tone: "done" };
}

function Skeleton() {
  return (
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
  );
}

/** The viewer's top bar: back, title and status, the request, and close. */
function Bar({
  title,
  status,
  asked,
  back,
  onClose,
  closer,
  actions,
}: {
  title: string;
  status: { label: string; tone: string };
  asked: string;
  back?: ViewerProps["back"];
  onClose: () => void;
  closer: RefObject<HTMLButtonElement | null>;
  actions?: ReactNode;
}) {
  return (
    <header className={`viewer__bar run--${status.tone}`}>
      {back && (
        <button
          type="button"
          className="viewer__back"
          onClick={back.onClick}
          title={`Back to ${back.label}`}
        >
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M15 5l-7 7 7 7" />
          </svg>
          <span className="viewer__back-text">{back.label}</span>
        </button>
      )}
      <div className="viewer__heading">
        <strong className="viewer__title">{title}</strong>
        <span className="viewer__status" role="status" aria-live="polite">
          <span className="run__dot" aria-hidden />
          {status.label}
        </span>
        {asked && (
          <span className="run__asked" title={asked}>
            “{asked}”
          </span>
        )}
      </div>
      <div className="viewer__actions">
        {actions}
        <button
          ref={closer}
          type="button"
          className="viewer__close"
          aria-label="Close"
          onClick={onClose}
        >
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
    </header>
  );
}

/** "Change it…": a change to the open dashboard, in words, applied by OpenUI as an edit. */
function ChangeBox({ onEdit, busy }: { onEdit: ViewerProps["onEdit"]; busy: boolean }) {
  const [change, setChange] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const disabled = busy || sending;
  return (
    <form
      className="viewer__change"
      onSubmit={async (event) => {
        event.preventDefault();
        const text = change.trim();
        if (!text || disabled) return;
        setSending(true);
        setError("");
        try {
          await onEdit(text);
          setChange("");
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setSending(false);
        }
      }}
    >
      <label htmlFor="viewer-change" className="kit-visually-hidden">
        Change this dashboard
      </label>
      <input
        id="viewer-change"
        value={change}
        onChange={(event) => setChange(event.target.value)}
        placeholder={
          busy
            ? "Wait for the dashboard to finish…"
            : "Change it: “add a chart of returns by reason”"
        }
        disabled={disabled}
        autoComplete="off"
      />
      <button
        type="submit"
        className="button button--primary"
        disabled={disabled || !change.trim()}
      >
        {sending ? "Sending…" : "Change"}
      </button>
      {error && (
        <p className="viewer__change-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

/**
 * When the dashboard has finished building and its data has loaded (it's
 * saved by then): a new one takes the title from its own header, which names
 * it better than the request did, and the saved list is told. Waiting for the
 * data matters: a header that reads a query shows its values only then.
 */
function useWhenBuilt(created: boolean | undefined, onSaved: () => void) {
  const { id, title, isStreaming, isFetching } = useArtifactRenderer();
  const { update } = useArtifactUpdate();
  const built = useRef(false);
  const named = useRef(false);
  useEffect(() => {
    if (isStreaming) {
      built.current = true;
      return;
    }
    if (!built.current || isFetching) return;
    // Settled for a moment: building can end a beat before the queries start.
    const timer = setTimeout(() => {
      built.current = false;
      const header = document
        .querySelector(".viewer .openui-dashboard-header-title")
        ?.textContent?.trim();
      if (created && !named.current && id && header && header !== title) {
        named.current = true;
        void update(id, { title: header }).finally(onSaved);
      } else {
        onSaved();
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [isStreaming, isFetching, created, id, title, update, onSaved]);
}

/** Inside the renderer: the bar, the dashboard (charts can be dug into once it's built), the change box. */
function LiveChrome(props: ViewerProps & { asked: string; created?: boolean }) {
  const state = useArtifactRenderer();
  const status = statusOf(state);
  useWhenBuilt(props.created, props.onSaved);
  return (
    <>
      <Bar
        title={state.title || "New dashboard"}
        status={status}
        asked={props.asked}
        back={props.back}
        onClose={props.onClose}
        closer={props.closer}
      />
      <div className="viewer__body">
        <DrillProvider onAsk={props.onDig} disabled={state.isStreaming || Boolean(state.error)}>
          <LiveArtifactRenderer.Content className="canvas">
            {/* The slot stays up the whole time the dashboard builds, over the
                parts already drawn; the bar's status says it's building. */}
            <LiveArtifactRenderer.Loading>
              <></>
            </LiveArtifactRenderer.Loading>
            <LiveArtifactRenderer.Error>
              <ViewerError />
            </LiveArtifactRenderer.Error>
          </LiveArtifactRenderer.Content>
        </DrillProvider>
      </div>
      <ChangeBox onEdit={props.onEdit} busy={state.isStreaming} />
    </>
  );
}

function ViewerError() {
  const { error, retry } = useArtifactRenderer();
  return (
    <div className="run__error" role="alert">
      <p>
        {error?.source === "query" ? "Some data didn't load." : "This dashboard couldn't be shown."}
      </p>
      {retry && (
        <button type="button" className="button" onClick={retry}>
          Try again
        </button>
      )}
    </div>
  );
}

/**
 * The full-page dashboard viewer: a dialog over the page, with the dashboard
 * streamed and kept live by OpenUI's renderer (its data runs through the kit's
 * interpreter route), and a box to change it.
 */
export function DashboardViewer(props: ViewerProps) {
  const { kitId, library, open, run, starting, failed } = props;
  const live = run && (run.response || run.id);
  return (
    <div className="viewer" role="dialog" aria-modal="true" aria-label="Dashboard" hidden={!open}>
      {live ? (
        <LiveArtifactRenderer
          key={run.id ?? run.response}
          {...(run.response ? { response: run.response } : { id: run.id })}
          library={library}
          interpreter={cloudRoutes(kitId).interpreter}
          preview={false}
          className="viewer__renderer"
        >
          <LiveArtifactRenderer.Chrome>
            <LiveChrome {...props} asked={run.asked} created={run.created} />
          </LiveArtifactRenderer.Chrome>
        </LiveArtifactRenderer>
      ) : (
        <>
          <Bar
            title="New dashboard"
            status={
              failed
                ? { label: "Failed", tone: "error" }
                : { label: starting ? "Starting" : "", tone: "busy" }
            }
            asked={run?.asked ?? ""}
            back={props.back}
            onClose={props.onClose}
            closer={props.closer}
            actions={
              failed && (
                <button type="button" className="button button--primary" onClick={failed.retry}>
                  Try again
                </button>
              )
            }
          />
          <div className="viewer__body">
            {failed ? <p className="run__error">{failed.message}</p> : <Skeleton />}
          </div>
        </>
      )}
    </div>
  );
}
