/**
 * The create-execution page of core, step by step as a user goes through it: bring the data in,
 * name the execution, run the data checks, set its parameters and launch it. An app may replace
 * the page with its own flow (`createExecution.component`); `openCreateExecution` tells.
 */
import { expect, test, type Page } from '@playwright/test'
import { ExecutionState, isExecutionActive } from './cornflowApi'
import { openFromMenu } from './navigation'

export const CREATE_EXECUTION = '/project-execution'

/** How long the data checks may take: a run of the DAG's checks, queued in Airflow first. */
const CHECKS_TIMEOUT = 120_000
/** How long a launch may take to be accepted. */
const LAUNCH_TIMEOUT = 60_000

/**
 * Gives the running test `ms` more on top of its timeout, for a wait that may take that long: the
 * test's own timeout is for its steps, not for what the backend runs.
 */
function allowFor(ms: number): void {
  test.info().setTimeout(test.info().timeout + ms)
}

/**
 * How long to wait for an execution run with `config` to end: its `timeLimit` (seconds, as
 * Cornflow's solvers take it), plus what Airflow needs to start and save it. Three minutes at
 * least.
 */
export function executionTimeout(config: Record<string, unknown>): number {
  const limit = Number(config.timeLimit)
  return Math.max(
    180_000,
    (Number.isFinite(limit) ? limit * 1000 : 0) + 120_000,
  )
}

/** How a run of the data checks ended (`data-status` of `ChecksStatus`). */
export type ChecksOutcome = 'ok' | 'warnings' | 'errors'

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

/** Opens the "Advanced" parameters (the solver goes there), when the page has them. */
export async function openAdvancedParameters(page: Page): Promise<void> {
  const advanced = page.getByTestId('parameters-advanced')
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
  const field = page.getByTestId(`parameter-${key}`)
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
