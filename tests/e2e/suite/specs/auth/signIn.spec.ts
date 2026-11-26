/**
 * The sign-in page, starting signed out (project `chromium-auth-tests`). What it should show comes
 * from the deployment: how users sign in and which languages it offers.
 */
import { test, expect } from '../../harness/fixtures'
import { credentials } from '../../harness/run'

test.describe('sign in', () => {
  test.beforeEach(({ deployment }) => {
    test.skip(
      deployment.authType !== 'cornflow',
      `this deployment signs in with ${deployment.authType}, not with a Cornflow user and password`,
    )
  })

  test('signs in with a valid user and opens the app', async ({ page }) => {
    const { username, password } = credentials()
    await page.goto('/')
    await page.getByTestId('sign-in-username').fill(username)
    await page.getByTestId('sign-in-password').fill(password)
    await page.getByTestId('sign-in-submit').click()

    await expect(page.getByTestId('app-drawer')).toBeAttached()
    await expect(page.getByTestId('sign-in-username')).toHaveCount(0)
    expect(
      await page.evaluate(() => sessionStorage.getItem('isAuthenticated')),
    ).toBe('true')
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
