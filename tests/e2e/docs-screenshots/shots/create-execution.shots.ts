/**
 * Create execution: data, checks, parameters, launch, draft, relaunch, master tables and
 * developer mode.
 * Pages: docs/crear-ejecucion.md and the pages it links.
 */
import { test, type Page } from '@playwright/test'
import { demoInstanceData } from '../demoData.mjs'
import { openDemo, settle, shot, reportUnhandled, noSnackbar, loadExecution, go } from '../helpers.mjs'

const launchPanel = (page: Page) => page.locator('[data-testid=launch-panel]')

/** The data of week 45 as a JSON file, the way a planner would upload it. */
function weekFile(data: object = demoInstanceData, name = 'demanda_semana_45.json') {
  return { name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) }
}

async function loadFile(page: Page, file = weekFile()) {
  await page.locator('[data-testid=data-card-file-input]').setInputFiles(file)
  await page.locator('[data-testid=data-card-load]').click()
  await settle(page, 800)
  await noSnackbar(page)
}

test('crear ejecución: vacía y con datos', async ({ page }, testInfo) => {
  const backend = await openDemo(page, testInfo)
  await page.goto('/#/project-execution')
  await settle(page)
  await noSnackbar(page)
  await shot(page, 'crear-ejecucion-vacia')
  await loadFile(page)
  await shot(page, 'crear-ejecucion-datos-cargados')
  await shot(page, 'lanzar-ejecucion-falta-algo', { target: launchPanel(page) })
  await page.locator('[data-testid=parameters-advanced]').click()
  await page.waitForTimeout(500)
  await shot(page, 'parametros-y-solver', { target: launchPanel(page) })
  reportUnhandled(backend, testInfo)
})

test('crear ejecución: errores en los datos', async ({ page }, testInfo) => {
  const backend = await openDemo(page, testInfo)
  await page.goto('/#/project-execution')
  await settle(page)
  const broken = JSON.parse(JSON.stringify(demoInstanceData))
  broken.plantas[1].horas_semana = 'ciento cuarenta'
  delete broken.productos[2].nombre
  broken.demanda[4].unidades = 'n/d'
  await loadFile(page, weekFile(broken, 'demanda_semana_45_revisar.json'))
  await shot(page, 'carga-de-datos-errores')
  reportUnhandled(backend, testInfo)
})

test('crear ejecución: comprobaciones', async ({ page }, testInfo) => {
  const backend = await openDemo(page, testInfo)
  await page.goto('/#/project-execution')
  await settle(page)
  await loadFile(page)
  await page.locator('[data-testid=checks-run]').click()
  await page.locator('[data-testid=checks-detail-open]').waitFor({ timeout: 30000 })
  await settle(page, 600)
  await noSnackbar(page)
  await shot(page, 'comprobaciones-de-datos-resultado', { target: launchPanel(page) })
  await page.locator('[data-testid=checks-detail-open]').click()
  await page.locator('[data-testid=checks-detail]').waitFor()
  await settle(page, 600)
  await shot(page, 'comprobaciones-de-datos-detalle')
  reportUnhandled(backend, testInfo)
})

test('crear ejecución: comprobaciones que bloquean', async ({ page }, testInfo) => {
  const backend = await openDemo(page, testInfo, { overrides: { parameters: { enableBlockAdvanceOnCheckErrors: true } } })
  await page.goto('/#/project-execution')
  await settle(page)
  await loadFile(page)
  await page.locator('[data-testid=checks-run]').click()
  await page.locator('[data-testid=checks-detail-open]').waitFor({ timeout: 30000 })
  await settle(page, 600)
  await noSnackbar(page)
  await shot(page, 'comprobaciones-de-datos-bloquean', { target: launchPanel(page) })
  reportUnhandled(backend, testInfo)
})

test('crear ejecución: lanzar y seguirla', async ({ page }, testInfo) => {
  const backend = await openDemo(page, testInfo)
  await page.goto('/#/project-execution')
  await settle(page)
  await loadFile(page)
  await launchPanel(page).getByLabel('Nivel de servicio objetivo (%)').fill('98')
  await page.keyboard.press('Tab')
  await page.waitForTimeout(300)
  await shot(page, 'lanzar-ejecucion-listo', { target: launchPanel(page) })
  await page.locator('[data-testid=launch-panel-resolve]').click()
  await page.locator('[data-testid=launch-result]').waitFor({ timeout: 30000 })
  await settle(page, 800)
  await noSnackbar(page)
  await shot(page, 'lanzar-ejecucion-en-curso')
  reportUnhandled(backend, testInfo)
})

