# Create-execution flows

The "create execution" screen (route `project-execution`) is a **flow** built on logic that does not
depend on its layout. Core ships one, and an application can replace it with its own without
touching core.

| Flow | What the user sees | How to get it |
| --- | --- | --- |
| **Core's page** (default) | One page: the data card on the left (where the data comes from, then its tables to review and edit) and the launch panel on the right (name, data checks, parameters, what is still missing, Resolve). | Nothing to set |
| **The app's own** | Whatever the application needs, built with the same logic and blocks. | `createExecution.component` |

Both go through `useExecutionDraft`, so the calls to the backend, the states and the
configuration flags behave the same whichever flow is on screen.

In an application this guide ships with the package, at
`node_modules/@cornflow-ui/core/docs/create-execution-flows.md`.

## Picking a flow

In the application's `src/app/config.ts`, under `core.parameters`:

```ts
createExecution: {
  // The app's own flow; without it, core's page.
  component: () => import('@/app/views/MyCreateExecutionView.vue'),
  // How the execution is named when its data is loaded (optional, see below).
  proposeName: null,
},
```

The route is built when the app starts, so the flow is one per application (not per DAG).

## Building an application's own flow

Everything lives in the application's `src/app`; nothing in core is copied or edited.

1. Create the view, e.g. `src/app/views/MyCreateExecutionView.vue`.
2. In it, call `useExecutionDraft()` once and compose the blocks you need around it.
3. Point `createExecution.component` at it.
4. Add the texts you introduce to `src/app/plugins/locales/<lang>.ts`.

A minimal flow that reuses core's blocks with a layout of its own:

```vue
<template>
  <div class="view-container my-create-execution">
    <CoreTitleView icon="mdi-play-circle-outline" :title="$t('createExecution.title')" />
    <ExecutionDataCard :draft="draft" />
    <LaunchPanel :draft="draft" @view="goToResults" @history="router.push('/history-execution')" />
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import CoreTitleView from '@cornflow-ui/core/components/core/CoreTitleView.vue'
import ExecutionDataCard from '@cornflow-ui/core/components/create-execution/ExecutionDataCard.vue'
import LaunchPanel from '@cornflow-ui/core/components/create-execution/LaunchPanel.vue'
import { useExecutionDraft } from '@cornflow-ui/core/composables/create-execution/useExecutionDraft'

const draft = useExecutionDraft()
const router = useRouter()

function goToResults() {
  // e.g. select draft.launch.executionId and open the app's results view
}
</script>
```

A flow that does not use the blocks at all only needs the draft: show `draft.missing`, call
`draft.load()`, `draft.runChecks()`, `draft.launchExecution()`… and render it as you like.

### Rules

- **Talk to the backend through the draft.** Loading, checks, the ETL review sync and the launch
  are in `useExecutionDraft`; a flow that calls the repositories itself loses the ETL, the
  pre-ETL parameters, the checks config and the uploaded-solution path.
- **Use the `Core*` components** (`src/components/core/`, see the catalog: `npm run catalog`) and
  the design tokens (`--color-*`, `--spacing`, `--radius-*`…), not Vuetify or fixed colours, so the
  flow follows the app's palette.
- **Leaving with progress.** Core's flows ask before leaving (`onBeforeRouteLeave`) and offer to keep
  a draft; an own flow decides what to do with `draft.hasProgress`, `draft.saveDraft()`,
  `draft.readDraft()` and `draft.resumeDraft()`.

## `useExecutionDraft`

`src/composables/create-execution/useExecutionDraft.ts`. Call it inside `setup`; it returns a
reactive object (read `draft.isLoaded`, not `draft.isLoaded.value`).

### State

| Field | What it is |
| --- | --- |
| `execution` | `{ instance, config, name, description }`: what will be created. `config` holds every parameter, the load filters and `solver`. |
| `files` | Files picked and not loaded yet (or the ones the data came from). |
| `loadStatus` | `'empty' \| 'loading' \| 'loaded' \| 'error'` |
| `loadErrors` | Schema errors of the last load, grouped by table in plain words (`{ count, groups: [{ title, items }] }`); `rawLoadErrors` keeps the Ajv errors for the "download all" file. |
| `loadWarning` | Non-blocking message of the ETL. |
| `fromExecution` | Name of the execution the data was copied from (relaunch), or null. |
| `nameProposed` | The name was proposed, not typed. |
| `fromDataKeys` | Parameters whose value was read from the loaded data. |
| `checks` | `{ status, results, checkedAt }`; `status` is `'none' \| 'running' \| 'ok' \| 'warnings' \| 'errors' \| 'stale'`, `results` one entry per check table that found rows, errors first (`{ key, title, description, kind: 'error' \| 'warning', columns: { key, title }[], records }`). |
| `launch` | `{ running, step, executionId, error }`; `step` is `'sync' \| 'execution' \| 'solution'` while it runs; `error` says why the last launch failed, in the backend's words (e.g. the orchestrator is down), until the next attempt. |
| `solution` | Developer mode: `{ enabled, file, data, errors }` of the solution to upload instead of solving. |

### What the configuration offers

| Field | What it says |
| --- | --- |
| `dataSourceMode` | `'files'` (the files are read, or sent to the ETL), `'database'` (the ETL brings the data; files replace the tables with the same name), `'database-filtered'` (the same, after the load filters). |
| `loadFilterFields` | The `pre_etl` parameters, asked before loading. |
| `parameterFields` | The parameters the user sets (every config field but the load filters). Empty when `configFieldsConfig.showConfigFieldsStep` is false. |
| `showSolver`, `solvers`, `defaultSolver` | The solver is asked only with `solverConfig.showSolverStep` and more than one solver. |
| `developerMode`, `blockOnCheckErrors`, `hasChecks`, `acceptedExtensions` | `isDeveloperMode`, `enableBlockAdvanceOnCheckErrors`, whether the DAG has instance checks, and the file extensions the data loads from. |

