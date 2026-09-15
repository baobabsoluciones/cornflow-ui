import { Page } from '@playwright/test';
import { cornflowAuth, isAuthenticated as cornflowIsAuthenticated, logout as cornflowLogout } from './cornflowAuth';

/**
 * Authentication factory that selects the appropriate authentication method
 * based on the PLAYWRIGHT_AUTH_TYPE environment variable.
 * 
 * Supported authentication types:
 * - 'cornflow': Username/password login (default)
 * - 'azure': Azure AD OAuth authentication (not yet implemented)
 * - 'cognito': AWS Cognito OAuth authentication (not yet implemented)
 * 
 * @param page - Playwright Page object
 * @param username - Optional username (for cornflow auth)
 * @param password - Optional password (for cornflow auth)
 * @param options - Optional configuration options
 * @returns Promise that resolves when authentication is complete
 * 
 * @example
 * ```typescript
 * import { test } from '@playwright/test';
 * import { authenticate } from '@/helpers/auth';
 * 
 * test('my test', async ({ page }) => {
 *   await authenticate(page);
 *   // User is now authenticated, continue with test...
 * });
 * ```
 */
export async function authenticate(
  page: Page,
  username?: string,
  password?: string,
  options: {
    waitForNavigation?: boolean;
    verifyAuth?: boolean;
  } = {}
): Promise<void> {
  const authType = (process.env.PLAYWRIGHT_AUTH_TYPE || 'cornflow').toLowerCase();

  switch (authType) {
    case 'cornflow':
      return await cornflowAuth(page, username, password, options);
    
    case 'azure':
      throw new Error(
        'Azure AD authentication is not yet implemented. ' +
        'Please implement azureAuth.ts helper or use cornflow authentication.'
      );
    
    case 'cognito':
      throw new Error(
        'AWS Cognito authentication is not yet implemented. ' +
        'Please implement cognitoAuth.ts helper or use cornflow authentication.'
      );
    
    default:
      throw new Error(
        `Unknown authentication type: ${authType}. ` +
        `Supported types are: cornflow, azure, cognito. ` +
        `Set PLAYWRIGHT_AUTH_TYPE environment variable to configure.`
      );
  }
}

/**
 * Check if the user is currently authenticated
 * 
 * @param page - Playwright Page object
 * @returns Promise<boolean> - true if authenticated, false otherwise
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  const authType = (process.env.PLAYWRIGHT_AUTH_TYPE || 'cornflow').toLowerCase();

  switch (authType) {
    case 'cornflow':
      return await cornflowIsAuthenticated(page);
    
    case 'azure':
    case 'cognito':
      throw new Error(
        `Authentication check for ${authType} is not yet implemented. ` +
        'Please implement the corresponding auth helper.'
      );
    
    default:
      throw new Error(`Unknown authentication type: ${authType}`);
  }
}

/**
 * Logout the current user
 * 
 * @param page - Playwright Page object
 * @param navigateToSignIn - Whether to navigate to sign-in page after logout (default: true)
 */
export async function logout(
  page: Page,
  navigateToSignIn: boolean = true
): Promise<void> {
  const authType = (process.env.PLAYWRIGHT_AUTH_TYPE || 'cornflow').toLowerCase();

  switch (authType) {
    case 'cornflow':
      return await cornflowLogout(page, navigateToSignIn);
    
    case 'azure':
    case 'cognito':
      throw new Error(
        `Logout for ${authType} is not yet implemented. ` +
        'Please implement the corresponding auth helper.'
      );
    
    default:
      throw new Error(`Unknown authentication type: ${authType}`);
  }
}

// Re-export cornflow auth functions for direct use
export { cornflowAuth, isAuthenticated as cornflowIsAuthenticated, logout as cornflowLogout } from './cornflowAuth';

// Export types for future auth helpers
export type AuthOptions = {
  waitForNavigation?: boolean;
  verifyAuth?: boolean;
};
