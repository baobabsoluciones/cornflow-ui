# Screenshots of the functional documentation

The images of `docs/funcionalidades/` (the functional documentation, in Spanish) are taken by this script, with
Playwright, from the real app. It needs no backend: a mock backend answers every request with
neutral demo data (a production planner with plants, products and weekly demand), so the images
can be published and every run draws the same screens.

```bash
npm run docs:screenshots                       # every image, into docs/funcionalidades/images/
npm run docs:screenshots -- history            # only the specs whose file name matches
DOCS_IMAGES_DIR=/tmp/shots npm run docs:screenshots   # somewhere else, to compare
```

It starts its own dev server on port 3100 (`vite.config.ts` here), so it does not clash with
`npm run dev`, and it does not read the project's `.env`: a backend or schema configured there is
never used.

## How it works

| File | What it does |
| --- | --- |
| `configFactory.mjs` | The Playwright config: the dev server, the `*.shots.ts` specs, a 1440×900 window in Spanish (Europe/Madrid) |
| `vite.config.ts` | The app as `npm run dev` serves it, with no `.env` and with the demo app config below |
| `mockBackend.mjs` | Answers Cornflow (`/cornflow/…`) and the app backend (`/external/…`) inside the browser |
| `demoData.mjs` | The demo data: schema, executions, instance, solution, checks, master tables, users and roles |
| `helpers.mjs` | `openDemo` (mock backend, settings, session, fixed clock), `shot`, `loadExecution`, `go`, `pinDrawer`… |
| `app/config.ts`, `app/rolesConfig.ts` | The core's `src/app` config with the settings each shot turns on (`app/docsOverrides.ts`) |
| `app/locales/` | The demo app's own texts (its config parameters) |
| `app/DemoDashboard.vue` | A made-to-measure dashboard, as an app would build one |
| `shots/*.shots.ts` | The screenshots, one spec per area of the docs |

A shot turns features on with `openDemo(page, testInfo, { overrides, mock })`:

- `overrides.parameters` merges into `core.parameters` (e.g. `{ enableDarkMode: true }`), and
  `overrides.roles` into the roles config.
- `mock` changes what the backend answers: `values` (the external configuration, e.g. several
  DAGs or the staging notice), `executions`, `withKpis`, `warnings`, `frontendConfig`, and
  `handlers` for endpoints of its own.

The clock is fixed (`DEMO_NOW`), so dates and durations read the same on every run.

## Packages built on the core

Enterprise takes its own screenshots with this same machinery: its config is built with
`createDocsScreenshotsConfig` and its specs pass `handlers` to `installMockBackend` for the
endpoints of its modules (`/external/plan-latest/`, `/external/etl/`…). The `.mjs` files are
plain JavaScript so they can be imported from node_modules
(`@cornflow-ui/core/e2e/docs-screenshots/…`), and `app/docsOverrides.ts` is served by Vite.

## Adding a screenshot

1. Add a test to the spec of its area, or a new `shots/<area>.shots.ts`.
2. Name the image `<page>-<state>`, after the page of `docs/funcionalidades/` that shows it.
3. A shot that asks the mock backend for something it does not answer lists the request in the
   output (`unhandled requests`): add it to `mockBackend.mjs` or to the shot's `handlers`.