test('crear ejecución: salir a medias y borrador', async ({ page }, testInfo) => {
  const backend = await openDemo(page, testInfo)
  await page.goto('/#/project-execution')
  await settle(page)
  await loadFile(page)
  await page.locator('[data-testid=app-drawer]').hover()
  await page.waitForTimeout(400)
  await page.locator('[data-testid=app-drawer]').getByText('Historial de ejecuciones').first().click()
  await page.locator('[data-testid=exit-save]').waitFor()
  await page.waitForTimeout(400)
  await shot(page, 'borrador-de-ejecucion-salir')
  await page.locator('[data-testid=exit-save]').click()
  await settle(page)
  await go(page, '/project-execution')
  await page.locator('[data-testid=draft-banner]').waitFor()
  await settle(page)
  await noSnackbar(page)
  await shot(page, 'borrador-de-ejecucion-aviso', { clip: { x: 56, y: 0, width: 1384, height: 300 } })
  reportUnhandled(backend, testInfo)
})

test('crear ejecución: modo desarrollador', async ({ page }, testInfo) => {
  const backend = await openDemo(page, testInfo, { mock: { values: { isDeveloperMode: true } } })
  await page.goto('/#/project-execution')
  await settle(page)
  await loadFile(page)
  await launchPanel(page).getByRole('button', { name: 'Más opciones' }).click()
  await page.waitForTimeout(500)
  await shot(page, 'modo-desarrollador-menu', { clip: { x: 900, y: 300, width: 540, height: 600 } })
  await page.getByText('Subir una solución en lugar de resolver').click()
  await page.waitForTimeout(500)
  await shot(page, 'modo-desarrollador', { target: launchPanel(page) })
  reportUnhandled(backend, testInfo)
})

test('relanzar una ejecución', async ({ page }, testInfo) => {
  const backend = await openDemo(page, testInfo)
  await loadExecution(page, 0)
  await go(page, '/input-data/group/datos-de-entrada/plantas')
  await noSnackbar(page)
  await page.locator('[data-testid=core-dropdown-menu-trigger]').first().click()
  await page.waitForTimeout(500)
  await shot(page, 'relanzar-ejecucion-menu', { clip: { x: 840, y: 0, width: 600, height: 300 } })
  await page.getByRole('menuitem', { name: /Crear nueva ejecución a partir/ }).click()
  await settle(page, 800)
  await noSnackbar(page)
  await shot(page, 'relanzar-ejecucion-copia-editable')
  reportUnhandled(backend, testInfo)
})

test('sincronización con tablas maestras', async ({ page }, testInfo) => {
  const backend = await openDemo(page, testInfo, {
    overrides: {
      parameters: {
        enableMasterTableMatching: true,
        enableReplaceMasterWithUploaded: true,
        masterTableMatchingConfig: { compareStrategies: { productos: { matchFields: ['codigo'] } } },
      },
    },
  })
  await page.goto('/#/project-execution')
  await settle(page)
  const data = JSON.parse(JSON.stringify(demoInstanceData))
  data.productos[0].coste_unitario = 0.45
  data.productos.push({ codigo: 'D-400', nombre: 'Caja de cartón', familia: 'Embalaje', coste_unitario: 0.3 })
  await loadFile(page, weekFile(data))
  await page.locator('[data-testid=data-table-tab-productos]').click()
  await settle(page, 800)
  await shot(page, 'sincronizacion-con-tablas-maestras')
  await page.locator('[data-testid=table-source-compare]').click()
  await page.locator('[data-testid=data-comparison]').waitFor()
  await settle(page, 600)
  await shot(page, 'sincronizacion-con-tablas-maestras-comparacion')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  await page.locator('[data-testid=table-source-menu]').click()
  await page.waitForTimeout(500)
  await shot(page, 'sincronizacion-con-tablas-maestras-menu', { clip: { x: 300, y: 80, width: 1140, height: 420 } })
  reportUnhandled(backend, testInfo)
})
