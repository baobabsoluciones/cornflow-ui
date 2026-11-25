# End-to-end suite

The end-to-end suite of cornflow-ui lives in core, and every app built on core runs it against
its own deployment: its frontend, its backend and its DAGs, with nothing mocked.

- **It adapts to each app.** It reads what the app is made of from `window.cornflowUi.describe()`
  (its config, the settings its backend sends, its languages and texts) and tests what the app
  has on. What the app has off must not show. What cannot be tested there is skipped, and the
  report says why.
- **Apps write no tests.** An app gives the suite its test data: per schema, an instance the
  checks find nothing in, one with errors and one with warnings, and the execution config.
- **It reports its coverage:** what it tested, what failed and what it did not test, with the
  reason.
- **It checks every screen** for untranslated texts and for errors of the app.

It is meant to run when it matters: when an app moves to a new version of core, before a
deployment, or in CI.

## Running it in an app

### 1. The Playwright config

`playwright.config.mjs` at the root of the app:

```js
import { createCornflowE2EConfig } from '@cornflow-ui/core/e2e/configFactory.mjs'

export default createCornflowE2EConfig({
  devCommand: 'npm run dev -- --port 3000', // starts the app under test
  baseURL: 'http://localhost:3000',
})
```

Playwright cannot load TypeScript from `node_modules`, so on every run the factory copies the
suite into `tests/e2e/.cornflow-core/` and runs that copy. Do not edit the copy: it is rewritten
on every run.

Other options of the factory:

| Option | What it does |
| --- | --- |
| `consumerSpecDir` | The app's own specs, run as the `chromium-app` project (see [Writing specs](#writing-specs)) |
| `layers` | The suites of the packages between core and the app, each run as a project of its own: `{ name, sourceDir, mirrorName, modules? }` |
| `envDefaults` | Environment for what `.env.test` and the shell leave unset |
| `overrides` | Any other Playwright setting |

### 2. What git must ignore

```gitignore
tests/e2e/.cornflow-core/
tests/e2e/.auth/
tests/e2e/.env.test
playwright-report/
test-results/
```

### 3. The UAT file

`tests/e2e/uat.json`, or another file named by `E2E_UAT_FILE`:

```json
{
  "mode": "shared",
  "schemas": {
    "my_dag": {
      "config": { "solver": "default", "timeLimit": 60 },
      "datasets": {
        "valid": "data/valid.json",
        "withErrors": "data/with_errors.json",
        "withWarnings": "data/with_warnings.json"
      },
      "solution": "data/solution.json",
      "infeasible": { "dataset": "valid", "config": { "solver": "infeasible" } },
      "failingSolver": { "dataset": "valid", "config": { "solver": "failing" } }
    }
  }
}
```

