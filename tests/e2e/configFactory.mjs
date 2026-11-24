import { defineConfig, devices } from '@playwright/test'
import { config as loadDotenv } from 'dotenv'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Playwright config of the end-to-end suite of cornflow-ui, for core and for every app built on
 * it. The suite lives in core (`tests/e2e/suite/`) and each app runs it against its own backend:
 *
 *   // the app's playwright.config.mjs
 *   import { createCornflowE2EConfig } from '@cornflow-ui/core/e2e/configFactory.mjs'
 *   export default createCornflowE2EConfig()
 *
 * Playwright cannot load TypeScript from node_modules, so when this factory runs from an
 * installed package it copies the suite into the app (`tests/e2e/.cornflow-core/`, gitignored,
 * rewritten on every run) and runs that copy. In core it runs the suite in place. Only `suite/`
 * is copied: the stack in `stack/` is core's own backend for developing the suite.
 *
 * The dev server, `.env.test` and the saved sessions are always the app's, so the suite runs
 * against the app's backend, schemas and settings.
 *
 * Packages between core and the app add their own specs as layers (`options.layers`), each
 * copied next to the core suite and run as a project of its own, so one run covers them all:
 *
 *   core suite          (this package)            → projects `chromium` and `chromium-auth-tests`
 *   enterprise premium  (@cornflow-ui/enterprise)  → project `chromium-enterprise`
 *   the app's own specs                            → project `chromium-app`
 *
 * Every authenticated project depends on `setup`, which runs once before them.
 */

const packageE2EDir = path.dirname(fileURLToPath(import.meta.url))
const packageSuiteDir = path.join(packageE2EDir, 'suite')

function mirrorDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name)
    const to = path.join(dest, entry.name)
    if (entry.isDirectory()) mirrorDir(from, to)
    else fs.copyFileSync(from, to)
  }
}

/** True when `dir` lives inside an installed package rather than in the repo being run. */
function isInstalled(dir) {
  return dir.split(path.sep).includes('node_modules')
}

/**
 * The folder Playwright runs a suite from. A suite that comes from node_modules is copied into
 * `tests/e2e/<mirrorName>` of the project being tested (outside node_modules, so Playwright can
 * load its TypeScript) and that copy is returned; one that is part of the repo is run in place.
 *
 * The copies are siblings under `tests/e2e/`, which keeps layers composable: an upper layer
 * reaches the core suite with the same `../.cornflow-core/…` path in its own repo and in an app.
 */
function resolveSuiteDir(consumerDir, sourceDir, mirrorName) {
  if (!isInstalled(sourceDir)) return sourceDir
  const dest = path.join(consumerDir, 'tests', 'e2e', mirrorName)
  fs.rmSync(dest, { recursive: true, force: true })
  mirrorDir(sourceDir, dest)
  return dest
}

function loadConsumerEnv(consumerDir) {
  const candidates = [
    path.join(consumerDir, 'tests', 'e2e', '.env.test'),
    path.join(consumerDir, '.env.test'),
  ]
  const envPath = candidates.find((candidate) => fs.existsSync(candidate))
  if (!envPath) {
    console.warn(
      `[cornflow-e2e] No .env.test found (looked in: ${candidates.join(', ')}).`,
    )
    return
  }
  const result = loadDotenv({ path: envPath })
  if (result.error) {
    console.warn(`[cornflow-e2e] Could not load ${envPath}:`, result.error)
  }
}

/**
 * @typedef {{
 *   name: string,         // project name, e.g. 'chromium-enterprise'
 *   sourceDir: string,    // absolute path of the specs shipped by that layer
 *   mirrorName: string,   // folder under tests/e2e/ to copy them into, e.g. '.cornflow-enterprise'
 *   modules?: string[],   // subset of subfolders to run (e.g. ['latest-plan']); omit for all,
 *                         // pass [] when the app uses none of that layer's modules
 * }} E2ELayer
 */

/**
 * @param {{
 *   consumerDir?: string,      // project root (defaults to cwd)
 *   devCommand?: string,       // command that starts the app under test (defaults to its dev server)
 *   baseURL?: string,
 *   consumerSpecDir?: string,  // the app's own specs, run authenticated
 *   layers?: E2ELayer[],       // suites of the packages between core and the app (enterprise…)
 *   overrides?: object,        // any other Playwright setting
 * }} [options]
 */
export function createCornflowE2EConfig(options = {}) {
  const consumerDir = options.consumerDir ?? process.cwd()
  loadConsumerEnv(consumerDir)

  const isCI = !!process.env.CI
  const baseURL =
    options.baseURL ||
    process.env.PLAYWRIGHT_BASE_URL ||
    'http://localhost:3000'

  const suiteDir = resolveSuiteDir(
    consumerDir,
    packageSuiteDir,
    '.cornflow-core',
  )
  const specsDir = path.join(suiteDir, 'specs')
  const coverageReporter = path.join(
    suiteDir,
    'reporters',
    'coverageReporter.ts',
  )

  const browser = devices['Desktop Chrome']
  const projects = [
    { name: 'setup', testDir: suiteDir, testMatch: 'setup/**/*.setup.ts' },
    {
      name: 'chromium',
      testDir: specsDir,
      use: browser,
      dependencies: ['setup'],
      testIgnore: ['**/auth/**'],
    },
    {
      // Signing in and out: these start without a session.
      name: 'chromium-auth-tests',
      testDir: specsDir,
      use: browser,
      testMatch: ['**/auth/**'],
    },
  ]

  for (const layer of options.layers ?? []) {
    // `modules` left out: every module of the layer. Listed: only those. Empty: none, so the
    // layer is not run at all.
    if (layer.modules?.length === 0) continue
    projects.push({
      name: layer.name,
      testDir: resolveSuiteDir(consumerDir, layer.sourceDir, layer.mirrorName),
      use: browser,
      dependencies: ['setup'],
      ...(layer.modules
        ? {
            testMatch: layer.modules.map(
              (module) => `**/${module}/**/*.spec.ts`,
            ),
          }
        : {}),
    })
  }

  if (options.consumerSpecDir) {
    projects.push({
      name: 'chromium-app',
      testDir: options.consumerSpecDir,
      use: browser,
      dependencies: ['setup'],
    })
  }

  return defineConfig({
    testDir: specsDir,
    timeout: 90 * 1000,
    expect: { timeout: 15000 },
    fullyParallel: false,
    forbidOnly: isCI,
    retries: isCI ? 2 : 1,
    // One at a time: the tests launch executions on a real backend, and the airflow of the stack
    // turns down some of those asked for at the same time.
    workers: 1,
    reporter: [
      ['list'],
      ['html', { open: 'never' }],
      ...(isCI ? [['github']] : []),
      [coverageReporter],
    ],
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
  })
}
