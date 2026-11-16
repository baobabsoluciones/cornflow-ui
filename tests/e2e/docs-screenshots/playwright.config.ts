import { createDocsScreenshotsConfig } from './configFactory.mjs'

/**
 * Screenshots of the core's functional documentation (`docs/funcionalidades/`).
 *
 *   npm run docs:screenshots
 */
export default createDocsScreenshotsConfig({
  testDir: './shots',
  viteConfig: 'tests/e2e/docs-screenshots/vite.config.ts',
})
