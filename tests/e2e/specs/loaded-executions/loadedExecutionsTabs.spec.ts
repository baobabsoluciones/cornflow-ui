import { test, expect } from '../../fixtures';
import { TIMEOUTS } from '../../helpers/constants';
import { ensureExecutionLoaded } from '../../helpers/executionHelpers';

/**
 * Tests for the loaded executions tab bar functionality
 *
 * These tests verify that the tab bar at the bottom left of the screen
 * correctly displays the loaded execution tabs and the "Add new" button.
 */
test.describe('Loaded Executions Tab Bar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const app = page.locator('.v-application');
    await app.first().waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
  });

  test('should always display the "Add new" tab button', async ({ page }) => {
    // The "Add new" button is rendered as a tab element with role="tab"
    // The button text is "Añadir nuevo" (Spanish) or "Add new" (English)
    const addNewTab = page.getByRole('tab', { name: /Añadir nuevo|Add new/i });

    // Wait for the tab to be visible
    await addNewTab.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

    // Verify that the tab is visible
    await expect(addNewTab).toBeVisible();
  });

  test('should display "Add new" button when navigating to different views', async ({ page }) => {
    // The "Add new" tab button
    const addNewTab = page.getByRole('tab', { name: /Añadir nuevo|Add new/i });

    // First check on the initial view
    await addNewTab.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
    await expect(addNewTab).toBeVisible();

    // Navigate to history-execution and verify tab is still visible
    await page.goto('/history-execution', { waitUntil: 'domcontentloaded' });
    await expect(addNewTab).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });

    // Navigate to dashboard and verify tab is still visible
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await expect(addNewTab).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });

    // Navigate to project-execution and verify tab is still visible
    await page.goto('/project-execution', { waitUntil: 'domcontentloaded' });
    await expect(addNewTab).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });
  });

  test('should navigate to project-execution when clicking "Add new" button', async ({ page }) => {
    // Find the "Add new" tab
    const addNewTab = page.getByRole('tab', { name: /Añadir nuevo|Add new/i });
    await addNewTab.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

    // Click the tab
    await addNewTab.click();

    // Verify navigation to project-execution page
    await expect(page).toHaveURL(/\/project-execution/, { timeout: TIMEOUTS.NAVIGATION });

    // Verify the page title is displayed (Spanish: "Ejecución", English: "Project execution")
    const pageTitle = page.getByRole('heading', { name: /Ejecución|Project execution/i });
    await expect(pageTitle).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });
  });

  test('should display tablist containing the "Add new" tab', async ({ page }) => {
    // The tab bar uses a tablist role
    const tablist = page.getByRole('tablist');
    await tablist.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

    // Verify that the tablist is visible
    await expect(tablist).toBeVisible();

    // Verify the "Add new" tab is inside the tablist
    const addNewTab = tablist.getByRole('tab', { name: /Añadir nuevo|Add new/i });
    await expect(addNewTab).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });
  });

  test('should display only the Actual execution tab, selected and matching the table', async ({ page }) => {
    // Load one execution explicitly to avoid depending on preloaded "Actual" badge state.
    const hasExecutionLoaded = await ensureExecutionLoaded(page);
    expect(hasExecutionLoaded).toBe(true);

    // ensureExecutionLoaded already leaves us on /history-execution. Do NOT use page.goto here:
    // a full navigation reloads the document and resets Pinia, so loaded executions/tabs vanish.
    await expect(page).toHaveURL(/history-execution/, { timeout: TIMEOUTS.NAVIGATION });
    const table = page.getByRole('table').first();
    await table.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

    const tablist = page.getByRole('tablist');
    await tablist.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

    const actualExecutionTab = tablist
      .getByRole('tab')
      .filter({
        hasNot: page.getByText(/Añadir nuevo|Add new/i),
      })
      .first();

    await expect(actualExecutionTab).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });
    await expect(actualExecutionTab).toHaveAttribute('aria-selected', 'true');

    const tabText = (await actualExecutionTab.textContent()) ?? '';
    const tabName = tabText
      .replace(/Añadir nuevo|Add new/gi, '')
      .replace(/Actual/gi, '')
      .replace(/[✕xX]\s*$/, '')
      .replace(/\s+/g, ' ')
      .trim();

    expect(tabName.length).toBeGreaterThan(0);

    // Verify this selected tab corresponds to a row in the history table (Name column text).
    const historyRows = page.locator('tbody tr, .v-data-table tbody tr, .execution-table tbody tr');
    await expect(historyRows.filter({ hasText: tabName }).first()).toBeVisible({
      timeout: TIMEOUTS.FORM_LOAD,
    });

    // Exactly one execution tab plus "Add new".
    const allTabs = tablist.getByRole('tab');
    await expect(allTabs).toHaveCount(2, { timeout: TIMEOUTS.FORM_LOAD });

    // Sidebar links depend on schema + instance data: filterValidationTablesWithData may hide
    // "validaciones" if there is nothing to validate. Use any input-data / results drawer links.
    const drawerNav = page.getByRole('navigation').first();
    const inputDataLink = drawerNav.locator('a[href*="/input-data"]');
    const resultsNavLink = drawerNav.locator('a[href*="/results"]');

    // WHEN TAB IS ACTIVE: execution-scoped sections (input data + results) ARE visible
    await expect(inputDataLink.first()).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });
    await expect(resultsNavLink.first()).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });

    // To test deselection, we navigate to a route where clicking the selected tab
    // will deselect it AND redirect to history-execution (proving deselection worked)
    // Use a sidebar link (Vue Router) — page.goto would reload the app and clear loaded executions.
    // Prefer a concrete group route when present (stable for deselect behavior on /input-data/*).
    const inputDataTableLink = drawerNav.locator(
      'a[href*="/input-data/group/datos-de-entrada"], a[href*="/input-data/group/input"], a[href*="/input-data"]'
    );
    await inputDataTableLink.first().click();
    await expect(page).toHaveURL(/input-data/, { timeout: TIMEOUTS.NAVIGATION });

    // Wait for the tab to still be visible and selected
    await expect(actualExecutionTab).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });
    await expect(actualExecutionTab).toHaveAttribute('aria-selected', 'true');

    // Click on the tab to deselect it - according to IndexView.vue selectTab function,
    // clicking a selected tab while in /input-data will deselect it and redirect to /history-execution
    // Use dispatchEvent to ensure the click is properly registered by Vue
    await actualExecutionTab.dispatchEvent('click');

    // Wait for the redirect to history-execution (this proves deselection worked)
    await expect(page).toHaveURL(/history-execution/, { timeout: TIMEOUTS.NAVIGATION });

    // WHEN TAB IS DESELECTED: execution-scoped sidebar links are gone
    await expect(inputDataLink.first()).not.toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });
    await expect(resultsNavLink.first()).not.toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });
  });

  test('should close all execution tabs when clicking their X buttons', async ({ page }) => {
    // Wait for the tablist to be visible (no page reload - we use the authenticated state from beforeEach)
    const tablist = page.getByRole('tablist');
    await tablist.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

    // Get all tabs and count execution tabs (excluding "Add new" tab)
    const allTabs = tablist.getByRole('tab');
    const addNewTab = tablist.getByRole('tab', { name: /Añadir nuevo|Add new/i });

    const initialTabCount = await allTabs.count();
    const initialExecutionTabCount = initialTabCount - 1; // Subtract 1 for "Add new" tab

    // Close each execution tab one by one
    for (let i = 0; i < initialExecutionTabCount; i++) {
      // Always get the first execution tab (since we're closing them one by one)
      // After closing one, the next one becomes the first
      const currentTabCount = await allTabs.count();
      const executionTabCount = currentTabCount - 1;

      // Skip if no more execution tabs to close
      if (executionTabCount <= 0) break;

      // Find the first execution tab that is NOT the "Add new" tab
      // We look for tabs that don't match the "Add new" pattern
      const executionTab = tablist
        .getByRole('tab')
        .filter({ hasNot: page.getByText(/Añadir nuevo|Add new/i) })
        .first();

      await expect(executionTab).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });

      // Get the tab name before closing to verify it's gone later
      const tabName = await executionTab.textContent();

      // Find the close button (X) within the tab - look for the mdi-close icon
      const closeButton = executionTab.locator('.mdi-close, [class*="close"]').first();
      await closeButton.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
      await closeButton.click();

      // Verify that the specific tab with that name is no longer visible
      const closedTab = tablist.getByRole('tab', { name: tabName || '' });
      await expect(closedTab).not.toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });
    }

    // After closing all execution tabs, only the "Add new" tab should remain
    const finalTabCount = await allTabs.count();
    expect(finalTabCount).toBe(1);
    await expect(addNewTab).toBeVisible();
  });
});
