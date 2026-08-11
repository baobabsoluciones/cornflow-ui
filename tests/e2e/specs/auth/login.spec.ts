import { test, expect, Page } from '@playwright/test';
import { authenticate, isAuthenticated, logout } from '../../helpers/auth/index';
import { isOnProtectedRoute, isHashRoute, getHashRoute } from '../../helpers/urlHelpers';
import { getAuthSessionStorage } from '../../helpers/sessionStorageHelpers';
import { PROTECTED_ROUTES, SELECTORS, TIMEOUTS } from '../../helpers/constants';

/**
 * Simple example test to verify Playwright configuration
 * This test checks that the application loads correctly
 */
test('should load the application homepage', async ({ page }) => {
  // Navigate to the base URL
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  // Wait for the page to load by checking for the v-app element
  // This is the root element of a Vuetify application
  const app = page.locator('v-app, [data-app], .v-application');
  await expect(app.first()).toBeVisible({ timeout: 10000 });

  // Verify that the page title exists (or check for any visible content)
  await expect(page).toHaveTitle(/./); // Any non-empty title
});

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
    await page.goto('/sign-in', { waitUntil: 'domcontentloaded' });
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
    await page.goto('/sign-in', { waitUntil: 'domcontentloaded' });

    const authError = await attemptAuthWithError(page, 'invalid_user', 'invalid_password');

    // Verify authentication failed
    expect(authError).not.toBeNull();
    expect(authError?.message).toBeTruthy();

    // Verify still on sign-in page and not authenticated
    expect(isOnProtectedRoute(page)).toBe(false);
    await expectNotAuthenticated(page);
  });

  test('should fail login with empty credentials', async ({ page }) => {
    await page.goto('/sign-in', { waitUntil: 'domcontentloaded' });

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

  test('should logout successfully by clicking logout button in UI', async ({ page }) => {
    // Authenticate first
    await authenticate(page);
    await expectAuthenticated(page);
    expect(isOnProtectedRoute(page)).toBe(true);

    // Wait for the app to be ready (drawer should be available)
    const app = page.locator('v-app, [data-app], .v-application');
    await expect(app.first()).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });
    
    // Find and click the logout button in the drawer
    // The logout button has icon 'mdi-logout' and may show text "Logout" or "Cerrar sesión" when expanded
    // When the menu is collapsed (mini), only the icon is visible
    // Strategy: Try to find by text first (expanded menu), fallback to icon-based selector (collapsed menu)
    let logoutButton = page.getByText(/Logout|Cerrar sesión/i).first();
    const isTextVisible = await logoutButton.isVisible().catch(() => false);
    
    if (!isTextVisible) {
      // Menu is collapsed, find the .v-list-item that contains the mdi-logout icon
      // First try to find the v-list-item containing the icon
      logoutButton = page
        .locator('.v-list-item')
        .filter({ has: page.locator('[class*="mdi-logout"]') })
        .first();
      
      // If that doesn't work, find the icon and click it directly
      // The click should bubble up to the parent v-list-item
      const buttonVisible = await logoutButton.isVisible().catch(() => false);
      if (!buttonVisible) {
        const logoutIcon = page.locator('[class*="mdi-logout"]').first();
        await logoutIcon.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
        logoutButton = logoutIcon;
      }
    }
    
    await logoutButton.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
    await logoutButton.click();

    // Wait for the confirmation modal to appear
    // The modal title should be visible
    const modalTitle = page.getByText(/Cerrar sesión|Log out/i).first();
    await modalTitle.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });

    // Find and click the accept/confirm button in the modal
    // Try primary-btn class first, fallback to button with logout text
    let acceptButton = page.locator('button.primary-btn').first();
    const isVisible = await acceptButton.isVisible().catch(() => false);
    
    if (!isVisible) {
      acceptButton = page.getByRole('button', { name: /Cerrar sesión|Log out/i }).first();
    }
    
    await acceptButton.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
    await acceptButton.click();

    // Wait for navigation to sign-in page
    await page.waitForURL(/\/sign-in/, { timeout: TIMEOUTS.NAVIGATION });

    // Verify logout: on sign-in page and not authenticated
    await expect(page).toHaveURL(/\/sign-in/);
    await expectNotAuthenticated(page);
  });

  test('should redirect to sign-in when accessing protected route without authentication', async ({ page }) => {
    await page.goto('/history-execution', { waitUntil: 'domcontentloaded' });

    // Should be redirected to sign-in
    await expect(page).toHaveURL(/\/sign-in/, { timeout: TIMEOUTS.NAVIGATION });
    await expectNotAuthenticated(page);
  });

  test('should maintain authentication state across page reloads', async ({ page }) => {
    await authenticate(page);
    await expectAuthenticated(page);
    
    const authBeforeReload = await getAuthSessionStorage(page);

    await page.reload({ waitUntil: 'domcontentloaded' });

    // Wait for the app to be visible after reload
    const app = page.locator('v-app, [data-app], .v-application');
    await expect(app.first()).toBeVisible({ timeout: 10000 });

    // Verify authentication persists after reload
    await expectAuthenticated(page);
    const authAfterReload = await getAuthSessionStorage(page);
    
    // Verify sessionStorage data is preserved
    expect(authAfterReload.token).toBe(authBeforeReload.token);
    expect(authAfterReload.isAuthenticated).toBe(authBeforeReload.isAuthenticated);
    expect(authAfterReload.userId).toBe(authBeforeReload.userId);
  });
});
