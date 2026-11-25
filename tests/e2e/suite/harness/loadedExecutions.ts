/**
 * The executions a user has loaded: a tab each at the foot of the app, the one selected also in
 * the side menu ("loaded execution", with its latest executions to pick from), and its views
 * (input data and results), each headed by its summary.
 */
import { expect, type Locator, type Page } from '@playwright/test'
import { leaveMenu, unfoldMenu } from './navigation'

/** The groups of the side menu with the views of the selected execution. */
export type ExecutionGroup = 'input-data' | 'results'

/** The tab of a loaded execution. */
export const executionTab = (page: Page, id: string): Locator =>
  page.getByTestId(`execution-tab-${id}`)

/** The button that closes the tab of a loaded execution. */
export const executionTabClose = (page: Page, id: string): Locator =>
  page.getByTestId(`execution-tab-close-${id}`)

/** Every tab of a loaded execution. */
export const executionTabs = (page: Page): Locator =>
  page.getByTestId('execution-tab-bar').getByRole('tab')

/** The "loaded execution" selector of the side menu (unfolded). */
export const loadedExecutionSelector = (page: Page): Locator =>
  page.getByTestId('app-drawer-execution')

/** Waits until the execution `id` is loaded and selected: its tab, selected, and in the menu. */
export async function expectSelected(
  page: Page,
  id: string,
  name: string,
): Promise<void> {
  await expect(executionTab(page, id), `"${name}" has a tab`).toBeVisible()
  await expect(executionTab(page, id)).toHaveAttribute('aria-selected', 'true')
  await unfoldMenu(page)
  await expect(loadedExecutionSelector(page)).toContainText(name)
  await expect(page.getByTestId('drawer-group-input-data')).toBeVisible()
  await leaveMenu(page)
}

/**
 * Waits until no loaded execution is selected: no tab selected, and the unfolded menu with no
 * execution's groups.
 */
export async function expectNoneSelected(page: Page): Promise<void> {
  await expect(
    page
      .getByTestId('execution-tab-bar')
      .locator('[role="tab"][aria-selected="true"]'),
  ).toHaveCount(0)
  await unfoldMenu(page)
  await expect(page.getByTestId('drawer-group-input-data')).toHaveCount(0)
  await leaveMenu(page)
}

/** Opens one of the latest executions from the "loaded execution" selector of the side menu. */
export async function openFromLatest(page: Page, name: string): Promise<void> {
  await unfoldMenu(page)
  await loadedExecutionSelector(page).click()
  const item = page
    .getByTestId('drawer-executions')
    .getByTestId('drawer-executions-item')
    .filter({ hasText: name })
  await expect(item, `the latest executions list "${name}"`).toHaveCount(1)
  await item.click()
  await leaveMenu(page)
}

/** Unfolds the side menu and opens a group of the selected execution: its pages. */
async function openGroup(page: Page, group: ExecutionGroup): Promise<Locator> {
  await unfoldMenu(page)
  const section = page.getByTestId(`drawer-group-${group}`)
  await expect(
    section,
    `the side menu has the ${group} of the execution`,
  ).toBeVisible()
  // The groups are an accordion: opening one closes the others.
  const head = section.locator('button[aria-expanded]')
  if ((await head.getAttribute('aria-expanded')) !== 'true') await head.click()
  return section.getByRole('link')
}

/** How many pages a group of the selected execution has (tables, validations, dashboards). */
export async function executionViewCount(
  page: Page,
  group: ExecutionGroup,
): Promise<number> {
  const count = await (await openGroup(page, group)).count()
  await leaveMenu(page)
  return count
}

/**
 * Opens a page of a group of the selected execution from the side menu: the first (its input
 * tables, its results) unless `index` says another. Returns the route it went to.
 */
export async function openExecutionView(
  page: Page,
  group: ExecutionGroup,
  index = 0,
): Promise<string> {
  const target = (await openGroup(page, group)).nth(index)
  const route = (await target.getAttribute('href')) ?? ''
  await target.click()
  // The route of a group of tables goes on to its first table.
  await page.waitForURL((url) => url.href.includes(route))
  await leaveMenu(page)
  return route
}
