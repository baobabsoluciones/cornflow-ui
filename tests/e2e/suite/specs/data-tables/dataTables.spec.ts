/**
 * The tools of the tables of data, on the input data of a loaded execution (each table holds the
 * rows of the instance, as the backend has them):
 *
 * - the search leaves the rows that have the text, and clearing it brings them all back;
 * - a column orders its rows up and down, and a third click leaves the order of the data;
 * - a filter of a column of numbers leaves the rows in its range, and removing it brings them all
 *   back;
 * - full screen fills the window, and goes back;
 * - the list of every table of the group finds one by its name and opens it, and in a narrow
 *   window the arrows move along the tabs.
 *
 * The columns used are picked from the schema (harness/dataTables.ts): a test whose data has none
 * that serves is skipped with the reason. The execution is made through the API, solved in a
 * moment (harness/executions.ts).
 */
import type { Locator, Page } from '@playwright/test'
import { test, expect } from '../../harness/fixtures'
import type { CornflowApi, JsonSchema } from '../../harness/cornflowApi'
import {
  addFilter,
  columnTitle,
  drawnColumn,
  drawnRows,
  expectShown,
  gridColumns,
  isNumber,
  isPlainText,
  rowProperties,
  searchTable,
  shownCount,
  sortedLikeTheApp,
  type Row,
} from '../../harness/dataTables'
import {
  forEachTable,
  tableKeyOf,
  visibleTable,
} from '../../harness/executionData'
import { solvedExecution } from '../../harness/executions'
import { loadFromHistoryRow, openHistory } from '../../harness/history'
import {
  executionViewCount,
  expectSelected,
  openExecutionView,
} from '../../harness/loadedExecutions'
import type { Uat } from '../../harness/uat'

/** The input data of a new execution, loaded, with its rows and the schema of its tables. */
async function loadInputData(
  page: Page,
  api: CornflowApi,
  uat: Uat,
  schema: string,
  label: string,
): Promise<{ data: Record<string, unknown>; tables: JsonSchema }> {
  const execution = await solvedExecution(api, uat, schema, label)
  const data = (await api.instanceData(execution.instanceId)).data ?? {}
  const tables = await api.instanceSchema(schema)
  await openHistory(page)
  await loadFromHistoryRow(page, execution.name)
  await expectSelected(page, execution.id, execution.name)
  return { data, tables }
}

/** The rows of a table of the data, when it is a list of them. */
const rowsOf = (data: Record<string, unknown>, key: string): Row[] =>
  Array.isArray(data[key]) ? (data[key] as Row[]) : []

/** The columns of the table on screen whose schema `fits`. */
async function columnsThat(
  table: Locator,
  tables: JsonSchema,
  key: string,
  fits: (property: JsonSchema) => boolean,
): Promise<string[]> {
  const properties = rowProperties(tables, key)
  return (await gridColumns(table)).filter(
    (column) => properties[column] && fits(properties[column]),
  )
}

const text = (value: unknown) =>
  value === null || value === undefined ? '' : String(value)

