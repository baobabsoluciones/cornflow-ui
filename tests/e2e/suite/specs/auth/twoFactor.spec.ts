/**
 * Two-factor authentication at sign-in (Cornflow 1.4), signed out (project `chromium-auth-tests`):
 * the code after the password, a backup code in its place, and turning it on at the first sign-in
 * where the server requires it. Each test signs in as a user it creates, so only in disposable
 * mode: a wrong code counts towards locking an account, and never one others sign in with.
 */
import { test, expect } from '../../harness/fixtures'
import {
  signInStep,
  submitSignIn,
  submitSignInForm,
} from '../../harness/session'
import { userWithTwoFactor } from '../../harness/testUsers'
import { claimTotpCode, staleTotpCode } from '../../harness/totp'
import { recordToasts } from '../../harness/toasts'
import { signOut } from '../../harness/user'

test.beforeEach(({ deployment, run }) => {
  test.skip(
    deployment.authType !== 'cornflow',
    `this deployment signs in with ${deployment.authType}, not with a Cornflow user and password`,
  )
  test.skip(
    run.mode !== 'disposable',
    'only in disposable mode: each test signs in as a user it creates',
  )
})

test.describe('two-factor authentication at sign-in', () => {
  test('asks for the code after the password: a wrong one is turned down, back goes to the password, and the right one signs in', async ({
    page,
    api,
  }) => {
    const user = await userWithTwoFactor(api, 'mfa_code')
    const toasts = await recordToasts(page)
    expect(
      await submitSignInForm(page, user.username, user.password),
      'it asks for the code',
    ).toBe('mfa-code')

    const code = page.getByTestId('sign-in-mfa-code')
    await code.fill(staleTotpCode(user.totpSecret!))
    await submitSignIn(page, page.getByTestId('sign-in-mfa-submit'))
    await expect
      .poll(() => toasts.map((toast) => toast.kind))
      .toContain('error')
    await expect(page.locator('[data-step]')).toHaveAttribute(
      'data-step',
      'mfa-code',
    )
    await expect(code, 'the wrong code is cleared').toHaveValue('')

    await page.getByTestId('sign-in-back').click()
    await expect(page.locator('[data-step]')).toHaveAttribute(
      'data-step',
      'credentials',
    )

    expect(
      await submitSignInForm(
        page,
        user.username,
        user.password,
        user.totpSecret,
      ),
      'with the right code it signs in',
    ).toBe('signed in')
    await expect(page.getByTestId('app-drawer')).toBeAttached()
  })

  test('a backup code signs in in place of the code, once', async ({
    page,
    api,
  }) => {
    const user = await userWithTwoFactor(api, 'mfa_backup')
    const [backupCode] = user.backupCodes ?? []
    expect(backupCode, 'the user has backup codes').toBeTruthy()
    const toasts = await recordToasts(page)

    const signInWithBackupCode = async () => {
      expect(await submitSignInForm(page, user.username, user.password)).toBe(
        'mfa-code',
      )
      await page.getByTestId('sign-in-mfa-code').fill(backupCode)
      await submitSignIn(page, page.getByTestId('sign-in-mfa-submit'))
    }

    await signInWithBackupCode()
    expect(await signInStep(page, 'mfa-code'), 'it signs in').toBe('signed in')
    await signOut(page)
    await expect(page.getByTestId('sign-in-username')).toBeVisible()

    toasts.length = 0
    await signInWithBackupCode()
    await expect
      .poll(() => toasts.map((toast) => toast.kind), {
        message: 'used once, it is turned down',
      })
      .toContain('error')
    await expect(page.locator('[data-step]')).toHaveAttribute(
      'data-step',
      'mfa-code',
    )
  })

  test('where the server requires it, a user without it turns it on at the first sign-in: QR code, secret, first code and backup codes', async ({
    page,
    api,
  }) => {
    const role = await api.roleForTestUsers()
    const user = await api.createUser({
      roleId: role.id,
      label: 'mfa_enroll',
      leaveMfaPending: true,
    })
    test.skip(
      !user.mfaPending,
      'this backend does not require two-factor authentication',
    )
    const toasts = await recordToasts(page)
    expect(
      await submitSignInForm(page, user.username, user.password),
      'it asks to turn it on',
    ).toBe('mfa-enroll')

    await expect(page.getByTestId('sign-in-mfa-qr')).toHaveAttribute(
      'src',
      /^data:image\//,
    )
    const secret = (
      await page.getByTestId('sign-in-mfa-secret').innerText()
    ).trim()
    expect(secret, 'the secret, to type it in').toMatch(/^[A-Z2-7]{16,}=*$/)

    const code = page.getByTestId('sign-in-mfa-enroll-code')
    const verify = page.getByTestId('sign-in-mfa-enroll-submit')
    await code.fill(staleTotpCode(secret))
    await verify.click()
    await expect
      .poll(() => toasts.map((toast) => toast.kind))
      .toContain('error')
    await expect(page.locator('[data-step]')).toHaveAttribute(
      'data-step',
      'mfa-enroll',
    )

    await code.fill(await claimTotpCode(secret, user.username))
    await verify.click()
    await expect(page.locator('[data-step]')).toHaveAttribute(
      'data-step',
      'mfa-backup',
    )
    const backupCodes = page.getByTestId('sign-in-backup-codes').locator('code')
    expect(
      await backupCodes.count(),
      'it shows the backup codes',
    ).toBeGreaterThan(0)
    for (const backupCode of await backupCodes.allInnerTexts())
      expect(backupCode.trim()).not.toBe('')

    await page.getByTestId('sign-in-backup-continue').click()
    await expect(page.getByTestId('app-drawer')).toBeAttached()
    expect((await api.user(user.id)).mfa_enabled, 'the backend has it on').toBe(
      true,
    )
  })
})
