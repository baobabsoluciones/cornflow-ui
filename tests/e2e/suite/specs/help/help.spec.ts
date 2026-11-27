/**
 * The help of the app, from the "?" button of every page: the versions of the app and of
 * Cornflow, the help centre with the app's help files (`helpMenuFiles`) in each language, the
 * licences of the libraries Cornflow uses, and the guided tours: the general one, in each
 * language, and the tour of each page that has one.
 *
 * The fixture checks every text the tours show: a step whose text is missing shows its key.
 */
import path from 'node:path'
import type { Page } from '@playwright/test'
import { test, expect } from '../../harness/fixtures'
import { adminSession, openRolesManagement } from '../../harness/admin'
import { asUser } from '../../harness/contextChecks'
import {
  offersNewExecution,
  openCreateExecution,
} from '../../harness/createExecution'
import { solvedExecution } from '../../harness/executions'
import {
  expectNoTour,
  followTour,
  helpItem,
  openHelpMenu,
  pickHelp,
  tourCard,
  tourStep,
} from '../../harness/help'
import { loadFromHistoryRow, openHistory } from '../../harness/history'
import {
  expectSelected,
  openExecutionView,
} from '../../harness/loadedExecutions'
import { goToRoute, leaveMenu } from '../../harness/navigation'
import { chooseLanguage, openSettings } from '../../harness/user'

/** A file of the help centre, as the app config has it (`helpMenuFiles`). */
interface HelpFile {
  labelKey: string
  /** Its path under the app, with `{lang}` for the language. */
  publicPath: string
  downloadName?: string
}

/** Opens the tour of the page the user is on, goes over every step and checks that it ends. */
async function followPageTour(page: Page, where: string): Promise<void> {
  await openHelpMenu(page)
  await expect(
    helpItem(page, 'page-tour'),
    `${where} has a tour of its own`,
  ).toBeVisible()
  await helpItem(page, 'page-tour').click()
  const titles = await followTour(page)
  expect(titles, `the tour of ${where} has steps`).not.toHaveLength(0)
}