test.describe('tools of the data tables', () => {
  let schema = ''

  test.beforeEach(({ deployment }) => {
    schema = deployment.schemas[0]
  })

  test('the search leaves the rows that have the text, and clearing it brings them all back', async ({
    page,
    api,
    uat,
  }) => {
    const { data, tables } = await loadInputData(
      page,
      api,
      uat,
      schema,
      'search',
    )
    let searched = false

    await forEachTable(page, 'input-data', async (key) => {
      if (searched) return
      const rows = rowsOf(data, key)
      const table = visibleTable(page)
      const columns = await columnsThat(table, tables, key, isPlainText)
      // A text some rows have in a column and others do not.
      const found = columns
        .flatMap((column) =>
          rows.map((row) => ({ column, value: text(row[column]) })),
        )
        .find(
          ({ column, value }) =>
            value.trim().length >= 2 &&
            rows.some(
              (row) =>
                !text(row[column]).toLowerCase().includes(value.toLowerCase()),
            ),
        )
      if (!found) return
      searched = true
      const wanted = found.value.toLowerCase()

      await test.step(`"${found.value}" in ${key}`, async () => {
        await expect(table).toHaveAttribute('data-rows', String(rows.length))
        // Rows with it in a column of text; other columns, shown formatted, may add to them.
        const atLeast = rows.filter((row) =>
          columns.some((column) =>
            text(row[column]).toLowerCase().includes(wanted),
          ),
        ).length
        await searchTable(table, found.value)
        await expect
          .poll(
            async () =>
              (await shownCount(table)) < rows.length ||
              (await drawnRows(table)).every((row) => row.includes(wanted)),
            { message: 'the search is applied' },
          )
          .toBe(true)
        const shown = await shownCount(table)
        expect(
          shown,
          'it leaves at least the rows with the text',
        ).toBeGreaterThanOrEqual(atLeast)
        expect(
          (await drawnRows(table)).every((row) => row.includes(wanted)),
          'every row it shows has the text',
        ).toBe(true)

        await searchTable(table, '')
        await expectShown(
          table,
          rows.length,
          'clearing it brings every row back',
        )
      })
    })
    test.skip(
      !searched,
      'no table of the input data has a column of text to search',
    )
  })

  test('a column orders its rows up and down, and a third click leaves the order of the data', async ({
    page,
    api,
    uat,
  }) => {
    const { data, tables } = await loadInputData(page, api, uat, schema, 'sort')
    let sorted = false

    await forEachTable(page, 'input-data', async (key) => {
      if (sorted) return
      const rows = rowsOf(data, key)
      const table = visibleTable(page)
      const column = (await columnsThat(table, tables, key, isPlainText)).find(
        (column) =>
          rows.every((row) => text(row[column]) !== '') &&
          new Set(rows.map((row) => text(row[column]))).size > 1,
      )
      if (!column) return
      sorted = true
      const values = rows.map((row) => text(row[column]))
      const header = table
        .locator('th')
        .filter({ has: page.getByTestId(`data-grid-sort-${column}`) })
      const sortButton = table.getByTestId(`data-grid-sort-${column}`)
      const expectOrder = async (expected: string[], message: string) => {
        await expect
          .poll(
            async () => {
              const drawn = await drawnColumn(table, column)
              return (
                drawn.length > 0 &&
                drawn.every((cell, i) => cell === expected[i])
              )
            },
            { message },
          )
          .toBe(true)
      }

      await test.step(`${column} of ${key}`, async () => {
        await sortButton.click()
        await expect(header).toHaveAttribute('aria-sort', 'ascending')
        await expectOrder(await sortedLikeTheApp(page, values, 'asc'), 'up')

        await sortButton.click()
        await expect(header).toHaveAttribute('aria-sort', 'descending')
        await expectOrder(await sortedLikeTheApp(page, values, 'desc'), 'down')

        await sortButton.click()
        await expect(header).toHaveAttribute('aria-sort', 'none')
        await expectOrder(values, 'in the order of the data')
      })
    })
    test.skip(
      !sorted,
      'no table of the input data has a column of text with different values',
    )
  })

  test('a filter of a column of numbers leaves the rows in its range, and removing it brings them all back', async ({
    page,
    api,
    uat,
  }) => {
    const { data, tables } = await loadInputData(
      page,
      api,
      uat,
      schema,
      'filter',
    )
    let filtered = false

    await forEachTable(page, 'input-data', async (key) => {
      if (filtered) return
      const rows = rowsOf(data, key)
      const table = visibleTable(page)
      if (!(await table.getByTestId('data-table-add-filter').count())) return
      const column = (await columnsThat(table, tables, key, isNumber)).find(
        (column) =>
          rows.every((row) => typeof row[column] === 'number') &&
          new Set(rows.map((row) => row[column])).size > 1,
      )
      if (!column) return
      filtered = true
      const distinct = [
        ...new Set(rows.map((row) => row[column] as number)),
      ].sort((a, b) => a - b)
      // From a value in the middle: the smallest are left out.
      const from = distinct[Math.floor(distinct.length / 2)]
      const expected = rows.filter(
        (row) => (row[column] as number) >= from,
      ).length

      await test.step(`${column} of ${key} from ${from}`, async () => {
        await addFilter(page, table, await columnTitle(table, column))
        await page.getByTestId('condition-filter-from').fill(String(from))
        await page.getByTestId('condition-filter-apply').click()
        await expectShown(
          table,
          expected,
          `the rows with ${column} from ${from}`,
        )

        await table
          .getByTestId('condition-filter-chip')
          .getByTestId('filter-chip-remove')
          .click()
        await expectShown(
          table,
          rows.length,
          'removing it brings every row back',
        )
      })
    })
    test.skip(
      !filtered,
      'no table of the input data has a column of numbers to filter',
    )
  })

  test('full screen fills the window, and goes back', async ({
    page,
    api,
    uat,
  }) => {
    await loadInputData(page, api, uat, schema, 'full screen')
    await openExecutionView(page, 'input-data', 0)
    const table = visibleTable(page)
    await expect(table).toBeVisible()
    const viewport = page.viewportSize()!
    const before = (await table.boundingBox())!

    await table.getByTestId('data-table-fullscreen').click()
    await expect
      .poll(async () => (await table.boundingBox())?.width ?? 0, {
        message: 'it fills the width of the window',
      })
      .toBeGreaterThan(viewport.width * 0.85)
    const full = (await table.boundingBox())!
    expect(full.height, 'and its height').toBeGreaterThan(
      viewport.height * 0.75,
    )

    await table.getByTestId('data-table-fullscreen').click()
    await expect
      .poll(async () => (await table.boundingBox())?.width ?? 0, {
        message: 'it goes back to its place',
      })
      .toBeCloseTo(before.width, 0)
  })

  test('the list of every table finds one by its name and opens it; in a narrow window the arrows move along the tabs', async ({
    page,
    api,
    uat,
  }) => {
    await loadInputData(page, api, uat, schema, 'tabs')
    // The first page of the input data with several tables, as tabs: it stays open.
    const strip = page.getByTestId('data-table-tabs').first()
    let tabs: { key: string; label: string }[] = []
    const pages = await executionViewCount(page, 'input-data')
    for (let index = 0; index < pages && tabs.length < 2; index++) {
      await openExecutionView(page, 'input-data', index)
      await page.waitForLoadState('networkidle')
      if (!(await strip.count())) continue
      tabs = await strip.getByRole('tab').evaluateAll((all) =>
        all.map((tab) => ({
          key: tab.getAttribute('data-tab') ?? '',
          label: tab.getAttribute('data-label') ?? '',
        })),
      )
    }
    test.skip(tabs.length < 2, 'no page of the input data has several tables')
    await strip.getByTestId(`data-table-tab-${tabs[0].key}`).click()

    await test.step('the list of every table', async () => {
      const target = tabs.at(-1)!
      await strip.getByTestId('data-table-tabs-all').click()
      for (const tab of tabs) {
        await expect(
          page.getByTestId(`data-table-tabs-menu-${tab.key}`),
        ).toBeVisible()
      }
      await page.getByTestId('data-table-tabs-search').fill(target.label)
      await expect(
        page.getByTestId(`data-table-tabs-menu-${target.key}`),
      ).toBeVisible()
      for (const tab of tabs.filter(
        (tab) => !tab.label.toLowerCase().includes(target.label.toLowerCase()),
      )) {
        await expect(
          page.getByTestId(`data-table-tabs-menu-${tab.key}`),
          `${tab.label} is not found by "${target.label}"`,
        ).toHaveCount(0)
      }
      await page.getByTestId(`data-table-tabs-menu-${target.key}`).click()
      await expect(
        strip.getByTestId(`data-table-tab-${target.key}`),
      ).toHaveAttribute('aria-selected', 'true')
      await expect
        .poll(() => tableKeyOf(page.url()), { message: 'it opens' })
        .toBe(target.key)
    })

    await test.step('the arrows, in a narrow window', async () => {
      await page.setViewportSize({ width: 420, height: 760 })
      const previous = strip.getByTestId('data-table-tabs-previous')
      const next = strip.getByTestId('data-table-tabs-next')
      if (!(await next.count())) {
        test.info().annotations.push({
          type: 'note',
          description: 'the tabs fit even in a narrow window: no arrows to try',
        })
        return
      }
      await strip.getByTestId(`data-table-tab-${tabs[0].key}`).click()
      await expect(previous, 'at the start, no going back').toBeDisabled()
      await expect(next).toBeEnabled()
      await next.click()
      await expect(previous, 'once moved, it goes back').toBeEnabled()
    })
  })
})
