import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object Model for the Login page
 * Encapsulates selectors and actions related to the login page
 */
export class LoginPage {
  readonly page: Page;
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  readonly signupLink: Locator;
  readonly signupContainer: Locator;

  constructor(page: Page) {
    this.page = page;
    this.usernameInput = page.locator('.username input');
    this.passwordInput = page.locator('.password input');
    this.loginButton = page.locator('.v-card-actions button');
    this.signupLink = page.locator('[data-test="signup-link"]');
    this.signupContainer = page.locator('.v-form').nth(1);
  }

  /**
   * Checks if hash mode is enabled in the application
   * @returns boolean true if hash mode is enabled, false otherwise
   */
  isHashMode(): boolean {
    return process.env.USE_HASH_MODE === 'true';
  }

  /**
   * Navigates to the login page
   */
  async goto() {
    // Check if we need to use hash-based routing
    const hashMode = this.isHashMode();
    
    // Navigate to the appropriate sign-in URL
    if (hashMode) {
      await this.page.goto('/#/sign-in');
    } else {
      await this.page.goto('/sign-in');
    }
    
    await this.page.waitForSelector('.v-card');
  }

  /**
   * Fills in the login form
   * @param username Username to enter
   * @param password Password to enter
   */
  async fillLoginForm(username: string, password: string) {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
  }

  /**
   * Logs in with the given credentials
   * @param username Username to log in with
   * @param password Password to log in with
   */
  async login(username: string, password: string) {
    await this.fillLoginForm(username, password);
    
    const isCornflowAuth = await this.loginButton.isVisible();
    
    if (isCornflowAuth) {
      // For Cornflow auth, click the login button
      await this.loginButton.click();
    } else {
      // For external auth, press Enter on the password field
      await this.passwordInput.press('Enter');
    }
    
    // Wait for navigation to complete
    await this.page.waitForURL('/**/*');
  }

  /**
   * Attempts to log in and expects an error
   * @param username Username to log in with
   * @param password Password to log in with
   */
  async expectLoginError(username: string, password: string) {
    await this.fillLoginForm(username, password);
    
    const isCornflowAuth = await this.loginButton.isVisible();
    if (isCornflowAuth) {
      await this.loginButton.click();
      
      // Check for error message
      await expect(this.page.locator('.v-snackbar')).toBeVisible();
      
      // Verify we're still on the login page
      await expect(this.page).toHaveURL(/sign-in/);
    }
  }

  /**
   * Switches to signup mode
   */
  async goToSignup() {
    const isCornflowAuth = await this.loginButton.isVisible();
    if (isCornflowAuth) {
      await this.signupLink.click();
      await expect(this.signupContainer).toBeVisible();
    }
  }

  /**
   * Checks whether we're using Cornflow auth
   * @returns True if using Cornflow auth, false otherwise
   */
  async isCornflowAuth(): Promise<boolean> {
    return await this.loginButton.isVisible();
  }
} 