import { test, expect } from '@playwright/test';
import { authenticate, isAuthenticated, logout } from '../../helpers/auth/index';
import { isOnProtectedRoute, isHashRoute, getHashRoute } from '../../helpers/urlHelpers';
import { getAuthSessionStorage, verifyAuthSessionStorage } from '../../helpers/sessionStorageHelpers';
import { PROTECTED_ROUTES } from '../../helpers/constants';

/**
 * Authentication tests
 * 
 * These tests verify that the authentication helpers work correctly
 * and that users can successfully log in to the application.
 */
test.describe('Authentication', () => {
  test('should successfully login with valid credentials', async ({ page }) => {
    // Navigate to sign-in page
    await page.goto('/sign-in');
    await page.waitForLoadState('networkidle');

    // Verify we're on the sign-in page
    await expect(page).toHaveURL(/\/sign-in/);

    // Authenticate using the helper
    await authenticate(page);

    // Verify that the user is authenticated
    const authenticated = await isAuthenticated(page);
    expect(authenticated).toBe(true);

    // Verify that we're no longer on the sign-in page
    // (should have been redirected to a protected route)
    expect(isOnProtectedRoute(page)).toBe(true);

    // Verify hash route is valid
    const hash = getHashRoute(page);
    expect(hash).toBeTruthy();
    expect(hash).not.toBe('');
    expect(hash).not.toBe('#');
    expect(hash).not.toContain('/sign-in');

    // Verify that sessionStorage contains authentication data
    const auth = await getAuthSessionStorage(page);
    expect(auth.token).toBeTruthy();
    expect(auth.token?.length).toBeGreaterThan(0);
    expect(auth.isAuthenticated).toBe('true');
  });

  test('should redirect to protected route after login', async ({ page }) => {
    // Authenticate
    await authenticate(page);

    // Verify we're on a protected route (not sign-in)
    expect(isOnProtectedRoute(page)).toBe(true);

    // Verify hash route is valid
    const hash = getHashRoute(page);
    expect(hash).toBeTruthy();
    expect(hash).not.toBe('');
    expect(hash).not.toBe('#');
    expect(hash).not.toContain('/sign-in');

    // Check if we're on one of the expected protected routes
    expect(isHashRoute(page, PROTECTED_ROUTES)).toBe(true);
  });

  test('should fail login with invalid credentials', async ({ page }) => {
    await page.goto('/sign-in');
    await page.waitForLoadState('networkidle');

    // Try to authenticate with invalid credentials
    let authError: Error | null = null;
    try {
      await authenticate(page, 'invalid_user', 'invalid_password');
    } catch (error) {
      authError = error instanceof Error ? error : new Error(String(error));
    }

    // Verify that authentication failed
    expect(authError).not.toBeNull();
    expect(authError?.message).toBeTruthy();

    // Verify we're still on the sign-in page
    expect(isOnProtectedRoute(page)).toBe(false);

    // Verify user is not authenticated
    const authenticated = await isAuthenticated(page);
    expect(authenticated).toBe(false);

    // Verify sessionStorage does not contain authentication data
    const auth = await getAuthSessionStorage(page);
    expect(auth.isAuthenticated).not.toBe('true');
    expect(auth.token).toBeNull();
  });

  test('should fail login with empty credentials', async ({ page }) => {
    await page.goto('/sign-in');
    await page.waitForLoadState('networkidle');

    // Try to authenticate with empty credentials
    let authError: Error | null = null;
    try {
      await authenticate(page, '', '');
    } catch (error) {
      authError = error instanceof Error ? error : new Error(String(error));
    }

    // Verify that authentication failed with the expected error message
    expect(authError).not.toBeNull();
    expect(authError?.message).toContain('Username and password are required');
  });

  test('should logout successfully', async ({ page }) => {
    // First, authenticate
    await authenticate(page);
    
    // Verify we're authenticated
    expect(await isAuthenticated(page)).toBe(true);
    expect(isOnProtectedRoute(page)).toBe(true);

    // Logout
    await logout(page);

    // Verify we're on the sign-in page
    await expect(page).toHaveURL(/\/sign-in/);

    // Verify user is not authenticated
    expect(await isAuthenticated(page)).toBe(false);

    // Verify sessionStorage is cleared
    const auth = await getAuthSessionStorage(page);
    expect(auth.isAuthenticated).not.toBe('true');
    expect(auth.token).toBeNull();
  });

  test('should redirect to sign-in when accessing protected route without authentication', async ({ page }) => {
    // Try to access a protected route without authentication
    await page.goto('/history-execution');
    await page.waitForLoadState('networkidle');

    // Should be redirected to sign-in
    await expect(page).toHaveURL(/\/sign-in/);

    // Verify user is not authenticated
    expect(await isAuthenticated(page)).toBe(false);
  });

  test('should maintain authentication state across page reloads', async ({ page }) => {
    // Authenticate
    await authenticate(page);
    
    // Verify authentication
    expect(await isAuthenticated(page)).toBe(true);
    const authBeforeReload = await getAuthSessionStorage(page);

    // Reload the page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify authentication is still valid
    expect(await isAuthenticated(page)).toBe(true);
    const authAfterReload = await getAuthSessionStorage(page);
    
    // Verify sessionStorage data is preserved
    expect(authAfterReload.token).toBe(authBeforeReload.token);
    expect(authAfterReload.isAuthenticated).toBe(authBeforeReload.isAuthenticated);
    expect(authAfterReload.userId).toBe(authBeforeReload.userId);
  });
});
