/**
 * The data of the selected execution as the app shows it: the pages of its input data and of its
 * results (tables, and validations when the checks found something), a tab per table, and their
 * downloads to Excel.
 *
 * A table is known by its key, the last part of the route of its tab (`…/products`), the same in
 * every language, so the backend's data says what it should show.
 */
import {
  expect,
  test,
  type Download,
  type Locator,
  type Page,
} from '@playwright/test'
import {
  executionViewCount,
  openExecutionView,
  type ExecutionGroup,
} from './loadedExecutions'
import { readSheets, type Sheet } from './xlsx'

/** The table on screen: the one of the selected tab. */
export const visibleTable = (page: Page): Locator =>
  page.locator('[data-testid="data-table"]:visible').first()

/** The key of the table a route is on: its last part. */
export function tableKeyOf(href: string): string {
  const url = new URL(href)
  const path = url.hash ? url.hash.slice(1) : url.pathname
  const last = path.split('?')[0].split('/').filter(Boolean).pop() ?? ''
  return decodeURIComponent(last)
}

/** Rows the app shows for a table of data: a list, one per item; an object, one. */
export function rowsOnScreen(value: unknown): number {
  if (Array.isArray(value)) return value.length
  return value && typeof value === 'object' ? 1 : 0
}

/**
 * Rows a whole download to Excel gives a table of data, its header aside: a list, one per item;
 * an object, one per key (name and value).
 */
export function rowsInWorkbook(value: unknown): number {
  if (Array.isArray(value)) return value.length
  return value && typeof value === 'object' ? Object.keys(value).length : 0
}

/** Rows per table, its header aside, of a whole download of `data` to Excel. */
export function workbookRows(
  data: Record<string, unknown> | null,
): Record<string, number> {
  return Object.fromEntries(
    Object.entries(data ?? {}).map(([key, value]) => [
      key,
      rowsInWorkbook(value),
    ]),
  )
}

/** Rows on screen of every table of `data` (instance or solution data, or checks). */
export function expectedOnScreen(
  data: Record<string, unknown> | null,
): Record<string, number> {
  return Object.fromEntries(
    Object.entries(data ?? {}).map(([key, value]) => [
      key,
      rowsOnScreen(value),
    ]),
  )
}

/**
 * Goes through every page of `group` of the selected execution and every table tab on it, and
 * checks that each table shows as many rows as `expected` says for its key. A table `expected`
 * does not have fails the test: the app shows something that is not there. Pages with no data
 * table (dashboards) are passed over. Returns the keys of the tables it went through.
 */
export async function checkGroupTables(
  page: Page,
  group: ExecutionGroup,
  expected: Record<string, number>,
): Promise<string[]> {
  const seen: string[] = []
  const pages = await executionViewCount(page, group)
  for (let index = 0; index < pages; index++) {
    await openExecutionView(page, group, index)
    await page.waitForLoadState('networkidle')
    if (!(await page.getByTestId('data-table').count())) continue

    const tabs = page.getByTestId('data-table-tabs').first().getByRole('tab')
    const tabCount = await tabs.count()
    let previous = ''
    for (let tab = 0; tab < Math.max(tabCount, 1); tab++) {
      if (tabCount) {
        await tabs.nth(tab).click()
        await expect(tabs.nth(tab)).toHaveAttribute('aria-selected', 'true')
      }
      // The route follows the tab.
      await expect
        .poll(() => tableKeyOf(page.url()), {
          message: 'the route follows the tab',
        })
        .not.toBe(previous)
      const key = tableKeyOf(page.url())
      previous = key
      expect(
        Object.keys(expected),
        `the ${group} show a table "${key}", which the execution does not have`,
      ).toContain(key)
      const table = visibleTable(page)
      await expect(table).toHaveAttribute('data-status', 'ready')
      await expect(
        table,
        `the table "${key}" of the ${group} shows its rows`,
      ).toHaveAttribute('data-rows', String(expected[key]))
      seen.push(key)
    }
  }
  return seen
}

/** Saves what `click` makes the app download, in the test's output. Returns where and its name. */
export async function download(
  page: Page,
  click: () => Promise<void>,
): Promise<{ file: string; name: string }> {
  const [downloaded] = await Promise.all([
    page.waitForEvent('download'),
    click(),
  ])
  const name = downloaded.suggestedFilename()
  const file = test.info().outputPath(name)
  await downloaded.saveAs(file)
  return { file, name }
}

/**
 * Saves the `count` files that `click` makes the app download, in the test's output. Fails when
 * fewer come within `timeoutMs`. Returns where each went and its name, in the order they came.
 */
export async function downloadFiles(
  page: Page,
  count: number,
  click: () => Promise<void>,
  timeoutMs = 30_000,
): Promise<{ file: string; name: string }[]> {
  const downloads: Download[] = []
  let onDownload: (download: Download) => void = () => {}
  const all = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () =>
        reject(
          new Error(
            `${downloads.length} of ${count} downloads came in ${timeoutMs} ms`,
          ),
        ),
      timeoutMs,
    )
    onDownload = (download) => {
      downloads.push(download)
      if (downloads.length === count) {
        clearTimeout(timer)
        resolve()
      }
    }
    page.on('download', onDownload)
  })
  try {
    await click()
    await all
  } finally {
    page.off('download', onDownload)
  }
  const saved = []
  for (const download of downloads) {
    const name = download.suggestedFilename()
    const file = test.info().outputPath(name)
    await download.saveAs(file)
    saved.push({ file, name })
  }
  return saved
}

/** Downloads the table on screen with its Excel button. Returns its sheets. */
export async function downloadTable(page: Page): Promise<Sheet[]> {
  const { file } = await download(page, () =>
    visibleTable(page).getByTestId('data-table-excel').click(),
  )
  return readSheets(file)
}

/**
 * Downloads what the page shows (all the input data, all the results, the validations) from
 * "Download Excel" of its title's menu. Returns its sheets.
 */
export async function downloadView(page: Page): Promise<Sheet[]> {
  await page
    .getByTestId('title-view')
    .getByTestId('core-dropdown-menu-trigger')
    .click()
  const { file } = await download(page, () =>
    page.getByTestId('dropdown-item-download-excel').click(),
  )
  return readSheets(file)
}

/**
 * Checks a whole download against `expected` rows per table (its header aside): a sheet per
 * table, each with its rows, and no other.
 */
export function expectWorkbook(
  sheets: Sheet[],
  expected: Record<string, number>,
  what: string,
): void {
  expect(
    sheets.map((sheet) => sheet.name).sort(),
    `the download of the ${what} has a sheet per table`,
  ).toEqual(Object.keys(expected).sort())
  for (const sheet of sheets) {
    expect(
      sheet.rows - 1,
      `the sheet "${sheet.name}" of the ${what} has its rows`,
    ).toBe(expected[sheet.name])
  }
}
