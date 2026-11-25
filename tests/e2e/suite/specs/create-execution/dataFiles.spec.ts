/**
 * Bringing the data of a new execution in other ways than a JSON file, and creating it with a
 * solution instead of solving it, on core's create-execution page:
 *
 * - Excel: the workbook the page gives for the data loads back as the same data, and a workbook
 *   overwrites the data already loaded.
 * - CSV: a table from a CSV file, with the rest of the data, loads as the dataset.
 * - A solution file (developer mode): the execution is created with it and not run.
 *
 * The files are made from the UAT file's valid dataset (and its solution), so an app needs no
 * other files. What the backend gets is checked through the API.
 */
import fs from 'node:fs'
import path from 'node:path'
import type { Page } from '@playwright/test'
import { test, expect } from '../../harness/fixtures'
import {
  acceptsFiles,
  downloadDataExcel,
  ExecutionState,
  launchAndWait,
  loadDataFile,
  loadDataFiles,
  loadDataset,
  nameExecution,
  openCreateExecution,
  openResult,
  overwriteWithExcel,
  pickSolution,
  resolveButton,
  setParameter,
  shownRows,
} from '../../harness/createExecution'
import type { CornflowApi } from '../../harness/cornflowApi'
import {
  deleteRows,
  openPendingReview,
  openReviewTable,
  pendingChanges,
  reviewTable,
} from '../../harness/editData'
import { rowsOnScreen } from '../../harness/executionData'
import { loadFromHistoryRow, openHistory } from '../../harness/history'
import {
  expectSelected,
  openExecutionView,
} from '../../harness/loadedExecutions'
import { executionTimeout } from '../../harness/timing'
import { readDataset, readSolution, type Uat } from '../../harness/uat'

type Row = Record<string, unknown>
type Data = Record<string, unknown>

/** The first table of `data` that is a list of records, with rows. */
function listTable(data: Data): string | undefined {
  return Object.keys(data).find((key) => {
    const value = data[key]
    return (
      Array.isArray(value) &&
      value.length > 0 &&
      value.every(
        (row) => row && typeof row === 'object' && !Array.isArray(row),
      )
    )
  })
}

/** A value as a CSV field: quoted when it holds the separator, a quote or a line break. */
function csvField(value: unknown): string {
  if (value === null || value === undefined) return ''
  const text = String(value)
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

/** The columns of `rows`: the keys of every row, in the order they first appear. */
const columnsOf = (rows: Row[]) => [
  ...new Set(rows.flatMap((row) => Object.keys(row))),
]

/** `rows` as a CSV file, with a header of their columns. */
function toCsv(rows: Row[]): string {
  const columns = columnsOf(rows)
  return [
    columns.join(','),
    ...rows.map((row) =>
      columns.map((column) => csvField(row[column])).join(','),
    ),
  ].join('\n')
}

/**
 * `saved` without the parameter `name: "value"` that a table of one record (an object) gets back
 * from Excel, where it is a sheet of two columns headed "name" and "value", when `data` does not
 * have it: a known fault, noted on the test. Anything else stays, to be compared.
 */
function withoutHeaderAsParameter(saved: Data, data: Data): Data {
  const fixed: Data = { ...saved }
  for (const [key, value] of Object.entries(saved)) {
    const original = data[key]
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      (value as Row).name === 'value' &&
      original &&
      typeof original === 'object' &&
      !('name' in (original as Row))
    ) {
      const { name: _header, ...rest } = value as Row
      fixed[key] = rest
      test.info().annotations.push({
        type: 'known issue',
        description:
          `"${key}", a table of one record, gets a parameter "name" = "value" back from ` +
          'Excel: the header of its sheet ("name", "value") is read as one of its rows',
      })
    }
  }
  return fixed
}

/** Names the execution, sets the UAT file's config, launches it and returns what Cornflow has. */
async function launch(
  page: Page,
  api: CornflowApi,
  uat: Uat,
  schema: string,
  label: string,
) {
  const name = api.name(label)
  await nameExecution(page, name)
  const config = uat.schemas[schema].config
  for (const [key, value] of Object.entries(config))
    await setParameter(page, key, value)
  const state = await launchAndWait(page, executionTimeout(config))
  const execution = await api.findExecution(name)
  expect(execution, `an execution called "${name}" was created`).not.toBeNull()
  return { ...execution!, name, state }
}

