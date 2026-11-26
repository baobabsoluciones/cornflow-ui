/**
 * Moving around the app: the side menu (every page it offers opens and is marked; folded,
 * pinned, and in a narrow window), the browser's back and forward and reloading, and an address
 * that is no page of the app.
 *
 * The groups of the loaded execution (its input data and results) are tested with the data of an
 * execution (specs/execution-data); here, the groups that are the same for every execution, with
 * a user of each role: each has its own menu.
 */
import type { Locator, Page } from '@playwright/test'
import { test, expect } from '../../harness/fixtures'
import { asUser } from '../../harness/contextChecks'
import {
  CREATE_EXECUTION,
  offersNewExecution,
} from '../../harness/createExecution'
import { HISTORY, openHistory } from '../../harness/history'
import {
  currentView,
  goToRoute,
  leaveMenu,
  openFromMenu,
  openMenuGroup,
  unfoldMenu,
} from '../../harness/navigation'
import { roleSessions } from '../../harness/run'
import { openSettings, USER_SETTINGS } from '../../harness/user'

/** A page of the side menu: its group, and the address its link goes to. */
interface MenuPage {
  group: string
  href: string
  /** The group is a page of its own (the history), not a heading over its pages. */
  own: boolean
}

/** The keys of the groups of the side menu that are the same for every execution. */
async function generalGroups(page: Page): Promise<string[]> {
  await unfoldMenu(page)
  return page
    .getByTestId('app-drawer-general-block')
    .locator('[data-testid^="drawer-group-"]')
    .evaluateAll((groups) =>
      groups.map((group) =>
        group.getAttribute('data-testid')!.slice('drawer-group-'.length),
      ),
    )
}

/** The link of a group that is a page of its own. */
const ownLink = (page: Page, group: string): Locator =>
  page.getByTestId(`drawer-group-${group}`).locator(':scope > a')

/** The pages of a group of the side menu. */
async function pagesOf(page: Page, group: string): Promise<MenuPage[]> {
  await unfoldMenu(page)
  const own = ownLink(page, group)
  if (await own.count())
    return [{ group, href: (await own.getAttribute('href'))!, own: true }]
  const links = await openMenuGroup(page, group)
  const hrefs = await links.evaluateAll((all) =>
    all.map((link) => link.getAttribute('href')!),
  )
  return hrefs.map((href) => ({ group, href, own: false }))
}

/** The link of a page of the side menu, unfolding the menu and opening its group. */
async function linkOf(page: Page, menuPage: MenuPage): Promise<Locator> {
  await unfoldMenu(page)
  if (menuPage.own) return ownLink(page, menuPage.group)
  const links = await openMenuGroup(page, menuPage.group)
  return links.and(page.locator(`a[href="${menuPage.href}"]`))
}

/** The address a link goes to is the page's: in hash mode or not, and a group of tables goes on. */
const isAt = (url: URL, href: string) => url.href.includes(href)

/** Waits until the app, just opened, is on a page. */
async function landed(page: Page): Promise<void> {
  await expect
    .poll(() => currentView(page), { message: 'the app opens a page' })
    .not.toBe('')
}

/** Opens every page of the groups of the side menu, and checks that the menu marks it. */
async function openEveryMenuPage(page: Page): Promise<void> {
  await landed(page)
  const groups = await generalGroups(page)
  expect(groups, 'the menu has groups').not.toHaveLength(0)

  for (const group of groups) {
    await test.step(`the group ${group}`, async () => {
      for (const menuPage of await pagesOf(page, group)) {
        const link = await linkOf(page, menuPage)
        await link.click()
        await page.waitForURL((url) => isAt(url, menuPage.href))
        expect(currentView(page), `${menuPage.href} is a page`).not.toBe(
          'not-found',
        )
        if (menuPage.own) {
          await expect(link, `${menuPage.href} is marked`).toHaveClass(
            /\bis-active\b/,
          )
        } else {
          await expect(link, `${menuPage.href} is marked`).toHaveAttribute(
            'aria-current',
            'page',
          )
        }
        await leaveMenu(page)
      }
    })
  }
}

/**
 * Goes over the groups of the folded menu: each shows; a page of its own opens from there, and a
 * heading pins the menu open on its pages.
 */
async function useFoldedMenu(page: Page): Promise<void> {
  await landed(page)
  const groups = await generalGroups(page)
  const panel = page.getByTestId('app-drawer-execution-block')

  for (const group of groups) {
    await test.step(`the group ${group}`, async () => {
      const pages = await pagesOf(page, group)
      await leaveMenu(page)
      await expect(panel, 'the menu is folded').toBeHidden()
      const item = page.getByTestId(`app-drawer-rail-${group}`)
      await expect(item, `the folded menu shows ${group}`).toBeVisible()

      if (pages[0].own) {
        await expect(item).toHaveAttribute('href', pages[0].href)
        await item.click()
        await page.waitForURL((url) => isAt(url, pages[0].href))
        await leaveMenu(page)
        return
      }
      // A heading pins the menu open on its pages.
      await item.click()
      await leaveMenu(page)
      await expect(panel, 'the menu stays open').toBeVisible()
      const head = page
        .getByTestId(`drawer-group-${group}`)
        .locator('button[aria-expanded]')
      await expect(head, `it is open on ${group}`).toHaveAttribute(
        'aria-expanded',
        'true',
      )
      await page.getByTestId('app-drawer-pin').click()
      await leaveMenu(page)
    })
  }
}

