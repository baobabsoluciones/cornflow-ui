/**
 * Deployments that work on several DAGs (`VITE_APP_SCHEMA` names more than one): the picker of the
 * side menu offers the DAGs the user may use and marks the one open; another DAG has its own
 * executions, data and menu entries; switching asks first when it would close what is open; and
 * the DAG picked is kept when the app is reloaded.
 *
 * A deployment of one DAG has nothing to switch: the tests are skipped there, with the reason.
 */
import type { Page } from '@playwright/test'
import { test, expect } from '../../harness/fixtures'
import type { CornflowApi } from '../../harness/cornflowApi'
import {
  CREATE_EXECUTION,
  ExecutionState,
  launchAndWait,
  loadDataset,
  nameExecution,
  offersNewExecution,
  openCreateExecution,
  pickSolution,
} from '../../harness/createExecution'
import { solvedExecution } from '../../harness/executions'
import {
  historyRows,
  historySearch,
  loadFromHistoryRow,
  openHistory,
} from '../../harness/history'
import {
  executionTab,
  expectNoneSelected,
  expectSelected,
} from '../../harness/loadedExecutions'
import {
  currentView,
  goToRoute,
  leaveMenu,
  menuLinks,
  unfoldMenu,
} from '../../harness/navigation'
import type { Deployment } from '../../harness/run'
import {
  activeSchema,
  openSchemaPicker,
  schemaPicker,
  switchSchema,
} from '../../harness/schemas'
import { executionTimeout } from '../../harness/timing'
import { readDataset, type Uat } from '../../harness/uat'

/** A section of the app's own (`appSections`), as `describe()` gives it: as the menu has it. */
interface AppSection {
  /** Its address (`/reports`); none for a heading over its pages. */
  to?: string
  roles?: string[]
  schemas?: string[]
  requiresSelectedExecution?: boolean
  subPages?: AppSection[]
}

/** The DAGs of the deployment the user may use, in the deployment's order. */
async function usableSchemas(
  deployment: Deployment,
  api: CornflowApi,
): Promise<string[]> {
  const granted = await api.schemaNames()
  return deployment.schemas.filter((schema) => granted.includes(schema))
}

/** The DAG the app opens with: the deployment's first, or the first the user may use. */
const openingSchema = (deployment: Deployment, usable: string[]) =>
  usable.includes(deployment.schemas[0]) ? deployment.schemas[0] : usable[0]

/**
 * The pages of the app's sections limited to some DAGs, with the DAGs each shows on: those for
 * every role and needing no execution loaded, the only gates this test opens.
 */