| Key | What it is |
| --- | --- |
| `mode` | `shared` or `disposable`. See [Modes](#modes) |
| `schemas` | One entry per DAG to test, named as the app names it |
| `config` | The execution config every case of that DAG runs with. Its `timeLimit` (seconds) sets how long the suite waits for an execution: `timeLimit` plus two minutes, three minutes at least |
| `datasets.valid` | Instance data that the checks find nothing in and that solves with a solution |
| `datasets.withErrors` | Instance data that the checks find errors in |
| `datasets.withWarnings` | Instance data that the checks find warnings in, and no errors. It still solves |
| `solution` | Optional, recommended. A solution of the `valid` dataset, as the DAG returns it (the `data` of a solved execution). See [Executions already solved](#executions-already-solved) |
| `infeasible` | Optional. A dataset and the config to add for an execution that ends with no solution, without failing |
| `failingSolver` | Optional. A dataset and the config to add for an execution whose solver fails |

Datasets are JSON instance files. Paths are relative to the UAT file. Any dataset or case can be
left out: the tests that need it are skipped, and the report says so.

The file is checked before anything runs. A file that is not right stops the run with every
problem listed.

### 4. Credentials and environment

`tests/e2e/.env.test` (see [`.env.test.example`](./.env.test.example)), or the environment:

| Variable | What it is |
| --- | --- |
| `E2E_USER`, `E2E_PASSWORD` | The user the suite signs in as. An admin in `disposable` mode |
| `E2E_BACKEND_URL` | Optional. The suite works on the backend the app talks to (`describe().backendUrl`). Set it only to reach that backend at another address |
| `PLAYWRIGHT_BASE_URL` | Optional. Where the app under test is served, if not where `baseURL` says |
| `E2E_UAT_FILE` | Optional. Another UAT file than `tests/e2e/uat.json` |

Credentials never go in the UAT file or in the repository.

The app under test takes its own configuration as always (its `.env`, or `values.json`). Vite does
not read `.env.test`.

### 5. Run it

```bash
npx playwright install chromium   # once
npx playwright test --config=playwright.config.mjs
```

`--headed` shows the browser, `--ui` opens Playwright's UI mode, and `--project=chromium-auth-tests`
runs the sign-in tests only.

## Modes

| | `shared` | `disposable` |
| --- | --- | --- |
| For | An environment others use, such as a pre-production | An environment thrown away after the run |
| Signs in as | `E2E_USER` | A user per role of the deployment, created by `E2E_USER` (an admin). The tests run as the planner unless they ask for a role |
| Touches | Only what it creates | Only what it creates, and the users it makes |

What the suite creates is named after the run:

- executions and instances are named `[e2e] <run id> …`;
- users are named `e2e_<run id>_…`.

At the end of the run, the suite deletes everything named after that run, even after tests that
failed halfway. Two runs at the same time against the same backend do not touch each other's data.

Each test deletes what it made when it ends. Some data waits for the end of the run: the instance
of data checks that never got launched, or a launch the backend turned down.

## Executions already solved

The tests about executions that already exist (loading one, looking at its data, editing it, the
history) make them through the API before they open the app, from the `valid` dataset:

| | How | The execution | Time |
| --- | --- | --- | --- |
| With `solution`, and `E2E_USER` an admin (`disposable` mode) | The solution is saved as the DAG saves it when it ends | Solved, its solution "Optimal", as after a real run | A moment |
| With `solution`, and `E2E_USER` not an admin | The solution is uploaded as a user does instead of solving | "Not run", with the solution. The report notes it | A moment |
| Without `solution` | Solved for real | Solved | As long as the solver |

To get the `solution` of an app, solve its `valid` dataset once and save the `data` of that
execution (`GET /execution/<id>/data/`).

## What it tests

| Area | Tests |
| --- | --- |
| Sign in | Signs in with a valid user. Turns down a user that does not exist. Asks for both fields. Offers the languages the app shows |
| History | Opens and loads. Lists the executions the user made, finds them by name, clears the filters and opens one. The filters of the state of the execution, of the state of its solution and of the solver leave the executions with the value picked, and "Clear filters" takes them away. The dates: today lists what was made today, yesterday and an old custom range do not, and a range of today does. Deletes an execution once the user confirms, and keeps it when they cancel. Downloads an execution to Excel: its input data and its solution, a sheet per table with the rows the backend has. "Create new execution" opens the create-execution page with no data. Relaunches a loaded execution from its input data (where `allowEditInstance` is on): the new execution has its data and parameters. The filters the app config adds (`executionFilters`, from its master tables) are not tested yet |
| Roles and permissions | With a user of each role (disposable mode; in shared mode, the one user there is): each lands where it may, the menu has no link to a view its role forbids (`rolesConfig`) nor "New execution" when that is forbidden, and the address of a forbidden view does not open it. Administration (roles management) only for admins, where `enableRolesManagement` is on. What the backend does not let a role do (create an execution, for a viewer), the app does not offer, or says so when tried, and nothing is created. Roles management lists the backend's roles with their users, and picking one lists them; in disposable mode, it gives a user the test creates another role and takes it away. Where `allowEditRoles` is on, it offers adding, renaming and deleting a role; none is saved, because Cornflow 1.3 cannot delete a role |
| User | The settings show who is signed in, and their role. Each language the app offers changes its texts, and the history and the create-execution page show none untranslated in it. The appearance, where `enableDarkMode` is on: light, dark, or as the system is, kept for the next visit; off, the app stays light. Signing out asks first: cancelled, the user stays; confirmed, the app asks to sign in again. In disposable mode only, the password of a user the test creates: it is saved once it meets every rule, the new one signs in and the old one no longer does |
| Loaded executions | Loads an execution from its history row, its history detail and the latest executions of the side menu: a tab opens, selected, and the menu shows it. Its input data and results open headed by its summary. Switches between two tabs, deselects with a second click, and closing the selected one on its data goes back to the history |
| Data of an execution | Every page and table tab of its input data and of its results shows the rows the table has in the backend, and no table the execution does not have. The validations show what the input data checks found, each with its rows, and only when they found something. Each table downloads to Excel as on screen, and the input data, the results and the validations download whole, a sheet per table with its rows. The results validations are not tested with checks: an execution made for a test has no solution checks |
| Create execution | Load filters show only when the backend declares them. The solver can be picked only when the app lets the user pick one. Then, with each dataset: valid data solves and the solution shows; data with errors is caught by the checks, and stops the launch where `enableBlockAdvanceOnCheckErrors` says so; data with warnings is caught and still solves; an infeasible case ends with no solution; a failing solver ends in error |
| Data from other files | Excel: the workbook the page gives for the data loads back as the same data, and the backend gets it; a workbook overwrites the data already loaded. CSV: a table from a CSV file, with the rest of the data as JSON, loads as the dataset, and the backend gets it. Each only where the page takes that format (`instanceFileFormats`). A solution file, in developer mode: a file that is not a solution is refused, and with the UAT file's `solution` the execution is created not run, with that solution, and its result shows it. The files are made from the valid dataset and its solution: an app needs no others |
| Editing data | On the create-execution page, with the valid dataset: a cell edited, two rows edited in bulk, a row deleted, a row added and a parameter changed (a yes/no or a whole number) stay pending and the review lists them; launching applies them, and the backend gets the data with them and the other tables as loaded. The review undoes a change, a row, a table and every change. Applying the changes puts them in the data, and a number past its schema's minimum or maximum is not applied: the review says why and the change stays pending. The data of an execution already made only shows, unless `enableSolutionRecalculation` is on (editing it to solve it again is the recalculation module's). What is edited is chosen from the dataset, with values it already has, so any schema takes them; a test whose dataset has nothing to edit is skipped with the reason |

Create execution and editing data work on the schema the app opens with.

What the suite does not test yet: sign-in other than Cornflow's own user and password (the run
stops with a clear message), and executions read from a backend's own endpoints
(`executions.<dag>` in its frontend config). The history test skips the latter.

