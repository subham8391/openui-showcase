# OpenUI showcase

A website of examples built with [OpenUI](https://github.com/thesysdev/openui), a framework for generative UI. Each example has its own page on the site, and its code lives in this repository.

**Live:** https://openui-showcase.vercel.app

## Examples

| Example                                   | Page                                                                   | What it is                                                                                                                                                                                                                                                                        |
| ----------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Dashboard kits](examples/dashboard-kits) | [`/dashboard-kits`](https://openui-showcase.vercel.app/dashboard-kits) | Two dashboard kits, **e-commerce** and **product analytics**, running on [OpenUI Dashboards](https://www.openui.com/docs/dashboards). Each kit brings its own charts and data tools; ask a question in plain English and OpenUI builds a live dashboard from them, then saves it. |

### Try the dashboard kits

1. **Ask.** Type a question such as "Why did revenue drop in March?" and watch the dashboard build, in about 15 seconds.
2. **Dig in.** Click any point on a chart and pick "Why…?" or "Break down…": a new dashboard digs into that moment.
3. **Change it.** Type what to change, such as "add a breakdown by country", and only that part updates.
4. **Come back.** Your dashboards are saved, with live previews, and you can pin, rename, and delete them. There is no sign-up.

The kit's own integration is mostly one call:

```ts
openui.defineDashboard({
  library: kitSpec, // the kit's components
  tools: kitDataTools, // the kit's data, so numbers are live
  model: "anthropic/claude-sonnet-5.5",
  promptOptions: { preamble, additionalRules, examples },
});
```

See [examples/dashboard-kits](examples/dashboard-kits) for how it works.

## Run

Requirements: Node.js 24 (see `.nvmrc`; 22.13+ works) and pnpm 10 (`corepack enable` picks the pinned version).

```bash
pnpm install
cp .env.example .env.local   # add THESYS_API_KEY for Generate
pnpm dev                      # http://127.0.0.1:3940
```

The galleries and Prompt views need no key. Generate runs on OpenUI Dashboards and needs `THESYS_API_KEY`, a key from the [Thesys Console](https://console.thesys.dev/keys). `.env.example` lists the optional variables. Without a key, Generate shows a "paused" notice and charts don't offer dig-in questions; add the key and reload to turn it back on (no rebuild needed).

| Script              | What it does                                                                      |
| ------------------- | --------------------------------------------------------------------------------- |
| `pnpm dev`          | Writes the kit specs, then starts Next.js                                         |
| `pnpm build`        | Production build (`next build`)                                                   |
| `pnpm test`         | Unit tests (vitest)                                                               |
| `pnpm lint`         | ESLint on every TypeScript file                                                   |
| `pnpm format:check` | Prettier on the whole repository (`pnpm format` writes)                           |
| `pnpm typecheck`    | `tsc` for everything, tests included                                              |
| `pnpm check`        | Checks every kit's tools and prompt, and renders every gallery dashboard in jsdom |
| `pnpm eval`         | Scores model-generated dashboards (needs a key; `OPENAI_API_KEY` also works)      |
| `pnpm ci`           | All of the checks, in the order CI runs them                                      |

## Deploy

The site deploys to [Vercel](https://vercel.com) as is, and the key is never revealed:

- **Server only.** The key is read only in `shared/server/`: `openui.ts` (OpenUI Cloud), `model.ts` (the eval script), and `visitor.ts` (which derives the cookie secret from it, never the key itself). Each file is marked `server-only`, so the build fails if browser code imports it.
- **Never sent to the browser.** There are no `NEXT_PUBLIC_` variables, and the key isn't written into the build output. The browser gets a short-lived frontend token for the visitor's own dashboards instead.
- **No leaks through errors.** On a deployment, service error messages go to the server log only. Visitors get a plain message.

Steps:

1. On Vercel, import the repository. The defaults detect Next.js and pnpm; leave **Root Directory** as the repository root.
2. Add `THESYS_API_KEY` and mark it **Sensitive**: it's encrypted and can't be read back in the dashboard. Optional:
   - `THESYS_BASE_URL`, for a deployment other than OpenUI Cloud;
   - `OPENUI_DASHBOARD_MODEL`, as `provider/model` (default `anthropic/claude-sonnet-5.5`);
   - `VISITOR_SECRET`, to sign the visitor cookie with a secret of its own.
3. Deploy.

Generation is open to every visitor, so anyone using the site spends the key. Set a spending limit on the key. To pause generation, remove `THESYS_API_KEY` from the project: the site keeps serving the galleries and Prompt views, and Generate shows a paused notice.

## Layout

One Next.js app. Each example lives in its own folder under `examples/`; `app/` only maps URLs to it.

```
app/                        routes only: thin files that import from examples/
  layout.tsx  page.tsx      the landing page
  dashboard-kits/           page.tsx, and api/: cloud/<kit>/ (token, dashboards, edit,
                            interpreter), prompt, tools
examples/
  dashboard-kits/           everything about this example (see its README)
    views/  kits/  blocks/  charts/  ui/  engine/  theme/  scripts/
shared/                     used by every example
  ui/                       site shell, landing page, scaled previews
  server/                   openui.ts (OpenUI Cloud client), visitor.ts (anonymous
                            visitor cookie), model.ts (model client for the eval)
  examples.ts               the landing page's example cards
```

Imports use the `@/` alias for the repository root, for example `@/examples/dashboard-kits/kits/registry`.

Naming:

- **Routes** follow Next.js: lowercase folders under `app/`, `[param]` for dynamic segments, `page.tsx` and `route.ts`.
- **App code** (`views/`, `engine/`, `scripts/`, `shared/`) uses kebab-case files, such as `tool-provider.ts`.
- **React components** in `blocks/`, `charts/`, `ui/`, and `kits/*/blocks/` follow react-ui's convention: one PascalCase folder per component, `Component.tsx`, `Component.definition.tsx` for its openui-lang definition, camelCase helpers and stylesheets next to it.
- **Hooks** are named after the hook, such as `useKitRenderer.ts`.
- **Tests** sit next to the file they test, as `*.test.ts` or `*.test.tsx`.

## Add an example

1. Put its code in `examples/<name>/`.
2. Add `app/<name>/page.tsx` that renders it, wrapped in `SiteShell` from `shared/ui/site-shell.tsx`, and its API routes under `app/<name>/api/`. Reach OpenUI Cloud through `openuiClient()` in `shared/server/openui.ts`, with an app id of its own, and identify visitors with `visitorOf()` from `shared/server/visitor.ts`.
3. Add a card to `EXAMPLES` in `shared/examples.ts`, and the example to the table above.

## Credits

The dashboard kits come from [OpenUI](https://github.com/thesysdev/openui) by Thesys, MIT licensed. See [LICENSE](LICENSE).
