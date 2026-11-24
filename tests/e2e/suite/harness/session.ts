/**
 * Signing in, and keeping the session. The interface keeps its session in `sessionStorage`
 * (token, user id and whatever its sign-in flow adds), which Playwright's `storageState` leaves
 * out. So the set-up signs in through the form, as a user does, and keeps a copy of that
 * `sessionStorage`; a browser context opened for that user gets it back before the app loads.
 */
import type { Browser, BrowserContext, Page } from '@playwright/test'
import { type Deployment, readSessionStorage, storageStateFile } from './run'

/** Signs in through the sign-in form of the app and waits until the app has the session. */
export async function signInThroughForm(
  page: Page,
  username: string,
  password: string,
): Promise<void> {
  await page.goto('/')
  await page.getByTestId('sign-in-username').fill(username)
  await page.getByTestId('sign-in-password').fill(password)
  await page.getByTestId('sign-in-submit').click()
  try {
    await page.waitForFunction(
      () =>
        sessionStorage.getItem('isAuthenticated') === 'true' &&
        !!sessionStorage.getItem('token'),
      null,
      { timeout: 30_000 },
    )
  } catch {
    throw new Error(
      `[cornflow-e2e] Could not sign in as "${username}" through the sign-in form.`,
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

/** What the app says it is made of: `window.cornflowUi.describe()`. */
export async function readDescription(page: Page): Promise<Deployment> {
  await page.waitForFunction(() => !!(window as any).cornflowUi, null, {
    timeout: 60_000,
  })
  return page.evaluate(() => (window as any).cornflowUi.describe())
}

/**
 * A browser context signed in as one of the run's users (`default` unless a test asks for a
 * role). The session goes back into `sessionStorage` on the first page of each tab only, so that
 * signing out in a test is not undone by the next page it opens.
 */
export async function newSignedInContext(
  browser: Browser,
  user: string,
  options: Parameters<Browser['newContext']>[0] = {},
): Promise<BrowserContext> {
  const context = await browser.newContext({
    ...options,
    storageState: storageStateFile(user),
  })
  await context.addInitScript((entries: Record<string, string>) => {
    if (sessionStorage.length) return
    for (const [key, value] of Object.entries(entries))
      sessionStorage.setItem(key, value)
  }, readSessionStorage(user))
  return context
}
