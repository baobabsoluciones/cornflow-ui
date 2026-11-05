import type { Page } from '@playwright/test';
import { TIMEOUTS } from './constants';

/**
 * Returns true when at least one execution tab (excluding "New execution") exists.
 */
async function hasLoadedExecutionTab(page: Page): Promise<boolean> {
  const tablist = page.getByRole('tablist');
  const tablistVisible = await tablist.isVisible().catch(() => false);
  if (!tablistVisible) return false;

  const executionTabs = tablist.getByRole('tab').filter({
    hasNot: page.getByText(/Nueva ejecución|New execution/i),
  });

  return (await executionTabs.count().catch(() => 0)) > 0;
}

/**
 * Polls for an execution tab for a short period.
 */
async function waitForLoadedExecutionTab(page: Page, timeoutMs = TIMEOUTS.FORM_LOAD): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await hasLoadedExecutionTab(page)) return true;
    await page.waitForTimeout(250);
  }
  return false;
}

/**
 * Ensures execution tab does not disappear right after being loaded.
 */
export async function waitForStableLoadedExecutionTab(
  page: Page,
  stableMs = 1500,
  timeoutMs = TIMEOUTS.FORM_LOAD
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (!(await hasLoadedExecutionTab(page))) {
      await page.waitForTimeout(250);
      continue;
    }

    const stableStart = Date.now();
    let stayedVisible = true;
    while (Date.now() - stableStart < stableMs) {
      if (!(await hasLoadedExecutionTab(page))) {
        stayedVisible = false;
        break;
      }
      await page.waitForTimeout(200);
    }

    if (stayedVisible) return true;
  }

  return false;
}

/** The rows of the history list. */
const historyRows = (page: Page) => page.locator('[data-testid="history-row"]');

/** Rows marked as the current plan carry its star tag. */
const isCurrentPlanRow = async (page: Page, rowIndex: number): Promise<boolean> =>
  (await historyRows(page).nth(rowIndex).locator('.core-badge .mdi-star').count()) > 0;

/**
 * Finds the "load execution" action of a history row. It shows on hover, so the row is hovered
 * first.
 */
export async function findLoadExecutionButtonInRow(page: Page, rowIndex: number) {
  const row = historyRows(page).nth(rowIndex);
  await row.hover().catch(() => {});
  const loadButton = row.locator('[data-testid="history-row-load"]').first();
  const visible = await loadButton.isVisible().catch(() => false);
  return visible ? loadButton : null;
}

export async function ensureHistoryHasRows(page: Page): Promise<number> {
  const rows = historyRows(page);
  await rows.first().waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD }).catch(() => {});
  return rows.count().catch(() => 0);
}

/**
 * Loads a non-current execution from History page and keeps it active.
 * Returns true if any execution was loaded.
 */
export async function loadNonCurrentExecutionFromHistory(
  page: Page
): Promise<boolean> {
  await page.goto('/history-execution', { waitUntil: 'domcontentloaded' });

  let rowCount = await ensureHistoryHasRows(page);
  if (rowCount < 1) return false;

  const tryLoadFromRows = async (skipCurrentPlanRows: boolean): Promise<boolean> => {
    // Refresh row count in case the filters changed.
    rowCount = await ensureHistoryHasRows(page);
    for (let i = 0; i < rowCount; i++) {
      if (skipCurrentPlanRows && (await isCurrentPlanRow(page, i))) continue;

      const loadButton = await findLoadExecutionButtonInRow(page, i);
      if (loadButton) {
        await loadButton.click().catch(async () => {
          await loadButton.click({ force: true });
        });
        // Wait until execution tab appears and remains visible for a short period.
        if (await waitForStableLoadedExecutionTab(page, 1200, 5000)) return true;
        await page.waitForTimeout(1200);
        if (await waitForStableLoadedExecutionTab(page, 1200, 3000)) return true;
      }
    }

    return false;
  };

  // Prefer non-current execution for scenarios that require state transitions.
  if (await tryLoadFromRows(true)) {
    return true;
  }

  // Fallback: if only current plan exists, still load it to unblock tests
  // that just need any execution tab to be active.
  return tryLoadFromRows(false);
}

/**
 * Loads executions from History (non-current rows first, then any row) until
 * `until` returns true — e.g. drawer shows Validations (depends on dataChecks).
 */
export async function loadExecutionFromHistoryUntil(
  page: Page,
  until: (page: Page) => Promise<boolean>
): Promise<boolean> {
  await page.goto('/history-execution', { waitUntil: 'domcontentloaded' });

  let rowCount = await ensureHistoryHasRows(page);
  if (rowCount < 1) return false;

  const tryLoadFromRows = async (skipCurrentPlanRows: boolean): Promise<boolean> => {
    rowCount = await ensureHistoryHasRows(page);
    for (let i = 0; i < rowCount; i++) {
      if (skipCurrentPlanRows && (await isCurrentPlanRow(page, i))) continue;

      const loadButton = await findLoadExecutionButtonInRow(page, i);
      if (!loadButton) continue;

      await loadButton.click().catch(async () => {
        await loadButton.click({ force: true });
      });

      if (!(await waitForStableLoadedExecutionTab(page, 1200, 5000))) {
        await page.waitForTimeout(1200);
        if (!(await waitForStableLoadedExecutionTab(page, 1200, 3000))) continue;
      }

      if (await until(page)) return true;
    }

    return false;
  };

  if (await tryLoadFromRows(true)) return true;
  return tryLoadFromRows(false);
}

/**
 * Ensures one execution is loaded; if missing, it loads one from History.
 */
export async function ensureExecutionLoaded(page: Page): Promise<boolean> {
  if (await waitForStableLoadedExecutionTab(page, 1200, 3000)) return true;

  const loadedFromHistory = await loadNonCurrentExecutionFromHistory(page);
  if (!loadedFromHistory) return false;

  if (await waitForStableLoadedExecutionTab(page, 1500, TIMEOUTS.FORM_LOAD)) return true;

  // One retry for slow environments where execution activation is delayed or reset.
  const retriedLoad = await loadNonCurrentExecutionFromHistory(page);
  if (!retriedLoad) return false;

  return waitForStableLoadedExecutionTab(page, 1500, TIMEOUTS.FORM_LOAD);
}
