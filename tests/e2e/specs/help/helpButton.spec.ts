import { test, expect } from '../../fixtures';
import { TIMEOUTS } from '../../helpers/constants';

/**
 * Tests for the help button functionality
 * 
 * These tests verify that the help button in the top right corner
 * of the application correctly displays the help menu when clicked.
 */
test.describe('Help Button', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Wait for the help button to be available
    const helpButton = page.locator('button:has([class*="mdi-help"])').first();
    await helpButton.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD }).catch(() => {
      // Help button might not be visible immediately, wait for app to be ready
      const app = page.locator('v-app, [data-app], .v-application');
      return app.first().waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
    });
  });

  test('should display help menu when help button is clicked', async ({ page }) => {
    // Find the help button by its icon (mdi-help)
    // The button is a v-btn with fab and icon classes, containing mdi-help icon
    const helpButton = page.locator('button:has([class*="mdi-help"])').first();
    
    // Wait for the button to be visible
    await helpButton.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

    // Click the help button
    await helpButton.click();

    // Wait for the menu to appear
    // The menu is a v-menu that contains a v-list
    const helpMenu = page.locator('.v-menu .v-list').first();
    await helpMenu.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

    // Verify that the menu is visible
    await expect(helpMenu).toBeVisible();

    // Verify menu items are present
    // Check for "Centro de ayuda" (Spanish) or "Help center" (English)
    const helpCenterItem = page.getByText(/Centro de ayuda|Help center/i);
    await expect(helpCenterItem).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });

    // Check for "Licencias" (Spanish) or "Licenses" (English)
    const licensesItem = page.getByText(/Licencias|Licenses/i);
    await expect(licensesItem).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });

    // Verify version information is displayed
    // Check for "Cornflow app version: X.X.X"
    const appVersion = page.getByText(/Cornflow app version:/i);
    await expect(appVersion).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });

    // Check for "Cornflow version: X.X.X"
    const cornflowVersion = page.getByText(/Cornflow version:/i);
    await expect(cornflowVersion).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });
  });

  test('should open help center modal when clicking "Centro de ayuda"', async ({ page }) => {
    // Open the help menu
    const helpButton = page.locator('button:has([class*="mdi-help"])').first();
    await helpButton.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
    await helpButton.click();

    // Wait for the menu to appear
    const helpMenu = page.locator('.v-menu .v-list').first();
    await helpMenu.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

    // Click on "Centro de ayuda" / "Help center"
    const helpCenterItem = page.getByText(/Centro de ayuda|Help center/i);
    await helpCenterItem.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
    await helpCenterItem.click();

    // Wait for the modal to appear
    // MBaseModal renders as a v-dialog in Vuetify
    // First verify the modal title appears (more reliable than waiting for the dialog element)
    const modalTitle = page.getByText(/Centro de ayuda|Help center/i).first();
    await modalTitle.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
    
    // Then find the dialog container
    const helpModal = page.locator('.v-dialog--active, .v-overlay--active').first();
    await helpModal.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

    // Verify the modal is visible
    await expect(helpModal).toBeVisible();
  });

  test('should display download link for user manual in help center modal', async ({ page }) => {
    // Open the help menu
    const helpButton = page.locator('button:has([class*="mdi-help"])').first();
    await helpButton.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
    await helpButton.click();

    // Wait for the menu to appear
    const helpMenu = page.locator('.v-menu .v-list').first();
    await helpMenu.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

    // Click on "Centro de ayuda" / "Help center"
    const helpCenterItem = page.getByText(/Centro de ayuda|Help center/i);
    await helpCenterItem.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
    await helpCenterItem.click();

    // Wait for the modal to appear
    // First verify the modal title appears
    const modalTitle = page.getByText(/Centro de ayuda|Help center/i).first();
    await modalTitle.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
    
    // Then find the dialog container
    const helpModal = page.locator('.v-dialog--active, .v-overlay--active').first();
    await helpModal.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

    // Verify the download link is present
    // The link should contain the download icon (mdi-download) and the download text
    const downloadLink = page.locator('a:has([class*="mdi-download"])');
    await downloadLink.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
    await expect(downloadLink).toBeVisible();

    // Verify the download link has the download attribute
    const downloadAttribute = await downloadLink.getAttribute('download');
    expect(downloadAttribute).toBe('manual_user.pdf');

    // Verify the download text is visible
    const downloadText = page.getByText(/Descargar manual de usuario|Download user manual/i);
    await expect(downloadText).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });
  });

  test('should download user manual when clicking download link', async ({ page, context }) => {
    // Open the help menu
    const helpButton = page.locator('button:has([class*="mdi-help"])').first();
    await helpButton.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
    await helpButton.click();

    // Wait for the menu to appear
    const helpMenu = page.locator('.v-menu .v-list').first();
    await helpMenu.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

    // Click on "Centro de ayuda" / "Help center"
    const helpCenterItem = page.getByText(/Centro de ayuda|Help center/i);
    await helpCenterItem.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
    await helpCenterItem.click();

    // Wait for the modal to appear
    const modalTitle = page.getByText(/Centro de ayuda|Help center/i).first();
    await modalTitle.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
    
    const helpModal = page.locator('.v-dialog--active, .v-overlay--active').first();
    await helpModal.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

    // Find the download link
    const downloadLink = page.locator('a:has([class*="mdi-download"])');
    await downloadLink.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

    // Set up download listener before clicking
    const downloadPromise = page.waitForEvent('download', { timeout: TIMEOUTS.FORM_LOAD });

    // Click the download link
    await downloadLink.click();

    // Wait for the download to start
    const download = await downloadPromise;

    // Verify the download filename
    expect(download.suggestedFilename()).toBe('manual_user.pdf');

    // Verify the download URL contains the manual file path
    const downloadUrl = download.url();
    expect(downloadUrl).toContain('manual');
    expect(downloadUrl).toMatch(/user_manual_(es|en|fr)\.pdf$/);

    // Optionally, save the file to verify it's a valid PDF
    // Note: In a real scenario, you might want to verify the file content
    const path = await download.path();
    expect(path).toBeTruthy();
  });

  test('should close help center modal when clicking close button', async ({ page }) => {
    // Open the help menu
    const helpButton = page.locator('button:has([class*="mdi-help"])').first();
    await helpButton.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
    await helpButton.click();

    // Wait for the menu to appear
    const helpMenu = page.locator('.v-menu .v-list').first();
    await helpMenu.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

    // Click on "Centro de ayuda" / "Help center"
    const helpCenterItem = page.getByText(/Centro de ayuda|Help center/i);
    await helpCenterItem.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
    await helpCenterItem.click();

    // Wait for the modal to appear
    // First verify the modal title appears
    const modalTitle = page.getByText(/Centro de ayuda|Help center/i).first();
    await modalTitle.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
    
    // Then find the dialog container
    const helpModal = page.locator('.v-dialog--active, .v-overlay--active').first();
    await helpModal.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
    await expect(helpModal).toBeVisible();

    // Find and click the close button
    // The close button has class "primary-btn" and text "Cerrar" / "Close"
    const closeButton = page.getByRole('button', { name: /Cerrar|Close/i }).first();
    await closeButton.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
    await closeButton.click();

    // Wait for the modal to close
    await helpModal.waitFor({ state: 'hidden', timeout: TIMEOUTS.FORM_LOAD });

    // Verify the modal is no longer visible
    await expect(helpModal).not.toBeVisible();
  });

  test('should open licenses modal when clicking "Licencias"', async ({ page }) => {
    // Open the help menu
    const helpButton = page.locator('button:has([class*="mdi-help"])').first();
    await helpButton.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
    await helpButton.click();

    // Wait for the menu to appear
    const helpMenu = page.locator('.v-menu .v-list').first();
    await helpMenu.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

    // Click on "Licencias" / "Licenses"
    const licensesItem = page.getByText(/Licencias|Licenses/i);
    await licensesItem.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
    await licensesItem.click();

    // Wait for the modal to appear
    // MBaseModal renders as a v-dialog in Vuetify
    // First verify the modal title appears (more reliable than waiting for the dialog element)
    const modalTitle = page.getByText(/Licencias|Licenses/i).first();
    await modalTitle.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
    
    // Then find the dialog container
    const licensesModal = page.locator('.v-dialog--active, .v-overlay--active').first();
    await licensesModal.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

    // Verify the modal is visible
    await expect(licensesModal).toBeVisible();

    // Verify the modal contains the licenses list
    // The modal should contain a list (ul) with license items
    const licensesList = page.locator('.v-dialog--active ul.list, .v-overlay--active ul.list').first();
    await licensesList.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
    await expect(licensesList).toBeVisible();

    // Verify that the list contains at least one license item
    // License items are in <li> tags with format: library v.version (license): author - description
    const licenseItems = licensesList.locator('li');
    const itemCount = await licenseItems.count();
    expect(itemCount).toBeGreaterThan(0);
  });
});
