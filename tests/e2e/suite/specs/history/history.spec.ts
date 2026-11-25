/**
 * The execution history of the schema the app opens with: the list and its search, its filters
 * and dates, and what is done from it: deleting an execution, downloading it to Excel and creating
 * a new one. Also relaunching an execution, from the input data of a loaded one, with its data
 * and parameters. Its executions are made through the API as the page's own user: created and
 * not run, or solved in a moment (harness/executions.ts), so listing them needs no solver.
 */
import type { Page } from '@playwright/test'
import { test, expect } from '../../harness/fixtures'
import type { CornflowApi } from '../../harness/cornflowApi'
import {
  CREATE_EXECUTION,
  launchAndWait,
  nameExecution,
} from '../../harness/createExecution'
import type { Deployment } from '../../harness/run'
import {
  downloadFiles,
  expectWorkbook,
  workbookRows,
} from '../../harness/executionData'
import { solvedExecution, type SolvedExecution } from '../../harness/executions'
import {
  deleteFromHistory,
  filterHistory,
  findInHistory,
  historyDates,
  historyRows,
  historySearch,
  loadFromHistoryRow,
  openHistory,
} from '../../harness/history'
import {
  expectSelected,
  openExecutionView,
} from '../../harness/loadedExecutions'
import { executionTimeout } from '../../harness/timing'
import { readDataset, type Uat } from '../../harness/uat'
import { readSheets } from '../../harness/xlsx'

/**
 * Skips a test that needs executions made in Cornflow listed, when the schema lists its
 * executions from the backend's own endpoint instead.
 */
function skipOwnList(deployment: Deployment, schema: string): void {
  const ownList = deployment.frontendConfig?.executions?.[schema]?.get_list
  test.skip(
    !!ownList,
    `${schema} lists its executions from the backend's own ${ownList}, where executions ` +
      'made in Cornflow may not show',
  )
}

/** An execution created and not run (state `NotRun`), of the valid dataset. Returns its id. */
async function notRunExecution(
  api: CornflowApi,
  uat: Uat,
  schema: string,
  label: string,
): Promise<string> {
  const data = readDataset(uat, schema, 'valid')
  test.skip(!data, `the UAT file has no valid dataset for ${schema}`)
  const instanceId = await api.createInstance({ schema, data: data!, label })
  return api.createExecution({
    instanceId,
    schema,
    config: uat.schemas[schema].config,
    label,
    run: false,
  })
}

/** Today's date in the browser's time zone, the one the history goes by (YYYY-MM-DD). */
async function today(page: Page): Promise<string> {
  return page.evaluate(() => {
    const now = new Date()
    const pad = (value: number) => String(value).padStart(2, '0')
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  })
}

/** Loads an execution from the history and waits until it is selected. */
async function load(page: Page, execution: SolvedExecution): Promise<void> {
  await openHistory(page)
  await loadFromHistoryRow(page, execution.name)
  await expectSelected(page, execution.id, execution.name)
}

