import { test, expect } from '../../fixtures';
import { TIMEOUTS } from '../../helpers/constants';

const BAOBAB_URL = 'https://baobabsoluciones.es/';

/**
 * Tests for the "Powered by baobab soluciones" link in the app bar.
 *
 * Verifies that the link has the correct href and that clicking it
 * opens the correct URL (in a new tab).
 */
test.describe('Baobab link', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const app = page.locator('.v-application');
    await app.first().waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
  });

  test('should have correct href and open baobab soluciones URL when clicked', async ({
    page,
    context,
  }) => {
    const link = page.getByRole('link', { name: /baobab soluciones/i });
    await link.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

    await expect(link).toHaveAttribute('href', BAOBAB_URL);
    await expect(link).toHaveAttribute('target', '_blank');

    // Click opens a new tab; wait for the new page and verify its URL
    const newPagePromise = context.waitForEvent('page');
    await link.click();
    const newPage = await newPagePromise;

    await expect(newPage).toHaveURL(BAOBAB_URL, { timeout: TIMEOUTS.NAVIGATION });
    await newPage.close();
  });
});
