import { defineConfig, devices } from '@playwright/test';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env.test file
config({ path: path.resolve(__dirname, '.env.test') });

/**
 * Minimal Playwright configuration for E2E tests
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  // Test directory
  testDir: './specs',

  // Timeouts
  timeout: 30 * 1000, // 30 seconds per test
  expect: {
    timeout: 5000, // 5 seconds for expectations
  },

  // Execution settings
  fullyParallel: true, // Run tests in parallel
  forbidOnly: !!process.env.CI, // Fail if .only is used in CI
  retries: process.env.CI ? 2 : 0, // Retries in CI
  workers: process.env.CI ? 2 : undefined, // Workers in CI

  // Reporter configuration
  reporter: [
    ['html'],
    ['list'],
    ...(process.env.CI ? [['github']] : []),
  ],

  // Shared settings for all projects
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173',
    trace: 'on-first-retry', // Traces only on retries
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10000, // 10 seconds for actions
    navigationTimeout: 30000, // 30 seconds for navigation
  },

  // Projects (browsers)
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Development server configuration
  // Automatically starts the dev server with test environment variables
  webServer: {
    command: 'npm run dev -- --port 5173',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 180 * 1000, // Increased timeout to 3 minutes
    stdout: 'pipe', // Capture stdout to detect server ready
    stderr: 'pipe', // Capture stderr for debugging
    env: {
      // Pass VITE_APP_* environment variables to the dev server
      ...Object.fromEntries(
        Object.entries(process.env).filter(([key]) => key.startsWith('VITE_APP_'))
      ),
    },
  },
});
