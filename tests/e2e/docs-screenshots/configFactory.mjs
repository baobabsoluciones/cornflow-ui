import { defineConfig, devices } from '@playwright/test'
import path from 'node:path'

/**
 * Playwright config of the documentation screenshots.
 *
 * It starts the app with the screenshots' Vite config (mock backend, demo app config) and runs the
 * `*.shots.ts` specs of `testDir`, which save their images to `docs/funcionalidades/images/` of the project.
 *
 * Plain JavaScript so that packages built on the core (enterprise) can build their own config with
 * it from node_modules, pointing `viteConfig` and `testDir` at their own files.
 *
 * @param {{
 *   consumerDir?: string,  // project root (defaults to cwd)
 *   testDir: string,       // folder with the *.shots.ts specs
 *   viteConfig: string,    // Vite config of the screenshots, relative to consumerDir
 *   port?: number,         // dev server port (default 3100)
 * }} options
 */
export function createDocsScreenshotsConfig(options) {
  const consumerDir = options.consumerDir ?? process.cwd()
  const port = options.port ?? 3100
  const baseURL = `http://localhost:${port}`

  process.env.DOCS_IMAGES_DIR ??= path.join(consumerDir, 'docs', 'funcionalidades', 'images')

  return defineConfig({
    testDir: options.testDir,
    testMatch: '**/*.shots.ts',
    timeout: 120 * 1000,
    expect: { timeout: 20 * 1000 },
    fullyParallel: false,
    workers: 1,
    retries: 0,
    reporter: [['list']],
    outputDir: path.join(consumerDir, 'test-results', 'docs-screenshots'),
    use: {
      ...devices['Desktop Chrome'],
      baseURL,
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
      locale: 'es-ES',
      timezoneId: 'Europe/Madrid',
      colorScheme: 'light',
      trace: 'retain-on-failure',
    },
    webServer: {
      command: `npx vite --config ${options.viteConfig}`,
      cwd: consumerDir,
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 180 * 1000,
    },
  })
}
