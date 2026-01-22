import { Page } from '@playwright/test';
import { SESSION_STORAGE_KEYS } from './constants';

/**
 * Helper functions for sessionStorage verification
 */

export interface SessionStorageAuth {
  isAuthenticated: string | null;
  token: string | null;
  userId: string | null;
}

/**
 * Get all authentication-related sessionStorage values
 * 
 * @param page - Playwright Page object
 * @returns Object containing authentication sessionStorage values
 */
export async function getAuthSessionStorage(
  page: Page
): Promise<SessionStorageAuth> {
  return await page.evaluate((keys) => {
    return {
      isAuthenticated: sessionStorage.getItem(keys.IS_AUTHENTICATED),
      token: sessionStorage.getItem(keys.TOKEN),
      userId: sessionStorage.getItem(keys.USER_ID),
    };
  }, SESSION_STORAGE_KEYS);
}

/**
 * Check if the user is authenticated based on sessionStorage
 * 
 * @param page - Playwright Page object
 * @returns true if authenticated, false otherwise
 */
export async function isAuthenticatedInSessionStorage(
  page: Page
): Promise<boolean> {
  const auth = await getAuthSessionStorage(page);
  return auth.isAuthenticated === 'true' && auth.token !== null;
}

/**
 * Wait for authentication to be set in sessionStorage
 * Polls sessionStorage until authentication is complete or timeout
 * 
 * @param page - Playwright Page object
 * @param timeout - Maximum time to wait in milliseconds (default: 15000ms)
 * @param pollInterval - Interval between polls in milliseconds (default: 500ms)
 * @returns Promise that resolves when authenticated, or rejects on timeout
 */
export async function waitForAuthentication(
  page: Page,
  timeout: number = 15000,
  pollInterval: number = 500
): Promise<void> {
  const startTime = Date.now();
  const maxAttempts = Math.ceil(timeout / pollInterval);
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    const isAuthenticated = await isAuthenticatedInSessionStorage(page);
    
    if (isAuthenticated) {
      return;
    }
    
    // Check timeout
    if (Date.now() - startTime >= timeout) {
      const auth = await getAuthSessionStorage(page);
      throw new Error(
        `Authentication timeout: isAuthenticated is not set to true in sessionStorage. ` +
        `SessionStorage: ${JSON.stringify(auth)}`
      );
    }
    
    await page.waitForTimeout(pollInterval);
    attempts++;
  }
  
  // Final check
  const auth = await getAuthSessionStorage(page);
  throw new Error(
    `Authentication failed: isAuthenticated is not set to true in sessionStorage. ` +
    `SessionStorage: ${JSON.stringify(auth)}`
  );
}

/**
 * Verify that authentication data exists in sessionStorage
 * 
 * @param page - Playwright Page object
 * @throws Error if authentication data is missing or invalid
 */
export async function verifyAuthSessionStorage(page: Page): Promise<void> {
  const auth = await getAuthSessionStorage(page);
  
  if (auth.isAuthenticated !== 'true') {
    throw new Error(
      `Authentication failed: isAuthenticated is not 'true'. ` +
      `SessionStorage: ${JSON.stringify(auth)}`
    );
  }
  
  if (!auth.token || auth.token.length === 0) {
    throw new Error(
      `Authentication failed: token not found or empty in sessionStorage. ` +
      `SessionStorage: ${JSON.stringify(auth)}`
    );
  }
}
