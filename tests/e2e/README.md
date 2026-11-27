# End-to-end suite

The end-to-end suite of cornflow-ui lives in core, and every app built on core runs it against
its own deployment: its frontend, its backend and its DAGs, with nothing mocked.

- **It adapts to each app.** It reads what the app is made of from `window.cornflowUi.describe()`
  (its config, the settings its backend sends, its languages and texts) and tests what the app
  has on. What the app has off must not show. What cannot be tested there is skipped, and the
  report says why. The app publishes `describe()` only on the pages the suite opens: they carry
  a mark (`window.__cornflowE2E`) the suite sets before the app starts; anywhere else, as in
  production, it is not there.
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
| `E2E_USER`, `E2E_PASSWORD` | The user the suite signs in as. In `disposable` mode, an admin; from Cornflow 1.4 on, a platform administrator (`platform_admin`), the only one that lists the roles |
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
| Sign in | Signs in with a valid user. Turns down a user that does not exist. Asks for both fields. Offers the languages the app shows The password can be shown, and hidden again. |
| History | Opens and loads. Lists the executions the user made, finds them by name, clears the filters and opens one. The filters of the state of the execution, of the state of its solution and of the solver leave the executions with the value picked, and "Clear filters" takes them away. The dates: today lists what was made today, yesterday and an old custom range do not, and a range of today does. Deletes an execution once the user confirms, and keeps it when they cancel. Downloads an execution to Excel: its input data and its solution, a sheet per table with the rows the backend has. "Create new execution" opens the create-execution page with no data. Relaunches a loaded execution from its input data (where `allowEditInstance` is on): the new execution has its data and parameters. The filters the app config adds (`executionFilters`, from its master tables) are not tested yet Its detail shows what the app config says of an execution (`showExtraProjectExecutionColumns`: the user, when it finished, the solver, the time limit), the list the same, and it downloads to Excel from there. The list is grouped by day, each saying how many executions it has, the newest first. With `useBackendExecutionFilesDownload`, an execution downloads as the backend gives it (`GET /execution/files/<id>/`), or to Excel when the backend has no file for it; the tests of the Excel built in the browser are then skipped |
| Roles and permissions | With a user of each role (disposable mode; in shared mode, the one user there is): each lands where it may, the menu has no link to a view its role forbids (`rolesConfig`) nor "New execution" when that is forbidden, and the address of a forbidden view does not open it. Administration (roles management) only for admins, where `enableRolesManagement` is on. What the backend does not let a role do (create an execution, for a viewer), the app does not offer, or says so when tried, and nothing is created. Roles management lists the backend's roles with their users, and picking one lists them; in disposable mode, it gives a user the test creates another role and takes it away. Where `allowEditRoles` is on, it offers adding, renaming and deleting a role; none is saved, because Cornflow 1.3 cannot delete a role. Where the backend keeps the roles to platform administrators (Cornflow 1.4), an admin is told so and keeps the users without editing them, and a platform administrator of the run manages the roles |
| Navigation | With a user of each role (in shared mode, the one user there is): every page of the side menu's groups that are the same for every execution opens and the menu marks it; folded, the menu shows each group, a page opens from there and a heading pins the menu open on its pages. Pinned, the menu stays open from page to page, and unpinned it folds. In a narrow window the menu opens over the page and closes from outside it, with its button or once a page is picked. The browser's back and forward go through the pages visited, and reloading stays on the page, signed in. An address that is no page shows "not found", and its button goes back to where the app starts |
| Help | The help menu shows the version of the app and Cornflow's. The help centre gives each help file of the app (`helpMenuFiles`) in each language: the link is to the file of that language, the file is there and downloads with its name. The licences list the libraries Cornflow reports. The general tour goes back and forth with its buttons and the arrows, closes with Escape and its cross, and in each language goes over every step to the end, with its title and text, its card and what it points at on the screen, keeping the menu open meanwhile and folding it back after. The tour of each page that has one (the history, a table of a loaded execution, the create-execution page, the settings and, for an admin, roles management) goes over every step; "not found" offers none |
| Several DAGs | Where the deployment works on several DAGs (`VITE_APP_SCHEMA` names more than one) and the user may use two of them; elsewhere skipped, with the reason. The picker of the side menu offers the DAGs the user may use, in the deployment's order, and marks the one open. Another DAG has its own executions: the history lists those of the DAG open, and an execution made on the create-execution page goes to it (with a solution where the page takes one, so nothing is solved). Switching asks first with an execution open or one being made: cancelled, nothing changes; confirmed, it switches and closes the executions open. The DAG picked is kept when the app is reloaded. The app's pages limited to some DAGs (`schemas` in `appSections`) show in the menu and open only on those Each DAG shows in the picker by its label (`schemaLabels`), or its name. |
| Dashboards | Of a loaded execution. The automatic dashboard of each table of its input data and its results, where it is on (`enableAutoInstanceDashboard`, `enableAutoSolutionDashboard`, or, for one table, `showAutoDashboards` in `tableDashboards.instance.<table>` or `tableDashboards.solution.<table>`): each KPI card gives the total or the average of a column of the table as the backend has it, each chart draws, and a table with figures shows one; off, the table has none. The "Dashboard" page (`showDashboardMainView`): in the results, headed by the execution's summary, and without an execution loaded it says to load one; off, the results have no such page. The app's own dashboard pages (`dashboardPages`, `instanceDashboardPages`) are in the results and the input data, and open. Not tested: the KPI tables apart (`kpiTablesDisplayMode`), which need an execution whose data comes with KPIs, and the app's own widgets (`customWidgets`) beyond showing The "Dashboard" page of an execution still running says its solution shows once it ends. |
| Master tables | Read only, where the backend has frontend automation (`/external/frontend-automation/`); elsewhere skipped, with the reason. The menu has the master tables of the DAG open in the backend's sections, in its order, with a group for the tables in no section (or one group when the backend has no sections). Each opens from the menu, shows the rows its list gives, asked for as the app asks (with the default value of each query parameter), and downloads to Excel with them; a list the app asks for a page at a time (`limit`, `offset`) is noted, not counted. Not tested: creating, editing and deleting rows, uploads and the operations on several tables, which would change reference data others use, and the app's own pages in a section (`frontendAutomationSectionSubsections`) |
| User | The settings show who is signed in, and their role. Each language the app offers changes its texts, and the history and the create-execution page show none untranslated in it. The appearance, where `enableDarkMode` is on: light, dark, or as the system is, kept for the next visit; off, the app stays light. Signing out asks first: cancelled, the user stays; confirmed, the app asks to sign in again. In disposable mode only, the password of a user the test creates: it is saved once it meets every rule, the new one signs in and the old one no longer does The new password can be shown, and hidden again, before saving it. |
| App config | The staging notice (`isStagingEnvironment`) runs along the top of every page; off, never. With `enableWarnings`, a bell lists the warnings the backend gives (`/external/warnings/`, read only) and downloads them all; off, there is no bell |
| Loaded executions | Loads an execution from its history row, its history detail and the latest executions of the side menu: a tab opens, selected, and the menu shows it. Its input data and results open headed by its summary. Switches between two tabs, deselects with a second click, and closing the selected one on its data goes back to the history |
| Data of an execution | Every page and table tab of its input data and of its results shows the rows the table has in the backend, and no table the execution does not have. The validations show what the input data checks found, each with its rows, and only when they found something. Each table downloads to Excel as on screen, and the input data, the results and the validations download whole, a sheet per table with its rows. The results validations are not tested with checks: an execution made for a test has no solution checks A table the data has and its schema does not shows where `showTablesWithoutSchema` is on, and not where it is off. |
| Data tables | On the input data of a loaded execution: the search leaves the rows that have the text, and clearing it brings them all back; a column orders its rows up and down, and a third click leaves the order of the data; a filter of a column of numbers leaves the rows in its range, and removing it brings them all back; full screen fills the window and goes back; the list of every table of the group finds one by its name and opens it, and in a narrow window the arrows move along the tabs. The columns are picked from the schema: free text to search and sort, numbers to filter |
| Create execution | Load filters show only when the backend declares them. The solver can be picked only when the app lets the user pick one. Then, with each dataset: valid data solves and the solution shows; data with errors is caught by the checks, and stops the launch where `enableBlockAdvanceOnCheckErrors` says so; data with warnings is caught and still solves; an infeasible case ends with no solution; a failing solver ends in error Leaving with data loaded asks first: staying keeps it, saving keeps a draft (in the browser) that the page offers to resume or throw away on coming back, leaving without saving drops it. A data file that does not follow the schema is turned down, says how many errors it has, and they download to Excel, a row each. The detail of the data checks lists each check that found something, an error or a warning as its schema says, with its rows, as the backend finds them in the same data. Once launched, "Launch another" starts a new execution with nothing loaded |
| Data from other files | Excel: the workbook the page gives for the data loads back as the same data, and the backend gets it; a workbook overwrites the data already loaded. CSV: a table from a CSV file, with the rest of the data as JSON, loads as the dataset, and the backend gets it. Each only where the page takes that format (`instanceFileFormats`). A solution file, in developer mode: a file that is not a solution is refused, and with the UAT file's `solution` the execution is created not run, with that solution, and its result shows it. The files are made from the valid dataset and its solution: an app needs no others |
| Editing data | On the create-execution page, with the valid dataset: a cell edited, two rows edited in bulk, a row deleted, a row added and a parameter changed (a yes/no or a whole number) stay pending and the review lists them; launching applies them, and the backend gets the data with them and the other tables as loaded. The review undoes a change, a row, a table and every change. Applying the changes puts them in the data, and a number past its schema's minimum or maximum is not applied: the review says why and the change stays pending. The data of an execution already made only shows, unless `enableSolutionRecalculation` is on (editing it to solve it again is the recalculation module's). What is edited is chosen from the dataset, with values it already has, so any schema takes them; a test whose dataset has nothing to edit is skipped with the reason |