test.describe('navigation', () => {
  test('every page the side menu offers opens, and the menu marks it as the one open', async ({
    browser,
    deployment,
    run,
  }) => {
    for (const session of roleSessions(run)) {
      await test.step(`the user of ${session.name}`, () =>
        asUser(browser, deployment, session.name, openEveryMenuPage))
    }
  })

  test('folded, the menu shows each group: a page opens from there, and a heading opens the menu on its pages', async ({
    browser,
    deployment,
    run,
  }) => {
    for (const session of roleSessions(run)) {
      await test.step(`the user of ${session.name}`, () =>
        asUser(browser, deployment, session.name, useFoldedMenu))
    }
  })

  test('pinned, the menu stays open on every page; unpinned, it folds when the pointer leaves', async ({
    page,
  }) => {
    await openHistory(page)
    const panel = page.getByTestId('app-drawer-execution-block')
    const pin = page.getByTestId('app-drawer-pin')

    await unfoldMenu(page)
    await pin.click()
    await leaveMenu(page)
    await expect(panel, 'pinned, it stays open').toBeVisible()
    await openSettings(page)
    await expect(panel, 'and on the next page').toBeVisible()

    await pin.click()
    await leaveMenu(page)
    await expect(panel, 'unpinned, it folds').toBeHidden()
  })

  test('in a narrow window the menu opens over the page, and closes from outside it, with its button or once a page is picked', async ({
    page,
  }) => {
    const size = { width: 600, height: 900 }
    await page.setViewportSize(size)
    await openHistory(page)
    const drawer = page.getByTestId('app-drawer')
    const scrim = page.getByTestId('app-drawer-scrim')
    const open = async () => {
      await page.getByTestId('app-drawer-rail-execution').click()
      await expect(drawer, 'the menu opens over the page').toHaveClass(
        /\bis-overlay\b/,
      )
      await expect(scrim).toBeVisible()
    }
    const expectClosed = async (how: string) => {
      await expect(scrim, `it closes ${how}`).toHaveCount(0)
      await expect(drawer).not.toHaveClass(/\bis-overlay\b/)
    }

    await open()
    await page.mouse.click(size.width - 20, size.height / 2)
    await expectClosed('from outside it')

    await open()
    await page.getByTestId('app-drawer-pin').click()
    await expectClosed('with its button')

    await open()
    await page.getByTestId('app-drawer-user').click()
    await page.waitForURL((url) => url.href.endsWith(USER_SETTINGS))
    await expectClosed('once a page is picked')
  })

  test('the browser goes back and forward through the pages visited, and reloading stays on the page', async ({
    page,
  }) => {
    await openHistory(page)
    const visited = [HISTORY.slice(1)]
    if (await offersNewExecution(page)) {
      await openFromMenu(page, CREATE_EXECUTION)
      visited.push(CREATE_EXECUTION.slice(1))
    }
    await openSettings(page)
    visited.push(USER_SETTINGS.slice(1))

    const expectOn = (view: string, how: string) =>
      expect
        .poll(() => currentView(page), { message: `${how}, on ${view}` })
        .toBe(view)
    for (let index = visited.length - 2; index >= 0; index--) {
      await page.goBack()
      await expectOn(visited[index], 'back')
    }
    for (let index = 1; index < visited.length; index++) {
      await page.goForward()
      await expectOn(visited[index], 'forward')
    }

    await page.reload()
    await expectOn(visited.at(-1)!, 'reloaded')
    await expect(
      page.getByTestId('sign-in-username'),
      'still signed in',
    ).toHaveCount(0)
    await expect(page.getByTestId('settings-language')).toBeVisible()
  })

  test('an address that is no page shows "not found", and its button goes back to where the app starts', async ({
    page,
  }) => {
    await page.goto('/')
    await expect
      .poll(() => currentView(page), { message: 'the app opens a page' })
      .not.toBe('')
    const start = currentView(page)

    await goToRoute(page, '/e2e-no-such-page')
    await expect(page.getByTestId('not-found')).toHaveAttribute(
      'data-reason',
      'not-found',
    )
    expect(currentView(page)).toBe('not-found')

    await page.getByTestId('not-found-home').click()
    await expect
      .poll(() => currentView(page), {
        message: 'back where the app starts',
      })
      .toBe(start)
  })
})
