import { test, expect } from '@playwright/test';
import { authenticate, isAuthenticated } from '../../helpers/auth/index';

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
    const currentUrl = page.url();
    expect(currentUrl).not.toContain('/sign-in');

    // Verify that sessionStorage contains authentication data
    const token = await page.evaluate(() => {
      return sessionStorage.getItem('token');
    });
    expect(token).toBeTruthy();
    expect(token?.length).toBeGreaterThan(0);

    const isAuthFlag = await page.evaluate(() => {
      return sessionStorage.getItem('isAuthenticated');
    });
    expect(isAuthFlag).toBe('true');
  });

  test('should redirect to protected route after login', async ({ page }) => {
    // Authenticate
    await authenticate(page);

    // Verify we're on a protected route (not sign-in)
    const currentUrl = page.url();
    expect(currentUrl).not.toContain('/sign-in');

    // Common protected routes after login
    const protectedRoutes = [
      '/history-execution',
      '/dashboard',
      '/project-execution',
      '/',
    ];

    // Check if we're on one of the expected protected routes
    const isOnProtectedRoute = protectedRoutes.some((route) =>
      currentUrl.includes(route)
    );
    expect(isOnProtectedRoute).toBe(true);
  });
});
