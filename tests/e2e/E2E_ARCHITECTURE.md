# Cornflow E2E architecture — core, enterprise and client apps

> How E2E tests are split, inherited, configured and run across the three levels of the product.
> This document lives in **core** because the machinery (the config factory) lives here and
> travels inside the package to every consumer.

---

## 1. The problem it solves

The product is consumed at three levels, and each one adds code:

```
core  ──►  enterprise  ──►  client app
 base       premium         its own views
 flows      modules         and logic
```

A client app needs to test **all three at once**. The easy way out — copying core's tests into
enterprise, and enterprise's into every app — produces N copies that drift apart: you fix a
selector in core and nobody else finds out.

The rule behind this setup is: **each test is written once, in the layer that owns it, and is
inherited downwards.**

---

## 2. The three layers

| Layer | What it covers | Where the specs live | Playwright project |
|---|---|---|---|
| **Core** | Login/logout, input data, solution data, validations, version history, loaded executions, help, drawer, user settings, layout | `@cornflow-ui/core` → `tests/e2e/specs/` | `chromium`, `chromium-auth-tests` |
| **Enterprise** | Premium modules, one folder each | enterprise package → `tests/e2e/premium/<module>/` | `chromium-enterprise` |
| **App** | Whatever exists only in that app: its own views, dashboards, schema, parameters | the app repo → `tests/e2e/app/` | `chromium-app` |

A single command (`npm run test:e2e`) runs whichever layers apply, in the same authenticated
session.

### Which layer does a new test belong to

```
Does the behaviour exist in any cornflow app?          → core
Only when a premium module is enabled?                 → enterprise
Does it depend on THIS app's view, schema or rules?    → app
```

When in doubt: a test that would be useful to another app does **not** belong in that app's repo.
Push it up to core or enterprise and everyone inherits it.

---

## 3. How it works

### 3.1 The config factory

Every repo has a minimal `playwright.config.mjs` that calls a factory function. Core's
([`configFactory.mjs`](./configFactory.mjs)) is the one that builds the real configuration:
projects, reporters, dev server, timeouts and authentication state.

Enterprise reimplements nothing: its `tests/e2e/configFactory.mjs` **delegates to core's** and
appends its premium layer. An app imports the factory from the topmost package it consumes and
gets the whole chain.

### 3.2 The mirrors (and why they exist)