test.describe('history', () => {
  let schema = ''

  test.beforeEach(({ deployment }) => {
    schema = deployment.schemas[0]
  })

  test('opens and loads the executions', async ({ page }) => {
    await openHistory(page)
    await expect(page.getByTestId('history-summary')).toBeVisible()
  })

  test('lists the executions the user made, finds them by name and opens one', async ({
    page,
    deployment,
    uat,
    api,
  }) => {
    skipOwnList(deployment, schema)
    await notRunExecution(api, uat, schema, 'history first')
    await notRunExecution(api, uat, schema, 'history second')
    const first = api.name('history first')
    const second = api.name('history second')

    await openHistory(page)
    const rows = historyRows(page)
    const search = historySearch(page)

    // The run's two, and nothing else.
    await search.fill(api.name('history'))
    await expect(rows).toHaveCount(2)
    await expect(rows.filter({ hasText: first })).toHaveCount(1)
    await expect(rows.filter({ hasText: second })).toHaveCount(1)

    // The search narrows the list, and clearing it brings the rest back.
    await search.fill(first)
    await expect(rows).toHaveCount(1)
    await page.getByTestId('history-clear-filters').click()
    await expect(search).toHaveValue('')
    await expect(rows.filter({ hasText: second })).toHaveCount(1)

    // Choosing one shows it in the detail panel.
    await rows.filter({ hasText: second }).click()
    await expect(page.getByTestId('history-detail')).toContainText(second)
  })

  test('the filters of the list: the state of the execution and of its solution, the solver, and clearing them', async ({
    page,
    deployment,
    uat,
    api,
  }) => {
    skipOwnList(deployment, schema)
    const solved = await solvedExecution(api, uat, schema, 'filters solved')
    const notRunId = await notRunExecution(api, uat, schema, 'filters not run')
    const listed = [
      { ...(await api.execution(solved.id))!, id: solved.id },
      { ...(await api.execution(notRunId))!, id: notRunId },
    ]
    /** The run's executions that `keep` leaves, by name. */
    const leaves = (keep: (execution: (typeof listed)[number]) => boolean) =>
      listed.filter(keep).map((execution) => execution.name)
    const expectListed = async (names: string[]) => {
      await expect(rows).toHaveCount(names.length)
      for (const name of names)
        await expect(rows.filter({ hasText: name })).toHaveCount(1)
    }

    await openHistory(page)
    const rows = historyRows(page)
    await historySearch(page).fill(api.name('filters'))
    await expectListed(leaves(() => true))

    // Each filter leaves the executions with the value picked, and its cross takes it away.
    const filters = [
      { key: 'state', value: String(listed[0].state), of: 'state' },
      {
        key: 'solutionState',
        value: String(listed[0].solutionStatus),
        of: 'solutionStatus',
      },
    ] as const
    for (const { key, value, of } of filters) {
      const chip = await filterHistory(page, key, value)
      await expectListed(leaves((execution) => String(execution[of]) === value))
      await chip.getByTestId('filter-chip-remove').click()
      await expectListed(leaves(() => true))
    }
    const solver = String(listed[0].config.solver ?? '')
    if (solver) {
      await filterHistory(page, 'solver', solver)
      await expectListed(
        leaves((execution) => execution.config.solver === solver),
      )
    }

    // "Clear filters" takes the filters and the search away.
    await page.getByTestId('history-clear-filters').click()
    await expect(historySearch(page)).toHaveValue('')
    await expect(page.getByTestId('history-filter-solver')).toHaveCount(0)
    await historySearch(page).fill(api.name('filters'))
    await expectListed(leaves(() => true))
  })

  test('the dates: today lists what was made today, yesterday and an old range do not', async ({
    page,
    deployment,
    uat,
    api,
  }) => {
    skipOwnList(deployment, schema)
    await openHistory(page)
    const day = await today(page)
    await notRunExecution(api, uat, schema, 'dates')
    const name = api.name('dates')
    const rows = historyRows(page)
    const search = historySearch(page)

    await historyDates(page, 'today')
    await search.fill(name)
    await expect(rows.filter({ hasText: name })).toHaveCount(1)

    await historyDates(page, 'yesterday')
    await expect(rows.filter({ hasText: name })).toHaveCount(0)

    await historyDates(page, { from: '2001-01-01', to: '2001-01-31' })
    await expect(rows.filter({ hasText: name })).toHaveCount(0)

    await historyDates(page, { from: day, to: day })
    await expect(rows.filter({ hasText: name })).toHaveCount(1)
  })

  test('deletes an execution once the user confirms, and keeps it when they cancel', async ({
    page,
    deployment,
    uat,
    api,
  }) => {
    skipOwnList(deployment, schema)
    const execution = await solvedExecution(api, uat, schema, 'delete')
    await openHistory(page)

    await deleteFromHistory(page, execution.name, { confirm: false })
    await expect(
      historyRows(page).filter({ hasText: execution.name }),
    ).toHaveCount(1)
    expect(await api.execution(execution.id), 'it is kept').not.toBeNull()

    await deleteFromHistory(page, execution.name)
    await expect(
      historyRows(page).filter({ hasText: execution.name }),
    ).toHaveCount(0)
    await expect
      .poll(() => api.execution(execution.id), { message: 'it is deleted' })
      .toBeNull()
  })

  test('downloads an execution to Excel: its input data and its solution, a sheet per table', async ({
    page,
    deployment,
    uat,
    api,
  }) => {
    skipOwnList(deployment, schema)
    const execution = await solvedExecution(api, uat, schema, 'download')
    const instance = await api.instanceData(execution.instanceId)
    const solution = await api.executionData(execution.id)
    await openHistory(page)
    const row = await findInHistory(page, execution.name)
    await row.hover()

    const files = await downloadFiles(page, 2, () =>
      row.getByTestId('history-row-excel').click(),
    )
    const named = (prefix: string) =>
      files.find(({ name }) => name.startsWith(prefix))
    expect(
      files.map(({ name }) => name),
      'an input data and a solution file',
    ).toHaveLength(2)
    expectWorkbook(
      readSheets(named('instance_')!.file),
      workbookRows(instance.data),
      'input data',
    )
    expectWorkbook(
      readSheets(named('solution_')!.file),
      workbookRows(solution.data),
      'solution',
    )
  })

  test('creates a new execution from the history', async ({ page }) => {
    await openHistory(page)
    await page.getByTestId('history-create-execution').click()
    await page.waitForURL((url) => url.href.endsWith(CREATE_EXECUTION))
    const card = page.getByTestId('data-card')
    if (await card.count()) {
      await expect(card, 'it starts with no data').toHaveAttribute(
        'data-load-status',
        'empty',
      )
    }
  })

  test('relaunches a loaded execution: a new one with its data and parameters', async ({
    page,
    deployment,
    uat,
    api,
  }) => {
    skipOwnList(deployment, schema)
    const parameters = deployment.core.parameters ?? {}
    const execution = await solvedExecution(api, uat, schema, 'relaunched from')
    await load(page, execution)
    await openExecutionView(page, 'input-data')
    await page
      .getByTestId('title-view')
      .getByTestId('core-dropdown-menu-trigger')
      .click()
    const relaunch = page.getByTestId('dropdown-item-edit-input-data')
    if (!parameters.allowEditInstance) {
      test.info().annotations.push({
        type: 'note',
        description:
          'allowEditInstance is off: an execution cannot be relaunched',
      })
      await expect(relaunch).toHaveCount(0)
      return
    }
    await relaunch.click()
    await page.waitForURL((url) => url.href.includes(CREATE_EXECUTION))
    await expect(page.getByTestId('data-card')).toHaveAttribute(
      'data-load-status',
      'loaded',
    )

    const name = api.name('relaunched')
    await nameExecution(page, name)
    const config = uat.schemas[schema].config
    await launchAndWait(page, executionTimeout(config))
    const relaunched = await api.findExecution(name)
    expect(
      relaunched,
      `an execution called "${name}" was created`,
    ).not.toBeNull()

    const before = await api.instanceData(execution.instanceId)
    const after = await api.instanceData(relaunched!.instanceId)
    expect(after.data, 'it has the data of the one relaunched').toEqual(
      before.data,
    )
    const { config: relaunchedConfig } = (await api.execution(relaunched!.id))!
    const solverPicked = !!parameters.solverConfig?.showSolverStep
    for (const [key, value] of Object.entries(config)) {
      if (key === 'solver' && !solverPicked) continue
      expect(
        relaunchedConfig[key],
        `it has the parameter "${key}" of the one relaunched`,
      ).toEqual(value)
    }
  })
})
