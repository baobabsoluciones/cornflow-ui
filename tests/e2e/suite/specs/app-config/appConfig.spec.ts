/**
 * What the app's settings turn on everywhere, on or off as each deployment has it:
 *
 * - The staging notice (`isStagingEnvironment`, from the environment or values.json) runs along
 *   the top of every page; off, never.
 * - The warnings (`enableWarnings`): a bell lists the warnings the client's backend gives
 *   (`/external/warnings/`), read only, and downloads them all; off, there is no bell.
 */
import { test, expect } from '../../harness/fixtures'
import { CREATE_EXECUTION } from '../../harness/createExecution'
import { download } from '../../harness/executionData'
import { externalUrl, readFromPage } from '../../harness/external'
import { openHistory } from '../../harness/history'
import { goToRoute } from '../../harness/navigation'

test.describe('app config', () => {
  test('the staging notice runs along the top of every page where isStagingEnvironment is on, and never where it is off', async ({
    page,
    deployment,
  }) => {
    const on = !!deployment.isStagingEnvironment
    test.info().annotations.push({
      type: 'note',
      description: `isStagingEnvironment is ${on ? 'on' : 'off'}`,
    })
    for (const route of [
      '/history-execution',
      CREATE_EXECUTION,
      '/user-settings',
    ]) {
      await test.step(route, async () => {
        await goToRoute(page, route)
        await expect(
          page.getByTestId('staging-warning'),
          `the notice ${on ? 'shows' : 'does not show'}`,
        ).toHaveCount(on ? 1 : 0)
      })
    }
  })

  test('with enableWarnings, a bell lists the warnings the backend gives and downloads them all; off, there is no bell', async ({
    page,
    deployment,
  }) => {
    const on = !!deployment.core.parameters?.enableWarnings
    await openHistory(page)
    const bell = page.getByTestId('warnings-trigger')
    if (!on) {
      test.info().annotations.push({
        type: 'note',
        description: 'enableWarnings is off: no bell',
      })
      await expect(bell).toHaveCount(0)
      return
    }

    const { status, body } = await readFromPage(
      page,
      externalUrl(deployment, '/warnings/'),
    )
    expect(status, 'the backend gives its warnings').toBe(200)
    const warnings = Array.isArray(body) ? body : []

    await bell.click()
    const panel = page.getByTestId('warnings-panel')
    await expect(panel).toBeVisible()
    await expect(
      panel.getByTestId('warnings-item'),
      'each warning of the backend',
    ).toHaveCount(warnings.length)
    const downloadAll = panel.getByTestId('warnings-download')
    if (!warnings.length) {
      await expect(downloadAll, 'nothing to download').toHaveCount(0)
      return
    }
    const { name } = await download(page, () => downloadAll.click())
    expect(name, 'a file with them').not.toBe('')
  })
})