Create execution and editing data work on the schema the app opens with.

What the suite does not test yet:

- sign-in other than Cornflow's own user and password (the run stops with a clear message);
- executions read from a backend's own endpoints (`executions.<dag>` in its frontend config): the
  history test skips them;
- what a user with no DAG of the deployment sees: Cornflow gives DAGs to users from its command
  line only, not through its API;
- what `sectionTitles` and the state texts (`executionStates`, `solutionStates`) say: they are
  text keys, whose translations are the app's. The check of untranslated texts covers them.

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
- A page of a browser context you open yourself, for a second user, needs the session and the
  suite's mark: open it with `newSignedInContext` (`suite/harness/session.ts`), or call
  `markForTheSuite` on it. Without the mark the app does not publish `describe()`.

## Developing the suite in core

Core has no backend or DAGs of its own: the suite is checked against the deployment of an app,
as the apps run it. Against an environment others use, always in `shared` mode.

**From the app (the usual way).** Install core in the app from your copy, so the app runs the
suite you are changing: `npm link` in core and `npm link @cornflow-ui/core` in the app, or a
`file:` dependency. Installed that way, the factory runs the suite in place from your copy, with
no `.cornflow-core/` mirror, and the app's own configuration, UAT file and `.env.test`. Run it
from the app as usual.

