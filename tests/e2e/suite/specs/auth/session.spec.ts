/**
 * The session, from signing in to signing out (project `chromium-auth-tests`): when it ends while
 * the user works, the app renews it with its refresh token (Cornflow 1.4), and signing out closes
 * it on the server too. As the user of E2E_USER: signing out closes only the session of this test.
 */
import type { Page } from '@playwright/test'
import { test, expect } from '../../harness/fixtures'
import { cornflowApiFor, credentials } from '../../harness/run'
import { signInThroughForm } from '../../harness/session'
import { openSettings, signOut } from '../../harness/user'

const stored = (page: Page, key: string) =>
  page.evaluate((key) => sessionStorage.getItem(key), key)

test('an ended session is renewed and the user goes on; signing out closes it on the server, and it renews no more', async ({
  page,
  deployment,
  baseURL,
}) => {
  test.skip(
    deployment.authType !== 'cornflow',
    `this deployment signs in with ${deployment.authType}, not with a Cornflow user and password`,
  )
  const { username, password, totpSecret } = credentials()
  await signInThroughForm(page, username, password, totpSecret)
  const firstRefresh = await stored(page, 'refreshToken')
  test.skip(
    !firstRefresh,
    'this backend gives no refresh tokens (before Cornflow 1.4, or turned off)',
  )

  // The backend no longer takes the token the app has, as when it runs out.
  await page.evaluate(() => sessionStorage.setItem('token', 'ended'))
  await page.reload()
  await page.waitForLoadState('networkidle')
  await openSettings(page)
  await expect(page.getByTestId('sign-in-username')).toHaveCount(0)
  expect(await stored(page, 'token'), 'a new token').not.toBe('ended')
  const refresh = await stored(page, 'refreshToken')
  expect(refresh, 'and a new refresh token').not.toBe(firstRefresh)

  const closed = page.waitForResponse(
    (response) =>
      /\/logout\/$/.test(new URL(response.url()).pathname) &&
      response.request().method() === 'POST',
  )
  await signOut(page)
  expect((await closed).status(), 'the server closes the session').toBe(200)
  await expect(page.getByTestId('sign-in-username')).toBeVisible()
  expect(
    await cornflowApiFor(deployment, baseURL).renews(refresh!),
    'its refresh token renews no more',
  ).toBe(false)
})
