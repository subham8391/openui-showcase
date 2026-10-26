"use client";

import { useEffect, useState } from "react";
import { SiteShell } from "../../_site/site-shell";
import { KITS } from "../_kits";
import "../dashboard-kits.css";
import { GalleryView } from "./gallery-view";
import { GenerateView } from "./generate-view";
import { PromptView } from "./prompt-view";

type View = "gallery" | "generate" | "prompt";

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
