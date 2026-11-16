/**
 * Structure of the app: side menu, execution tabs, execution summary, staging notice, warnings
 * and several DAGs.
 * Pages: docs/funcionalidades/menu-lateral.md, docs/funcionalidades/barra-de-pestanas.md, docs/funcionalidades/resumen-de-ejecucion.md,
 * docs/funcionalidades/entorno-de-pruebas.md, docs/funcionalidades/avisos.md, docs/funcionalidades/varios-dags.md
 */
import { test } from '@playwright/test'
import { demoExecutions, demoRunningExecution, DEMO_DAG, DEMO_SECOND_DAG } from '../demoData.mjs'
import { openDemo, settle, shot, reportUnhandled, noSnackbar, loadExecution, pinDrawer, go } from '../helpers.mjs'

const withRunning = { executions: [demoRunningExecution, ...demoExecutions] }

test('menú lateral: plegado y desplegado', async ({ page }, testInfo) => {
  const backend = await openDemo(page, testInfo, { mock: withRunning })
  await loadExecution(page, 1)
  await page.goto('/#/history-execution')
  await settle(page)
  await shot(page, 'menu-lateral-plegado', { clip: { x: 0, y: 0, width: 320, height: 900 } })
  await pinDrawer(page)
  await page.locator('[data-testid=app-drawer]').getByText('Datos de entrada').first().click()
  await page.waitForTimeout(300)
  await page.locator('[data-testid=app-drawer]').getByText('Datos de entrada').nth(1).click()
  await settle(page)
  await noSnackbar(page)
  await shot(page, 'menu-lateral-desplegado')
  reportUnhandled(backend, testInfo)
})

test('menú lateral: sin ejecución cargada y últimas ejecuciones', async ({ page }, testInfo) => {
  const backend = await openDemo(page, testInfo, { mock: withRunning })
  await page.goto('/#/history-execution')
  await settle(page)
  await pinDrawer(page)
  await shot(page, 'menu-lateral-sin-ejecucion', { target: page.locator('[data-testid=app-drawer]') })
  await page.locator('[data-testid=app-drawer-execution]').click()
  await page.locator('[data-testid=drawer-executions]').waitFor()
  await settle(page, 600)
  await shot(page, 'menu-lateral-ultimas-ejecuciones', { clip: { x: 0, y: 0, width: 720, height: 560 } })
  reportUnhandled(backend, testInfo)
})

test('barra de pestañas y resumen de la ejecución', async ({ page }, testInfo) => {
  const backend = await openDemo(page, testInfo, { mock: withRunning })
  await loadExecution(page, 0)
  await loadExecution(page, 3)
  await loadExecution(page, 1)
  await go(page, '/results/group/datos-de-la-solucin/plan_produccion')
  await noSnackbar(page)
  await shot(page, 'barra-de-pestanas', { clip: { x: 0, y: 820, width: 1440, height: 80 } })
  const summary = page.locator('[data-testid=execution-summary]')
  await shot(page, 'resumen-de-ejecucion', { target: summary, padding: 12 })
  await summary.getByText('Plan semana 44', { exact: false }).first().hover()
  await page.waitForTimeout(900)
  await shot(page, 'resumen-de-ejecucion-detalle', { keepPointer: true, clip: { x: 560, y: 0, width: 880, height: 620 } })
  reportUnhandled(backend, testInfo)
})

test('entorno de pruebas', async ({ page }, testInfo) => {
  const backend = await openDemo(page, testInfo, { mock: { values: { isStagingEnvironment: true } } })
  await page.goto('/#/history-execution')
  await settle(page)
  await noSnackbar(page)
  await shot(page, 'entorno-de-pruebas', { clip: { x: 0, y: 0, width: 1440, height: 260 } })
  reportUnhandled(backend, testInfo)
})

test('avisos', async ({ page }, testInfo) => {
  const backend = await openDemo(page, testInfo, {
    overrides: { parameters: { enableWarnings: true } },
    mock: {
      warnings: [
        { message: 'La planta P03 no tiene calendario cargado para la semana 47.' },
        { message: 'El producto B-210 no tiene coste unitario.' },
        { message: 'La demanda de la semana 46 se actualizó después del último plan.' },
      ],
    },
  })
  await page.goto('/#/history-execution')
  await settle(page)
  await noSnackbar(page)
  await page.locator('[data-testid=warnings-trigger]').click()
  await page.locator('[data-testid=warnings-panel]').waitFor()
  await settle(page, 500)
  await shot(page, 'avisos', { clip: { x: 840, y: 0, width: 600, height: 460 } })
  reportUnhandled(backend, testInfo)
})

const severalDags = {
  overrides: { parameters: { schemaLabels: { [DEMO_DAG]: 'Producción', [DEMO_SECOND_DAG]: 'Inventario' } } },
  mock: {
    values: { schema: `${DEMO_DAG},${DEMO_SECOND_DAG}` },
    grantedSchemas: [DEMO_DAG, DEMO_SECOND_DAG],
  },
}

test('varios DAGs: selector de módulo', async ({ page }, testInfo) => {
  const backend = await openDemo(page, testInfo, severalDags)
  await page.goto('/#/history-execution')
  await settle(page)
  await noSnackbar(page)
  await pinDrawer(page)
  await page.locator('[data-testid=app-drawer-module]').click()
  await page.locator(`[data-testid=app-drawer-module-${DEMO_SECOND_DAG}]`).waitFor()
  await page.waitForTimeout(400)
  await shot(page, 'varios-dags-selector', { clip: { x: 0, y: 0, width: 620, height: 420 } })
  reportUnhandled(backend, testInfo)
})

test('varios DAGs: confirmación al cambiar', async ({ page }, testInfo) => {
  const backend = await openDemo(page, testInfo, severalDags)
  await loadExecution(page, 0)
  await pinDrawer(page)
  await page.locator('[data-testid=app-drawer-module]').click()
  await page.locator(`[data-testid=app-drawer-module-${DEMO_SECOND_DAG}]`).click()
  await page.locator('[data-testid=app-drawer-module-dialog]').waitFor()
  await page.waitForTimeout(400)
  await shot(page, 'varios-dags-confirmacion')
  reportUnhandled(backend, testInfo)
})

test('varios DAGs: sin acceso a ningún módulo', async ({ page }, testInfo) => {
  const backend = await openDemo(page, testInfo, { ...severalDags, mock: { ...severalDags.mock, grantedSchemas: [] } })
  await page.goto('/#/history-execution')
  await settle(page)
  await noSnackbar(page)
  await shot(page, 'varios-dags-sin-acceso')
  reportUnhandled(backend, testInfo)
})
