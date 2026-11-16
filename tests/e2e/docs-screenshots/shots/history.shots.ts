/**
 * Execution history.
 * Pages: docs/historial-de-ejecuciones.md, docs/estados-de-una-ejecucion.md
 */
import { test } from '@playwright/test'
import { demoExecutions, demoRunningExecution } from '../demoData.mjs'
import { openDemo, settle, shot, reportUnhandled, noSnackbar } from '../helpers.mjs'

const withRunning = { executions: [demoRunningExecution, ...demoExecutions] }

test('historial: lista y detalle', async ({ page }, testInfo) => {
  const backend = await openDemo(page, testInfo, { mock: withRunning })
  await page.goto('/#/history-execution')
  await settle(page)
  await noSnackbar(page)
  await page.locator('[data-testid=history-row]').nth(1).click()
  await settle(page)
  await shot(page, 'historial-de-ejecuciones')
  await shot(page, 'estados-de-una-ejecucion', { target: page.locator('[data-tour=history-list]') })
  // A row with the pointer on it: its actions and the preview of the execution.
  await page.locator('[data-testid=history-row]').nth(3).hover()
  await page.waitForTimeout(900)
  await shot(page, 'historial-de-ejecuciones-fila', { keepPointer: true, clip: { x: 56, y: 90, width: 1384, height: 560 } })
  reportUnhandled(backend, testInfo)
})

test('historial: ejecución en curso', async ({ page }, testInfo) => {
  const backend = await openDemo(page, testInfo, { mock: withRunning })
  await page.goto('/#/history-execution')
  await settle(page)
  await noSnackbar(page)
  await page.locator('[data-testid=history-row]').first().click()
  await page.waitForTimeout(600)
  await shot(page, 'historial-de-ejecuciones-en-curso', { target: page.locator('[data-testid=history-detail]') })
  reportUnhandled(backend, testInfo)
})

test('historial: ejecución con error', async ({ page }, testInfo) => {
  const backend = await openDemo(page, testInfo)
  await page.goto('/#/history-execution')
  await settle(page)
  await noSnackbar(page)
  await page.locator('[data-testid=history-row]').nth(4).click()
  await page.waitForTimeout(600)
  await shot(page, 'historial-de-ejecuciones-error', { target: page.locator('[data-testid=history-detail]') })
  reportUnhandled(backend, testInfo)
})

test('historial: filtros', async ({ page }, testInfo) => {
  const backend = await openDemo(page, testInfo, {
    overrides: {
      parameters: {
        executionFilters: [{ key: 'planta_id', labelKey: 'docsDemo.filters.plant', icon: 'mdi-factory', joinFrom: 'plantas.nombre' }],
      },
    },
  })
  await page.goto('/#/history-execution')
  await settle(page)
  await noSnackbar(page)
  await page.locator('[data-testid=history-add-filter]').click()
  await page.waitForTimeout(600)
  await shot(page, 'filtros-del-historial-anadir', { clip: { x: 56, y: 90, width: 760, height: 560 } })
  await page.keyboard.press('Escape')
  await page.locator('[data-testid=history-filter-planta_id]').click()
  await page.waitForTimeout(600)
  await shot(page, 'filtros-del-historial-tabla', { clip: { x: 56, y: 90, width: 760, height: 420 } })
  await page.keyboard.press('Escape')
  await page.locator('[data-testid=history-filter-date]').click()
  await page.waitForTimeout(600)
  await shot(page, 'filtros-del-historial-fecha', { clip: { x: 56, y: 90, width: 760, height: 460 } })
  reportUnhandled(backend, testInfo)
})

test('historial: sin ejecuciones', async ({ page }, testInfo) => {
  const backend = await openDemo(page, testInfo, { mock: { executions: [] } })
  await page.goto('/#/history-execution')
  await settle(page, 1500)
  await noSnackbar(page)
  await shot(page, 'historial-de-ejecuciones-vacio')
  reportUnhandled(backend, testInfo)
})

test('historial: búsqueda sin coincidencias', async ({ page }, testInfo) => {
  const backend = await openDemo(page, testInfo)
  await page.goto('/#/history-execution')
  await settle(page)
  await noSnackbar(page)
  await page.locator('[data-testid=history-search] input, input[data-testid=history-search]').first().fill('semana 52')
  await page.waitForTimeout(800)
  await shot(page, 'filtros-del-historial-sin-coincidencias', { clip: { x: 56, y: 90, width: 760, height: 560 } })
  reportUnhandled(backend, testInfo)
})

test('historial: límite de 100 ejecuciones', async ({ page }, testInfo) => {
  const many = Array.from({ length: 100 }, (_, i) => {
    const base = demoExecutions[i % demoExecutions.length]
    return { ...base, id: `exec-many-${i}`, name: `${base.name} · v${Math.floor(i / demoExecutions.length) + 1}` }
  })
  const backend = await openDemo(page, testInfo, { mock: { executions: many } })
  await page.goto('/#/history-execution')
  await settle(page)
  await noSnackbar(page)
  await shot(page, 'filtros-del-historial-limite', { clip: { x: 56, y: 90, width: 760, height: 420 } })
  reportUnhandled(backend, testInfo)
})

test('historial: borrar una ejecución', async ({ page }, testInfo) => {
  const backend = await openDemo(page, testInfo)
  await page.goto('/#/history-execution')
  await settle(page)
  await noSnackbar(page)
  await page.locator('[data-testid=history-detail-delete]').click()
  await page.waitForTimeout(600)
  await shot(page, 'historial-de-ejecuciones-borrar')
  reportUnhandled(backend, testInfo)
})