Playwright **cannot load `.ts` files that live under `node_modules`** (it fails with *"Stripping
types is currently unsupported for files under node_modules"* and finds 0 tests). That constraint
shapes the whole design.

The way around it: when the factory detects that a suite comes from an installed package, it
**copies** it into a local folder of the project under test, outside `node_modules`, and points
Playwright there:

```
my-app/
└── tests/e2e/
    ├── .cornflow-core/         ← copy of core's suite            (gitignored)
    ├── .cornflow-enterprise/   ← copy of the premium modules     (gitignored)
    ├── .auth/user.json         ← session saved by the setup      (gitignored)
    ├── .env.test               ← credentials and environment     (gitignored)
    └── app/                    ← the only versioned part in the app
```

The mirrors are **wiped and regenerated on every run**, so they never go stale and need no
maintenance. Never edit them: any change is lost on the next start.

### 3.3 The piece that makes it fit: sibling mirrors

Premium specs import core's harness through a relative path. For that path to work **both in the
enterprise repo and inside an app**, the mirrors are placed as **siblings** under `tests/e2e/`:

```
In the enterprise repo:               In a client app:
tests/e2e/premium/core-harness.ts     tests/e2e/.cornflow-enterprise/core-harness.ts
      └─► ../.cornflow-core/fixtures        └─► ../.cornflow-core/fixtures
          (core mirror)                          (core mirror)
```

Same relative path, different place. That is why the specs are copied verbatim, without rewriting
a single import.

### 3.4 One coupling point per repo

No spec ever names the mirror folder. Each repo has a file that re-exports the harness, and the
specs import from it:

| Repo | File | Specs write |
|---|---|---|
| enterprise | `tests/e2e/premium/core-harness.ts` | `import { test, expect, TIMEOUTS } from '../core-harness'` |
| app | `tests/e2e/app/harness.ts` | `import { test, expect, TIMEOUTS } from '../harness'` |

If a test needs a core helper that is not re-exported yet, add it **to the harness**, not to the
spec. And if it needs a helper core does not have, add it to core and bump the tag.

### 3.5 Authentication

The `setup` project performs a real UI login **once** and saves cookies + localStorage +
sessionStorage to `tests/e2e/.auth/user.json` in the project under test. Every other project
starts already authenticated (`storageState`), except `chromium-auth-tests`, which exercises the
login itself and runs without a session.

That file is resolved from the **project root**, not from the specs' location — resolved relative
to the spec, in an app it would land inside the mirror, which is wiped on every run. Override it
with `CORNFLOW_E2E_AUTH_FILE`.

Test authentication is always **cornflow user/password**, never SSO: SSO providers (redirects,
MFA, tokens refreshed live) cannot be automated reliably in CI.

### 3.6 What each side contributes

| The **package** provides | The **project under test** provides |
|---|---|
| Specs, helpers, fixtures, reporters, auth setup | Dev server, `.env.test`, `.env`, saved session, its own specs |

Core and enterprise specs are **schema-agnostic**: they assume no particular tables or executions,
they adapt to whatever is there (`if (count > 0) …`) and only assert i18n and structure owned by
their own layer.

---

## 4. Configuration

### 4.1 `playwright.config.mjs` — one file per repo

**Core** (`tests/e2e/playwright.config.ts`) uses its own factory: the suite runs in place.

**Enterprise** (repo root):

```js
import { createCornflowE2EConfig } from './tests/e2e/configFactory.mjs';

export default createCornflowE2EConfig();
```

**Client app** (repo root):

```js
import { createCornflowE2EConfig } from '@cornflow-ui/enterprise/tests/e2e/configFactory.mjs';

export default createCornflowE2EConfig({
  consumerSpecDir: 'tests/e2e/app',
  premiumModules: ['<module>'],
});
```

> An app consuming **core only** imports `@cornflow-ui/core/e2e/configFactory.mjs` and drops
> `premiumModules`.
>
> The difference in the import path is not an oversight: core declares `exports` in its
> `package.json` (hence the short `/e2e/…` alias) while enterprise does not, so there the real
> path `/tests/e2e/…` is used.

### 4.2 Factory options

| Option | What it does | Default |
|---|---|---|
| `consumerSpecDir` | Folder with the project's own specs → project `chromium-app` | none |
| `premiumModules` *(enterprise's factory only)* | Which premium modules apply to this app | all |
| `devCommand` | Command that starts the app under test | `npm run dev -- --port 3000` |
| `baseURL` | App URL | `PLAYWRIGHT_BASE_URL` or `http://localhost:3000` |
| `consumerDir` | Project root | `process.cwd()` |
| `layers` | Extra layers (advanced; enterprise already injects its own) | — |
| `overrides` | Any additional Playwright setting | — |

**`premiumModules` in detail** — not every app enables every premium module:

| Value | Effect |
|---|---|
| omitted | Runs **every** module enterprise ships |
| `['module-a', 'module-b']` | Runs **only** those |
| `[]` | The premium layer is **skipped entirely** |

It must mirror what the app enables in `src/app/config.ts`: if a module is disabled, its tests
cannot pass and should not run.

### 4.3 `.env.test`

Goes in `tests/e2e/.env.test` of the project under test (**gitignored**; there is an
`.env.test.example` to copy):

```env
PLAYWRIGHT_TEST_USER=user
PLAYWRIGHT_TEST_PASSWORD=password
PLAYWRIGHT_AUTH_TYPE=cornflow
PLAYWRIGHT_BASE_URL=http://localhost:3000

VITE_APP_BACKEND_URL=https://my-backend
VITE_APP_SCHEMA=my_schema
```

⚠️ Do **not** set `PLAYWRIGHT_TEST_TEMP_PASSWORD` against a shared account: it enables the
change-password tests, which mutate the account and lock out whoever else uses it.

### 4.4 `.gitignore`

```gitignore
tests/e2e/.auth/
tests/e2e/.env.test
tests/e2e/.cornflow-core/
tests/e2e/.cornflow-enterprise/
playwright-report/
test-results/
```

### 4.5 npm scripts

```json
"test:e2e":        "playwright test",
"test:e2e:app":    "playwright test --project=chromium-app",
"test:e2e:headed": "playwright test --headed",
"test:e2e:ui":     "playwright test --ui",
"test:e2e:debug":  "playwright test --debug",
"test:e2e:sync":   "playwright test --list"
```

### 4.6 Onboarding a new app from scratch

```bash
npm install -D @playwright/test
npx playwright install chromium
```

1. `playwright.config.mjs` at the root (§4.1).
2. `tests/e2e/app/harness.ts` re-exporting the harness (§3.4).
3. `cp tests/e2e/.env.test.example tests/e2e/.env.test` and fill it in.
4. Add the `.gitignore` entries and the scripts.
5. `npm run test:e2e:sync` → builds the mirrors and lists the tests. If they show up, you are set.

---

## 5. Running

```bash
npm run test:e2e                      # every applicable layer
npm run test:e2e -- --list            # what would run, without running it
npm run test:e2e:headed               # with a visible browser
npm run test:e2e:ui                   # Playwright UI mode (best for debugging)
npm run test:e2e:debug                # step by step with the inspector
```

**By layer:**

```bash
npx playwright test --project=chromium              # core only (without the login specs)
npx playwright test --project=chromium-auth-tests   # login/logout only
npx playwright test --project=chromium-enterprise   # premium modules only
npx playwright test --project=chromium-app          # this app's specs only
```

**By file or by name:**

```bash
npx playwright test tests/e2e/app/dashboard          # a folder
npx playwright test -g "download Excel"              # by test name
npx playwright test --grep-invert "current plan"     # excluding
```

**Excluding what mutates shared state** (recommended against a live environment):

```bash
npx playwright test --grep-invert "current plan|change password|restore original password|delete execution"
```

### Output

Every run produces `playwright-report/corporate-report.html` (branded report) alongside
Playwright's standard HTML report. Core also emails it (`npm run test:e2e:send-report`, SMTP via
Nodemailer); other repos need `nodemailer` and `tsx` added first.

---

## 6. Updating the inherited tests

**It is a version bump, nothing else.** Nothing is copied or re-adapted:

```jsonc
// the app's package.json
"@cornflow-ui/core":       "…#vX.Y.Z",
"@cornflow-ui/enterprise": "…#vA.B.C"
```

```bash
npm install
npm run test:e2e:sync   # rebuilds the mirrors with the new version
```

If a core test starts failing in an app there are two possible readings, and it is worth telling
them apart before touching anything: either the app broke generic behaviour (fix it in the app),
or the core spec assumed something that is not universal (fix it **in core**, and everyone
benefits).

---

## 7. House rules

- **Never edit** `.cornflow-core/` or `.cornflow-enterprise/`: they are wiped on every run.
- **Do not copy** specs across layers. If you need it in two places, it belongs one layer down.
- **Do not import** from `@cornflow-ui/*` inside a spec: `.ts` files under `node_modules` cannot be
  loaded. Always go through the repo's harness.
- **Mind the tests that mutate state** (setting the current plan, changing the password, deleting
  an execution): they do not undo themselves. Exclude them against shared environments.
- Core and enterprise specs **cannot assume a schema**. A test that needs a specific table belongs
  in the app layer.

---

## 8. Common problems

| Symptom | Cause | Fix |
|---|---|---|
| `Stripping types is currently unsupported for files under node_modules` / **0 tests** | Something is pointing at the `.ts` files inside `node_modules` | Use the factory; that is exactly what it avoids |
| The editor flags the harness imports as unresolved | The mirror does not exist yet | Run `npm run test:e2e:sync` once |
| Tests run against the wrong backend | Vite does **not** read `.env.test`: the app takes its config from the root `.env` | Align both files |
| Config changes have no effect | `reuseExistingServer` picked up a stale dev server on the port | Kill the previous dev server |
| The authenticated project fails to start | No `.auth/user.json`: the `setup` never passed | Look at the `setup` project failure (credentials/backend) |
| A whole premium module fails | The app does not enable it in `src/app/config.ts` | Remove it from `premiumModules` |
| Flaky Excel downloads | Slow cold start, plus rows in *Error* state that produce no `.xlsx` | Pick a successful execution row; retries cover the rest |
