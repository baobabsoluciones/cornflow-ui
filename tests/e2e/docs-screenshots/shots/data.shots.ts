/**
 * The data of an execution (input data, results, validations, KPIs, dashboards), the data tables
 * themselves and the configuration (master data) tables.
 * Pages: docs/funcionalidades/datos-de-entrada.md, docs/funcionalidades/resultados.md, docs/funcionalidades/validaciones.md, docs/funcionalidades/kpis.md,
 * docs/funcionalidades/dashboards.md, docs/funcionalidades/historico-en-dashboards.md, docs/funcionalidades/tablas-de-datos.md,
 * docs/funcionalidades/tablas-de-configuracion.md
 */
import { test, type Page } from '@playwright/test'
import { openDemo, settle, shot, reportUnhandled, noSnackbar, loadExecution, go } from '../helpers.mjs'

const table = (page: Page) => page.locator('[data-testid=data-table]').first()

test('datos de entrada', async ({ page }, testInfo) => {
  const backend = await openDemo(page, testInfo)
  await loadExecution(page, 0)
  await go(page, '/input-data/group/datos-de-entrada/demanda')
  await noSnackbar(page)
  await shot(page, 'datos-de-entrada')
  await go(page, '/input-data/group/datos-de-entrada/parametros')
  await shot(page, 'datos-de-entrada-parametros', { clip: { x: 56, y: 0, width: 1384, height: 420 } })
  await page.locator('[data-testid=core-dropdown-menu-trigger]').first().click()
  await page.waitForTimeout(500)
  await shot(page, 'datos-de-entrada-menu', { clip: { x: 840, y: 0, width: 600, height: 300 } })
  reportUnhandled(backend, testInfo)
})

test('resultados y validaciones', async ({ page }, testInfo) => {
  const backend = await openDemo(page, testInfo)
  await loadExecution(page, 0)
  await go(page, '/results/group/datos-de-la-solucin/plan_produccion')
  await noSnackbar(page)
  await shot(page, 'resultados')
  await go(page, '/input-data/group/validaciones/demanda_sin_linea')
  await noSnackbar(page)
  await shot(page, 'validaciones')
  reportUnhandled(backend, testInfo)
})

test('KPIs en un grupo aparte', async ({ page }, testInfo) => {
  const backend = await openDemo(page, testInfo, {
    overrides: { parameters: { enableKpisResponseMerge: true, kpiTablesDisplayMode: 'separate' } },
    mock: { withKpis: true },
  })
  await loadExecution(page, 0)
  await go(page, '/results/group/tabla-de-kpis/kpis_resumen')
  await noSnackbar(page)
  await shot(page, 'kpis')
  reportUnhandled(backend, testInfo)
})

test('dashboards automáticos', async ({ page }, testInfo) => {
  const backend = await openDemo(page, testInfo, { overrides: { parameters: { enableAutoInstanceDashboard: true } } })
  await loadExecution(page, 0)
  await go(page, '/input-data/group/datos-de-entrada/productos')
  await settle(page, 1500)
  await noSnackbar(page)
  await shot(page, 'dashboards-automaticos')
  reportUnhandled(backend, testInfo)
})

test('dashboard a medida e histórico', async ({ page }, testInfo) => {
  const backend = await openDemo(page, testInfo, { overrides: { demoDashboard: true, parameters: { enableHistoricalKpis: true } } })
  await loadExecution(page, 0)
  await go(page, '/resumen-del-plan')
  await settle(page, 800)
  await noSnackbar(page)
  await shot(page, 'dashboards-a-medida')
  await page.locator('.historical-toggle').getByText('Datos históricos').click()
  await page.waitForTimeout(500)
  const dates = page.locator('.historical-toggle input[type=date]')
  await dates.nth(0).fill('2026-09-01')
  await dates.nth(1).fill('2026-10-20')
  await shot(page, 'historico-en-dashboards-fechas', { clip: { x: 56, y: 0, width: 1384, height: 260 } })
  await page.locator('.historical-toggle').getByRole('button', { name: 'Cargar' }).click()
  await page.locator('.historical-active-chip').waitFor({ timeout: 30000 }).catch(() => {})
  await settle(page, 800)
  await noSnackbar(page)
  await shot(page, 'historico-en-dashboards', { clip: { x: 56, y: 0, width: 1384, height: 260 } })
  reportUnhandled(backend, testInfo)
})

