/**
 * The create-execution page of core, step by step as a user goes through it: bring the data in,
 * name the execution, run the data checks, set its parameters and launch it. An app may replace
 * the page with its own flow (`createExecution.component`); `openCreateExecution` tells.
 */
import { expect, test, type Page } from '@playwright/test'
import { ExecutionState, isExecutionActive } from './cornflowApi'
import { openFromMenu } from './navigation'
import { allowFor } from './timing'
import type { DatasetKind, Uat } from './uat'

export const CREATE_EXECUTION = '/project-execution'

/** How long the data checks may take: a run of the DAG's checks, queued in Airflow first. */
const CHECKS_TIMEOUT = 120_000
/** How long a launch may take to be accepted. */
const LAUNCH_TIMEOUT = 60_000

/** How a run of the data checks ended (`data-status` of `ChecksStatus`). */
export type ChecksOutcome = 'ok' | 'warnings' | 'errors'

/** Whether the side menu offers this user "New execution", folded or not. */
export async function offersNewExecution(page: Page): Promise<boolean> {
  const button = page
    .getByTestId('app-drawer-new-execution')
    .or(page.getByTestId('app-drawer-rail-new-execution'))
  return (await button.count()) > 0
}

/** Opens the page; false when the app has its own flow instead of core's. */
export async function openCreateExecution(page: Page): Promise<boolean> {
  await openFromMenu(page, CREATE_EXECUTION)
  await page.waitForLoadState('networkidle')
  return (
    (await page.getByTestId('data-card').count()) > 0 &&
    (await page.getByTestId('launch-panel').count()) > 0
  )
}

/** Whether the page loads data from files (JSON among them) here. */
export async function loadsJsonFiles(page: Page): Promise<boolean> {
  const input = page.getByTestId('data-card-file-input')
  if (!(await input.count())) return false
  const accept = (await input.getAttribute('accept')) ?? ''
  return !accept || accept.toLowerCase().includes('.json')
}

/** Picks a data file and loads it. Returns whether it ended loaded or with errors. */
export async function loadDataFile(
  page: Page,
  file: string,
): Promise<'loaded' | 'error'> {
  await page.getByTestId('data-card-file-input').setInputFiles(file)
  await page.getByTestId('data-card-load').click()
  const card = page.getByTestId('data-card')
  await expect(card).toHaveAttribute('data-load-status', /^(loaded|error)$/, {
    timeout: 60_000,
  })
  return (await card.getAttribute('data-load-status')) as 'loaded' | 'error'
}

const DATASET_NAMES: Record<DatasetKind, string> = {
  valid: 'valid',
  withErrors: 'with errors',
  withWarnings: 'with warnings',
}

/**
 * Loads a dataset of the UAT file from its JSON file, as the user does. Skips the test when the
 * file does not give that dataset or the page does not take JSON files here (an app that brings
 * its data from a database, for instance).
 */
export async function loadDataset(
  page: Page,
  uat: Uat,
  schema: string,
  dataset: DatasetKind,
): Promise<void> {
  const file = uat.schemas[schema]?.datasets[dataset]
  test.skip(
    !file,
    `the UAT file has no ${DATASET_NAMES[dataset]} dataset for ${schema}`,
  )
  test.skip(
    !(await loadsJsonFiles(page)),
    'the create-execution page does not load JSON data files here',
  )
  expect(await loadDataFile(page, file!), 'the data loads').toBe('loaded')
}

/** Gives the execution its name: the one the suite gives it, so the clean-up finds it. */
export async function nameExecution(page: Page, name: string): Promise<void> {
  await page.getByTestId('launch-panel-name').fill(name)
}

/** Whether the page offers the data checks (the DAG has instance checks). */
export async function hasDataChecks(page: Page): Promise<boolean> {
  return (await page.getByTestId('checks-run').count()) > 0
}

/** Runs the data checks and waits for how they end. */
export async function runDataChecks(page: Page): Promise<ChecksOutcome> {
  allowFor(CHECKS_TIMEOUT)
  await page.getByTestId('checks-run').click()
  const status = page.getByTestId('checks-status')
  await expect(status).toHaveAttribute(
    'data-status',
    /^(ok|warnings|errors)$/,
    {
      timeout: CHECKS_TIMEOUT,
    },
  )
  return (await status.getAttribute('data-status')) as ChecksOutcome
}

/**
 * The parameters of the execution. Only within it: a table of parameters of the data, on the same
 * page, names its rows the same way (`parameter-<key>`).
 */
const parametersForm = (page: Page) => page.getByTestId('parameters-form')

/** Opens the "Advanced" parameters (the solver goes there), when the page has them. */
export async function openAdvancedParameters(page: Page): Promise<void> {
  const advanced = parametersForm(page).getByTestId('parameters-advanced')
  if (
    (await advanced.count()) &&
    (await advanced.getAttribute('aria-expanded')) !== 'true'
  ) {
    await advanced.click()
  }
}

/**
 * Sets a parameter of the execution (the solver among them) as the user would: the buttons, the
 * dropdown, the switch or the field of that parameter, opening "Advanced" when it is there.
 * Returns false when the page does not offer that parameter.
 */
