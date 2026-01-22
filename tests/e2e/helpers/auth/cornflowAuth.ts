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
 * Fill a form input field with proper waiting and delays
 */
async function fillInputField(
  page: Page,
  selector: string,
  value: string,
  isFirst: boolean = false
): Promise<void> {
  const input = isFirst
    ? page.locator(selector).first()
    : page.locator(selector);
  
  await input.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
  await input.fill(value);
  await page.waitForTimeout(TIMEOUTS.INPUT_FILL_DELAY);
}

/**
 * Check for authentication errors (snackbar and listeners)
 * Returns a detailed error message if an error is found, null otherwise
 */
async function checkForAuthErrors(
  page: Page,
  errorDetection: ReturnType<typeof setupErrorDetection>,
  baseMessage: string = 'Login failed'
): Promise<string | null> {
  // Check for error snackbar
  const snackbarError = await checkErrorSnackbar(page);
  if (snackbarError.hasError) {
    return await getDetailedErrorMessage(
      page,
      `${baseMessage}: ${snackbarError.errorMessage}`
    );
  }

  // Check for errors from listeners
  const listenerError = errorDetection.getError();
  if (listenerError) {
    return await getDetailedErrorMessage(page, `${baseMessage}: ${listenerError}`);
  }

  return null;
}

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

  // Navigate to sign-in page and wait for form
  await page.goto('/sign-in');
  await page.waitForLoadState('networkidle');
  await page.waitForSelector(SELECTORS.LOGIN_FORM, { timeout: TIMEOUTS.FORM_LOAD });
  await page.waitForTimeout(TIMEOUTS.CONFIG_INIT_DELAY);

  // Fill form fields
  await fillInputField(page, SELECTORS.USERNAME_INPUT, testUsername, true);
  await fillInputField(page, SELECTORS.PASSWORD_INPUT, testPassword);

  // Prepare and click submit button
  const submitButton = page.locator(SELECTORS.SUBMIT_BUTTON);
  await submitButton.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
  await expect(submitButton).toBeEnabled({ timeout: TIMEOUTS.BUTTON_ENABLE });

  // Set up error detection before submitting
  const errorDetection = setupErrorDetection(page);

  try {
    // Submit the form
    await submitButton.click();
    await page.waitForTimeout(TIMEOUTS.ERROR_SNACKBAR_CHECK);

    // Check for errors immediately after submission
    const errorMessage = await checkForAuthErrors(page, errorDetection, 'Error snackbar detected');
    if (errorMessage) {
      throw new Error(errorMessage);
    }

    // Wait for navigation if requested
    if (waitForNavigation) {
      try {
        await waitForProtectedRoute(page, TIMEOUTS.NAVIGATION);
      } catch (navError) {
        // If navigation fails, check for errors that might have appeared
        const navErrorMessage = await checkForAuthErrors(page, errorDetection, 'Login failed');
        if (navErrorMessage) {
          throw new Error(navErrorMessage);
        }
        // Re-throw navigation error if no other errors found
        throw navError;
      }
    }
  } catch (error) {
    // Final error check before throwing
    const finalErrorMessage = await checkForAuthErrors(page, errorDetection, 'Login failed');
    if (finalErrorMessage) {
      throw new Error(finalErrorMessage);
    }

    // Re-throw original error with context
    const errorMessage = error instanceof Error ? error.message : String(error);
    const detailedError = await getDetailedErrorMessage(page, `Login failed: ${errorMessage}`);
    throw new Error(detailedError);
  } finally {
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
