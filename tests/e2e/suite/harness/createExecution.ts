/**
 * The create-execution page of core, step by step as a user goes through it: bring the data in,
 * name the execution, run the data checks, set its parameters and launch it. An app may replace
 * the page with its own flow (`createExecution.component`); `openCreateExecution` tells.
 */
import { expect, type Page } from '@playwright/test'
import { ExecutionState, isExecutionActive } from './cornflowApi'
import { openFromMenu } from './navigation'

export const CREATE_EXECUTION = '/project-execution'

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
  await page.getByTestId('checks-run').click()
  const status = page.getByTestId('checks-status')
  await expect(status).toHaveAttribute(
    'data-status',
    /^(ok|warnings|errors)$/,
    {
      timeout: 120_000,
    },
  )
  return (await status.getAttribute('data-status')) as ChecksOutcome
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
  if (!(await field.count())) {
    const advanced = page.getByTestId('parameters-advanced')
    if (
      (await advanced.count()) &&
      (await advanced.getAttribute('aria-expanded')) !== 'true'
    ) {
      await advanced.click()
    }
  }
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

/** Launches the execution and waits until it ends. Returns its state (`ExecutionState`). */
export async function launchAndWait(
  page: Page,
  timeoutMs = 180_000,
): Promise<number> {
  await resolveButton(page).click()
  const result = page.getByTestId('launch-result')
  await expect(result).toBeVisible({ timeout: 60_000 })
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

export { ExecutionState }
