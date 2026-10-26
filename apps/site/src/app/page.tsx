import Link from "next/link";
import { EXAMPLES } from "../components/examples";
import { SiteShell } from "../components/site-shell";

export default function Page() {
  return (
    <SiteShell>
      <section className="workspace__intro">
        <h1>OpenUI showcase</h1>
        <p>Examples built with OpenUI, a framework for generative UI.</p>
      </section>

      <nav className="kit-picker example-grid" aria-label="Examples">
        {EXAMPLES.map((example) => (
          <Link key={example.href} href={example.href} className="kit-picker__option">
            <span className="kit-picker__icon" aria-hidden>
              <svg viewBox="0 0 24 24">
                <path d={example.icon} />
              </svg>
            </span>
            <span className="kit-picker__text">
              <span className="kit-picker__name">{example.name}</span>
              <span className="kit-picker__tagline">{example.summary}</span>
            </span>
            <span className="kit-picker__meta">{example.meta}</span>
          </Link>
        ))}
      </nav>
    </SiteShell>
  );
}
