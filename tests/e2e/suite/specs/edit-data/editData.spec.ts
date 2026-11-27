/**
 * Editing the data of an execution, as core lets a user do it: on the create-execution page,
 * before launching. The valid dataset of the UAT file is loaded and edited: a cell, rows in bulk,
 * a row deleted, a row added and a parameter; the review lists the changes and undoes them; they
 * are applied, or launched with, and the data the backend gets has them. What is edited is chosen
 * from the dataset itself, with values it already has, so that any app's schema takes them.
 *
 * The data of an execution already made is not edited in core: editing it to solve it again is
 * the recalculation module's, turned on with `enableSolutionRecalculation`. Without it, those
 * pages only show the data.
 */
import type { Locator, Page } from '@playwright/test'
import { test, expect } from '../../harness/fixtures'
import type { JsonSchema } from '../../harness/cornflowApi'
import {
  launchAndWait,
  loadDataset,
  nameExecution,
  openCreateExecution,
  setParameter,
} from '../../harness/createExecution'
import {
  addRow,
  bulkEdit,
  cellOf,
  deleteRows,
  editableColumns,
  editCell,
  gridRows,
  openNewRow,
  openPendingReview,
  openReviewTable,
  pendingChanges,
  reviewTable,
  reviewTableKeys,
  shownText,
  valueOf,
  type CellValue,
} from '../../harness/editData'
import { visibleTable } from '../../harness/executionData'
import { solvedExecution } from '../../harness/executions'
import { loadFromHistoryRow, openHistory } from '../../harness/history'
import {
  expectSelected,
  openExecutionView,
  type ExecutionGroup,
} from '../../harness/loadedExecutions'
import { executionTimeout } from '../../harness/timing'
import { readDataset, type Uat } from '../../harness/uat'

type Row = Record<string, unknown>
type Data = Record<string, unknown>

/** Rows the edits need: one to edit, two to edit in bulk, one to delete. */
const ROWS_NEEDED = 4

const isEmpty = (value: unknown) =>
  value === null || value === undefined || value === ''

/** A table of the data to edit, and the column whose cells are edited. */
interface EditTarget {
  key: string
  table: Locator
  rows: Row[]
  column: string
  /** A row whose value in `column` row 0 does not have: what row 0 is changed to. */
  forFirst: number
  /** A row whose value rows 1 and 2 are changed to in bulk. */
  forBulk: number
}

/**
 * The first table of the data card the edits can be made on: a list with enough rows, whose
 * column, editable, has different values among the rows the grid draws. Number columns are
 * preferred. Null when there is none.
 */
async function editTarget(page: Page, data: Data): Promise<EditTarget | null> {
  for (const key of await reviewTableKeys(page)) {
    const rows = data[key]
    if (!Array.isArray(rows) || rows.length < ROWS_NEEDED) continue
    const table = await openReviewTable(page, key)
    if (!(await table.getByTestId('data-table-add-row').count())) continue
    const drawn = Math.min(await gridRows(table).count(), rows.length)
    if (drawn < ROWS_NEEDED) continue

    const columns = await editableColumns(gridRows(table).first())
    const numeric = (column: string) =>
      rows.slice(0, drawn).every((row) => typeof row[column] === 'number')
    const candidates = [
      ...columns.filter(numeric),
      ...columns.filter((column) => !numeric(column)),
    ]
    for (const column of candidates) {
      const value = (index: number) => JSON.stringify(rows[index][column])
      const indexes = [...Array(drawn).keys()].filter(
        (index) => !isEmpty(rows[index][column]),
      )
      const forFirst = indexes.find((index) => value(index) !== value(0))
      const forBulk =
        indexes.find(
          (index) => value(index) !== value(1) && value(index) !== value(2),
        ) ?? indexes.find((index) => value(index) !== value(1))
      if (forFirst !== undefined && forBulk !== undefined)
        return { key, table, rows, column, forFirst, forBulk }
    }
  }
  return null
}

