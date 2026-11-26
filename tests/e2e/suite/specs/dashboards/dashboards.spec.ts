/**
 * The dashboards of a loaded execution:
 *
 * - The automatic dashboard of each table, beside it (`enableAutoInstanceDashboard`,
 *   `enableAutoSolutionDashboard`, and `tableDashboards.<instance|solution>.<table>.showAutoDashboards`
 *   for one table): its KPI cards give the total or the average of a column of the table, as the
 *   backend has it, and its charts draw. Off, the table has none.
 * - The "Dashboard" page (`showDashboardMainView`): in the results, headed by the execution's
 *   summary; without an execution loaded, it says to load one.
 * - The app's own dashboard pages (`dashboardPages`, `instanceDashboardPages`): in the results and
 *   the input data, and they open.
 *
 * Executions are made through the API, solved in a moment (harness/executions.ts).
 */
import type { Page } from '@playwright/test'
import { test, expect } from '../../harness/fixtures'
import { forEachTable } from '../../harness/executionData'
import { solvedExecution, type SolvedExecution } from '../../harness/executions'
import { loadFromHistoryRow, openHistory } from '../../harness/history'
import {
  expectSelected,
  openExecutionView,
  type ExecutionGroup,
} from '../../harness/loadedExecutions'
import {
  currentView,
  goToRoute,
  leaveMenu,
  openMenuGroup,
} from '../../harness/navigation'
import type { Deployment } from '../../harness/run'

type Row = Record<string, unknown>
type DashboardType = 'instance' | 'solution'

/** What `tableDashboards` says of one table. */
interface TableDashboard {
  showAutoDashboards?: boolean
  customWidgets?: unknown[]
}

/** A dashboard page of the app, as the menu has it. */
interface DashboardPage {
  title?: string
  to?: string
  /** Only for these roles, or on these DAGs: the menu tests test that (specs/roles, specs/schemas). */
  roles?: string[]
  schemas?: string[]
}

const TYPE_OF: Record<ExecutionGroup, DashboardType> = {
  'input-data': 'instance',
  results: 'solution',
}

/** The automatic dashboard of a table: whether it is on, and whether the app adds widgets of its own. */
function dashboardOf(
  deployment: Deployment,
  type: DashboardType,
  table: string,
) {
  const parameters = deployment.core.parameters ?? {}
  const own = (parameters.tableDashboards?.[type]?.[table] ??
    {}) as TableDashboard
  const global =
    type === 'instance'
      ? parameters.enableAutoInstanceDashboard === true
      : parameters.enableAutoSolutionDashboard === true
  return {
    auto:
      own.showAutoDashboards !== undefined
        ? own.showAutoDashboards === true
        : global,
    custom: (own.customWidgets?.length ?? 0) > 0,
  }
}

const round = (value: number) => Math.round(value * 100) / 100

/**
 * What a KPI card of a table may show: for each column, the total of its values and their
 * average, as numbers (an empty value counts as 0), rounded to two decimals.
 */
function kpiCandidates(rows: Row[]): number[] {
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))]
  return columns.flatMap((column) => {
    const values = rows
      .map((row) => Number(row[column]))
      .filter((value) => !Number.isNaN(value))
    if (!values.length) return []
    const sum = round(values.reduce((total, value) => total + value, 0))
    return [sum, round(sum / values.length)]
  })
}

/** The KPI cards and charts on the page: those of the table shown. */
const widgetsOf = (page: Page) =>
  page.getByTestId('dashboard-kpi').or(page.getByTestId('dashboard-chart'))

/** Loads an execution from the history and waits until it is selected. */
async function load(page: Page, execution: SolvedExecution): Promise<void> {
  await openHistory(page)
  await loadFromHistoryRow(page, execution.name)
  await expectSelected(page, execution.id, execution.name)
}

/** The addresses the pages of a group of the selected execution link to. */
async function groupLinks(
  page: Page,
  group: ExecutionGroup,
): Promise<string[]> {
  const links = await openMenuGroup(
    page,
    group,
    `the ${group} of the execution`,
  )
  const hrefs = await links.evaluateAll((all) =>
    all.map((link) => link.getAttribute('href') ?? ''),
  )
  await leaveMenu(page)
  return hrefs
}

