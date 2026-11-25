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