/** A parameter of a table of one record (an object), and the value it is changed to. */
interface ParameterEdit {
  key: string
  parameter: string
  value: boolean | number
}

/** Whether a property of the schema takes only some values: a list, a constant or multiples. */
const restricted = (property: JsonSchema) =>
  'enum' in property || 'const' in property || 'multipleOf' in property

/**
 * A parameter of the data that can be changed to another value the schema takes: a yes/no, or a
 * whole number within its bounds, neither of them restricted to some values. Null when the data
 * has none the page lets the user edit.
 */
async function parameterEdit(
  page: Page,
  data: Data,
  schema: JsonSchema,
): Promise<ParameterEdit | null> {
  for (const key of await reviewTableKeys(page)) {
    const record = data[key]
    if (!record || typeof record !== 'object' || Array.isArray(record)) continue
    await openReviewTable(page, key)
    const properties = schema.properties?.[key]?.properties ?? {}
    for (const [parameter, current] of Object.entries(record)) {
      const field = reviewTable(page).getByTestId(
        `parameter-${parameter}-value`,
      )
      if (!(await field.count()) || !(await field.isEnabled())) continue
      const property = properties[parameter] ?? {}
      if (restricted(property)) continue
      if (typeof current === 'boolean')
        return { key, parameter, value: !current }
      if (Number.isInteger(current)) {
        const { minimum, maximum, exclusiveMinimum, exclusiveMaximum } =
          property as Record<string, number | undefined>
        const takes = (value: number) =>
          (minimum === undefined || value >= minimum) &&
          (maximum === undefined || value <= maximum) &&
          (exclusiveMinimum === undefined || value > exclusiveMinimum) &&
          (exclusiveMaximum === undefined || value < exclusiveMaximum)
        const other = [(current as number) + 1, (current as number) - 1].find(
          takes,
        )
        if (other !== undefined) return { key, parameter, value: other }
      }
    }
  }
  return null
}

/** Sets a parameter of the data as the user does: picks yes or no, or types the number. */
async function editParameter(page: Page, edit: ParameterEdit): Promise<void> {
  await openReviewTable(page, edit.key)
  const field = reviewTable(page).getByTestId(
    `parameter-${edit.parameter}-value`,
  )
  if (typeof edit.value === 'boolean') {
    // The dropdown shows yes or no: the one that is not picked is the other value.
    const other = await field.evaluate((select) => {
      const options = [...(select as HTMLSelectElement).options]
      return options.find((option) => option.value !== '' && !option.selected)
        ?.value
    })
    await field.selectOption(other!)
  } else {
    await field.fill(String(edit.value))
    await field.press('Enter')
  }
  await expect(
    reviewTable(page).getByTestId(`parameter-${edit.parameter}-revert`),
    `the parameter "${edit.parameter}" shows as changed`,
  ).toBeVisible()
}

/**
 * A row of the grid whose values in `columns` are all there, to copy into a new one. Not one of
 * the first three, whose cells the test edits: the grid shows them changed. The deleted one, the
 * fourth, still shows its values, and is the last choice. Null when there is none.
 */
function rowToCopy(
  rows: Row[],
  drawn: number,
  columns: string[],
): number | null {
  const order = [
    ...Array.from(
      { length: Math.max(drawn - ROWS_NEEDED, 0) },
      (_, i) => i + ROWS_NEEDED,
    ),
    ROWS_NEEDED - 1,
  ]
  return (
    order.find((index) =>
      columns.every((column) => !isEmpty(rows[index][column])),
    ) ?? null
  )
}