test('tablas de datos: filtros', async ({ page }, testInfo) => {
  const backend = await openDemo(page, testInfo)
  await loadExecution(page, 0)
  await go(page, '/input-data/group/datos-de-entrada/demanda')
  await noSnackbar(page)
  await page.locator('[data-testid=data-table-add-filter]').click()
  await page.waitForTimeout(500)
  await shot(page, 'tablas-de-datos-anadir-filtro', { clip: { x: 260, y: 80, width: 760, height: 520 } })
  await page.getByRole('menuitem', { name: 'Planta' }).first().click().catch(() => page.getByText('Planta', { exact: true }).last().click())
  await page.waitForTimeout(600)
  await shot(page, 'tablas-de-datos-filtro', { clip: { x: 260, y: 80, width: 760, height: 520 } })
  reportUnhandled(backend, testInfo)
})

test('tablas de configuración: lista', async ({ page }, testInfo) => {
  const backend = await openDemo(page, testInfo)
  await page.goto('/#/configuration/group/red/plantas')
  await settle(page)
  await noSnackbar(page)
  await shot(page, 'tablas-de-configuracion')
  await go(page, '/configuration/group/red/calendario')
  await noSnackbar(page)
  await shot(page, 'tablas-de-configuracion-fechas')
  reportUnhandled(backend, testInfo)
})

test('tablas de configuración: cambios pendientes', async ({ page }, testInfo) => {
  const backend = await openDemo(page, testInfo)
  await page.goto('/#/configuration/group/red/plantas')
  await settle(page)
  await noSnackbar(page)
  // Two edits, cell by cell, as in a spreadsheet.
  await table(page).getByText('168', { exact: true }).dblclick()
  await page.keyboard.press('Control+A')
  await page.keyboard.type('180')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(300)
  await table(page).getByText('160', { exact: true }).dblclick()
  await page.keyboard.press('Control+A')
  await page.keyboard.type('176')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(600)
  await noSnackbar(page)
  await shot(page, 'tablas-de-configuracion-edicion')
  await page.locator('[data-testid=data-table-review]').click()
  await page.locator('[data-testid=pending-changes-panel]').waitFor()
  await page.waitForTimeout(600)
  await shot(page, 'tablas-de-configuracion-cambios-pendientes')
  reportUnhandled(backend, testInfo)
})

test('tablas de configuración: carga masiva', async ({ page }, testInfo) => {
  const backend = await openDemo(page, testInfo)
  await page.goto('/#/configuration/group/catalogo/productos')
  await settle(page)
  await noSnackbar(page)
  await page.locator('[data-testid=data-table-actions]').click()
  await page.waitForTimeout(400)
  await page.getByRole('menuitem', { name: 'Carga masiva' }).click()
  await page.waitForTimeout(700)
  await shot(page, 'tablas-de-configuracion-carga-masiva')
  reportUnhandled(backend, testInfo)
})

test('tablas de configuración: cargar todas', async ({ page }, testInfo) => {
  const backend = await openDemo(page, testInfo, { overrides: { parameters: { enableEditAllMasterTables: true } } })
  await page.goto('/#/configuration/group/red/plantas')
  await settle(page)
  await noSnackbar(page)
  await page.locator('[data-testid=core-dropdown-menu-trigger]').first().click()
  await page.waitForTimeout(400)
  await page.getByRole('menuitem', { name: 'Cargar todas las tablas maestras' }).click()
  await page.waitForTimeout(700)
  await shot(page, 'cargar-todas-las-tablas-maestras')
  reportUnhandled(backend, testInfo)
})
