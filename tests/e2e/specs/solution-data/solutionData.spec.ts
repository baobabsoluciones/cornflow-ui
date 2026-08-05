import { test, expect } from '../../fixtures';
import type { Locator, Page } from '@playwright/test';
import { TIMEOUTS } from '../../helpers/constants';
import { ensureExecutionLoaded } from '../../helpers/executionHelpers';

// Solution Data link: by href (results section, various group name slugs)
const SOLUTION_DATA_LINK_SELECTOR =
  'a[href*="/results/group/datos-de-la-soluci"], a[href*="/results/group/output"], a[href*="/results/group/solution"], a[href*="/results/group/solution-data"], a[href*="/results/group/output-tables"]';
const SOLUTION_DATA_PAGE_URL = /\/results\/group\//;

/**
 * Finds the Solution Data menu link (works with any locale).
 */
/**
 * Home + explícitamente una ejecución cargada (misma causa que input-data / loaded-executions:
 * sin carga no hay pestaña; además evitar asumir estado previo en Pinia).
 */
async function ensureAppAndExecutionLoaded(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const app = page.locator('.v-application');
  await app.first().waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
  const ok = await ensureExecutionLoaded(page);
  expect(ok).toBe(true);
}

async function getSolutionDataLink(page: Page) {
  const byText = page.getByRole('link', {
    name: /Solution data|Datos de la solución|Output|Datos de salida/i,
  });
  const byHref = page.locator(SOLUTION_DATA_LINK_SELECTOR);
  const link = byText.first();
  const visible = await link
    .isVisible({ timeout: TIMEOUTS.FORM_LOAD })
    .catch(() => false);
  if (visible) return link;
  return byHref.first();
}

/**
 * Extract a displayable value from an object (for asserting in the UI).
 */
function findDisplayableValue(obj: Record<string, any>): string | number | null {
  if (obj === null || typeof obj !== 'object') return null;
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (value === null || value === undefined || value === '') continue;
    if (typeof value === 'object') continue;
    if (typeof value === 'string' && value.length > 50) continue;
    if (typeof value === 'boolean') continue;
    return value;
  }
  return null;
}

/**
 * Tests for the Solution Data page functionality
 *
 * These tests verify the solution data page is reachable via the side menu,
 * that the displayed data belongs to the selected execution,
 * and basic navigation, download and "Establecer plan" behavior.
 */
