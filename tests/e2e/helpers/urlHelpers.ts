import { Page } from '@playwright/test';

/**
 * Helper functions for URL verification in hash mode routing
 */

/**
 * Check if the current URL is on a protected route (not sign-in)
 * In hash mode, the pathname may still be /sign-in, but the hash should contain a protected route
 * 
 * @param page - Playwright Page object
 * @returns true if on a protected route, false otherwise
 */
export function isOnProtectedRoute(page: Page): boolean {
  const currentUrl = page.url();
  const url = new URL(currentUrl);
  
  // In hash mode, check the hash instead of the pathname
  const hash = url.hash;
  
  // If no hash or empty hash, we're not on a protected route
  if (!hash || hash === '' || hash === '#') {
    return false;
  }
  
  // If hash contains '/sign-in', we're still on sign-in
  if (hash.includes('/sign-in')) {
    return false;
  }
  
  // If we have a non-empty hash that doesn't contain '/sign-in', we're on a protected route
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
  const currentUrl = page.url();
  const url = new URL(currentUrl);
  
  // Check if pathname is /sign-in
  if (url.pathname.includes('/sign-in')) {
    // In hash mode, if hash is empty or just '#', we're still on sign-in
    const hash = url.hash;
    if (!hash || hash === '' || hash === '#') {
      return true;
    }
    // If hash contains '/sign-in', we're still on sign-in
    if (hash.includes('/sign-in')) {
      return true;
    }
  }
  
  return false;
}

/**
 * Get the hash route from the current URL
 * 
 * @param page - Playwright Page object
 * @returns The hash route (e.g., '#/history-execution') or empty string
 */
export function getHashRoute(page: Page): string {
  const currentUrl = page.url();
  const url = new URL(currentUrl);
  return url.hash || '';
}

/**
 * Check if the current URL's hash matches one of the provided routes
 * 
 * @param page - Playwright Page object
 * @param routes - Array of routes to check against
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
