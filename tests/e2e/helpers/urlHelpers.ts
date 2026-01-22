import { Page } from '@playwright/test';

/**
 * Helper functions for URL verification in hash mode routing
 * 
 * Note: This application uses Vue Router in hash mode, where routes are in the URL hash (e.g., #/dashboard)
 * rather than the pathname. The pathname may remain /sign-in even after successful login.
 */

/**
 * Check if the current URL is on a protected route (not sign-in)
 * In hash mode, the pathname may still be /sign-in, but the hash should contain a protected route
 * 
 * @param page - Playwright Page object
 * @returns true if on a protected route, false otherwise
 */
export function isOnProtectedRoute(page: Page): boolean {
  const url = new URL(page.url());
  const hash = url.hash;
  
  // Empty or missing hash means not on a protected route
  if (!hash || hash === '' || hash === '#') {
    return false;
  }
  
  // Hash containing '/sign-in' means still on sign-in page
  if (hash.includes('/sign-in')) {
    return false;
  }
  
  // Non-empty hash without '/sign-in' means on a protected route
  return true;
}

/**
 * Check if the current URL is on the sign-in page
 * In hash mode, checks both pathname and hash
 * 
 * @param page - Playwright Page object
 * @returns true if on sign-in page, false otherwise
 */
export function isOnSignInPage(page: Page): boolean {
  const url = new URL(page.url());
  
  // Must have /sign-in in pathname
  if (!url.pathname.includes('/sign-in')) {
    return false;
  }
  
  // In hash mode, check hash to confirm we're still on sign-in
  const hash = url.hash;
  return !hash || hash === '' || hash === '#' || hash.includes('/sign-in');
}

/**
 * Get the hash route from the current URL
 * 
 * @param page - Playwright Page object
 * @returns The hash route (e.g., '#/history-execution') or empty string
 */
export function getHashRoute(page: Page): string {
  return new URL(page.url()).hash || '';
}

/**
 * Check if the current URL's hash matches one of the provided routes
 * 
 * @param page - Playwright Page object
 * @param routes - Array of routes to check against (e.g., ['/history-execution', '/dashboard'])
 * @returns true if hash matches any of the routes, false otherwise
 */
export function isHashRoute(page: Page, routes: readonly string[]): boolean {
  const hash = getHashRoute(page);
  
  if (!hash || hash === '' || hash === '#') {
    return false;
  }
  
  return routes.some((route) => hash.includes(route));
}

/**
 * Wait for URL to change to a protected route (not sign-in)
 * In hash mode, waits for the hash to change to a non-sign-in route
 * 
 * @param page - Playwright Page object
 * @param timeout - Maximum time to wait (default: 20000ms)
 * @returns Promise that resolves when on a protected route
 */
export async function waitForProtectedRoute(
  page: Page,
  timeout: number = 20000
): Promise<void> {
  await page.waitForURL(
    (url) => {
      const hash = url.hash;
      return hash !== '' && !hash.includes('/sign-in');
    },
    { timeout }
  );
}
