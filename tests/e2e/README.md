# E2E tests with Playwright

This folder holds the end-to-end (E2E) test suite, built with
[Playwright](https://playwright.dev/).

The suite ships **inside the package**: consumer apps run these very same specs against their own
app instead of copying them. For how the layers fit together (core → enterprise → client apps),
see [`E2E_ARCHITECTURE.md`](./E2E_ARCHITECTURE.md).

## Setup

### 1. Environment variables

Copy `.env.test.example` to `.env.test` in `tests/e2e/` and fill it in:

```env
# Test credentials
PLAYWRIGHT_TEST_USER=your_user
PLAYWRIGHT_TEST_PASSWORD=your_password

# Authentication type (optional, defaults to 'cornflow')
# Possible values: 'cornflow', 'azure', 'cognito'
PLAYWRIGHT_AUTH_TYPE=cornflow

# Application base URL (optional, defaults to 'http://localhost:3000')
PLAYWRIGHT_BASE_URL=http://localhost:3000

# Backend configuration (VITE_APP_*)
# IMPORTANT: use VITE_APP_BACKEND_URL (not VITE_APP_API_URL)
VITE_APP_BACKEND_URL=https://your-backend
VITE_APP_SCHEMA=your_schema
VITE_APP_AUTH_TYPE=cornflow
# ... any other VITE_APP_* variable your application needs
```

**Note:** `.env.test` is gitignored and never reaches the repository. Two things to keep in mind:

- **Vite does not read `.env.test`.** The app under test takes its configuration from the root
  `.env`; keep both pointing at the same environment.
- Do **not** set `PLAYWRIGHT_TEST_TEMP_PASSWORD` against a shared account: it enables the
  change-password tests, which mutate the account.

### 2. Dependencies

```bash
npm install
npx playwright install chromium
```

### 3. Dev server

The tests start the dev server on port 3000 automatically. If one is already running there it is
reused (outside CI) — **kill any stale server first**, or the tests will silently run against
whatever configuration it was started with.

## Available scripts

| Script | What it does |
|---|---|
| `npm run test:e2e` | Runs the whole suite headless. Reports land in `playwright-report/`. |
| `npm run test:e2e:headed` | Same, with a visible browser — useful to watch what a test does. |
| `npm run test:e2e:ui` | Playwright UI mode: run individual tests, time-travel debugging. The best option while developing tests. |
| `npm run test:e2e:debug` | Pauses at the start of each test and opens the Playwright Inspector for step-by-step debugging. |
| `npm run test:e2e:send-report` | Emails the corporate report. Requires a previous run and the SMTP variables (see [Emailing the report](#emailing-the-report)). |
| `npm run test:e2e:full` | Runs the suite and emails the report — including when tests fail, so failures still get delivered. |

Useful filters:

```bash
npx playwright test --list                            # what would run, without running it
npx playwright test specs/version-history             # a single folder
npx playwright test -g "download Excel"               # by test name
npx playwright test --project=chromium-auth-tests     # only the login/logout specs
```

## Authentication: log in once, reuse everywhere

1. **`auth.setup.ts`** runs once before everything else. It performs a real UI login and saves the
   full browser state (cookies, localStorage and **sessionStorage**) to `.auth/user.json`.
2. **`fixtures.ts`** exports a custom `test` that injects the sessionStorage values (token, userId,
   isAuthenticated) into every browser context before the page loads — Playwright's built-in
   `storageState` does not cover sessionStorage, and that is where the cornflow token lives.
3. Authenticated specs import `test` and `expect` from `../../fixtures` (**not** from
   `@playwright/test`) and navigate straight away.
4. The auth specs (`specs/auth/`) run in their own project, without a pre-authenticated state.

> **Result:** the login runs **once** for the whole suite instead of ~50 times.

The saved state is resolved from the project root (see `helpers/authFile.ts`), so consumer apps
keep their own `.auth/` — override it with `CORNFLOW_E2E_AUTH_FILE` if needed.

### Writing a new authenticated test

```typescript
// Import from fixtures, NOT from @playwright/test
import { test, expect } from '../../fixtures';

test('my test', async ({ page }) => {
  // Navigate straight away — the page is already authenticated
  await page.goto('/');
  const app = page.locator('.v-application');
  await app.first().waitFor({ state: 'visible', timeout: 15000 });

  // ... rest of the test
});
```

Two rules that keep these specs reusable by every consumer:

- **Do not assume a schema.** No hardcoded table names, executions or row counts — adapt to
  whatever the backend serves (`if (await tableCard.count() > 0) …`).
- **Assert only what core owns**: its own i18n keys, structure and navigation.

## File layout

```
tests/e2e/
├── README.md                    # This file
├── E2E_ARCHITECTURE.md          # How core / enterprise / client apps share the suite
├── playwright.config.ts         # Thin wrapper over the shared factory
├── configFactory.mjs            # Builds the config; also used by consumer apps
├── auth.setup.ts                # Global auth setup (runs once)
├── fixtures.ts                  # Custom fixture with sessionStorage injection
├── .env.test.example            # Template (no secrets)
├── .env.test                    # Local, gitignored
├── .auth/                       # Saved auth state, gitignored
│   └── user.json                # Cookies + localStorage + sessionStorage
├── reporters/
│   ├── corporate-reporter.ts    # Branded HTML report
│   └── send-report.ts           # Emails that report over SMTP
├── helpers/
│   ├── auth/                    # cornflowAuth + authentication factory
│   ├── authFile.ts              # Where the saved auth state lives
│   ├── authInjectSkip.ts        # Opt out of session injection (password flows)
│   ├── constants.ts             # Timeouts, routes and shared selectors
│   ├── errorDetection.ts        # Console/network error detection
│   ├── executionHelpers.ts      # Load/prepare executions
│   ├── sessionStorageHelpers.ts
│   └── urlHelpers.ts            # Hash routing helpers
├── restore-password.spec.ts     # Restores the original password (runs on its own)
└── specs/
    ├── auth/login.spec.ts
    ├── drawer/pinDrawer.spec.ts
    ├── help/helpButton.spec.ts
    ├── input-data/inputData.spec.ts
    ├── layout/baobabLink.spec.ts
    ├── loaded-executions/loadedExecutionsTabs.spec.ts
    ├── solution-data/solutionData.spec.ts
    ├── user-settings/userSettingsNavigation.spec.ts
    ├── validations/validations.spec.ts
    └── version-history/versionHistoryNavigation.spec.ts
```

## Specs and coverage

| Folder | File | What it covers |
|---|---|---|
| `auth/` | `login.spec.ts` | Login (valid, invalid, empty), redirect to a protected route, logout (programmatic and via the UI button), redirect to sign-in without a session, session persistence across reloads. |
| `drawer/` | `pinDrawer.spec.ts` | Pin drawer button: the side menu stays open, and collapses again on a second click. |
| `help/` | `helpButton.spec.ts` | Help menu, help centre modal, user manual download, licences modal. |
| `input-data/` | `inputData.spec.ts` | Instance data tables, tab navigation, Excel download, navigation to edit instance. |
| `layout/` | `baobabLink.spec.ts` | "baobab soluciones" link in the app bar: correct `href`, opens in a new tab. |
| `loaded-executions/` | `loadedExecutionsTabs.spec.ts` | Loaded-execution tab bar: create, select and close tabs. |
| `solution-data/` | `solutionData.spec.ts` | Solution data for the selected execution, endpoint payload, tabs, Excel download. |
| `user-settings/` | `userSettingsNavigation.spec.ts` | Settings navigation, tabs, theme and language switching, password change. |
| `validations/` | `validations.spec.ts` | Validation tables for the instance, endpoint payload, tabs, Excel download. |
| `version-history/` | `versionHistoryNavigation.spec.ts` | Execution list, backend payload structure, date filters (today / yesterday / 7d / 30d), custom-range datepickers, Excel download, loading an execution, confirmation modals. |
| *(root)* | `restore-password.spec.ts` | Restores the original password after the password-change flow. |

Some tests **mutate shared state** (changing the password, deleting an execution). Against a live
environment, exclude them:

```bash
npx playwright test --grep-invert "change password|restore original password|delete execution"
```

## Reports

### Playwright's own report

- **`playwright-report/index.html`** — interactive HTML report with screenshots and videos of
  failures.
- **`test-results/`** — per-run artifacts (screenshots, videos, traces).

```bash
npx playwright show-report
```

### Corporate report

A branded report is generated on every run at **`playwright-report/corporate-report.html`**, with
a summary (total, passed, failed, skipped, flaky, duration), a success-rate bar, results grouped
by file, failure screenshots and run metadata.

It takes options in `playwright.config.ts`:

```typescript
['./reporters/corporate-reporter.ts', {
  outputFile: 'playwright-report/corporate-report.html', // Output path
  companyName: 'baobab soluciones',                      // Company name
  projectName: 'Cornflow UI',                            // Project name
  logoPath: 'src/app/assets/logo/baobab_full_logo.png',  // Logo path
  embedScreenshots: true,                                // Embed failure screenshots
}]
```

### Emailing the report

```bash
npm run test:e2e:send-report   # send only (tests must have run before)
npm run test:e2e:full          # run + send
```

Add to `.env.test`:

```env
REPORT_SMTP_HOST=smtp.example.com
REPORT_SMTP_PORT=587
REPORT_SMTP_USER=your_address
REPORT_SMTP_PASS=your_app_password
REPORT_EMAIL_FROM=your_address
REPORT_EMAIL_TO=recipient1@example.com,recipient2@example.com
REPORT_EMAIL_CC=cc@example.com
REPORT_EMAIL_SUBJECT=E2E Test Report – Cornflow UI
```

> For Gmail, use an [app password](https://support.google.com/accounts/answer/185833) in
> `REPORT_SMTP_PASS`, never the account password. Credentials belong in `.env.test` or in CI
> secrets — never in the repository.

### CI/CD

```yaml
# GitHub Actions example
- name: Run E2E tests
  run: npm run test:e2e
  env:
    PLAYWRIGHT_TEST_USER: ${{ secrets.E2E_USER }}
    PLAYWRIGHT_TEST_PASSWORD: ${{ secrets.E2E_PASSWORD }}

- name: Send test report
  if: always()
  run: npm run test:e2e:send-report
  env:
    REPORT_SMTP_HOST: ${{ secrets.SMTP_HOST }}
    REPORT_SMTP_PORT: ${{ secrets.SMTP_PORT }}
    REPORT_SMTP_USER: ${{ secrets.SMTP_USER }}
    REPORT_SMTP_PASS: ${{ secrets.SMTP_PASS }}
    REPORT_EMAIL_FROM: ${{ secrets.REPORT_FROM }}
    REPORT_EMAIL_TO: ${{ secrets.REPORT_TO }}
```

All report output is gitignored.

## Troubleshooting

**Tests fail with a server error**
- Check the credentials in `.env.test`.
- Check that `VITE_APP_*` points at the intended backend — and remember the app itself reads the
  root `.env`, not `.env.test`.

**The server does not start**
- Check that port 3000 is free. If a server is already running there it will be reused outside CI,
  which may not be the one you want.

**The tests are slow**
- Authentication runs once thanks to the setup project. If it feels slow, make sure you import
  `test` from `../../fixtures` and not from `@playwright/test`.
- Specs run sequentially (`fullyParallel: false`) to avoid clashing over the shared server: 1
  worker locally, 2 in CI. Both are adjustable in the config.

**Selector problems**
- `npm run test:e2e:debug` to inspect the live page, `npm run test:e2e:ui` to step through a run.
- Check the screenshots in `test-results/` to see the page at the moment of failure.

## Further reading

- [Playwright documentation](https://playwright.dev/)
- [Playwright best practices](https://playwright.dev/docs/best-practices)
- [Playwright Test API](https://playwright.dev/docs/api/class-test)
