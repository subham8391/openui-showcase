# Dashboard kits

Two kits for the OpenUI dashboard artifact. A kit is everything a model needs to build dashboards for one domain on top of the dashboard artifact's base library:

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

The e-commerce kit has 10 dashboards and 31 data tools and the analytics kit 9 and 27. They share a chart family (`HeroMetric`, `TrendChart`, `ColumnChart`, `BarList`, `ShareBar`, `HeatGrid`, `GoalPace`, `Tracker`, `VarianceWalk`, plus `SegmentFlow`, `QuadrantChart`, and `BurnDown` behind kit components) and blocks: `KpiStrip`, `InsightList`, `ConversionFunnel`, `CohortGrid`, `DriverCards`, `RuleChips`, `DataStatus`, `BulletList`, and `ActionCards`.

The page at `/dashboard-kits` has three views for each kit:

- **Gallery** renders the kit's hand-written dashboards with live sample data. It needs no model or key.
- **Generate** asks a model for a dashboard and streams it in: the skeleton shows below the form, then a full-page viewer opens once the model starts writing.
- **Prompt** shows the system prompt the kit sends, with its components and tools.

[DESIGN.md](DESIGN.md) explains how kits extend the base library, the data contract, how kits are served, and the research behind them.

## Run

From the repository root:

```bash
pnpm install
cp .env.example .env.local   # optional: add a key for Generate
pnpm dev
```

`pnpm dev` writes the kit library specs and starts Next.js on http://127.0.0.1:3940. Edits to the kits hot-reload like any other code.

The gallery and the Prompt view work without credentials. For Generate, put one key in `.env.local`:

- `THESYS_API_KEY`: an inference key from the [Thesys Console](https://console.thesys.dev/keys), sent to OpenUI Gateway (`THESYS_BASE_URL` overrides the Gateway URL)
- `OPENAI_API_KEY`: any OpenAI-compatible key; set `OPENAI_BASE_URL` for another provider

`OPENUI_MODEL` optionally picks the model. The defaults are `openai/gpt-5.5` on Gateway and `gpt-5.5` on OpenAI.

`pnpm eval` asks the model for a dashboard for each case in `scripts/eval/cases.ts` and scores the result offline: it parses, calls only known tools, calls the tools the question needs, and types no figures of its own. It needs the same key; results go to `eval-results/`, which git ignores.

## How it works

1. `pnpm generate` writes each kit library's spec to `kits/generated/`.
2. `/dashboard-kits/api/generate` builds the kit's system prompt from that spec, the kit's tools, rules, and examples, and streams the model's openui-lang back. The key is read only by `shared/server/model.ts`, on the server.
3. The browser renders it with the same kit library. Each `Query()` runs through the Renderer's `toolProvider` to `/dashboard-kits/api/tools/<kit>/<tool>`, which validates the arguments and the result against the tool's schemas.
4. Filters are `$bindings`: changing one re-runs every Query that reads it.

The base components come from `dashboardLibrary` in `@openuidev/thesys`, the library behind the dashboard artifact. `createEcommerceLibrary(dashboardLibrary)` and `createAnalyticsLibrary(dashboardLibrary)` add a kit's components and widen `MediumCard` and `LargeCard` so the prompt lists the new components as valid children.

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

**Every chart is the kit's own, on d3.** `ColumnChart` (grouped, or stacked from zero with negative values below; the lifecycle chart, power user curve, and MRR movements use it), `HeatGrid` (the activity heatmap), the `ShareBar`, the period-over-period `TrendChart` (shaded gap, events, goal lines and benchmark bands, in-progress tail; lines far from zero fit their range, areas keep zero), `GoalPace`, `Tracker`, the KPI `Sparkline`, `ProfitWaterfall`, `SegmentFlow`, `QuadrantChart`, `SixTwelve`, and `BurnDown` all share one interaction model — a gliding hover follower and the shared tooltip, a legend that brings a series forward on hover and pins it on click, arrow keys — and react-ui's architecture: a hook-free empty-state dispatcher, an implementation with parts, d3 scales and d3-shape curves (react-ui's "natural" monotone curve), pure geometry with unit tests, react-ui's motion (a spring data morph so data changes glide, mounted hover followers so the crosshair, dots, and tooltip glide between points, and draw-on entrances), and a stylesheet per chart under the `kit` class prefix. Charts measure before their first paint and snap on resize, so only data changes animate.

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

- The app uses `@openuidev/react-ui` and `@openuidev/react-headless` 0.17.1. `@openuidev/thesys` 0.14.0 asks for ^0.14, so `pnpm.overrides` in the root `package.json` points it at 0.17.1; every gallery dashboard renders with no errors. See finding 9 in the design doc.
- `next.config.ts` turns off Turbopack minification: re-minifying the `@openuidev/thesys` bundle produces invalid JavaScript. See finding 6 in the design doc.
- The kit theme lets the base `FilterBar` wrap on phones. See finding 4 in the design doc.
- Every kit chart is drawn on d3 with the same interactions (hover follower and tooltip, legend focus and pin, arrow keys, spring data morph). See "Visual design" in the design doc.

## Add a kit

Copy `kits/analytics` to `kits/<id>`, write its tools, handlers, blocks, and `kit.ts`, and give it a `create<Id>Library` in its `library.ts`. Then register it in `kits/registry.ts` (`KITS`, `SAMPLE_HANDLERS`), `kits/libraries.ts`, and `kits/client.ts`, add a `kits/specs/<id>.ts` entry and its line in the `generate` script, and add its styles to `theme/index.scss`. `pnpm check` tells you when it is consistent. DESIGN.md has the details.
