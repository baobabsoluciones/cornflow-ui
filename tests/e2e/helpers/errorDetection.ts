import { Page } from '@playwright/test';
import { SELECTORS, TIMEOUTS } from './constants';

/**
 * Helper functions for error detection during authentication
 */

export interface ErrorDetectionResult {
  hasError: boolean;
  errorMessage: string | null;
}

/**
 * Set up error detection listeners for console and network errors
 * 
 * @param page - Playwright Page object
 * @returns Object with cleanup function and error message getter
 */
export function setupErrorDetection(page: Page): {
  getError: () => string | null;
  cleanup: () => void;
} {
  let errorMessage: string | null = null;

  const consoleHandler = (msg: any) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (text.includes('Error') || text.includes('error') || text.includes('failed')) {
        errorMessage = text;
      }
    }
  };

  const responseHandler = (response: any) => {
    if (response.url().includes('/login/') && !response.ok()) {
      errorMessage = `Login request failed with status ${response.status()}`;
    }
  };

  page.on('console', consoleHandler);
  page.on('response', responseHandler);

  return {
    getError: () => errorMessage,
    cleanup: () => {
      page.off('console', consoleHandler);
      page.off('response', responseHandler);
    },
  };
}

/**
 * Check for error snackbar messages
 * Note: This function does NOT wait - it checks immediately.
 * Wait should be done before calling this function if needed.
 * 
 * @param page - Playwright Page object
 * @returns ErrorDetectionResult with error information
 */
export async function checkErrorSnackbar(
  page: Page
): Promise<ErrorDetectionResult> {
  const snackbar = page
    .locator(SELECTORS.ERROR_SNACKBAR)
    .filter({ hasText: /error|Error|servidor|server/i });
  
  const snackbarVisible = await snackbar.isVisible().catch(() => false);
  
  if (snackbarVisible) {
    const snackbarText = await snackbar.textContent().catch(() => '');
    return {
      hasError: true,
      errorMessage: snackbarText || 'Error message detected in snackbar',
    };
  }
  
  return {
    hasError: false,
    errorMessage: null,
  };
}

/**
 * Get comprehensive error information including URL and backend config
 * 
 * @param page - Playwright Page object
 * @param baseErrorMessage - Base error message to include
 * @returns Detailed error message with context for debugging
 */
export async function getDetailedErrorMessage(
  page: Page,
  baseErrorMessage: string
): Promise<string> {
  const currentUrl = page.url();
  
  const backendUrl = await page
    .evaluate(() => {
      return (window as any).__config?.backend || 'not found';
    })
    .catch(() => 'not found');
  
  return [
    baseErrorMessage,
    `Current URL: ${currentUrl}`,
    `Backend URL from config: ${backendUrl}`,
    'Please verify that VITE_APP_BACKEND_URL is correctly set in your .env.test file.',
  ].join('. ');
}
