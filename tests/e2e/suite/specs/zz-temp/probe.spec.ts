import { test } from '../../harness/fixtures'
import { solvedExecution } from '../../harness/executions'
import { loadFromHistoryRow, openHistory } from '../../harness/history'
import { expectSelected } from '../../harness/loadedExecutions'
import { unfoldMenu, leaveMenu } from '../../harness/navigation'

test('explore', async ({ page, api, uat, deployment }) => {
  const ex = await solvedExecution(api, uat, deployment.schemas[0], 'explore')
  await openHistory(page)
  await loadFromHistoryRow(page, ex.name)
  await expectSelected(page, ex.id, ex.name)
  for (const group of ['input-data', 'results']) {
    await unfoldMenu(page)
    const section = page.getByTestId(`drawer-group-${group}`)
    const head = section.locator('button[aria-expanded]')
    if ((await head.getAttribute('aria-expanded')) !== 'true') await head.click()
    const links = section.getByRole('link')
    console.log(`PROBE ${group} pages:`, JSON.stringify(await links.evaluateAll((ls) => ls.map((l) => [l.textContent?.trim(), l.getAttribute('href')]))))
    await links.first().click()
    await leaveMenu(page)
    await page.waitForTimeout(2500)
    console.log(`PROBE ${group} url:`, page.url())
    const tables = page.locator('[data-testid="data-table"]')
    console.log(`PROBE ${group} tables:`, JSON.stringify(await tables.evaluateAll((ts) => ts.map((t) => [t.getAttribute('aria-label'), t.getAttribute('data-status'), t.getAttribute('data-rows'), (t as HTMLElement).offsetParent !== null]))))
    console.log(`PROBE ${group} tabs:`, JSON.stringify(await page.locator('.data-table-tabs [role="tab"]').evaluateAll((ts) => ts.map((t) => [t.textContent?.replace(/\s+/g, ' ').trim(), t.getAttribute('aria-selected')]))))
    console.log(`PROBE ${group} buttons:`, JSON.stringify(await page.locator('main [data-testid]').evaluateAll((ts) => [...new Set(ts.map((t) => t.getAttribute('data-testid')))])))
  }
  console.log('PROBE api data:', JSON.stringify(Object.fromEntries(Object.entries((await api.executionData(ex.id)).data ?? {}).map(([k, v]) => [k, Array.isArray(v) ? v.length : typeof v]))))
  const inst = await (await fetch(`http://localhost:5091/instance/${ex.instanceId}/data/`, { headers: { Authorization: `Bearer ${(api as any).token}` } })).json()
  console.log('PROBE api instance:', JSON.stringify(Object.fromEntries(Object.entries(inst.data ?? {}).map(([k, v]) => [k, Array.isArray(v) ? v.length : typeof v]))), 'checks:', JSON.stringify(inst.checks))
})
