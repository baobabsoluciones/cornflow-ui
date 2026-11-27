/**
 * Editing the data of an execution before it is launched, as a user does on the create-execution
 * page: the tables of the data card, a tab per table, where cells are edited, rows added, deleted
 * and edited in bulk. The changes stay pending, counted on the table (`data-pending`), until they
 * are applied from the review of the changes or the execution is launched with them.
 *
 * A row is known by its place on screen, which is the order of the data until the user sorts the
 * table; a column by its key (`data-column`), the same in every language.
 */
import { expect, type Locator, type Page } from '@playwright/test'

/** A value to put in a cell: the one the data gets, and how the table shows it. */
export interface CellValue {
  raw: unknown
  shown: string
}

const dataCard = (page: Page) => page.getByTestId('data-card')

/** The table the data card shows: the one of the selected tab. */
export const reviewTable = (page: Page): Locator =>
  dataCard(page).locator('[data-testid="data-table"]:visible').first()

/** The tables the data card has a tab for, by key. */
export async function reviewTableKeys(page: Page): Promise<string[]> {
  const prefix = 'data-table-tab-'
  const ids = await dataCard(page)
    .locator(`[data-testid^="${prefix}"][role="tab"]`)
    .evaluateAll((tabs) => tabs.map((tab) => tab.getAttribute('data-testid')))
  return ids.map((id) => (id ?? '').slice(prefix.length))
}

/** Opens the tab of the table `key` and waits for it. Returns the table. */
export async function openReviewTable(
  page: Page,
  key: string,
): Promise<Locator> {
  const tab = dataCard(page).getByTestId(`data-table-tab-${key}`)
  await tab.click()
  await expect(tab).toHaveAttribute('aria-selected', 'true')
  const table = reviewTable(page)
  await expect(table).toHaveAttribute('data-status', 'ready')
  return table
}

/** The rows the grid draws, in their order on screen. Rows being added are not among them. */
export const gridRows = (table: Locator): Locator =>
  table.locator('tr[data-row-id]')

/** A cell of a row. */
export const cellOf = (row: Locator, key: string): Locator =>
  row.locator(`[role="gridcell"][data-column="${key}"]`)

/** The text a cell shows. */
export async function shownText(cell: Locator): Promise<string> {
  return (await cell.innerText()).trim()
}

/** The value of a cell as `CellValue`, given what the data has in it. */
export async function valueOf(
  row: Locator,
  key: string,
  raw: unknown,
): Promise<CellValue> {
  return { raw, shown: await shownText(cellOf(row, key)) }
}

/** Keys of the columns the user can edit in a row: neither read-only nor a switch. */
export async function editableColumns(row: Locator): Promise<string[]> {
  return row
    .locator('[role="gridcell"][data-column]')
    .evaluateAll((cells) =>
      cells
        .filter(
          (cell) =>
            cell.getAttribute('aria-readonly') !== 'true' &&
            !cell.querySelector('[role="switch"]'),
        )
        .map((cell) => cell.getAttribute('data-column') ?? ''),
    )
}

/** The changes still pending: every table's, as the table counts them. */
export async function pendingChanges(table: Locator): Promise<number> {
  return Number((await table.getAttribute('data-pending')) ?? 0)
}

/**
 * Puts `value` in the field inside `container` as the user would: picks it in a dropdown by what
 * it shows, sets a switch, or types it (numbers as shown, in the user's language; anything else
 * as the data has it, as its edit field starts).
 */
export async function fillField(
  container: Locator,
  value: CellValue,
): Promise<void> {
  const select = container.locator('select')
  const toggle = container.locator('[role="switch"]')
  if (await select.count()) {
    await select.selectOption({ label: value.shown })
  } else if (await toggle.count()) {
    const on = String(value.raw === true || value.raw === 'true')
    if ((await toggle.getAttribute('aria-checked')) !== on) await toggle.click()
  } else {
    await container
      .locator('input')
      .fill(typeof value.raw === 'number' ? value.shown : String(value.raw))
  }
}

