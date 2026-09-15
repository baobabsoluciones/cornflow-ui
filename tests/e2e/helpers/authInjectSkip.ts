import type { Page } from '@playwright/test';

/** localStorage flag read by fixtures.ts init script */
export const E2E_SKIP_SESSION_AUTH_INJECT_KEY = '__e2e_skip_session_auth_inject';

/** Remove skip flag entries from saved Playwright storage state (origins[].localStorage). */
export function stripSkipKeyFromSavedStorageState(state: unknown): boolean {
  if (!state || typeof state !== 'object') return false;
  const origins = (state as { origins?: unknown[] }).origins;
  if (!Array.isArray(origins)) return false;
  let changed = false;
  for (const origin of origins) {
    if (!origin || typeof origin !== 'object') continue;
    const ls = (origin as { localStorage?: { name: string; value: string }[] })
      .localStorage;
    if (!Array.isArray(ls)) continue;
    const next = ls.filter((item) => item?.name !== E2E_SKIP_SESSION_AUTH_INJECT_KEY);
    if (next.length !== ls.length) {
      (origin as { localStorage: typeof next }).localStorage = next;
      changed = true;
    }
  }
  return changed;
}

/**
 * Next full document navigation will NOT inject saved sessionStorage from auth setup.
 * Required before real UI login (cornflowAuth) or after logout → /sign-in; otherwise
 * addInitScript would restore the setup token and invalidate password-change flows.
 */
export async function skipSessionAuthInjectOnNextNavigation(
  page: Page
): Promise<void> {
  const setFlag = async () => {
    await page.evaluate((key) => {
      window.localStorage.setItem(key, '1');
    }, E2E_SKIP_SESSION_AUTH_INJECT_KEY);
  };

  try {
    await setFlag();
  } catch {
    // about:blank (e.g. auth.setup before any navigation) has no accessible localStorage.
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await setFlag();
  }
}