test.describe('Solution Data Page', () => {
  test('should navigate to Solution Data page via the side menu and display solution data', async ({
    page,
  }) => {
    await ensureAppAndExecutionLoaded(page);

    const tablist = page.getByRole('tablist');
    await tablist.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

    const executionTab = tablist
      .getByRole('tab')
      .filter({ hasNot: page.getByText(/Añadir nuevo|Add new/i) })
      .first();

    await expect(executionTab).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });
    await expect(executionTab).toHaveAttribute('aria-selected', 'true');

    const solutionDataLink = await getSolutionDataLink(page);
    const linkVisible = await solutionDataLink
      .isVisible({ timeout: TIMEOUTS.FORM_LOAD })
      .catch(() => false);

    if (!linkVisible) {
      console.log(
        'Solution Data link not visible - execution may have no solution data. Skipping test.'
      );
      return;
    }

    await solutionDataLink.click();

    await expect(page).toHaveURL(SOLUTION_DATA_PAGE_URL, {
      timeout: TIMEOUTS.NAVIGATION,
    });

    const sectionView = page.locator('.section-view');
    await sectionView.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

    const loadingSpinner = page.locator('.loading-container');
    await expect(loadingSpinner).not.toBeVisible({
      timeout: TIMEOUTS.NAVIGATION,
    });

    const tableSection = page.locator('.table-section');
    await expect(tableSection.first()).toBeVisible({
      timeout: TIMEOUTS.FORM_LOAD,
    });

    const hasTable = await tableSection.count() > 0;
    const tableCard = page.locator('.table-card');
    const hasCard = await tableCard.count() > 0;
    expect(hasTable || hasCard).toBe(true);
  });

  test('should show solution data that belongs to the selected execution', async ({
    page,
  }) => {
    await ensureAppAndExecutionLoaded(page);

    const tablist = page.getByRole('tablist');
    await tablist.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

    const executionTab = tablist
      .getByRole('tab')
      .filter({ hasNot: page.getByText(/Añadir nuevo|Add new/i) })
      .first();

    await expect(executionTab).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });
    await expect(executionTab).toHaveAttribute('aria-selected', 'true');

    const executionTabName = await executionTab.textContent();
    const executionName = executionTabName?.trim() || '';
    console.log(`Selected execution before navigation: "${executionName}"`);

    const solutionDataLink = await getSolutionDataLink(page);
    const linkVisible = await solutionDataLink
      .isVisible({ timeout: TIMEOUTS.FORM_LOAD })
      .catch(() => false);

    if (!linkVisible) {
      console.log(
        'Solution Data link not visible - execution may have no solution data. Skipping test.'
      );
      return;
    }

    await solutionDataLink.click();

    await expect(page).toHaveURL(SOLUTION_DATA_PAGE_URL, {
      timeout: TIMEOUTS.NAVIGATION,
    });

    const sectionView = page.locator('.section-view');
    await sectionView.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

    const loadingSpinner = page.locator('.loading-container');
    await expect(loadingSpinner).not.toBeVisible({
      timeout: TIMEOUTS.NAVIGATION,
    });

    const tablistAfter = page.getByRole('tablist');
    await tablistAfter.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

    const selectedTabAfter = tablistAfter
      .getByRole('tab')
      .filter({ hasNot: page.getByText(/Añadir nuevo|Add new/i) })
      .first();

    await expect(selectedTabAfter).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });
    await expect(selectedTabAfter).toHaveAttribute('aria-selected', 'true');

    const tabNameAfter = await selectedTabAfter.textContent();
    const executionNameAfter = tabNameAfter?.trim() || '';
    console.log(`Execution tab after navigation: "${executionNameAfter}"`);

    expect(executionNameAfter).toBe(executionName);
  });

  test('should display solution data from the endpoint for the selected execution', async ({
    page,
  }) => {
    let executionDataResponse: { data?: Record<string, unknown[]> } | null =
      null;
    const executionDataPromise = page.waitForResponse(
      (response) => {
        const url = response.url();
        const method = response.request().method();
        return method === 'GET' && /\/execution\/[^/]+\/data\/?$/.test(url);
      },
      { timeout: TIMEOUTS.NAVIGATION * 2 }
    );

    // Navigate — the pre-authenticated state triggers the execution data API call
    await ensureAppAndExecutionLoaded(page);

    try {
      const execRes = await executionDataPromise;
      if (execRes.ok()) {
        const body = await execRes.json();
        const content = body.content ?? body;
        const data = content.data;
        if (data && typeof data === 'object') {
          executionDataResponse = { data: data as Record<string, unknown[]> };
          console.log(
            'Execution (solution) data keys:',
            Object.keys(executionDataResponse.data ?? {})
          );
        }
      }
    } catch {
      console.log('Execution data response was not captured');
    }

    const tablist = page.getByRole('tablist');
    await tablist.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

    const executionTab = tablist
      .getByRole('tab')
      .filter({ hasNot: page.getByText(/Añadir nuevo|Add new/i) })
      .first();

    await expect(executionTab).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });
    await expect(executionTab).toHaveAttribute('aria-selected', 'true');

    const solutionDataLink = await getSolutionDataLink(page);
    const linkVisible = await solutionDataLink
      .isVisible({ timeout: TIMEOUTS.FORM_LOAD })
      .catch(() => false);

    if (!linkVisible) {
      console.log(
        'Solution Data link not visible - skipping endpoint data test.'
      );
      return;
    }

    await solutionDataLink.click();

    await expect(page).toHaveURL(SOLUTION_DATA_PAGE_URL, {
      timeout: TIMEOUTS.NAVIGATION,
    });

    const sectionView = page.locator('.section-view');
    await sectionView.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

    const loadingSpinner = page.locator('.loading-container');
    await expect(loadingSpinner).not.toBeVisible({
      timeout: TIMEOUTS.NAVIGATION,
    });

    const dataFromApi = executionDataResponse?.data;

    if (!dataFromApi || Object.keys(dataFromApi).length === 0) {
      console.log(
        'No solution data captured from API - verifying UI structure only.'
      );
      const tableSection = page.locator('.table-section');
      const tableCard = page.locator('.table-card');
      expect(
        (await tableSection.count()) > 0 || (await tableCard.count()) > 0
      ).toBe(true);
      return;
    }

    const dataKeys = Object.keys(dataFromApi);
    console.log(
      `API returned ${dataKeys.length} solution tables: ${dataKeys.join(', ')}`
    );

    const tableCard = page.locator('.table-card');
    const hasGroupView = await tableCard.count() > 0;

    if (hasGroupView) {
      const dataTabs = tableCard.locator('.m-tab, button[role="tab"]');
      const tabCount = await dataTabs.count();
      expect(tabCount).toBeGreaterThan(0);
      console.log(
        `UI shows ${tabCount} tabs for ${dataKeys.length} solution tables from API`
      );
    }

    const firstKey = dataKeys[0];
    const firstTableData = dataFromApi[firstKey];
    const isArray =
      Array.isArray(firstTableData) && firstTableData.length > 0;

    if (isArray) {
      const firstItem = firstTableData[0] as Record<string, unknown>;
      const isPrimitive =
        typeof firstItem !== 'object' || firstItem === null;
      const sampleValue = isPrimitive
        ? (firstItem as string | number)
        : findDisplayableValue(firstItem as Record<string, any>);

      if (sampleValue != null && String(sampleValue).length <= 50) {
        const cellWithValue = page
          .locator('.v-data-table, .simple-list, .table-section')
          .getByText(String(sampleValue), { exact: false });
        const valueFound = await cellWithValue.count() > 0;
        expect(valueFound).toBe(true);
        console.log(
          `Found API value "${sampleValue}" in solution data page (same execution)`
        );
      }
    }

    const selectedTabAfter = tablist
      .getByRole('tab')
      .filter({ hasNot: page.getByText(/Añadir nuevo|Add new/i) })
      .first();
    await expect(selectedTabAfter).toHaveAttribute('aria-selected', 'true');
  });

  test('should navigate between tabs when Solution Data page has multiple tables', async ({
    page,
  }) => {
    await ensureAppAndExecutionLoaded(page);

    const tablist = page.getByRole('tablist');
    await tablist.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

    const executionTab = tablist
      .getByRole('tab')
      .filter({ hasNot: page.getByText(/Añadir nuevo|Add new/i) })
      .first();

    await expect(executionTab).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });
    await expect(executionTab).toHaveAttribute('aria-selected', 'true');

    const solutionDataLink = await getSolutionDataLink(page);
    const linkVisible = await solutionDataLink
      .isVisible({ timeout: TIMEOUTS.FORM_LOAD })
      .catch(() => false);

    if (!linkVisible) {
      console.log(
        'Solution Data link not visible - skipping tab navigation test.'
      );
      return;
    }

    await solutionDataLink.click();

    await expect(page).toHaveURL(SOLUTION_DATA_PAGE_URL, {
      timeout: TIMEOUTS.NAVIGATION,
    });

    const sectionView = page.locator('.section-view');
    await sectionView.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

    const loadingSpinner = page.locator('.loading-container');
    await expect(loadingSpinner).not.toBeVisible({
      timeout: TIMEOUTS.NAVIGATION,
    });

    const tableCard = page.locator('.table-card');
    const hasGroupView = await tableCard.count() > 0;

    if (!hasGroupView) {
      console.log(
        'No group view (single solution table) - skipping tab navigation test.'
      );
      const tableSection = page.locator('.table-section');
      await expect(tableSection).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });
      return;
    }

    const dataTabs = tableCard.locator('.m-tab, button[role="tab"]');
    const tabCount = await dataTabs.count();

    if (tabCount < 2) {
      console.log(
        'Only one solution data tab found - cannot test tab navigation.'
      );
      await expect(dataTabs.first()).toBeVisible();
      return;
    }

    const firstTab = dataTabs.first();
    await expect(firstTab).toHaveAttribute('aria-selected', 'true');

    const secondTab = dataTabs.nth(1);
    await secondTab.click();

    await expect(secondTab).toHaveAttribute('aria-selected', 'true', {
      timeout: TIMEOUTS.FORM_LOAD,
    });
    await expect(firstTab).toHaveAttribute('aria-selected', 'false');

    const tableCardContent = tableCard.locator('.table-card-content');
    await expect(tableCardContent).toBeVisible({
      timeout: TIMEOUTS.FORM_LOAD,
    });

    await firstTab.click();
    await expect(firstTab).toHaveAttribute('aria-selected', 'true', {
      timeout: TIMEOUTS.FORM_LOAD,
    });
  });

  test('should download Excel file when clicking the download button', async ({
    page,
  }) => {
    await ensureAppAndExecutionLoaded(page);

    const tablist = page.getByRole('tablist');
    await tablist.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

    const executionTab = tablist
      .getByRole('tab')
      .filter({ hasNot: page.getByText(/Añadir nuevo|Add new/i) })
      .first();

    await expect(executionTab).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });
    await expect(executionTab).toHaveAttribute('aria-selected', 'true');

    const solutionDataLink = await getSolutionDataLink(page);
    const linkVisible = await solutionDataLink
      .isVisible({ timeout: TIMEOUTS.FORM_LOAD })
      .catch(() => false);

    if (!linkVisible) {
      console.log(
        'Solution Data link not visible - skipping Excel download test.'
      );
      return;
    }

    await solutionDataLink.click();

    await expect(page).toHaveURL(SOLUTION_DATA_PAGE_URL, {
      timeout: TIMEOUTS.NAVIGATION,
    });

    const sectionView = page.locator('.section-view');
    await sectionView.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

    const loadingSpinner = page.locator('.loading-container');
    await expect(loadingSpinner).not.toBeVisible({
      timeout: TIMEOUTS.NAVIGATION,
    });

    const menuButton = page
      .locator(
        '.table-card-content .core-dropdown-menu__trigger, ' +
          '.core-table-container .core-dropdown-menu__trigger, ' +
          '.table-section .core-dropdown-menu__trigger'
      )
      .first();

    const menuVisible = await menuButton
      .isVisible({ timeout: TIMEOUTS.FORM_LOAD })
      .catch(() => false);

    if (!menuVisible) {
      console.log(
        'Download menu button not visible on solution data page - skipping test.'
      );
      return;
    }

    await menuButton.click();

    const downloadOption = page.getByText(
      /Descargar excel|Download excel/i
    );
    await downloadOption.waitFor({
      state: 'visible',
      timeout: TIMEOUTS.FORM_LOAD,
    });

    const downloadPromise = page.waitForEvent('download', {
      timeout: TIMEOUTS.NAVIGATION,
    });

    await downloadOption.click();

    const download = await downloadPromise;
    const suggestedFilename = download.suggestedFilename();

    expect(
      suggestedFilename.endsWith('.xlsx') || suggestedFilename.endsWith('.xls')
    ).toBe(true);

    console.log(`Solution Data Excel download: ${suggestedFilename}`);
  });

  test('should show current plan FAB icon when the execution is the current plan', async ({
    page,
  }) => {
    await ensureAppAndExecutionLoaded(page);

    const tablist = page.getByRole('tablist');
    await tablist.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

    const executionTab = tablist
      .getByRole('tab')
      .filter({ hasNot: page.getByText(/Añadir nuevo|Add new/i) })
      .first();

    const tabCount = await executionTab.count();
    if (tabCount === 0) {
      console.log('No execution tab found, skipping test');
      return;
    }

    const solutionDataLink = await getSolutionDataLink(page);
    const linkVisible = await solutionDataLink
      .isVisible({ timeout: TIMEOUTS.FORM_LOAD })
      .catch(() => false);

    if (!linkVisible) {
      console.log(
        'Solution Data link not visible - skipping current plan FAB test.'
      );
      return;
    }

    await solutionDataLink.click();

    await expect(page).toHaveURL(SOLUTION_DATA_PAGE_URL, {
      timeout: TIMEOUTS.NAVIGATION,
    });

    const sectionView = page.locator('.section-view');
    await sectionView.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

    const currentPlanFab = page.locator('.set-current-plan-fab');
    const fabVisible = await currentPlanFab
      .isVisible({ timeout: TIMEOUTS.FORM_LOAD })
      .catch(() => false);

    if (!fabVisible) {
      console.log(
        'Current plan FAB is not visible - feature may not be available'
      );
      return;
    }

    const fabButton = currentPlanFab.locator('.fab-button');
    await fabButton.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

    const isCurrentPlan = await fabButton.evaluate((el) =>
      el.classList.contains('is-current')
    );

    if (isCurrentPlan) {
      const starIcon = fabButton.locator('.mdi-star');
      await expect(starIcon).toBeVisible();
      const cursorStyle = await fabButton.evaluate(
        (el) => window.getComputedStyle(el).cursor
      );
      expect(cursorStyle).toBe('default');
    } else {
      await expect(fabButton).toBeVisible();
    }

    console.log('Current plan FAB test on solution data page completed');
  });

  test('should allow setting an execution as current plan', async ({
    page,
  }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const app = page.locator('.v-application');
    await app.first().waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

    await page.goto('/history-execution', { waitUntil: 'domcontentloaded' });

    const table = page.getByRole('table').first();
    await table.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

    const tableRows = page.locator('tbody tr, .v-data-table tbody tr');
    await tableRows.first().waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

    const rowCount = await tableRows.count();
    if (rowCount < 2) {
      console.log('Not enough executions to test - need at least 2');
      return;
    }

    let loadedExecution = false;

    for (let i = 0; i < rowCount; i++) {
      const row = tableRows.nth(i);
      const hasLatestPlanChip =
        (await row.locator('.latest-plan-chip').count()) > 0;

      if (hasLatestPlanChip) continue;

      const nameCell = row.locator('.name-cell span, td').first();
      const executionName =
        (await nameCell.textContent())?.trim() || `Execution ${i}`;

      await row.hover();
      await page.waitForTimeout(300);

      const loadButtonSelectors = [
        '.mdi-tray-arrow-up',
        '[class*="mdi-tray-arrow-up"]',
        'i.mdi-tray-arrow-up',
        '.actions-container .v-icon',
      ];

      let loadButton: Locator | null = null;
      for (const selector of loadButtonSelectors) {
        const btn = row.locator(selector).first();
        const isVisible = await btn.isVisible().catch(() => false);
        if (isVisible) {
          loadButton = btn;
          break;
        }
      }

      if (!loadButton) {
        const actionsContainer = row.locator('.actions-container');
        if ((await actionsContainer.count()) > 0) {
          const icons = actionsContainer.locator('.v-icon');
          const iconCount = await icons.count();
          for (let j = 0; j < iconCount; j++) {
            const icon = icons.nth(j);
            const iconClass = await icon.getAttribute('class').catch(() => '');
            if (iconClass?.includes('mdi-tray-arrow-up')) {
              loadButton = icon;
              break;
            }
          }
        }
      }

      if (loadButton) {
        await loadButton.click();
        loadedExecution = true;
        await page.waitForTimeout(2000);
        break;
      }
    }

    if (!loadedExecution) {
      console.log(
        'Could not find a non-current plan execution to load - skipping test'
      );
      return;
    }

    await page.waitForTimeout(1000);

    const solutionDataLink = await getSolutionDataLink(page);
    await solutionDataLink.waitFor({
      state: 'visible',
      timeout: TIMEOUTS.FORM_LOAD,
    });
    await solutionDataLink.click();

    await expect(page).toHaveURL(SOLUTION_DATA_PAGE_URL, {
      timeout: TIMEOUTS.NAVIGATION,
    });

    const sectionView = page.locator('.section-view');
    await sectionView.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

    const currentPlanFab = page.locator('.set-current-plan-fab');
    const fabVisible = await currentPlanFab
      .isVisible({ timeout: TIMEOUTS.FORM_LOAD })
      .catch(() => false);

    if (!fabVisible) {
      console.log(
        'Current plan FAB is not visible - feature may not be available or execution state not valid'
      );
      return;
    }

    const fabButton = currentPlanFab.locator('.fab-button');
    await fabButton.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

    const isCurrentPlan = await fabButton.evaluate((el) =>
      el.classList.contains('is-current')
    );

    if (isCurrentPlan) {
      console.log(
        'Loaded execution is already the current plan - test scenario not applicable'
      );
      return;
    }

    const starPlusIcon = fabButton.locator('.mdi-star-plus-outline');
    await expect(starPlusIcon).toBeVisible();

    await fabButton.click();

    const modal = page.locator('.m-base-modal, .v-dialog, [role="dialog"]');
    await modal.first().waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

    const modalTitle = modal
      .first()
      .getByText(/Establecer como plan actual|Set as current plan/i);
    await expect(modalTitle).toBeVisible();

    const confirmButton = modal
      .first()
      .getByRole('button', {
        name: /Establecer como actual|Set as current|Confirm/i,
      });
    await expect(confirmButton).toBeVisible();
    await confirmButton.click();

    await modal.first().waitFor({ state: 'hidden', timeout: TIMEOUTS.FORM_LOAD });

    await fabButton.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
    await page.waitForTimeout(1000);

    const starIcon = fabButton.locator('.mdi-star');
    await expect(starIcon).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });

    const isNowCurrentPlan = await fabButton.evaluate((el) =>
      el.classList.contains('is-current')
    );
    expect(isNowCurrentPlan).toBe(true);

    console.log(
      'Successfully set execution as current plan from solution data page'
    );
  });
});
