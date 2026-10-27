"use client";

import { ThemeProvider } from "@openuidev/react-ui";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

type ThemeChoice = "system" | "light" | "dark";

/** The viewer's theme choice, remembered in this browser, resolved against the OS setting. */
function useThemeMode() {
  const [choice, setChoice] = useState<ThemeChoice>("system");
  const [systemDark, setSystemDark] = useState(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem("kit-theme") as ThemeChoice | null;
      if (saved === "light" || saved === "dark" || saved === "system") setChoice(saved);
    } catch {
      // Storage can be unavailable; the system setting still applies.
    }
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemDark(query.matches);
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  const choose = (next: ThemeChoice) => {
    setChoice(next);
    try {
      localStorage.setItem("kit-theme", next);
    } catch {
      // Not remembered, but still applied for this visit.
    }
  };
  const mode: "light" | "dark" = choice === "system" ? (systemDark ? "dark" : "light") : choice;
  return { choice, choose, mode };
}

/** OpenUI's font tokens, pointed at the Inter that next/font loads (layout.tsx). */
const INTER = 'var(--font-inter), "Inter", sans-serif';
const FONTS = { fontBody: INTER, fontHeading: INTER, fontLabel: INTER, fontNumbers: INTER };

/**
 * Every page's chrome: the OpenUI theme, the kit theme tokens, and a top bar
 * with the showcase name (linking home), the current example, and the theme
 * toggle.
 */
export function SiteShell({ crumb, children }: { crumb?: string; children: ReactNode }) {
  const { choice, choose, mode } = useThemeMode();

  return (
    <ThemeProvider mode={mode} lightTheme={FONTS} darkTheme={FONTS}>
      <main className="workspace kit-theme" data-mode={mode}>
        <header className="workspace__bar">
          <Link href="/" className="workspace__brand">
            <span className="workspace__logo" aria-hidden>
              <svg viewBox="0 0 20 20">
                <rect x="2" y="2" width="7" height="9" rx="2" />
                <rect x="11" y="2" width="7" height="5" rx="2" />
                <rect x="2" y="13" width="7" height="5" rx="2" />
                <rect x="11" y="9" width="7" height="9" rx="2" />
              </svg>
            </span>
            <span>
              <strong>OpenUI showcase</strong>
              {crumb && <span className="workspace__crumb">{crumb}</span>}
            </span>
          </Link>
          <div className="segmented" role="radiogroup" aria-label="Theme">
            {(["light", "dark", "system"] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={choice === t}
                onClick={() => choose(t)}
              >
                {{ light: "Light", dark: "Dark", system: "System" }[t]}
              </button>
            ))}
          </div>
        </header>

        {children}
      </main>
    </ThemeProvider>
  );
}
