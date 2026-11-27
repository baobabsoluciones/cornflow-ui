/**
 * The tools of a table of data, as the user has them: the search, the order of a column, the
 * filters, full screen, and the list of every table of its group.
 *
 * What a table holds is read from its attributes: `data-rows`, every row it has, and `data-shown`,
 * those the search and the filters leave. Its grid only draws the rows in view, each
 * `[data-row-id]` with a cell per column (`[data-column]`).
 *
 * The columns used are picked from the schema of the DAG, so any app's tables serve: text the user
 * types freely (no format, no list of values, no reference to another table) to search and sort,
 * and numbers to filter.
 */
import { expect, type Locator, type Page } from '@playwright/test'
import type { JsonSchema } from './cornflowApi'

export type Row = Record<string, unknown>

/** The properties of the rows of a table, as the schema has them. */
export function rowProperties(
  schema: JsonSchema,
  table: string,
): Record<string, JsonSchema> {
  return schema.properties?.[table]?.items?.properties ?? {}
}

const typeIs = (property: JsonSchema, ...types: string[]) =>
  (Array.isArray(property.type) ? property.type : [property.type]).some(
    (type) => typeof type === 'string' && types.includes(type),
  )

/** What makes a column of a reference, a list or a switch rather than what it holds. */
const SPECIAL = [
  'format',
  'enum',
  'join_from',
  'joinFrom',
  'is_dependent_field',
  'is_main_selector',
  'foreign_key',
  'render_as_switch',
]
const isSpecial = (property: JsonSchema) =>
  SPECIAL.some((key) => property[key] !== undefined)

/** A column of free text: shown as it is, searched and sorted as text. */
export const isPlainText = (property: JsonSchema): boolean =>
  typeIs(property, 'string') && !isSpecial(property)

/** A column of numbers: filtered by a range. */
export const isNumber = (property: JsonSchema): boolean =>
  typeIs(property, 'number', 'integer') && !isSpecial(property)

/** The columns the grid of `table` shows, by key, in their order. */
export function gridColumns(table: Locator): Promise<string[]> {
  return table
    .locator('[data-testid^="data-grid-sort-"]')
    .evaluateAll((buttons) =>
      buttons.map((button) =>
        button.getAttribute('data-testid')!.slice('data-grid-sort-'.length),
      ),
    )
}

/** The title of a column, as its header shows it. */
export async function columnTitle(
  table: Locator,
  key: string,
): Promise<string> {
  return (await table.getByTestId(`data-grid-sort-${key}`).innerText()).trim()
}

/** How many rows the table shows with its search and filters. */
export async function shownCount(table: Locator): Promise<number> {
  return Number(await table.getAttribute('data-shown'))
}

/** The text of the cells of `key` in the rows drawn, top to bottom. */
export function drawnColumn(table: Locator, key: string): Promise<string[]> {
  return table
    .locator(`[data-row-id] [data-column="${key}"]`)
    .evaluateAll((cells) =>
      cells.map((cell) => (cell as HTMLElement).innerText.trim()),
    )
}

/** The text of each row drawn, every cell together. */
export function drawnRows(table: Locator): Promise<string[]> {
  return table
    .locator('[data-row-id]')
    .evaluateAll((rows) =>
      rows.map((row) => (row as HTMLElement).innerText.toLowerCase()),
    )
}

/** Types in the search of the table, as the user does. */
export async function searchTable(table: Locator, text: string): Promise<void> {
  await table.getByTestId('data-table-search').locator('input').fill(text)
}

/** Opens "Add filter" and picks the column titled `title`. */
export async function addFilter(
  page: Page,
  table: Locator,
  title: string,
): Promise<void> {
  await table.getByTestId('data-table-add-filter').click()
  await page.getByRole('menuitem', { name: title, exact: true }).click()
}

/**
 * The values sorted as the app sorts text (`localeCompare`, numbers in them by value), in the
 * page so it uses the browser's own collation. Empty values go last, whatever the direction.
 */
export function sortedLikeTheApp(
  page: Page,
  values: string[],
  direction: 'asc' | 'desc',
): Promise<string[]> {
  return page.evaluate(
    ({ values, direction }) => {
      const factor = direction === 'asc' ? 1 : -1
      return [...values].sort((x, y) => {
        if (!x || !y) return Number(!x) - Number(!y)
        // Not minding capitals, as the app: 'Apple' and 'apple' keep the order of the data.
        return (
          x
            .toLocaleLowerCase()
            .localeCompare(y.toLocaleLowerCase(), undefined, {
              numeric: true,
            }) * factor
        )
      })
    },
    { values, direction },
  )
}

/** Waits until the table shows `count` rows. */
export async function expectShown(
  table: Locator,
  count: number,
  message: string,
): Promise<void> {
  await expect(table, message).toHaveAttribute('data-shown', String(count))
}
