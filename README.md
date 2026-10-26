# OpenUI showcase

A website of examples built with [OpenUI](https://github.com/thesysdev/openui), a framework for generative UI. Each example has its own page on the site, and its code lives in this repository.

## Examples

| Example                                   | Page              | What it is                                                                                                                                                                                                                              |
| ----------------------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Dashboard kits](packages/dashboard-kits) | `/dashboard-kits` | Two kits for the OpenUI dashboard artifact, **e-commerce** and **product analytics**: domain components, read-only data tools, prompt rules, and worked examples a model composes into dashboards. Gallery, Generate, and Prompt views. |

## Run

Requirements: Node.js 24 (see `.nvmrc`; 22.13+ works) and pnpm 10 (`corepack enable` picks the pinned version).

```bash
pnpm install
cp apps/site/.env.example apps/site/.env.local   # add THESYS_API_KEY or OPENAI_API_KEY
pnpm dev                                          # http://127.0.0.1:3940
```

The galleries and Prompt views need no key; only Generate calls a model. `pnpm dev` builds the dashboard kits package and writes the kit specs before starting Next.js.

Other scripts, all from the root:

| Script              | What it does                                                                     |
| ------------------- | -------------------------------------------------------------------------------- |
| `pnpm build`        | Builds the library, then the site (`next build`)                                 |
| `pnpm build:kits`   | Builds `packages/dashboard-kits` only                                            |
| `pnpm test`         | Library tests (vitest)                                                           |
| `pnpm lint`         | ESLint on the library                                                            |
| `pnpm format:check` | Prettier on the whole repository (`pnpm format` writes)                          |
| `pnpm typecheck`    | `tsc` for the library (source and tests) and the site                            |
| `pnpm check`        | Renders every gallery dashboard in jsdom and checks every kit's tools and prompt |
| `pnpm ci`           | All of the above, in the order CI runs them                                      |

## Layout

```
apps/site/                 Next.js website: landing page (/) and one page per example
  src/app/                 routes; each example's API routes under src/app/api/<example>/
  src/components/          site shell (theme, top bar, light/dark toggle), example cards, example views
  src/kits/                glue between the site and the dashboard kits package
  scripts/                 kit contract check, render smoke test, model eval
packages/dashboard-kits/   @openuidev/dashboard-kits: the kits, their components, charts, tools, and prompts
docs/                      design notes (docs/dashboard-kits-design.md)
.github/workflows/ci.yml   install, build, lint, format, typecheck, test, smoke render, next build
```

`@openuidev/dashboard-kits` keeps its upstream name so the code stays in sync with OpenUI, but it is private here and never published. The site depends on it with `workspace:*` and consumes its built `dist/`.

## Add an example

1. Put reusable code in a new package under `packages/<name>` (optional; a small example can live entirely in the site).
2. Add a page at `apps/site/src/app/<name>/page.tsx` and wrap it in `SiteShell` from `src/components/site-shell.tsx` so it gets the theme and the top bar. Put its API routes under `apps/site/src/app/api/<name>/`.
3. Add a card entry to `EXAMPLES` in `apps/site/src/components/examples.ts`.
4. Add the example to the table above, and any new checks to `.github/workflows/ci.yml`.

## Credits

The dashboard kits come from [OpenUI](https://github.com/thesysdev/openui) by Thesys, MIT licensed. See [LICENSE](LICENSE).
