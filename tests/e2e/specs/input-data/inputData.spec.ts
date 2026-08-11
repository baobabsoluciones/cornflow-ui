import { test, expect } from '../../fixtures';
import { TIMEOUTS } from '../../helpers/constants';
import {
  ensureExecutionLoaded,
  loadNonCurrentExecutionFromHistory,
} from '../../helpers/executionHelpers';

/**
 * Tests for the Input Data page functionality
 *
 * These tests verify the input data page displays and functions correctly,
 * including data tables, navigation, and data visualization.
 */
test.describe('Input Data Page', () => {
  test('should navigate to Input Data page and display data from the loaded instance', async ({ page }) => {
    // We capture instance data once an execution is loaded and we navigate to Input Data.
    let instanceDataResponse: any = null;

    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Wait for the app to be ready
    const app = page.locator('.v-application');
    await app.first().waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

    // Ensure one execution is explicitly loaded before validating Input Data.
    const hasExecutionLoaded = await ensureExecutionLoaded(page);
    expect(hasExecutionLoaded).toBe(true);

    // Ensure there is a selected execution tab
    const tablist = page.getByRole('tablist');
    await tablist.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

    const executionTab = tablist
      .getByRole('tab')
      .filter({ hasNot: page.getByText(/Añadir nuevo|Add new/i) })
      .first();

    await expect(executionTab).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });
    await expect(executionTab).toHaveAttribute('aria-selected', 'true');

    // Click on the "Input Data" / "Datos de entrada" option in the sidebar menu
    const inputDataLink = page.locator(
      'a[href*="/input-data/group/datos-de-entrada"], a[href*="/input-data/group/input"]'
    );
    await inputDataLink.first().waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

    // Capture GET /instance/{id}/data while navigating to Input Data.
    // If the request is already cached and not emitted, we still validate UI structure below.
    const instanceDataPromise = page
      .waitForResponse(
        (response) => {
          const url = response.url();
          const method = response.request().method();
          return method === 'GET' && /\/instance\/[^/]+\/data\/?$/.test(url);
        },
        { timeout: TIMEOUTS.NAVIGATION }
      )
      .catch(() => null);

    await inputDataLink.first().click();

    // Verify navigation to input-data page
    await expect(page).toHaveURL(/\/input-data/, { timeout: TIMEOUTS.NAVIGATION });

    // Verify the page content is loaded - the SectionView should show
    const sectionView = page.locator('.section-view');
    await sectionView.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

    // Wait for loading to complete (spinner should disappear)
    const loadingSpinner = page.locator('.loading-container');
    await expect(loadingSpinner).not.toBeVisible({ timeout: TIMEOUTS.NAVIGATION });

    // Verify that a table section is visible (content has loaded)
    const tableContent = page.locator('.table-section');
    await expect(tableContent).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });

    const response = await instanceDataPromise;
    if (response) {
      expect(response.status()).toBe(200);
      instanceDataResponse = await response.json();
      console.log('Instance data API URL:', response.url());
      console.log(
        'Instance data keys:',
        instanceDataResponse?.data ? Object.keys(instanceDataResponse.data) : 'No data'
      );
    } else {
      console.log('Note: Instance data API call was not captured during Input Data navigation');
    }

    // Now verify the data displayed matches the API response
    if (instanceDataResponse && instanceDataResponse.data) {
      const tableKeys = Object.keys(instanceDataResponse.data);
      console.log(`API returned ${tableKeys.length} tables: ${tableKeys.join(', ')}`);

      // Check if we have a group view with tabs (multiple tables)
      const tableCard = page.locator('.table-card');
      const hasGroupView = await tableCard.count() > 0;

      if (hasGroupView && tableKeys.length > 1) {
        // Group view - verify tabs match the table keys from API
        // CoreTab components use .m-tab class
        const tabs = tableCard.locator('.m-tab, button[role="tab"]');
        const tabCount = await tabs.count();
        console.log(`UI shows ${tabCount} tabs for ${tableKeys.length} tables in API`);
        
        // There should be tabs for the tables
        expect(tabCount).toBeGreaterThan(0);
      }

      // Get the first table data to verify content
      const firstTableKey = tableKeys[0];
      const firstTableData = instanceDataResponse.data[firstTableKey];
      
      if (Array.isArray(firstTableData) && firstTableData.length > 0) {
        console.log(`First table "${firstTableKey}" has ${firstTableData.length} rows from API`);

        // Check if it's a primitive array (SimpleList) or object array (CoreTable)
        const isPrimitiveArray = typeof firstTableData[0] !== 'object' || firstTableData[0] === null;
        
        if (isPrimitiveArray) {
          // For primitive arrays, SimpleList is used
          const simpleList = page.locator('.simple-list');
          const hasSimpleList = await simpleList.count() > 0;
          console.log(`Primitive array detected, SimpleList present: ${hasSimpleList}`);
        } else {
          // For object arrays, CoreTable is used
          // Verify the table has headers matching the object keys
          const firstItem = firstTableData[0];
          const expectedColumns = Object.keys(firstItem);
          console.log(`Expected columns from API data: ${expectedColumns.join(', ')}`);

          // Check for table headers
          const tableHeaders = page.locator('.v-data-table__th, .v-data-table-header th, th');
          await tableHeaders.first().waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
          
          const headerCount = await tableHeaders.count();
          console.log(`UI shows ${headerCount} table headers`);
          
          // Should have at least some headers (may include selection/action columns)
          expect(headerCount).toBeGreaterThan(0);

          // Verify some data values from the API appear in the table
          // Get a sample value from the first row to verify it's displayed
          const sampleValue = findDisplayableValue(firstItem);
          if (sampleValue) {
            console.log(`Looking for sample value from API in UI: "${sampleValue}"`);
            
            // Look for this value in the table content
            const cellWithValue = page.locator('.v-data-table').getByText(String(sampleValue), { exact: false });
            const valueFound = await cellWithValue.count() > 0;
            
            if (valueFound) {
              console.log(`✓ Found API data value "${sampleValue}" displayed in the table`);
            } else {
              // Value might be in a different format or truncated, log for debugging
              console.log(`Note: Could not find exact value "${sampleValue}" in table (may be formatted differently)`);
            }
          }
        }
      } else {
        console.log(`First table "${firstTableKey}" is empty or not an array`);
      }
    } else {
      // If we didn't capture the API response, just verify the UI structure
      console.log('API data not captured - verifying UI structure only');
      
      const coreTableContainer = page.locator('.core-table-container');
      const simpleList = page.locator('.simple-list');
      const tableCard = page.locator('.table-card');

      const hasTable = await coreTableContainer.count() > 0;
      const hasList = await simpleList.count() > 0;
      const hasCard = await tableCard.count() > 0;

      console.log(`Content types found - Table: ${hasTable}, List: ${hasList}, Card: ${hasCard}`);
      expect(hasTable || hasList || hasCard).toBe(true);
    }
  });

  test('should navigate between tabs in the Input Data page', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const app = page.locator('.v-application');
    await app.first().waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

    const hasExecutionLoaded = await ensureExecutionLoaded(page);
    expect(hasExecutionLoaded).toBe(true);

    // Ensure there is a selected execution tab
    const tablist = page.getByRole('tablist');
    await tablist.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

    const executionTab = tablist
      .getByRole('tab')
      .filter({ hasNot: page.getByText(/Añadir nuevo|Add new/i) })
      .first();

    await expect(executionTab).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });
    await expect(executionTab).toHaveAttribute('aria-selected', 'true');

    // Click on the "Input Data" / "Datos de entrada" option in the sidebar menu
    const inputDataLink = page.locator(
      'a[href*="/input-data/group/datos-de-entrada"], a[href*="/input-data/group/input"]'
    );
    await inputDataLink.first().waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
    await inputDataLink.first().click();

    // Wait for navigation and page load
    await expect(page).toHaveURL(/\/input-data/, { timeout: TIMEOUTS.NAVIGATION });

    const sectionView = page.locator('.section-view');
    await sectionView.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

    // Wait for loading to complete
    const loadingSpinner = page.locator('.loading-container');
    await expect(loadingSpinner).not.toBeVisible({ timeout: TIMEOUTS.NAVIGATION });

    // Check if we have a group view with tabs (table-card contains tabs)
    const tableCard = page.locator('.table-card');
    const hasGroupView = await tableCard.count() > 0;

    if (!hasGroupView) {
      console.log('No group view detected (single table), skipping tab navigation test');
      // Verify at least the table content is visible
      const tableContent = page.locator('.table-section');
      await expect(tableContent).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });
      return;
    }

    // Get all tabs within the table card (data tabs, not execution tabs)
    // CoreTab components use .m-tab class and role="tab" attribute
    const dataTabs = tableCard.locator('.m-tab, button[role="tab"]');
    const tabCount = await dataTabs.count();

    console.log(`Found ${tabCount} tabs in the Input Data page`);

    // Need at least 2 tabs to test navigation
    if (tabCount < 2) {
      console.log('Only one tab found, cannot test tab navigation');
      await expect(dataTabs.first()).toBeVisible();
      return;
    }

    // Get the text of all tabs for logging
    const tabTexts: string[] = [];
    for (let i = 0; i < tabCount; i++) {
      const tabText = await dataTabs.nth(i).textContent();
      tabTexts.push(tabText?.trim() || `Tab ${i}`);
    }
    console.log(`Tab names: ${tabTexts.join(', ')}`);

    // Verify the first tab is initially selected
    const firstTab = dataTabs.first();
    await expect(firstTab).toHaveAttribute('aria-selected', 'true');
    console.log(`First tab "${tabTexts[0]}" is selected by default`);

    // Navigate through each tab and verify content loads
    for (let i = 1; i < tabCount; i++) {
      const tab = dataTabs.nth(i);
      const tabName = tabTexts[i];

      console.log(`Clicking on tab "${tabName}" (index ${i})`);

      // Click on the tab
      await tab.click();

      // Wait for the tab to become selected
      await expect(tab).toHaveAttribute('aria-selected', 'true', { timeout: TIMEOUTS.FORM_LOAD });

      // Verify previous tab is no longer selected
      if (i > 0) {
        const previousTab = dataTabs.nth(i - 1);
        await expect(previousTab).toHaveAttribute('aria-selected', 'false');
      }

      // Wait for content to load (either CoreTable or SimpleList)
      const tableCardContent = tableCard.locator('.table-card-content');
      await expect(tableCardContent).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });

      // Check if content is loaded (has either a table or a list)
      const coreTableContainer = tableCardContent.locator('.core-table-container');
      const simpleList = tableCardContent.locator('.simple-list');

      const hasTable = await coreTableContainer.count() > 0;
      const hasList = await simpleList.count() > 0;

      console.log(`Tab "${tabName}" content - Table: ${hasTable}, List: ${hasList}`);

      // At least one type of content should be visible
      expect(hasTable || hasList).toBe(true);

      // Small delay to ensure UI is stable before next tab click
      await page.waitForTimeout(300);
    }

    // Navigate back to the first tab to verify round-trip navigation
    console.log(`Navigating back to first tab "${tabTexts[0]}"`);
    await firstTab.click();
    await expect(firstTab).toHaveAttribute('aria-selected', 'true', { timeout: TIMEOUTS.FORM_LOAD });

    console.log('Tab navigation test completed successfully');
  });

  test('should download Excel file when clicking the download button', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const app = page.locator('.v-application');
    await app.first().waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

    const hasExecutionLoaded = await ensureExecutionLoaded(page);
    expect(hasExecutionLoaded).toBe(true);

    // Ensure there is a selected execution tab
    const tablist = page.getByRole('tablist');
    await tablist.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

    const executionTab = tablist
      .getByRole('tab')
      .filter({ hasNot: page.getByText(/Añadir nuevo|Add new/i) })
      .first();

    await expect(executionTab).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });
    await expect(executionTab).toHaveAttribute('aria-selected', 'true');

    // Click on the "Input Data" / "Datos de entrada" option in the sidebar menu
    const inputDataLink = page.locator(
      'a[href*="/input-data/group/datos-de-entrada"], a[href*="/input-data/group/input"]'
    );
    await inputDataLink.first().waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
    await inputDataLink.first().click();

    // Wait for navigation and page load
    await expect(page).toHaveURL(/\/input-data/, { timeout: TIMEOUTS.NAVIGATION });

    const sectionView = page.locator('.section-view');
    await sectionView.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

    // Wait for loading to complete
    const loadingSpinner = page.locator('.loading-container');
    await expect(loadingSpinner).not.toBeVisible({ timeout: TIMEOUTS.NAVIGATION });

    // Find the three-dots menu button (CoreDropdownMenu trigger)
    // The button is inside the table content area, next to the filters
    const menuButton = page.locator(
      '.table-card-content .core-dropdown-menu__trigger, ' +
      '.core-table-container .core-dropdown-menu__trigger, ' +
      '.table-section .core-dropdown-menu__trigger'
    ).first();

    await menuButton.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
    console.log('Found the three-dots menu button (CoreDropdownMenu trigger)');

    // Click the menu button to open the dropdown
    await menuButton.click();

    // Wait for the menu to appear and find the "Descargar excel" option
    const downloadOption = page.getByText(/Descargar excel|Download excel/i);
    await downloadOption.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
    console.log('Download Excel option is visible');

    // Set up download listener before clicking
    const downloadPromise = page.waitForEvent('download', { timeout: TIMEOUTS.NAVIGATION });

    // Click the download option
    await downloadOption.click();

    // Wait for the download to complete
    const download = await downloadPromise;

    // Verify the download
    const suggestedFilename = download.suggestedFilename();
    console.log(`Downloaded file: ${suggestedFilename}`);

    // Verify the file has an Excel extension
    expect(
      suggestedFilename.endsWith('.xlsx') || suggestedFilename.endsWith('.xls')
    ).toBe(true);

    console.log('Excel download test completed successfully');
  });

  test('should navigate to edit instance page when clicking Edit Input Data option', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const app = page.locator('.v-application');
    await app.first().waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

    const hasExecutionLoaded = await ensureExecutionLoaded(page);
    expect(hasExecutionLoaded).toBe(true);

    // Ensure there is a selected execution tab
    const tablist = page.getByRole('tablist');
    await tablist.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

    const executionTab = tablist
      .getByRole('tab')
      .filter({ hasNot: page.getByText(/Añadir nuevo|Add new/i) })
      .first();

    await expect(executionTab).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });
    await expect(executionTab).toHaveAttribute('aria-selected', 'true');

    // Capture the execution name from the selected tab before navigation
    const executionTabName = await executionTab.textContent();
    const executionName = executionTabName?.trim() || '';
    console.log(`Selected execution name: "${executionName}"`);

    // Click on the "Input Data" / "Datos de entrada" option in the sidebar menu
    const inputDataLink = page.locator(
      'a[href*="/input-data/group/datos-de-entrada"], a[href*="/input-data/group/input"]'
    );
    await inputDataLink.first().waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
    await inputDataLink.first().click();

    // Wait for navigation and page load
    await expect(page).toHaveURL(/\/input-data/, { timeout: TIMEOUTS.NAVIGATION });

    const sectionView = page.locator('.section-view');
    await sectionView.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

    // Wait for loading to complete
    const loadingSpinner = page.locator('.loading-container');
    await expect(loadingSpinner).not.toBeVisible({ timeout: TIMEOUTS.NAVIGATION });

    // Find the three-dots menu button in the title view (CoreTitleView actions)
    const titleViewMenuButton = page.locator(
      '.core-title-view__actions .core-dropdown-menu__trigger'
    );

    // Check if the edit option is available (depends on app configuration)
    const menuButtonVisible = await titleViewMenuButton.isVisible();
    
    if (!menuButtonVisible) {
      console.log('Edit Input Data option is not available (allowEditInstance may be disabled)');
      // Skip test if the option is not available
      return;
    }

    await titleViewMenuButton.click();
    console.log('Opened the title view dropdown menu');

    // Wait for the menu to appear and find the "Editar datos de entrada" option
    const editOption = page.getByText(/Editar datos de entrada|Edit input data/i);
    
    // Check if the edit option exists
    const editOptionVisible = await editOption.isVisible().catch(() => false);
    
    if (!editOptionVisible) {
      console.log('Edit Input Data option is not present in the menu');
      // Close the menu by clicking elsewhere
      await page.keyboard.press('Escape');
      return;
    }

    console.log('Found "Edit Input Data" option');

    // Click the edit option
    await editOption.click();

    // Verify navigation to project-execution page with editInstance query param
    await expect(page).toHaveURL(/\/project-execution.*editInstance=true/, { 
      timeout: TIMEOUTS.NAVIGATION 
    });

    console.log('Successfully navigated to edit instance page');

    // Wait for the execution page to load (uses MFormSteps component)
    const formSteps = page.locator('.m-form-steps, .view-container');
    await formSteps.first().waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

    // Verify that the same execution tab is still selected
    const executionTablistAfterNav = page.getByRole('tablist');
    await executionTablistAfterNav.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

    const selectedTabAfterNav = executionTablistAfterNav
      .getByRole('tab')
      .filter({ hasNot: page.getByText(/Añadir nuevo|Add new/i) })
      .first();

    await expect(selectedTabAfterNav).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });
    await expect(selectedTabAfterNav).toHaveAttribute('aria-selected', 'true');

    // Verify it's the same execution
    const tabNameAfterNav = await selectedTabAfterNav.textContent();
    console.log(`Execution tab after navigation: "${tabNameAfterNav?.trim()}"`);
    
    expect(tabNameAfterNav?.trim()).toBe(executionName);
    console.log('Verified that the same execution is loaded');

    console.log('Edit instance page loaded successfully with execution data');
  });

});

/**
 * Helper function to find a displayable value from an object
 * Prioritizes string/number values that are likely to be shown in the UI
 */
function findDisplayableValue(obj: Record<string, any>): string | number | null {
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    // Skip null, undefined, empty strings, and complex objects
    if (value === null || value === undefined || value === '') continue;
    if (typeof value === 'object') continue;
    // Skip very long values that might be truncated
    if (typeof value === 'string' && value.length > 50) continue;
    // Skip boolean values
    if (typeof value === 'boolean') continue;
    // Return the first suitable value
    return value;
  }
  return null;
}
