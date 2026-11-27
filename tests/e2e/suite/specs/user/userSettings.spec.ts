/**
 * The user's own settings and signing out: the account of who is signed in, the language and
 * the appearance the app offers, signing out, and changing the password. The password is changed
 * only in disposable mode, and only for a user the test creates for it: never for a user others
 * sign in with. Cornflow 1.4 cannot delete a user whose password changed (a known fault of
 * Cornflow), so one test goes through it all: the change the server asks for, and the change itself.
 */
import { test, expect } from '../../harness/fixtures'
import { CREATE_EXECUTION } from '../../harness/createExecution'
import { newPassword } from '../../harness/cornflowApi'
import { HISTORY, openHistory } from '../../harness/history'
import { goToRoute, openFromMenu } from '../../harness/navigation'
import { signInThroughForm, submitSignInForm } from '../../harness/session'
import { newTestUser } from '../../harness/testUsers'
import { recordToasts } from '../../harness/toasts'
import { openSettings, signOut, USER_SETTINGS } from '../../harness/user'

test.describe('user settings', () => {
  test('the account shows who is signed in, and their role', async ({
    page,
    run,
  }) => {
    const user = run.sessions.find((session) => session.name === 'default')!
    await openSettings(page)
    const account = page.getByTestId('settings-account')
    await expect(account).toContainText(user.username)
    // In disposable mode the user has the one role the set-up gave them: their other session.
    const role = run.sessions.find(
      (session) =>
        session.username === user.username && session.name !== 'default',
    )?.name
    if (role)
      await expect(account, `it shows the role ${role}`).toContainText(role)
  })

  test('each language the app offers changes its texts, and its pages show none untranslated', async ({
    page,
    deployment,
  }) => {
    await openSettings(page)
    const select = page.getByTestId('settings-language')
    const offered = await select
      .locator('option')
      .evaluateAll((options) =>
        options.map((option) => (option as HTMLOptionElement).value),
      )
    // The options are positions; what they stand for is in the order of `languages`.
    expect(offered, 'it offers the languages of the app').toHaveLength(
      deployment.languages.length,
    )
    test.skip(
      deployment.languages.length < 2,
      'the app shows one language: there is none to change to',
    )

    let before = await page.locator('body').innerText()
    for (const [index, language] of deployment.languages.entries()) {
      await openSettings(page)
      await select.selectOption(offered[index])
      if (index > 0) {
        await expect
          .poll(() => page.locator('body').innerText(), {
            message: `the texts change to ${language}`,
          })
          .not.toBe(before)
      }
      before = await page.locator('body').innerText()
      // The pages the user goes through, in this language: the fixture checks their texts.
      await openHistory(page)
      await openFromMenu(page, CREATE_EXECUTION)
    }
  })

  test('the appearance: light, dark or as the system is, kept for the next visit', async ({
    page,
    deployment,
  }) => {
    const theme = page.locator('body')
    await openSettings(page)
    const control = page.getByTestId('settings-theme')
    if (!deployment.core.parameters?.enableDarkMode) {
      test.info().annotations.push({
        type: 'note',
        description: 'enableDarkMode is off: the app stays light',
      })
      await expect(control).toHaveCount(0)
      await expect(theme).toHaveAttribute('data-theme', 'light')
      return
    }
    const pick = async (value: string) => {
      const option = control.locator(`[data-value="${value}"]`)
      await option.click()
      await expect(option).toHaveAttribute('aria-checked', 'true')
    }

    await pick('dark')
    await expect(theme).toHaveAttribute('data-theme', 'dark')
    await page.reload()
    await expect(theme, 'it is kept for the next visit').toHaveAttribute(
      'data-theme',
      'dark',
    )

    await openSettings(page)
    await page.emulateMedia({ colorScheme: 'dark' })
    await pick('system')
    await expect(theme).toHaveAttribute('data-theme', 'dark')
    await page.emulateMedia({ colorScheme: 'light' })
    await expect(theme, 'it follows the system').toHaveAttribute(
      'data-theme',
      'light',
    )

    await page.emulateMedia({ colorScheme: 'dark' })
    await pick('light')
    await expect(theme).toHaveAttribute('data-theme', 'light')
  })

  test('signing out asks first: cancelled, the user stays; confirmed, the app asks to sign in again', async ({
    page,
  }) => {
    await openHistory(page)
    await signOut(page, { confirm: false })
    await expect(page.getByTestId('app-drawer')).toBeVisible()
    await expect(page.getByTestId('sign-in-username')).toHaveCount(0)

    await signOut(page)
    await expect(page.getByTestId('sign-in-username')).toBeVisible()
    expect(
      await page.evaluate(() => sessionStorage.getItem('token')),
      'the session is gone',
    ).toBeNull()
    await page.goto('/')
    await expect(
      page.getByTestId('sign-in-username'),
      'the app still asks to sign in',
    ).toBeVisible()
  })

  test('the new password can be shown, and hidden again, before saving it', async ({
    page,
    deployment,
  }) => {
    test.skip(
      deployment.authType !== 'cornflow',
      'the password is changed only where users sign in with Cornflow',
    )
    await openSettings(page)
    const fields = page
      .getByTestId('settings-current-password')
      .or(page.getByTestId('settings-new-password'))
      .or(page.getByTestId('settings-confirm-password'))
    const toggle = page.getByTestId('settings-show-passwords')
    // Typed, never saved.
    await page.getByTestId('settings-current-password').fill('Not.saved-1')
    await page.getByTestId('settings-new-password').fill('A.secret-1')
    await page.getByTestId('settings-confirm-password').fill('A.secret-1')
    await expect(fields).toHaveCount(3)
    for (const field of await fields.all())
      await expect(field, 'hidden at first').toHaveAttribute('type', 'password')
    await toggle.click()
    for (const field of await fields.all())
      await expect(field, 'shown').toHaveAttribute('type', 'text')
    await toggle.click()
    for (const field of await fields.all())
      await expect(field, 'hidden again').toHaveAttribute('type', 'password')
  })

  test.describe('the password', () => {
    // Signed out: the test signs in as a user it creates.
    test.use({ session: null })

    test('set by an admin, the user is kept on their settings until they change it; the new one has to meet every rule and the current one be given; the session closes and the new one signs in', async ({
      page,
      api,
      run,
      deployment,
    }) => {
      test.skip(
        run.mode !== 'disposable',
        'the password is changed only in disposable mode',
      )
      test.skip(
        deployment.authType !== 'cornflow',
        'the password is changed only where users sign in with Cornflow',
      )
      // `api` is E2E_USER, an admin in disposable mode, without a session.
      const user = await newTestUser(api, 'password')
      // An admin sets it: the server asks the user to change it.
      const given = newPassword()
      await api.setPassword(user.id, given)
      const toasts = await recordToasts(page)
      expect(
        await submitSignInForm(page, user.username, given, user.totpSecret),
      ).toBe('signed in')
      const forced = page.getByTestId('settings-password-forced')
      await page.waitForURL((url) => url.href.includes(USER_SETTINGS))
      await expect(forced, 'it says why').toBeVisible()
      await expect
        .poll(() => toasts.map((toast) => toast.kind))
        .toContain('warning')
      await goToRoute(page, HISTORY)
      await expect(forced, 'nothing else opens until then').toBeVisible()
      expect(page.url()).toContain(USER_SETTINGS)

      const current = page.getByTestId('settings-current-password')
      const field = page.getByTestId('settings-new-password')
      const confirm = page.getByTestId('settings-confirm-password')
      const save = page.getByTestId('settings-save-password')
      const met = (rule: string) => page.getByTestId(`settings-rule-${rule}`)

      // Too short and without the characters it needs.
      await field.fill('abc')
      await expect(met('length')).not.toHaveClass(/\bis-met\b/)
      await expect(met('characters')).not.toHaveClass(/\bis-met\b/)
      await expect(save).toBeDisabled()

      // A run of six digits or more.
      await field.fill('Abc.def-1234567')
      await expect(met('digits')).not.toHaveClass(/\bis-met\b/)

      // Good, but not the same twice.
      const password = newPassword()
      await field.fill(password)
      await confirm.fill(`${password}x`)
      await expect(met('match')).not.toHaveClass(/\bis-met\b/)
      await expect(save).toBeDisabled()

      // The same twice: every rule the page lists is met, the strength too once it has loaded.
      await confirm.fill(password)
      const rules = await page
        .locator('[data-testid^="settings-rule-"]')
        .evaluateAll((all) =>
          all.map((item) => item.getAttribute('data-testid')!),
        )
      for (const rule of rules)
        await expect(
          page.getByTestId(rule),
          `the rule "${rule.slice('settings-rule-'.length)}" is met`,
        ).toHaveClass(/\bis-met\b/)
      await expect(save, 'not without the current password').toBeDisabled()
      await current.fill(given)
      await expect(save).toBeEnabled()
      await save.click()

      // Cornflow closes every session of the user, this one too: the app asks to sign in again.
      await expect(page.getByTestId('core-snackbar')).toBeVisible()
      await expect(
        page.getByTestId('sign-in-username'),
        'it asks to sign in again',
      ).toBeVisible()
      await expect(
        api.signedInAs(user.username, given, user.totpSecret),
        'the old one no longer signs in',
      ).rejects.toThrow()
      // The new one does, and nothing keeps the user on their settings any more.
      await signInThroughForm(page, user.username, password, user.totpSecret)
      await openHistory(page)
    })
  })
})