test.describe('dashboards', () => {
  let schema = ''

  test.beforeEach(({ deployment }) => {
    schema = deployment.schemas[0]
  })

  test("the automatic dashboard of each table: its KPI cards give a total or an average of the table's columns and its charts draw; off, the table has none", async ({
    page,
    api,
    uat,
    deployment,
  }) => {
    const execution = await solvedExecution(api, uat, schema, 'dashboards')
    const data: Record<DashboardType, Record<string, unknown>> = {
      instance: (await api.instanceData(execution.instanceId)).data ?? {},
      solution: (await api.executionData(execution.id)).data ?? {},
    }
    await load(page, execution)
    let shown = 0
    let couldShow = false

    for (const group of ['input-data', 'results'] as const) {
      const type = TYPE_OF[group]
      await forEachTable(page, group, async (table) => {
        const { auto, custom } = dashboardOf(deployment, type, table)
        const widgets = widgetsOf(page)
        if (!auto && !custom) {
          await expect(widgets, `"${table}" has no dashboard`).toHaveCount(0)
          return
        }
        const rows = Array.isArray(data[type][table])
          ? (data[type][table] as Row[])
          : []
        const candidates = kpiCandidates(rows)
        if (auto && candidates.some((value) => value !== 0)) couldShow = true
        // The widgets come once the table is there; a table with nothing to show has none.
        if (
          !(await widgets
            .first()
            .waitFor({ timeout: 5_000 })
            .then(() => true)
            .catch(() => false))
        )
          return
        shown++

        for (const kpi of await page.getByTestId('dashboard-kpi').all()) {
          const value = Number(await kpi.getAttribute('data-value'))
          expect(
            custom || candidates.some((c) => Math.abs(c - value) < 0.005),
            `a KPI of "${table}" (${value}) is the total or the average of one of its columns`,
          ).toBe(true)
        }
        for (const chart of await page.getByTestId('dashboard-chart').all()) {
          const kind = await chart.getAttribute('data-type')
          await expect(
            chart,
            `a ${kind} chart of "${table}" shows`,
          ).toBeVisible()
          if (kind !== 'map') {
            await expect(
              chart.locator('svg').first(),
              `the ${kind} chart of "${table}" draws`,
            ).toBeVisible()
          }
        }
      })
    }
    if (couldShow) {
      expect(
        shown,
        'some table with figures shows its automatic dashboard',
      ).toBeGreaterThan(0)
    }
    test.info().annotations.push({
      type: 'note',
      description: `${shown} tables showed a dashboard`,
    })
  })

  test('the "Dashboard" page: in the results, headed by the execution\'s summary; without an execution loaded, it says to load one', async ({
    page,
    api,
    uat,
    deployment,
  }) => {
    const on = !!deployment.core.parameters?.showDashboardMainView
    const execution = await solvedExecution(api, uat, schema, 'dashboard page')
    await load(page, execution)
    const links = await groupLinks(page, 'results')
    const linked = links.some((href) => href.endsWith('/dashboard'))
    if (!on) {
      test.info().annotations.push({
        type: 'note',
        description:
          'showDashboardMainView is off: the results have no dashboard page',
      })
      expect(linked, 'the results have no dashboard page').toBe(false)
      return
    }
    expect(linked, 'the results have the dashboard page').toBe(true)
    const index = links.findIndex((href) => href.endsWith('/dashboard'))
    await openExecutionView(page, 'results', index)
    expect(currentView(page)).toBe('dashboard')
    await expect(page.getByTestId('execution-summary')).toContainText(
      execution.name,
    )

    // In a new tab, with no execution loaded.
    const fresh = await page.context().newPage()
    await fresh.goto('/')
    await goToRoute(fresh, '/dashboard')
    const empty = fresh.getByTestId('dashboard-no-execution')
    await expect(empty, 'it says to load an execution').toBeVisible()
    await empty.getByRole('button').click()
    await expect
      .poll(() => currentView(fresh), { message: 'to the history' })
      .toBe('history-execution')
    await fresh.close()
  })

  test("the app's own dashboard pages are in the results and the input data of a loaded execution, and open", async ({
    page,
    api,
    uat,
    deployment,
  }) => {
    const pages: { group: ExecutionGroup; page: DashboardPage }[] = [
      ...(deployment.dashboards.solution as DashboardPage[]).map((p) => ({
        group: 'results' as const,
        page: p,
      })),
      ...(deployment.dashboards.instance as DashboardPage[]).map((p) => ({
        group: 'input-data' as const,
        page: p,
      })),
    ].filter(({ page: p }) => p.to && !p.roles && !p.schemas)
    test.skip(
      !pages.length,
      'the app has no dashboard pages of its own (dashboardPages, instanceDashboardPages)',
    )
    const execution = await solvedExecution(api, uat, schema, 'app dashboards')
    await load(page, execution)

    for (const { group, page: dashboard } of pages) {
      await test.step(`${dashboard.to} in the ${group}`, async () => {
        const links = await groupLinks(page, group)
        const index = links.findIndex((href) => href.endsWith(dashboard.to!))
        expect(index, `the ${group} link to ${dashboard.to}`).toBeGreaterThan(
          -1,
        )
        await openExecutionView(page, group, index)
        expect(currentView(page), `${dashboard.to} opens`).not.toBe('not-found')
      })
    }
  })
})
