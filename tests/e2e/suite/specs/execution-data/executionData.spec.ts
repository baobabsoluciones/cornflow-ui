/**
 * The data of a loaded execution: its input data, its results and the validations of what its
 * checks found, each table with the rows it has in the backend, and their downloads to Excel;
 * and the tables the data has without schema, where `showTablesWithoutSchema` shows them.
 * The executions are made solved through the API first (harness/executions.ts); the checks of the
 * input data run for real.
 */
import type { Page } from '@playwright/test'
import { test, expect } from '../../harness/fixtures'
import type { CornflowApi } from '../../harness/cornflowApi'
import {
  checkGroupTables,
  downloadTable,
  downloadView,
  expectedOnScreen,
  expectWorkbook,
  forEachTable,
  tableKeyOf,
  visibleTable,
  workbookRows,
} from '../../harness/executionData'
import { solvedExecution, type SolvedExecution } from '../../harness/executions'
import { loadFromHistoryRow, openHistory } from '../../harness/history'
import {
  executionViewCount,
  expectSelected,
  openExecutionView,
  type ExecutionGroup,
} from '../../harness/loadedExecutions'
import { readDataset, type Uat } from '../../harness/uat'

/** Loads `execution` from the history and waits until it is selected. */
async function load(page: Page, execution: SolvedExecution): Promise<void> {
  await openHistory(page)
  await loadFromHistoryRow(page, execution.name)
  await expectSelected(page, execution.id, execution.name)
}

/** What the checks found: the checks with rows, and their rows. */
function found(checks: Record<string, unknown>): Record<string, unknown[]> {
  return Object.fromEntries(
    Object.entries(checks).filter(
      ([, rows]) => Array.isArray(rows) && rows.length > 0,
    ),
  ) as Record<string, unknown[]>
}

/** An execution whose input data checks found something: the dataset with warnings, or errors. */
async function checkedExecution(
  api: CornflowApi,
  uat: Uat,
  schema: string,
): Promise<SolvedExecution> {
  const dataset = uat.schemas[schema]?.datasets.withWarnings
    ? 'withWarnings'
    : 'withErrors'
  return solvedExecution(api, uat, schema, 'validations', {
    dataset,
    withChecks: true,
  })
}

