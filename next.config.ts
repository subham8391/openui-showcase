import type { NextConfig } from "next";

// This folder is the project root, even when a lockfile sits in a parent folder.
const root = process.cwd();

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