## The report

At the end of a run the suite prints its coverage:

```text
Coverage: 12 tested, 1 failed, 2 not tested
  tested      create execution › data with errors: … (check errors do not stop the launch here)
  failed      history › lists the executions the user made, …
  not tested  create execution › infeasible: it ends with no solution: the UAT file has no infeasible case for my_dag
Known issues: 1
  configParams.seconds shown untranslated on /#/project-execution: …
```

- **tested**: the test ran and passed, or passed on a retry. Between brackets, what case of the
  app it went through.
- **failed**: the test ran and did not pass. Playwright's own report has the details:
  `npx playwright show-report`, with a screenshot, a video and a trace of each failure.
- **not tested**: the test does not apply to this app, and why.
- **Known issues**: known faults the run came across. They do not fail a test while they wait
  for their fix (see below).

## Untranslated texts

Every page a test opens is watched while the test runs: every route, every step and every dialog
it goes through. A text that is a whole text key (`createExecution.title`) instead of what the key
says fails the test, with the key and the page it was on. Only keys of the app's own texts count
(`describe().i18nNamespaces`), so data, file names and e-mail addresses are not taken for keys.
The cells of data tables are left out.

A known fault of core that shows a key is listed in `KNOWN_UNTRANSLATED`
(`suite/harness/translations.ts`). Keys it explains are reported as known issues and do not fail
the test. Take the entry out once core is fixed.