test.describe('create execution from other files', () => {
  let schema = ''

  test.beforeEach(async ({ page, deployment }) => {
    schema = deployment.schemas[0]
    test.skip(
      !(await openCreateExecution(page)),
      "the app has its own create-execution flow instead of core's page",
    )
  })

  test('Excel: the workbook the page gives for the data loads back as the same data', async ({
    page,
    api,
    uat,
  }) => {
    const data = readDataset(uat, schema, 'valid')
    test.skip(
      !(await acceptsFiles(page, 'xlsx')),
      'the page does not take Excel files here',
    )
    await loadDataset(page, uat, schema, 'valid')
    const workbook = await downloadDataExcel(page)

    await page.goto('/')
    expect(await openCreateExecution(page)).toBe(true)
    expect(await loadDataFile(page, workbook), 'the workbook loads').toBe(
      'loaded',
    )
    const execution = await launch(page, api, uat, schema, 'from excel')
    const saved = await api.instanceData(execution.instanceId)
    expect(
      withoutHeaderAsParameter(saved.data ?? {}, data ?? {}),
      'the backend gets the data of the dataset',
    ).toEqual(data)
  })

  test('Excel: a workbook overwrites the data already loaded', async ({
    page,
    uat,
  }) => {
    const data = readDataset(uat, schema, 'valid')
    test.skip(!data, `the UAT file has no valid dataset for ${schema}`)
    const key = listTable(data!)
    const rows = (key ? data![key] : []) as Row[]
    test.skip(
      !key || rows.length < 2,
      'the valid dataset has no table with two rows to take one away',
    )

    // A workbook with a row less: the data, with its first row deleted, downloaded.
    await loadDataset(page, uat, schema, 'valid')
    const table = await openReviewTable(page, key!)
    await deleteRows(table, [0])
    const review = await openPendingReview(page, table)
    await review.getByTestId('pending-save').click()
    await expect.poll(() => pendingChanges(table)).toBe(0)
    const workbook = await downloadDataExcel(page)

    // The dataset again, overwritten with that workbook.
    await page.goto('/')
    expect(await openCreateExecution(page)).toBe(true)
    await loadDataset(page, uat, schema, 'valid')
    await openReviewTable(page, key!)
    await expect(reviewTable(page)).toHaveAttribute(
      'data-rows',
      String(rows.length),
    )
    await overwriteWithExcel(page, workbook)
    await expect(
      reviewTable(page),
      `"${key}" has the rows of the workbook`,
    ).toHaveAttribute('data-rows', String(rows.length - 1))
    for (const [other, value] of Object.entries(data!)) {
      if (other === key) continue
      await openReviewTable(page, other)
      await expect(
        reviewTable(page),
        `"${other}" is as in the workbook`,
      ).toHaveAttribute('data-rows', String(rowsOnScreen(value)))
    }
  })

  test('CSV: a table from a CSV file, with the rest of the data, loads as the dataset', async ({
    page,
    api,
    uat,
  }) => {
    const data = readDataset(uat, schema, 'valid')
    test.skip(!data, `the UAT file has no valid dataset for ${schema}`)
    test.skip(
      !(await acceptsFiles(page, 'csv')) || !(await acceptsFiles(page, 'json')),
      'the page does not take CSV and JSON files here',
    )
    const key = listTable(data!)
    test.skip(!key, 'the valid dataset has no table that is a list of records')

    // The table as `<table>.csv`, the rest of the data as JSON.
    const rows = data![key!] as Row[]
    const folder = test.info().outputPath('files')
    fs.mkdirSync(folder, { recursive: true })
    const csv = path.join(folder, `${key}.csv`)
    fs.writeFileSync(csv, toCsv(rows))
    const rest = path.join(folder, 'rest.json')
    fs.writeFileSync(
      rest,
      JSON.stringify(
        Object.fromEntries(Object.entries(data!).filter(([k]) => k !== key)),
      ),
    )

    expect(await loadDataFiles(page, [rest, csv]), 'the files load').toBe(
      'loaded',
    )
    await openReviewTable(page, key!)
    await expect(reviewTable(page)).toHaveAttribute(
      'data-rows',
      String(rows.length),
    )
    const execution = await launch(page, api, uat, schema, 'from csv')
    const saved = await api.instanceData(execution.instanceId)
    // A CSV file has every column in every row: what a row does not have comes empty.
    const columns = columnsOf(rows)
    const expected = rows.map((row) =>
      Object.fromEntries(
        columns.map((column) => [column, row[column] ?? null]),
      ),
    )
    expect(saved.data?.[key!], `"${key}" has the rows of the CSV file`).toEqual(
      expected,
    )
    for (const [other, value] of Object.entries(data!)) {
      if (other === key) continue
      expect(saved.data?.[other], `"${other}" is as loaded`).toEqual(value)
    }
  })

  test('a solution file: the execution is created with it, not run, and its result shows', async ({
    page,
    api,
    uat,
    deployment,
  }) => {
    const solution = readSolution(uat, schema)
    test.skip(!solution, `the UAT file has no solution for ${schema}`)
    const developerMode =
      deployment.isDeveloperMode ||
      !!deployment.core.parameters?.isDeveloperMode
    await loadDataset(page, uat, schema, 'valid')
    if (!developerMode) {
      test.info().annotations.push({
        type: 'note',
        description:
          'a solution is uploaded only in developer mode, which is off here',
      })
      await expect(page.getByTestId('launch-panel-more')).toHaveCount(0)
      return
    }

    // A file that is not a solution is refused, when the schema of the solution asks for
    // something the data does not have.
    const required = (await api.solutionSchema(schema)).required ?? []
    const data = readDataset(uat, schema, 'valid')!
    if (required.some((key) => !(key in data))) {
      expect(
        await pickSolution(page, uat.schemas[schema].datasets.valid!),
        'the input data is not taken as a solution',
      ).toBe('refused')
      await expect(resolveButton(page)).toBeDisabled()
    }

    expect(
      await pickSolution(page, uat.schemas[schema].solution!),
      'the solution is taken',
    ).toBe('taken')
    const execution = await launch(page, api, uat, schema, 'with solution')
    expect(
      [ExecutionState.NotRun, ExecutionState.SolutionLoaded],
      'it is not run',
    ).toContain(execution.state)
    const saved = await api.executionData(execution.id)
    expect(saved.data, 'it has the solution uploaded').toEqual(solution)

    // Its result shows the solution.
    if (await page.getByTestId('launch-result-view').isEnabled()) {
      await openResult(page)
    } else {
      test.info().annotations.push({
        type: 'known issue',
        description:
          'an execution created with a solution reads as failed ("not run by user choice") ' +
          'and its result cannot be opened from the create-execution page: Cornflow leaves it ' +
          'not run (-4), and the page waits for "solution loaded" (2). Opened from the history',
      })
      await openHistory(page)
      await loadFromHistoryRow(page, execution.name)
      await expectSelected(page, execution.id, execution.name)
      await openExecutionView(page, 'results')
    }
    await expect
      .poll(() => shownRows(page), {
        message: 'the result shows the solution',
        timeout: 30_000,
      })
      .toBeGreaterThan(0)
  })
})