**From core.** `npm run test:e2e` starts core on port 3060 and runs the suite against the backend
the root `.env` points at (`VITE_APP_BACKEND_URL`, `VITE_APP_SCHEMA`…). It needs an app's UAT file
and its user in `tests/e2e/.env.test` (`E2E_UAT_FILE`, `E2E_USER`, `E2E_PASSWORD`). Core is not
that app: it shows core's own configuration, not the app's, so this is for checking the suite
itself, not the app. Core's `.gitignore` keeps `tests/e2e/uat*.json` and `tests/e2e/data/` out of
the repository: they hold the app's data.

- Airflow sometimes turns a launch down ("Airflow is not accessible"), and it turns down launches
  asked at the same time. The suite runs one test at a time, and retries a test that fails: once
  locally, twice in CI.
- The tests of several DAGs (`specs/schemas/`) need a deployment that works on more than one.

`npm run test:e2e:headed`, `test:e2e:ui` and `test:e2e:debug` run the suite with a browser, in UI
mode and in Playwright's inspector.

## Troubleshooting

- **The run uses the wrong backend or base URL.** An old `tests/e2e/.env.test` takes precedence
  over the defaults of the config. Update it from `.env.test.example`.
- **The app does not start, or starts with the wrong settings.** A dev server already running on
  that port is reused outside CI. Stop it first.
- **A test fails with "The execution could not be launched".** The backend turned the launch
  down: the message after it is the backend's.
- **A page goes blank and comes back empty in the middle of a test.** The dev server reloaded it:
  the first time the app uses a dependency Vite has not prepared yet, Vite prepares it and reloads
  the browser. It is not a fault of the app or of the test, and it does not happen again once
  prepared: run the test again. The time of `node_modules/.vite/deps/_metadata.json` gives it
  away (the run does not show what Vite logs).