/** Loads the valid dataset and opens the table to edit; skips when there is nothing to edit. */
async function startEditing(
  page: Page,
  data: Data | null,
  uat: Uat,
  schema: string,
): Promise<EditTarget> {
  test.skip(!data, `the UAT file has no valid dataset for ${schema}`)
  await loadDataset(page, uat, schema, 'valid')
  const target = await editTarget(page, data!)
  test.skip(
    !target,
    `the valid dataset has no table with ${ROWS_NEEDED} rows and an editable column of ` +
      'different values to edit',
  )
  await openReviewTable(page, target!.key)
  return target!
}

test.describe('editing the data of an execution', () => {
  let schema = ''

  test.beforeEach(({ deployment }) => {
    schema = deployment.schemas[0]
  })

  test.describe('on the create-execution page', () => {
    test.beforeEach(async ({ page }) => {
      test.skip(
        !(await openCreateExecution(page)),
        "the app has its own create-execution flow instead of core's page",
      )
    })

    test('a cell, rows in bulk, a deleted row, a new row and a parameter reach the backend', async ({
      page,
      api,
      uat,
    }) => {
      const data = readDataset(uat, schema, 'valid')
      const target = await startEditing(page, data, uat, schema)
      const { key, table, rows, column } = target
      const grid = gridRows(table)
      const name = api.name('edited')
      await nameExecution(page, name)
      const config = uat.schemas[schema].config
      for (const [parameter, value] of Object.entries(config))
        await setParameter(page, parameter, value)

      // What the edits put, read before any of them changes what the grid shows.
      const forFirst = await valueOf(
        grid.nth(target.forFirst),
        column,
        rows[target.forFirst][column],
      )
      const forBulk = await valueOf(
        grid.nth(target.forBulk),
        column,
        rows[target.forBulk][column],
      )
      const ids = await Promise.all(
        [0, 1, 2, 3].map((index) =>
          grid.nth(index).getAttribute('data-row-id'),
        ),
      )

      await editCell(grid.nth(0), column, forFirst)
      await expect(cellOf(grid.nth(0), column)).toHaveClass(/\bis-modified\b/)
      await expect(cellOf(grid.nth(0), column)).toHaveText(forFirst.shown)
      expect(await pendingChanges(table), 'one change is pending').toBe(1)

      const bulk = await bulkEdit(page, table, [1, 2], column, forBulk)
      if (bulk) {
        for (const index of [1, 2])
          await expect(cellOf(grid.nth(index), column)).toHaveText(
            forBulk.shown,
          )
      } else {
        test.info().annotations.push({
          type: 'note',
          description: `the bulk edit does not offer "${column}" of "${key}" (a reference)`,
        })
      }
      await deleteRows(table, [3])

      const drawn = Math.min(await grid.count(), rows.length)
      const newColumns = await openNewRow(table)
      const source = rowToCopy(rows, drawn, newColumns)
      const added: Row = {}
      if (source === null) {
        test.info().annotations.push({
          type: 'note',
          description: `no row of "${key}" has every column filled in to copy into a new one`,
        })
        await table
          .getByTestId('data-grid-add-row')
          .locator('input, select')
          .first()
          .press('Escape')
      } else {
        const values: Record<string, CellValue> = {}
        for (const newColumn of newColumns) {
          values[newColumn] = await valueOf(
            grid.nth(source),
            newColumn,
            rows[source][newColumn],
          )
          added[newColumn] = rows[source][newColumn]
        }
        await addRow(table, values)
      }

      const instanceSchema = await api.instanceSchema(schema)
      const parameter = await parameterEdit(page, data!, instanceSchema)
      if (parameter) await editParameter(page, parameter)
      else
        test.info().annotations.push({
          type: 'note',
          description:
            'the data has no parameter (a yes/no or a whole number) to edit',
        })

      // The review lists every change, by row.
      const reviewed = await openReviewTable(page, key)
      const panel = await openPendingReview(page, reviewed)
      await expect(
        panel.getByTestId(`pending-revert-field-${ids[0]}-${column}`),
      ).toBeVisible()
      await expect(
        panel.getByTestId(`pending-revert-row-${ids[3]}`),
      ).toBeVisible()
      await page.getByTestId('pending-close').click()
      await expect(panel).toBeHidden()

      // Launching applies the pending changes: the backend gets the data with them.
      await launchAndWait(page, executionTimeout(config))
      const execution = await api.findExecution(name)
      expect(
        execution,
        `an execution called "${name}" was created`,
      ).not.toBeNull()
      const saved = (await api.instanceData(execution!.instanceId)).data ?? {}

      const expected = rows.map((row) => ({ ...row }))
      expected[0][column] = forFirst.raw
      if (bulk) {
        expected[1][column] = forBulk.raw
        expected[2][column] = forBulk.raw
      }
      expected.splice(3, 1)
      if (source !== null) expected.push(added)
      expect(saved[key], `"${key}" has the edits`).toEqual(expected)
      if (parameter) {
        expect(saved[parameter.key], `"${parameter.key}" has the edit`).toEqual(
          {
            ...(data![parameter.key] as Row),
            [parameter.parameter]: parameter.value,
          },
        )
      }
      for (const [other, value] of Object.entries(data!)) {
        if (other === key || other === parameter?.key || !Array.isArray(value))
          continue
        expect(saved[other], `"${other}" is as loaded`).toEqual(value)
      }
    })

    test('the review undoes a change, a row, a table and every change', async ({
      page,
      uat,
    }) => {
      const data = readDataset(uat, schema, 'valid')
      const target = await startEditing(page, data, uat, schema)
      const { key, table, rows, column } = target
      const grid = gridRows(table)
      const ids = await Promise.all(
        [0, 1, 2, 3].map((index) =>
          grid.nth(index).getAttribute('data-row-id'),
        ),
      )
      const before = await Promise.all(
        [0, 1].map((index) => shownText(cellOf(grid.nth(index), column))),
      )
      const forFirst = await valueOf(
        grid.nth(target.forFirst),
        column,
        rows[target.forFirst][column],
      )
      const forSecond = await valueOf(
        grid.nth(target.forBulk),
        column,
        rows[target.forBulk][column],
      )

      await editCell(grid.nth(0), column, forFirst)
      await editCell(grid.nth(1), column, forSecond)
      await deleteRows(table, [3])
      expect(await pendingChanges(table)).toBe(3)
      const panel = await openPendingReview(page, table)

      // A change: the cell is back as it was.
      await panel
        .getByTestId(`pending-revert-field-${ids[0]}-${column}`)
        .click()
      await expect(cellOf(grid.nth(0), column)).toHaveText(before[0])
      await expect(cellOf(grid.nth(0), column)).not.toHaveClass(
        /\bis-modified\b/,
      )
      expect(await pendingChanges(table)).toBe(2)

      // A row: the deleted one is back.
      await panel.getByTestId(`pending-revert-row-${ids[3]}`).click()
      await expect(grid.nth(3)).not.toHaveClass(/\bis-deleted\b/)
      expect(await pendingChanges(table)).toBe(1)

      // A table: what is left of it.
      await panel.getByTestId(`pending-revert-table-${key}`).click()
      await expect(cellOf(grid.nth(1), column)).toHaveText(before[1])
      await expect.poll(() => pendingChanges(table)).toBe(0)
      await expect(table.getByTestId('data-table-review')).toBeHidden()
      await page.getByTestId('pending-close').click()
      await expect(panel).toBeHidden()

      // Every change, once confirmed.
      await editCell(grid.nth(0), column, forFirst)
      await deleteRows(table, [3])
      const again = await openPendingReview(page, table)
      await again.getByTestId('pending-revert-all').click()
      await again.getByTestId('pending-revert-all-confirm').click()
      await expect.poll(() => pendingChanges(table)).toBe(0)
      await expect(cellOf(grid.nth(0), column)).toHaveText(before[0])
      await expect(grid.nth(3)).not.toHaveClass(/\bis-deleted\b/)
    })

    test('applying the changes puts them in the data, and a value the schema rejects is not applied', async ({
      page,
      api,
      uat,
    }) => {
      const data = readDataset(uat, schema, 'valid')
      const target = await startEditing(page, data, uat, schema)
      const { key, table, rows, column } = target
      const grid = gridRows(table)
      const forFirst = await valueOf(
        grid.nth(target.forFirst),
        column,
        rows[target.forFirst][column],
      )
      const total = Number(await table.getAttribute('data-rows'))

      await editCell(grid.nth(0), column, forFirst)
      await deleteRows(table, [3])
      let panel = await openPendingReview(page, table)
      await panel.getByTestId('pending-save').click()
      await expect.poll(() => pendingChanges(table)).toBe(0)
      await expect(table, 'the deleted row is gone').toHaveAttribute(
        'data-rows',
        String(total - 1),
      )
      await expect(cellOf(grid.nth(0), column)).toHaveText(forFirst.shown)
      await expect(cellOf(grid.nth(0), column)).not.toHaveClass(
        /\bis-modified\b/,
      )

      // A number past a bound of its column, in the edited table: one the schema rejects.
      const properties =
        (await api.instanceSchema(schema)).properties?.[key]?.items
          ?.properties ?? {}
      const pastBound = (property: JsonSchema): number | undefined => {
        if (restricted(property)) return undefined
        const bound = (name: string) =>
          typeof property[name] === 'number'
            ? (property[name] as number)
            : undefined
        const below = bound('minimum') ?? bound('exclusiveMinimum')
        const above = bound('maximum') ?? bound('exclusiveMaximum')
        if (below !== undefined) return Math.floor(below) - 1
        if (above !== undefined) return Math.ceil(above) + 1
        return undefined
      }
      const bounded = (await editableColumns(grid.first()))
        .map((name) => ({ name, wrong: pastBound(properties[name] ?? {}) }))
        .find(({ wrong }) => wrong !== undefined)
      test.skip(
        !bounded,
        `no editable column of "${key}" has a minimum or a maximum to break`,
      )
      const wrong = bounded!.wrong as number
      await editCell(grid.nth(1), bounded!.name, {
        raw: wrong,
        shown: String(wrong),
      })
      panel = await openPendingReview(page, table)
      await panel.getByTestId('pending-save').click()
      await expect(
        panel.getByTestId('pending-validation'),
        'the review says why the data is not valid',
      ).toBeVisible()
      expect(await pendingChanges(table), 'the change is still pending').toBe(1)
      await expect(cellOf(grid.nth(1), bounded!.name)).toHaveClass(
        /\bis-modified\b/,
      )
    })
  })

  test('the data of an execution already made only shows, without solution recalculation', async ({
    page,
    api,
    uat,
    deployment,
  }) => {
    test.skip(
      deployment.core.parameters?.enableSolutionRecalculation === true,
      'enableSolutionRecalculation lets the data of an execution made be edited, to solve it ' +
        'again with the recalculation module: its own suite tests it',
    )
    const execution = await solvedExecution(api, uat, schema, 'read only')
    await openHistory(page)
    await loadFromHistoryRow(page, execution.name)
    await expectSelected(page, execution.id, execution.name)

    for (const group of ['input-data', 'results'] as ExecutionGroup[]) {
      await openExecutionView(page, group)
      const table = visibleTable(page)
      await expect(table).toHaveAttribute('data-status', 'ready')
      await expect(table.getByTestId('data-table-add-row')).toHaveCount(0)
      await expect(table.getByTestId('data-grid-select-all')).toHaveCount(0)
      const cell = table.locator('[role="gridcell"]').first()
      if (await cell.count()) {
        await cell.dblclick()
        await expect(
          cell.locator('input, select'),
          `a cell of the ${group} does not open an editor`,
        ).toHaveCount(0)
      }
    }
  })
})
