/**
 * Moving around the app as a user does: through the side menu. The address of a page depends on
 * the deployment (hash mode or not, its default view), so tests do not write it: they follow the
 * menu's link to the route, whose `href` ends with it either way.
 */
import { expect, type Page } from '@playwright/test'

/**
 * Unfolds the side menu, as a user does: it starts folded into a rail of icons and opens while the
 * pointer rests on it (or when pinned). What only the unfolded menu shows (the loaded execution
 * and its latest ones, the groups and their pages) needs it. It folds again when the pointer
 * leaves it, so call it right before using the menu.
 */
export async function unfoldMenu(page: Page): Promise<void> {
  if (!page.url().startsWith('http')) await page.goto('/')
  const panel = page.getByTestId('app-drawer-execution-block')
  if (await panel.isVisible()) return
  await page.getByTestId('app-drawer').hover()
  await expect(panel, 'the side menu unfolds').toBeVisible()
}

/**
 * Moves the pointer off the side menu, as a user does once done with it: the unfolded menu lies
 * over the content (the tabs of the loaded executions among it) and folds again. A pinned menu
 * stays.
 */
export async function leaveMenu(page: Page): Promise<void> {
  // Unfolded by the pointer it floats; pinned it does not, and stays when the pointer leaves.
  const floating = await page
    .getByTestId('app-drawer')
    .evaluate((drawer) => drawer.classList.contains('is-floating'))
  const size = page.viewportSize() ?? { width: 1280, height: 720 }
  await page.mouse.move(size.width - 20, Math.round(size.height / 2))
  if (floating) {
    await expect(
      page.getByTestId('app-drawer-execution-block'),
      'the side menu folds',
    ).toBeHidden()
  }
}

/**
 * Opens the page of `route` (`/history-execution`) from the side menu, loading the app first if
 * the tab has nothing yet. Fails when the menu has no link to it for this user. Pages that are a
 * group of their own (the history) are on the folded menu too.
 */
export async function openFromMenu(page: Page, route: string): Promise<void> {
  if (!page.url().startsWith('http')) await page.goto('/')
  const link = page
    .getByTestId('app-drawer')
    .locator(`a[href$="${route}"]`)
    .first()
  await expect(link, `the side menu links to ${route}`).toBeAttached()
  await link.click()
  await page.waitForURL((url) => url.href.endsWith(route))
}
