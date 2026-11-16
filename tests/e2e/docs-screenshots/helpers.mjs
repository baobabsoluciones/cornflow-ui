/**
 * Helpers of the documentation screenshots: open the demo app, wait for it, move around it and
 * save an image.
 *
 * Plain JavaScript so that packages built on the core (enterprise) can import them from
 * node_modules in their own Playwright runs.
 */
import fs from 'node:fs'
import path from 'node:path'
import { installMockBackend } from './mockBackend.mjs'
import { DEMO_NOW, demoUser } from './demoData.mjs'
import { DOCS_OVERRIDES_KEY } from './overridesKey.mjs'

/**
 * Prepares a page for a screenshot: the mock backend, the settings of the app config, the session
 * and a fixed clock, so every run draws the same screen.
 *
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').TestInfo} testInfo
 * @param {{
 *   overrides?: object,                  // settings of the app config (see app/docsOverrides.ts)
 *   mock?: object,                       // options of installMockBackend (values, executions, handlers…)
 *   signedIn?: boolean,                  // start signed in (default) or on the sign-in page
 *   theme?: 'light' | 'dark' | 'system',
 * }} [options]
 */
export async function openDemo(page, testInfo, options = {}) {
  const baseURL = String(testInfo.project.use.baseURL)
  const backend = await installMockBackend(page, { baseURL, ...(options.mock ?? {}) })

  await page.clock.setFixedTime(new Date(DEMO_NOW))
  await page.addInitScript(
    ({ key, overrides, signedIn, theme, userId }) => {
      localStorage.setItem(key, JSON.stringify(overrides))
      localStorage.setItem('cornflow-ui:theme', theme)
      // Only on the first load: a sign-out in the shot must stay signed out.
      if (signedIn && sessionStorage.getItem('docs:session') !== 'set') {
        sessionStorage.setItem('docs:session', 'set')
        sessionStorage.setItem('isAuthenticated', 'true')
        sessionStorage.setItem('token', 'demo-token')
        sessionStorage.setItem('userId', String(userId))
      }
    },
    {
      key: DOCS_OVERRIDES_KEY,
      overrides: options.overrides ?? {},
      signedIn: options.signedIn !== false,
      theme: options.theme ?? 'light',
      userId: demoUser.id,
    },
  )
  return backend
}

/** Waits until the app has nothing loading: no overlay, skeleton or progress bar on screen. */
export async function settle(page, extraMs = 400) {
  await page.waitForLoadState('networkidle').catch(() => {})
  await page
    .waitForFunction(
      () =>
        !document.querySelector(
          '[data-testid=initial-loading-overlay], .core-skeleton, .v-skeleton-loader, .v-progress-linear--active',
        ),
      undefined,
      { timeout: 15000 },
    )
    .catch(() => {})
  await page.evaluate(() => document.fonts?.ready)
  await page.waitForTimeout(extraMs)
}

/** Waits for the snackbars to go, so they do not cover the shot. */
export async function noSnackbar(page) {
  await page
    .locator('[data-testid=core-snackbar]')
    .first()
    .waitFor({ state: 'hidden', timeout: 15000 })
    .catch(() => {})
}

const imagesDir = () => {
  const dir = process.env.DOCS_IMAGES_DIR ?? path.resolve('docs', 'images')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

/**
 * Saves `docs/images/<name>.png`: the whole window, an element or a rectangle of it.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} name
 * @param {{
 *   target?: import('@playwright/test').Locator,  // capture only this element…
 *   padding?: number,                             // …with this many pixels around it
 *   clip?: { x: number, y: number, width: number, height: number },
 *   keepPointer?: boolean,                        // keep the pointer where it is (hover states)
 * }} [options]
 */
export async function shot(page, name, options = {}) {
  const file = path.join(imagesDir(), `${name}.png`)
  if (!options.keepPointer) await page.mouse.move(1439, 899).catch(() => {})
  let clip = options.clip
  if (options.target) {
    await options.target.scrollIntoViewIfNeeded()
    const box = await options.target.boundingBox()
    if (!box) throw new Error(`Nothing to capture for ${name}`)
    const padding = options.padding ?? 0
    const viewport = page.viewportSize()
    const x = Math.max(0, box.x - padding)
    const y = Math.max(0, box.y - padding)
    clip = {
      x,
      y,
      width: Math.min(viewport.width - x, box.width + padding * 2),
      height: Math.min(viewport.height - y, box.height + padding * 2),
    }
  }
  await page.screenshot({ path: file, animations: 'disabled', caret: 'hide', clip })
  return file
}

/** Lists, in the output, what the app asked the mock backend and it did not answer. */
export function reportUnhandled(backend, testInfo) {
  if (backend.unhandled.length > 0) {
    testInfo.annotations.push({ type: 'unhandled', description: backend.unhandled.join('\n') })
    console.warn(`[${testInfo.title}] unhandled requests:\n  ${backend.unhandled.join('\n  ')}`)
  }
}

/** Moves to a route of the app without reloading it (keeps the loaded executions). */
export async function go(page, route) {
  await page.evaluate((hash) => {
    window.location.hash = hash
  }, `#${route}`)
  await settle(page)
}

const TABS = '[data-testid^=execution-tab-]:not([data-testid^=execution-tab-close]):not([data-testid=execution-tab-bar])'

/** Opens the history and loads its `index`-th execution (newest first) as the selected one. */
export async function loadExecution(page, index = 0) {
  // A reload would drop the executions already open, so a page already in the app only moves.
  if (page.url().includes('#/')) await go(page, '/history-execution')
  else await page.goto('/#/history-execution')
  await settle(page)
  const tabs = await page.locator(TABS).count()
  await page.locator('[data-testid=history-row]').nth(index).click()
  await page.locator('[data-testid=history-detail-load]').click()
  await page
    .waitForFunction((args) => document.querySelectorAll(args.selector).length > args.before, { selector: TABS, before: tabs }, { timeout: 15000 })
    .catch(() => {})
  await settle(page)
  await noSnackbar(page)
}

/** Pins the side menu open. */
export async function pinDrawer(page) {
  const pin = page.locator('[data-testid=app-drawer-pin]')
  for (let attempt = 0; attempt < 5; attempt++) {
    await page.locator('[data-testid=app-drawer]').hover()
    await page.waitForTimeout(300)
    if ((await pin.count()) && (await pin.getAttribute('aria-label')) === 'Desfijar el menú') break
    if (await pin.isVisible()) await pin.click()
    await page.waitForTimeout(300)
    if ((await pin.getAttribute('aria-label').catch(() => null)) === 'Desfijar el menú') break
  }
  await page.mouse.move(900, 450)
  await page.waitForTimeout(400)
}
