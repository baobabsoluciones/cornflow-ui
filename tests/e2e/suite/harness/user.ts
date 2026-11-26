/**
 * The user's own corner of the app: the settings page (account, appearance, language and
 * password), reached from the user at the foot of the side menu, and signing out from there.
 */
import { expect, type Page } from '@playwright/test'
import { leaveMenu, unfoldMenu } from './navigation'

export const USER_SETTINGS = '/user-settings'

/** Opens the user's settings from the side menu, as a user does. */
export async function openSettings(page: Page): Promise<void> {
  await unfoldMenu(page)
  await page.getByTestId('app-drawer-user').click()
  await page.waitForURL((url) => url.href.endsWith(USER_SETTINGS))
  await leaveMenu(page)
  await expect(page.getByTestId('settings-language')).toBeVisible()
}

/** Signs out from the side menu: it asks first, and the user confirms or, with `confirm: false`, cancels. */
export async function signOut(
  page: Page,
  { confirm = true }: { confirm?: boolean } = {},
): Promise<void> {
  await unfoldMenu(page)
  await page.getByTestId('app-drawer-logout').click()
  const button = page.getByTestId(
    confirm ? 'confirm-dialog-confirm' : 'confirm-dialog-cancel',
  )
  await button.click()
  await expect(button).toBeHidden()
  if (!confirm) await leaveMenu(page)
}

/**
 * Switches the app to `language` (one of `describe().languages`) from the user's settings, as a
 * user does, and stays there.
 */
export async function chooseLanguage(
  page: Page,
  languages: string[],
  language: string,
): Promise<void> {
  await openSettings(page)
  const select = page.getByTestId('settings-language')
  // The options are positions; what they stand for is in the order of `languages`.
  const position = String(languages.indexOf(language))
  if ((await select.inputValue()) === position) return
  const title = page.locator('#settings-language-title')
  const before = await title.innerText()
  await select.selectOption(position)
  await expect(title, `the app is in ${language}`).not.toHaveText(before)
}
