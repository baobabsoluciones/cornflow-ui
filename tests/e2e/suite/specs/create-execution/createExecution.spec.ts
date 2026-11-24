/**
 * Creating an execution through core's page, for the schema the app opens with, with each
 * dataset of the UAT file: the data goes in from its file, the checks find what they should, and
 * the execution ends as it should. What the page has to allow comes from the deployment: whether
 * check errors stop the launch, whether the solver can be picked.
 */
import type { Page } from '@playwright/test'
import { test, expect } from '../../harness/fixtures'
import {
  ExecutionState,
  executionTimeout,
  hasDataChecks,
  launchAndWait,
  loadDataFile,
  loadsJsonFiles,
  nameExecution,
  openAdvancedParameters,
  openCreateExecution,
  openResult,
  resolveButton,
  runDataChecks,
  setParameter,
  shownRows,
} from '../../harness/createExecution'
import type { CornflowApi } from '../../harness/cornflowApi'
import type { DatasetKind, Uat } from '../../harness/uat'

/** States an execution ends in when it fails. */
const FAILED_STATES: number[] = [
  ExecutionState.Error,
  ExecutionState.Stopped,
  ExecutionState.NotStarted,
  ExecutionState.UnknownError,
  ExecutionState.FailedSaving,
]

const DATASET_NAMES: Record<DatasetKind, string> = {
  valid: 'valid',
  withErrors: 'with errors',
  withWarnings: 'with warnings',
}

/** Rows of the solution, in all its tables together. */
function solutionRows(data: Record<string, unknown> | null): number {
  return Object.values(data ?? {}).reduce<number>(
    (rows, table) => rows + (Array.isArray(table) ? table.length : 0),
    0,
  )
}

/**
 * Loads a dataset of the UAT file from its JSON file, as the user does. Skips the test when the
 * file does not give that dataset or the page does not take JSON files here (an app that brings
 * its data from a database, for instance).
 */
async function loadDataset(
  page: Page,
  uat: Uat,
  schema: string,
  dataset: DatasetKind,
): Promise<void> {
  const file = uat.schemas[schema]?.datasets[dataset]
  test.skip(
    !file,
    `the UAT file has no ${DATASET_NAMES[dataset]} dataset for ${schema}`,
  )
  test.skip(
    !(await loadsJsonFiles(page)),
    'the create-execution page does not load JSON data files here',
  )
  expect(await loadDataFile(page, file!), 'the data loads').toBe('loaded')
}

/**
 * Loads the dataset, names the execution and sets its config: the schema's, plus `caseConfig`.
 * A key of `caseConfig` the page does not let the user set skips the test: the case needs it.
 * Returns how long the execution may take to end (see `executionTimeout`).
 */
async function prepare(
  page: Page,
  uat: Uat,
  schema: string,
  dataset: DatasetKind,
  name: string,
  caseConfig: Record<string, unknown> = {},
): Promise<number> {
  await loadDataset(page, uat, schema, dataset)
  await nameExecution(page, name)
  const config = { ...uat.schemas[schema].config, ...caseConfig }
  for (const [key, value] of Object.entries(config)) {
    const set = await setParameter(page, key, value)
    test.skip(
      !set && key in caseConfig,
      `the page does not let the user set "${key}", which this case needs`,
    )
  }
  return executionTimeout(config)
}

/** The execution the page created, and its solution, as Cornflow has them. */
async function createdExecution(api: CornflowApi, name: string) {
  const execution = await api.findExecution(name)
  expect(execution, `an execution called "${name}" was created`).not.toBeNull()
  return api.executionData(execution!.id)
}

