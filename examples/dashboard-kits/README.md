# Dashboard kits

Two dashboard kits running on [OpenUI Dashboards](https://www.openui.com/docs/dashboards). Each kit brings its own charts and data tools; ask a question in plain English and OpenUI builds a live dashboard from them, then saves it.

**Try it:** https://openui-showcase.vercel.app/dashboard-kits (no sign-up)

- **Ask** "Why did revenue drop in March?" and watch the dashboard build, in about 15 seconds.
- **Dig in:** click any point on a chart, in the gallery or a generated dashboard, and pick "Why…?" or "Break down…". A new dashboard digs into that moment, and Back returns to where you were.
- **Change it:** type what to change ("add a breakdown by country") and only that part updates.
- **Come back:** "Your dashboards" keeps what you built, with live previews; pin, rename, or delete them.

## What a kit is

A kit is everything a model needs to build dashboards for one domain on top of OpenUI's base dashboard library:

- **components**, placed into the base cards;
- a **prompt**: preamble, definitions, rules, and worked gallery dashboards;
- a **data contract**: read-only tools with zod input and output schemas, called with `Query()`;
- **sample data**: tool handlers over one coherent demo business.

Both kits are modeled on the dashboards teams already use, with the same metric names and definitions.

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

The e-commerce kit has 10 dashboards and 31 data tools and the analytics kit 9 and 28. They share a chart family (`HeroMetric`, `TrendChart`, `ColumnChart`, `BarList`, `ShareBar`, `HeatGrid`, `GoalPace`, `Tracker`, `VarianceWalk`, plus `SegmentFlow`, `QuadrantChart`, and `BurnDown` behind kit components) and blocks: `KpiStrip`, `InsightList`, `ConversionFunnel`, `CohortGrid`, `DriverCards`, `RuleChips`, `DataStatus`, `BulletList`, and `ActionCards`.

The page at `/dashboard-kits` has three views for each kit:

- **Gallery** renders the kit's hand-written dashboards with live sample data. It needs no model or key, except to dig into a chart point.
- **Generate** asks OpenUI Dashboards for a dashboard and streams it in: a skeleton shows below the form, then a full-page viewer opens once the dashboard starts to appear. The viewer has a "Change it…" box, and every chart point in it can be dug into. "Your dashboards" sits below the form.
- **Prompt** shows the kit's prompt assembled from its pieces (library, tools, rules, examples), the same pieces OpenUI Cloud builds the model's prompt from.

[DESIGN.md](DESIGN.md) explains how kits extend the base library, the data contract, how kits are served, and the research behind them.

## Run

From the repository root:

```bash
pnpm install
cp .env.example .env.local   # optional: add a key for Generate
pnpm dev
```

`pnpm dev` writes the kit library specs and starts Next.js on http://127.0.0.1:3940. Edits to the kits hot-reload like any other code.

The gallery and the Prompt view work without credentials. Generate runs on [OpenUI Dashboards](https://www.openui.com/docs/dashboards) and needs a key in `.env.local`:

- `THESYS_API_KEY`: a key from the [Thesys Console](https://console.thesys.dev/keys). OpenUI Cloud is `https://api.thesys.dev`; set `THESYS_BASE_URL` to a gateway URL (such as `https://api.dev.thesys.dev/v1/embed`) to use that deployment instead.
- `OPENUI_DASHBOARD_MODEL` optionally picks the model that builds and edits dashboards, as `provider/model`. The default is `anthropic/claude-sonnet-5.5`.
- `VISITOR_SECRET` optionally signs the visitor cookie; without it, a secret is derived from the key.

`pnpm eval` asks the model for a dashboard for each case in `scripts/eval/cases.ts` and scores the result offline: it parses, calls only known tools, calls the tools the question needs, and types no figures of its own. It needs the same key; results go to `eval-results/`, which git ignores.

## How it works

1. `pnpm generate` writes each kit library's spec to `kits/generated/`.
2. **Generate** (`kits/cloud.ts`) is an OpenUI `defineDashboard` per kit: the kit's spec as the library, its tools as data tools (each with an example output from the sample data), and its preamble, rules, and the gallery dashboards closest to the request as prompt options. `/dashboard-kits/api/cloud/<kit>/dashboards` calls `create`, and OpenUI Cloud builds the dashboard, checks and repairs it against the library, and saves it. `…/edit` calls `edit`, which changes only what the request describes.
3. The browser streams and shows it with `LiveArtifactRenderer` and the same kit library. Its queries go to `…/interpreter`, which runs a kit tool on the sample data, or a script OpenUI generated in OpenUI's interpreter. "Your dashboards" lists, pins, renames, and deletes the visitor's saved dashboards with the `useArtifact*` hooks.
4. Each kit is its own OpenUI app (`appId`), so its tokens and dashboards stay apart. There is no sign-in: each browser is an anonymous visitor, an id in a signed, HTTP-only cookie (`shared/server/visitor.ts`), and `…/token` gives it a short-lived frontend token for its own dashboards only. The key stays on the server.
5. The **gallery** renders its hand-written dashboards with react-lang's `Renderer`. Each `Query()` runs through its `toolProvider` to `/dashboard-kits/api/tools/<kit>/<tool>`, which validates the arguments and the result against the tool's schemas. Filters are `$bindings`: changing one re-runs every Query that reads it.
6. **Dig in** (`ui/Drill/`): a click, tap, or Enter on a chart point, range, cell, or part opens a menu of questions about it, worded from the card, the metric, and the point ("Why was Total sales $48.2K on Sep 27?"), with the value before it for context. Picking one creates a dashboard for that question, and the viewer keeps a Back trail to the gallery or the dashboard it came from.

The base components come from `library` in `@openuidev/dashboard-library`. `createEcommerceLibrary(library)` and `createAnalyticsLibrary(library)` use `library.extend()` to add a kit's components to `MediumCard` and `LargeCard` (so the prompt lists them as valid children), and remove the base charts and KPI cards the kit replaces.

## Layout

```
examples/dashboard-kits/
  views/        the page: workspace (kit switch and tabs), gallery, generate (run card and
                full-page viewer), prompt, run details, and their styles
  kits/
    ecommerce/  the e-commerce kit: kit.ts (prompt and gallery), library.ts, tools.ts,
                metrics.ts, data/ (the sample store by topic; handlers.ts for the tools),
                blocks/ (one file per component)
    analytics/  the product analytics kit, the same shape, plus its tested models
                (population, moments, workspaces, experiments, revenue, alerts)
    registry.ts KITS, getKit, and the sample-data handlers (server-safe, no React)
    libraries.ts  client.ts  server.ts   each kit's library, the Renderer's tool provider,
                and the server's specs, prompts, and tool runs
    specs/      entries for `openui generate`; generated/ holds the output
  blocks/       one folder per shared block: its React component, its openui-lang
                definition (<Block>.definition.tsx), styles, and tests
  charts/       one folder per d3 chart, the same pattern
  engine/       kit contract, prompt assembly, schemas, formats, stats, tool provider,
                the why math, library assembly (library/), hooks, test helpers
  theme/        theme tokens and base styles (the kits' Sass entry is theme/index.scss)
  scripts/      kit contract check, render smoke test, model eval
```

The kits render in the OpenUI design system: inside react-ui's `ThemeProvider`, every kit colour, font, radius, and status colour reads its `--openui-*` token, so light and dark mode and any theme override apply to the kits as they do to the base dashboard. Chart series take the theme's chart palette, distributed the way react-ui's charts distribute it.

## Charts

**Every chart is the kit's own, on d3:**

- `TrendChart`: this period against the prior one, with the gap shaded, events, goal lines, benchmark bands, and an in-progress last point. Lines far from zero fit their range; areas keep zero.
- `ColumnChart`: grouped, or stacked from zero with negative values below (the lifecycle chart, power user curve, and MRR movements use it).
- `HeatGrid` (the activity heatmap), `ShareBar`, `GoalPace`, `Tracker`, the KPI `Sparkline`, `ProfitWaterfall`, `SegmentFlow`, `QuadrantChart`, `SixTwelve`, and `BurnDown`.

They all work the same way:

- **One interaction model:** a gliding hover follower and the shared tooltip, a legend that brings a series forward on hover and pins it on click, arrow keys, and a click on any point to dig in.
- **react-ui's architecture:** a hook-free empty-state dispatcher, an implementation split into parts, d3 scales and d3-shape curves (react-ui's "natural" monotone curve), and pure geometry with unit tests.
- **react-ui's motion:** a spring data morph so data changes glide, hover followers that stay mounted so the crosshair, dots, and tooltip glide between points, and draw-on entrances. Charts measure before their first paint and snap on resize, so only data changes animate.
- **One stylesheet per chart**, under the `kit` class prefix.

Where a react-ui chart was close but not a fit, the kit keeps its own:

| Kit chart          | Closest react-ui chart       | Why the kit keeps its own                                                                                                                                       |
| ------------------ | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Sparkline`        | `MiniAreaChart`              | `MiniAreaChart` keeps one point per 20px, so an 84px cell shows 5 of 30 days, and its range starts at zero, which flattens a KPI that moves between 40K and 45K |
| `ConversionFunnel` | `FunnelChart`                | The kit funnel shows what continues and drops off between steps, the median time between them, and the change against the prior period                          |
| `QuadrantChart`    | `ScatterChart`               | The quadrants need split lines, quadrant names, bubble sizes, and a label per point                                                                             |
| `GoalPace` gauge   | `RadialChart` (semicircular) | The gauge marks where the pace says the month should be                                                                                                         |
| `TrendChart`       | `LineChart`, `AreaChart`     | The trend needs the prior period, the shaded gap, events, goal lines, benchmark bands, and the in-progress last point                                           |

## Verify

```bash
pnpm test
pnpm check
pnpm build
```

`test` runs the unit tests (kits, blocks, charts, engine). `check` runs the kit contract check and the render smoke test. The check parses every gallery dashboard against its kit's library, rejects Queries to unknown tools, calls every tool with every value of every enum argument and validates each result, and builds every prompt within its size budget (64,000 characters for each kit). The smoke test renders every gallery dashboard in jsdom with its kit's library, its Queries answered by the sample-data tools in-process, and fails on a component or Renderer error, a failed tool call, a React error log, a skeleton still showing once the Queries settle, or NaN in the markup. CI runs all three.

## Notes

- The app uses OpenUI Lang 1.1 (`@openuidev/react-lang`, `@openuidev/lang-core`) with `@openuidev/react-ui` and `@openuidev/react-headless` 0.18, `@openuidev/dashboard-library`, and `@openuidev/server`.
- The kit theme lets the base `FilterBar` wrap on phones. See finding 4 in the design doc.
- Every kit chart is drawn on d3 with the same interactions (hover follower and tooltip, legend focus and pin, arrow keys, spring data morph). See "Visual design" in the design doc.

## Add a kit

Copy `kits/analytics` to `kits/<id>`, write its tools, handlers, blocks, and `kit.ts`, and give it a `create<Id>Library` in its `library.ts`. Then register it in `kits/registry.ts` (`KITS`, `SAMPLE_HANDLERS`), `kits/libraries.ts`, and `kits/client.ts`, add a `kits/specs/<id>.ts` entry and its line in the `generate` script, and add its styles to `theme/index.scss`. `pnpm check` tells you when it is consistent. DESIGN.md has the details.