## Errors of the app

Every page a test opens is also watched for what goes wrong even when the screen looks fine. Any
of these fails the test, with what happened and the page it was on:

- an uncaught JavaScript error;
- an error inside a component (Vue's "Unhandled error during execution of …");
- a response with a 5xx status.

4xx responses do not count (a wrong password answers 401, a backend without an optional endpoint
answers 404), nor do requests cut short by a navigation, what the app logs for a failure it
handles, or the 504 of Vite's development server when it optimises a new dependency and reloads
the page. The stack of each uncaught error is attached to the test in Playwright's report.

Errors inside components are thrown only when the app runs in development mode, as the suite
starts it by default; against a production build only uncaught errors and 5xx responses are
found.

Known faults go in `KNOWN_APP_ERRORS` (`suite/harness/appErrors.ts`), handled like the
untranslated keys. A test that causes an error on purpose turns the check off with
`test.use({ checkAppErrors: false })`.

## Writing specs

Specs import `test` and `expect` from the suite's fixtures, never from `@playwright/test`: the
fixtures are what put the session back. In core that is `suite/harness/fixtures.ts`. In a layer
or an app, it is the copy: `tests/e2e/.cornflow-core/harness/fixtures.ts`.

```ts
import { test, expect } from '../.cornflow-core/harness/fixtures'

test('…', async ({ page, deployment, uat, api }) => {
  test.skip(
    !deployment.core.parameters?.solverConfig?.showSolverStep,
    'the solver is not offered here',
  )
  // …
})
```

| Fixture | What it is |
| --- | --- |
| `deployment` | What `describe()` said once signed in: what is on and off |
| `uat` | The app's UAT file, checked |
| `api` | Cornflow's API, as the same user as the page. What it creates is deleted when the test ends |
| `session` | The user the page is signed in as: `default`, a role (`test.use({ session: 'viewer' })`, `disposable` mode only), or `null` to start signed out |
| `checkTranslations` | On by default |
| `checkAppErrors` | On by default |

Rules that keep a spec working on every app:

- Read what to expect from `deployment`, and assume nothing about a schema: no table names, no
  row counts.
- Skip with the reason what does not apply: `test.skip(condition, reason)`. The report lists it.
- Name what you create with `api.name(label)`, so the clean-up finds it.
- Find elements by `data-testid`, and move around the app through the side menu
  (`openFromMenu` in `suite/harness/navigation.ts`).

## Developing the suite in core

Core runs the suite against a Cornflow of its own: `stack/`, with cornflow, airflow and a small
planning app, `e2e_planning`, made to give each case of the UAT file.

```bash
docker compose -f tests/e2e/stack/docker-compose.yml up -d --wait
npm run test:e2e:stack   # checks that every case of e2e_planning ends as it should
npm run test:e2e         # the suite, against the stack
docker compose -f tests/e2e/stack/docker-compose.yml down -v
```

- `tests/e2e/uat.json` is core's UAT file, in `disposable` mode, with the datasets of the stack.
- `npm run test:e2e` starts core on port 3060 with the stack's settings, whatever the root
  `.env` says.
- The stack needs a while after `up` before airflow takes executions.
- Airflow 2 sometimes turns a launch down ("Airflow is not accessible"), and it turns down
  launches asked at the same time. The suite runs one test at a time, and retries a test that
  fails: once locally, twice in CI.

`npm run test:e2e:headed`, `test:e2e:ui` and `test:e2e:debug` run the suite with a browser, in UI
mode and in Playwright's inspector.

## Troubleshooting

- **The run uses the wrong backend or base URL.** An old `tests/e2e/.env.test` takes precedence
  over the defaults of the config. Update it from `.env.test.example`.
- **The app does not start, or starts with the wrong settings.** A dev server already running on
  that port is reused outside CI. Stop it first.
- **A test fails with "The execution could not be launched".** The backend turned the launch
  down: the message after it is the backend's.
