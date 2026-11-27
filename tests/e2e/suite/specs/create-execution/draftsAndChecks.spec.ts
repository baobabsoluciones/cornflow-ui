/**
 * More of core's create-execution page (`/project-execution`):
 *
 * - Leaving with data loaded asks first: staying keeps it; saving keeps a draft that the page
 *   offers to resume, or to throw away, on coming back; leaving without saving drops it. Drafts
 *   live in the browser: the backend gets nothing.
 * - A data file that does not follow the schema is turned down: the page says how many errors it
 *   found, and they download to Excel, one row each.
 * - The detail of the data checks lists each check that found something, an error or a warning
 *   as its schema says, with its rows: the same the backend finds in the same data.
 * - Once launched, "Launch another" starts a new execution, with nothing loaded.
 *
 * An app with its own create-execution flow (`dagCreateExecutionFlows`) is skipped, as in
 * createExecution.spec.ts.
 */
import fs from 'node:fs'
import type { Page } from '@playwright/test'
import { test, expect } from '../../harness/fixtures'
import {
  CREATE_EXECUTION,
  hasDataChecks,
  launchAndWait,
  loadDataFile,
  loadDataset,
  loadsJsonFiles,
  nameExecution,
  openCreateExecution,
  runDataChecks,
  setParameter,
} from '../../harness/createExecution'
import { download } from '../../harness/executionData'
import { HISTORY } from '../../harness/history'
import { currentView, leaveMenu } from '../../harness/navigation'
import { rowProperties, isNumber } from '../../harness/dataTables'
import { executionTimeout } from '../../harness/timing'
import { readDataset } from '../../harness/uat'
import { readSheets } from '../../harness/xlsx'

const card = (page: Page) => page.getByTestId('data-card')
const banner = (page: Page) => page.getByTestId('draft-banner')
const nameField = (page: Page) => page.getByTestId('launch-panel-name')

/** Leaves the page for the history from the side menu, as the user does. */
async function leaveForHistory(page: Page): Promise<void> {
  await page
    .getByTestId('app-drawer')
    .locator(`a[href$="${HISTORY}"]`)
    .first()
    .click()
}

/** Comes back to the page from the side menu, and waits until it is there. */
async function comeBack(page: Page): Promise<void> {
  await page.waitForURL((url) => url.href.endsWith(HISTORY))
  await leaveMenu(page)
  expect(await openCreateExecution(page)).toBe(true)
}

