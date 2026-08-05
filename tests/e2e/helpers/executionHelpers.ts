import type { Page } from '@playwright/test';
import { TIMEOUTS } from './constants';

/**
 * Returns true when at least one execution tab (excluding "Add new") exists.
 */
async function hasLoadedExecutionTab(page: Page): Promise<boolean> {
  const tablist = page.getByRole('tablist');
  const tablistVisible = await tablist.isVisible().catch(() => false);
  if (!tablistVisible) return false;

  const executionTabs = tablist.getByRole('tab').filter({
    hasNot: page.getByText(/Añadir nuevo|Add new/i),
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

/**
 * Finds the "load execution" trigger within a history row.
 * Prioritizes explicit tray-arrow-up icon selectors to avoid clicking other actions.
 */
export async function findLoadExecutionButtonInRow(page: Page, rowIndex: number) {
  const row = page.locator('tbody tr, .v-data-table tbody tr, .execution-table tbody tr').nth(rowIndex);

  // Deterministic target: first action in actions column is "load execution".
  const firstActionButton = row
    .locator('.actions-container')
    .first()
    .locator('span')
    .first()
    .locator('.v-icon, button, i')
    .first();
  const firstActionVisible = await firstActionButton.isVisible().catch(() => false);
  if (firstActionVisible) return firstActionButton;

  const iconSelectors = [
    '.actions-container [class*="mdi-tray-arrow-up"]',
    '.actions-container .mdi-tray-arrow-up',
    '.actions-container i.mdi-tray-arrow-up',
    '[class*="mdi-tray-arrow-up"]',
    '.mdi-tray-arrow-up',
    'i.mdi-tray-arrow-up',
    '[class*="mdi"][class*="tray-arrow-up"]',
  ];

  for (const selector of iconSelectors) {
    const icon = row.locator(selector).first();
    const visible = await icon.isVisible().catch(() => false);
    if (visible) return icon;
  }

  const tooltipBased = row
    .locator(
      '[title*="Cargar ejecución"], [title*="Load execution"], [aria-label*="Cargar ejecución"], [aria-label*="Load execution"]'
    )
    .first();
  const tooltipVisible = await tooltipBased.isVisible().catch(() => false);
  if (tooltipVisible) return tooltipBased;

  // Last fallback: scan visible icons and choose the tray-arrow icon only.
  const icons = row.locator('.actions-container .v-icon, .v-icon, i[class*="mdi"]');
  const iconCount = await icons.count().catch(() => 0);
  for (let i = 0; i < iconCount; i++) {
    const icon = icons.nth(i);
    const iconClass = await icon.getAttribute('class').catch(() => '');
    const visible = await icon.isVisible().catch(() => false);
    if (visible && iconClass?.includes('mdi-tray-arrow-up')) return icon;
  }

  // Final fallback: first action button in the last cell.
  // In this app, "load execution" is rendered before delete in actions.
  const lastCellFirstButton = row.locator('td').last().locator('button').first();
  const lastCellFirstButtonVisible = await lastCellFirstButton.isVisible().catch(() => false);
  if (lastCellFirstButtonVisible) return lastCellFirstButton;

  return null;
}

export async function ensureHistoryHasRows(page: Page): Promise<number> {
  const tableRows = page.locator('tbody tr, .v-data-table tbody tr, .execution-table tbody tr');
  await tableRows.first().waitFor({ state: 'visible', timeout: 2000 }).catch(() => {});

  let rowCount = await tableRows.count().catch(() => 0);
  if (rowCount > 0) return rowCount;

  // If there are no rows, broaden the date filter window.
  const last30DaysCheckbox = page.getByRole('checkbox', {
    name: /Últimos 30 días|Last 30 days/i,
  });
  const checkboxVisible = await last30DaysCheckbox.isVisible().catch(() => false);
  if (checkboxVisible) {
    const checked = await last30DaysCheckbox.isChecked().catch(() => false);
    if (!checked) {
      await last30DaysCheckbox.check().catch(async () => {
        await last30DaysCheckbox.click({ force: true });
      });
    }
    await page.waitForTimeout(1000);
  }

  rowCount = await tableRows.count().catch(() => 0);
  return rowCount;
}

/**
 * Loads a non-current execution from History page and keeps it active.
 * Returns true if any execution was loaded.
 */
export async function loadNonCurrentExecutionFromHistory(
  page: Page
): Promise<boolean> {
  await page.goto('/history-execution', { waitUntil: 'domcontentloaded' });

  const table = page.getByRole('table').first();
  await table.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD }).catch(() => {});

  const tableRows = page.locator('tbody tr, .v-data-table tbody tr, .execution-table tbody tr');
  let rowCount = await ensureHistoryHasRows(page);
  if (rowCount < 1) return false;

  const tryLoadFromRows = async (skipCurrentPlanRows: boolean): Promise<boolean> => {
    // Refresh row count in case filters/table changed.
    rowCount = await ensureHistoryHasRows(page);
    for (let i = 0; i < rowCount; i++) {
      const row = tableRows.nth(i);
      const hasLatestPlanChip = (await row.locator('.latest-plan-chip').count()) > 0;
      if (skipCurrentPlanRows && hasLatestPlanChip) continue;

      await row.hover();
      await page.waitForTimeout(300);

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

  const table = page.getByRole('table').first();
  await table.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD }).catch(() => {});

  const tableRows = page.locator('tbody tr, .v-data-table tbody tr, .execution-table tbody tr');
  let rowCount = await ensureHistoryHasRows(page);
  if (rowCount < 1) return false;

  const tryLoadFromRows = async (skipCurrentPlanRows: boolean): Promise<boolean> => {
    rowCount = await ensureHistoryHasRows(page);
    for (let i = 0; i < rowCount; i++) {
      const row = tableRows.nth(i);
      const hasLatestPlanChip = (await row.locator('.latest-plan-chip').count()) > 0;
      if (skipCurrentPlanRows && hasLatestPlanChip) continue;

      await row.hover();
      await page.waitForTimeout(300);

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
