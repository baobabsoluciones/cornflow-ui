import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/login-page';
import { mockLoginApi } from './auth-utils';

/**
 * Check if hash mode is enabled in the application
 * @returns boolean true if hash mode is enabled, false otherwise
 */
function isHashMode(): boolean {
  return process.env.USE_HASH_MODE === 'true';
}

/**
 * E2E test for the login flow
 * 
 * Tests the following:
 * 1. Navigate to the login page
 * 2. Fill in username and password
 * 3. Submit form
 * 4. Verify successful redirect and welcome message
 */
test.describe('Login flow', () => {
  
  // Get test credentials from environment variables or use test defaults
  const testUsername = process.env.TEST_USERNAME || 'test_user';
  const testPassword = process.env.TEST_PASSWORD || 'test_password';
  
  // Setup test hook
  test.beforeEach(async ({ page, context }) => {
    // Clear session storage and cookies between tests
    await context.clearCookies();
    
    // Create page object
    const loginPage = new LoginPage(page);
    
    // Go to login page
    await loginPage.goto();
  });
  
  test('should display login form', async ({ page }) => {
    const loginPage = new LoginPage(page);
    
    // Verify username and password fields are visible
    await expect(loginPage.usernameInput).toBeVisible();
    await expect(loginPage.passwordInput).toBeVisible();
    
    // Verify submit button is visible (only when Cornflow auth is used)
    const isCornflowAuth = await loginPage.isCornflowAuth();
    if (isCornflowAuth) {
      await expect(loginPage.loginButton).toBeVisible();
    }
  });
  
  test('should show error for incorrect credentials', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const isCornflowAuth = await loginPage.isCornflowAuth();
    
    // Skip test if not using Cornflow auth
    test.skip(!isCornflowAuth, 'Test only applicable for Cornflow auth');
    
    if (isCornflowAuth) {
      // Attempt login with invalid credentials and expect error
      await loginPage.expectLoginError('invalid_user', 'invalid_password');
    }
  });
  
  test('should login successfully with valid credentials', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const isCornflowAuth = await loginPage.isCornflowAuth();
    
    // Skip test if not using Cornflow auth
    test.skip(!isCornflowAuth, 'Test only applicable for Cornflow auth');
    
    // Skip test if test credentials are not provided in a real CI environment
    test.skip(
      process.env.CI === 'true' && 
      (process.env.TEST_USERNAME === undefined || process.env.TEST_PASSWORD === undefined),
      'Test credentials not provided'
    );
    
    // Mock successful API response to avoid actual network request
    await mockLoginApi(page);
    
    if (isCornflowAuth) {
      // Get hash mode setting from environment
      const hashMode = isHashMode();
      
      // Login with valid credentials
      await loginPage.login(testUsername, testPassword);
      
      // Verify we're redirected to project-execution with correct URL format
      if (hashMode) {
        await expect(page).toHaveURL(/\/#\/project-execution$/);
      } else {
        await expect(page).toHaveURL(/\/project-execution$/);
      }
      
      // Verify authentication data is stored in sessionStorage
      const isAuthenticated = await page.evaluate(() => {
        return sessionStorage.getItem('isAuthenticated');
      });
      
      expect(isAuthenticated).toBe('true');
    }
  });
  
  test('should login using Enter key', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const isCornflowAuth = await loginPage.isCornflowAuth();
    
    // Skip test if not using Cornflow auth
    test.skip(!isCornflowAuth, 'Test only applicable for Cornflow auth');
    
    // Skip test if test credentials are not provided in a real CI environment
    test.skip(
      process.env.CI === 'true' && 
      (process.env.TEST_USERNAME === undefined || process.env.TEST_PASSWORD === undefined),
      'Test credentials not provided'
    );
    
    // Mock successful API response
    await mockLoginApi(page);
    
    if (isCornflowAuth) {
      // Get hash mode setting from environment
      const hashMode = isHashMode();
      
      // Fill in valid credentials
      await loginPage.fillLoginForm(testUsername, testPassword);
      
      // Press Enter key on password field
      await loginPage.passwordInput.press('Enter');
      
      // Wait for redirection
      await page.waitForURL('/**/*');
      
      // Verify we're redirected to project-execution with correct URL format
      if (hashMode) {
        await expect(page).toHaveURL(/\/#\/project-execution$/);
      } else {
        await expect(page).toHaveURL(/\/project-execution$/);
      }
    }
  });
}); 