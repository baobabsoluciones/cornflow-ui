import { Page, expect } from '@playwright/test';

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
  const testUsername = username || process.env.PLAYWRIGHT_TEST_USER || '';
  const testPassword = password || process.env.PLAYWRIGHT_TEST_PASSWORD || '';

  if (!testUsername || !testPassword) {
    throw new Error(
      'Username and password are required. Provide them as parameters or set PLAYWRIGHT_TEST_USER and PLAYWRIGHT_TEST_PASSWORD environment variables.'
    );
  }

  // Navigate to sign-in page
  await page.goto('/sign-in');

  // Wait for the login form to be visible
  await page.waitForLoadState('networkidle');

  // Find and fill username field
  // Using getByLabel to find input by its label text (more robust)
  // Fallback to placeholder or input type if label doesn't work
  const usernameInput = page.getByLabel(/username/i).or(
    page.locator('input[type="text"]').first()
  );
  await usernameInput.fill(testUsername);

  // Find and fill password field
  const passwordInput = page.getByLabel(/password/i).or(
    page.locator('input[type="password"]')
  );
  await passwordInput.fill(testPassword);

  // Find and click the submit button
  // Using getByRole for the button, or fallback to class selector
  const submitButton = page.getByRole('button', { name: /sign.*in|log.*in|iniciar.*sesión/i })
    .or(page.locator('button.main-signin-btn'))
    .or(page.locator('button[type="submit"]'));
  
  // Wait for navigation if requested
  if (waitForNavigation) {
    // Wait for navigation after clicking submit
    await Promise.all([
      page.waitForURL(/\/(sign-in|history-execution|dashboard|project-execution)/, { timeout: 15000 }),
      submitButton.click(),
    ]);
  } else {
    await submitButton.click();
  }

  // Verify authentication state if requested
  if (verifyAuth) {
    // Wait a bit for sessionStorage to be updated
    await page.waitForTimeout(1000);

    // Check sessionStorage for authentication token
    const isAuthenticated = await page.evaluate(() => {
      return sessionStorage.getItem('isAuthenticated') === 'true';
    });

    if (!isAuthenticated) {
      throw new Error('Authentication failed: isAuthenticated is not set to true in sessionStorage');
    }

    // Verify token exists
    const token = await page.evaluate(() => {
      return sessionStorage.getItem('token');
    });

    if (!token) {
      throw new Error('Authentication failed: token not found in sessionStorage');
    }

    // Verify we're not on the sign-in page anymore
    const currentUrl = page.url();
    if (currentUrl.includes('/sign-in')) {
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
  return await page.evaluate(() => {
    return sessionStorage.getItem('isAuthenticated') === 'true' &&
           sessionStorage.getItem('token') !== null;
  });
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
  await page.evaluate(() => {
    sessionStorage.setItem('isAuthenticated', 'false');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('userId');
  });

  // Navigate to sign-in if requested
  if (navigateToSignIn) {
    await page.goto('/sign-in');
    await page.waitForLoadState('networkidle');
  }
}
