/**
 * What a user does for the security of their account from their settings (Cornflow 1.4): turning
 * two-factor authentication on and resetting it, and their personal API key. Only in disposable
 * mode, each test as a user it creates: a reset closes every session of the user, and a new key
 * replaces the one they had, which never happens to a user others sign in with.
 */
import { test, expect } from '../../harness/fixtures'
import { cornflowApiFor } from '../../harness/run'
import { signInThroughForm, submitSignInForm } from '../../harness/session'
import { newTestUser, userWithTwoFactor } from '../../harness/testUsers'
import { claimTotpCode, staleTotpCode } from '../../harness/totp'
import { recordToasts } from '../../harness/toasts'
import { openSettings, signOut } from '../../harness/user'

// Signed out: each test signs in as a user it creates.
test.use({ session: null })

test.beforeEach(({ deployment, run }) => {
  test.skip(
    deployment.authType !== 'cornflow',
    `this deployment signs in with ${deployment.authType}: its accounts are not Cornflow's`,
  )
  test.skip(
    run.mode !== 'disposable',
    'only in disposable mode: each test changes a user it creates',
  )
})

test.describe('two-factor authentication in the settings', () => {
  test('turns it on: QR code, secret and the first code, then the backup codes once; from then on the sign-in asks for a code', async ({
    page,
    api,
  }) => {
    const user = await newTestUser(api, 'mfa_on')
    test.skip(
      !!user.mfaRequired,
      'the server requires two-factor authentication: every user has it from the start (turning ' +
        'it on is tested at the first sign-in)',
    )
    const toasts = await recordToasts(page)
    await signInThroughForm(page, user.username, user.password)
    await openSettings(page)
    const status = page.getByTestId('settings-mfa-status')
    await expect(status, 'it says it is off').toHaveClass(
      /\bcore-tone--neutral\b/,
    )

    const enable = page.getByTestId('settings-mfa-enable')
    const enroll = page.getByTestId('settings-mfa-enroll')
    const unavailable = page.getByTestId('settings-mfa-unavailable')
    await enable.click()
    await expect(enroll.or(unavailable)).toBeVisible()
    test.skip(
      await unavailable.isVisible(),
      'this backend has no two-factor authentication',
    )

    // Cancelled half-way, it is as before.
    await page.getByTestId('settings-mfa-cancel').click()
    await expect(enable).toBeVisible()
    await enable.click()

    await expect(page.getByTestId('settings-mfa-qr')).toHaveAttribute(
      'src',
      /^data:image\//,
    )
    const secret = (
      await page.getByTestId('settings-mfa-secret').innerText()
    ).trim()
    expect(secret, 'the secret, to type it in').toMatch(/^[A-Z2-7]{16,}=*$/)

    const code = page.getByTestId('settings-mfa-code')
    const verify = page.getByTestId('settings-mfa-verify')
    await expect(verify, 'not without a code').toBeDisabled()
    await code.fill(staleTotpCode(secret))
    await verify.click()
    await expect
      .poll(() => toasts.map((toast) => toast.kind))
      .toContain('error')
    await expect(enroll, 'a wrong code turns nothing on').toBeVisible()

    await code.fill(await claimTotpCode(secret, user.username))
    await verify.click()
    const backupCodes = page
      .getByTestId('settings-mfa-backup-codes')
      .locator('code')
    await expect(backupCodes.first()).toBeVisible()
    for (const backupCode of await backupCodes.allInnerTexts())
      expect(backupCode.trim()).not.toBe('')
    toasts.length = 0
    await page.getByTestId('settings-mfa-backup-done').click()
    await expect
      .poll(() => toasts.map((toast) => toast.kind))
      .toContain('success')
    await expect(backupCodes, 'shown once').toHaveCount(0)
    await expect(status, 'it says it is on').toHaveClass(
      /\bcore-tone--success\b/,
    )
    await expect(page.getByTestId('settings-mfa-reset')).toBeVisible()
    expect((await api.user(user.id)).mfa_enabled, 'the backend has it on').toBe(
      true,
    )

    await signOut(page)
    expect(
      await submitSignInForm(page, user.username, user.password),
      'the sign-in asks for a code',
    ).toBe('mfa-code')
  })

  test('resetting it asks first; confirmed, the session closes, and the next sign-in asks for no code, or to turn it on again where the server requires it', async ({
    page,
    api,
  }) => {
    const user = await userWithTwoFactor(api, 'mfa_reset')
    const toasts = await recordToasts(page)
    await signInThroughForm(page, user.username, user.password, user.totpSecret)
    await openSettings(page)
    const status = page.getByTestId('settings-mfa-status')
    const reset = page.getByTestId('settings-mfa-reset')
    await expect(status, 'it says it is on').toHaveClass(
      /\bcore-tone--success\b/,
    )

    await reset.click()
    await page.getByTestId('confirm-dialog-cancel').click()
    await expect(status, 'cancelled, it stays on').toHaveClass(
      /\bcore-tone--success\b/,
    )
    expect((await api.user(user.id)).mfa_enabled).toBe(true)

    toasts.length = 0
    await reset.click()
    await page.getByTestId('confirm-dialog-confirm').click()
    await expect(
      page.getByTestId('sign-in-username'),
      'the session closes',
    ).toBeVisible()
    await expect
      .poll(() => toasts.map((toast) => toast.kind))
      .toContain('success')
    expect(
      (await api.user(user.id)).mfa_enabled,
      'the backend has it off',
    ).toBe(false)

    expect(
      await submitSignInForm(page, user.username, user.password),
      user.mfaRequired
        ? 'the server requires it: the sign-in asks to turn it on again'
        : 'the sign-in asks for no code',
    ).toBe(user.mfaRequired ? 'mfa-enroll' : 'signed in')
  })
})

