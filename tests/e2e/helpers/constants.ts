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
// Increased timeouts to handle parallel execution and slow network conditions
export const TIMEOUTS = {
  FORM_LOAD: 15000, // Increased from 10000 to handle slower loads
  INPUT_FILL_DELAY: 200,
  CONFIG_INIT_DELAY: 1500, // Increased from 1000 for better initialization
  NAVIGATION: 30000, // Increased from 20000 for slower navigation
  AUTH_VERIFICATION_POLL: 500,
  AUTH_VERIFICATION_MAX_ATTEMPTS: 40, // Increased from 30 to 40 (40 * 500ms = 20 seconds)
  ERROR_SNACKBAR_CHECK: 3000, // Increased from 2000 for better error detection
  BUTTON_ENABLE: 8000, // Increased from 5000 for slower button enabling
} as const;

// Selectors
export const SELECTORS = {
  LOGIN_FORM: '.login-form',
  USERNAME_INPUT: 'input[type="text"]',
  PASSWORD_INPUT: 'input[type="password"]',
  SUBMIT_BUTTON: 'button.main-signin-btn',
  ERROR_SNACKBAR: '.v-snackbar',
  LOGOUT_BUTTON: 'v-list-item:has-text("Logout"), v-list-item:has-text("Cerrar sesión")',
  LOGOUT_MODAL: '.v-dialog',
  LOGOUT_MODAL_ACCEPT_BUTTON: 'button.primary-btn, button:has-text("Cerrar sesión"), button:has-text("Log out")',
  LOGOUT_MODAL_CANCEL_BUTTON: 'button.secondary-btn, button:has-text("Cancelar"), button:has-text("Cancel")',
} as const;

// SessionStorage keys
export const SESSION_STORAGE_KEYS = {
  IS_AUTHENTICATED: 'isAuthenticated',
  TOKEN: 'token',
  USER_ID: 'userId',
} as const;
