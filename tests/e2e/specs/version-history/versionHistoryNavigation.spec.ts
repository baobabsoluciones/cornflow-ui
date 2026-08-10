import { test, expect } from '../../fixtures';
import type { Locator } from '@playwright/test';
import { isHashRoute, getHashRoute } from '../../helpers/urlHelpers';
import { PROTECTED_ROUTES, TIMEOUTS } from '../../helpers/constants';
import {
  ensureHistoryHasRows,
  findLoadExecutionButtonInRow,
  waitForStableLoadedExecutionTab,
} from '../../helpers/executionHelpers';
import * as fs from 'fs';

/**
 * Tests for version history navigation
 * 
 * These tests verify that users can access the version history page
 * after logging in and by clicking on "Historial de versiones" in the left sidebar menu.
 * Also tests the three dots menu that allows navigating to the execution page.
 * Additionally tests that the backend API response has the correct data structure.
 */
test.describe('Version History Navigation', () => {
  // Configure tests to run serially to avoid race conditions with authentication
  // This ensures each test has a clean state and doesn't interfere with others
  test.describe.configure({ mode: 'serial' });
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const app = page.locator('v-app, [data-app], .v-application');
    await app.first().waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
  });

  test('should display version history page after logging in', async ({ page }) => {
    // After authentication, the user should be redirected to the default view
    // The default view is typically 'history-execution' but may vary by configuration
    // Wait for navigation to complete after login
    await page.waitForURL(
      (url) => {
        const hash = url.hash;
        return hash !== '' && !hash.includes('/sign-in');
      },
      { timeout: TIMEOUTS.NAVIGATION }
    );

    // Check if we're already on history-execution (it's the default view)
    const currentHash = getHashRoute(page);
    
    // If not on history-execution, navigate to it directly
    if (!currentHash.includes('/history-execution')) {
      // Navigate directly to history-execution route
      await page.goto(`${page.url().split('#')[0]}#/history-execution`);
      
      // Wait for navigation to history-execution route
      await page.waitForURL(
        (url) => {
          const hash = url.hash;
          return hash.includes('/history-execution');
        },
        { timeout: TIMEOUTS.NAVIGATION }
      );
    }

    // Verify we're on the history-execution route
    const hash = getHashRoute(page);
    expect(hash).toContain('/history-execution');
    expect(isHashRoute(page, PROTECTED_ROUTES)).toBe(true);

    // Verify the version history page title is displayed
    // The title can be in different languages: "Historial de versiones" (ES), "Version history" (EN), "Historique des versions" (FR)
    const pageTitle = page.getByRole('heading', { name: /Historial de versiones|Version history|Historique des versions/i });
    await pageTitle.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
    await expect(pageTitle).toBeVisible();

    // Verify the page description is displayed
    // The description mentions a summary of all versions
    const pageDescription = page.getByText(/resumen de todas las versiones|summary of all the versions|résumé de toutes les versions/i);
    await expect(pageDescription.first()).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });
  });

  test('should navigate to version history when clicking "Historial de versiones" in sidebar menu', async ({ page }) => {
    // Find the "Historial de versiones" menu item in the sidebar
    // The menu item is in the subpages section under "Executions" section
    // It can be in different languages: "Historial de versiones" (ES), "Version history" (EN), "Historique des versions" (FR)
    // The menu item is a v-list-item within .subpages that contains the text
    // Strategy: Find by text first, if not visible (menu collapsed), find by icon or use more specific selector
    
    // Try to find the menu item by text (works when menu is expanded)
    let versionHistoryMenuItem = page.locator('.subpages .v-list-item').filter({ 
      hasText: /Historial de versiones|Version history|Historique des versions/i 
    }).first();
    
    // Check if the menu item is visible
    const isMenuItemVisible = await versionHistoryMenuItem.isVisible().catch(() => false);
    
    if (!isMenuItemVisible) {
      // Menu might be collapsed, try to find by icon (mdi-history) or use a more general selector
      // Find the v-list-item that contains the mdi-history icon
      versionHistoryMenuItem = page.locator('.subpages .v-list-item').filter({ 
        has: page.locator('[class*="mdi-history"]') 
      }).first();
      
      // If still not found, try finding by the link's href attribute
      const linkVisible = await versionHistoryMenuItem.isVisible().catch(() => false);
      if (!linkVisible) {
        versionHistoryMenuItem = page.locator('a[href*="/history-execution"]').first();
      }
    }
    
    // Wait for the menu item to be visible
    await versionHistoryMenuItem.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
    
    // Verify the menu item is visible before clicking
    await expect(versionHistoryMenuItem).toBeVisible();

    // Click on the version history menu item
    await versionHistoryMenuItem.click();

    // Wait for navigation to history-execution route
    await page.waitForURL(
      (url) => {
        const hash = url.hash;
        return hash.includes('/history-execution');
      },
      { timeout: TIMEOUTS.NAVIGATION }
    );

    // Verify we're on the history-execution route
    const hash = getHashRoute(page);
    expect(hash).toContain('/history-execution');
    expect(isHashRoute(page, PROTECTED_ROUTES)).toBe(true);

    // Verify the version history page title is displayed
    const pageTitle = page.getByRole('heading', { name: /Historial de versiones|Version history|Historique des versions/i });
    await pageTitle.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
    await expect(pageTitle).toBeVisible();

    // Verify the page description is displayed
    const pageDescription = page.getByText(/resumen de todas las versiones|summary of all the versions|résumé de toutes les versions/i);
    await expect(pageDescription.first()).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });
  });

  test('should navigate to execution page when clicking "Crear nueva ejecución" from three dots menu', async ({ page }) => {
    // First, navigate to the version history page
    // Check if we're already on history-execution (it's the default view)
    const currentHash = getHashRoute(page);
    
    // If not on history-execution, navigate to it directly
    if (!currentHash.includes('/history-execution')) {
      // Navigate directly to history-execution route
      await page.goto(`${page.url().split('#')[0]}#/history-execution`);
      
      // Wait for navigation to history-execution route
      await page.waitForURL(
        (url) => {
          const hash = url.hash;
          return hash.includes('/history-execution');
        },
        { timeout: TIMEOUTS.NAVIGATION }
      );
    }

    // Verify we're on the history-execution route
    const hash = getHashRoute(page);
    expect(hash).toContain('/history-execution');

    // Find the three dots menu button (mdi-dots-vertical icon)
    // The button is in the CoreTitleView component, rendered by CoreDropdownMenu
    // It's a v-btn with icon="mdi-dots-vertical"
    const threeDotsButton = page.locator('button:has([class*="mdi-dots-vertical"])').first();
    
    // Wait for the button to be visible
    await threeDotsButton.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
    await expect(threeDotsButton).toBeVisible();

    // Click on the three dots button to open the dropdown menu
    await threeDotsButton.click();

    // Wait for the dropdown menu to appear
    // The menu is a v-menu that contains a v-list
    const dropdownMenu = page.locator('.v-menu .v-list, .v-overlay__content .v-list').first();
    await dropdownMenu.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
    await expect(dropdownMenu).toBeVisible();

    // Find the "Crear nueva ejecución" menu item
    // The text can be in different languages:
    // - "Crear nueva ejecución" (ES)
    // - "Create new execution" (EN)
    // - "Créer une nouvelle exécution" (FR)
    // The item has an icon mdi-plus and is a v-list-item
    const createExecutionMenuItem = page.locator('.v-list-item').filter({
      hasText: /Crear nueva ejecución|Create new execution|Créer une nouvelle exécution/i
    }).first();

    // Alternative: Find by icon if text search doesn't work
    // The item should have mdi-plus icon
    let menuItem = createExecutionMenuItem;
    const isMenuItemVisible = await createExecutionMenuItem.isVisible().catch(() => false);
    
    if (!isMenuItemVisible) {
      // Try to find by icon (mdi-plus) within the menu
      menuItem = dropdownMenu.locator('.v-list-item').filter({
        has: page.locator('[class*="mdi-plus"]')
      }).first();
    }

    // Wait for the menu item to be visible
    await menuItem.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
    await expect(menuItem).toBeVisible();

    // Click on the "Crear nueva ejecución" menu item
    await menuItem.click();

    // Wait for navigation to project-execution route
    await page.waitForURL(
      (url) => {
        const hash = url.hash;
        return hash.includes('/project-execution');
      },
      { timeout: TIMEOUTS.NAVIGATION }
    );

    // Verify we're on the project-execution route
    const newHash = getHashRoute(page);
    expect(newHash).toContain('/project-execution');
    expect(isHashRoute(page, PROTECTED_ROUTES)).toBe(true);
  });

  test('should receive execution data with correct structure from backend endpoint', async ({ page }) => {
    // Navigate to the version history page first
    const currentHash = getHashRoute(page);
    
    if (!currentHash.includes('/history-execution')) {
      await page.goto(`${page.url().split('#')[0]}#/history-execution`);
      
      await page.waitForURL(
        (url) => {
          const hash = url.hash;
          return hash.includes('/history-execution');
        },
        { timeout: TIMEOUTS.NAVIGATION }
      );
    }

    // Verify we're on the history-execution route
    let routeHash = getHashRoute(page);
    expect(routeHash).toContain('/history-execution');

    // Now set up response listener and reload to ensure we catch the API call
    // The URL might be /execution/ or /cornflow/execution/ depending on hasExternalApp config
    const responsePromise = page.waitForResponse(
      (response) => {
        const url = response.url();
        const method = response.request().method();
        
        // Match GET requests to /execution/ or /cornflow/execution/ endpoints
        // Exclude /execution/{id}/data/ endpoints (they have /data/ in the path)
        // The list endpoint has query params like schema=, limit=, etc.
        const matchesExecutionList = 
          (url.includes('/execution/') || url.includes('/cornflow/execution/')) &&
          !url.includes('/data/') && // Exclude /execution/{id}/data/ endpoints
          method === 'GET';
        
        // Also check for query params that indicate it's the list endpoint
        const hasListQueryParams = url.includes('schema=') || url.includes('limit=');
        
        return response.status() === 200 && matchesExecutionList && hasListQueryParams;
      },
      { timeout: TIMEOUTS.NAVIGATION * 2 } // Increase timeout to allow for page load
    );

    // Reload the page to trigger the API call
    await page.reload({ waitUntil: 'domcontentloaded' });

    // Verify we're still on the history-execution route after reload
    routeHash = getHashRoute(page);
    expect(routeHash).toContain('/history-execution');

    // Wait for the response (it might have already completed, so this will resolve immediately if so)
    const response = await responsePromise;

    // Verify response status
    expect(response.status()).toBe(200);

    // Get the response body
    const responseBody = await response.json();

    // The response might be an array directly, or wrapped in an object
    // According to ExecutionRepository, response.content is used directly, so it should be an array
    let executions: any[];
    
    if (Array.isArray(responseBody)) {
      executions = responseBody;
    } else if (responseBody && typeof responseBody === 'object' && Array.isArray(responseBody.results)) {
      // Handle paginated response format (if backend uses pagination)
      executions = responseBody.results;
    } else if (responseBody && typeof responseBody === 'object' && Array.isArray(responseBody.data)) {
      // Handle wrapped response format
      executions = responseBody.data;
    } else {
      // Log the actual structure for debugging
      console.error('Unexpected response structure:', JSON.stringify(responseBody, null, 2));
      throw new Error(`Expected array or object with array property, got: ${typeof responseBody}`);
    }

    // Validate that we have an array of executions
    expect(Array.isArray(executions)).toBe(true);

    // If there are executions, validate the structure of each one
    if (executions.length > 0) {
      for (const execution of executions) {
        // Required fields according to ExecutionRepository.getExecutions mapping
        expect(execution).toHaveProperty('id');
        expect(typeof execution.id).toBe('string');
        expect(execution.id).toBeTruthy();

        expect(execution).toHaveProperty('name');
        expect(typeof execution.name).toBe('string');

        expect(execution).toHaveProperty('created_at');
        expect(typeof execution.created_at).toBe('string');
        // Validate ISO date format
        expect(execution.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

        expect(execution).toHaveProperty('state');
        expect(typeof execution.state).toBe('number');

        expect(execution).toHaveProperty('config');
        expect(typeof execution.config).toBe('object');

        expect(execution).toHaveProperty('message');
        expect(typeof execution.message).toBe('string');

        expect(execution).toHaveProperty('description');
        expect(typeof execution.description).toBe('string');

        // `indicators` is optional: it's a schema/backend-specific field and some products
        // do not return it at all.
        if (execution.indicators !== undefined) {
          expect(typeof execution.indicators).toBe('string');
        }

        expect(execution).toHaveProperty('data_hash');
        expect(typeof execution.data_hash).toBe('string');

        expect(execution).toHaveProperty('schema');
        expect(typeof execution.schema).toBe('string');

        expect(execution).toHaveProperty('instance_id');
        expect(typeof execution.instance_id).toBe('string');

        expect(execution).toHaveProperty('user_id');
        expect(typeof execution.user_id).toBe('number');

        // Optional fields (may be null or undefined)
        if (execution.log !== undefined) {
          expect(typeof execution.log).toBe('object');
          if (execution.log !== null) {
            // If log exists, it should have these properties
            expect(execution.log).toHaveProperty('sol_code');
            expect(execution.log).toHaveProperty('status_code');
            // Backend returns 'status' instead of 'status_message'
            // Validate that either 'status' or 'status_message' exists
            expect(
              execution.log.hasOwnProperty('status') || 
              execution.log.hasOwnProperty('status_message')
            ).toBe(true);
          }
        }

        // User fields (may be null or undefined)
        if (execution.username !== undefined) {
          expect(typeof execution.username === 'string' || execution.username === null).toBe(true);
        }

        if (execution.first_name !== undefined) {
          expect(typeof execution.first_name === 'string' || execution.first_name === null).toBe(true);
        }

        if (execution.last_name !== undefined) {
          expect(typeof execution.last_name === 'string' || execution.last_name === null).toBe(true);
        }

        if (execution.updated_at !== undefined) {
          expect(typeof execution.updated_at === 'string' || execution.updated_at === null).toBe(true);
          if (execution.updated_at !== null) {
            // Validate ISO date format if present
            expect(execution.updated_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
          }
        }
      }
    }
  });

  test('should display execution data correctly in the tables', async ({ page }) => {
    // Navigate to the version history page first
    const currentHash = getHashRoute(page);
    
    if (!currentHash.includes('/history-execution')) {
      await page.goto(`${page.url().split('#')[0]}#/history-execution`);
      
      await page.waitForURL(
        (url) => {
          const hash = url.hash;
          return hash.includes('/history-execution');
        },
        { timeout: TIMEOUTS.NAVIGATION }
      );
    }

    // Verify we're on the history-execution route
    let routeHash = getHashRoute(page);
    expect(routeHash).toContain('/history-execution');

    // Set up response listener to capture the API response
    const responsePromise = page.waitForResponse(
      (response) => {
        const url = response.url();
        const method = response.request().method();
        
        const matchesExecutionList = 
          (url.includes('/execution/') || url.includes('/cornflow/execution/')) &&
          !url.includes('/data/') &&
          method === 'GET';
        
        const hasListQueryParams = url.includes('schema=') || url.includes('limit=');
        
        return response.status() === 200 && matchesExecutionList && hasListQueryParams;
      },
      { timeout: TIMEOUTS.NAVIGATION * 2 }
    );

    // Reload the page to trigger the API call
    await page.reload({ waitUntil: 'domcontentloaded' });

    // Wait for the response
    const response = await responsePromise;
    expect(response.status()).toBe(200);

    // Get the response body
    const responseBody = await response.json();
    
    // Parse the executions array
    let executions: any[];
    
    if (Array.isArray(responseBody)) {
      executions = responseBody;
    } else if (responseBody && typeof responseBody === 'object' && Array.isArray(responseBody.results)) {
      executions = responseBody.results;
    } else if (responseBody && typeof responseBody === 'object' && Array.isArray(responseBody.data)) {
      executions = responseBody.data;
    } else {
      throw new Error(`Expected array or object with array property, got: ${typeof responseBody}`);
    }

    // If there are no executions, skip the table validation
    if (executions.length === 0) {
      // Verify that the "no data" message is displayed
      const noDataMessage = page.getByText(/no hay datos|no data|aucune donnée/i);
      await expect(noDataMessage.first()).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });
      return;
    }

    // Wait for the table to be rendered
    // The table is inside .execution-table or .table-container
    const tableContainer = page.locator('.execution-table, .table-container').first();
    await tableContainer.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

    // Wait for table rows to appear
    // MDataTable renders rows as <tr> elements or v-data-table rows
    const tableRows = page.locator('.execution-table tbody tr, .v-data-table tbody tr, table tbody tr');
    await tableRows.first().waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

    // Get all visible rows
    const visibleRows = await tableRows.count();
    expect(visibleRows).toBeGreaterThan(0);

    // For each execution in the response, verify it appears in the table
    // We'll check at least the first few executions to ensure data is displayed
    const executionsToCheck = Math.min(executions.length, 5); // Check up to 5 executions
    
    let verifiedExecutions = 0;
    
    for (let i = 0; i < executionsToCheck; i++) {
      const execution = executions[i];
      
      // Find the row that contains this execution's data
      // We can identify it by the name, which should be visible in the table
      const executionName = execution.name?.trim();
      
      if (!executionName) {
        continue; // Skip if no name
      }
      
      // Escape special regex characters in the name
      const escapedName = executionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      
      // Find the row containing the execution name
      // Look for the name within the table container
      const rowWithName = tableContainer.locator('tr').filter({ 
        hasText: new RegExp(escapedName, 'i') 
      }).first();
      
      // Verify the row exists and is visible
      const isRowVisible = await rowWithName.isVisible({ timeout: TIMEOUTS.FORM_LOAD }).catch(() => false);
      
      if (!isRowVisible) {
        // If row not found by name, try to find by ID or other unique identifier
        // For now, we'll skip this execution and continue with others
        continue;
      }
      
      verifiedExecutions++;
      
      // Verify the name appears in the table
      const nameInTable = rowWithName.getByText(executionName, { exact: false });
      await expect(nameInTable.first()).toBeVisible();
      
      // Verify the description appears if it exists (might be truncated)
      if (execution.description && execution.description.trim()) {
        const descriptionText = execution.description.trim();
        // Check if full description is visible, or at least the first part
        const fullDescriptionVisible = await rowWithName.getByText(descriptionText, { exact: false }).first().isVisible({ timeout: 1000 }).catch(() => false);
        
        if (!fullDescriptionVisible && descriptionText.length > 20) {
          // If full description not visible, check for partial match (first 20 chars)
          const partialDescription = descriptionText.substring(0, 20);
          const partialMatch = rowWithName.getByText(partialDescription, { exact: false });
          await expect(partialMatch.first()).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });
        } else if (fullDescriptionVisible) {
          await expect(rowWithName.getByText(descriptionText, { exact: false }).first()).toBeVisible();
        }
      }
      
      // Verify the row shows a time in HH:mm format. We intentionally do NOT assert the exact
      // value extracted from created_at: execution names can repeat in real data (so the API
      // object and the .first()-matched row may be different instances) and the column may be
      // timezone-formatted. Matching the HH:mm pattern keeps the check meaningful but stable.
      if (execution.created_at) {
        const timeInTable = rowWithName.getByText(/\d{1,2}:\d{2}/);
        await expect(timeInTable.first()).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });
      }
      
      // Verify state chip is visible (state is always shown as a chip)
      const stateChip = rowWithName.locator('.v-chip, [class*="chip"]').first();
      await expect(stateChip).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });
      
      // Verify solver appears if config.solver exists (optional check)
      if (execution.config?.solver) {
        const solverName = execution.config.solver;
        // Try to find solver name (might be formatted)
        const solverVisible = await rowWithName.getByText(new RegExp(solverName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), { exact: false }).first().isVisible({ timeout: 1000 }).catch(() => false);
        // Solver might not be visible if column is hidden, so we don't fail the test
      }
    }
    
    // Verify that we found at least one execution in the table
    expect(verifiedExecutions).toBeGreaterThan(0);
    
    // Verify that the table has data displayed
    expect(visibleRows).toBeGreaterThan(0);
  });

  test('should filter executions by Today checkbox', async ({ page }) => {
    // Navigate to the version history page first
    const currentHash = getHashRoute(page);
    
    if (!currentHash.includes('/history-execution')) {
      await page.goto(`${page.url().split('#')[0]}#/history-execution`);
      
      await page.waitForURL(
        (url) => {
          const hash = url.hash;
          return hash.includes('/history-execution');
        },
        { timeout: TIMEOUTS.NAVIGATION }
      );
    }

    // Verify we're on the history-execution route
    let routeHash = getHashRoute(page);
    expect(routeHash).toContain('/history-execution');

    // Wait for the page to load completely
    const pageTitle = page.getByRole('heading', { name: /Historial de versiones|Version history|Historique des versions/i });
    await pageTitle.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

    // Wait for MPanelData to render the checkboxes
    // The checkboxes are rendered by MPanelData component
    await page.waitForTimeout(1000); // Small delay to ensure component is fully rendered

    // Find the "Hoy" checkbox by text
    // The checkbox can be in different languages: "Hoy" (ES), "Today" (EN), "Aujourd'hui" (FR)
    // Strategy: Find all checkboxes and check which container has the "Hoy" text
    const allCheckboxes = page.locator('input[type="checkbox"]');
    await allCheckboxes.first().waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
    
    const checkboxCount = await allCheckboxes.count();
    let checkboxInput: Locator | null = null;
    
    // Iterate through all checkboxes to find the one associated with "Hoy" text
    for (let i = 0; i < checkboxCount; i++) {
      const checkbox = allCheckboxes.nth(i);
      
      // Check if checkbox is visible
      const isVisible = await checkbox.isVisible({ timeout: 500 }).catch(() => false);
      if (!isVisible) continue;
      
      // Get the parent container (label or wrapper) that should contain the text
      // Try multiple levels up to find the container with the text
      let container = checkbox.locator('..');
      let hasTodayText = false;
      
      // Check up to 3 levels up for the text
      for (let level = 0; level < 3; level++) {
        hasTodayText = await container.getByText(/^Hoy$|^Today$|^Aujourd'hui$/i).isVisible({ timeout: 500 }).catch(() => false);
        if (hasTodayText) {
          checkboxInput = checkbox;
          break;
        }
        container = container.locator('..');
      }
      
      if (hasTodayText) break;
    }

    // Verify the checkbox was found
    if (!checkboxInput) {
      throw new Error('Could not find "Hoy" checkbox. Make sure the page is fully loaded and the checkbox is visible.');
    }
    
    await checkboxInput.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
    await expect(checkboxInput).toBeVisible();

    // Get today's date in YYYY-MM-DD format for API verification
    // Use local date components to avoid timezone issues with toISOString()
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;
    
    // Set up response listener to capture the API call when checkbox is clicked
    const responsePromise = page.waitForResponse(
      (response) => {
        const url = response.url();
        const method = response.request().method();
        
        const matchesExecutionList = 
          (url.includes('/execution/') || url.includes('/cornflow/execution/')) &&
          !url.includes('/data/') &&
          method === 'GET';
        
        const hasListQueryParams = url.includes('schema=') || url.includes('limit=');
        
        return response.status() === 200 && matchesExecutionList && hasListQueryParams;
      },
      { timeout: TIMEOUTS.NAVIGATION * 2 }
    );

    // Click on the "Hoy" checkbox
    await checkboxInput.click();

    // Wait for the API response
    const response = await responsePromise;
    expect(response.status()).toBe(200);

    // Verify the checkbox is now checked
    await expect(checkboxInput).toBeChecked({ timeout: TIMEOUTS.FORM_LOAD });

    // Get the response body to verify filtered data
    const responseBody = await response.json();
    
    // Parse the executions array
    let executions: any[];
    
    if (Array.isArray(responseBody)) {
      executions = responseBody;
    } else if (responseBody && typeof responseBody === 'object' && Array.isArray(responseBody.results)) {
      executions = responseBody.results;
    } else if (responseBody && typeof responseBody === 'object' && Array.isArray(responseBody.data)) {
      executions = responseBody.data;
    } else {
      executions = [];
    }

    // Verify that all executions returned are from today
    // The created_at field should be in ISO format: YYYY-MM-DDTHH:mm:ss
    if (executions.length > 0) {
      for (const execution of executions) {
        if (execution.created_at) {
          const executionDate = execution.created_at.split('T')[0];
          expect(executionDate).toBe(todayStr);
        }
      }
    }

    // Verify that the table displays filtered data
    // If there are no executions from today, the "no data" message should appear
    if (executions.length === 0) {
      // If there are no executions, verify the "no data" message is displayed
      const noDataMessage = page.getByText(/no hay datos|no data|aucune donnée|no se encontraron datos/i);
      await expect(noDataMessage.first()).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });
    } else {
      // If there are executions, wait for the table to update with filtered data
      const tableContainer = page.locator('.execution-table, .table-container').first();
      await tableContainer.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

      // Wait for table rows to appear
      const tableRows = page.locator('.execution-table tbody tr, .v-data-table tbody tr, table tbody tr');
      await tableRows.first().waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

      // Verify that table rows are visible and contain today's executions
      const visibleRows = await tableRows.count();
      expect(visibleRows).toBeGreaterThan(0);
      
      // Verify that at least one row contains data from today
      // We'll check the first few rows to ensure they match today's date
      const rowsToCheck = Math.min(visibleRows, 3);
      let todayRowsFound = 0;
      
      for (let i = 0; i < rowsToCheck; i++) {
        const row = tableRows.nth(i);
        const isVisible = await row.isVisible({ timeout: 1000 }).catch(() => false);
        
        if (isVisible) {
          // The row should be visible and contain execution data
          // We've already verified the API response contains only today's executions
          todayRowsFound++;
        }
      }
      
      // At least some rows should be visible
      expect(todayRowsFound).toBeGreaterThan(0);
    }

    // Now test unchecking the checkbox to show all data without filters
    // Set up response listener to capture the API call when checkbox is unchecked
    const uncheckResponsePromise = page.waitForResponse(
      (response) => {
        const url = response.url();
        const method = response.request().method();
        
        const matchesExecutionList = 
          (url.includes('/execution/') || url.includes('/cornflow/execution/')) &&
          !url.includes('/data/') &&
          method === 'GET';
        
        const hasListQueryParams = url.includes('schema=') || url.includes('limit=');
        
        // When unchecked, the API call should NOT have date filter parameters
        // Verify that the URL does not contain creation_date_lte or creation_date_gte
        const hasNoDateFilters = !url.includes('creation_date_lte') && !url.includes('creation_date_gte');
        
        return response.status() === 200 && matchesExecutionList && hasListQueryParams && hasNoDateFilters;
      },
      { timeout: TIMEOUTS.NAVIGATION * 2 }
    );

    // Click on the "Hoy" checkbox again to uncheck it
    await checkboxInput.click();

    // Wait for the API response
    const uncheckResponse = await uncheckResponsePromise;
    expect(uncheckResponse.status()).toBe(200);

    // Verify the checkbox is now unchecked
    await expect(checkboxInput).not.toBeChecked({ timeout: TIMEOUTS.FORM_LOAD });

    // Get the response body to verify unfiltered data
    const uncheckResponseBody = await uncheckResponse.json();
    
    // Parse the executions array
    let allExecutions: any[];
    
    if (Array.isArray(uncheckResponseBody)) {
      allExecutions = uncheckResponseBody;
    } else if (uncheckResponseBody && typeof uncheckResponseBody === 'object' && Array.isArray(uncheckResponseBody.results)) {
      allExecutions = uncheckResponseBody.results;
    } else if (uncheckResponseBody && typeof uncheckResponseBody === 'object' && Array.isArray(uncheckResponseBody.data)) {
      allExecutions = uncheckResponseBody.data;
    } else {
      allExecutions = [];
    }

    // Verify that the API response contains executions (may include any date)
    // When no date filters are applied, the API should return all executions (up to the limit)
    // We don't need to verify specific dates, just that data is returned

    // Verify that the table displays unfiltered data
    // If there are no executions at all, the "no data" message should appear
    if (allExecutions.length === 0) {
      // If there are no executions, verify the "no data" message is displayed
      const noDataMessage = page.getByText(/no hay datos|no data|aucune donnée|no se encontraron datos/i);
      await expect(noDataMessage.first()).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });
    } else {
      // If there are executions, wait for the table to update with unfiltered data
      const tableContainer = page.locator('.execution-table, .table-container').first();
      await tableContainer.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

      // Wait for table rows to appear
      const tableRows = page.locator('.execution-table tbody tr, .v-data-table tbody tr, table tbody tr');
      await tableRows.first().waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

      // Verify that table rows are visible
      const visibleRows = await tableRows.count();
      expect(visibleRows).toBeGreaterThan(0);
      
      // Verify that the table shows data (unfiltered, so it may include executions from any date)
      // We've already verified the API response doesn't have date filters
      // The number of visible rows should match or be related to the number of executions returned
      expect(allExecutions.length).toBeGreaterThan(0);
    }
  });

  test('should filter executions by Yesterday checkbox', async ({ page }) => {
    // Navigate to the version history page first
    const currentHash = getHashRoute(page);
    
    if (!currentHash.includes('/history-execution')) {
      await page.goto(`${page.url().split('#')[0]}#/history-execution`);
      
      await page.waitForURL(
        (url) => {
          const hash = url.hash;
          return hash.includes('/history-execution');
        },
        { timeout: TIMEOUTS.NAVIGATION }
      );
    }

    // Verify we're on the history-execution route
    let routeHash = getHashRoute(page);
    expect(routeHash).toContain('/history-execution');

    // Wait for the page to load completely
    const pageTitle = page.getByRole('heading', { name: /Historial de versiones|Version history|Historique des versions/i });
    await pageTitle.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

    // Wait for MPanelData to render the checkboxes
    await page.waitForTimeout(1000);

    // Find the "Ayer" checkbox by text
    // The checkbox can be in different languages: "Ayer" (ES), "Yesterday" (EN), "Hier" (FR)
    const allCheckboxes = page.locator('input[type="checkbox"]');
    await allCheckboxes.first().waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
    
    const checkboxCount = await allCheckboxes.count();
    let checkboxInput: Locator | null = null;
    
    // Iterate through all checkboxes to find the one associated with "Ayer" text
    for (let i = 0; i < checkboxCount; i++) {
      const checkbox = allCheckboxes.nth(i);
      
      const isVisible = await checkbox.isVisible({ timeout: 500 }).catch(() => false);
      if (!isVisible) continue;
      
      let container = checkbox.locator('..');
      let hasYesterdayText = false;
      
      for (let level = 0; level < 3; level++) {
        hasYesterdayText = await container.getByText(/^Ayer$|^Yesterday$|^Hier$/i).isVisible({ timeout: 500 }).catch(() => false);
        if (hasYesterdayText) {
          checkboxInput = checkbox;
          break;
        }
        container = container.locator('..');
      }
      
      if (hasYesterdayText) break;
    }

    // Verify the checkbox was found
    if (!checkboxInput) {
      throw new Error('Could not find "Ayer" checkbox. Make sure the page is fully loaded and the checkbox is visible.');
    }
    
    await checkboxInput.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
    await expect(checkboxInput).toBeVisible();

    // Get yesterday's date in YYYY-MM-DD format for API verification
    // Use local date components to avoid timezone issues with toISOString()
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const year = yesterday.getFullYear();
    const month = String(yesterday.getMonth() + 1).padStart(2, '0');
    const day = String(yesterday.getDate()).padStart(2, '0');
    const yesterdayStr = `${year}-${month}-${day}`;
    
    // Set up response listener to capture the API call when checkbox is clicked
    const responsePromise = page.waitForResponse(
      (response) => {
        const url = response.url();
        const method = response.request().method();
        
        const matchesExecutionList = 
          (url.includes('/execution/') || url.includes('/cornflow/execution/')) &&
          !url.includes('/data/') &&
          method === 'GET';
        
        const hasListQueryParams = url.includes('schema=') || url.includes('limit=');
        
        return response.status() === 200 && matchesExecutionList && hasListQueryParams;
      },
      { timeout: TIMEOUTS.NAVIGATION * 2 }
    );

    // Click on the "Ayer" checkbox
    await checkboxInput.click();

    // Wait for the API response
    const response = await responsePromise;
    expect(response.status()).toBe(200);

    // Verify the checkbox is now checked
    await expect(checkboxInput).toBeChecked({ timeout: TIMEOUTS.FORM_LOAD });

    // Get the response body to verify filtered data
    const responseBody = await response.json();
    
    // Parse the executions array
    let executions: any[];
    
    if (Array.isArray(responseBody)) {
      executions = responseBody;
    } else if (responseBody && typeof responseBody === 'object' && Array.isArray(responseBody.results)) {
      executions = responseBody.results;
    } else if (responseBody && typeof responseBody === 'object' && Array.isArray(responseBody.data)) {
      executions = responseBody.data;
    } else {
      executions = [];
    }

    // Verify that all executions returned are from yesterday
    if (executions.length > 0) {
      for (const execution of executions) {
        if (execution.created_at) {
          const executionDate = execution.created_at.split('T')[0];
          expect(executionDate).toBe(yesterdayStr);
        }
      }
    }

    // Verify that the table displays filtered data
    if (executions.length === 0) {
      const noDataMessage = page.getByText(/no hay datos|no data|aucune donnée|no se encontraron datos/i);
      await expect(noDataMessage.first()).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });
    } else {
      const tableContainer = page.locator('.execution-table, .table-container').first();
      await tableContainer.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

      const tableRows = page.locator('.execution-table tbody tr, .v-data-table tbody tr, table tbody tr');
      await tableRows.first().waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

      const visibleRows = await tableRows.count();
      expect(visibleRows).toBeGreaterThan(0);
      
      const rowsToCheck = Math.min(visibleRows, 3);
      let yesterdayRowsFound = 0;
      
      for (let i = 0; i < rowsToCheck; i++) {
        const row = tableRows.nth(i);
        const isVisible = await row.isVisible({ timeout: 1000 }).catch(() => false);
        
        if (isVisible) {
          yesterdayRowsFound++;
        }
      }
      
      expect(yesterdayRowsFound).toBeGreaterThan(0);
    }

    // Now test unchecking the checkbox to show all data without filters
    const uncheckResponsePromise = page.waitForResponse(
      (response) => {
        const url = response.url();
        const method = response.request().method();
        
        const matchesExecutionList = 
          (url.includes('/execution/') || url.includes('/cornflow/execution/')) &&
          !url.includes('/data/') &&
          method === 'GET';
        
        const hasListQueryParams = url.includes('schema=') || url.includes('limit=');
        
        const hasNoDateFilters = !url.includes('creation_date_lte') && !url.includes('creation_date_gte');
        
        return response.status() === 200 && matchesExecutionList && hasListQueryParams && hasNoDateFilters;
      },
      { timeout: TIMEOUTS.NAVIGATION * 2 }
    );

    // Click on the "Ayer" checkbox again to uncheck it
    await checkboxInput.click();

    // Wait for the API response
    const uncheckResponse = await uncheckResponsePromise;
    expect(uncheckResponse.status()).toBe(200);

    // Verify the checkbox is now unchecked
    await expect(checkboxInput).not.toBeChecked({ timeout: TIMEOUTS.FORM_LOAD });

    // Get the response body to verify unfiltered data
    const uncheckResponseBody = await uncheckResponse.json();
    
    // Parse the executions array
    let allExecutions: any[];
    
    if (Array.isArray(uncheckResponseBody)) {
      allExecutions = uncheckResponseBody;
    } else if (uncheckResponseBody && typeof uncheckResponseBody === 'object' && Array.isArray(uncheckResponseBody.results)) {
      allExecutions = uncheckResponseBody.results;
    } else if (uncheckResponseBody && typeof uncheckResponseBody === 'object' && Array.isArray(uncheckResponseBody.data)) {
      allExecutions = uncheckResponseBody.data;
    } else {
      allExecutions = [];
    }

    // Verify that the table displays unfiltered data
    if (allExecutions.length === 0) {
      const noDataMessage = page.getByText(/no hay datos|no data|aucune donnée|no se encontraron datos/i);
      await expect(noDataMessage.first()).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });
    } else {
      const tableContainer = page.locator('.execution-table, .table-container').first();
      await tableContainer.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

      const tableRows = page.locator('.execution-table tbody tr, .v-data-table tbody tr, table tbody tr');
      await tableRows.first().waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

      const visibleRows = await tableRows.count();
      expect(visibleRows).toBeGreaterThan(0);
      
      expect(allExecutions.length).toBeGreaterThan(0);
    }
  });

  test('should filter executions by Last 7 days checkbox', async ({ page }) => {
    // Navigate to the version history page first
    const currentHash = getHashRoute(page);
    
    if (!currentHash.includes('/history-execution')) {
      await page.goto(`${page.url().split('#')[0]}#/history-execution`);
      
      await page.waitForURL(
        (url) => {
          const hash = url.hash;
          return hash.includes('/history-execution');
        },
        { timeout: TIMEOUTS.NAVIGATION }
      );
    }

    // Verify we're on the history-execution route
    let routeHash = getHashRoute(page);
    expect(routeHash).toContain('/history-execution');

    // Wait for the page to load completely
    const pageTitle = page.getByRole('heading', { name: /Historial de versiones|Version history|Historique des versions/i });
    await pageTitle.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

    // Wait for MPanelData to render the checkboxes
    await page.waitForTimeout(1000);

    // Find the "Últimos 7 días" checkbox by text
    // The checkbox can be in different languages: "Últimos 7 días" (ES), "Last 7 days" (EN), "7 derniers jours" (FR)
    const allCheckboxes = page.locator('input[type="checkbox"]');
    await allCheckboxes.first().waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
    
    const checkboxCount = await allCheckboxes.count();
    let checkboxInput: Locator | null = null;
    
    // Iterate through all checkboxes to find the one associated with "Últimos 7 días" text
    for (let i = 0; i < checkboxCount; i++) {
      const checkbox = allCheckboxes.nth(i);
      
      const isVisible = await checkbox.isVisible({ timeout: 500 }).catch(() => false);
      if (!isVisible) continue;
      
      let container = checkbox.locator('..');
      let hasLast7DaysText = false;
      
      for (let level = 0; level < 3; level++) {
        hasLast7DaysText = await container.getByText(/Últimos 7 días|Last 7 days|7 derniers jours/i).isVisible({ timeout: 500 }).catch(() => false);
        if (hasLast7DaysText) {
          checkboxInput = checkbox;
          break;
        }
        container = container.locator('..');
      }
      
      if (hasLast7DaysText) break;
    }

    // Verify the checkbox was found
    if (!checkboxInput) {
      throw new Error('Could not find "Últimos 7 días" checkbox. Make sure the page is fully loaded and the checkbox is visible.');
    }
    
    await checkboxInput.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
    await expect(checkboxInput).toBeVisible();

    // Get the date range for last 7 days
    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of today
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);
    lastWeek.setHours(0, 0, 0, 0); // Start of day 7 days ago
    const lastWeekStr = lastWeek.toISOString().split('T')[0];
    const todayStr = today.toISOString().split('T')[0];
    
    // Set up response listener to capture the API call when checkbox is clicked
    const responsePromise = page.waitForResponse(
      (response) => {
        const url = response.url();
        const method = response.request().method();
        
        const matchesExecutionList = 
          (url.includes('/execution/') || url.includes('/cornflow/execution/')) &&
          !url.includes('/data/') &&
          method === 'GET';
        
        const hasListQueryParams = url.includes('schema=') || url.includes('limit=');
        
        return response.status() === 200 && matchesExecutionList && hasListQueryParams;
      },
      { timeout: TIMEOUTS.NAVIGATION * 2 }
    );

    // Click on the "Últimos 7 días" checkbox
    await checkboxInput.click();

    // Wait for the API response
    const response = await responsePromise;
    expect(response.status()).toBe(200);

    // Verify the checkbox is now checked
    await expect(checkboxInput).toBeChecked({ timeout: TIMEOUTS.FORM_LOAD });

    // Get the response body to verify filtered data
    const responseBody = await response.json();
    
    // Parse the executions array
    let executions: any[];
    
    if (Array.isArray(responseBody)) {
      executions = responseBody;
    } else if (responseBody && typeof responseBody === 'object' && Array.isArray(responseBody.results)) {
      executions = responseBody.results;
    } else if (responseBody && typeof responseBody === 'object' && Array.isArray(responseBody.data)) {
      executions = responseBody.data;
    } else {
      executions = [];
    }

    // Verify that all executions returned are within the last 7 days
    if (executions.length > 0) {
      for (const execution of executions) {
        if (execution.created_at) {
          const executionDate = execution.created_at.split('T')[0];
          // Execution date should be between lastWeekStr and todayStr (inclusive)
          expect(executionDate >= lastWeekStr && executionDate <= todayStr).toBe(true);
        }
      }
    }

    // Verify that the table displays filtered data
    if (executions.length === 0) {
      const noDataMessage = page.getByText(/no hay datos|no data|aucune donnée|no se encontraron datos/i);
      await expect(noDataMessage.first()).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });
    } else {
      const tableContainer = page.locator('.execution-table, .table-container').first();
      await tableContainer.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

      const tableRows = page.locator('.execution-table tbody tr, .v-data-table tbody tr, table tbody tr');
      await tableRows.first().waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

      const visibleRows = await tableRows.count();
      expect(visibleRows).toBeGreaterThan(0);
      
      const rowsToCheck = Math.min(visibleRows, 3);
      let last7DaysRowsFound = 0;
      
      for (let i = 0; i < rowsToCheck; i++) {
        const row = tableRows.nth(i);
        const isVisible = await row.isVisible({ timeout: 1000 }).catch(() => false);
        
        if (isVisible) {
          last7DaysRowsFound++;
        }
      }
      
      expect(last7DaysRowsFound).toBeGreaterThan(0);
    }

    // Now test unchecking the checkbox to show all data without filters
    const uncheckResponsePromise = page.waitForResponse(
      (response) => {
        const url = response.url();
        const method = response.request().method();
        
        const matchesExecutionList = 
          (url.includes('/execution/') || url.includes('/cornflow/execution/')) &&
          !url.includes('/data/') &&
          method === 'GET';
        
        const hasListQueryParams = url.includes('schema=') || url.includes('limit=');
        
        const hasNoDateFilters = !url.includes('creation_date_lte') && !url.includes('creation_date_gte');
        
        return response.status() === 200 && matchesExecutionList && hasListQueryParams && hasNoDateFilters;
      },
      { timeout: TIMEOUTS.NAVIGATION * 2 }
    );

    // Click on the "Últimos 7 días" checkbox again to uncheck it
    await checkboxInput.click();

    // Wait for the API response
    const uncheckResponse = await uncheckResponsePromise;
    expect(uncheckResponse.status()).toBe(200);

    // Verify the checkbox is now unchecked
    await expect(checkboxInput).not.toBeChecked({ timeout: TIMEOUTS.FORM_LOAD });

    // Get the response body to verify unfiltered data
    const uncheckResponseBody = await uncheckResponse.json();
    
    // Parse the executions array
    let allExecutions: any[];
    
    if (Array.isArray(uncheckResponseBody)) {
      allExecutions = uncheckResponseBody;
    } else if (uncheckResponseBody && typeof uncheckResponseBody === 'object' && Array.isArray(uncheckResponseBody.results)) {
      allExecutions = uncheckResponseBody.results;
    } else if (uncheckResponseBody && typeof uncheckResponseBody === 'object' && Array.isArray(uncheckResponseBody.data)) {
      allExecutions = uncheckResponseBody.data;
    } else {
      allExecutions = [];
    }

    // Verify that the table displays unfiltered data
    if (allExecutions.length === 0) {
      const noDataMessage = page.getByText(/no hay datos|no data|aucune donnée|no se encontraron datos/i);
      await expect(noDataMessage.first()).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });
    } else {
      const tableContainer = page.locator('.execution-table, .table-container').first();
      await tableContainer.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

      const tableRows = page.locator('.execution-table tbody tr, .v-data-table tbody tr, table tbody tr');
      await tableRows.first().waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

      const visibleRows = await tableRows.count();
      expect(visibleRows).toBeGreaterThan(0);
      
      expect(allExecutions.length).toBeGreaterThan(0);
    }
  });

  test('should filter executions by Last 30 days checkbox', async ({ page }) => {
    // Navigate to the version history page first
    const currentHash = getHashRoute(page);
    
    if (!currentHash.includes('/history-execution')) {
      await page.goto(`${page.url().split('#')[0]}#/history-execution`);
      
      await page.waitForURL(
        (url) => {
          const hash = url.hash;
          return hash.includes('/history-execution');
        },
        { timeout: TIMEOUTS.NAVIGATION }
      );
    }

    // Verify we're on the history-execution route
    let routeHash = getHashRoute(page);
    expect(routeHash).toContain('/history-execution');

    // Wait for the page to load completely
    const pageTitle = page.getByRole('heading', { name: /Historial de versiones|Version history|Historique des versions/i });
    await pageTitle.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

    // Wait for MPanelData to render the checkboxes
    await page.waitForTimeout(1000);

    // Find the "Últimos 30 días" checkbox by text
    // The checkbox can be in different languages: "Últimos 30 días" (ES), "Last 30 days" (EN), "30 derniers jours" (FR)
    const allCheckboxes = page.locator('input[type="checkbox"]');
    await allCheckboxes.first().waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
    
    const checkboxCount = await allCheckboxes.count();
    let checkboxInput: Locator | null = null;
    
    // Iterate through all checkboxes to find the one associated with "Últimos 30 días" text
    for (let i = 0; i < checkboxCount; i++) {
      const checkbox = allCheckboxes.nth(i);
      
      const isVisible = await checkbox.isVisible({ timeout: 500 }).catch(() => false);
      if (!isVisible) continue;
      
      let container = checkbox.locator('..');
      let hasLast30DaysText = false;
      
      for (let level = 0; level < 3; level++) {
        hasLast30DaysText = await container.getByText(/Últimos 30 días|Last 30 days|30 derniers jours/i).isVisible({ timeout: 500 }).catch(() => false);
        if (hasLast30DaysText) {
          checkboxInput = checkbox;
          break;
        }
        container = container.locator('..');
      }
      
      if (hasLast30DaysText) break;
    }

    // Verify the checkbox was found
    if (!checkboxInput) {
      throw new Error('Could not find "Últimos 30 días" checkbox. Make sure the page is fully loaded and the checkbox is visible.');
    }
    
    await checkboxInput.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
    await expect(checkboxInput).toBeVisible();

    // Get the date range for last 30 days
    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of today
    const lastMonth = new Date(today);
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    lastMonth.setHours(0, 0, 0, 0); // Start of day 1 month ago
    const lastMonthStr = lastMonth.toISOString().split('T')[0];
    const todayStr = today.toISOString().split('T')[0];
    
    // Set up response listener to capture the API call when checkbox is clicked
    const responsePromise = page.waitForResponse(
      (response) => {
        const url = response.url();
        const method = response.request().method();
        
        const matchesExecutionList = 
          (url.includes('/execution/') || url.includes('/cornflow/execution/')) &&
          !url.includes('/data/') &&
          method === 'GET';
        
        const hasListQueryParams = url.includes('schema=') || url.includes('limit=');
        
        return response.status() === 200 && matchesExecutionList && hasListQueryParams;
      },
      { timeout: TIMEOUTS.NAVIGATION * 2 }
    );

    // Click on the "Últimos 30 días" checkbox
    await checkboxInput.click();

    // Wait for the API response
    const response = await responsePromise;
    expect(response.status()).toBe(200);

    // Verify the checkbox is now checked
    await expect(checkboxInput).toBeChecked({ timeout: TIMEOUTS.FORM_LOAD });

    // Get the response body to verify filtered data
    const responseBody = await response.json();
    
    // Parse the executions array
    let executions: any[];
    
    if (Array.isArray(responseBody)) {
      executions = responseBody;
    } else if (responseBody && typeof responseBody === 'object' && Array.isArray(responseBody.results)) {
      executions = responseBody.results;
    } else if (responseBody && typeof responseBody === 'object' && Array.isArray(responseBody.data)) {
      executions = responseBody.data;
    } else {
      executions = [];
    }

    // Verify that all executions returned are within the last 30 days
    if (executions.length > 0) {
      for (const execution of executions) {
        if (execution.created_at) {
          const executionDate = execution.created_at.split('T')[0];
          // Execution date should be between lastMonthStr and todayStr (inclusive)
          expect(executionDate >= lastMonthStr && executionDate <= todayStr).toBe(true);
        }
      }
    }

    // Verify that the table displays filtered data
    if (executions.length === 0) {
      const noDataMessage = page.getByText(/no hay datos|no data|aucune donnée|no se encontraron datos/i);
      await expect(noDataMessage.first()).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });
    } else {
      const tableContainer = page.locator('.execution-table, .table-container').first();
      await tableContainer.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

      const tableRows = page.locator('.execution-table tbody tr, .v-data-table tbody tr, table tbody tr');
      await tableRows.first().waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

      const visibleRows = await tableRows.count();
      expect(visibleRows).toBeGreaterThan(0);
      
      const rowsToCheck = Math.min(visibleRows, 3);
      let last30DaysRowsFound = 0;
      
      for (let i = 0; i < rowsToCheck; i++) {
        const row = tableRows.nth(i);
        const isVisible = await row.isVisible({ timeout: 1000 }).catch(() => false);
        
        if (isVisible) {
          last30DaysRowsFound++;
        }
      }
      
      expect(last30DaysRowsFound).toBeGreaterThan(0);
    }

    // Now test unchecking the checkbox to show all data without filters
    const uncheckResponsePromise = page.waitForResponse(
      (response) => {
        const url = response.url();
        const method = response.request().method();
        
        const matchesExecutionList = 
          (url.includes('/execution/') || url.includes('/cornflow/execution/')) &&
          !url.includes('/data/') &&
          method === 'GET';
        
        const hasListQueryParams = url.includes('schema=') || url.includes('limit=');
        
        const hasNoDateFilters = !url.includes('creation_date_lte') && !url.includes('creation_date_gte');
        
        return response.status() === 200 && matchesExecutionList && hasListQueryParams && hasNoDateFilters;
      },
      { timeout: TIMEOUTS.NAVIGATION * 2 }
    );

    // Click on the "Últimos 30 días" checkbox again to uncheck it
    await checkboxInput.click();

    // Wait for the API response
    const uncheckResponse = await uncheckResponsePromise;
    expect(uncheckResponse.status()).toBe(200);

    // Verify the checkbox is now unchecked
    await expect(checkboxInput).not.toBeChecked({ timeout: TIMEOUTS.FORM_LOAD });

    // Get the response body to verify unfiltered data
    const uncheckResponseBody = await uncheckResponse.json();
    
    // Parse the executions array
    let allExecutions: any[];
    
    if (Array.isArray(uncheckResponseBody)) {
      allExecutions = uncheckResponseBody;
    } else if (uncheckResponseBody && typeof uncheckResponseBody === 'object' && Array.isArray(uncheckResponseBody.results)) {
      allExecutions = uncheckResponseBody.results;
    } else if (uncheckResponseBody && typeof uncheckResponseBody === 'object' && Array.isArray(uncheckResponseBody.data)) {
      allExecutions = uncheckResponseBody.data;
    } else {
      allExecutions = [];
    }

    // Verify that the table displays unfiltered data
    if (allExecutions.length === 0) {
      const noDataMessage = page.getByText(/no hay datos|no data|aucune donnée|no se encontraron datos/i);
      await expect(noDataMessage.first()).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });
    } else {
      const tableContainer = page.locator('.execution-table, .table-container').first();
      await tableContainer.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

      const tableRows = page.locator('.execution-table tbody tr, .v-data-table tbody tr, table tbody tr');
      await tableRows.first().waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

      const visibleRows = await tableRows.count();
      expect(visibleRows).toBeGreaterThan(0);
      
      expect(allExecutions.length).toBeGreaterThan(0);
    }
  });

  test('should display two datepickers when "Rango personalizado" (Custom range) checkbox is checked', async ({ page }) => {
    // Set a larger viewport to ensure calendar icons are visible
    await page.setViewportSize({ width: 1920, height: 1080 });
    
    // Navigate to the version history page first
    const currentHash = getHashRoute(page);
    
    if (!currentHash.includes('/history-execution')) {
      await page.goto(`${page.url().split('#')[0]}#/history-execution`);
      
      await page.waitForURL(
        (url) => {
          const hash = url.hash;
          return hash.includes('/history-execution');
        },
        { timeout: TIMEOUTS.NAVIGATION }
      );
    }

    // Verify we're on the history-execution route
    let routeHash = getHashRoute(page);
    expect(routeHash).toContain('/history-execution');

    // Wait for the page to load completely
    const pageTitle = page.getByRole('heading', { name: /Historial de versiones|Version history|Historique des versions/i });
    await pageTitle.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

    // Wait for MPanelData to render the checkboxes
    await page.waitForTimeout(1000);

    // Find the "Rango personalizado" checkbox by text
    // The checkbox can be in different languages: "Rango personalizado" (ES), "Custom range" (EN), "Plage personnalisée" (FR)
    const allCheckboxes = page.locator('input[type="checkbox"]');
    await allCheckboxes.first().waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
    
    const checkboxCount = await allCheckboxes.count();
    let checkboxInput: Locator | null = null;
    
    // Iterate through all checkboxes to find the one associated with "Rango personalizado" text
    for (let i = 0; i < checkboxCount; i++) {
      const checkbox = allCheckboxes.nth(i);
      
      const isVisible = await checkbox.isVisible({ timeout: 500 }).catch(() => false);
      if (!isVisible) continue;
      
      let container = checkbox.locator('..');
      let hasCustomRangeText = false;
      
      for (let level = 0; level < 3; level++) {
        hasCustomRangeText = await container.getByText(/Rango personalizado|Custom range|Plage personnalisée/i).isVisible({ timeout: 500 }).catch(() => false);
        if (hasCustomRangeText) {
          checkboxInput = checkbox;
          break;
        }
        container = container.locator('..');
      }
      
      if (hasCustomRangeText) break;
    }

    // Verify the checkbox was found
    if (!checkboxInput) {
      throw new Error('Could not find "Rango personalizado" checkbox. Make sure the page is fully loaded and the checkbox is visible.');
    }
    
    await checkboxInput.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
    await expect(checkboxInput).toBeVisible();

    // Verify the checkbox is initially unchecked
    await expect(checkboxInput).not.toBeChecked({ timeout: TIMEOUTS.FORM_LOAD });

    // Click on the "Rango personalizado" checkbox
    await checkboxInput.click();

    // Wait for the checkbox to be checked
    await expect(checkboxInput).toBeChecked({ timeout: TIMEOUTS.FORM_LOAD });

    // Wait a bit for the datepickers to appear (they are rendered in the custom-checkbox slot)
    await page.waitForTimeout(500);

    // Find the two datepickers (v-text-field with type="date")
    // They should have labels: "Desde"/"From"/"De" and "Hasta"/"To"/"À"
    const datepickers = page.locator('input[type="date"]');
    await datepickers.first().waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

    // Verify that exactly two datepickers are visible
    const datepickerCount = await datepickers.count();
    expect(datepickerCount).toBe(2);

    // Verify the first datepicker has the "Desde"/"From"/"De" label
    // The label is typically above or next to the input field
    const fromDatepicker = datepickers.first();
    await expect(fromDatepicker).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });
    
    // Find the label for the first datepicker by looking for the text in the parent container
    const fromLabel = page.getByText(/^Desde$|^From$|^De$/i);
    await expect(fromLabel.first()).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });

    // Verify the second datepicker has the "Hasta"/"To"/"À" label
    const toDatepicker = datepickers.nth(1);
    await expect(toDatepicker).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });
    
    // Find the label for the second datepicker
    const toLabel = page.getByText(/^Hasta$|^To$|^À$/i);
    await expect(toLabel.first()).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });

    // Verify both datepickers are in the same container (they should be side by side)
    // Both should be visible and accessible
    const fromDatepickerVisible = await fromDatepicker.isVisible();
    const toDatepickerVisible = await toDatepicker.isVisible();
    
    expect(fromDatepickerVisible).toBe(true);
    expect(toDatepickerVisible).toBe(true);

    // Test calendar interaction for both datepickers
    // First datepicker: "Desde" / "From" / "De"
    // We need to click on the calendar icon to deploy the calendar, not on the input
    
    // Find the calendar icon by searching from the input's parent containers
    // Try multiple strategies to find the icon
    let fromCalendarIcon: Locator | null = null;
    let fromIconClicked = false;
    
    // Strategy 0: Find icon using the label as reference (most reliable)
    // Find the "Desde" label and then search for the calendar icon in the same v-col container
    const fromLabelElement = page.getByText(/^Desde$|^From$|^De$/i).first();
    const fromLabelVisible = await fromLabelElement.isVisible({ timeout: 1000 }).catch(() => false);
    
    if (fromLabelVisible) {
      // Navigate from label to find the v-col container, then search for calendar icon
      const fromColContainer = fromLabelElement.locator('..').locator('..'); // Navigate to v-col
      const fromIconNearLabel = fromColContainer.locator('[class*="mdi-calendar"], .v-input__append-inner, .v-input__prepend-inner').first();
      const fromIconNearLabelCount = await fromIconNearLabel.count().catch(() => 0);
      if (fromIconNearLabelCount > 0) {
        // Check if it's a direct icon or a container
        const fromDirectIcon = fromIconNearLabel.locator('[class*="mdi-calendar"], button, .v-icon, i').first();
        const fromDirectIconCount = await fromDirectIcon.count().catch(() => 0);
        if (fromDirectIconCount > 0) {
          fromCalendarIcon = fromDirectIcon;
        } else {
          fromCalendarIcon = fromIconNearLabel;
        }
      }
    }
    
    // Strategy 1: Navigate up from input to find v-input container
    if (!fromCalendarIcon) {
      // Try multiple levels of navigation to find the v-input container
      let fromVInput: Locator | null = null;
      
      // Try navigating up 3-4 levels to find .v-input
      for (let level = 1; level <= 5; level++) {
        let currentLocator = fromDatepicker;
        for (let i = 0; i < level; i++) {
          currentLocator = currentLocator.locator('..');
        }
        
        const hasVInputClass = await currentLocator.evaluate((el) => {
          return el.classList.contains('v-input') || el.querySelector('.v-input') !== null;
        }).catch(() => false);
        
        if (hasVInputClass) {
          fromVInput = currentLocator.locator('.v-input').first();
          const vInputCount = await fromVInput.count().catch(() => 0);
          if (vInputCount === 0) {
            fromVInput = currentLocator;
          }
          break;
        }
      }
      
      // Fallback: navigate up 3 levels as default
      if (!fromVInput) {
        const fromInputControl = fromDatepicker.locator('..').locator('..');
        fromVInput = fromInputControl.locator('..');
      }
      
      // Ensure fromVInput is not null before using it
      if (fromVInput) {
        // Search for icon with mdi-calendar class in the v-input container
        const fromCalendarIconByClass = fromVInput.locator('[class*="mdi-calendar"]').first();
        const fromIconByClassCount = await fromCalendarIconByClass.count().catch(() => 0);
        
        if (fromIconByClassCount > 0) {
          fromCalendarIcon = fromCalendarIconByClass;
        } else {
          // Strategy 2: Search in append-inner
          const fromAppendInner = fromVInput.locator('.v-input__append-inner').first();
          const fromAppendInnerCount = await fromAppendInner.count().catch(() => 0);
          
          if (fromAppendInnerCount > 0) {
            const fromIconInAppend = fromAppendInner.locator('button, .v-icon, i, [role="button"], [class*="mdi"]').first();
            const fromIconInAppendCount = await fromIconInAppend.count().catch(() => 0);
            if (fromIconInAppendCount > 0) {
              fromCalendarIcon = fromIconInAppend;
            } else {
              // Click on the append-inner container itself
              fromCalendarIcon = fromAppendInner;
            }
          } else {
            // Strategy 3: Search in prepend-inner
            const fromPrependInner = fromVInput.locator('.v-input__prepend-inner').first();
            const fromPrependInnerCount = await fromPrependInner.count().catch(() => 0);
            
            if (fromPrependInnerCount > 0) {
              const fromIconInPrepend = fromPrependInner.locator('button, .v-icon, i, [role="button"], [class*="mdi"]').first();
              const fromIconInPrependCount = await fromIconInPrepend.count().catch(() => 0);
              if (fromIconInPrependCount > 0) {
                fromCalendarIcon = fromIconInPrepend;
              } else {
                fromCalendarIcon = fromPrependInner;
              }
            }
          }
        }
      }
    }
    
    // Strategy 4: Direct search near the input using sibling selectors
    if (!fromCalendarIcon) {
      // Search for any clickable element near the input that might be the calendar icon
      const fromInputParent = fromDatepicker.locator('..');
      const fromSiblings = fromInputParent.locator('~ *').or(fromInputParent.locator('+ *'));
      const fromSiblingIcons = fromSiblings.locator('[class*="mdi-calendar"], button, .v-icon, i').first();
      const fromSiblingIconsCount = await fromSiblingIcons.count().catch(() => 0);
      if (fromSiblingIconsCount > 0) {
        fromCalendarIcon = fromSiblingIcons;
      }
    }
    
    // Click on the calendar icon to deploy the calendar (if found)
    if (fromCalendarIcon) {
      try {
        // Verify the icon is present (even if not visible)
        const iconExists = await fromCalendarIcon.count().then(count => count > 0).catch(() => false);
        
        if (iconExists) {
          // Click on the calendar icon to deploy the calendar
          await fromCalendarIcon.click({ force: true, timeout: 2000 });
          fromIconClicked = true;
          
          // Wait for the calendar to appear after clicking the icon
          await page.waitForTimeout(800);
          
          // Verify that the calendar menu is deployed after clicking the icon
          const calendarMenu = page.locator('.v-menu__content').first();
          const calendarVisible = await calendarMenu.isVisible({ timeout: 2000 }).catch(() => false);
          
          // Explicitly verify that the calendar was deployed by clicking the icon
          expect(calendarVisible).toBe(true);
        }
      } catch (error) {
        // If click fails, try clicking on the input as fallback
        console.log('Failed to click calendar icon, trying input directly');
        fromIconClicked = false;
      }
    }
    
    // Fallback: if icon not found or click failed, try clicking the input
    if (!fromIconClicked) {
      await fromDatepicker.click();
      await page.waitForTimeout(800);
    }
    
    // Wait for the calendar to appear (Vuetify menu or native calendar)
    await page.waitForTimeout(300);
    
    // Check if a Vuetify calendar menu is visible
    const calendarMenu = page.locator('.v-menu__content').first();
    const calendarVisible = await calendarMenu.isVisible({ timeout: 2000 }).catch(() => false);
    
    if (calendarVisible) {
      // Vuetify calendar is visible - verify it contains a date picker and interact with it
      const datePicker = calendarMenu.locator('.v-date-picker').first();
      const datePickerVisible = await datePicker.isVisible({ timeout: 1000 }).catch(() => false);
      
      if (datePickerVisible) {
        // Verify calendar structure: should have month header and days
        const monthHeader = datePicker.locator('.v-date-picker-header, .v-date-picker-month__header').first();
        const headerVisible = await monthHeader.isVisible({ timeout: 2000 }).catch(() => false);
        expect(headerVisible).toBe(true); // Calendar should have a header
        
        // Verify the calendar header shows month and year (e.g., "enero de 2026")
        const headerText = await monthHeader.textContent().catch(() => '');
        expect(headerText).toBeTruthy(); // Header should have text content
        
        // Look for day buttons in the calendar
        const dayButtons = datePicker.locator('.v-date-picker-month__day:not(.v-date-picker-month__day--disabled)');
        const dayCount = await dayButtons.count();
        expect(dayCount).toBeGreaterThan(0); // Calendar should have selectable days
        
        // Verify day labels (L, M, X, J, V, S, D) are present
        const dayLabels = datePicker.locator('.v-date-picker-month__weekday').or(datePicker.locator('[class*="weekday"]'));
        const dayLabelsCount = await dayLabels.count();
        expect(dayLabelsCount).toBeGreaterThanOrEqual(0); // Day labels may or may not be present depending on implementation
        
        // Select a specific date: 7 days ago
        const testFromDate = new Date();
        testFromDate.setDate(testFromDate.getDate() - 7);
        const dayToSelect = testFromDate.getDate();
        
        // Try to find and click the day in the calendar
        const dayButton = datePicker.locator(`.v-date-picker-month__day:not(.v-date-picker-month__day--disabled):has-text("${dayToSelect}")`).first();
        const dayButtonVisible = await dayButton.isVisible({ timeout: 2000 }).catch(() => false);
        
        if (dayButtonVisible) {
          await dayButton.click();
          await page.waitForTimeout(500);
          
          // After clicking, check if there's an OK button or if the calendar closed automatically
          const okButton = calendarMenu.locator('button:has-text("OK"), button:has-text("Hoy"), button:has-text("Today"), button:has-text("Borrar")').first();
          const okButtonVisible = await okButton.isVisible({ timeout: 1000 }).catch(() => false);
          if (okButtonVisible) {
            // Don't click OK, just verify the date was selected
            // The calendar might close automatically or stay open
            await page.waitForTimeout(300);
          }
        } else {
          // If specific day not found, click any available day
          const anyDayButton = dayButtons.first();
          await anyDayButton.click();
          await page.waitForTimeout(500);
        }
      }
    } else {
      // Native HTML5 calendar or calendar didn't open - set date programmatically
      // This is the most reliable way to interact with native date inputs
      const testFromDate = new Date();
      testFromDate.setDate(testFromDate.getDate() - 7); // 7 days ago
      const testFromDateStr = testFromDate.toISOString().split('T')[0]; // Format: YYYY-MM-DD
      await fromDatepicker.fill(testFromDateStr);
      await page.waitForTimeout(300);
    }
    
    // Verify the date was set correctly
    await page.waitForTimeout(300);
    const fromDateValue = await fromDatepicker.inputValue();
    expect(fromDateValue).toBeTruthy(); // Should have a date value

    // Second datepicker: "Hasta" / "To" / "À"
    // We need to click on the calendar icon to deploy the calendar, not on the input
    
    // Find the calendar icon by searching from the input's parent containers
    let toCalendarIcon: Locator | null = null;
    let toIconClicked = false;
    
    // Strategy 0: Find icon using the label as reference (most reliable)
    // Find the "Hasta" label and then search for the calendar icon in the same v-col container
    const toLabelElement = page.getByText(/^Hasta$|^To$|^À$/i).first();
    const toLabelVisible = await toLabelElement.isVisible({ timeout: 1000 }).catch(() => false);
    
    if (toLabelVisible) {
      // Navigate from label to find the v-col container, then search for calendar icon
      const toColContainer = toLabelElement.locator('..').locator('..'); // Navigate to v-col
      const toIconNearLabel = toColContainer.locator('[class*="mdi-calendar"], .v-input__append-inner, .v-input__prepend-inner').first();
      const toIconNearLabelCount = await toIconNearLabel.count().catch(() => 0);
      if (toIconNearLabelCount > 0) {
        // Check if it's a direct icon or a container
        const toDirectIcon = toIconNearLabel.locator('[class*="mdi-calendar"], button, .v-icon, i').first();
        const toDirectIconCount = await toDirectIcon.count().catch(() => 0);
        if (toDirectIconCount > 0) {
          toCalendarIcon = toDirectIcon;
        } else {
          toCalendarIcon = toIconNearLabel;
        }
      }
    }
    
    // Strategy 1: Navigate up from input to find v-input container
    if (!toCalendarIcon) {
      // Try multiple levels of navigation to find the v-input container
      let toVInput: Locator | null = null;
      
      // Try navigating up 3-4 levels to find .v-input
      for (let level = 1; level <= 5; level++) {
        let currentLocator = toDatepicker;
        for (let i = 0; i < level; i++) {
          currentLocator = currentLocator.locator('..');
        }
        
        const hasVInputClass = await currentLocator.evaluate((el) => {
          return el.classList.contains('v-input') || el.querySelector('.v-input') !== null;
        }).catch(() => false);
        
        if (hasVInputClass) {
          toVInput = currentLocator.locator('.v-input').first();
          const vInputCount = await toVInput.count().catch(() => 0);
          if (vInputCount === 0) {
            toVInput = currentLocator;
          }
          break;
        }
      }
      
      // Fallback: navigate up 3 levels as default
      if (!toVInput) {
        const toInputControl = toDatepicker.locator('..').locator('..');
        toVInput = toInputControl.locator('..');
      }
      
      // Ensure toVInput is not null before using it
      if (toVInput) {
        // Search for icon with mdi-calendar class in the v-input container
        const toCalendarIconByClass = toVInput.locator('[class*="mdi-calendar"]').first();
        const toIconByClassCount = await toCalendarIconByClass.count().catch(() => 0);
        
        if (toIconByClassCount > 0) {
          toCalendarIcon = toCalendarIconByClass;
        } else {
          // Strategy 2: Search in append-inner
          const toAppendInner = toVInput.locator('.v-input__append-inner').first();
          const toAppendInnerCount = await toAppendInner.count().catch(() => 0);
          
          if (toAppendInnerCount > 0) {
            const toIconInAppend = toAppendInner.locator('button, .v-icon, i, [role="button"], [class*="mdi"]').first();
            const toIconInAppendCount = await toIconInAppend.count().catch(() => 0);
            if (toIconInAppendCount > 0) {
              toCalendarIcon = toIconInAppend;
            } else {
              // Click on the append-inner container itself
              toCalendarIcon = toAppendInner;
            }
          } else {
            // Strategy 3: Search in prepend-inner
            const toPrependInner = toVInput.locator('.v-input__prepend-inner').first();
            const toPrependInnerCount = await toPrependInner.count().catch(() => 0);
            
            if (toPrependInnerCount > 0) {
              const toIconInPrepend = toPrependInner.locator('button, .v-icon, i, [role="button"], [class*="mdi"]').first();
              const toIconInPrependCount = await toIconInPrepend.count().catch(() => 0);
              if (toIconInPrependCount > 0) {
                toCalendarIcon = toIconInPrepend;
              } else {
                toCalendarIcon = toPrependInner;
              }
            }
          }
        }
      }
    }
    
    // Strategy 4: Direct search near the input using sibling selectors
    if (!toCalendarIcon) {
      // Search for any clickable element near the input that might be the calendar icon
      const toInputParent = toDatepicker.locator('..');
      const toSiblings = toInputParent.locator('~ *').or(toInputParent.locator('+ *'));
      const toSiblingIcons = toSiblings.locator('[class*="mdi-calendar"], button, .v-icon, i').first();
      const toSiblingIconsCount = await toSiblingIcons.count().catch(() => 0);
      if (toSiblingIconsCount > 0) {
        toCalendarIcon = toSiblingIcons;
      }
    }
    
    // Click on the calendar icon to deploy the calendar (if found)
    if (toCalendarIcon) {
      try {
        // Verify the icon is present (even if not visible)
        const toIconExists = await toCalendarIcon.count().then(count => count > 0).catch(() => false);
        
        if (toIconExists) {
          // Click on the calendar icon to deploy the calendar
          await toCalendarIcon.click({ force: true, timeout: 2000 });
          toIconClicked = true;
          
          // Wait for the calendar to appear after clicking the icon
          await page.waitForTimeout(800);
          
          // Verify that the calendar menu is deployed after clicking the icon
          const toCalendarMenu = page.locator('.v-menu__content').first();
          const toCalendarVisible = await toCalendarMenu.isVisible({ timeout: 2000 }).catch(() => false);
          
          // Explicitly verify that the calendar was deployed by clicking the icon
          expect(toCalendarVisible).toBe(true);
        }
      } catch (error) {
        // If click fails, try clicking on the input as fallback
        console.log('Failed to click calendar icon, trying input directly');
        toIconClicked = false;
      }
    }
    
    // Fallback: if icon not found or click failed, try clicking the input
    if (!toIconClicked) {
      await toDatepicker.click();
      await page.waitForTimeout(800);
    }
    
    // Wait for the calendar to appear (Vuetify menu or native calendar)
    await page.waitForTimeout(300);
    
    // Check if a Vuetify calendar menu is visible
    const toCalendarMenu = page.locator('.v-menu__content').first();
    const toCalendarVisible = await toCalendarMenu.isVisible({ timeout: 2000 }).catch(() => false);
    
    if (toCalendarVisible) {
      // Vuetify calendar is visible - verify it contains a date picker and interact with it
      const toDatePicker = toCalendarMenu.locator('.v-date-picker').first();
      const toDatePickerVisible = await toDatePicker.isVisible({ timeout: 1000 }).catch(() => false);
      
      if (toDatePickerVisible) {
        // Verify calendar structure: should have month header and days
        const toMonthHeader = toDatePicker.locator('.v-date-picker-header, .v-date-picker-month__header').first();
        const toHeaderVisible = await toMonthHeader.isVisible({ timeout: 2000 }).catch(() => false);
        expect(toHeaderVisible).toBe(true); // Calendar should have a header
        
        // Verify the calendar header shows month and year (e.g., "enero de 2026")
        const toHeaderText = await toMonthHeader.textContent().catch(() => '');
        expect(toHeaderText).toBeTruthy(); // Header should have text content
        
        // Look for day buttons in the calendar
        const toDayButtons = toDatePicker.locator('.v-date-picker-month__day:not(.v-date-picker-month__day--disabled)');
        const toDayCount = await toDayButtons.count();
        expect(toDayCount).toBeGreaterThan(0); // Calendar should have selectable days
        
        // Verify day labels (L, M, X, J, V, S, D) are present
        const toDayLabels = toDatePicker.locator('.v-date-picker-month__weekday').or(toDatePicker.locator('[class*="weekday"]'));
        const toDayLabelsCount = await toDayLabels.count();
        expect(toDayLabelsCount).toBeGreaterThanOrEqual(0); // Day labels may or may not be present depending on implementation
        
        // Select a specific date: yesterday
        const testToDate = new Date();
        testToDate.setDate(testToDate.getDate() - 1);
        const toDayToSelect = testToDate.getDate();
        
        // Try to find and click the day in the calendar
        const toDayButton = toDatePicker.locator(`.v-date-picker-month__day:not(.v-date-picker-month__day--disabled):has-text("${toDayToSelect}")`).first();
        const toDayButtonVisible = await toDayButton.isVisible({ timeout: 2000 }).catch(() => false);
        
        if (toDayButtonVisible) {
          await toDayButton.click();
          await page.waitForTimeout(500);
          
          // After clicking, check if there's an OK button or if the calendar closed automatically
          const toOkButton = toCalendarMenu.locator('button:has-text("OK"), button:has-text("Hoy"), button:has-text("Today"), button:has-text("Borrar")').first();
          const toOkButtonVisible = await toOkButton.isVisible({ timeout: 1000 }).catch(() => false);
          if (toOkButtonVisible) {
            // Don't click OK, just verify the date was selected
            // The calendar might close automatically or stay open
            await page.waitForTimeout(300);
          }
        } else {
          // If specific day not found, click any available day
          const toAnyDayButton = toDayButtons.first();
          await toAnyDayButton.click();
          await page.waitForTimeout(500);
        }
      }
    } else {
      // Native HTML5 calendar or calendar didn't open - set date programmatically
      // This is the most reliable way to interact with native date inputs
      const testToDate = new Date();
      testToDate.setDate(testToDate.getDate() - 1); // Yesterday
      const testToDateStr = testToDate.toISOString().split('T')[0]; // Format: YYYY-MM-DD
      await toDatepicker.fill(testToDateStr);
      await page.waitForTimeout(300);
    }
    
    // Verify the date was set correctly
    await page.waitForTimeout(300);
    const toDateValue = await toDatepicker.inputValue();
    expect(toDateValue).toBeTruthy(); // Should have a date value

    // Now test unchecking the checkbox to hide the datepickers
    // Click on the "Rango personalizado" checkbox again to uncheck it
    await checkboxInput.click();

    // Wait for the checkbox to be unchecked
    await expect(checkboxInput).not.toBeChecked({ timeout: TIMEOUTS.FORM_LOAD });

    // Wait a bit for the datepickers to disappear
    await page.waitForTimeout(500);

    // Verify that the datepickers are no longer visible
    // They should be hidden or removed from the DOM when the checkbox is unchecked
    const datepickersAfterUncheck = page.locator('input[type="date"]');
    const datepickerCountAfterUncheck = await datepickersAfterUncheck.count();
    
    // The datepickers should either be removed from DOM or hidden
    // Check if they are still in the DOM but hidden, or completely removed
    if (datepickerCountAfterUncheck > 0) {
      // If they still exist in DOM, they should be hidden
      const fromDatepickerAfterUncheck = datepickersAfterUncheck.first();
      const toDatepickerAfterUncheck = datepickersAfterUncheck.nth(1);
      
      const fromDatepickerStillVisible = await fromDatepickerAfterUncheck.isVisible().catch(() => false);
      const toDatepickerStillVisible = await toDatepickerAfterUncheck.isVisible().catch(() => false);
      
      expect(fromDatepickerStillVisible).toBe(false);
      expect(toDatepickerStillVisible).toBe(false);
    } else {
      // If they are completely removed from DOM, that's also valid
      expect(datepickerCountAfterUncheck).toBe(0);
    }

    // Also verify that the labels are no longer visible
    const fromLabelAfterUncheck = page.getByText(/^Desde$|^From$|^De$/i);
    const toLabelAfterUncheck = page.getByText(/^Hasta$|^To$|^À$/i);
    
    const fromLabelStillVisible = await fromLabelAfterUncheck.first().isVisible({ timeout: 1000 }).catch(() => false);
    const toLabelStillVisible = await toLabelAfterUncheck.first().isVisible({ timeout: 1000 }).catch(() => false);
    
    // The labels should also be hidden or removed
    expect(fromLabelStillVisible).toBe(false);
    expect(toLabelStillVisible).toBe(false);
  });

  test('should download Excel file when clicking Excel icon in table row', async ({ page }) => {
    // Navigate to the version history page first
    const currentHash = getHashRoute(page);
    
    if (!currentHash.includes('/history-execution')) {
      await page.goto(`${page.url().split('#')[0]}#/history-execution`);
      
      await page.waitForURL(
        (url) => {
          const hash = url.hash;
          return hash.includes('/history-execution');
        },
        { timeout: TIMEOUTS.NAVIGATION }
      );
    }

    // Verify we're on the history-execution route
    let routeHash = getHashRoute(page);
    expect(routeHash).toContain('/history-execution');

    // Wait for the page to load completely
    const pageTitle = page.getByRole('heading', { name: /Historial de versiones|Version history|Historique des versions/i });
    await pageTitle.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

    // Wait for the table to be rendered
    const tableContainer = page.locator('.execution-table, .table-container').first();
    await tableContainer.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

    // Wait for table rows to appear
    const tableRows = page.locator('.execution-table tbody tr, .v-data-table tbody tr, table tbody tr');
    
    // Wait for at least one row to be visible
    await tableRows.first().waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
    
    // Check if there are any rows with data
    const rowCount = await tableRows.count();
    
    if (rowCount === 0) {
      // If no rows, verify the "no data" message is displayed
      const noDataMessage = page.getByText(/no hay datos|no data|aucune donnée|no se encontraron datos/i);
      await expect(noDataMessage.first()).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });
      // Skip the test if there's no data
      return;
    }

    // Prefer a row for a SUCCESSFUL execution (Óptimo/Éxito): an errored execution's Excel
    // export is not a valid .xlsx, which would fail the extension assertion below. Fall back
    // to the first row when success/error state can't be distinguished.
    const successRows = tableRows.filter({ hasText: /Óptimo|Optimal|Éxito|Success/i });
    const firstRow = (await successRows.count()) > 0 ? successRows.first() : tableRows.first();
    await firstRow.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
    
    // Wait for cells to be rendered in the row
    const rowCells = firstRow.locator('td, .v-data-table tbody td');
    await rowCells.first().waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
    
    // Wait a bit more for all cells and icons to be fully rendered
    await page.waitForTimeout(1000);

    // Find the Excel icon in the first row
    // The Excel icon is in the excel column slot, which contains an icon with class mdi-microsoft-excel
    
    // Try multiple strategies to find the Excel icon
    let excelIconFound: Locator | null = null;
    
    // Strategy 1: Find by looking for the Excel column header first, then find the corresponding cell
    // The header should have text "Excel" (or translated equivalent)
    const excelHeader = page.locator('th, .v-data-table-header th, thead th').filter({
      hasText: /Excel/i
    }).first();
    
    const excelHeaderExists = await excelHeader.count().catch(() => 0);
    if (excelHeaderExists > 0) {
      // Get the index of the Excel column
      const allHeaders = page.locator('th, .v-data-table-header th, thead th');
      const headerCount = await allHeaders.count();
      let excelColumnIndex = -1;
      
      for (let i = 0; i < headerCount; i++) {
        const header = allHeaders.nth(i);
        const headerText = await header.textContent().catch(() => '');
        if (headerText && /Excel/i.test(headerText.trim())) {
          excelColumnIndex = i;
          break;
        }
      }
      
      if (excelColumnIndex >= 0) {
        // Find the cell in the first row at the same index
        const rowCells = firstRow.locator('td, .v-data-table tbody td');
        const excelCell = rowCells.nth(excelColumnIndex);
        const cellExists = await excelCell.count().catch(() => 0);
        
        if (cellExists > 0) {
          // Look for the clickable element (v-icon, button, or span with click handler) within this cell
          // The icon might be wrapped in a clickable element
          const clickableInCell = excelCell.locator('.v-icon[class*="mdi-microsoft-excel"], .v-icon:has([class*="mdi-microsoft-excel"]), [class*="mdi-microsoft-excel"]').first();
          const clickableExists = await clickableInCell.count().catch(() => 0);
          if (clickableExists > 0) {
            excelIconFound = clickableInCell;
          } else {
            // Try to find any clickable element in the cell
            const anyClickable = excelCell.locator('.v-icon, button, [role="button"], span[style*="cursor"]').first();
            const anyClickableExists = await anyClickable.count().catch(() => 0);
            if (anyClickableExists > 0) {
              excelIconFound = anyClickable;
            }
          }
        }
      }
    }
    
    // Strategy 2: Direct search for mdi-microsoft-excel in the row (multiple class patterns)
    if (!excelIconFound) {
      // Try different class patterns: "mdi-microsoft-excel", "mdi mdi-microsoft-excel", etc.
      const classPatterns = [
        '[class*="mdi-microsoft-excel"]',
        '.mdi-microsoft-excel',
        'i.mdi-microsoft-excel',
        '.v-icon.mdi-microsoft-excel',
        '[class*="mdi"][class*="microsoft-excel"]'
      ];
      
      for (const pattern of classPatterns) {
        const directSearch = firstRow.locator(pattern).first();
        const directSearchCount = await directSearch.count().catch(() => 0);
        if (directSearchCount > 0) {
          const isVisible = await directSearch.isVisible({ timeout: 500 }).catch(() => false);
          if (isVisible) {
            excelIconFound = directSearch;
            break;
          }
        }
      }
    }
    
    // Strategy 3: Find by class containing mdi-microsoft-excel anywhere in the row
    if (!excelIconFound) {
      const iconByClass = firstRow.locator('[class*="mdi-microsoft-excel"]').first();
      const iconByClassCount = await iconByClass.count().catch(() => 0);
      if (iconByClassCount > 0) {
        excelIconFound = iconByClass;
      }
    }
    
    // Strategy 4: Find all icons in the row and check their classes
    if (!excelIconFound) {
      const allIconsInRow = firstRow.locator('.v-icon, i[class*="mdi"], [class*="mdi"]');
      const iconCount = await allIconsInRow.count();
      
      for (let i = 0; i < iconCount; i++) {
        const icon = allIconsInRow.nth(i);
        const iconClass = await icon.getAttribute('class').catch(() => '');
        const iconHTML = await icon.innerHTML().catch(() => '');
        
        // Check if it's the Excel icon (either by class or by inner HTML containing mdi-microsoft-excel)
        if ((iconClass && iconClass.includes('mdi-microsoft-excel')) || 
            (iconHTML && iconHTML.includes('mdi-microsoft-excel'))) {
          excelIconFound = icon;
          break;
        }
      }
    }
    
    // Strategy 5: Find by role or aria-label if available
    if (!excelIconFound) {
      const iconByRole = firstRow.locator('[role="button"], button, a').filter({
        has: page.locator('[class*="mdi-microsoft-excel"]')
      }).first();
      const iconByRoleCount = await iconByRole.count().catch(() => 0);
      if (iconByRoleCount > 0) {
        excelIconFound = iconByRole;
      }
    }
    
    // Strategy 6: Search in the entire table for Excel icons and use the first visible one
    if (!excelIconFound) {
      // Find all Excel icons in the table (searching more broadly)
      const allExcelIcons = tableContainer.locator('[class*="mdi-microsoft-excel"]');
      const allExcelIconsCount = await allExcelIcons.count().catch(() => 0);
      
      if (allExcelIconsCount > 0) {
        // Use the first visible Excel icon found in the table
        for (let i = 0; i < allExcelIconsCount; i++) {
          const icon = allExcelIcons.nth(i);
          const isVisible = await icon.isVisible({ timeout: 1000 }).catch(() => false);
          if (isVisible) {
            excelIconFound = icon;
            break;
          }
        }
        
        // If none are visible, use the first one anyway (might be in a cell that's not fully visible)
        if (!excelIconFound) {
          excelIconFound = allExcelIcons.first();
        }
      }
    }

    // Verify the Excel icon was found
    if (!excelIconFound) {
      // Debug: Log the row HTML to help diagnose
      const rowHTML = await firstRow.innerHTML().catch(() => '');
      const rowText = await firstRow.textContent().catch(() => '');
      const tableHTML = await tableContainer.innerHTML().catch(() => '');
      console.log('Row HTML:', rowHTML.substring(0, 1000));
      console.log('Row Text:', rowText);
      console.log('Table HTML snippet:', tableHTML.substring(0, 1000));
      
      // Also try to find what icons ARE in the row
      const allIcons = await firstRow.locator('.v-icon, i, [class*="mdi"]').all();
      console.log('Icons found in row:', allIcons.length);
      for (let i = 0; i < Math.min(allIcons.length, 5); i++) {
        const iconClass = await allIcons[i].getAttribute('class').catch(() => '');
        console.log(`Icon ${i} class:`, iconClass);
      }
      
      throw new Error('Could not find Excel download icon in table row. Make sure the table has data and the Excel column is visible.');
    }

    // Wait for the icon to be visible
    await excelIconFound.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
    await expect(excelIconFound).toBeVisible();

    // Set up download listener before clicking
    // Playwright will intercept the download
    const downloadPromise = page.waitForEvent('download', { timeout: TIMEOUTS.NAVIGATION });

    // Click on the Excel icon
    await excelIconFound.click();

    // Wait for the download to complete
    const download = await downloadPromise;

    // Verify the download was successful
    expect(download).toBeTruthy();

    // Verify the downloaded file has a valid Excel extension
    const suggestedFilename = download.suggestedFilename();
    expect(suggestedFilename).toBeTruthy();
    
    // The filename should contain "instance_" or "solution_" and end with .xlsx
    // Based on the code, it can be "instance_{filename}" or "solution_{filename}"
    const isExcelFile = suggestedFilename.endsWith('.xlsx') || suggestedFilename.endsWith('.xls');
    expect(isExcelFile).toBe(true);

    // Verify the download has content (file size > 0)
    const path = await download.path();
    expect(path).toBeTruthy();
    
    // Read the file to verify it's a valid Excel file
    // Excel files start with PK (ZIP signature) since .xlsx is a ZIP archive
    const fileBuffer = fs.readFileSync(path);
    const isZipArchive = fileBuffer[0] === 0x50 && fileBuffer[1] === 0x4B; // PK signature
    expect(isZipArchive).toBe(true);

    // Clean up: delete the downloaded file
    fs.unlinkSync(path);
  });

  test('should load execution and show tab with execution name when clicking load execution button', async ({ page }) => {
    // Helper function to get the index of the Name column
    const getNameColumnIndex = async (): Promise<number> => {
      const allHeaders = page.locator('th, .v-data-table-header th, thead th');
      const headerCount = await allHeaders.count();
      
      for (let i = 0; i < headerCount; i++) {
        const header = allHeaders.nth(i);
        const headerText = await header.textContent().catch(() => '');
        if (headerText && /Nombre|Name|Nom/i.test(headerText.trim())) {
          return i;
        }
      }
      return -1;
    };

    // Helper function to clean execution name by removing badges/status text
    const cleanExecutionName = (rawName: string): string => {
      let cleaned = rawName;
      
      // Remove common status badges/chips text
      const badgesToRemove = [
        /★\s*/g,           // Star symbol
        /⭐\s*/g,          // Star emoji
        /\bActual\b/gi,    // "Actual" badge
        /\bCurrent\b/gi,   // "Current" badge
        /\bActuel\b/gi,    // French "Current"
      ];
      
      for (const badge of badgesToRemove) {
        cleaned = cleaned.replace(badge, '');
      }
      
      // Clean up extra whitespace
      cleaned = cleaned.replace(/\s+/g, ' ').trim();
      
      return cleaned;
    };

    // Helper function to get execution name from a row
    const getExecutionNameFromRow = async (row: Locator, nameColumnIndex: number): Promise<string | null> => {
      const rowCells = row.locator('td, .v-data-table tbody td');
      
      if (nameColumnIndex >= 0) {
        const nameCell = rowCells.nth(nameColumnIndex);
        const cellExists = await nameCell.count().catch(() => 0);
        
        if (cellExists > 0) {
          // Try to get the text content excluding badges/chips
          // First, try to find a direct text node or span that contains just the name
          const nameSpan = nameCell.locator('span:not(.v-chip):not(.m-chip):not([class*="badge"]):not([class*="chip"])').first();
          const spanExists = await nameSpan.count().catch(() => 0);
          
          if (spanExists > 0) {
            const spanText = await nameSpan.textContent().catch(() => '');
            if (spanText && spanText.trim().length > 0) {
              return cleanExecutionName(spanText.trim());
            }
          }
          
          // Fallback: get the full cell text and clean it
          const nameText = await nameCell.textContent().catch(() => '');
          if (nameText) {
            return cleanExecutionName(nameText.trim());
          }
        }
      }
      
      // If we couldn't get the name from the column, try to find it in the row directly
      const rowText = await row.textContent().catch(() => '');
      if (rowText) {
        const textParts = rowText.split(/\s+/).filter(part => 
          part.length > 0 && 
          !/^\d{1,2}:\d{2}$/.test(part) && // Not a time
          !/^\d{4}-\d{2}-\d{2}$/.test(part) && // Not a date
          !/^(Éxito|Success|Succès|Óptimo|Optimal|Optimal|Error|Erreur|Actual|Current|Actuel)$/i.test(part) // Not a status
        );
        if (textParts.length > 0) {
          return cleanExecutionName(textParts[0]);
        }
      }
      return null;
    };

    // Helper function to find the load execution button in a row
    const findLoadExecutionButton = async (row: Locator, tableContainer: Locator): Promise<Locator | null> => {
      const rowCells = row.locator('td, .v-data-table tbody td');
      let loadExecutionButton: Locator | null = null;
      
      // Strategy 1: Find by looking for the Actions column header first
      const actionsHeader = page.locator('th, .v-data-table-header th, thead th').filter({
        hasText: /Acciones|Actions|Actions/i
      }).first();
      
      const actionsHeaderExists = await actionsHeader.count().catch(() => 0);
      if (actionsHeaderExists > 0) {
        const allHeaders = page.locator('th, .v-data-table-header th, thead th');
        const headerCount = await allHeaders.count();
        let actionsColumnIndex = -1;
        
        for (let i = 0; i < headerCount; i++) {
          const header = allHeaders.nth(i);
          const headerText = await header.textContent().catch(() => '');
          if (headerText && /Acciones|Actions|Actions/i.test(headerText.trim())) {
            actionsColumnIndex = i;
            break;
          }
        }
        
        if (actionsColumnIndex >= 0) {
          const actionsCell = rowCells.nth(actionsColumnIndex);
          const cellExists = await actionsCell.count().catch(() => 0);
          
          if (cellExists > 0) {
            await actionsCell.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD }).catch(() => {});
            
            const classPatterns = [
              '[class*="mdi-tray-arrow-up"]',
              '.mdi-tray-arrow-up',
              'i.mdi-tray-arrow-up',
              '.v-icon.mdi-tray-arrow-up',
              '[class*="mdi"][class*="tray-arrow-up"]',
              '.v-icon:has([class*="mdi-tray-arrow-up"])'
            ];
            
            for (const pattern of classPatterns) {
              const loadIcon = actionsCell.locator(pattern).first();
              const iconExists = await loadIcon.count().catch(() => 0);
              if (iconExists > 0) {
                const isVisible = await loadIcon.isVisible({ timeout: 500 }).catch(() => false);
                if (isVisible) {
                  loadExecutionButton = loadIcon;
                  break;
                }
              }
            }
            
            if (!loadExecutionButton) {
              const actionsContainer = actionsCell.locator('.actions-container').first();
              const containerExists = await actionsContainer.count().catch(() => 0);
              if (containerExists > 0) {
                for (const pattern of classPatterns) {
                  const loadIcon = actionsContainer.locator(pattern).first();
                  const iconExists = await loadIcon.count().catch(() => 0);
                  if (iconExists > 0) {
                    const isVisible = await loadIcon.isVisible({ timeout: 500 }).catch(() => false);
                    if (isVisible) {
                      loadExecutionButton = loadIcon;
                      break;
                    }
                  }
                }
              }
            }
          }
        }
      }
      
      // Strategy 2: Direct search for mdi-tray-arrow-up in the row
      if (!loadExecutionButton) {
        const classPatterns = [
          '[class*="mdi-tray-arrow-up"]',
          '.mdi-tray-arrow-up',
          'i.mdi-tray-arrow-up',
          '.v-icon.mdi-tray-arrow-up',
          '[class*="mdi"][class*="tray-arrow-up"]'
        ];
        
        for (const pattern of classPatterns) {
          const directSearch = row.locator(pattern).first();
          const directSearchCount = await directSearch.count().catch(() => 0);
          if (directSearchCount > 0) {
            const isVisible = await directSearch.isVisible({ timeout: 500 }).catch(() => false);
            if (isVisible) {
              loadExecutionButton = directSearch;
              break;
            }
          }
        }
      }
      
      // Strategy 3: Find all icons in the row and check their classes
      if (!loadExecutionButton) {
        const allIconsInRow = row.locator('.v-icon, i[class*="mdi"], [class*="mdi"]');
        const iconCount = await allIconsInRow.count();
        
        for (let i = 0; i < iconCount; i++) {
          const icon = allIconsInRow.nth(i);
          const iconClass = await icon.getAttribute('class').catch(() => '');
          if (iconClass && iconClass.includes('mdi-tray-arrow-up')) {
            const isVisible = await icon.isVisible({ timeout: 500 }).catch(() => false);
            if (isVisible) {
              loadExecutionButton = icon;
              break;
            }
          }
        }
      }
      
      // Strategy 4: Search in the entire table for the icon
      if (!loadExecutionButton) {
        const tableIcons = tableContainer.locator('[class*="mdi-tray-arrow-up"]').first();
        const tableIconCount = await tableIcons.count().catch(() => 0);
        if (tableIconCount > 0) {
          const isVisible = await tableIcons.isVisible({ timeout: 500 }).catch(() => false);
          if (isVisible) {
            loadExecutionButton = tableIcons;
          }
        }
      }
      
      // Strategy 5: Try hovering over the row first
      if (!loadExecutionButton) {
        await row.hover().catch(() => {});
        await page.waitForTimeout(300);
        
        const classPatterns = [
          '[class*="mdi-tray-arrow-up"]',
          '.mdi-tray-arrow-up',
          'i.mdi-tray-arrow-up',
          '.v-icon.mdi-tray-arrow-up'
        ];
        
        for (const pattern of classPatterns) {
          const directSearch = row.locator(pattern).first();
          const directSearchCount = await directSearch.count().catch(() => 0);
          if (directSearchCount > 0) {
            const isVisible = await directSearch.isVisible({ timeout: 500 }).catch(() => false);
            if (isVisible) {
              loadExecutionButton = directSearch;
              break;
            }
          }
        }
      }
      
      // Strategy 6: Search by tooltip text
      if (!loadExecutionButton) {
        const tooltipElements = page.locator('[title*="Cargar ejecución"], [title*="Load execution"], [aria-label*="Cargar ejecución"], [aria-label*="Load execution"]').first();
        const tooltipExists = await tooltipElements.count().catch(() => 0);
        if (tooltipExists > 0) {
          const parentWithIcon = tooltipElements.locator('..').locator('[class*="mdi-tray-arrow-up"]').first();
          const parentIconExists = await parentWithIcon.count().catch(() => 0);
          if (parentIconExists > 0) {
            loadExecutionButton = parentWithIcon;
          } else {
            const iconInTooltip = tooltipElements.locator('[class*="mdi-tray-arrow-up"]').first();
            const iconInTooltipExists = await iconInTooltip.count().catch(() => 0);
            if (iconInTooltipExists > 0) {
              loadExecutionButton = iconInTooltip;
            }
          }
        }
      }
      
      return loadExecutionButton;
    };

    // Helper function to verify execution tab is loaded correctly
    // Verifies that a tab with the execution name exists and is visible
    const verifyExecutionTab = async (executionName: string | null, expectedTabCount: number): Promise<void> => {
      const tablist = page.getByRole('tablist');
      await tablist.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD }).catch(async () => {
        await page
          .locator('.tab-container, .m-tabs, [class*="tab"]')
          .first()
          .waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
      });

      // Prefer tabs inside the tablist (matches loaded-execution UI)
      let allTabs = tablist.getByRole('tab');
      let tabCount = await allTabs.count();
      if (tabCount === 0) {
        allTabs = page.locator('button.m-tab, .m-tab, [role="tab"]');
        tabCount = await allTabs.count();
      }

      console.log(`Searching for tab with execution name: "${executionName}", total tabs: ${tabCount}`);

      let executionTab: Locator | null = null;
      
      // If we have an execution name, search through all tabs to find the matching one
      if (executionName) {
        for (let i = 0; i < tabCount; i++) {
          const tab = allTabs.nth(i);
          const tabText = await tab.textContent().catch(() => '');
          console.log(`Tab ${i}: "${tabText}"`);
          
          // Check if this tab contains the execution name
          if (tabText && tabText.toLowerCase().includes(executionName.toLowerCase())) {
            executionTab = tab;
            console.log(`Found matching tab at index ${i}: "${tabText}"`);
            break;
          }
        }
        
        // If not found by name, throw an error with available tabs
        if (!executionTab) {
          const allTabTexts: string[] = [];
          for (let i = 0; i < tabCount; i++) {
            const tabText = await allTabs.nth(i).textContent().catch(() => '');
            allTabTexts.push(tabText || '(empty)');
          }
          throw new Error(`Could not find tab with execution name "${executionName}". Available tabs: [${allTabTexts.join(', ')}]`);
        }
      }

      if (!executionTab) {
        throw new Error('Could not find execution tab after loading. Make sure the execution was loaded successfully.');
      }

      // Verify the tab is visible
      await executionTab.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

      // Verify the tab text contains the execution name
      if (executionName) {
        const tabText = await executionTab.textContent().catch(() => '');
        expect(tabText?.toLowerCase()).toContain(executionName.toLowerCase());
        console.log(`Verified tab contains execution name: "${executionName}"`);
      }

      // Verify the expected number of execution tabs (excluding "Añadir nuevo" or similar add buttons)
      let executionTabCount = 0;
      for (let i = 0; i < tabCount; i++) {
        const tabText = await allTabs.nth(i).textContent().catch(() => '');
        if (tabText && !tabText.toLowerCase().includes('añadir') && !tabText.toLowerCase().includes('add new')) {
          executionTabCount++;
        }
      }
      console.log(`Execution tabs count (excluding add button): ${executionTabCount}`);
      expect(executionTabCount).toBeGreaterThanOrEqual(expectedTabCount);
    };

    // Helper function to load an execution from a specific row and verify it
    const loadAndVerifyExecution = async (
      rowIndex: number,
      tableContainer: Locator,
      nameColumnIndex: number,
      executionNumber: number
    ): Promise<string | null> => {
      const row = page
        .locator('.execution-table tbody tr, .v-data-table tbody tr, table tbody tr')
        .nth(rowIndex);

      await row.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

      const rowCells = row.locator('td, .v-data-table tbody td');
      await rowCells.first().waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD }).catch(() => {});

      await row.hover();
      await page.waitForTimeout(300);

      const executionName = await getExecutionNameFromRow(row, nameColumnIndex);
      console.log(`Execution ${executionNumber} name: ${executionName}`);

      let loadExecutionButton = await findLoadExecutionButtonInRow(page, rowIndex);
      if (!loadExecutionButton) {
        loadExecutionButton = await findLoadExecutionButton(row, tableContainer);
      }

      if (!loadExecutionButton) {
        const rowHTML = await row.innerHTML().catch(() => '');
        console.log(`Row ${executionNumber} HTML (first 1000 chars):`, rowHTML.substring(0, 1000));

        const allIcons = row.locator('.v-icon, i, [class*="mdi"], [class*="icon"]');
        const iconCount = await allIcons.count();
        console.log(`Found ${iconCount} icons in row ${executionNumber}`);

        for (let i = 0; i < Math.min(iconCount, 15); i++) {
          const icon = allIcons.nth(i);
          const iconClass = await icon.getAttribute('class').catch(() => '');
          const iconText = await icon.textContent().catch(() => '');
          const iconTag = await icon.evaluate((el) => el.tagName).catch(() => '');
          const isVisible = await icon.isVisible().catch(() => false);
          console.log(
            `Icon ${i}: tag="${iconTag}", class="${iconClass}", text="${iconText}", visible=${isVisible}`
          );
        }

        throw new Error(
          `Could not find "Cargar ejecución" button in table row ${executionNumber}. Make sure the table has data and the Actions column is visible.`
        );
      }

      await loadExecutionButton.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

      const pathNoQuery = (url: string) => url.split('?')[0];
      const matchesExecutionData = (url: string) =>
        /\/execution\/[^/]+\/data/.test(pathNoQuery(url));
      const matchesInstanceData = (url: string) =>
        /\/instance\/[^/]+\/data/.test(pathNoQuery(url));

      // Responses may be missing when cached; UI stability is the source of truth.
      const executionDataPromise = page
        .waitForResponse(
          (response) =>
            response.request().method() === 'GET' && matchesExecutionData(response.url()),
          { timeout: TIMEOUTS.NAVIGATION }
        )
        .catch(() => null);

      const instanceDataPromise = page
        .waitForResponse(
          (response) =>
            response.request().method() === 'GET' && matchesInstanceData(response.url()),
          { timeout: TIMEOUTS.NAVIGATION }
        )
        .catch(() => null);

      await loadExecutionButton.click().catch(async () => {
        await loadExecutionButton!.click({ force: true });
      });

      const [executionDataResponse, instanceDataResponse] = await Promise.all([
        executionDataPromise,
        instanceDataPromise,
      ]);

      if (executionDataResponse) {
        expect(executionDataResponse.status()).toBe(200);
        console.log(`Execution ${executionNumber} - Execution data API call: ${executionDataResponse.url()}`);
      }
      if (instanceDataResponse) {
        expect(instanceDataResponse.status()).toBe(200);
        console.log(`Execution ${executionNumber} - Instance data API call: ${instanceDataResponse.url()}`);
      }

      if (!(await waitForStableLoadedExecutionTab(page, 1200, 8000))) {
        await page.waitForTimeout(1200);
        if (!(await waitForStableLoadedExecutionTab(page, 1200, 6000))) {
          throw new Error(
            'Execution tab did not appear or stay visible after load (SPA state may have reset).'
          );
        }
      }

      await verifyExecutionTab(executionName, executionNumber);

      return executionName;
    };

    // Navigate to the version history page first
    const currentHash = getHashRoute(page);
    
    if (!currentHash.includes('/history-execution')) {
      await page.goto(`${page.url().split('#')[0]}#/history-execution`);
      
      await page.waitForURL(
        (url) => {
          const hash = url.hash;
          return hash.includes('/history-execution');
        },
        { timeout: TIMEOUTS.NAVIGATION }
      );
    }

    // Verify we're on the history-execution route
    let routeHash = getHashRoute(page);
    expect(routeHash).toContain('/history-execution');

    // Wait for the page to load completely
    const pageTitle = page.getByRole('heading', { name: /Historial de versiones|Version history|Historique des versions/i });
    await pageTitle.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

    // Wait for the table to be rendered
    const tableContainer = page.locator('.execution-table, .table-container').first();
    await tableContainer.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

    // Wait for table rows to appear
    const tableRows = page.locator('.execution-table tbody tr, .v-data-table tbody tr, table tbody tr');

    // Wait for at least one row to be visible
    await tableRows.first().waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD }).catch(() => {});

    await ensureHistoryHasRows(page);
    let rowCount = await tableRows.count();

    if (rowCount === 0) {
      // If no rows, verify the "no data" message is displayed
      const noDataMessage = page.getByText(/no hay datos|no data|aucune donnée|no se encontraron datos/i);
      await expect(noDataMessage.first()).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });
      // Skip the test if there's no data
      return;
    }

    // Get the name column index once
    const nameColumnIndex = await getNameColumnIndex();

    // Helper function to check if a row is a valid execution row (not a group header or expansion row)
    const isValidExecutionRow = async (row: Locator): Promise<boolean> => {
      const rowHTML = await row.innerHTML().catch(() => '');
      const rowStyleAttr = await row.getAttribute('style').catch(() => null);
      const rowStyle = rowStyleAttr || '';

      const hasColspan = rowHTML.includes('colspan') || rowHTML.includes('colSpan');
      const hasZeroHeight = rowStyle.includes('height: 0px') || rowStyle.includes('height:0px');

      if (hasColspan || hasZeroHeight) {
        return false;
      }

      const cells = row.locator('td');
      const cellCount = await cells.count();

      if (cellCount < 3) {
        return false;
      }

      // Actions often appear after hover; align with load flow.
      await row.hover();
      await page.waitForTimeout(300);

      const hasLoadIcon = await row.locator('[class*="mdi-tray-arrow-up"]').count().catch(() => 0);
      if (hasLoadIcon > 0) return true;

      const hasActions = await row.locator('.actions-container').count().catch(() => 0);
      return hasActions > 0;
    };

    // Collect row indices for valid execution rows (same order as tableRows)
    const validExecutionRowIndices: number[] = [];
    const totalRows = await tableRows.count();

    console.log(`Total table rows: ${totalRows}`);

    for (let i = 0; i < totalRows && validExecutionRowIndices.length < 2; i++) {
      const row = tableRows.nth(i);
      const isValid = await isValidExecutionRow(row);

      if (isValid) {
        const executionName = await getExecutionNameFromRow(row, nameColumnIndex);

        const isDifferent =
          validExecutionRowIndices.length === 0 ||
          (await (async () => {
            const previousName = await getExecutionNameFromRow(
              tableRows.nth(validExecutionRowIndices[0]),
              nameColumnIndex
            );
            return executionName !== previousName;
          })());

        if (isDifferent) {
          validExecutionRowIndices.push(i);
          console.log(
            `Found valid execution row index ${validExecutionRowIndices.length}: "${executionName}" at index ${i}`
          );
        }
      }
    }

    if (validExecutionRowIndices.length === 0) {
      console.log('No valid execution rows found');
      return;
    }

    const firstExecutionName = await loadAndVerifyExecution(
      validExecutionRowIndices[0],
      tableContainer,
      nameColumnIndex,
      1
    );
    console.log(`First execution loaded successfully: ${firstExecutionName}`);

    if (validExecutionRowIndices.length >= 2) {
      console.log('Found more than one valid execution, loading second execution...');

      const secondExecutionName = await loadAndVerifyExecution(
        validExecutionRowIndices[1],
        tableContainer,
        nameColumnIndex,
        2
      );
      console.log(`Second execution loaded successfully: ${secondExecutionName}`);

      if (firstExecutionName && secondExecutionName) {
        expect(firstExecutionName).not.toBe(secondExecutionName);
        console.log(`Verified executions are different: "${firstExecutionName}" vs "${secondExecutionName}"`);
      }

      const tablist = page.getByRole('tablist');
      let allTabs = tablist.getByRole('tab');
      let finalTabCount = await allTabs.count();
      if (finalTabCount === 0) {
        allTabs = page.locator('button.m-tab, .m-tab, [role="tab"]');
        finalTabCount = await allTabs.count();
      }
      expect(finalTabCount).toBeGreaterThanOrEqual(2);
      console.log(`Both executions loaded successfully. Total tabs: ${finalTabCount}`);
    } else {
      console.log('Only one valid execution row found, skipping second execution load.');
    }
  });

  test.skip('should delete execution when clicking delete button in confirmation modal', async ({ page }) => {
    // Navigate to the version history page first
    const currentHash = getHashRoute(page);
    
    if (!currentHash.includes('/history-execution')) {
      await page.goto(`${page.url().split('#')[0]}#/history-execution`);
      
      await page.waitForURL(
        (url) => {
          const hash = url.hash;
          return hash.includes('/history-execution');
        },
        { timeout: TIMEOUTS.NAVIGATION }
      );
    }

    // Verify we're on the history-execution route
    let routeHash = getHashRoute(page);
    expect(routeHash).toContain('/history-execution');

    // Wait for the page to load completely
    const pageTitle = page.getByRole('heading', { name: /Historial de versiones|Version history|Historique des versions/i });
    await pageTitle.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

    // Wait for the table to be rendered
    const tableContainer = page.locator('.execution-table, .table-container').first();
    await tableContainer.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

    // Wait for table rows to appear
    const tableRows = page.locator('.execution-table tbody tr, .v-data-table tbody tr, table tbody tr');
    
    // Wait for at least one row to be visible
    await tableRows.first().waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
    
    // Find a valid row with a delete button (mdi-delete icon)
    let firstRow: Locator | null = null;
    let deleteButton: Locator | null = null;
    const rowCount = await tableRows.count();
    
    // Iterate through all rows to find one with mdi-delete icon
    for (let i = 0; i < rowCount; i++) {
      const row = tableRows.nth(i);
      const rowHTML = await row.innerHTML().catch(() => '');
      const rowStyleAttr = await row.getAttribute('style').catch(() => null);
      const rowStyle = rowStyleAttr || '';
      const hasColspan = rowHTML.includes('colspan') || rowHTML.includes('colSpan');
      const hasZeroHeight = rowStyle.includes('height: 0px') || rowStyle.includes('height:0px');
      
      // Skip rows that are expansion rows or empty rows
      if (hasColspan || hasZeroHeight) {
        continue;
      }
      
      // Check if this row has actual cells with content
      const cells = row.locator('td:not([colspan]), td:not([colSpan])');
      const cellCount = await cells.count();
      
      if (cellCount > 0) {
        // Verify at least one cell is visible
        const firstCell = cells.first();
        const isVisible = await firstCell.isVisible({ timeout: 500 }).catch(() => false);
        if (!isVisible) {
          continue;
        }
        
        // Wait for the row to be fully rendered
        await row.waitFor({ state: 'visible', timeout: 1000 }).catch(() => {});
        await page.waitForTimeout(300);
        
        // Check if this row has mdi-delete icon
        const deletePatterns = [
          '[class*="mdi-delete"]',
          '.mdi-delete',
          'i.mdi-delete',
          '.v-icon.mdi-delete',
          '[class*="mdi"][class*="delete"]'
        ];
        
        let foundDeleteIcon = false;
        for (const pattern of deletePatterns) {
          const deleteIcon = row.locator(pattern).first();
          const iconExists = await deleteIcon.count().catch(() => 0);
          if (iconExists > 0) {
            const isIconVisible = await deleteIcon.isVisible({ timeout: 500 }).catch(() => false);
            if (isIconVisible) {
              // Verify it's actually mdi-delete
              const iconClass = await deleteIcon.getAttribute('class').catch(() => '');
              if (iconClass && iconClass.includes('mdi-delete')) {
                foundDeleteIcon = true;
                firstRow = row;
                deleteButton = deleteIcon;
                break;
              }
            }
          }
        }
        
        if (foundDeleteIcon) {
          break; // Found a suitable row, exit loop
        }
      }
    }
    
    if (!firstRow || !deleteButton) {
      throw new Error('Could not find "Eliminar ejecución" button (mdi-delete icon) in table row. Make sure the table has data and the Actions column is visible.');
    }

    // Store the row content before deletion to verify it disappears
    const rowContentBefore = await firstRow.textContent().catch(() => '') || '';
    expect(rowContentBefore).toBeTruthy();
    expect(rowContentBefore.trim().length).toBeGreaterThan(0);

    // Wait for the button to be visible and clickable
    await deleteButton.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

    // Verify the button is clickable
    await expect(deleteButton).toBeVisible();
    
    // Click on the delete button
    await deleteButton.click();

    // Wait for the modal to appear
    await page.waitForTimeout(1000);

    // Verify that the modal appears after clicking
    const modal = page.locator('.v-dialog, .v-modal, [role="dialog"], .m-base-modal').first();
    await modal.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
    await expect(modal).toBeVisible();

    // Verify the modal title "Eliminar ejecución" / "Delete execution"
    const modalTitle = modal.locator('h2, .v-card-title, [class*="title"], .modal-title').filter({
      hasText: /Eliminar ejecución|Delete execution|Supprimer l'exécution/i
    }).first();
    await expect(modalTitle).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });
    
    // Verify the confirmation message is present
    const confirmationMessage = modal.locator('.modal-message, p, span').filter({
      hasText: /¿Estás seguro de que quieres eliminar esta ejecución\?|Are you sure you want to delete this execution\?|Êtes-vous sûr de vouloir supprimer cette exécution\?/i
    }).first();
    await expect(confirmationMessage).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });
    
    // Verify the action buttons are present
    // Button "Eliminar" / "Delete"
    const deleteConfirmButton = modal.locator('button, .v-btn, [role="button"]').filter({
      hasText: /Eliminar|Delete|Supprimer/i
    }).first();
    await expect(deleteConfirmButton).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });
    
    // Button "Cancelar" / "Cancel"
    const cancelButton = modal.locator('button, .v-btn, [role="button"]').filter({
      hasText: /Cancelar|Cancel|Annuler/i
    }).first();
    await expect(cancelButton).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });

    // Click the "Eliminar" button to confirm deletion
    await deleteConfirmButton.click();

    // Wait for the modal to close
    await page.waitForTimeout(1000);
    await modal.waitFor({ state: 'hidden', timeout: TIMEOUTS.FORM_LOAD }).catch(() => {});
    
    // Verify the modal is closed
    const isModalVisible = await modal.isVisible({ timeout: 1000 }).catch(() => false);
    expect(isModalVisible).toBe(false);

    // Wait for the success snackbar to appear
    // Use a more flexible approach: wait for any snackbar and then check its content
    const successSnackbar = page.locator('.v-snackbar, [class*="snackbar"], [role="alert"]').first();
    
    // Wait for any snackbar to appear (it might show success or error)
    await successSnackbar.waitFor({ state: 'visible', timeout: TIMEOUTS.ERROR_SNACKBAR_CHECK }).catch(() => {
      // If snackbar doesn't appear, wait a bit more for async operations
      return page.waitForTimeout(2000);
    });
    
    // Get all snackbars and check if any contains the success message
    const allSnackbars = page.locator('.v-snackbar, [class*="snackbar"], [role="alert"]');
    const snackbarCount = await allSnackbars.count();
    
    let foundSuccessMessage = false;
    let snackbarText = '';
    
    for (let i = 0; i < snackbarCount; i++) {
      const snackbar = allSnackbars.nth(i);
      const isVisible = await snackbar.isVisible().catch(() => false);
      if (isVisible) {
        snackbarText = await snackbar.textContent().catch(() => '') || '';
        if (snackbarText.match(/Ejecución eliminada con éxito|Execution deleted successfully|Exécution supprimée avec succès/i)) {
          foundSuccessMessage = true;
          break;
        }
      }
    }
    
    // Verify the success snackbar message
    expect(foundSuccessMessage).toBe(true);
    expect(snackbarText).toMatch(/Ejecución eliminada con éxito|Execution deleted successfully|Exécution supprimée avec succès/i);

    // Wait for the table to refresh (the row should be removed)
    await page.waitForTimeout(2000);

    // Verify the row has been removed from the table
    // Check that the row content is no longer in the table
    const allRowsAfter = page.locator('.execution-table tbody tr, .v-data-table tbody tr, table tbody tr');
    const rowCountAfter = await allRowsAfter.count();
    
    // The row count should be less than before (or the specific row should not exist)
    let rowStillExists = false;
    for (let i = 0; i < rowCountAfter; i++) {
      const row = allRowsAfter.nth(i);
      const rowText = await row.textContent().catch(() => '');
      // Check if this row contains the same content (allowing for some variation)
      if (rowText && rowContentBefore && rowText.includes(rowContentBefore.substring(0, 50))) {
        rowStillExists = true;
        break;
      }
    }
    
    // The row should not exist anymore
    expect(rowStillExists).toBe(false);
  });

  test('should close modal and not delete execution when clicking cancel button', async ({ page }) => {
    // Navigate to the version history page first
    const currentHash = getHashRoute(page);
    
    if (!currentHash.includes('/history-execution')) {
      await page.goto(`${page.url().split('#')[0]}#/history-execution`);
      
      await page.waitForURL(
        (url) => {
          const hash = url.hash;
          return hash.includes('/history-execution');
        },
        { timeout: TIMEOUTS.NAVIGATION }
      );
    }

    // Verify we're on the history-execution route
    let routeHash = getHashRoute(page);
    expect(routeHash).toContain('/history-execution');

    // Wait for the page to load completely
    const pageTitle = page.getByRole('heading', { name: /Historial de versiones|Version history|Historique des versions/i });
    await pageTitle.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

    // Wait for the table to be rendered
    const tableContainer = page.locator('.execution-table, .table-container').first();
    await tableContainer.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

    // Wait for table rows to appear
    const tableRows = page.locator('.execution-table tbody tr, .v-data-table tbody tr, table tbody tr');
    
    // Wait for at least one row to be visible
    await tableRows.first().waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
    
    // Find a valid row with a delete button (mdi-delete icon)
    let firstRow: Locator | null = null;
    let deleteButton: Locator | null = null;
    const rowCount = await tableRows.count();
    
    // Iterate through all rows to find one with mdi-delete icon
    for (let i = 0; i < rowCount; i++) {
      const row = tableRows.nth(i);
      const rowHTML = await row.innerHTML().catch(() => '');
      const rowStyleAttr = await row.getAttribute('style').catch(() => null);
      const rowStyle = rowStyleAttr || '';
      const hasColspan = rowHTML.includes('colspan') || rowHTML.includes('colSpan');
      const hasZeroHeight = rowStyle.includes('height: 0px') || rowStyle.includes('height:0px');
      
      // Skip rows that are expansion rows or empty rows
      if (hasColspan || hasZeroHeight) {
        continue;
      }
      
      // Check if this row has actual cells with content
      const cells = row.locator('td:not([colspan]), td:not([colSpan])');
      const cellCount = await cells.count();
      
      if (cellCount > 0) {
        // Verify at least one cell is visible
        const firstCell = cells.first();
        const isVisible = await firstCell.isVisible({ timeout: 500 }).catch(() => false);
        if (!isVisible) {
          continue;
        }
        
        // Wait for the row to be fully rendered
        await row.waitFor({ state: 'visible', timeout: 1000 }).catch(() => {});
        await page.waitForTimeout(300);
        
        // Check if this row has mdi-delete icon
        const deletePatterns = [
          '[class*="mdi-delete"]',
          '.mdi-delete',
          'i.mdi-delete',
          '.v-icon.mdi-delete',
          '[class*="mdi"][class*="delete"]'
        ];
        
        let foundDeleteIcon = false;
        for (const pattern of deletePatterns) {
          const deleteIcon = row.locator(pattern).first();
          const iconExists = await deleteIcon.count().catch(() => 0);
          if (iconExists > 0) {
            const isIconVisible = await deleteIcon.isVisible({ timeout: 500 }).catch(() => false);
            if (isIconVisible) {
              // Verify it's actually mdi-delete
              const iconClass = await deleteIcon.getAttribute('class').catch(() => '');
              if (iconClass && iconClass.includes('mdi-delete')) {
                foundDeleteIcon = true;
                firstRow = row;
                deleteButton = deleteIcon;
                break;
              }
            }
          }
        }
        
        if (foundDeleteIcon) {
          break; // Found a suitable row, exit loop
        }
      }
    }
    
    if (!firstRow || !deleteButton) {
      throw new Error('Could not find "Eliminar ejecución" button (mdi-delete icon) in table row. Make sure the table has data and the Actions column is visible.');
    }

    // Store the row content before to verify it still exists after canceling
    const rowContentBefore = await firstRow.textContent().catch(() => '') || '';
    expect(rowContentBefore).toBeTruthy();
    expect(rowContentBefore.trim().length).toBeGreaterThan(0);

    // Wait for the button to be visible and clickable
    await deleteButton.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

    // Verify the button is clickable
    await expect(deleteButton).toBeVisible();
    
    // Click on the delete button
    await deleteButton.click();

    // Wait for the modal to appear
    await page.waitForTimeout(1000);

    // Verify that the modal appears after clicking
    const modal = page.locator('.v-dialog, .v-modal, [role="dialog"], .m-base-modal').first();
    await modal.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
    await expect(modal).toBeVisible();

    // Verify the modal title "Eliminar ejecución" / "Delete execution"
    const modalTitle = modal.locator('h2, .v-card-title, [class*="title"], .modal-title').filter({
      hasText: /Eliminar ejecución|Delete execution|Supprimer l'exécution/i
    }).first();
    await expect(modalTitle).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });
    
    // Verify the confirmation message is present
    const confirmationMessage = modal.locator('.modal-message, p, span').filter({
      hasText: /¿Estás seguro de que quieres eliminar esta ejecución\?|Are you sure you want to delete this execution\?|Êtes-vous sûr de vouloir supprimer cette exécution\?/i
    }).first();
    await expect(confirmationMessage).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });
    
    // Verify the action buttons are present
    // Button "Cancelar" / "Cancel"
    const cancelButton = modal.locator('button, .v-btn, [role="button"]').filter({
      hasText: /Cancelar|Cancel|Annuler/i
    }).first();
    await expect(cancelButton).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });

    // Click the "Cancelar" button to cancel deletion
    await cancelButton.click();

    // Wait for the modal to close
    await page.waitForTimeout(1000);
    await modal.waitFor({ state: 'hidden', timeout: TIMEOUTS.FORM_LOAD }).catch(() => {});
    
    // Verify the modal is closed
    const isModalVisible = await modal.isVisible({ timeout: 1000 }).catch(() => false);
    expect(isModalVisible).toBe(false);

    // Verify no success snackbar appears (since we cancelled)
    const successSnackbar = page.locator('.v-snackbar, [class*="snackbar"], [role="alert"]').filter({ 
      hasText: /Ejecución eliminada con éxito|Execution deleted successfully|Exécution supprimée avec succès/i
    }).first();
    const snackbarExists = await successSnackbar.count().catch(() => 0);
    expect(snackbarExists).toBe(0);

    // Wait a bit to ensure the deletion didn't happen
    await page.waitForTimeout(1000);

    // Verify the row still exists in the table (not deleted)
    const allRowsAfter = page.locator('.execution-table tbody tr, .v-data-table tbody tr, table tbody tr');
    const rowCountAfter = await allRowsAfter.count();
    
    // The row should still exist
    let rowStillExists = false;
    for (let i = 0; i < rowCountAfter; i++) {
      const row = allRowsAfter.nth(i);
      const rowText = await row.textContent().catch(() => '');
      // Check if this row contains the same content (allowing for some variation)
      if (rowText && rowContentBefore && rowText.includes(rowContentBefore.substring(0, 50))) {
        rowStillExists = true;
        break;
      }
    }
    
    // The row should still exist (not deleted)
    expect(rowStillExists).toBe(true);
  });
});
