import { test, expect } from '../../fixtures';
import type { Page } from '@playwright/test';
import { TIMEOUTS } from '../../helpers/constants';
import {
  ensureExecutionLoaded,
  loadExecutionFromHistoryUntil,
} from '../../helpers/executionHelpers';

/**
 * Home + ejecución cargada explícitamente (sin instancia no hay pestaña ni enlace de validaciones).
 */
async function ensureAppAndExecutionLoaded(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const app = page.locator('.v-application');
  await app.first().waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
  const ok = await ensureExecutionLoaded(page);
  expect(ok).toBe(true);
}

// Validations link: by visible text (i18n) and by href (validations or validaciones in URL depending on locale)
const VALIDATIONS_LINK_SELECTOR =
  'a[href*="group/validations"], a[href*="group/validaciones"]';
const VALIDATIONS_PAGE_URL =
  /(input-data|results)\/group\/(validations|validaciones)/;

/**
 * Finds the Validations menu link (works with any locale and hash/history mode).
 */
async function getValidationsLink(page: import('@playwright/test').Page) {
  const byText = page.getByRole('link', {
    name: /Validations?|Validaciones/i,
  });
  const byHref = page.locator(VALIDATIONS_LINK_SELECTOR);
  const link = byText.first();
  const visible = await link.isVisible({ timeout: TIMEOUTS.FORM_LOAD }).catch(() => false);
  if (visible) return link;
  return byHref.first();
}