test.describe('create execution: drafts, errors and checks', () => {
  let schema = ''

  test.beforeEach(async ({ page, deployment }) => {
    schema = deployment.schemas[0]
    test.skip(
      !(await openCreateExecution(page)),
      "the app has its own create-execution flow instead of core's page",
    )
  })

  test('leaving with data loaded asks first: staying keeps it, saving keeps a draft to resume or throw away, leaving without saving drops it', async ({
    page,
    uat,
    api,
  }) => {
    const name = api.name('draft')
    const exitSave = page.getByTestId('exit-save')

    await test.step('staying keeps the data', async () => {
      await loadDataset(page, uat, schema, 'valid')
      await nameExecution(page, name)
      await leaveForHistory(page)
      await expect(exitSave, 'it asks first').toBeVisible()
      await page.keyboard.press('Escape')
      await expect(exitSave).toBeHidden()
      expect(currentView(page)).toBe(CREATE_EXECUTION.slice(1))
      await expect(card(page)).toHaveAttribute('data-load-status', 'loaded')
      await expect(nameField(page)).toHaveValue(name)
    })

    await test.step('saving keeps a draft, offered on coming back, and resuming it brings the data back', async () => {
      await leaveForHistory(page)
      await exitSave.click()
      await comeBack(page)
      await expect(banner(page), 'the draft is offered').toBeVisible()
      await expect(card(page)).toHaveAttribute('data-load-status', 'empty')
      await page.getByTestId('draft-banner-resume').click()
      await expect(card(page)).toHaveAttribute('data-load-status', 'loaded')
      await expect(nameField(page)).toHaveValue(name)
      await expect(banner(page)).toBeHidden()
    })

    await test.step('leaving without saving drops it', async () => {
      await leaveForHistory(page)
      await page.getByTestId('exit-leave').click()
      await comeBack(page)
      await expect(card(page)).toHaveAttribute('data-load-status', 'empty')
      await expect(
        banner(page),
        'no draft: the one resumed is gone',
      ).toBeHidden()
    })

    await test.step('a draft thrown away is not offered again', async () => {
      await loadDataset(page, uat, schema, 'valid')
      await leaveForHistory(page)
      await exitSave.click()
      await comeBack(page)
      await expect(banner(page)).toBeVisible()
      await banner(page)
        .locator('button:not([data-testid="draft-banner-resume"])')
        .click()
      await expect(banner(page)).toBeHidden()
      await page.reload()
      await expect(card(page)).toHaveAttribute('data-load-status', 'empty')
      await expect(banner(page), 'not after reloading either').toBeHidden()
    })
  })

  test('a data file that does not follow the schema is turned down, says how many errors it has, and they download to Excel', async ({
    page,
    uat,
    api,
  }) => {
    test.skip(
      !(await loadsJsonFiles(page)),
      'the create-execution page does not load JSON data files here',
    )
    const data = readDataset(uat, schema, 'valid')
    test.skip(!data, `the UAT file has no valid dataset for ${schema}`)
    // A number of the data made text: the schema wants a number there.
    const tables = await api.instanceSchema(schema)
    const broken = structuredClone(data!) as Record<string, unknown>
    const place = Object.entries(broken)
      .filter(([, rows]) => Array.isArray(rows) && rows.length > 0)
      .flatMap(([table, rows]) =>
        Object.entries(rowProperties(tables, table))
          .filter(([, property]) => isNumber(property))
          .map(([column]) => ({
            table,
            column,
            row: (rows as Record<string, unknown>[])[0],
          })),
      )
      .find(({ row, column }) => typeof row[column] === 'number')
    test.skip(
      !place,
      `no table of the valid dataset of ${schema} has a number to break`,
    )
    place!.row[place!.column] = 'not a number'
    const file = test.info().outputPath('broken.json')
    fs.writeFileSync(file, JSON.stringify(broken))

    expect(await loadDataFile(page, file), 'it is turned down').toBe('error')
    const errors = page.getByTestId('data-card-errors')
    await expect(errors).toBeVisible()
    const count = Number(await errors.getAttribute('data-count'))
    expect(
      count,
      `it finds the error in ${place!.table}.${place!.column}`,
    ).toBeGreaterThan(0)

    const { file: workbook } = await download(page, () =>
      page.getByTestId('data-card-errors-download').click(),
    )
    const [sheet] = readSheets(workbook)
    // A header and a line with the total, then a row per error.
    expect(sheet.rows - 2, 'a row per error').toBe(count)
  })

  test('the detail of the checks lists each one that found something, as the backend finds it, with its rows', async ({
    page,
    uat,
    api,
  }) => {
    const data = readDataset(uat, schema, 'withErrors')
    test.skip(!data, `the UAT file has no dataset with errors for ${schema}`)
    await loadDataset(page, uat, schema, 'withErrors')
    test.skip(!(await hasDataChecks(page)), `${schema} has no data checks`)
    expect(await runDataChecks(page)).not.toBe('ok')

    // What the backend finds in the same data, and whether each is an error or a warning.
    const instanceId = await api.createInstance({
      schema,
      data: data!,
      label: 'checks detail',
    })
    const checks = await api.checkInstance(
      instanceId,
      schema,
      uat.schemas[schema].config,
    )
    const properties = (await api.instanceChecksSchema(schema)).properties ?? {}
    const expected = Object.entries(properties)
      .map(([key, property]) => ({
        kind: property.is_warning === false ? 'error' : 'warning',
        count: Array.isArray(checks[key])
          ? (checks[key] as unknown[]).length
          : 0,
      }))
      .filter(({ count }) => count > 0)
      .map(({ kind, count }) => `${kind}: ${count}`)
      .sort()

    await page.getByTestId('checks-detail-open').click()
    const detail = page.getByTestId('checks-detail')
    await expect(detail).toBeVisible()
    const listed = detail.getByTestId('checks-detail-check')
    const shown = (
      await listed.evaluateAll((all) =>
        all.map(
          (check) =>
            `${check.getAttribute('data-kind')}: ${check.getAttribute('data-count')}`,
        ),
      )
    ).sort()
    expect(shown, 'each check that found something, with its rows').toEqual(
      expected,
    )

    for (const check of await listed.all()) {
      const count = Number(await check.getAttribute('data-count'))
      await check.click()
      const rows = detail.locator('tbody tr')
      await expect
        .poll(() => rows.count(), { message: 'its rows show' })
        .toBeGreaterThan(0)
      expect(
        await rows.count(),
        'no more rows than it found',
      ).toBeLessThanOrEqual(count)
    }
    await page.keyboard.press('Escape')
  })

  test('once launched, "Launch another" starts a new execution with nothing loaded', async ({
    page,
    uat,
    api,
  }) => {
    const name = api.name('launch another')
    await loadDataset(page, uat, schema, 'valid')
    await nameExecution(page, name)
    const config = uat.schemas[schema].config
    for (const [key, value] of Object.entries(config))
      await setParameter(page, key, value)
    await launchAndWait(page, executionTimeout(config))
    // Made by the page: found, so the clean-up deletes it.
    expect(await api.findExecution(name), 'it was made').not.toBeNull()

    await page.getByTestId('launch-result-another').click()
    await expect(page.getByTestId('launch-result')).toBeHidden()
    await expect(card(page)).toHaveAttribute('data-load-status', 'empty')
    await expect(nameField(page)).not.toHaveValue(name)
  })
})
