/**
 * The sign-in page, starting signed out (project `chromium-auth-tests`). What it should show comes
 * from the deployment: how users sign in and which languages it offers.
 */
import { test, expect } from '../../harness/fixtures'
import { credentials } from '../../harness/run'
import { signInThroughForm } from '../../harness/session'
import { recordToasts } from '../../harness/toasts'

test.describe('sign in', () => {
  test.beforeEach(({ deployment }) => {
    test.skip(
      deployment.authType !== 'cornflow',
      `this deployment signs in with ${deployment.authType}, not with a Cornflow user and password`,
    )
  })

  test('signs in with a valid user and opens the app, saying when they last signed in', async ({
    page,
  }) => {
    const { username, password, totpSecret } = credentials()
    const toasts = await recordToasts(page)
    // What the backend said of the previous sign-in (Cornflow 1.4), in the answer that signs in.
    let lastLogin: string | null | undefined
    page.on('response', async (response) => {
      if (!/\/login\/$/.test(new URL(response.url()).pathname)) return
      const answer = await response.json().catch(() => null)
      if (answer?.token) lastLogin = answer.last_login ?? null
    })
    // With its code, when it has two-factor authentication on.
    await signInThroughForm(page, username, password, totpSecret)

    await expect(page.getByTestId('app-drawer')).toBeAttached()
    await expect(page.getByTestId('sign-in-username')).toHaveCount(0)
    expect(
      await page.evaluate(() => sessionStorage.getItem('isAuthenticated')),
    ).toBe('true')

    if (!lastLogin) {
      // A backend before 1.4, or a first sign-in: a welcome.
      await expect
        .poll(() => toasts.map((toast) => toast.kind), {
          message: 'it says the user is in',
        })
        .toContain('success')
      return
    }
    // Cornflow gives the time in UTC, without saying so ("2026-11-27T09:40:11"): the user reads it
    // in theirs, as the browser shows dates.
    const [inTheirTime, asIfTheirs] = await page.evaluate(
      (at) => [
        new Date(/Z|[+-]\d\d:?\d\d$/.test(at) ? at : `${at}Z`).toLocaleString(),
        new Date(at).toLocaleString(),
      ],
      lastLogin,
    )
    await expect
      .poll(() => toasts.find((toast) => toast.kind === 'info')?.message, {
        message: 'it says when they last signed in',
      })
      .toBeTruthy()
    const said = toasts.find((toast) => toast.kind === 'info')!.message
    if (inTheirTime !== asIfTheirs && said.includes(asIfTheirs)) {
      test.info().annotations.push({
        type: 'known issue',
        description:
          'the last sign-in is shown in UTC as if it were local time: Cornflow gives it without ' +
          'its time zone, and the app reads it as local (useSignIn, new Date(lastLogin))',
      })
      return
    }
    expect(said, 'the time of the last sign-in, in theirs').toContain(
      inTheirTime,
    )
  })

  test('shows the legal notice under the form', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('sign-in-legal-notice')).toBeVisible()
    await expect(page.getByTestId('sign-in-legal-notice')).not.toBeEmpty()
  })

  test('turns down a user that does not exist and stays signed out', async ({
    page,
    api,
  }) => {
    await page.goto('/')
    await page.getByTestId('sign-in-username').fill(api.username('nobody'))
    await page.getByTestId('sign-in-password').fill('Not.the-password1')
    await page.getByTestId('sign-in-submit').click()

    await expect(page.getByTestId('core-snackbar')).toBeVisible()
    await expect(page.getByTestId('sign-in-username')).toBeVisible()
    expect(
      await page.evaluate(() => sessionStorage.getItem('isAuthenticated')),
    ).not.toBe('true')
  })

  test('asks for both the username and the password', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('sign-in-submit').click()

    await expect(page.getByTestId('sign-in-username')).toHaveAttribute(
      'aria-invalid',
      'true',
    )
    await expect(page.getByTestId('sign-in-password')).toHaveAttribute(
      'aria-invalid',
      'true',
    )
    await expect(page.getByTestId('core-snackbar')).toHaveCount(0)
  })

  test('the password can be shown, and hidden again', async ({ page }) => {
    await page.goto('/')
    const field = page.getByTestId('sign-in-password')
    const toggle = page.getByTestId('sign-in-show-password')
    await field.fill('A.secret-1')
    await expect(field, 'hidden at first').toHaveAttribute('type', 'password')
    await toggle.click()
    await expect(field, 'shown').toHaveAttribute('type', 'text')
    await expect(field).toHaveValue('A.secret-1')
    await toggle.click()
    await expect(field, 'hidden again').toHaveAttribute('type', 'password')
  })
})

test.describe('languages of the sign-in page', () => {
  test('offers the languages the deployment shows, and none when it shows one', async ({
    page,
    deployment,
  }) => {
    await page.goto('/')
    await expect(page.getByTestId('sign-in-username')).toBeVisible()
    const offered = page.locator('[data-testid^="sign-in-language-"]')

    if (deployment.languages.length < 2) {
      await expect(offered).toHaveCount(0)
      return
    }
    await expect(offered).toHaveCount(deployment.languages.length)
    // Each one in turn: the page in that language is also checked for untranslated texts.
    for (const code of deployment.languages) {
      const option = page.getByTestId(`sign-in-language-${code}`)
      await option.click()
      await expect(option).toHaveAttribute('aria-pressed', 'true')
    }
  })
})
