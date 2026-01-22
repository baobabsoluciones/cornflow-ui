import { Page, expect } from '@playwright/test';
import {
  SELECTORS,
  TIMEOUTS,
  SESSION_STORAGE_KEYS,
} from '../constants';
import {
  waitForProtectedRoute,
  isOnSignInPage,
} from '../urlHelpers';
import {
  waitForAuthentication,
  verifyAuthSessionStorage,
} from '../sessionStorageHelpers';
import {
  setupErrorDetection,
  checkErrorSnackbar,
  getDetailedErrorMessage,
} from '../errorDetection';

/**
 * Helper function to authenticate a user using Cornflow authentication
 * (username/password login)
 * 
 * This helper:
 * 1. Navigates to the sign-in page (/sign-in)
 * 2. Fills in the username and password fields
 * 3. Submits the login form
 * 4. Waits for successful authentication (redirect to home page)
 * 5. Verifies that the user is authenticated by checking sessionStorage
 * 
 * @param page - Playwright Page object
 * @param username - Username to login with (defaults to PLAYWRIGHT_TEST_USER env var)
 * @param password - Password to login with (defaults to PLAYWRIGHT_TEST_PASSWORD env var)
 * @param options - Optional configuration
 * @param options.waitForNavigation - Whether to wait for navigation after login (default: true)
 * @param options.verifyAuth - Whether to verify authentication state (default: true)
 * @returns Promise that resolves when authentication is complete
 * 
 * @example
 * ```typescript
 * import { test } from '@playwright/test';
 * import { cornflowAuth } from '@/helpers/auth/cornflowAuth';
 * 
 * test('my test', async ({ page }) => {
 *   await cornflowAuth(page);
 *   // User is now authenticated, continue with test...
 * });
 * ```
 */