test.describe('create execution', () => {
  let schema = ''

  // Only what every test needs: those that load a dataset check, when they do, that there is one
  // and that the page takes it (see loadDataset).
  test.beforeEach(async ({ page, deployment }) => {
    schema = deployment.schemas[0]
    test.skip(
      !(await openCreateExecution(page)),
      "the app has its own create-execution flow instead of core's page",
    )
  })

  test('asks for load filters only when the backend declares them', async ({
    page,
    deployment,
  }) => {
    const query = deployment.frontendConfig?.etl?.[schema]?.query
    const declared = Object.keys(query?.properties ?? {})
    const required: string[] = Array.isArray(query?.required)
      ? query.required
      : []
    const filters = page.getByTestId('load-filters')

    if (!declared.length) {
      test.info().annotations.push({
        type: 'note',
        description: `the backend declares no load filters for ${schema}`,
      })
      await expect(filters).toHaveCount(0)
      return
    }
    await expect(filters).toBeVisible()
    for (const key of declared) {
      const field = filters.getByTestId(`load-filter-${key}`)
      await expect(field, `the load filter ${key} is asked`).toBeVisible()
      await expect(
        field.getByTestId('load-filter-optional'),
        `the load filter ${key} is ${required.includes(key) ? 'required' : 'optional'}`,
      ).toHaveCount(required.includes(key) ? 0 : 1)
    }
  })

  test('offers the solver only when the app lets the user pick one', async ({
    page,
    deployment,
    uat,
  }) => {
    const parameters = deployment.core.parameters ?? {}
    const solvers: string[] = parameters.executionSolvers ?? []
    const offered =
      parameters.configFieldsConfig?.showConfigFieldsStep !== false &&
      !!parameters.solverConfig?.showSolverStep &&
      solvers.length > 1
    await loadDataset(page, uat, schema, 'valid')
    await openAdvancedParameters(page)

    const field = page.getByTestId('parameter-solver')
    if (!offered) {
      test.info().annotations.push({
        type: 'note',
        description:
          'the solver is not offered here (showSolverStep off or one solver)',
      })
      await expect(field).toHaveCount(0)
      return
    }
    await expect(field).toBeVisible()
    for (const solver of solvers) {
      await expect(field, `the solver ${solver} is offered`).toContainText(
        solver,
      )
    }
  })

  test('valid data: the checks find nothing, it solves and shows the solution', async ({
    page,
    uat,
    api,
  }) => {
    const name = api.name('valid')
    const timeout = await prepare(page, uat, schema, 'valid', name)
    if (await hasDataChecks(page)) {
      expect(await runDataChecks(page)).toBe('ok')
    }

    expect(await launchAndWait(page, timeout)).toBe(ExecutionState.Solved)
    const { data } = await createdExecution(api, name)
    expect(solutionRows(data), 'the solution has rows').toBeGreaterThan(0)

    await openResult(page)
    await expect
      .poll(() => shownRows(page), {
        message: 'the result page shows the solution',
        timeout: 30_000,
      })
      .toBeGreaterThan(0)
  })

  test('data with errors: the checks find them, and they stop the launch when the app says so', async ({
    page,
    uat,
    api,
    deployment,
  }) => {
    await prepare(page, uat, schema, 'withErrors', api.name('with errors'))
    test.skip(!(await hasDataChecks(page)), `${schema} has no data checks`)

    expect(await runDataChecks(page)).toBe('errors')
    if (deployment.core.parameters?.enableBlockAdvanceOnCheckErrors) {
      await expect(resolveButton(page)).toBeDisabled()
      await expect(page.getByTestId('launch-panel-missing')).toBeVisible()
    } else {
      test.info().annotations.push({
        type: 'note',
        description:
          'check errors do not stop the launch here (enableBlockAdvanceOnCheckErrors off)',
      })
      await expect(resolveButton(page)).toBeEnabled()
    }
  })

  test('data with warnings: the checks find them, the launch goes on, and it solves', async ({
    page,
    uat,
    api,
  }) => {
    const name = api.name('with warnings')
    const timeout = await prepare(page, uat, schema, 'withWarnings', name)
    test.skip(!(await hasDataChecks(page)), `${schema} has no data checks`)

    expect(await runDataChecks(page)).toBe('warnings')
    await expect(resolveButton(page)).toBeEnabled()
    expect(await launchAndWait(page, timeout)).toBe(ExecutionState.Solved)
    const { data } = await createdExecution(api, name)
    expect(solutionRows(data), 'the solution has rows').toBeGreaterThan(0)
  })

  test('infeasible: it ends with no solution', async ({ page, uat, api }) => {
    const infeasible = uat.schemas[schema]?.infeasible
    test.skip(!infeasible, `the UAT file has no infeasible case for ${schema}`)
    const name = api.name('infeasible')
    const timeout = await prepare(
      page,
      uat,
      schema,
      infeasible!.dataset,
      name,
      infeasible!.config,
    )

    const state = await launchAndWait(page, timeout)
    expect(FAILED_STATES, 'it ends, it does not fail').not.toContain(state)
    const { data } = await createdExecution(api, name)
    expect(solutionRows(data), 'the solution has no rows').toBe(0)
  })

  test('failing solver: it ends in error', async ({ page, uat, api }) => {
    const failing = uat.schemas[schema]?.failingSolver
    test.skip(!failing, `the UAT file has no failing-solver case for ${schema}`)
    const name = api.name('failing solver')
    const timeout = await prepare(
      page,
      uat,
      schema,
      failing!.dataset,
      name,
      failing!.config,
    )

    const state = await launchAndWait(page, timeout)
    await createdExecution(api, name)
    if (state === ExecutionState.Solved) {
      // Cornflow's fault, not the interface's: see the risks of the suite's README.
      test.info().annotations.push({
        type: 'known issue',
        description:
          'a failed execution ended as solved: Cornflow 1.3.9 saves the error and then the ' +
          'task log without a state, which it takes as solved',
      })
      return
    }
    expect(FAILED_STATES).toContain(state)
  })
})
