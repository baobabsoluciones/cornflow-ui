/**
 * Emergency password restoration test
 * 
 * This test can be run independently to restore the password if a test fails
 * and leaves the password in an unknown state.
 * 
 * Usage:
 *   npx playwright test tests/e2e/restore-password.spec.ts
 */

import { test } from '@playwright/test';
import { restorePassword } from './helpers/restorePassword';

test.describe('Password Restoration', () => {
  test('restore original password', async ({ page }) => {
    await restorePassword(page);
  });
});
