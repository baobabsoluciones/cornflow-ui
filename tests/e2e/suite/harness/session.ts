/**
 * Signing in, and keeping the session. The interface keeps its session in `sessionStorage`
 * (token, user id and whatever its sign-in flow adds), which Playwright's `storageState` leaves
 * out. So the set-up signs in through the form, as a user does, and keeps a copy of that
 * `sessionStorage`; a browser context opened for that user gets it back before the app loads.
 */
import type { Browser, BrowserContext, Page } from '@playwright/test'
import { type CornflowApi, CornflowApiError } from './cornflowApi'
import {
  cornflowApiFor,
  type Deployment,
  readDeployment,
  readSessionCredentials,
  readSessionStorage,
  storageStateFile,
} from './run'

/**
 * Signs in through the sign-in form of the app and waits until the app has the session. Says so
 * plainly when the server asks for more than a user and password: a two-factor code, or a new
 * password before going on. The suite signs in with neither.
 */
export async function signInThroughForm(
  page: Page,
  username: string,
  password: string,
): Promise<void> {
  await page.goto('/')
  await page.getByTestId('sign-in-username').fill(username)
  await page.getByTestId('sign-in-password').fill(password)
  await page.getByTestId('sign-in-submit').click()
  const outcome = await page
    .waitForFunction(
      () => {
        if (
          sessionStorage.getItem('isAuthenticated') === 'true' &&
          !!sessionStorage.getItem('token')
        )
          return 'signed in'
        const asked = (id: string) =>
          !!document.querySelector(`[data-testid="${id}"]`)
        return asked('sign-in-mfa-code') ||
          asked('sign-in-mfa-qr') ||
          asked('sign-in-mfa-enroll-code')
          ? 'two-factor'
          : false
      },
      null,
      { timeout: 30_000 },
    )
    .then((handle) => handle.jsonValue())
    .catch(() => 'failed')
  if (outcome === 'two-factor') {
    throw new Error(
      `[cornflow-e2e] Could not sign in as "${username}": the server asks for a two-factor ` +
        'code. The suite signs in with a user and password only: use a user without two-factor ' +
        'authentication, on a server that does not require it.',
    )
  }
  if (outcome !== 'signed in') {
    throw new Error(
      `[cornflow-e2e] Could not sign in as "${username}" through the sign-in form.`,
    )
  }
  if (
    (await page.evaluate(() => sessionStorage.getItem('pwdChangeRequired'))) ===
    'true'
  ) {
    throw new Error(
      `[cornflow-e2e] "${username}" signed in, but the server asks them to change their ` +
        'password before going on (expired, or to be changed on the first sign-in), and the app ' +
        'keeps them on their settings until then. Change it first; in disposable mode, the ' +
        'server must not ask it of the users the suite creates.',
    )
  }
  await page.waitForLoadState('networkidle')
}

/** Everything the page keeps in `sessionStorage`. */
export function readPageSessionStorage(
  page: Page,
): Promise<Record<string, string>> {
  return page.evaluate(() => {
    const entries: Record<string, string> = {}
    for (let index = 0; index < sessionStorage.length; index++) {
      const key = sessionStorage.key(index)
      if (key !== null) entries[key] = sessionStorage.getItem(key) ?? ''
    }
    return entries
  })
}

/**
 * Marks every page of `context` as the suite's, before the app starts: only on such a page does
 * the app publish `window.cornflowUi.describe()` (`src/utils/appDescription.ts`). Every context
 * the suite opens is marked: the `context` fixture, `newSignedInContext` and the set-up's.
 */
export async function markForTheSuite(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    ;(window as { __cornflowE2E?: boolean }).__cornflowE2E = true
  })
}

/** What the app says it is made of: `window.cornflowUi.describe()`. */
export async function readDescription(page: Page): Promise<Deployment> {
  await page
    .waitForFunction(() => !!(window as any).cornflowUi, null, {
      timeout: 60_000,
    })
    .catch(() => {
      throw new Error(
        '[cornflow-e2e] The app did not publish window.cornflowUi.describe(). It needs a core ' +
          'that has it, and a page the suite marked before the app started (markForTheSuite).',
      )
    })
  return page.evaluate(() => (window as any).cornflowUi.describe())
}

/** Per worker, the token each of the run's users last signed in with, and when. */
const issued = new Map<string, { token: string; at: number }>()

/**
 * How long a token is used again: Cornflow 1.4 gives access tokens of 15 minutes, so a test that
 * starts with one has 7 minutes left at least.
 */
const REUSE_MS = 8 * 60_000

/**
 * The `sessionStorage` of one of the run's users, with a token that has not run out: the one the
 * set-up saved expires (Cornflow 1.4), so each worker signs in again through the API, and uses
 * that token for some minutes, as Cornflow lets an address sign in only so many times a minute.
 *
 * The page gets no refresh token: the app would spend it on renewing, or revoke it on signing
 * out, and leave the other tests of the worker with a token that no longer works.
 */
export async function freshSessionStorage(
  user: string,
  baseURL: string | undefined = process.env.PLAYWRIGHT_BASE_URL,
): Promise<Record<string, string>> {
  let last = issued.get(user)
  if (!last || Date.now() - last.at > REUSE_MS) {
    const { username, password } = readSessionCredentials(user)
    const api = cornflowApiFor(readDeployment(), baseURL)
    last = {
      token: (await loginWithinLimit(api, username, password)).token,
      at: Date.now(),
    }
    issued.set(user, last)
  }
  const entries = { ...readSessionStorage(user) }
  delete entries.refreshToken
  return { ...entries, token: last.token }
}

/** Signs in through the API, waiting a minute when Cornflow says there were too many (429). */
async function loginWithinLimit(
  api: CornflowApi,
  username: string,
  password: string,
): Promise<{ token: string }> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await api.login(username, password)
    } catch (error) {
      if (
        !(error instanceof CornflowApiError) ||
        error.status !== 429 ||
        attempt === 3
      )
        throw error
      await new Promise((resolve) => setTimeout(resolve, 61_000))
    }
  }
}

/**
 * Puts the session of one of the run's users back into the `sessionStorage` of every tab of
 * `context`, before the app loads: `entries`, from `freshSessionStorage`. Only on the first page
 * of each tab, so that signing out in a test is not undone by the next page it opens. The context
 * has to have that user's `storageState` too.
 */
export async function restoreSession(
  context: BrowserContext,
  entries: Record<string, string>,
): Promise<void> {
  await context.addInitScript((entries: Record<string, string>) => {
    // A new tab starts on about:blank, where sessionStorage cannot be read: only the app's pages.
    if (!location.protocol.startsWith('http')) return
    if (sessionStorage.length) return
    for (const [key, value] of Object.entries(entries))
      sessionStorage.setItem(key, value)
  }, entries)
}

/**
 * A second browser context, signed in as one of the run's users, for a test that needs two at
 * once. Its pages are not checked for untranslated keys nor for errors of the app: the test's own
 * `page` is.
 */
export async function newSignedInContext(
  browser: Browser,
  user: string,
  options: Parameters<Browser['newContext']>[0] = {},
): Promise<BrowserContext> {
  const entries = await freshSessionStorage(user, options.baseURL)
  const context = await browser.newContext({
    ...options,
    storageState: storageStateFile(user),
  })
  await markForTheSuite(context)
  await restoreSession(context, entries)
  return context
}
