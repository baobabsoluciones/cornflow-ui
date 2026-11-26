/**
 * Deployments that work on several DAGs (`VITE_APP_SCHEMA` names more than one): the picker at the
 * head of the side menu offers those the user may use, and switching to one points the whole app
 * at it. Switching asks first when it would close what the user has open.
 */
import { expect, type Page } from '@playwright/test'
import { leaveMenu, unfoldMenu } from './navigation'

/** The DAG the app is working on. */
export async function activeSchema(page: Page): Promise<string> {
  const drawer = page.getByTestId('app-drawer')
  await expect(drawer).toHaveAttribute('data-schema', /.+/)
  return (await drawer.getAttribute('data-schema'))!
}

/** The picker of DAGs at the head of the unfolded side menu. */
export const schemaPicker = (page: Page) =>
  page.getByTestId('app-drawer-module')

/** Opens the picker of DAGs and returns the DAGs it offers, in order (it stays open). */
export async function openSchemaPicker(page: Page): Promise<string[]> {
  await unfoldMenu(page)
  await schemaPicker(page).click()
  const items = page.locator('[data-testid^="app-drawer-module-"]')
  await expect(items.first()).toBeVisible()
  return items.evaluateAll((all) =>
    all.map((item) =>
      item.getAttribute('data-testid')!.slice('app-drawer-module-'.length),
    ),
  )
}

/**
 * Picks `schema` in the picker of the side menu. When the app asks first (the switch would close
 * what is open), the user confirms, or cancels with `confirm: false`. Returns whether it asked.
 */
export async function switchSchema(
  page: Page,
  schema: string,
  { confirm = true }: { confirm?: boolean } = {},
): Promise<boolean> {
  const before = await activeSchema(page)
  await openSchemaPicker(page)
  await page.getByTestId(`app-drawer-module-${schema}`).click()
  const dialog = page.getByTestId('app-drawer-module-dialog')
  const target = confirm ? schema : before
  // It switches at once, or asks: whichever comes first.
  await expect
    .poll(
      async () =>
        (await dialog.isVisible()) ||
        (await page.getByTestId('app-drawer').getAttribute('data-schema')) ===
          schema,
      { message: `it switches to ${schema}, or asks first` },
    )
    .toBe(true)
  const asked = await dialog.isVisible()
  if (asked) {
    const button = page.getByTestId(
      confirm ? 'confirm-dialog-confirm' : 'confirm-dialog-cancel',
    )
    await button.click()
    await expect(button).toBeHidden()
  }
  await expect(
    page.getByTestId('app-drawer'),
    `the app works on ${target}`,
  ).toHaveAttribute('data-schema', target)
  await leaveMenu(page)
  return asked
}