test.describe('help', () => {
  test('the help menu shows the versions of the app and of Cornflow', async ({
    page,
    api,
  }) => {
    const { cornflow_version: version } = await api.health()
    expect(version, 'Cornflow tells its version').toBeTruthy()
    await openHistory(page)
    await openHelpMenu(page)
    await expect(page.getByTestId('help-menu-app-version')).toHaveText(
      /\d+\.\d+\.\d+/,
    )
    await expect(page.getByTestId('help-menu-cornflow-version')).toContainText(
      version!,
    )
    await page.keyboard.press('Escape')
    await expect(helpItem(page, 'help')).toBeHidden()
  })

  test('the help centre gives the help files of the app, each in the language the app is in', async ({
    page,
    deployment,
  }) => {
    const files = deployment.helpMenuFiles as HelpFile[]
    const dialog = page.getByTestId('help-dialog')
    const links = dialog.getByTestId('help-file')

    for (const language of deployment.languages) {
      await test.step(`in ${language}`, async () => {
        await chooseLanguage(page, deployment.languages, language)
        await pickHelp(page, 'help')
        await expect(dialog).toBeVisible()
        await expect(links, 'a link for each file').toHaveCount(files.length)

        for (const [index, file] of files.entries()) {
          const filePath = file.publicPath.replace('{lang}', language)
          const link = links.nth(index)
          const href = (await link.getAttribute('href')) ?? ''
          expect(href, `the file in ${language}`).toMatch(
            new RegExp(`${filePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`),
          )
          const response = await page.request.get(
            new URL(href, page.url()).href,
          )
          expect(response.ok(), `${filePath} is there`).toBe(true)
          expect(
            response.headers()['content-type'] ?? '',
            `${filePath} is the file, not the page of the app`,
          ).not.toContain('text/html')

          const [download] = await Promise.all([
            page.waitForEvent('download'),
            link.click(),
          ])
          expect(download.suggestedFilename(), 'the name it downloads as').toBe(
            file.downloadName || path.basename(filePath),
          )
        }
        await page.keyboard.press('Escape')
        await expect(dialog).toBeHidden()
      })
    }
    if (!files.length) {
      test.info().annotations.push({
        type: 'note',
        description: 'the app has no help files (helpMenuFiles)',
      })
    }
  })

  test('the licences list the libraries Cornflow uses', async ({
    page,
    api,
  }) => {
    const licences = await api.licences()
    expect(licences, 'Cornflow tells its libraries').not.toHaveLength(0)
    await openHistory(page)
    await pickHelp(page, 'licences')
    const dialog = page.getByTestId('licences-dialog')
    await expect(dialog.getByTestId('licence')).toHaveCount(licences.length)
    for (const { library } of licences.slice(0, 3))
      await expect(dialog).toContainText(library)
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
  })

  test('the general tour goes back and forth, closes, and goes over the parts every page has in each language, leaving the menu as it was', async ({
    page,
    deployment,
  }) => {
    await openHistory(page)
    const panel = page.getByTestId('app-drawer-execution-block')
    const card = tourCard(page)
    await expect(panel, 'the menu starts folded').toBeHidden()

    // Back and forth, with the buttons and with the arrows, and out with Escape.
    await pickHelp(page, 'tour')
    expect((await tourStep(page)).step).toBe(1)
    await expect(card.getByTestId('core-tour-back')).toHaveCount(0)
    await card.getByTestId('core-tour-next').click()
    await expect(card).toHaveAttribute('data-step', '2')
    await card.getByTestId('core-tour-back').click()
    await expect(card).toHaveAttribute('data-step', '1')
    await page.keyboard.press('ArrowRight')
    await expect(card).toHaveAttribute('data-step', '2')
    await page.keyboard.press('ArrowLeft')
    await expect(card).toHaveAttribute('data-step', '1')
    await page.keyboard.press('Escape')
    await expectNoTour(page)

    // Out with its cross.
    await pickHelp(page, 'tour')
    await card.getByTestId('core-tour-close').click()
    await expectNoTour(page)

    for (const language of deployment.languages) {
      await test.step(`in ${language}`, async () => {
        await chooseLanguage(page, deployment.languages, language)
        await openHistory(page)
        await pickHelp(page, 'tour')
        await expect(
          panel,
          'the menu stays open while the tour goes over it',
        ).toBeVisible()
        const titles = await followTour(page)
        expect(titles.length, 'it has steps').toBeGreaterThan(1)
        await leaveMenu(page)
        await expect(panel, 'the menu folds back').toBeHidden()
      })
    }
  })

  test('each page with a tour offers it and it goes over every step; a page without one does not offer it', async ({
    browser,
    page,
    api,
    uat,
    deployment,
    run,
  }) => {
    const schema = deployment.schemas[0]
    // An execution, so the history has a row and there is a table to tour.
    const execution = await solvedExecution(api, uat, schema, 'tours')

    await test.step('the history', async () => {
      await openHistory(page)
      await followPageTour(page, 'the history')
    })

    await test.step('a table of a loaded execution', async () => {
      const ownList = deployment.frontendConfig?.executions?.[schema]?.get_list
      if (ownList) {
        test.info().annotations.push({
          type: 'note',
          description: `the table tour is not tested: ${schema} lists its executions from ${ownList}`,
        })
        return
      }
      await loadFromHistoryRow(page, execution.name)
      await expectSelected(page, execution.id, execution.name)
      await openExecutionView(page, 'input-data')
      await followPageTour(page, 'a table')
    })

    await test.step('the create-execution page', async () => {
      if (!(await offersNewExecution(page))) return
      if (!(await openCreateExecution(page))) {
        test.info().annotations.push({
          type: 'note',
          description:
            "the create-execution tour is not tested: the app has its own flow instead of core's page",
        })
        return
      }
      await followPageTour(page, 'the create-execution page')
    })

    await test.step('the settings', async () => {
      await openSettings(page)
      await followPageTour(page, 'the settings')
    })

    await test.step('roles management', async () => {
      const admin = adminSession(run)
      if (!deployment.core.parameters?.enableRolesManagement || !admin) return
      await asUser(browser, deployment, admin, async (adminPage) => {
        await openRolesManagement(adminPage)
        await followPageTour(adminPage, 'roles management')
      })
    })

    await test.step('a page without a tour: "not found"', async () => {
      await goToRoute(page, '/e2e-no-such-page')
      await expect(page.getByTestId('not-found')).toBeVisible()
      await openHelpMenu(page)
      await expect(helpItem(page, 'page-tour')).toHaveCount(0)
      await page.keyboard.press('Escape')
    })
  })
})
