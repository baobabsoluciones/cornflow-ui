import { test, expect } from '../../fixtures';
import { TIMEOUTS } from '../../helpers/constants';

/**
 * Tests for the Pin drawer button in the sidebar menu.
 *
 * Verifies that clicking the pin button keeps the drawer expanded,
 * and clicking again collapses the drawer.
 */
test.describe('Pin Drawer', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const app = page.locator('.v-application');
    await app.first().waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
  });

  test('should keep drawer expanded when pin is clicked and collapse when unpin is clicked', async ({
    page,
  }) => {
    // The drawer starts collapsed (mini). Hover over the drawer area to expand it
    // so the pin button becomes visible (it's only shown when drawer is expanded).
    const drawerArea = page.locator('.logo-container').first();
    await drawerArea.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
    await drawerArea.hover();

    // Wait for the drawer to expand and the pin button to appear
    // Use button with pin icon (title "Pin drawer" may not be exposed as accessible name in all browsers)
    const pinButton = page.locator('button.pin-button').first();
    await pinButton.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

    // Click pin: drawer should stay expanded (pinned)
    await pinButton.click();

    // Verify drawer stays expanded: pin button (now showing Unpin) and app name are visible
    const pinButtonAfter = page.locator('button.pin-button').first();
    await expect(pinButtonAfter).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });

    const appName = page.locator('.app-name').first();
    await expect(appName).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });

    // Move mouse away to ensure we're not relying on hover state
    await page.mouse.move(10, 10);
    await expect(pinButtonAfter).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });
    await expect(appName).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });

    // Click unpin: drawer should collapse
    await pinButtonAfter.click();

    // Verify drawer is collapsed: app name is no longer visible (only shown when expanded)
    await expect(appName).not.toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });
  });
});
