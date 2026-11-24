/**
 * Moving around the app as a user does: through the side menu. The address of a page depends on
 * the deployment (hash mode or not, its default view), so tests do not write it: they follow the
 * menu's link to the route, whose `href` ends with it either way.
 */
import { expect, type Page } from '@playwright/test'

/**
 * Opens the page of `route` (`/history-execution`) from the side menu, loading the app first if
 * the tab has nothing yet. Fails when the menu has no link to it for this user.
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
