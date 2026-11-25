/**
 * The execution history of the schema the app is on, as a user goes through it: open it, find an
 * execution by its name, and load it, from its row or from its detail.
 */
import { expect, type Locator, type Page } from '@playwright/test'
import { openFromMenu } from './navigation'

export const HISTORY = '/history-execution'

/** Opens the history from the side menu and waits until it has loaded. */
export async function openHistory(page: Page): Promise<void> {
  await openFromMenu(page, HISTORY)
  await expect(page.getByTestId('history-loading')).toHaveCount(0)
}

/** The search box of the history. */
export const historySearch = (page: Page): Locator =>
  page.getByTestId('history-search').locator('input')

/**
 * Looks for `name` in the history (open) and returns its row, once it is the only one: the
 * suite's names are unique.
 */
export async function findInHistory(
  page: Page,
  name: string,
): Promise<Locator> {
  await historySearch(page).fill(name)
  const row = page.getByTestId('history-row').filter({ hasText: name })
  await expect(row, `the history lists "${name}"`).toHaveCount(1)
  return row
}

/**
 * Loads an execution from its row in the history (open). The row's buttons show under the
 * pointer, as they do for a user.
 */
export async function loadFromHistoryRow(
  page: Page,
  name: string,
): Promise<void> {
  const row = await findInHistory(page, name)
  await row.hover()
  await row.getByTestId('history-row-load').click()
}

/** Loads an execution from its detail in the history (open): choose it, then load it. */
export async function loadFromHistoryDetail(
  page: Page,
  name: string,
): Promise<void> {
  const row = await findInHistory(page, name)
  await row.click()
  const detail = page.getByTestId('history-detail')
  await expect(detail).toContainText(name)
  await detail.getByTestId('history-detail-load').click()
}

/** The rows the history lists, with the search and filters it has. */
export const historyRows = (page: Page): Locator =>
  page.getByTestId('history-row')

/** Opens a filter chip's options, unless they are open already. */
async function openChip(page: Page, chip: Locator): Promise<void> {
  if (!(await page.getByRole('menu').count()))
    await chip.locator('.filter-chip__main').click()
  await expect(page.getByRole('menu')).toBeVisible()
}

/** Picks the option `value` of a filter chip (open or not); the history lists again. */
async function pickOption(
  page: Page,
  chip: Locator,
  value: string,
): Promise<void> {
  await openChip(page, chip)
  await page.getByTestId(`filter-option-${value}`).click()
  await expect(page.getByTestId('history-loading')).toHaveCount(0)
}

/**
 * Adds the filter `key` of the history ("Add filter": `state`, `solutionState`, `solver`, `user`…)
 * and picks its option `value`. Returns its chip.
 */
export async function filterHistory(
  page: Page,
  key: string,
  value: string,
): Promise<Locator> {
  await page.getByTestId('history-add-filter').click()
  await page.getByTestId(`add-filter-${key}`).click()
  const chip = page.getByTestId(`history-filter-${key}`)
  await expect(chip).toBeVisible()
  await pickOption(page, chip, value)
  await expect(page.getByRole('menu')).toHaveCount(0)
  return chip
}

/** The days the history can list: presets, or a custom range of two days (YYYY-MM-DD). */
export type HistoryDates =
  | 'today'
  | 'yesterday'
  | 'last7days'
  | 'lastMonth'
  | { from: string; to: string }

/** Lists the executions of other days: a preset, or a custom range. */
export async function historyDates(
  page: Page,
  dates: HistoryDates,
): Promise<void> {
  const chip = page.getByTestId('history-filter-date')
  if (typeof dates === 'string') {
    await pickOption(page, chip, dates)
    return
  }
  await pickOption(page, chip, 'custom')
  await page.getByTestId('date-filter-from').fill(dates.from)
  await page.getByTestId('date-filter-to').fill(dates.to)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('menu')).toHaveCount(0)
  await expect(page.getByTestId('history-loading')).toHaveCount(0)
}

/**
 * Deletes an execution from its detail in the history (open), as the user does: asks, and the
 * user confirms or, with `confirm: false`, cancels.
 */
export async function deleteFromHistory(
  page: Page,
  name: string,
  { confirm = true }: { confirm?: boolean } = {},
): Promise<void> {
  const row = await findInHistory(page, name)
  await row.click()
  const detail = page.getByTestId('history-detail')
  await expect(detail).toContainText(name)
  await detail.getByTestId('history-detail-delete').click()
  const button = page.getByTestId(
    confirm ? 'confirm-dialog-confirm' : 'confirm-dialog-cancel',
  )
  await button.click()
  await expect(button).toBeHidden()
}