/** True when the drawer shows a Validations link (requires dataChecks with data on the instance/solution). */
async function isValidationsNavLinkVisible(page: import('@playwright/test').Page): Promise<boolean> {
  const byText = page.getByRole('link', {
    name: /Validations?|Validaciones/i,
  });
  if (await byText.first().isVisible({ timeout: 1500 }).catch(() => false)) {
    return true;
  }
  return page
    .locator(VALIDATIONS_LINK_SELECTOR)
    .first()
    .isVisible({ timeout: 6000 })
    .catch(() => false);
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
 * Tests for the Validations page functionality
 *
 * These tests verify the validations page is reachable via the side menu,
 * that the displayed data belongs to the selected instance/execution,
 * and basic navigation within the validations view.
 *
 * Note: The "Validations" link only appears in the menu when the loaded
 * execution has dataChecks (instance or solution). If no validations are
 * available, some tests may skip.
 */
test.describe('Validations Page', () => {
  test('should navigate to Validations page via the side menu and display validation data', async ({
    page,
  }) => {
    await ensureAppAndExecutionLoaded(page);

    // Ensure there is a selected execution tab
    const tablist = page.getByRole('tablist');
    await tablist.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

    const executionTab = tablist
      .getByRole('tab')
      .filter({ hasNot: page.getByText(/Añadir nuevo|Add new/i) })
      .first();

    await expect(executionTab).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });
    await expect(executionTab).toHaveAttribute('aria-selected', 'true');

    const validationsLink = await getValidationsLink(page);
    const linkVisible = await validationsLink
      .isVisible({ timeout: TIMEOUTS.FORM_LOAD })
      .catch(() => false);

    if (!linkVisible) {
      console.log(
        'Validations link not visible - execution may have no dataChecks. Skipping test.'
      );
      return;
    }

    await validationsLink.click();

    // Verify navigation to validations page (input-data or results, validations or validaciones in URL)
    await expect(page).toHaveURL(VALIDATIONS_PAGE_URL, {
      timeout: TIMEOUTS.NAVIGATION,
    });

    // Verify the page content is loaded
    const sectionView = page.locator('.section-view');
    await sectionView.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

    // Wait for loading to complete
    const loadingSpinner = page.locator('.loading-container');
    await expect(loadingSpinner).not.toBeVisible({
      timeout: TIMEOUTS.NAVIGATION,
    });

    // Verify that table or validation content is visible
    const tableSection = page.locator('.table-section');
    const alertSection = page.locator('.alert-section');
    await expect(
      tableSection.or(alertSection).first()
    ).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });

    // Should have either table content or validation alerts (passed/loading/errors)
    const hasTable = await tableSection.count() > 0;
    const hasAlert = await alertSection.count() > 0;
    expect(hasTable || hasAlert).toBe(true);
  });

  test('should show validation data that belongs to the selected instance', async ({
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

    // Capture the execution name before navigating to validations
    const executionTabName = await executionTab.textContent();
    const executionName = executionTabName?.trim() || '';
    console.log(`Selected execution before navigation: "${executionName}"`);

    const validationsLink = await getValidationsLink(page);
    const linkVisible = await validationsLink
      .isVisible({ timeout: TIMEOUTS.FORM_LOAD })
      .catch(() => false);

    if (!linkVisible) {
      console.log(
        'Validations link not visible - execution may have no dataChecks. Skipping test.'
      );
      return;
    }

    await validationsLink.click();

    await expect(page).toHaveURL(VALIDATIONS_PAGE_URL, {
      timeout: TIMEOUTS.NAVIGATION,
    });

    const sectionView = page.locator('.section-view');
    await sectionView.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

    const loadingSpinner = page.locator('.loading-container');
    await expect(loadingSpinner).not.toBeVisible({
      timeout: TIMEOUTS.NAVIGATION,
    });

    // Verify the same execution tab is still selected (data belongs to that instance)
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

  test('should display validation tab data from the endpoint for the selected instance', async ({
    page,
  }) => {
    // Capture instance data (includes .checks = dataChecks) when the app loads the execution
    let instanceResponse: { instanceId: string; checks: Record<string, unknown[]> } | null = null;
    const instanceDataPromise = page.waitForResponse(
      (response) => {
        const url = response.url();
        const method = response.request().method();
        return method === 'GET' && /\/instance\/[^/]+\/data\/?$/.test(url);
      },
      { timeout: TIMEOUTS.NAVIGATION * 2 }
    );

    // Capture execution data (includes .checks = solution dataChecks) when loading execution
    let executionChecks: Record<string, unknown[]> | null = null;
    const executionDataPromise = page.waitForResponse(
      (response) => {
        const url = response.url();
        const method = response.request().method();
        return method === 'GET' && /\/execution\/[^/]+\/data\/?$/.test(url);
      },
      { timeout: TIMEOUTS.NAVIGATION * 2 }
    );

    await ensureAppAndExecutionLoaded(page);

    try {
      const instRes = await instanceDataPromise;
      if (instRes.ok()) {
        const body = await instRes.json();
        const content = body.content ?? body;
        const checks = content.checks ?? content.dataChecks;
        if (checks && typeof checks === 'object') {
          const match = instRes.url().match(/\/instance\/([^/]+)\/data/);
          instanceResponse = {
            instanceId: match ? match[1] : '',
            checks: checks as Record<string, unknown[]>,
          };
          console.log('Instance checks keys:', Object.keys(instanceResponse.checks));
        }
      }
    } catch {
      console.log('Instance data response was not captured');
    }

    try {
      const execRes = await executionDataPromise;
      if (execRes.ok()) {
        const body = await execRes.json();
        const content = body.content ?? body;
        const checks = content.checks ?? content.dataChecks;
        if (checks && typeof checks === 'object') {
          executionChecks = checks as Record<string, unknown[]>;
          console.log('Execution (solution) checks keys:', Object.keys(executionChecks));
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

    const validationsLink = await getValidationsLink(page);
    const linkVisible = await validationsLink
      .isVisible({ timeout: TIMEOUTS.FORM_LOAD })
      .catch(() => false);

    if (!linkVisible) {
      console.log('Validations link not visible - skipping endpoint data test.');
      return;
    }

    await validationsLink.click();

    await expect(page).toHaveURL(VALIDATIONS_PAGE_URL, {
      timeout: TIMEOUTS.NAVIGATION,
    });

    const sectionView = page.locator('.section-view');
    await sectionView.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

    const loadingSpinner = page.locator('.loading-container');
    await expect(loadingSpinner).not.toBeVisible({
      timeout: TIMEOUTS.NAVIGATION,
    });

    // Decide which checks to use: input-data => instance, results => execution
    const isInputData = /input-data/.test(page.url());
    const checksFromApi = isInputData ? instanceResponse?.checks : executionChecks;

    if (!checksFromApi || Object.keys(checksFromApi).length === 0) {
      console.log(
        'No checks captured from API for this section - verifying UI structure only.'
      );
      const tableSection = page.locator('.table-section');
      const alertSection = page.locator('.alert-section');
      expect(
        await tableSection.count() > 0 || (await alertSection.count() > 0)
      ).toBe(true);
      return;
    }

    const checkKeys = Object.keys(checksFromApi);
    console.log(`API returned ${checkKeys.length} validation tables: ${checkKeys.join(', ')}`);

    // Tabs: should match the number of check tables (or at least show content)
    const tableCard = page.locator('.table-card');
    const hasGroupView = await tableCard.count() > 0;

    if (hasGroupView) {
      const dataTabs = tableCard.locator('.m-tab, button[role="tab"]');
      const tabCount = await dataTabs.count();
      expect(tabCount).toBeGreaterThan(0);
      console.log(`UI shows ${tabCount} tabs for ${checkKeys.length} check tables from API`);
    }

    // Verify at least one value from the first check table appears in the page (data from endpoint)
    const firstKey = checkKeys[0];
    const firstTableData = checksFromApi[firstKey];
    const isArray = Array.isArray(firstTableData) && firstTableData.length > 0;

    if (isArray) {
      const firstItem = firstTableData[0];
      const isPrimitive = typeof firstItem !== 'object' || firstItem === null;
      const sampleValue = isPrimitive
        ? (firstItem as string | number)
        : findDisplayableValue(firstItem as Record<string, any>);

      if (sampleValue != null && String(sampleValue).length <= 50) {
        const cellWithValue = page
          .locator('.v-data-table, .simple-list, .table-section')
          .getByText(String(sampleValue), { exact: false });
        const valueFound = await cellWithValue.count() > 0;
        expect(valueFound).toBe(true);
        console.log(`Found API value "${sampleValue}" in validation page (same instance)`);
      }
    }

    // Confirm we are still on the same execution (data corresponds to selected instance)
    const selectedTabAfter = tablist
      .getByRole('tab')
      .filter({ hasNot: page.getByText(/Añadir nuevo|Add new/i) })
      .first();
    await expect(selectedTabAfter).toHaveAttribute('aria-selected', 'true');
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

    const validationsLink = await getValidationsLink(page);
    const linkVisible = await validationsLink
      .isVisible({ timeout: TIMEOUTS.FORM_LOAD })
      .catch(() => false);

    if (!linkVisible) {
      console.log(
        'Validations link not visible - skipping Excel download test.'
      );
      return;
    }

    await validationsLink.click();

    await expect(page).toHaveURL(VALIDATIONS_PAGE_URL, {
      timeout: TIMEOUTS.NAVIGATION,
    });

    const sectionView = page.locator('.section-view');
    await sectionView.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

    const loadingSpinner = page.locator('.loading-container');
    await expect(loadingSpinner).not.toBeVisible({
      timeout: TIMEOUTS.NAVIGATION,
    });

    // Find the three-dots menu button (same structure as input data page)
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
        'Download menu button not visible on validations page - skipping test.'
      );
      return;
    }

    await menuButton.click();

    const downloadOption = page.getByText(/Descargar excel|Download excel/i);
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

    console.log(`Validations Excel download: ${suggestedFilename}`);
  });

  test('should navigate to edit instance page when clicking Edit Input Data option', async ({
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

    const validationsLink = await getValidationsLink(page);
    const linkVisible = await validationsLink
      .isVisible({ timeout: TIMEOUTS.FORM_LOAD })
      .catch(() => false);

    if (!linkVisible) {
      console.log(
        'Validations link not visible - skipping Edit Input Data test.'
      );
      return;
    }

    await validationsLink.click();

    await expect(page).toHaveURL(VALIDATIONS_PAGE_URL, {
      timeout: TIMEOUTS.NAVIGATION,
    });

    const sectionView = page.locator('.section-view');
    await sectionView.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

    const loadingSpinner = page.locator('.loading-container');
    await expect(loadingSpinner).not.toBeVisible({
      timeout: TIMEOUTS.NAVIGATION,
    });

    // Find the three-dots menu in the title view (CoreTitleView actions)
    const titleViewMenuButton = page.locator(
      '.core-title-view__actions .core-dropdown-menu__trigger'
    );

    const menuButtonVisible = await titleViewMenuButton
      .isVisible({ timeout: TIMEOUTS.FORM_LOAD })
      .catch(() => false);

    if (!menuButtonVisible) {
      console.log(
        'Edit Input Data option is not available (allowEditInstance may be disabled)'
      );
      return;
    }

    await titleViewMenuButton.click();

    const editOption = page.getByText(
      /Editar datos de entrada|Edit input data/i
    );
    const editOptionVisible = await editOption
      .isVisible({ timeout: TIMEOUTS.FORM_LOAD })
      .catch(() => false);

    if (!editOptionVisible) {
      console.log('Edit Input Data option is not present in the menu');
      await page.keyboard.press('Escape');
      return;
    }

    await editOption.click();

    await expect(page).toHaveURL(/\/project-execution.*editInstance=true/, {
      timeout: TIMEOUTS.NAVIGATION,
    });

    const formSteps = page.locator('.m-form-steps, .view-container');
    await formSteps
      .first()
      .waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

    const tablistAfter = page.getByRole('tablist');
    await tablistAfter.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

    const selectedTabAfter = tablistAfter
      .getByRole('tab')
      .filter({ hasNot: page.getByText(/Añadir nuevo|Add new/i) })
      .first();

    await expect(selectedTabAfter).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });
    await expect(selectedTabAfter).toHaveAttribute('aria-selected', 'true');

    const tabNameAfter = await selectedTabAfter.textContent();
    expect(tabNameAfter?.trim()).toBe(executionName);

    console.log(
      'Edit instance page loaded from validations with same execution'
    );
  });

  test('should navigate between tabs when Validations page has multiple validation tables', async ({
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

    const validationsLink = await getValidationsLink(page);
    const linkVisible = await validationsLink
      .isVisible({ timeout: TIMEOUTS.FORM_LOAD })
      .catch(() => false);

    if (!linkVisible) {
      console.log(
        'Validations link not visible - skipping tab navigation test.'
      );
      return;
    }

    await validationsLink.click();

    await expect(page).toHaveURL(VALIDATIONS_PAGE_URL, {
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
        'No group view (single validation table) - skipping tab navigation test.'
      );
      const tableSection = page.locator('.table-section');
      await expect(tableSection).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });
      return;
    }

    const dataTabs = tableCard.locator('.m-tab, button[role="tab"]');
    const tabCount = await dataTabs.count();

    if (tabCount < 2) {
      console.log(
        'Only one validation tab found - cannot test tab navigation.'
      );
      await expect(dataTabs.first()).toBeVisible();
      return;
    }

    const firstTab = dataTabs.first();
    await expect(firstTab).toHaveAttribute('aria-selected', 'true');

    // Click second tab
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

    // Navigate back to first tab
    await firstTab.click();
    await expect(firstTab).toHaveAttribute('aria-selected', 'true', {
      timeout: TIMEOUTS.FORM_LOAD,
    });
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

    const validationsLink = await getValidationsLink(page);
    const linkVisible = await validationsLink
      .isVisible({ timeout: TIMEOUTS.FORM_LOAD })
      .catch(() => false);

    if (!linkVisible) {
      console.log(
        'Validations link not visible - skipping current plan FAB test.'
      );
      return;
    }

    await validationsLink.click();

    await expect(page).toHaveURL(VALIDATIONS_PAGE_URL, {
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

    console.log('Current plan FAB test on validations page completed');
  });

  test('should allow setting an execution as current plan', async ({
    page,
  }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const app = page.locator('.v-application');
    await app.first().waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

    // El menú solo muestra Validaciones si hay dataChecks con datos; no basta la primera fila no-actual.
    const loadedWithValidations = await loadExecutionFromHistoryUntil(
      page,
      isValidationsNavLinkVisible
    );

    if (!loadedWithValidations) {
      console.log(
        'Could not load an execution that exposes the Validations menu link — skipping test.'
      );
      return;
    }

    const validationsLink = await getValidationsLink(page);
    await validationsLink.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
    await validationsLink.click();

    await expect(page).toHaveURL(VALIDATIONS_PAGE_URL, {
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
      'Successfully set execution as current plan from validations page'
    );
  });
});
