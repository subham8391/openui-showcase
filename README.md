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

- **Server only.** Only `apps/site/src/app/_site/model.ts` reads the key. It is marked `server-only`, so the build fails if browser code ever imports it.
- **Never sent to the browser.** There are no `NEXT_PUBLIC_` variables, the key is read at request time, and it isn't written into the build output.
- **No leaks through errors.** On a deployment, the model service's error messages go to the server log only, since they can quote part of a key. Visitors get a plain message.

Steps:

1. On Vercel, import the repository and set **Root Directory** to `apps/site`. The defaults detect Next.js and pnpm, and the build compiles the kits first.
2. Add `THESYS_API_KEY` and mark it **Sensitive**: it's encrypted and can't be read back in the dashboard. Add `THESYS_BASE_URL` only for a non-default Gateway.
3. Deploy.

Generation is open to every visitor, so anyone using the site spends the key. Set a spending limit on the key with its provider.

## Layout

```
apps/site/src/app/
  layout.tsx  page.tsx   the landing page
  _site/                 site-wide: shell (theme, top bar), landing, scaled previews,
                         model.ts (the key, server-only), examples.ts (cards), site.css
  dashboard-kits/        the whole dashboard kits example
    page.tsx
    _views/              workspace, gallery, generate (run card and viewer), prompt
    _kits/               glue to the package, and the generated/ specs
    _scripts/            kit contract check, render smoke test, model eval
    api/                 generate, prompt, tools/[kit]/[tool]
    dashboard-kits.css

packages/dashboard-kits/src/
  index.ts ecommerce.ts analytics.ts server.ts   the public entry points
  core/                  kit contract, prompt assembly, schemas, formats, stats, tool provider,
                         metric definitions, and the why math (explain.ts)
    library/             createKitLibrary, row balancing, and the list of shared definitions
    hooks/  test/        shared hooks (container size, chart hover, series focus, palette); test helpers
  blocks/                one folder per shared block: its React component, its openui-lang
                         definition (<Block>.definition.tsx), styles, and tests
    KpiStrip/ HeroMetric/ InsightList/ ConversionFunnel/ CohortGrid/ BarList/ ShareBar/ DataStatus/ …
    KitLayer/            the page-level layer popups draw on, so cards can't clip them
  charts/                one folder per d3 chart, the same pattern: TrendChart/ ColumnChart/ HeatGrid/
                         GoalPace/ Tracker/ Sparkline/ ProfitWaterfall/ QuadrantChart/ SegmentFlow/ …
    shared/ utils/       tooltip, legend, crosshair, series geometry, spring (ported from react-ui); scales
  ecommerce/             the e-commerce kit: kit.ts (prompt and gallery), library.ts, tools.ts, metrics.ts,
                         data/ (the sample store by topic; handlers.ts for the tools), blocks/ (one file each)
  analytics/             the product analytics kit, the same shape, plus its tested models
                         (population, moments, workspaces, experiments, revenue, alerts)
  theme/                 theme tokens and base styles (index.scss compiles to dist/styles.css)

docs/                    design notes (docs/dashboard-kits-design.md)
.github/workflows/ci.yml install, build, lint, format, typecheck, test, smoke render, next build
```

`@openuidev/dashboard-kits` keeps its upstream name so the code stays in sync with OpenUI, but it is private here and never published. The site depends on it with `workspace:*` and consumes its built `dist/`.

## Add an example

1. Put reusable code in a new package under `packages/<name>` (optional; a small example can live entirely in the site).
2. Create `apps/site/src/app/<name>/` with its `page.tsx`, its UI in `_views/`, and its API routes in `api/`. Wrap the page in `SiteShell` from `src/app/_site/site-shell.tsx` so it gets the theme and the top bar; a model call goes through `src/app/_site/model.ts`.
3. Add a card entry to `EXAMPLES` in `apps/site/src/app/_site/examples.ts`.
4. Add the example to the table above, and any new checks to `.github/workflows/ci.yml`.

## Credits

The dashboard kits come from [OpenUI](https://github.com/thesysdev/openui) by Thesys, MIT licensed. See [LICENSE](LICENSE).
