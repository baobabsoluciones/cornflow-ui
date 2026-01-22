/**
 * Constants used across E2E tests
 */

// Protected routes that require authentication
export const PROTECTED_ROUTES = [
  '/history-execution',
  '/dashboard',
  '/project-execution',
  '/user-settings',
  '/',
] as const;

// Timeouts (in milliseconds)
export const TIMEOUTS = {
  FORM_LOAD: 10000,
  INPUT_FILL_DELAY: 200,
  CONFIG_INIT_DELAY: 1000,
  NAVIGATION: 20000,
  AUTH_VERIFICATION_POLL: 500,
  AUTH_VERIFICATION_MAX_ATTEMPTS: 30, // 30 * 500ms = 15 seconds
  ERROR_SNACKBAR_CHECK: 2000,
  BUTTON_ENABLE: 5000,
} as const;

// Selectors
export const SELECTORS = {
  LOGIN_FORM: '.login-form',
  USERNAME_INPUT: 'input[type="text"]',
  PASSWORD_INPUT: 'input[type="password"]',
  SUBMIT_BUTTON: 'button.main-signin-btn',
  ERROR_SNACKBAR: '.v-snackbar',
} as const;

// SessionStorage keys
export const SESSION_STORAGE_KEYS = {
  IS_AUTHENTICATED: 'isAuthenticated',
  TOKEN: 'token',
  USER_ID: 'userId',
} as const;