function pagesLimitedToSchemas(
  sections: AppSection[],
  inherited?: string[],
): { path: string; schemas: string[] }[] {
  return sections.flatMap((section) => {
    if (section.roles || section.requiresSelectedExecution) return []
    const schemas = section.schemas ?? inherited
    const own =
      section.to && schemas
        ? [{ path: section.to.replace(/^\//, ''), schemas }]
        : []
    return [...own, ...pagesLimitedToSchemas(section.subPages ?? [], schemas)]
  })
}

/** Creates an execution of `schema` from the valid dataset, not run. Returns its name. */
async function notRunExecution(
  api: CornflowApi,
  uat: Uat,
  schema: string,
  label: string,
): Promise<string> {
  const data = readDataset(uat, schema, 'valid')
  test.skip(!data, `the UAT file has no valid dataset for ${schema}`)
  const instanceId = await api.createInstance({ schema, data: data!, label })
  await api.createExecution({
    instanceId,
    schema,
    config: uat.schemas[schema].config,
    label,
    run: false,
  })
  return api.name(label)
}

/** Lists in the history the executions named after `label`. */
async function searchHistory(page: Page, api: CornflowApi, label: string) {
  await openHistory(page)
  await historySearch(page).fill(api.name(label))
}

test.describe('several DAGs', () => {
  /** The DAG the app opens with, and another the user may use. */
  let first = ''
  let second = ''

  test.beforeEach(async ({ deployment, api }) => {
    test.skip(
      deployment.schemas.length < 2,
      'the deployment works on one DAG: there is no other to switch to',
    )
    const usable = await usableSchemas(deployment, api)
    test.skip(
      usable.length < 2,
      `the user may use only ${usable.join(', ') || 'no DAG'} of ${deployment.schemas.join(', ')}`,
    )
    first = openingSchema(deployment, usable)
    second = usable.find((schema) => schema !== first)!
  })

  test('the picker offers the DAGs the user may use, in the order of the deployment, and marks the one open', async ({
    page,
    deployment,
    api,
  }) => {
    const usable = await usableSchemas(deployment, api)
    await openHistory(page)
    expect(await activeSchema(page), 'it opens on its first DAG').toBe(first)
    expect(await openSchemaPicker(page), 'the DAGs offered').toEqual(usable)
    for (const schema of usable) {
      await expect(
        page.getByTestId(`app-drawer-module-${schema}`),
        `${schema} is ${schema === first ? '' : 'not '}marked`,
      ).toHaveAttribute('aria-checked', String(schema === first))
    }
    await page.keyboard.press('Escape')
  })

  test('another DAG has its own executions: the history lists those of the DAG open, and a new one goes to it', async ({
    page,
    api,
    uat,
    deployment,
  }) => {
    await notRunExecution(api, uat, first, `dag ${first}`)
    await notRunExecution(api, uat, second, `dag ${second}`)
    const rows = historyRows(page)

    await searchHistory(page, api, 'dag')
    await expect(rows, `the history of ${first}`).toHaveCount(1)
    await expect(rows).toContainText(api.name(`dag ${first}`))

    await switchSchema(page, second)
    expect(currentView(page), 'it stays on the history').toBe(
      'history-execution',
    )
    await searchHistory(page, api, 'dag')
    await expect(rows, `the history of ${second}`).toHaveCount(1)
    await expect(rows).toContainText(api.name(`dag ${second}`))

    // A new execution: with the data of this DAG, and made on it.
    if (!(await offersNewExecution(page))) return
    test.skip(
      !(await openCreateExecution(page)),
      "the app has its own create-execution flow instead of core's page",
    )
    await loadDataset(page, uat, second, 'valid')
    const name = api.name(`new on ${second}`)
    await nameExecution(page, name)
    // With a solution, where the page takes one (developer mode), so nothing has to be solved.
    const solution = uat.schemas[second].solution
    const developerMode =
      deployment.isDeveloperMode ||
      !!deployment.core.parameters?.isDeveloperMode
    if (developerMode && solution) {
      expect(await pickSolution(page, solution)).toBe('taken')
    }
    const state = await launchAndWait(
      page,
      executionTimeout(uat.schemas[second].config),
    )
    if (developerMode && solution) {
      expect([ExecutionState.NotRun, ExecutionState.SolutionLoaded]).toContain(
        state,
      )
    }
    const made = await api.findExecution(name)
    expect(made, `an execution called "${name}" was made`).not.toBeNull()
    expect((await api.execution(made!.id))!.schema, 'on the DAG open').toBe(
      second,
    )
  })

  test('switching asks first when it would close what is open: cancelled, nothing changes; confirmed, it switches and closes it', async ({
    page,
    api,
    uat,
  }) => {
    const execution = await solvedExecution(api, uat, first, 'dag switch')
    await openHistory(page)
    await loadFromHistoryRow(page, execution.name)
    await expectSelected(page, execution.id, execution.name)

    expect(
      await switchSchema(page, second, { confirm: false }),
      'it asks first with an execution open',
    ).toBe(true)
    await expect(
      executionTab(page, execution.id),
      'the execution stays open',
    ).toBeVisible()

    expect(await switchSchema(page, second), 'it asks again').toBe(true)
    await expectNoneSelected(page)
    await expect(executionTab(page, execution.id)).toHaveCount(0)

    // With an execution being made on the create-execution page.
    if (!(await offersNewExecution(page))) return
    if (!(await openCreateExecution(page))) return
    await loadDataset(page, uat, second, 'valid')
    expect(
      await switchSchema(page, first, { confirm: false }),
      'it asks first on the create-execution page',
    ).toBe(true)
    await expect(page.getByTestId('data-card')).toHaveAttribute(
      'data-load-status',
      'loaded',
    )
    expect(currentView(page)).toBe(CREATE_EXECUTION.slice(1))
  })

  test('the DAG picked is kept when the app is reloaded', async ({ page }) => {
    await openHistory(page)
    expect(
      await switchSchema(page, second),
      'nothing open: it does not ask',
    ).toBe(false)
    await page.reload()
    expect(await activeSchema(page), 'still on the DAG picked').toBe(second)
    await unfoldMenu(page)
    await expect(schemaPicker(page)).toBeVisible()
  })

  test("the app's pages limited to some DAGs show in the menu and open only on those", async ({
    page,
    deployment,
  }) => {
    const pages = pagesLimitedToSchemas(deployment.appSections as AppSection[])
    test.skip(
      !pages.length,
      'no section of the app (appSections) is limited to some DAGs',
    )
    await openHistory(page)
    for (const schema of [first, second]) {
      if ((await activeSchema(page)) !== schema)
        await switchSchema(page, schema)
      for (const { path, schemas } of pages) {
        await test.step(`${path} on ${schema}`, async () => {
          const shown = schemas.includes(schema)
          const links = await menuLinks(page)
          expect(
            links.some((href) => href.endsWith(`/${path}`)),
            `the menu ${shown ? 'has' : 'has no'} ${path}`,
          ).toBe(shown)
          await leaveMenu(page)
          await goToRoute(page, `/${path}`)
          const view = expect.poll(() => currentView(page), {
            message: `${path} ${shown ? 'opens' : 'does not open'}`,
          })
          if (shown) await view.toBe(path.split('/')[0])
          else await view.toBe('not-found')
          await openHistory(page)
        })
      }
    }
  })
})
