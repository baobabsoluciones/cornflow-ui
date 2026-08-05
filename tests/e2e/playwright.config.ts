import { defineConfig, devices } from '@playwright/test';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env.test file
// This must be done before defineConfig to ensure variables are available to workers
const envResult = config({ path: path.resolve(__dirname, '.env.test') });

// Ensure all environment variables are available
if (envResult.error) {
  console.warn('Warning: Could not load .env.test file:', envResult.error);
}

/**
 * Minimal Playwright configuration for E2E tests
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  // Test directory
  testDir: './specs',

  // Timeouts - Increased to handle parallel execution and slow network conditions
  timeout: 90 * 1000, // 90 seconds per test (increased from 60s for better reliability)
  expect: {
    timeout: 15000, // 15 seconds for expectations (increased from 10s)
  },

  // Execution settings
  // Disable full parallel execution to avoid race conditions with authentication and shared server
  fullyParallel: false, // Run tests sequentially to avoid conflicts
  forbidOnly: !!process.env.CI, // Fail if .only is used in CI
  retries: process.env.CI ? 2 : 1, // Retries: 2 in CI, 1 locally for flaky tests
  // Reduce workers to 1 locally to avoid parallel execution issues
  // In CI, use 2 workers but tests will still run sequentially per file
  workers: process.env.CI ? 2 : 1, // 1 worker locally, 2 in CI

  // Reporter configuration
  // The corporate reporter generates a branded HTML report in playwright-report/corporate-report.html
  // The HTML reporter uses open: 'never' to prevent blocking the terminal with an interactive server
  reporter: process.env.CI
    ? [
        ['html', { open: 'never' }],
        ['list', {}],
        ['github', {}],
        ['./reporters/corporate-reporter.ts', {}],
      ]
    : [
        ['html', { open: 'never' }],
        ['list', {}],
        ['./reporters/corporate-reporter.ts', {}],
      ],

  // Shared settings for all projects
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry', // Traces only on retries
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 20000, // 20 seconds for actions (increased from 15s)
    navigationTimeout: 40000, // 40 seconds for navigation (increased from 30s)
  },

  // Projects
  // The suite is split into three projects:
  // 1. 'setup'              – authenticates once and persists the state to .auth/user.json
  // 2. 'chromium'           – runs all specs (except auth/) with the pre-authenticated state
  // 3. 'chromium-auth-tests' – runs auth/ specs without pre-authentication (tests the login flow itself)
  projects: [
    {
      name: 'setup',
      testDir: './',
      testMatch: 'auth.setup.ts',
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Restore cookies + localStorage saved by the setup project.
        // sessionStorage is restored separately by the custom fixture (fixtures.ts).
        storageState: path.join(__dirname, '.auth', 'user.json'),
      },
      dependencies: ['setup'],
      testIgnore: ['**/auth/**'],
    },
    {
      name: 'chromium-auth-tests',
      use: { ...devices['Desktop Chrome'] },
      testMatch: ['**/auth/**'],
    },
  ],

  // Development server configuration
  // Automatically starts the dev server with test environment variables
  webServer: {
    command: 'npm run dev -- --port 3000',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 240 * 1000, // Increased timeout to 4 minutes for better reliability
    stdout: 'pipe', // Capture stdout to detect server ready
    stderr: 'pipe', // Capture stderr for debugging
    env: {
      // Explicitly pass all environment variables to the dev server
      // This ensures the Vue application has access to all configuration
      ...process.env, // Pass all environment variables including VITE_APP_* and PLAYWRIGHT_*
      // Ensure NODE_ENV is set if not already
      NODE_ENV: process.env.NODE_ENV || 'development',
    },
  },
});
