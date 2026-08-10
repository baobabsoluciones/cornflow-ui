import { defineConfig, devices } from '@playwright/test';
import { config as loadDotenv } from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
 *
 * The same mechanism composes further layers through `options.layers`, so a client app that sits
 * on top of enterprise runs everything in one go without copying a single spec:
 *
 *   core specs          (this package)            → project `chromium`
 *   enterprise premium  (@cornflow-ui/enterprise)  → project `chromium-enterprise`
 *   app-specific specs  (the client repo)          → project `chromium-app`
 *
 * Client apps do not wire this by hand: they import the factory from the topmost package they
 * consume (`@cornflow-ui/enterprise/e2e/configFactory.mjs`), which passes its own layer down.
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
  'E2E_ARCHITECTURE.md',
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

/** True when `dir` lives inside an installed package rather than in the repo being run. */
function isInstalled(dir) {
  return dir.split(path.sep).includes('node_modules');
}

/**
 * Returns the directory Playwright should use for a suite that ships inside a package.
 *
 * When the suite comes from `node_modules` it is mirrored into `tests/e2e/<mirrorName>` in the
 * project being tested (outside `node_modules`, so Playwright can type-strip the `.ts` specs) and
 * that copy is returned. When it is already part of the repo being run, it is used in place.
 *
 * Mirror names are siblings under `tests/e2e/`, which is what keeps the layers composable: an
 * upper layer's specs reach the core harness with the same `../.cornflow-core/…` relative path
 * both in their own repo and once mirrored into a consumer.
 */
function resolveSuiteDir(consumerDir, sourceDir, mirrorName) {
  if (!isInstalled(sourceDir)) return sourceDir;
  const dest = path.join(consumerDir, 'tests', 'e2e', mirrorName);
  fs.rmSync(dest, { recursive: true, force: true });
  mirrorDir(sourceDir, dest);
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
 * @typedef {{
 *   name: string,         // project name, e.g. 'chromium-enterprise'
 *   sourceDir: string,    // absolute path of the specs shipped by that layer
 *   mirrorName: string,   // folder under tests/e2e/ to mirror into, e.g. '.cornflow-enterprise'
 *   modules?: string[],   // subset of subfolders to run (e.g. ['latest-plan']); omit for all,
 *                         // pass [] when the app uses none of that layer's modules
 * }} E2ELayer
 */

/**
 * @param {{
 *   consumerDir?: string,      // project root (defaults to cwd)
 *   devCommand?: string,       // app-under-test start command (defaults to consumer's dev server)
 *   baseURL?: string,
 *   consumerSpecDir?: string,  // optional: consumer's own extra specs (run authenticated)
 *   layers?: E2ELayer[],       // optional: suites contributed by intermediate packages (enterprise…)
 *   overrides?: object,        // extra Playwright config overrides
 * }} [options]
 */
export function createCornflowE2EConfig(options = {}) {
  const consumerDir = options.consumerDir ?? process.cwd();
  loadConsumerEnv(consumerDir);

  const isCI = !!process.env.CI;
  const baseURL = options.baseURL || process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

  const suiteDir = resolveSuiteDir(consumerDir, packageE2EDir, '.cornflow-core');
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

  // Layers contributed by packages between core and the app (enterprise, and anything built on
  // top of it). Each one is mirrored next to the core suite and gets its own project, so a single
  // run covers core + every intermediate layer + the app, with no spec duplicated anywhere.
  for (const layer of options.layers ?? []) {
    // `modules` undefined  → run every module the layer ships (the default).
    // `modules` listed     → run only those.
    // `modules` empty array → the app uses none of them; skip the layer entirely.
    if (layer.modules?.length === 0) continue;

    const layerDir = resolveSuiteDir(consumerDir, layer.sourceDir, layer.mirrorName);
    projects.push({
      name: layer.name,
      testDir: layerDir,
      use: { ...devices['Desktop Chrome'], storageState },
      dependencies: ['setup'],
      ...(layer.modules ? { testMatch: layer.modules.map((m) => `**/${m}/**/*.spec.ts`) } : {}),
    });
  }

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