### Derived

| Field | What it says |
| --- | --- |
| `isLoaded`, `canLoad` | There is data; it can be (re)loaded now. |
| `filtersChanged`, `missingRequiredFilters`, `filesChanged` | The load filters changed since the data was brought; required filters still empty; files picked that are not in the data. |
| `pendingChangesCount` | Table edits not applied yet. |
| `missing` | What stops the launch, in order, each with the place it points to: `{ key, text, target }`, `target` being `'data' \| 'checks' \| 'name' \| 'param:<key>'`. |
| `canLaunch` | Nothing missing, not launching, and a solution file when uploading one. |
| `isLaunched`, `launchedExecution`, `launchedRunning` | The created execution as the store follows it (its state updates every few seconds). |
| `hasProgress` | Something would be lost by leaving. |

### Actions

| Action | What it does |
| --- | --- |
| `addFiles(files)`, `removeFile(index)` | Pick and drop files. |
| `setFilter(key, value)` | Set a load filter. |
| `load()` | Bring the data in: the picked files (read in the browser, or sent to the ETL with the load filters), or the database when there are none. Proposes a name and takes the parameter values the data has. |
| `setInstance(instance)`, `setDataErrors(html)` | The review replaced the data / found schema errors in an edit; the checks become out of date. |
| `registerPendingChangesApplier(fn)`, `applyPendingChanges()` | Whatever shows the tables registers how to apply the pending edits; checks and launch apply them first. |
| `markEtlChanged()` | An origin switch of the ETL review changed (also detected on its own). |
| `setParameter(key, value)`, `setName(name)`, `setDescription(text)` | Edit the execution. |
| `runChecks()` | Apply pending edits, sync the ETL review, store the instance and run the data checks. |
| `setSolutionMode(on)`, `setSolutionFile(file)` | Developer mode: create with an uploaded solution. |
| `launchExecution()` | Apply pending edits, sync the ETL review, create the execution (or create it without running and upload the solution) and start following it. Resolves whether it was created; when not, `launch.error` says why. |
| `reset()` | Back to an empty execution ("Launch another"). |
| `startFrom(loadedExecution)` | An editable copy of a loaded execution: its data, parameters, description and name ("relaunch"). |
| `saveDraft()`, `readDraft()`, `discardDraft()`, `resumeDraft(draft)` | Keep the unfinished execution in the browser (IndexedDB, one per DAG and user): data, unapplied edits and the ETL review not yet sent. |

## Blocks

`src/components/create-execution/`. The composite blocks take the draft; the small ones take
plain props, so they also fit a flow that keeps its own state.

| Block | Props | What it shows |
| --- | --- | --- |
| `ExecutionDataCard` | `draft`, `highlight` | Where the data comes from (files, or the database with or without load filters), the load errors and warning, and once loaded the tables to review and edit (`CreateExecutionReviewInstance`), with "Load filters", the Excel menu (download the data, or overwrite it with a workbook), "Reload" and "Maximize". The table fills the card: the card's table area is marked `data-table-bounds`, so the table takes its height from it instead of from the window. |
| `LaunchPanel` | `draft`, `v-model:collapsed`; emits `go`, `view`, `history` | Name, checks, parameters, what is missing, the note about unapplied edits or unchecked data, why the last launch failed, the developer menu, Resolve; folded, a strip; launched, `LaunchResult`. |
| `LoadFiltersForm` | `fields`, `values`, `showErrors`; emits `change` | The load filters in a grid. |
| `ChecksStatus` | `status`, `results`, `checkedAt`, `blocking`, `disabled`, `highlight`; emits `run` | Where the checks stand and what they found: one line per check with its count, errors first; any of them opens `ChecksDetailDialog`. |
| `ChecksDetailDialog` | `v-model`, `results`, `initialKey` | Every check as a table with the columns of the checks schema, with a search over its rows. |
| `ExecutionParametersForm` | `fields`, `values`, `solvers`, `defaultSolver`, `fromData`, `highlight`, `showErrors`; emits `change` | Parameters to decide on first, the ones with a default under "Advanced". |
| `ParameterInput` | `field`, `value`, `invalid`; emits `change` | One parameter's control. |
| `LaunchResult` | `name`, `execution`; emits `view`, `another`, `history` | The launched execution followed live. |
| `DraftBanner` | `draft`; emits `resume`, `discard` | A saved draft to pick up. |
| `ExitCreateExecutionDialog` | `modelValue`, `saving`; emits `save`, `leave`, `cancel` | Leaving half done. |

## The proposed name

When the data is loaded the execution gets a name, so launching needs no typing: the first file's
name in words ("plan_week_43.xlsx" → "Plan week 43"), or "Data of <date>" when it came from the
database, followed by the picked load filters ("· North plant"). A relaunch is named after the
execution it comes from. A name the user typed is never replaced.

An application changes the rule with `createExecution.proposeName`, a function that receives
`{ fileNames, filterLabels, fromExecution, date, t }` and returns the name.

## Checklist for changing a flow (people and AI assistants)

- [ ] The change lives in the application's `src/app` (view, `config.ts`, locales); nothing under
      `node_modules/@cornflow-ui/core` is edited or copied.
- [ ] The flow gets its data and launches through `useExecutionDraft`.
- [ ] It is built with the blocks above and the `Core*` components; new pieces read the tokens.
- [ ] `createExecution.component` points at the view.
- [ ] New texts are in every language the app shows (`src/app/plugins/locales/`).
- [ ] What the user sees before launching still tells them what is missing (`draft.missing`).
