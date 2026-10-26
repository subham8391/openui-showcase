import type { NextConfig } from "next";
import path from "node:path";

// The repository root: pnpm links the workspace package and the dependency
// store from there, so Turbopack and output tracing must see the whole repo.
const root = path.resolve(process.cwd(), "../..");

const config: NextConfig = {
  turbopack: { root },
  outputFileTracingRoot: root,
  experimental: {
    // Re-minifying the already minified @openuidev/thesys 0.14.0 bundle makes
    // SWC emit a duplicate `let` declaration, which breaks the page in both the
    // server and browser chunks. Remove once the package or SWC is fixed.
    turbopackMinify: false,
  },
};

export default config;
