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
  
  // Wait for the form container to be visible
  await page.waitForSelector('.login-form', { timeout: 10000 });

  // Wait a bit more to ensure the application is fully initialized
  // This gives time for config.initConfig() to complete
  await page.waitForTimeout(1000);

  // Find and fill username field
  // Try multiple selectors to find the username input
  const usernameInput = page.locator('input[type="text"]').first();
  await usernameInput.waitFor({ state: 'visible', timeout: 10000 });
  await usernameInput.fill(testUsername);
  
  // Wait a bit to ensure the value is set
  await page.waitForTimeout(200);

  // Find and fill password field
  const passwordInput = page.locator('input[type="password"]');
  await passwordInput.waitFor({ state: 'visible', timeout: 10000 });
  await passwordInput.fill(testPassword);
  
  // Wait a bit to ensure the value is set
  await page.waitForTimeout(200);

  // Find and click the submit button
  // Use the class selector first as it's the most reliable
  const submitButton = page.locator('button.main-signin-btn');
  await submitButton.waitFor({ state: 'visible', timeout: 10000 });
  
  // Wait for button to be enabled (not disabled)
  await expect(submitButton).toBeEnabled({ timeout: 5000 });
  
  // Set up error detection before clicking submit
  let errorMessage: string | null = null;
  const consoleHandler = (msg: any) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (text.includes('Error') || text.includes('error') || text.includes('failed')) {
        errorMessage = text;
      }
    }
  };
  page.on('console', consoleHandler);

  // Also listen for network failures
  const responseHandler = (response: any) => {
    if (response.url().includes('/login/') && !response.ok()) {
      errorMessage = `Login request failed with status ${response.status()}`;
    }
  };
  page.on('response', responseHandler);

  // Wait for navigation if requested
  if (waitForNavigation) {
    // Wait for navigation after clicking submit
    // In hash mode, the pathname doesn't change, but the hash does
    // The URL should change from /sign-in to /sign-in#/history-execution (or similar)
    // Also wait for network to be idle to ensure the login request completes
    try {
      await Promise.all([
        page.waitForURL((url) => {
          // In hash mode, check if hash exists and doesn't contain '/sign-in'
          // The hash should be something like '#/history-execution' after login
          const hash = url.hash;
          return hash !== '' && !hash.includes('/sign-in');
        }, { timeout: 20000 }),
        page.waitForLoadState('networkidle').catch(() => {}), // Don't fail if networkidle doesn't happen
        submitButton.click(),
      ]);
    } catch (error) {
      // Check for error snackbar message
      const snackbar = page.locator('.v-snackbar').filter({ hasText: /error|Error|servidor|server/i });
      const snackbarVisible = await snackbar.isVisible().catch(() => false);
      
      if (snackbarVisible) {
        const snackbarText = await snackbar.textContent().catch(() => '');
        errorMessage = snackbarText || 'Error message detected in snackbar';
      }
      
      // Clean up listeners
      page.off('console', consoleHandler);
      page.off('response', responseHandler);
      
      // Get more context for debugging
      const currentUrl = page.url();
      const networkErrors = await page.evaluate(() => {
        return (window as any).__playwrightNetworkErrors || [];
      }).catch(() => []);
      
      throw new Error(
        `Login failed: ${errorMessage || error instanceof Error ? error.message : String(error)}. ` +
        `Current URL: ${currentUrl}. ` +
        `Network errors: ${JSON.stringify(networkErrors)}`
      );
    }
  } else {
    await submitButton.click();
  }

  // Clean up listeners
  page.off('console', consoleHandler);
  page.off('response', responseHandler);

  // Check for error snackbar after a short delay
  await page.waitForTimeout(2000);
  const snackbar = page.locator('.v-snackbar').filter({ hasText: /error|Error|servidor|server/i });
  const snackbarVisible = await snackbar.isVisible().catch(() => false);
  
  if (snackbarVisible) {
    const snackbarText = await snackbar.textContent().catch(() => '');
    const currentUrl = page.url();
    const backendUrl = await page.evaluate(() => {
      return (window as any).__config?.backend || 'not found';
    }).catch(() => 'not found');
    
    throw new Error(
      `Login failed: Error snackbar detected - "${snackbarText}". ` +
      `Current URL: ${currentUrl}. ` +
      `Backend URL from config: ${backendUrl}. ` +
      `Please verify that VITE_APP_BACKEND_URL is correctly set in your .env.test file.`
    );
  }

  // Verify authentication state if requested
  if (verifyAuth) {
    // Wait for sessionStorage to be updated with a more robust approach
    // Poll sessionStorage until authentication is complete or timeout
    let attempts = 0;
    const maxAttempts = 30; // 30 attempts * 500ms = 15 seconds max
    let isAuthenticated = false;
    
    while (attempts < maxAttempts && !isAuthenticated) {
      await page.waitForTimeout(500);
      isAuthenticated = await page.evaluate(() => {
        return sessionStorage.getItem('isAuthenticated') === 'true';
      });
      attempts++;
    }

    if (!isAuthenticated) {
      // Get more debug information
      const currentUrl = page.url();
      const sessionStorageContent = await page.evaluate(() => {
        return {
          isAuthenticated: sessionStorage.getItem('isAuthenticated'),
          token: sessionStorage.getItem('token') ? 'present' : 'missing',
          userId: sessionStorage.getItem('userId'),
        };
      });
      
      throw new Error(
        `Authentication failed: isAuthenticated is not set to true in sessionStorage. ` +
        `Current URL: ${currentUrl}, ` +
        `SessionStorage: ${JSON.stringify(sessionStorageContent)}`
      );
    }

    // Verify token exists
    const token = await page.evaluate(() => {
      return sessionStorage.getItem('token');
    });

    if (!token) {
      throw new Error('Authentication failed: token not found in sessionStorage');
    }

    // Verify we're not on the sign-in page anymore
    // In hash mode, the pathname may still be /sign-in, but the hash should have changed
    const currentUrl = page.url();
    const url = new URL(currentUrl);
    // Check if we're still on sign-in without a valid hash route
    if (url.pathname.includes('/sign-in') && (!url.hash || url.hash === '' || url.hash === '#')) {
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
