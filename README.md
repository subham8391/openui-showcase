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

## Deploy

The site deploys to [Vercel](https://vercel.com) as is, and the model key is never revealed:

- **Server only.** Only `apps/site/src/lib/model.ts` reads the key. It is marked `server-only`, so the build fails if browser code ever imports it.
- **Never sent to the browser.** There are no `NEXT_PUBLIC_` variables, the key is read at request time, and it isn't written into the build output.
- **No leaks through errors.** On a deployment, the model service's error messages go to the server log only, since they can quote part of a key. Visitors get a plain message.

Steps:

1. On Vercel, import the repository and set **Root Directory** to `apps/site`. The defaults detect Next.js and pnpm, and the build compiles the kits first.
2. Add `THESYS_API_KEY` and mark it **Sensitive**: it's encrypted and can't be read back in the dashboard. Add `THESYS_BASE_URL` only for a non-default Gateway.
3. Deploy.

Generation is open to every visitor, so anyone using the site spends the key. Set a spending limit on the key with its provider.

## Layout

```
apps/site/                          Next.js website: landing page (/) and one page per example
  src/app/                          routes only: pages, and each example's API routes under api/<example>/
  src/components/                   site-wide UI: shell (theme, top bar), landing page, scaled previews
  src/lib/                          shared by every example: model.ts (the key, server-only), examples.ts (cards)
  src/examples/dashboard-kits/      the dashboard kits page: workspace, gallery, generate and prompt views,
                                    the run card and viewer, kits/ (glue to the package), its styles
  scripts/dashboard-kits/           kit contract check, render smoke test, model eval
packages/dashboard-kits/src/        @openuidev/dashboard-kits
  core/                             kit contract, prompt assembly, schemas, formats, stats
  components/                       shared React components, one folder each; charts/ for the d3 charts
  library/                          openui-lang definitions of the shared components
  hooks/  test/                     shared hooks, test helpers
  kits/ecommerce/  kits/analytics/  each kit: kit.ts, library.ts, tools.ts, metrics, data/ (sample data
                                    and tool handlers by topic), components/ (one file each), its styles
  styles/                           theme tokens and base
docs/                               design notes (docs/dashboard-kits-design.md)
.github/workflows/ci.yml            install, build, lint, format, typecheck, test, smoke render, next build
```

`@openuidev/dashboard-kits` keeps its upstream name so the code stays in sync with OpenUI, but it is private here and never published. The site depends on it with `workspace:*` and consumes its built `dist/`.

## Add an example

1. Put reusable code in a new package under `packages/<name>` (optional; a small example can live entirely in the site).
2. Put the example's UI in `apps/site/src/examples/<name>/`, wrapped in `SiteShell` from `src/components/site-shell.tsx` so it gets the theme and the top bar. Add a page at `apps/site/src/app/<name>/page.tsx` that renders it, and its API routes under `apps/site/src/app/api/<name>/`. A model call goes through `src/lib/model.ts`.
3. Add a card entry to `EXAMPLES` in `apps/site/src/lib/examples.ts`.
4. Add the example to the table above, and any new checks to `.github/workflows/ci.yml`.

## Credits

The dashboard kits come from [OpenUI](https://github.com/thesysdev/openui) by Thesys, MIT licensed. See [LICENSE](LICENSE).
