/**
 * Recovering a forgotten password, signed out (project `chromium-auth-tests`): asking for the link
 * from the sign-in page, and the page the link opens. The request is for an address no account
 * has (`.invalid`), so nobody gets an e-mail; and the link of an e-mail cannot be had here, so the
 * page is tried with a token that is no link's.
 */
import { test, expect } from '../../harness/fixtures'
import { newPassword, randomHex } from '../../harness/cornflowApi'
import { goToRoute } from '../../harness/navigation'
import { recordToasts } from '../../harness/toasts'

test.beforeEach(({ deployment }) => {
  test.skip(
    deployment.authType !== 'cornflow',
    `this deployment signs in with ${deployment.authType}: its passwords are not Cornflow's`,
  )
})

test.describe('recovering the password', () => {
  test('the sign-in page asks for the e-mail to send the link to, and goes back to the password', async ({
    page,
  }) => {
    const toasts = await recordToasts(page)
    await page.goto('/')
    const form = page.locator('[data-step]')
    await page.getByTestId('sign-in-forgot').click()
    await expect(form).toHaveAttribute('data-step', 'forgot')

    // Back, and there again.
    await page.getByTestId('sign-in-back').click()
    await expect(form).toHaveAttribute('data-step', 'credentials')
    await page.getByTestId('sign-in-forgot').click()

    const email = page.getByTestId('sign-in-forgot-email')
    await page.getByTestId('sign-in-forgot-submit').click()
    await expect(email, 'it needs the e-mail').toHaveAttribute(
      'aria-invalid',
      'true',
    )

    await email.fill(`nobody_${randomHex(8)}@example.invalid`)
    const answer = page.waitForResponse(
      (response) =>
        /\/user\/recover-password\/$/.test(new URL(response.url()).pathname) &&
        response.request().method() === 'PUT',
    )
    await page.getByTestId('sign-in-forgot-submit').click()
    const status = (await answer).status()

    // The same whether the e-mail has an account or not: it never tells.
    if (status === 200) {
      await expect
        .poll(() => toasts.map((toast) => toast.kind))
        .toContain('success')
      await expect(form, 'back at the password').toHaveAttribute(
        'data-step',
        'credentials',
      )
      return
    }
    expect(
      [429, 501],
      'sent, or turned down by the limit of requests or for want of e-mail',
    ).toContain(status)
    test.info().annotations.push({
      type: 'note',
      description:
        status === 429
          ? 'the backend took no more requests from this address for now (a few an hour): the ' +
            'app says so, and does not say it was sent'
          : 'this backend sends no e-mails (501): the app says the link could not be sent',
    })
    await expect
      .poll(() => toasts.map((toast) => toast.kind))
      .toContain('error')
    await expect(form, 'still on the e-mail').toHaveAttribute(
      'data-step',
      'forgot',
    )
  })

  test('the page of the link, opened without its token, says the link is not whole, and goes to sign in', async ({
    page,
  }) => {
    await goToRoute(page, '/reset-password')
    await expect(page.getByTestId('reset-password-missing-token')).toBeVisible()
    await expect(page.getByTestId('reset-password-form')).toHaveCount(0)

    await page.getByTestId('reset-password-back').click()
    await expect(page.getByTestId('sign-in-username')).toBeVisible()
  })

  test("with a token that is no link's, the page takes a new password that meets every rule, and says the link has expired", async ({
    page,
  }) => {
    await goToRoute(page, '/reset-password?token=not-a-reset-link')
    await expect(page.getByTestId('reset-password-form')).toBeVisible()
    expect(page.url(), 'the token goes from the address').not.toContain(
      'not-a-reset-link',
    )

    const field = page.getByTestId('reset-password-new')
    const confirm = page.getByTestId('reset-password-confirm')
    const submit = page.getByTestId('reset-password-submit')
    const rules = page.locator('[data-testid^="reset-password-rule-"]')

    await field.fill('abc')
    await expect(
      page.getByTestId('reset-password-rule-length'),
      'too short',
    ).not.toHaveClass(/\bis-met\b/)
    await expect(submit).toBeDisabled()

    const password = newPassword()
    await field.fill(password)
    await confirm.fill(`${password}x`)
    await expect(submit, 'not the same twice').toBeDisabled()

    await confirm.fill(password)
    for (const rule of await rules.all())
      await expect(
        rule,
        `the rule "${(await rule.getAttribute('data-testid'))!.slice('reset-password-rule-'.length)}" is met`,
      ).toHaveClass(/\bis-met\b/)
    await expect(submit).toBeEnabled()
    await submit.click()

    await expect(page.getByTestId('reset-password-link-expired')).toBeVisible()
    await expect(page.getByTestId('reset-password-form')).toHaveCount(0)
  })
})
