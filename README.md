# OpenUI showcase

A website of examples built with [OpenUI](https://github.com/thesysdev/openui), a framework for generative UI. Each example has its own page on the site, and its code lives in this repository.

## Examples

| Example                                   | Page              | What it is                                                                                                                                                                                                                              |
| ----------------------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Dashboard kits](examples/dashboard-kits) | `/dashboard-kits` | Two kits for the OpenUI dashboard artifact, **e-commerce** and **product analytics**: domain components, read-only data tools, prompt rules, and worked examples a model composes into dashboards. Gallery, Generate, and Prompt views. |

## Run

Requirements: Node.js 24 (see `.nvmrc`; 22.13+ works) and pnpm 10 (`corepack enable` picks the pinned version).

```bash
pnpm install
cp .env.example .env.local   # add THESYS_API_KEY or OPENAI_API_KEY
pnpm dev                      # http://127.0.0.1:3940
```

The galleries and Prompt views need no key; only Generate calls a model.

| Script              | What it does                                                                      |
| ------------------- | --------------------------------------------------------------------------------- |
| `pnpm dev`          | Writes the kit specs, then starts Next.js                                         |
| `pnpm build`        | Production build (`next build`)                                                   |
| `pnpm test`         | Unit tests (vitest)                                                               |
| `pnpm lint`         | ESLint on every TypeScript file                                                   |
| `pnpm format:check` | Prettier on the whole repository (`pnpm format` writes)                           |
| `pnpm typecheck`    | `tsc` for everything, tests included                                              |
| `pnpm check`        | Checks every kit's tools and prompt, and renders every gallery dashboard in jsdom |
| `pnpm eval`         | Scores model-generated dashboards (needs a key)                                   |
| `pnpm ci`           | All of the checks, in the order CI runs them                                      |

## Deploy

The site deploys to [Vercel](https://vercel.com) as is, and the model key is never revealed:

- **Server only.** Only `shared/server/model.ts` reads the key. It is marked `server-only`, so the build fails if browser code ever imports it.
- **Never sent to the browser.** There are no `NEXT_PUBLIC_` variables, the key is read at request time, and it isn't written into the build output.
- **No leaks through errors.** On a deployment, the model service's error messages go to the server log only, since they can quote part of a key. Visitors get a plain message.

Steps:

1. On Vercel, import the repository. The defaults detect Next.js and pnpm; leave **Root Directory** as the repository root.
2. Add `THESYS_API_KEY` and mark it **Sensitive**: it's encrypted and can't be read back in the dashboard. Add `THESYS_BASE_URL` only for a non-default Gateway.
3. Deploy.

Generation is open to every visitor, so anyone using the site spends the key. Set a spending limit on the key with its provider.

## Layout

One Next.js app. Each example lives in its own folder under `examples/`; `app/` only maps URLs to it.

```
app/                        routes only: thin files that import from examples/
  layout.tsx  page.tsx      the landing page
  dashboard-kits/           page.tsx, and api/ (generate, prompt, tools)
examples/
  dashboard-kits/           everything about this example (see its README)
    views/  kits/  blocks/  charts/  engine/  theme/  scripts/
shared/                     used by every example
  ui/                       site shell, landing page, scaled previews
  server/model.ts           the model client; the only file that reads the key
  examples.ts               the landing page's example cards
```

Imports use the `@/` alias for the repository root, for example `@/examples/dashboard-kits/kits/registry`.

## Add an example

1. Put its code in `examples/<name>/`.
2. Add `app/<name>/page.tsx` that renders it, wrapped in `SiteShell` from `shared/ui/site-shell.tsx`, and its API routes under `app/<name>/api/`. A model call goes through `shared/server/model.ts`.
3. Add a card to `EXAMPLES` in `shared/examples.ts`, and the example to the table above.

## Credits

The dashboard kits come from [OpenUI](https://github.com/thesysdev/openui) by Thesys, MIT licensed. See [LICENSE](LICENSE).
