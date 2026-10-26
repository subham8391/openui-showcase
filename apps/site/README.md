# Site: dashboard kits

The showcase website. `/` lists the examples; `/dashboard-kits` is the first one: two kits for the OpenUI dashboard artifact. A kit is everything a model needs to build dashboards for one domain: the dashboard artifact's base components plus the kit's own components, read-only data tools, prompt rules, and worked examples. All three are modeled on the dashboards teams already use, with the same metric names and definitions.

- **E-commerce**, for Sundial Goods, a direct-to-consumer brand. It is modeled on Shopify, Triple Whale, and GA4, and covers:
  - sales, the total sales breakdown, and contribution profit as the main number (CM1–CM3 and break-even ROAS);
  - why a number moved: a variance walk and ranked drivers, each with a confidence;
  - marketing efficiency by channel, with attribution models side by side and platform-reported against store-recorded orders;
  - promotions (lift, pull-forward, net profit), targets and pacing, and a live view;
  - first-order LTV cohorts, RFM segments and how customers move between them;
  - product performance, inventory and restock dates, returns and exchanges, ad creatives, and the Black Friday plan;
  - recommended actions to approve or dismiss.
- **Product analytics**, for Relay, a team workspace app. It is modeled on PostHog, Amplitude, and Mixpanel, and covers:
  - active users and lifecycle states, with the active rule visible and comparison with the prior period, last year, or plan;
  - why a number moved, with data-status checks (restatements, tracking breaks);
  - the activation funnel and the activation moment, and retention as exact weeks, that week or later, or brackets, for users or workspaces, with where each curve flattens;
  - the feature value and engagement matrices, and activity by hour;
  - A/B test scorecards (intervals, split check, guardrails, a recommendation);
  - paying-workspace health, MRR movements, and net revenue retention by start month against its benchmark;
  - free to paid: the product-qualified funnel, Free plan limits, Business trials, and AI credit commits with their burn-down;
  - a 6-12 weekly business review, recommended actions to approve, and an alert back-test with N-of-M confirmation and quiet weekends.

The e-commerce kit has 10 dashboards and 31 data tools and the analytics kit 9 and 27. They share a chart family (`HeroMetric`, `TrendChart`, `ColumnChart`, `BarList`, `ShareBar`, `HeatGrid`, `GoalPace`, `Tracker`, `VarianceWalk`, plus `SegmentFlow`, `QuadrantChart`, and `BurnDown` behind kit components) and blocks: `KpiStrip`, `InsightList`, `ConversionFunnel`, `CohortGrid`, `DriverCards`, `RuleChips`, `DataStatus`, `BulletList`, and `ActionCards`.

The kits themselves live in the [`@openuidev/dashboard-kits`](../../packages/dashboard-kits) package. This app is the playground: it depends on the package through the pnpm workspace, renders its galleries, and serves its prompts and tools.

The app has three views for each kit:

- **Gallery** renders the kit's hand-written dashboards with live sample data. It needs no model or key.
- **Generate** asks a model for a dashboard and streams it in.
- **Prompt** shows the system prompt the kit sends, with its components and tools.

[docs/dashboard-kits-design.md](../../docs/dashboard-kits-design.md) explains how kits extend the base library, the data contract, how kits are served, and the open questions.

## Run

From the repository root:

```bash
pnpm install
cp apps/site/.env.example apps/site/.env.local   # optional: add a key for Generate
pnpm dev
```

`pnpm dev` builds `packages/dashboard-kits`, writes the kit library specs, and starts Next.js on http://127.0.0.1:3940. After changing the package, run `pnpm build:kits` (or `pnpm --filter @openuidev/dashboard-kits watch`) and the page picks up the new build.

The gallery and the Prompt view work without credentials. For Generate, put one key in `apps/site/.env.local`, then restart:

- `THESYS_API_KEY`: an inference key from the [Thesys Console](https://console.thesys.dev/keys), sent to OpenUI Gateway (`THESYS_BASE_URL` overrides the Gateway URL; `OPENAI_BASE_URL` is never used with this key)
- `OPENAI_API_KEY`: any OpenAI-compatible key; set `OPENAI_BASE_URL` for another provider

`OPENUI_MODEL` optionally picks the model. The defaults are `openai/gpt-5.5` on Gateway and `gpt-5.5` on OpenAI.

`pnpm --filter site run eval` asks the model for a dashboard for each case in `src/app/dashboard-kits/_scripts/eval/cases.ts` and scores the result offline: it parses, calls only known tools, calls the tools the question needs, and types no figures of its own. It needs the same key; results go to `eval-results/`, which git ignores.

## How it works

1. `pnpm --filter site run generate` writes each kit library's spec to `src/app/dashboard-kits/_kits/generated/`.
2. `/dashboard-kits/api/generate` builds the kit's system prompt from that spec, the kit's tools, rules, and examples, and streams the model's openui-lang back.
3. The browser renders it with the same kit library. Each `Query()` runs through the Renderer's `toolProvider` to `/dashboard-kits/api/tools/<kit>/<tool>`, which validates the arguments and the result against the tool's schemas.
4. Filters are `$bindings`: changing one re-runs every Query that reads it.

The base components come from `dashboardLibrary` in `@openuidev/thesys`, the library behind the dashboard artifact. `createEcommerceLibrary(dashboardLibrary)` and `createAnalyticsLibrary(dashboardLibrary)` add a kit's components and widen `MediumCard` and `LargeCard` so the prompt lists the new components as valid children.

## Files

The kits, their components, charts, prompts, tools, sample data, and styles are in `packages/dashboard-kits` (its README has the layout). This app holds only the glue:

| File                                        | Purpose                                                                                                                                     |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/layout.tsx, page.tsx`              | The root layout and the landing page                                                                                                        |
| `src/app/_site/`                            | Site-wide: shell, landing, scaled previews, `model.ts` (the only file that reads the key, `server-only`), `examples.ts` (cards), `site.css` |
| `src/app/dashboard-kits/page.tsx`           | The dashboard kits page                                                                                                                     |
| `src/app/dashboard-kits/_views/`            | Kit switch and tabs (`workspace.tsx`), the gallery, Generate (composer, run card, full-page viewer), Prompt, run details                    |
| `src/app/dashboard-kits/_kits/`             | Glue to the package: libraries, spec entries, client and server helpers, and `generated/` specs                                             |
| `src/app/dashboard-kits/api/`               | The generate, prompt, and tools routes                                                                                                      |
| `src/app/dashboard-kits/_scripts/`          | Contract check, render smoke test, and the model eval                                                                                       |
| `src/app/dashboard-kits/dashboard-kits.css` | The kits page's styles                                                                                                                      |

Folders that start with `_` are private to Next.js: they never become routes.

## Verify

```bash
pnpm --filter site run check
pnpm --filter site run build
```

`check` builds the package, writes the specs, then runs the kit contract check and the render smoke test. The check parses every gallery dashboard against its kit's library, rejects Queries to unknown tools, calls every tool with every value of every enum argument and validates each result, and builds every prompt within its size budget (64,000 characters for each kit). The smoke test renders every gallery dashboard in jsdom with its kit's library, its Queries answered by the sample-data tools in-process, and fails on a component or Renderer error, a failed tool call, a React error log, a skeleton still showing once the Queries settle, or NaN in the markup. CI runs both.

## Notes

- The app uses `@openuidev/react-ui` and `@openuidev/react-headless` 0.17.1. `@openuidev/thesys` 0.14.0 asks for ^0.14, so `pnpm.overrides` in the root `package.json` points it at 0.17.1; every gallery dashboard renders with no errors. See finding 9 in the design doc.
- `next.config.ts` turns off Turbopack minification: re-minifying the `@openuidev/thesys` bundle produces invalid JavaScript. See finding 6 in the design doc.
- The package's theme lets the base `FilterBar` wrap on phones. See finding 4 in the design doc.
- Every kit chart is drawn on d3 with the same interactions (hover follower and tooltip, legend focus and pin, arrow keys, spring data morph). See "Visual design" in the design doc.

## Add a kit

Add the kit to `packages/dashboard-kits` (copy `src/analytics`, write the tools, handlers, components, and `kit.ts`, and add an entry point), then create its library in `src/app/dashboard-kits/_kits/libraries.ts` here, register it in `client.ts` and `server.ts`, and add it to the `generate` script. `pnpm --filter site run check` tells you when it is consistent. The design doc has the details.
