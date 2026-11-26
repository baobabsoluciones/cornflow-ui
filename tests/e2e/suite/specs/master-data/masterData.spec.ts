/**
 * Master tables (frontend automation), read only: the tables the client's backend describes at
 * `/external/frontend-automation/`, listed under "Master data" in the side menu.
 *
 * - The menu has them in the sections of the backend, in its order (or in one group when it has
 *   no sections).
 * - Each one opens from the menu and shows the rows its list gives (`get_list`, read from the page
 *   with the user's session), and downloads to Excel with them.
 *
 * Nothing is changed: master tables are reference data others use, with rules the suite does not
 * know. Where the backend has no frontend automation (core's stack), the tests are skipped.
 */
import type { Page } from '@playwright/test'
import { test, expect } from '../../harness/fixtures'
import {
  downloadTable,
  forEachTab,
  visibleTable,
} from '../../harness/executionData'
import { openHistory } from '../../harness/history'
import {
  backendList,
  liveMasterData,
  tablesOn,
  urlFriendly,
} from '../../harness/masterData'
import { leaveMenu, openMenuGroup, unfoldMenu } from '../../harness/navigation'
import type { MasterData, MasterTable } from '../../harness/run'
import { activeSchema } from '../../harness/schemas'

/** The groups of the side menu with master tables, in their order. */
async function masterGroups(page: Page): Promise<string[]> {
  await unfoldMenu(page)
  return page
    .getByTestId('app-drawer-general-block')
    .locator('[data-testid^="drawer-group-master-data"]')
    .evaluateAll((groups) =>
      groups.map((group) =>
        group.getAttribute('data-testid')!.slice('drawer-group-'.length),
      ),
    )
}

/**
 * The pages of master tables of a group of the menu: a page of its own, or its pages, leaving out
 * the app's own pages of a section (`/configuration/section/…`). Opens the group.
 */
async function pagesOfGroup(page: Page, group: string): Promise<string[]> {
  await unfoldMenu(page)
  const own = page.getByTestId(`drawer-group-${group}`).locator(':scope > a')
  const links = (await own.count()) ? own : await openMenuGroup(page, group)
  const hrefs = await links.evaluateAll((all) =>
    all.map((link) => link.getAttribute('href') ?? ''),
  )
  return hrefs.filter((href) => !href.includes('/configuration/section/'))
}

/** Opens a page of a group of the menu, as the user does. */
async function openPage(
  page: Page,
  group: string,
  href: string,
): Promise<void> {
  await unfoldMenu(page)
  const own = page.getByTestId(`drawer-group-${group}`).locator(':scope > a')
  const link = (await own.count())
    ? own
    : (await openMenuGroup(page, group)).and(page.locator(`a[href="${href}"]`))
  await link.click()
  await page.waitForURL((url) => url.href.includes(href))
  await leaveMenu(page)
}

test.describe('master tables', () => {
  let masterData: MasterData
  let schema = ''
  let tables: [string, MasterTable][] = []

  test.beforeEach(async ({ page }) => {
    await openHistory(page)
    masterData = await liveMasterData(page)
    schema = await activeSchema(page)
    tables = tablesOn(masterData, schema)
    test.skip(
      !tables.length,
      'the backend has no master tables here (frontend automation)',
    )
  })

  test('the menu has them in the sections of the backend, in its order', async ({
    page,
  }) => {
    const sectionIds = masterData.sections.map((section) => section.id)
    const inSections = sectionIds.filter((id) =>
      tables.some(([, table]) => table.section === id),
    )
    const outside = tables.some(([, table]) => table.section === null)
    const groups = await masterGroups(page)

    if (!inSections.length) {
      expect(groups, 'one group of master data').toEqual(['master-data'])
      return
    }
    expect(
      groups.filter((group) => !/^master-data-\d+$/.test(group)),
      "a group per section, in the backend's order",
    ).toEqual(inSections.map((id) => `master-data-${id}`))
    expect(
      groups.some((group) => /^master-data-\d+$/.test(group)),
      `${outside ? 'a' : 'no'} group for the tables in no section`,
    ).toBe(outside)
  })

  test('each opens from the menu, shows the rows its backend gives and downloads them to Excel', async ({
    page,
    deployment,
  }) => {
    const byAddress = new Map(
      tables.map(([key, table]) => [urlFriendly(key), { key, table }]),
    )
    const seen = new Set<string>()

    for (const group of await masterGroups(page)) {
      for (const href of await pagesOfGroup(page, group)) {
        await leaveMenu(page)
        await openPage(page, group, href)
        await forEachTab(page, async (address) => {
          const found = byAddress.get(address)
          expect(
            found,
            `"${address}" is a master table of the backend`,
          ).toBeDefined()
          const { key, table } = found!
          if (seen.has(key)) return
          seen.add(key)
          await test.step(key, async () => {
            const list = await backendList(page, deployment, table, schema)
            if (list.paged) {
              test.info().annotations.push({
                type: 'note',
                description: `"${key}" is listed a page at a time: its rows are not counted`,
              })
              return
            }
            await expect(
              visibleTable(page),
              `"${key}" shows the rows its backend gives`,
            ).toHaveAttribute('data-rows', String(list.rows))
            const [sheet] = await downloadTable(page)
            expect(sheet.rows - 1, `"${key}" downloads its rows to Excel`).toBe(
              list.rows,
            )
          })
        })
      }
    }
    expect([...seen].sort(), 'every master table opens from the menu').toEqual(
      tables.map(([key]) => key).sort(),
    )
  })
})