test.describe('personal API key', () => {
  test('generated read-only, and shown once: it reads, and does not write', async ({
    page,
    api,
    deployment,
    baseURL,
  }) => {
    const user = await newTestUser(api, 'api_key')
    const toasts = await recordToasts(page)
    await signInThroughForm(page, user.username, user.password, user.totpSecret)
    await openSettings(page)
    const card = page.getByTestId('settings-api-key')
    test.skip(
      (await card.count()) === 0,
      'the app offers no personal API keys (enablePersonalTokens)',
    )

    const code = page.getByTestId('settings-api-key-code')
    const generate = page.getByTestId('settings-api-key-generate')
    if (user.totpSecret) {
      // With two-factor authentication on, a fresh code confirms it.
      await expect(generate, 'not without a code').toBeDisabled()
      await code.fill(await claimTotpCode(user.totpSecret, user.username))
    } else {
      await expect(code, 'no code without two-factor').toHaveCount(0)
    }
    const readOnly = page.getByTestId('settings-api-key-read-only')
    await readOnly.click()
    await expect(readOnly).toHaveAttribute('aria-checked', 'true')

    const answer = page.waitForResponse(
      (response) =>
        /\/user\/api-key\/$/.test(new URL(response.url()).pathname) &&
        response.request().method() === 'POST',
    )
    await generate.click()
    const status = (await answer).status()
    if (status === 501) {
      await expect(page.getByTestId('settings-api-key-disabled')).toBeVisible()
      test.info().annotations.push({
        type: 'note',
        description:
          'this backend has personal API keys turned off (501): the app says so',
      })
      return
    }
    expect(status, 'the backend makes it').toBe(201)
    await expect
      .poll(() => toasts.map((toast) => toast.kind))
      .toContain('success')
    const key = (
      await page.getByTestId('settings-api-key-value').innerText()
    ).trim()
    expect(key).not.toBe('')

    const asKey = cornflowApiFor(deployment, baseURL)
    asKey.useToken(key)
    try {
      await expect(asKey.schemaNames(), 'it reads').resolves.toBeTruthy()
      await expect(
        asKey.createInstance({
          schema: deployment.schemas[0],
          data: {},
          label: 'api_key',
        }),
        'it does not write',
      ).rejects.toMatchObject({ status: 403 })
    } finally {
      await asKey.cleanup()
    }

    await page.reload()
    await expect(card).toBeVisible()
    await expect(
      page.getByTestId('settings-api-key-result'),
      'shown once',
    ).toHaveCount(0)
  })
})
