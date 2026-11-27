/**
 * Moving around the app as a user does: through the side menu. The address of a page depends on
 * the deployment (hash mode or not, its default view), so tests do not write it: they follow the
 * menu's link to the route, whose `href` ends with it either way.
 */
import { expect, type Locator, type Page } from '@playwright/test'

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

/** ms the menu waits with the pointer on it before it opens (100) and away before it folds (200). */
const MENU_DELAYS = 400

/**
 * Moves the pointer off the side menu, as a user does once done with it: the unfolded menu lies
 * over the content (the tabs of the loaded executions among it) and folds again. A pinned menu
 * stays.
 *
 * When a click in the menu changes the page under the pointer, the browser at times does not tell
 * the menu that the pointer left, and the menu stays open, or opens just after. A user then passes
 * over it again and leaves, and so does this.
 */
export async function leaveMenu(page: Page): Promise<void> {
  const drawer = page.getByTestId('app-drawer')
  const size = page.viewportSize() ?? { width: 1280, height: 720 }
  const away = () =>
    page.mouse.move(size.width - 20, Math.round(size.height / 2))
  // Unfolded by the pointer it floats; pinned it does not, and stays when the pointer leaves.
  const floating = () =>
    drawer.evaluate((menu) => menu.classList.contains('is-floating'))

  await away()
  await page.waitForTimeout(MENU_DELAYS)
  if (await floating()) {
    await drawer.hover()
    await away()
  }
  await expect.poll(floating, { message: 'the side menu folds' }).toBe(false)
}

/**
 * Opens the page of `route` (`/history-execution`) from the side menu, loading the app first if
 * the tab has nothing yet, and moves the pointer off the menu, which would otherwise unfold over
 * the page. Fails when the menu has no link to it for this user. Pages that are a group of their
 * own (the history) are on the folded menu too.
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
  await leaveMenu(page)
}

/**
 * Unfolds the side menu and opens its group `key` (`drawer-group-<key>`: `admin`, `input-data`…),
 * named `what` in the failure when there is none. Returns the links of its pages. The groups are
 * an accordion: opening one closes the others.
 */
export async function openMenuGroup(
  page: Page,
  key: string,
  what = `the group ${key}`,
): Promise<Locator> {
  await unfoldMenu(page)
  const section = page.getByTestId(`drawer-group-${key}`)
  await expect(section, `the side menu has ${what}`).toBeVisible()
  const head = section.locator('button[aria-expanded]')
  if ((await head.getAttribute('aria-expanded')) !== 'true') await head.click()
  return section.getByRole('link')
}

/**
 * Goes to `route` (`/roles-management`, `/reset-password?token=…`) by its address, as a user who
 * types it or follows a link from elsewhere does, in hash mode or not, as the app is.
 */
export async function goToRoute(page: Page, route: string): Promise<void> {
  if (!page.url().startsWith('http')) await page.goto('/')
  const url = new URL(page.url())
  if (url.hash.startsWith('#/')) {
    url.hash = route
  } else {
    const [path, query = ''] = route.split('?')
    url.pathname = path
    url.search = query ? `?${query}` : ''
    url.hash = ''
  }
  await page.goto(url.href)
  await page.waitForLoadState('networkidle')
}

/**
 * The view the page is on: the first part of its route (`history-execution`, `not-found`), in
 * hash mode or not.
 */
export function currentView(page: Page): string {
  const url = new URL(page.url())
  const route = url.hash.startsWith('#/') ? url.hash.slice(1) : url.pathname
  return route.split('?')[0].split('/').filter(Boolean)[0] ?? ''
}

/**
 * The addresses the side menu links to in its groups that are the same for every execution: each
 * group of its own, and the pages of each heading, opened one after another (they are an
 * accordion).
 */
export async function menuLinks(page: Page): Promise<string[]> {
  await unfoldMenu(page)
  const general = page.getByTestId('app-drawer-general-block')
  const keys = await general
    .locator('[data-testid^="drawer-group-"]')
    .evaluateAll((groups) =>
      groups.map((group) =>
        group.getAttribute('data-testid')!.slice('drawer-group-'.length),
      ),
    )
  const hrefs: string[] = []
  for (const key of keys) {
    const own = page.getByTestId(`drawer-group-${key}`).locator(':scope > a')
    const links = (await own.count()) ? own : await openMenuGroup(page, key)
    hrefs.push(
      ...(await links.evaluateAll((all) =>
        all.map((link) => link.getAttribute('href') ?? ''),
      )),
    )
  }
  return hrefs
}
