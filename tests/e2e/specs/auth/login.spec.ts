import { test, expect, Page } from '@playwright/test';
import { authenticate, isAuthenticated, logout } from '../../helpers/auth/index';
import { isOnProtectedRoute, isHashRoute, getHashRoute } from '../../helpers/urlHelpers';
import { getAuthSessionStorage } from '../../helpers/sessionStorageHelpers';
import { PROTECTED_ROUTES } from '../../helpers/constants';

/**
 * Helper to verify that hash route is valid (not empty and not sign-in)
 */
function expectValidHashRoute(page: Page): void {
  const hash = getHashRoute(page);
  expect(hash).toBeTruthy();
  expect(hash).not.toBe('');
  expect(hash).not.toBe('#');
  expect(hash).not.toContain('/sign-in');
}

/**
 * Helper to verify authentication state is false
 */
async function expectNotAuthenticated(page: Page): Promise<void> {
  expect(await isAuthenticated(page)).toBe(false);
  const auth = await getAuthSessionStorage(page);
  expect(auth.isAuthenticated).not.toBe('true');
  expect(auth.token).toBeNull();
}

/**
 * Helper to verify authentication state is true
 */
async function expectAuthenticated(page: Page): Promise<void> {
  expect(await isAuthenticated(page)).toBe(true);
  const auth = await getAuthSessionStorage(page);
  expect(auth.token).toBeTruthy();
  expect(auth.token?.length).toBeGreaterThan(0);
  expect(auth.isAuthenticated).toBe('true');
}

/**
 * Helper to attempt authentication and capture errors
 */
async function attemptAuthWithError(
  page: Page,
  username: string,
  password: string
): Promise<Error | null> {
  try {
    await authenticate(page, username, password);
    return null;
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error));
  }
}

/**
 * Authentication tests
 * 
 * These tests verify that the authentication helpers work correctly
 * and that users can successfully log in to the application.
 */
test.describe('Authentication', () => {
  test('should successfully login with valid credentials', async ({ page }) => {
    await page.goto('/sign-in');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/sign-in/);

    await authenticate(page);

    // Verify authentication state
    await expectAuthenticated(page);

    // Verify navigation to protected route
    expect(isOnProtectedRoute(page)).toBe(true);
    expectValidHashRoute(page);
  });

  test('should redirect to protected route after login', async ({ page }) => {
    await authenticate(page);

    // Verify navigation to protected route
    expect(isOnProtectedRoute(page)).toBe(true);
    expectValidHashRoute(page);
    expect(isHashRoute(page, PROTECTED_ROUTES)).toBe(true);
  });

  test('should fail login with invalid credentials', async ({ page }) => {
    await page.goto('/sign-in');
    await page.waitForLoadState('networkidle');

    const authError = await attemptAuthWithError(page, 'invalid_user', 'invalid_password');

    // Verify authentication failed
    expect(authError).not.toBeNull();
    expect(authError?.message).toBeTruthy();

    // Verify still on sign-in page and not authenticated
    expect(isOnProtectedRoute(page)).toBe(false);
    await expectNotAuthenticated(page);
  });

  test('should fail login with empty credentials', async ({ page }) => {
    await page.goto('/sign-in');
    await page.waitForLoadState('networkidle');

    const authError = await attemptAuthWithError(page, '', '');

    // Verify authentication failed with expected error message
    expect(authError).not.toBeNull();
    expect(authError?.message).toContain('Username and password are required');
  });

  test('should logout successfully', async ({ page }) => {
    await authenticate(page);
    await expectAuthenticated(page);
    expect(isOnProtectedRoute(page)).toBe(true);

    await logout(page);

    // Verify logout: on sign-in page and not authenticated
    await expect(page).toHaveURL(/\/sign-in/);
    await expectNotAuthenticated(page);
  });

  test('should redirect to sign-in when accessing protected route without authentication', async ({ page }) => {
    await page.goto('/history-execution');
    await page.waitForLoadState('networkidle');

    // Should be redirected to sign-in
    await expect(page).toHaveURL(/\/sign-in/);
    await expectNotAuthenticated(page);
  });

  test('should maintain authentication state across page reloads', async ({ page }) => {
    await authenticate(page);
    await expectAuthenticated(page);
    
    const authBeforeReload = await getAuthSessionStorage(page);

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify authentication persists after reload
    await expectAuthenticated(page);
    const authAfterReload = await getAuthSessionStorage(page);
    
    // Verify sessionStorage data is preserved
    expect(authAfterReload.token).toBe(authBeforeReload.token);
    expect(authAfterReload.isAuthenticated).toBe(authBeforeReload.isAuthenticated);
    expect(authAfterReload.userId).toBe(authBeforeReload.userId);
  });
});
