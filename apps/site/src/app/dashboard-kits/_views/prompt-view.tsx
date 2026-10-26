"use client";

import { useEffect, useState } from "react";
import { KITS } from "../_kits";
import { KIT_LIBRARIES } from "../_kits/client";
import { API } from "./use-kit-renderer";

export function PromptView({ kitId }: { kitId: string }) {
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
