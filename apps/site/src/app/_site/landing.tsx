"use client";

import Link from "next/link";
import { KITS } from "../dashboard-kits/_kits";
import { KitPreview } from "../dashboard-kits/_views/kit-preview";
import { EXAMPLES, REPO_URL } from "./examples";
import { ScaledFrame } from "./scaled-frame";
import { SiteShell } from "./site-shell";

const DASHBOARDS = KITS.reduce((n, k) => n + k.gallery.length, 0);
const TOOLS = KITS.reduce((n, k) => n + k.tools.length, 0);

/**
 * Lines from the first gallery program, in the order a reader follows them: a
 * filter, a tool query that reads it, and the components drawn from the result.
 */
const SNIPPET_LINES = ["$range =", "profit = Query(", "profitChart =", "profitCard ="];
const SNIPPET = (() => {
  const lines = KITS[0].gallery[0].program.split("\n");
  const picked = SNIPPET_LINES.map((start) => lines.find((line) => line.startsWith(start)));
  const shown = picked.every(Boolean)
    ? (picked as string[])
    : lines.filter((line) => line.trim()).slice(0, 4);
  return shown.map((line) => (line.length > 84 ? `${line.slice(0, 83)}…` : line)).join("\n");
})();

/** A real gallery dashboard, scaled down; the link around it opens the dashboard itself. */
function LivePreview() {
  return (
    <Link
      href={`/dashboard-kits?kit=${KITS[0].id}&dashboard=0`}
      className="preview"
      aria-label={`Open the ${KITS[0].gallery[0].title} dashboard`}
    >
      <span className="preview__label">
        <span className="preview__dot" aria-hidden />
        Live · {KITS[0].name} · {KITS[0].gallery[0].title}
      </span>
      <ScaledFrame className="preview__frame">
        <KitPreview kitId={KITS[0].id} />
      </ScaledFrame>
    </Link>
  );
}

export function Landing() {
  const kits = EXAMPLES[0];

  return (
    <SiteShell>
      <section className="hero">
        <p className="eyebrow">Generative UI, end to end</p>
        <h1>Interfaces a model writes and OpenUI renders</h1>
        <p className="hero__lead">
          Each example here is a working app. A model gets a library of components and data tools,
          writes a short openui-lang program, and OpenUI renders it into real, interactive UI as it
          streams. Browse what the examples build, generate your own from a sentence, and read the
          code.
        </p>
        <div className="hero__actions">
          <Link href={kits.href} className="button button--primary">
            Open the dashboard kits
          </Link>
          <a href={REPO_URL} className="button" target="_blank" rel="noreferrer">
            Code on GitHub
          </a>
        </div>
      </section>

      <section className="feature" aria-labelledby="feature-kits">
        <div className="feature__text">
          <p className="eyebrow">Example 01</p>
          <h2 id="feature-kits">{kits.name}</h2>
          <p className="feature__summary">{kits.summary}</p>

          <dl className="facts">
            <div>
              <dt>Kits</dt>
              <dd>{KITS.length}</dd>
            </div>
            <div>
              <dt>Dashboards</dt>
              <dd>{DASHBOARDS}</dd>
            </div>
            <div>
              <dt>Data tools</dt>
              <dd>{TOOLS}</dd>
            </div>
          </dl>

          <div className="feature__kits">
            {KITS.map((kit) => (
              <div key={kit.id} className="feature__kit">
                <h3>
                  <Link href={`${kits.href}?kit=${kit.id}`}>{kit.name}</Link>
                </h3>
                <p>{kit.tagline}</p>
                <ul className="chips" aria-label={`${kit.name} dashboards`}>
                  {kit.gallery.map((d, i) => (
                    <li key={d.title}>
                      <Link className="chip" href={`${kits.href}?kit=${kit.id}&dashboard=${i}`}>
                        {d.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <LivePreview />
      </section>

      <section className="steps" aria-labelledby="how-it-works">
        <h2 id="how-it-works">How each example works</h2>
        <ol className="steps__list">
          <li className="step">
            <span className="step__n">1</span>
            <h3>A kit describes the domain</h3>
            <p>
              Components to build with, read-only data tools to fill them, rules for what a good
              dashboard looks like, and worked examples. Together they become the system prompt.
            </p>
          </li>
          <li className="step">
            <span className="step__n">2</span>
            <h3>The model writes openui-lang</h3>
            <p>A short program: query the tools, then lay out components with the results.</p>
            <pre className="code step__code">
              <code>{SNIPPET}</code>
            </pre>
          </li>
          <li className="step">
            <span className="step__n">3</span>
            <h3>OpenUI renders it as it streams</h3>
            <p>
              The Renderer turns each finished line into components and runs the tools in the
              browser, so the interface fills in while the model is still writing.
            </p>
          </li>
        </ol>
      </section>

      <footer className="site-footer">
        <span>
          Built with <a href="https://github.com/thesysdev/openui">OpenUI</a>. The dashboard kits
          come from OpenUI and are MIT licensed.
        </span>
        <a href={REPO_URL} target="_blank" rel="noreferrer">
          github.com/subham8391/openui-showcase
        </a>
      </footer>
    </SiteShell>
  );
}
