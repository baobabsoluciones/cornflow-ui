/**
 * The execution history of the schema the app opens with. Its executions are made through the
 * API as the page's own user, created and not run: listing them needs no solver.
 */
import { test, expect } from '../../harness/fixtures'
import { openFromMenu } from '../../harness/navigation'
import { readDataset } from '../../harness/uat'

const HISTORY = '/history-execution'

test.describe('history', () => {
  test('opens and loads the executions', async ({ page }) => {
    await openFromMenu(page, HISTORY)
    await expect(page.getByTestId('history-loading')).toHaveCount(0)
    await expect(page.getByTestId('history-summary')).toBeVisible()
  })

  test('lists the executions the user made, finds them by name and opens one', async ({
    page,
    deployment,
    uat,
    api,
  }) => {
    const schema = deployment.schemas[0]
    const data = readDataset(uat, schema, 'valid')
    test.skip(!data, `the UAT file has no valid dataset for ${schema}`)
    const ownList = deployment.frontendConfig?.executions?.[schema]?.get_list
    test.skip(
      !!ownList,
      `${schema} lists its executions from the backend's own ${ownList}, where executions ` +
        'made in Cornflow may not show',
    )

    const instanceId = await api.createInstance({
      schema,
      data: data!,
      label: 'history',
    })
    const config = uat.schemas[schema].config
    for (const label of ['history first', 'history second']) {
      await api.createExecution({
        instanceId,
        schema,
        config,
        label,
        run: false,
      })
    }
    const first = api.name('history first')
    const second = api.name('history second')

    await openFromMenu(page, HISTORY)
    const rows = page.getByTestId('history-row')
    const search = page.getByTestId('history-search').locator('input')

    // The run's two, and nothing else.
    await search.fill(api.name('history'))
    await expect(rows).toHaveCount(2)
    await expect(rows.filter({ hasText: first })).toHaveCount(1)
    await expect(rows.filter({ hasText: second })).toHaveCount(1)

    // The search narrows the list, and clearing it brings the rest back.
    await search.fill(first)
    await expect(rows).toHaveCount(1)
    await page.getByTestId('history-clear-filters').click()
    await expect(search).toHaveValue('')
    await expect(rows.filter({ hasText: second })).toHaveCount(1)

    // Choosing one shows it in the detail panel.
    await rows.filter({ hasText: second }).click()
    await expect(page.getByTestId('history-detail')).toContainText(second)
  })
})
