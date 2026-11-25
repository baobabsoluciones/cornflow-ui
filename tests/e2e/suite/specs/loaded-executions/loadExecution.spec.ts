/**
 * Loading executions and moving between them: from the history (its rows and its detail) and
 * from the latest executions of the side menu, a tab each, the views of the selected one headed by
 * its summary, and the tabs to switch, deselect and close. The executions are made solved through
 * the API first (harness/executions.ts).
 */
import { test, expect } from '../../harness/fixtures'
import { solvedExecution } from '../../harness/executions'
import {
  HISTORY,
  loadFromHistoryDetail,
  loadFromHistoryRow,
  openHistory,
} from '../../harness/history'
import {
  executionTab,
  executionTabClose,
  executionTabs,
  expectNoneSelected,
  expectSelected,
  openExecutionView,
  openFromLatest,
} from '../../harness/loadedExecutions'

test.describe('load an execution', () => {
  let schema = ''

  test.beforeEach(({ deployment }) => {
    schema = deployment.schemas[0]
  })

  test('from its row in the history: a tab opens, selected', async ({
    page,
    api,
    uat,
  }) => {
    const execution = await solvedExecution(api, uat, schema, 'load from row')

    await openHistory(page)
    await loadFromHistoryRow(page, execution.name)

    await expectSelected(page, execution.id, execution.name)
    await expect(executionTabs(page)).toHaveCount(1)
  })

  test('from its detail in the history', async ({ page, api, uat }) => {
    const execution = await solvedExecution(
      api,
      uat,
      schema,
      'load from detail',
    )

    await openHistory(page)
    await loadFromHistoryDetail(page, execution.name)

    await expectSelected(page, execution.id, execution.name)
  })

  test('from the latest executions of the side menu', async ({
    page,
    api,
    uat,
  }) => {
    const execution = await solvedExecution(api, uat, schema, 'load from menu')

    await openFromLatest(page, execution.name)

    await expectSelected(page, execution.id, execution.name)
  })

  test('its input data and its results open headed by its summary', async ({
    page,
    api,
    uat,
  }) => {
    const execution = await solvedExecution(api, uat, schema, 'views')
    await openHistory(page)
    await loadFromHistoryRow(page, execution.name)
    await expectSelected(page, execution.id, execution.name)

    for (const group of ['input-data', 'results'] as const) {
      await openExecutionView(page, group)
      await expect(
        page.getByTestId('execution-summary'),
        `the ${group} of the execution are headed by its summary`,
      ).toContainText(execution.name)
    }
  })
})

test.describe('tabs of the loaded executions', () => {
  let schema = ''

  test.beforeEach(({ deployment }) => {
    schema = deployment.schemas[0]
  })

  test('switch between two, and a second click on the selected one deselects it', async ({
    page,
    api,
    uat,
  }) => {
    const first = await solvedExecution(api, uat, schema, 'tab first')
    const second = await solvedExecution(api, uat, schema, 'tab second')
    await openHistory(page)
    await loadFromHistoryRow(page, first.name)
    await expectSelected(page, first.id, first.name)
    await loadFromHistoryRow(page, second.name)
    await expectSelected(page, second.id, second.name)
    await expect(executionTabs(page)).toHaveCount(2)

    await executionTab(page, first.id).click()
    await expectSelected(page, first.id, first.name)
    await expect(executionTab(page, second.id)).toHaveAttribute(
      'aria-selected',
      'false',
    )

    await executionTab(page, first.id).click()
    await expectNoneSelected(page)
    await expect(executionTabs(page), 'both stay loaded').toHaveCount(2)
  })

  test('closing the selected one on its data goes back to the history, and the other stays', async ({
    page,
    api,
    uat,
  }) => {
    const kept = await solvedExecution(api, uat, schema, 'tab kept')
    const closed = await solvedExecution(api, uat, schema, 'tab closed')
    await openHistory(page)
    await loadFromHistoryRow(page, kept.name)
    await expectSelected(page, kept.id, kept.name)
    await loadFromHistoryRow(page, closed.name)
    await expectSelected(page, closed.id, closed.name)
    await openExecutionView(page, 'input-data')

    await executionTabClose(page, closed.id).click()

    await page.waitForURL((url) => url.href.endsWith(HISTORY))
    await expect(executionTab(page, closed.id)).toHaveCount(0)
    await expect(executionTab(page, kept.id)).toBeVisible()
    await expectNoneSelected(page)

    await executionTabClose(page, kept.id).click()
    await expect(executionTabs(page)).toHaveCount(0)
  })
})