export async function cornflowAuth(
  page: Page,
  username?: string,
  password?: string,
  options: {
    waitForNavigation?: boolean;
    verifyAuth?: boolean;
  } = {}
): Promise<void> {
  const {
    waitForNavigation = true,
    verifyAuth = true,
  } = options;

  // Get credentials from parameters or environment variables
  // Use explicit undefined check to allow empty strings as valid parameter values
  const testUsername = username !== undefined ? username : (process.env.PLAYWRIGHT_TEST_USER || '');
  const testPassword = password !== undefined ? password : (process.env.PLAYWRIGHT_TEST_PASSWORD || '');

  if (!testUsername || !testPassword) {
    throw new Error(
      'Username and password are required. Provide them as parameters or set PLAYWRIGHT_TEST_USER and PLAYWRIGHT_TEST_PASSWORD environment variables.'
    );
  }

  // Navigate to sign-in page
  await page.goto('/sign-in');
  await page.waitForLoadState('networkidle');
  
  // Wait for the form container to be visible
  await page.waitForSelector(SELECTORS.LOGIN_FORM, { timeout: TIMEOUTS.FORM_LOAD });

  // Wait for application initialization (config.initConfig())
  await page.waitForTimeout(TIMEOUTS.CONFIG_INIT_DELAY);

  // Fill username field
  const usernameInput = page.locator(SELECTORS.USERNAME_INPUT).first();
  await usernameInput.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
  await usernameInput.fill(testUsername);
  await page.waitForTimeout(TIMEOUTS.INPUT_FILL_DELAY);

  // Fill password field
  const passwordInput = page.locator(SELECTORS.PASSWORD_INPUT);
  await passwordInput.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
  await passwordInput.fill(testPassword);
  await page.waitForTimeout(TIMEOUTS.INPUT_FILL_DELAY);

  // Find and click the submit button
  const submitButton = page.locator(SELECTORS.SUBMIT_BUTTON);
  await submitButton.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
  await expect(submitButton).toBeEnabled({ timeout: TIMEOUTS.BUTTON_ENABLE });

  // Set up error detection before clicking submit
  const errorDetection = setupErrorDetection(page);

  try {
    // Click submit button
    await submitButton.click();

    // Wait a bit for potential errors to appear before checking
    await page.waitForTimeout(TIMEOUTS.ERROR_SNACKBAR_CHECK);

    // Check for error snackbar early (before waiting for navigation)
    const snackbarError = await checkErrorSnackbar(page);
    if (snackbarError.hasError) {
      const detailedError = await getDetailedErrorMessage(
        page,
        `Error snackbar detected: "${snackbarError.errorMessage}"`
      );
      throw new Error(detailedError);
    }

    // Check for errors from listeners
    const listenerError = errorDetection.getError();
    if (listenerError) {
      const detailedError = await getDetailedErrorMessage(page, listenerError);
      throw new Error(detailedError);
    }

    // Wait for navigation if requested (only if no errors detected)
    if (waitForNavigation) {
      try {
        await waitForProtectedRoute(page, TIMEOUTS.NAVIGATION);
      } catch (navError) {
        // If navigation times out, check for error snackbar
        const snackbarError = await checkErrorSnackbar(page);
        if (snackbarError.hasError) {
          const detailedError = await getDetailedErrorMessage(
            page,
            `Login failed: ${snackbarError.errorMessage}`
          );
          throw new Error(detailedError);
        }
        // Check for listener errors
        const listenerError = errorDetection.getError();
        if (listenerError) {
          const detailedError = await getDetailedErrorMessage(page, listenerError);
          throw new Error(detailedError);
        }
        // If no errors detected but navigation failed, re-throw the navigation error
        throw navError;
      }
    }
  } catch (error) {
    // Check for error snackbar if not already checked
    const snackbarError = await checkErrorSnackbar(page);
    if (snackbarError.hasError) {
      const detailedError = await getDetailedErrorMessage(
        page,
        `Login failed: ${snackbarError.errorMessage}`
      );
      throw new Error(detailedError);
    }

    // Re-throw with additional context
    const errorMessage = error instanceof Error ? error.message : String(error);
    const listenerError = errorDetection.getError();
    const detailedError = await getDetailedErrorMessage(
      page,
      `Login failed: ${listenerError || errorMessage}`
    );
    throw new Error(detailedError);
  } finally {
    // Always clean up listeners
    errorDetection.cleanup();
  }

  // Verify authentication state if requested
  if (verifyAuth) {
    // Wait for authentication to be set in sessionStorage
    await waitForAuthentication(
      page,
      TIMEOUTS.AUTH_VERIFICATION_MAX_ATTEMPTS * TIMEOUTS.AUTH_VERIFICATION_POLL,
      TIMEOUTS.AUTH_VERIFICATION_POLL
    );

    // Verify authentication data exists
    await verifyAuthSessionStorage(page);

    // Verify we're not on the sign-in page anymore
    if (isOnSignInPage(page)) {
      throw new Error('Authentication failed: still on sign-in page after login attempt');
    }
  }
}

/**
 * Helper function to check if the user is currently authenticated
 * 
 * @param page - Playwright Page object
 * @returns Promise<boolean> - true if authenticated, false otherwise
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  return await page.evaluate((keys) => {
    return (
      sessionStorage.getItem(keys.IS_AUTHENTICATED) === 'true' &&
      sessionStorage.getItem(keys.TOKEN) !== null
    );
  }, SESSION_STORAGE_KEYS);
}

/**
 * Helper function to logout the current user
 * 
 * This function:
 * 1. Clears sessionStorage authentication data
 * 2. Optionally navigates to sign-in page
 * 
 * @param page - Playwright Page object
 * @param navigateToSignIn - Whether to navigate to sign-in page after logout (default: true)
 */
export async function logout(
  page: Page,
  navigateToSignIn: boolean = true
): Promise<void> {
  // Clear sessionStorage
  await page.evaluate((keys) => {
    sessionStorage.setItem(keys.IS_AUTHENTICATED, 'false');
    sessionStorage.removeItem(keys.TOKEN);
    sessionStorage.removeItem(keys.USER_ID);
  }, SESSION_STORAGE_KEYS);

  // Navigate to sign-in if requested
  if (navigateToSignIn) {
    await page.goto('/sign-in');
    await page.waitForLoadState('networkidle');
  }
}
