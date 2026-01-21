import { test, expect } from '@playwright/test';

/**
 * Simple example test to verify Playwright configuration
 * This test checks that the application loads correctly
 */
test('should load the application homepage', async ({ page }) => {
  // Navigate to the base URL
  await page.goto('/');

  // Wait for the page to load
  await page.waitForLoadState('networkidle');

  // Verify that the page has loaded by checking for the v-app element
  // This is the root element of a Vuetify application
  const app = page.locator('v-app, [data-app], .v-application');
  await expect(app.first()).toBeVisible({ timeout: 10000 });

  // Verify that the page title exists (or check for any visible content)
  await expect(page).toHaveTitle(/./); // Any non-empty title

  // Take a screenshot for verification (optional, useful for debugging)
  // await page.screenshot({ path: 'tests/e2e/screenshots/homepage.png' });
});
