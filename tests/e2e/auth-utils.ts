import { Page } from '@playwright/test';

/**
 * Authentication helper functions for Playwright tests
 */

/**
 * Checks if hash mode is enabled in the application
 * @returns boolean true if hash mode is enabled, false otherwise
 */
function isHashMode(): boolean {
  return process.env.USE_HASH_MODE === 'true';
}

/**
 * Performs login via UI
 * @param page Playwright page object
 * @param username Username to login with
 * @param password Password to login with
 */
export async function loginViaUI(page: Page, username: string, password: string): Promise<void> {
  const useHashMode = isHashMode();
  
  // Navigate to login page with appropriate routing
  if (useHashMode) {
    await page.goto('/#/sign-in');
  } else {
    await page.goto('/sign-in');
  }
  
  // Wait for login form to be fully loaded
  await page.waitForSelector('.v-card');
  
  // Fill in username field
  await page.locator('.username input').fill(username);
  
  // Fill in password field
  await page.locator('.password input').fill(password);
  
  // Check if we're using Cornflow auth (which has a submit button)
  const loginButton = page.locator('.v-card-actions button');
  if (await loginButton.isVisible()) {
    // Click submit button
    await loginButton.click();
  } else {
    // For external auth providers, just press Enter
    await page.locator('.password input').press('Enter');
  }
  
  // Wait for navigation to complete
  await page.waitForURL('/**/*');
}

/**
 * Sets up authentication data in session storage to bypass login UI
 * @param page Playwright page object
 * @param options Authentication options
 */
export async function setupSessionAuth(
  page: Page, 
  options: { 
    token?: string; 
    userId?: string;
    username?: string;
    name?: string;
    email?: string;
  } = {}
): Promise<void> {
  const token = options.token || 'fake-token-for-testing';
  const userId = options.userId || '123';
  const username = options.username || 'test_user';
  const name = options.name || 'Test User';
  const email = options.email || 'test@example.com';
  
  // First navigate to a page to set up the session storage
  await page.goto('/');
  
  await page.evaluate(({ token, userId, username, name, email }) => {
    // Set authentication values in sessionStorage
    sessionStorage.setItem('isAuthenticated', 'true');
    sessionStorage.setItem('token', token);
    sessionStorage.setItem('userId', userId);
    sessionStorage.setItem('username', username);
    sessionStorage.setItem('name', name);
    sessionStorage.setItem('email', email);
    
  }, { token, userId, username, name, email });
  
  // Use the correct routing based on hash mode
  const useHashMode = isHashMode();
  
  // Go to home page with appropriate routing
  if (useHashMode) {
    await page.goto('/#/');
  } else {
    await page.goto('/');
  }
}

/**
 * Mocks the login API call to return a successful response
 * @param page Playwright page object
 */
export async function mockLoginApi(page: Page): Promise<void> {
  await page.route('/login/', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        token: 'fake-token-for-testing',
        id: '123',
      }),
    });
  });
}

/**
 * Clears authentication data
 * @param page Playwright page object
 */
export async function clearAuth(page: Page): Promise<void> {
  await page.evaluate(() => {
    sessionStorage.clear();
  });
} 