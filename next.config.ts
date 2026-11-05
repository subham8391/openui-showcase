import type { NextConfig } from "next";

// This folder is the project root, even when a lockfile sits in a parent folder.
const root = process.cwd();

const config: NextConfig = {
  turbopack: { root },
  outputFileTracingRoot: root,
};

export default config;