/** Edits a cell: opens its editor, puts `value` in it and commits it. */
export async function editCell(
  row: Locator,
  key: string,
  value: CellValue,
): Promise<void> {
  const cell = cellOf(row, key)
  await cell.dblclick()
  const editor = cell.locator('input, select')
  await expect(editor, `the cell "${key}" can be edited`).toBeVisible()
  await fillField(cell, value)
  // A dropdown commits once picked; a text box with Enter.
  if (await cell.locator('input').count()) await editor.press('Enter')
  await expect(cell).not.toHaveClass(/\bis-editing\b/)
}

/** Ticks (or unticks) the rows at `indexes`. */
export async function toggleRows(
  table: Locator,
  indexes: number[],
): Promise<void> {
  for (const index of indexes) {
    await gridRows(table)
      .nth(index)
      .locator('[role="checkbox"], input[type="checkbox"]')
      .first()
      .click()
  }
}

/** Deletes the rows at `indexes`: they stay, marked deleted, until the changes are applied. */
export async function deleteRows(
  table: Locator,
  indexes: number[],
): Promise<void> {
  await toggleRows(table, indexes)
  await table.getByTestId('data-table-delete').click()
  for (const index of indexes) {
    await expect(gridRows(table).nth(index)).toHaveClass(/\bis-deleted\b/)
  }
}

/**
 * Edits the column `key` of the rows at `indexes` at once, and unticks them. Returns false, with
 * nothing changed, when the bulk edit does not offer that column (a reference is picked row by
 * row).
 */
export async function bulkEdit(
  page: Page,
  table: Locator,
  indexes: number[],
  key: string,
  value: CellValue,
): Promise<boolean> {
  await toggleRows(table, indexes)
  await table.getByTestId('data-table-bulk-edit').click()
  const apply = page.getByTestId('bulk-edit-apply')
  await expect(apply).toBeVisible()
  const field = page.getByTestId(`bulk-edit-field-${key}`)
  const offered = (await field.count()) > 0
  if (offered) {
    await fillField(field, value)
    await apply.click()
  } else {
    await page.keyboard.press('Escape')
  }
  await expect(apply).toBeHidden()
  await toggleRows(table, indexes)
  return offered
}

/**
 * Opens the row to fill in at the top of the grid. Returns the keys of the columns it takes a value
 * for: those that are not read-only.
 */
export async function openNewRow(table: Locator): Promise<string[]> {
  await table.getByTestId('data-table-add-row').click()
  return table
    .getByTestId('data-grid-add-row')
    .locator('td[data-column]')
    .evaluateAll((cells) =>
      cells
        .filter((cell) => cell.querySelector('input, select, [role="switch"]'))
        .map((cell) => cell.getAttribute('data-column') ?? ''),
    )
}

/**
 * Adds a row with `values`, by column key: opens the row to fill in when it is not open, fills it
 * and adds it. It goes at the end of the table, marked new.
 */
export async function addRow(
  table: Locator,
  values: Record<string, CellValue>,
): Promise<void> {
  const newRow = table.getByTestId('data-grid-add-row')
  if (!(await newRow.count()))
    await table.getByTestId('data-table-add-row').click()
  for (const [key, value] of Object.entries(values)) {
    await fillField(newRow.locator(`td[data-column="${key}"]`), value)
  }
  await table.getByTestId('data-table-add-confirm').click()
  await expect(newRow, 'the new row is added').toHaveCount(0)
  await expect(gridRows(table).last()).toHaveClass(/\bis-new\b/)
}

/** The review of the pending changes, opened from the table. */
export async function openPendingReview(
  page: Page,
  table: Locator,
): Promise<Locator> {
  await table.getByTestId('data-table-review').click()
  const panel = page.getByTestId('pending-changes-panel')
  await expect(panel).toBeVisible()
  return panel
}
