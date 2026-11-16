/**
 * User settings, roles management and help.
 * Pages: docs/funcionalidades/ajustes-de-usuario.md, docs/funcionalidades/gestion-de-roles.md, docs/funcionalidades/permisos-por-rol.md,
 * docs/ayuda-y-recorridos.md
 */
import { test } from '@playwright/test'
import { openDemo, settle, shot, reportUnhandled, noSnackbar } from '../helpers.mjs'

test('ajustes de usuario', async ({ page }, testInfo) => {
  const backend = await openDemo(page, testInfo, { overrides: { parameters: { enableDarkMode: true } } })
  await page.goto('/#/user-settings')
  await settle(page)
  await noSnackbar(page)
  await shot(page, 'ajustes-de-usuario')
  await page.getByLabel('Nueva contraseña', { exact: true }).fill('Plan2026')
  await page.getByLabel('Repite la nueva contraseña').fill('Plan20')
  await page.waitForTimeout(400)
  await shot(page, 'ajustes-de-usuario-contrasena', { target: page.locator('[data-testid=settings-password]'), padding: 8 })
  reportUnhandled(backend, testInfo)
})

test('tema oscuro', async ({ page }, testInfo) => {
  const backend = await openDemo(page, testInfo, { overrides: { parameters: { enableDarkMode: true } }, theme: 'dark' })
  await page.goto('/#/history-execution')
  await settle(page)
  await noSnackbar(page)
  await shot(page, 'ajustes-de-usuario-tema-oscuro')
  reportUnhandled(backend, testInfo)
})

test('gestión de roles', async ({ page }, testInfo) => {
  const backend = await openDemo(page, testInfo)
  await page.goto('/#/roles-management')
  await settle(page)
  await noSnackbar(page)
  await shot(page, 'gestion-de-roles')
  await page.locator('.users-table__edit').nth(1).click()
  await page.waitForTimeout(600)
  await shot(page, 'gestion-de-roles-editar-usuario')
  reportUnhandled(backend, testInfo)
})

test('gestión de roles: roles editables', async ({ page }, testInfo) => {
  const backend = await openDemo(page, testInfo, { overrides: { parameters: { allowEditRoles: true } } })
  await page.goto('/#/roles-management')
  await settle(page)
  await noSnackbar(page)
  await page.locator('.role-item').nth(2).click()
  await page.waitForTimeout(500)
  await shot(page, 'gestion-de-roles-editar-roles')
  reportUnhandled(backend, testInfo)
})

test('ayuda: menú, centro de ayuda y licencias', async ({ page }, testInfo) => {
  const backend = await openDemo(page, testInfo)
  await page.goto('/#/history-execution')
  await settle(page)
  await noSnackbar(page)
  await page.locator('[data-testid=help-menu-trigger]').click()
  await page.waitForTimeout(500)
  await shot(page, 'ayuda-menu', { clip: { x: 1040, y: 0, width: 400, height: 340 } })
  await page.getByText('Centro de ayuda').click()
  await page.locator('[data-testid=help-dialog]').waitFor()
  await page.waitForTimeout(500)
  await shot(page, 'ayuda-centro-de-ayuda')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  await page.locator('[data-testid=help-menu-trigger]').click()
  await page.getByText('Licencias').click()
  await page.locator('[data-testid=licences-dialog]').waitFor()
  await page.waitForTimeout(500)
  await shot(page, 'ayuda-licencias')
  reportUnhandled(backend, testInfo)
})

test('ayuda: recorrido guiado', async ({ page }, testInfo) => {
  const backend = await openDemo(page, testInfo)
  await page.goto('/#/history-execution')
  await settle(page)
  await noSnackbar(page)
  await page.locator('[data-testid=help-menu-trigger]').click()
  await page.locator('[data-testid=help-menu-page-tour]').click()
  await page.locator('[data-testid=core-tour-card]').waitFor()
  await page.locator('[data-testid=core-tour-next]').click()
  await page.locator('[data-testid=core-tour-next]').click()
  await page.waitForTimeout(800)
  await shot(page, 'ayuda-recorrido')
  reportUnhandled(backend, testInfo)
})
