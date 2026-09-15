import { test as base, expect } from '@playwright/test';
import fs from 'fs';
import { E2E_SKIP_SESSION_AUTH_INJECT_KEY } from './helpers/authInjectSkip';
import { AUTH_FILE } from './helpers/authFile';

/**
 * Extended auth state that includes sessionStorage alongside
 * Playwright's standard cookies + localStorage (origins).
 */
interface AuthState {
  cookies: unknown[];
  origins: unknown[];
  sessionStorage?: Record<string, string>;
}

/**
 * Custom test fixture that injects sessionStorage values into every page.
 *
 * Playwright's built-in `storageState` only restores cookies and localStorage.
 * Since this application stores authentication data in sessionStorage
 * (isAuthenticated, token, userId), we need a custom mechanism to restore it.
 *
 * This fixture reads the auth state saved by auth.setup.ts and uses
 * `context.addInitScript` to inject sessionStorage values before every
 * page load. This means the Vue application sees the auth state immediately
 * on startup, skipping the login flow entirely.
 *
 * Usage: Import `test` and `expect` from this file instead of '@playwright/test'
 *
 * @example
 * ```typescript
 * import { test, expect } from '../../fixtures';
 *
 * test('my authenticated test', async ({ page }) => {
 *   await page.goto('/');
 *   // Page is already authenticated — no login needed
 * });
 * ```
 */
export const test = base.extend({
  context: async ({ context }, use) => {
    if (fs.existsSync(AUTH_FILE)) {
      const authState: AuthState = JSON.parse(
        fs.readFileSync(AUTH_FILE, 'utf-8'),
      );
      const sessionData = authState.sessionStorage || {};

      if (Object.keys(sessionData).length > 0) {
        // Inject sessionStorage values before every page load in this context.
        // The script runs in the browser before any application code executes.
        await context.addInitScript(
          ({
            data,
            skipKey,
          }: {
            data: Record<string, string>;
            skipKey: string;
          }) => {
            try {
              if (window.localStorage.getItem(skipKey) === '1') {
                window.localStorage.removeItem(skipKey);
                return;
              }
            } catch {
              /* ignore */
            }
            for (const [key, value] of Object.entries(data)) {
              window.sessionStorage.setItem(key, value);
            }
          },
          { data: sessionData, skipKey: E2E_SKIP_SESSION_AUTH_INJECT_KEY },
        );
      }
    }

    await use(context);
  },
});

// Re-export expect for convenience so tests only need one import line
export { expect };
