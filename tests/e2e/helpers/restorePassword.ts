/**
 * Emergency script to restore the original password
 * 
 * This script can be run independently to restore the password if a test fails
 * and leaves the password in an unknown state.
 * 
 * Usage:
 *   npx playwright test tests/e2e/restore-password.spec.ts
 * 
 * Or import and use in a test:
 *   import { restorePassword } from './helpers/restorePassword';
 *   await restorePassword(page, userId, originalPassword);
 */

import { Page } from '@playwright/test';
import { authenticate, logout } from './auth/index';
import { getAuthSessionStorage } from './sessionStorageHelpers';

/**
 * Restore password using UI (more reliable than direct API)
 * 
 * @param page - Playwright Page object
 * @param originalPassword - The original password to restore
 * @param temporaryPassword - The temporary password to use for login
 */
export async function restorePasswordViaUI(
  page: Page,
  originalPassword: string,
  temporaryPassword: string
): Promise<void> {
  // Navigate to user settings
  const userContainer = page.locator('.user-container').first();
  await userContainer.waitFor({ state: 'visible', timeout: 10000 });
  await userContainer.click();

  // Wait for navigation
  await page.waitForURL(
    (url) => url.hash.includes('/user-settings'),
    { timeout: 20000 }
  );

  // Navigate to user-profile tab
  const userProfileTab = page.getByRole('tab', { name: /Perfil de usuario|User profile|Profil utilisateur/i });
  await userProfileTab.waitFor({ state: 'visible', timeout: 10000 });
  await userProfileTab.click();
  await page.waitForTimeout(500);

  // Fill password fields with original password
  const passwordInputs = page.locator('input[type="password"]');
  await passwordInputs.first().waitFor({ state: 'visible', timeout: 10000 });
  
  const newPasswordField = passwordInputs.first();
  const confirmPasswordField = passwordInputs.nth(1);

  // Fill with original password
  await newPasswordField.fill(originalPassword);
  await page.waitForTimeout(200);
  await confirmPasswordField.fill(originalPassword);
  await page.waitForTimeout(200);

  // Submit the form
  const submitButton = page.getByRole('button', { name: /Enviar|Submit|Soumettre/i });
  await submitButton.waitFor({ state: 'visible', timeout: 10000 });
  await submitButton.waitFor({ state: 'attached' });
  await page.waitForTimeout(500); // Wait for button to be enabled
  
  // Check if button is enabled, if not wait a bit more
  const isEnabled = await submitButton.isEnabled();
  if (!isEnabled) {
    await page.waitForTimeout(1000);
  }
  
  await submitButton.click();

  // Wait for success message
  const successSnackbar = page.locator('.v-snackbar').filter({ 
    hasText: /Password updated successfully|Contraseña actualizada correctamente|Mot de passe mis à jour avec succès/i 
  });
  await successSnackbar.waitFor({ state: 'visible', timeout: 10000 });
  
  console.log('✅ Password restored successfully via UI');
  
  // Verify by logging out and logging in with original password
  await logout(page, true);
  await authenticate(page, undefined, originalPassword, {
    waitForNavigation: true,
    verifyAuth: true
  });
  
  console.log('✅ Verified: Login with original password works!');
}

/**
 * Complete password restoration flow
 * Attempts to restore password by trying both temporary and original passwords
 * 
 * @param page - Playwright Page object
 * @param username - Username (defaults to PLAYWRIGHT_TEST_USER)
 * @param originalPassword - The original password to restore
 * @param userId - Optional user ID (will be retrieved if not provided)
 */
export async function restorePassword(
  page: Page,
  username?: string,
  originalPassword?: string,
  userId?: string
): Promise<void> {
  const testUsername = username || process.env.PLAYWRIGHT_TEST_USER;
  const testOriginalPassword = originalPassword || process.env.PLAYWRIGHT_TEST_PASSWORD;
  const backendUrl = process.env.PLAYWRIGHT_BACKEND_URL || process.env.VITE_APP_BACKEND_URL;
  const temporaryPassword = process.env.PLAYWRIGHT_TEST_TEMP_PASSWORD;

  if (!testUsername || !testOriginalPassword) {
    throw new Error(
      'Username and original password are required. ' +
      'Provide them as parameters or set PLAYWRIGHT_TEST_USER and PLAYWRIGHT_TEST_PASSWORD environment variables.'
    );
  }

  if (!temporaryPassword) {
    throw new Error(
      'Temporary password is required. ' +
      'Set PLAYWRIGHT_TEST_TEMP_PASSWORD environment variable in .env.test file.'
    );
  }

  if (!backendUrl) {
    throw new Error(
      'Backend URL is not configured. Set PLAYWRIGHT_BACKEND_URL or VITE_APP_BACKEND_URL'
    );
  }

  console.log('🔄 Starting password restoration...');
  console.log(`   Username: ${testUsername}`);
  console.log(`   Backend: ${backendUrl}`);

  // Try to login with temporary password first
  try {
    console.log('🔐 Attempting login with temporary password...');
    await authenticate(page, testUsername, temporaryPassword, {
      waitForNavigation: true,
      verifyAuth: true
    });

    // Get user ID if not provided
    if (!userId) {
      const authData = await getAuthSessionStorage(page);
      userId = authData.userId ?? undefined;
      
      if (!userId) {
        throw new Error('User ID not found in sessionStorage');
      }
    }

    console.log(`   User ID: ${userId}`);

    // Restore password via UI
    await restorePasswordViaUI(page, testOriginalPassword, temporaryPassword);
    
  } catch (tempPasswordError) {
    console.log('⚠️  Login with temporary password failed, trying original password...');
    
    // If temporary password doesn't work, try original (maybe it wasn't changed)
    try {
      await authenticate(page, testUsername, testOriginalPassword, {
        waitForNavigation: true,
        verifyAuth: true
      });

      console.log('✅ Password is already the original password. No restoration needed.');
      
    } catch (originalPasswordError) {
      console.error('❌ Both temporary and original passwords failed!');
      console.error('   Temporary password error:', tempPasswordError);
      console.error('   Original password error:', originalPasswordError);
      throw new Error(
        'Cannot restore password: both temporary and original passwords failed. ' +
        'You may need to reset the password manually through the admin interface.'
      );
    }
  }
}
