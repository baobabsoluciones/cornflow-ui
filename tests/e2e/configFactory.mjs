import { defineConfig, devices } from '@playwright/test';
import { config as loadDotenv } from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Shared Playwright config factory for the Cornflow E2E suite.
 *
 * This ships inside `@cornflow-ui/core` (plain .mjs so it can be imported from node_modules —
 * TypeScript files CANNOT be loaded from node_modules) so that **any consumer app** runs the
 * SAME generic core E2E specs against its OWN app, with zero copies and zero changes:
 *
 *   // consumer's playwright.config.mjs
 *   import { createCornflowE2EConfig } from '@cornflow-ui/core/e2e/configFactory.mjs'
 *   export default createCornflowE2EConfig()
 *
 * How it stays reliable: Playwright cannot type-strip .ts specs living under node_modules, so
 * when this factory detects it is running from an installed package it **mirrors** the suite
 * (specs/helpers/reporters/auth setup) into a local, gitignored folder in the CONSUMER project
 * (`tests/e2e/.cornflow-core/`, outside node_modules) and points Playwright there. When it runs
 * from the core repo itself, the suite is used in place.
 *
 * The dev server, `.env.test` and the saved auth state always come from the CONSUMER, so the
 * suite exercises the consumer's backend / schema / variables. The specs are schema-agnostic.
 */

const packageE2EDir = path.dirname(fileURLToPath(import.meta.url));

// Files/dirs that must NOT be mirrored to the consumer (factory itself, secrets, local state, docs).
const NO_MIRROR = new Set([
  'configFactory.mjs',
  '.env.test',
  '.env.test.example',
  '.auth',
  'playwright.config.ts',
  'README.md',
  'E2E_TEST_PLAN.md',
]);

function mirrorDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (NO_MIRROR.has(entry.name)) continue;
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) mirrorDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

/**
 * Returns the directory Playwright should use as the suite root. For a consumer (running from
 * node_modules) it mirrors the suite locally and returns that; for the core repo it returns the
 * package dir in place.
 */
function resolveSuiteDir(consumerDir) {
  const isInstalled = packageE2EDir.split(path.sep).includes('node_modules');
  if (!isInstalled) return packageE2EDir;
  const dest = path.join(consumerDir, 'tests', 'e2e', '.cornflow-core');
  fs.rmSync(dest, { recursive: true, force: true });
  mirrorDir(packageE2EDir, dest);
  return dest;
}

function loadConsumerEnv(consumerDir) {
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
  if (result.error) console.warn(`[cornflow-e2e] Could not load ${envPath}:`, result.error);
}

/**
 * @param {{
 *   consumerDir?: string,      // project root (defaults to cwd)
 *   devCommand?: string,       // app-under-test start command (defaults to consumer's dev server)
 *   baseURL?: string,
 *   consumerSpecDir?: string,  // optional: consumer's own extra specs (run authenticated)
 *   overrides?: object,        // extra Playwright config overrides
 * }} [options]
 */
export function createCornflowE2EConfig(options = {}) {
  const consumerDir = options.consumerDir ?? process.cwd();
  loadConsumerEnv(consumerDir);

  const isCI = !!process.env.CI;
  const baseURL = options.baseURL || process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

  const suiteDir = resolveSuiteDir(consumerDir);
  const specsDir = path.join(suiteDir, 'specs');
  const setupFile = path.join(suiteDir, 'auth.setup.ts');
  const corporateReporter = path.join(suiteDir, 'reporters', 'corporate-reporter.ts');

  // Auth storage state lives in the CONSUMER project (writable, per-project) — never inside the
  // mirrored suite, which is wiped on every run. `auth.setup.ts` / `fixtures.ts` read this same
  // path through `helpers/authFile.ts`, so it is published as an env var for them.
  const storageState = path.join(consumerDir, 'tests', 'e2e', '.auth', 'user.json');
  process.env.CORNFLOW_E2E_AUTH_FILE = storageState;

  const reporter = isCI
    ? [['html', { open: 'never' }], ['list', {}], ['github', {}], [corporateReporter, {}]]
    : [['html', { open: 'never' }], ['list', {}], [corporateReporter, {}]];

  const projects = [
    { name: 'setup', testDir: suiteDir, testMatch: setupFile },
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
