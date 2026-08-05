import { defineConfig, devices } from '@playwright/test';
import type { PlaywrightTestConfig } from '@playwright/test';
import { config as loadDotenv } from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Shared Playwright config factory for the Cornflow E2E suite.
 *
 * This file ships inside `@cornflow-ui/core` so that **any consumer app** can run the
 * exact same generic E2E specs against its OWN app, with ZERO copies and ZERO changes:
 *
 *   // consumer's playwright.config.ts
 *   import { createCornflowE2EConfig } from '@cornflow-ui/core/e2e/configFactory'
 *   export default createCornflowE2EConfig()
 *
 * The specs, helpers, reporters and auth setup are resolved from THIS package (absolute
 * paths), while the dev server, `.env.test` and the saved auth state come from the
 * CONSUMER project — so the suite picks up the consumer's backend / schema / variables.
 *
 * The specs are schema-agnostic: they navigate core UI and adapt to whatever tables/data
 * the running app's schema exposes, so the same suite is valid for every product.
 */

// Directory of THIS factory inside the (possibly installed) core package: .../tests/e2e
const packageE2EDir = path.dirname(fileURLToPath(import.meta.url));

export interface CornflowE2EOptions {
  /**
   * Root of the consumer project (where `.env.test` and the saved `.auth` live).
   * Defaults to the current working directory (the project running `npm run test:e2e`).
   */
  consumerDir?: string;
  /** Command Playwright uses to start the app under test. Defaults to the consumer's dev server. */
  devCommand?: string;
  /** Base URL of the app under test. Defaults to $PLAYWRIGHT_BASE_URL or http://localhost:3000. */
  baseURL?: string;
  /**
   * Optional directory with the consumer's OWN extra specs (app-specific flows). When set,
   * they run as an additional authenticated project alongside the shared core specs.
   */
  consumerSpecDir?: string;
  /** Extra Playwright config overrides merged on top (escape hatch). */
  overrides?: Partial<PlaywrightTestConfig>;
}

/**
 * Resolve the consumer's `.env.test`: prefer `<consumerDir>/tests/e2e/.env.test`,
 * then `<consumerDir>/.env.test`. Loaded into process.env before config is built.
 */
function loadConsumerEnv(consumerDir: string): void {
  const candidates = [
    path.join(consumerDir, 'tests', 'e2e', '.env.test'),
    path.join(consumerDir, '.env.test'),
  ];
  const envPath = candidates.find((p) => fs.existsSync(p));
  if (!envPath) {
    console.warn(
      `[cornflow-e2e] No .env.test found (looked in: ${candidates.join(', ')}). ` +
        'Auth + backend-dependent specs will not run.',
    );
    return;
  }
  const result = loadDotenv({ path: envPath });
  if (result.error) {
    console.warn(`[cornflow-e2e] Could not load ${envPath}:`, result.error);
  }
}

export function createCornflowE2EConfig(
  options: CornflowE2EOptions = {},
): PlaywrightTestConfig {
  const consumerDir = options.consumerDir ?? process.cwd();
  loadConsumerEnv(consumerDir);

  const isCI = !!process.env.CI;
  const baseURL =
    options.baseURL || process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

  // Absolute paths INTO the core package — valid whether core is this repo or a node_modules dep.
  const specsDir = path.join(packageE2EDir, 'specs');
  const setupFile = path.join(packageE2EDir, 'auth.setup.ts');
  const corporateReporter = path.join(packageE2EDir, 'reporters', 'corporate-reporter.ts');

  // Auth storage state lives in the CONSUMER project (writable, per-project).
  const storageState = path.join(consumerDir, 'tests', 'e2e', '.auth', 'user.json');

  const reporter: PlaywrightTestConfig['reporter'] = isCI
    ? [['html', { open: 'never' }], ['list', {}], ['github', {}], [corporateReporter, {}]]
    : [['html', { open: 'never' }], ['list', {}], [corporateReporter, {}]];

  const projects: NonNullable<PlaywrightTestConfig['projects']> = [
    { name: 'setup', testDir: packageE2EDir, testMatch: setupFile },
    {
      name: 'chromium',
      testDir: specsDir,
      use: { ...devices['Desktop Chrome'], storageState },
      dependencies: ['setup'],
      testIgnore: ['**/auth/**'],
    },
    {
      name: 'chromium-auth-tests',
      testDir: specsDir,
      use: { ...devices['Desktop Chrome'] },
      testMatch: ['**/auth/**'],
    },
  ];

  // Consumer's own app-specific specs (optional), authenticated like the core suite.
  if (options.consumerSpecDir) {
    projects.push({
      name: 'chromium-app',
      testDir: options.consumerSpecDir,
      use: { ...devices['Desktop Chrome'], storageState },
      dependencies: ['setup'],
    });
  }

  return defineConfig({
    testDir: specsDir,
    timeout: 90 * 1000,
    expect: { timeout: 15000 },
    fullyParallel: false,
    forbidOnly: isCI,
    retries: isCI ? 2 : 1,
    workers: isCI ? 2 : 1,
    reporter,
    use: {
      baseURL,
      trace: 'on-first-retry',
      screenshot: 'only-on-failure',
      video: 'retain-on-failure',
      actionTimeout: 20000,
      navigationTimeout: 40000,
    },
    projects,
    webServer: {
      command: options.devCommand || 'npm run dev -- --port 3000',
      url: baseURL,
      reuseExistingServer: !isCI,
      timeout: 240 * 1000,
      stdout: 'pipe',
      stderr: 'pipe',
      env: { ...process.env, NODE_ENV: process.env.NODE_ENV || 'development' },
    },
    ...options.overrides,
  });
}
