"use client";

import { SiteShell } from "@/shared/ui/site-shell";
import { useEffect, useState } from "react";
import { KITS } from "../kits";
import "./dashboard-kits.css";
import { GalleryView } from "./gallery-view";
import { GenerateView } from "./generate-view";
import { PromptView } from "./prompt-view";

type View = "gallery" | "generate" | "prompt";

const KIT_ICONS: Record<string, string> = {
  ecommerce:
    "M4 6h16l-1.5 9.5a2 2 0 0 1-2 1.5H7.5a2 2 0 0 1-2-1.5L4 6Zm0 0L3.2 3H1.5M9 21h.01M16 21h.01",
  analytics: "M4 20V10m6 10V4m6 16v-7m6 7V8",
};

export function KitWorkspace({
  cloudUrl,
  canGenerate,
}: {
  cloudUrl: string;
  /** False when the site has no key: Generate shows a paused notice and dig-in is off. */
  canGenerate: boolean;
}) {
  const [kitId, setKitId] = useState(KITS[0].id);
  const [view, setView] = useState<View>("gallery");
  // The gallery dashboard a link asked for (?kit=ecommerce&dashboard=2).
  const [startAt, setStartAt] = useState(0);
  // A question asked from a gallery chart, for the Generate view to answer.
  const [ask, setAsk] = useState<
    { prompt: string; id: number; from: { title: string; index: number } } | undefined
  >();
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
          {canGenerate
            ? "Two domains a model can build dashboards in. Browse the gallery, generate one from a sentence, or read the prompt the model gets."
            : "Two domains a model can build dashboards in. Browse the gallery, or read the prompt the model gets."}
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
                setAsk(undefined);
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
              onClick={() => {
                setView(v);
                setAsk(undefined);
              }}
            >
              {{ gallery: "Gallery", generate: "Generate", prompt: "Prompt" }[v]}
            </button>
          ))}
        </div>
      </div>
      <p className="kit-summary">
        <span className="kit-summary__text">
          {kit.tagline} <span className="kit-summary__count">{kit.tools.length} data tools</span>
        </span>
      </p>

      {view === "gallery" && (
        <GalleryView
          key={`${kit.id}-${startAt}`}
          kitId={kit.id}
          startAt={startAt}
          onAsk={
            canGenerate
              ? (prompt, from) => {
                  setAsk({ prompt, id: Date.now(), from });
                  setView("generate");
                }
              : undefined
          }
        />
      )}
      {view === "generate" && !canGenerate && (
        <GenerationPaused onGallery={() => setView("gallery")} onPrompt={() => setView("prompt")} />
      )}
      {view === "generate" && canGenerate && (
        <GenerateView
          key={kit.id}
          kitId={kit.id}
          cloudUrl={cloudUrl}
          ask={ask}
          onReturn={() => {
            // Back to the gallery dashboard the question was asked from.
            if (ask) setStartAt(ask.from.index);
            setAsk(undefined);
            setView("gallery");
          }}
        />
      )}
      {view === "prompt" && <PromptView key={kit.id} kitId={kit.id} />}
    </SiteShell>
  );
}

/** Generate's place while the site has no key. */
function GenerationPaused({
  onGallery,
  onPrompt,
}: {
  onGallery: () => void;
  onPrompt: () => void;
}) {
  return (
    <section className="view">
      <div className="paused" role="status">
        <strong>Generation is paused for now</strong>
        <p>
          Building dashboards from a question is switched off on this site for the moment. The
          gallery&apos;s hand-written dashboards still run on live sample data, and the Prompt view
          shows everything a model gets.
        </p>
        <div className="paused__actions">
          <button type="button" className="button button--primary" onClick={onGallery}>
            Browse the gallery
          </button>
          <button type="button" className="button" onClick={onPrompt}>
            Read the prompt
          </button>
        </div>
      </div>
    </section>
  );
}