export async function setParameter(
  page: Page,
  key: string,
  value: unknown,
): Promise<boolean> {
  const field = parametersForm(page).getByTestId(`parameter-${key}`)
  if (!(await field.count())) await openAdvancedParameters(page)
  if (!(await field.count())) return false

  const text = String(value)
  const option = field.locator(`[role="radio"][title="${text}"]`)
  const select = field.locator('select')
  const toggle = field.locator('[role="switch"]')
  if (await option.count()) {
    await option.click()
    await expect(option).toHaveAttribute('aria-checked', 'true')
  } else if (await select.count()) {
    await select.selectOption(text)
  } else if (await toggle.count()) {
    if ((await toggle.getAttribute('aria-checked')) !== text)
      await toggle.click()
  } else {
    const input = field.locator('input').first()
    await input.fill(text)
    await input.blur()
  }
  return true
}

/** The button that launches the execution. */
export const resolveButton = (page: Page) =>
  page.getByTestId('launch-panel-resolve')

/**
 * Launches the execution and waits until it ends, `timeoutMs` at most (see `executionTimeout`).
 * Returns its state (`ExecutionState`).
 */
export async function launchAndWait(
  page: Page,
  timeoutMs: number,
): Promise<number> {
  allowFor(LAUNCH_TIMEOUT + timeoutMs)
  await resolveButton(page).click()
  const result = page.getByTestId('launch-result')
  const refused = page.getByTestId('launch-panel-error')
  await expect(result.or(refused)).toBeVisible({ timeout: LAUNCH_TIMEOUT })
  if (await refused.isVisible()) {
    throw new Error(
      `The execution could not be launched: ${(await refused.innerText()).trim()}`,
    )
  }
  // Queued (-7) until the store has it, then as Cornflow reports it.
  await expect
    .poll(
      async () =>
        !isExecutionActive(Number(await result.getAttribute('data-state'))),
      {
        timeout: timeoutMs,
        intervals: [1000],
        message: 'the launched execution ends',
      },
    )
    .toBe(true)
  return Number(await result.getAttribute('data-state'))
}

/** Opens the result of the execution just launched, as the user does once it has ended. */
export async function openResult(page: Page): Promise<void> {
  const view = page.getByTestId('launch-result-view')
  await expect(view, 'the result can be opened').toBeEnabled()
  await view.click()
  await page.waitForURL((url) => !url.href.endsWith(CREATE_EXECUTION))
}

/** Rows the data tables on screen show, counting only those done loading. */
export async function shownRows(page: Page): Promise<number> {
  const rows = await page
    .locator('[data-testid="data-table"][data-status="ready"]:visible')
    .evaluateAll((tables) =>
      tables.map((table) => Number(table.getAttribute('data-rows') ?? 0)),
    )
  return rows.reduce((total, count) => total + count, 0)
}

export { ExecutionState }

/** Whether the page takes data files with the extension `extension` (`xlsx`, `csv`, `json`). */
export async function acceptsFiles(
  page: Page,
  extension: string,
): Promise<boolean> {
  const input = page.getByTestId('data-card-file-input')
  if (!(await input.count())) return false
  const accept = (await input.getAttribute('accept')) ?? ''
  return !accept || accept.toLowerCase().includes(`.${extension}`)
}

/** Picks several data files at once and loads them. Returns whether it ended loaded or with errors. */
export async function loadDataFiles(
  page: Page,
  files: string[],
): Promise<'loaded' | 'error'> {
  await page.getByTestId('data-card-file-input').setInputFiles(files)
  await page.getByTestId('data-card-load').click()
  const card = page.getByTestId('data-card')
  await expect(card).toHaveAttribute('data-load-status', /^(loaded|error)$/, {
    timeout: 60_000,
  })
  return (await card.getAttribute('data-load-status')) as 'loaded' | 'error'
}

/**
 * Downloads the data loaded on the page to Excel, from the data card's Excel menu, into the test's
 * output. Returns where it went.
 */
export async function downloadDataExcel(page: Page): Promise<string> {
  await page.getByTestId('data-card-excel').click()
  const [downloaded] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('data-card-excel-download').click(),
  ])
  const file = test.info().outputPath(downloaded.suggestedFilename())
  await downloaded.saveAs(file)
  return file
}

/** Overwrites the data loaded on the page with an Excel workbook, from the data card's Excel menu. */
export async function overwriteWithExcel(
  page: Page,
  file: string,
): Promise<void> {
  await page.getByTestId('data-card-excel').click()
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByTestId('data-card-excel-upload').click(),
  ])
  await chooser.setFiles(file)
}

/**
 * Turns the launch into "create with this solution" (developer mode: the "⋮" next to the launch
 * button) and picks the solution file. Returns whether the page took it, or what it found wrong.
 */
export async function pickSolution(
  page: Page,
  file: string,
): Promise<'taken' | 'refused'> {
  if (!(await page.getByTestId('launch-panel-solution').count())) {
    await page.getByTestId('launch-panel-more').click()
    await page.getByTestId('launch-panel-solution-mode').click()
  }
  await page.getByTestId('launch-panel-solution-input').setInputFiles(file)
  const taken = page.getByTestId('launch-panel-solution-file')
  const refused = page.getByTestId('launch-panel-solution-error')
  await expect(taken.or(refused)).toBeVisible()
  return (await taken.isVisible()) ? 'taken' : 'refused'
}