test.describe('data of a loaded execution', () => {
  let schema = ''

  test.beforeEach(({ deployment }) => {
    schema = deployment.schemas[0]
  })

  test('input data: every table shows its rows, and no validations without checks', async ({
    page,
    api,
    uat,
  }) => {
    const execution = await solvedExecution(api, uat, schema, 'input data')
    const instance = await api.instanceData(execution.instanceId)
    expect(Object.keys(found(instance.checks)), 'no checks ran').toHaveLength(0)
    await load(page, execution)

    const seen = await checkGroupTables(
      page,
      'input-data',
      expectedOnScreen(instance.data),
    )
    expect(seen.length, 'the input data show their tables').toBeGreaterThan(0)
  })

  test('results: every table shows its rows, and no validations without checks', async ({
    page,
    api,
    uat,
  }) => {
    const execution = await solvedExecution(api, uat, schema, 'results')
    const solution = await api.executionData(execution.id)
    test.skip(
      Object.keys(found(solution.checks)).length > 0,
      'the solution has checks: the results validations are the subject of their own test',
    )
    await load(page, execution)

    const seen = await checkGroupTables(
      page,
      'results',
      expectedOnScreen(solution.data),
    )
    expect(seen.length, 'the results show their tables').toBeGreaterThan(0)
    test.info().annotations.push({
      type: 'note',
      description:
        'the validations of the results are not tested with checks: an execution made ' +
        'for a test has no solution checks',
    })
  })

  test('validations: what the input data checks found, each with its rows, and to Excel', async ({
    page,
    api,
    uat,
  }) => {
    const execution = await checkedExecution(api, uat, schema)
    const instance = await api.instanceData(execution.instanceId)
    const checks = found(instance.checks)
    expect(
      Object.keys(checks),
      'the checks find something in the dataset with warnings or errors',
    ).not.toHaveLength(0)
    await load(page, execution)

    const seen = await checkGroupTables(page, 'input-data', {
      ...expectedOnScreen(instance.data),
      ...expectedOnScreen(checks),
    })
    for (const check of Object.keys(checks)) {
      expect(seen, `the validations show the check "${check}"`).toContain(check)
    }

    // The page of the validations downloads them, a sheet per check.
    const pages = await executionViewCount(page, 'input-data')
    let downloaded = false
    for (let index = 0; index < pages && !downloaded; index++) {
      await openExecutionView(page, 'input-data', index)
      await expect(visibleTable(page)).toBeVisible()
      if (!(tableKeyOf(page.url()) in checks)) continue
      expectWorkbook(
        await downloadView(page),
        // All the checks, as the app downloads them: those that found nothing too.
        workbookRows(instance.checks, await api.instanceChecksSchema(schema)),
        'validations',
      )
      downloaded = true
    }
    expect(
      downloaded,
      'the validations have a page to download them from',
    ).toBe(true)
  })

  test('every table downloads to Excel as it shows on screen', async ({
    page,
    api,
    uat,
  }) => {
    const execution = await solvedExecution(api, uat, schema, 'table excel')
    await load(page, execution)

    for (const group of ['input-data', 'results'] as ExecutionGroup[]) {
      await openExecutionView(page, group)
      const tabs = page.getByTestId('data-table-tabs').first().getByRole('tab')
      const count = Math.max(await tabs.count(), 1)
      for (let tab = 0; tab < count; tab++) {
        if (await tabs.count()) {
          await tabs.nth(tab).click()
          await expect(tabs.nth(tab)).toHaveAttribute('aria-selected', 'true')
        }
        const table = visibleTable(page)
        await expect(table).toHaveAttribute('data-status', 'ready')
        const key = tableKeyOf(page.url())
        const rows = Number(await table.getAttribute('data-rows'))
        const sheets = await downloadTable(page)
        expect(
          sheets.map((s) => s.name),
          `"${key}" downloads alone`,
        ).toEqual([key])
        expect(sheets[0].rows - 1, `"${key}" downloads its rows`).toBe(rows)
      }
    }
  })

  test('the input data and the results download whole to Excel, a sheet per table', async ({
    page,
    api,
    uat,
    deployment,
  }) => {
    test.skip(
      !!deployment.core.parameters?.useBackendExecutionFilesDownload,
      'useBackendExecutionFilesDownload is on: they download as the backend gives them (tested in the history)',
    )
    const execution = await solvedExecution(api, uat, schema, 'whole excel')
    const instance = await api.instanceData(execution.instanceId)
    const solution = await api.executionData(execution.id)
    await load(page, execution)

    await openExecutionView(page, 'input-data')
    expectWorkbook(
      await downloadView(page),
      workbookRows(instance.data, await api.instanceSchema(schema)),
      'input data',
    )

    await openExecutionView(page, 'results')
    expectWorkbook(
      await downloadView(page),
      workbookRows(solution.data, await api.solutionSchema(schema)),
      'results',
    )
  })

  test('a table the data has and its schema does not shows where showTablesWithoutSchema is on, and not where it is off', async ({
    page,
    api,
    uat,
    deployment,
  }) => {
    const on = !!deployment.core.parameters?.showTablesWithoutSchema
    const data = readDataset(uat, schema, 'valid')
    test.skip(!data, `the UAT file has no valid dataset for ${schema}`)
    const declared = (await api.instanceSchema(schema)).properties ?? {}
    const extra = 'e2e_extra'
    expect(declared[extra], `${schema} has no table ${extra}`).toBeUndefined()
    const label = 'without schema'
    let instanceId = ''
    try {
      instanceId = await api.createInstance({
        schema,
        data: {
          ...data,
          [extra]: [
            { code: 'A', amount: 1 },
            { code: 'B', amount: 2 },
          ],
        },
        label,
      })
    } catch (error) {
      test.skip(
        true,
        `the backend does not take data with a table its schema does not have: ${(error as Error).message}`,
      )
    }
    const id = await api.createExecution({
      instanceId,
      schema,
      config: uat.schemas[schema].config,
      label,
      run: false,
    })
    await openHistory(page)
    await loadFromHistoryRow(page, api.name(label))
    await expectSelected(page, id, api.name(label))

    const seen: string[] = []
    await forEachTable(page, 'input-data', async (key) => {
      seen.push(key)
      if (key === extra) {
        await expect(visibleTable(page), 'with its rows').toHaveAttribute(
          'data-rows',
          '2',
        )
      }
    })
    expect(
      seen.includes(extra),
      `showTablesWithoutSchema is ${on ? 'on: the table shows' : 'off: the table does not show'}`,
    ).toBe(on)
  })
})
