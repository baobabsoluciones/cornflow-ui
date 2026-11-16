/**
 * Access: the sign-in page and the not-found / forbidden page.
 * Pages: docs/inicio-de-sesion.md, docs/pagina-no-encontrada.md
 */
import { test } from '@playwright/test'
import { openDemo, settle, shot, reportUnhandled, noSnackbar } from '../helpers.mjs'

test('inicio de sesión: diseño con foto', async ({ page }, testInfo) => {
  const backend = await openDemo(page, testInfo, { signedIn: false })
  await page.goto('/#/sign-in')
  await settle(page)
  await shot(page, 'inicio-de-sesion-foto')
  reportUnhandled(backend, testInfo)
})

test('inicio de sesión: diseño de marca', async ({ page }, testInfo) => {
  const backend = await openDemo(page, testInfo, {
    signedIn: false,
    overrides: {
      parameters: {
        login: {
          layout: 'brand',
          subtitle: 'Planificación semanal de la producción',
          description: 'Planifica la producción de todas las plantas a partir de la demanda y la capacidad de cada línea.',
        },
      },
    },
  })
  await page.goto('/#/sign-in')
  await settle(page)
  await shot(page, 'inicio-de-sesion-marca')
  reportUnhandled(backend, testInfo)
})

test('inicio de sesión: credenciales incorrectas', async ({ page }, testInfo) => {
  const backend = await openDemo(page, testInfo, { signedIn: false })
  await page.goto('/#/sign-in')
  await settle(page)
  await page.locator('[data-testid=sign-in-username]').fill('demo')
  await page.locator('[data-testid=sign-in-password]').fill('wrong')
  await page.locator('[data-testid=sign-in-submit]').click()
  await page.waitForTimeout(800)
  await page.locator('[data-testid=core-snackbar]').first().waitFor()
  await shot(page, 'inicio-de-sesion-error', { clip: { x: 380, y: 0, width: 1060, height: 900 } })
  reportUnhandled(backend, testInfo)
})

test('inicio de sesión: proveedor no configurado', async ({ page }, testInfo) => {
  const backend = await openDemo(page, testInfo, { signedIn: false })
  await page.goto('/#/sign-in')
  await settle(page)
  await page.locator('[data-testid=sign-in-microsoft]').click()
  await page.waitForTimeout(800)
  await shot(page, 'inicio-de-sesion-sso-sin-configurar')
  reportUnhandled(backend, testInfo)
})

test('página no encontrada', async ({ page }, testInfo) => {
  const backend = await openDemo(page, testInfo)
  await page.goto('/#/una-pagina-que-no-existe')
  await settle(page)
  await noSnackbar(page)
  await shot(page, 'pagina-no-encontrada-404')
  reportUnhandled(backend, testInfo)
})

test('página sin permiso', async ({ page }, testInfo) => {
  const backend = await openDemo(page, testInfo, {
    overrides: { roles: { planner: { forbidden_views: ['configuration'] } } },
  })
  await page.goto('/#/history-execution')
  await settle(page)
  await page.goto('/#/configuration/plantas')
  await settle(page)
  await noSnackbar(page)
  await shot(page, 'pagina-no-encontrada-403')
  reportUnhandled(backend, testInfo)
})
