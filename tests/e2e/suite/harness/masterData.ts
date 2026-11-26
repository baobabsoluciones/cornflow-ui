/**
 * Master tables: the tables the client's backend describes through frontend automation
 * (`/external/frontend-automation/`), which the app lists under "Master data" in the side menu
 * (`/configuration/…`): a group per section of the backend's, in its order, or one group when it
 * has no sections.
 *
 * What the backend has is read from the page, with the user's session, as the app reads it.
 */
import { expect, type Page } from '@playwright/test'
import type { Deployment, MasterData, MasterTable } from './run'
import { readDescription } from './session'

/** The master tables of the app open in `page`, once it has asked the backend for them. */
export async function liveMasterData(page: Page): Promise<MasterData> {
  let masterData: MasterData | null = null
  await expect
    .poll(
      async () => {
        masterData = (await readDescription(page)).masterData
        return masterData !== null
      },
      { message: 'the app has asked for its master tables', timeout: 30_000 },
    )
    .toBe(true)
  return masterData!
}

/** The master tables shown on the DAG `schema`: those for every DAG and those for it. */
export function tablesOn(
  masterData: MasterData,
  schema: string,
): [string, MasterTable][] {
  return Object.entries(masterData.tables).filter(
    ([, table]) => !table.schemas || table.schemas.includes(schema),
  )
}

/** The key of a table as its address has it (the app's `toUrlFriendly`). */
export function urlFriendly(text: string): string {
  return text
    .toLowerCase()
    .replaceAll(/\s+/g, '-')
    .replaceAll(/[^a-z0-9\-_]/g, '')
    .replaceAll(/-{2,}/g, '-')
    .replaceAll(/(?:^-)|(?:-$)/g, '')
}

/** What makes the app ask for a list a page at a time: a parameter for these, by name or filter. */
const PAGING = ['limit', 'offset']

/** What the backend's list of a table gives. */
export interface BackendList {
  /** Rows it gives: a list, one per item; one object (a table of parameters), one. */
  rows: number
  /** It is given a page at a time: the rows of one page are not all the table has. */
  paged: boolean
}

/**
 * Reads a table's list from the backend, from the page and with the user's session, as the app
 * does: `<backend>/external<get_list url>`, with the default value of each of its query parameters,
 * and the DAG open when the deployment has several.
 */
export async function backendList(
  page: Page,
  deployment: Deployment,
  table: MasterTable,
  schema: string,
): Promise<BackendList> {
  const list = table.operations.get_list
  expect(list, 'the table has a list (get_list)').toBeDefined()
  const query = list.parameters.filter((parameter) => parameter.in === 'query')
  const url = new URL(
    `${deployment.backendUrl.replace(/\/+$/, '')}/external${list.url}`,
  )
  for (const parameter of query) {
    if (parameter.default !== null && !PAGING.includes(parameter.name))
      url.searchParams.set(parameter.name, String(parameter.default))
  }
  if (deployment.schemas.length > 1) url.searchParams.set('schema', schema)
  const { status, body } = await page.evaluate(async (href) => {
    const response = await fetch(href, {
      headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` },
    })
    return {
      status: response.status,
      body: await response.json().catch(() => null),
    }
  }, url.href)
  expect(status, `the backend gives the list of ${list.url}`).toBe(200)
  const envelope =
    body && typeof body === 'object' && !Array.isArray(body)
      ? ['results', 'data', 'items']
          .map((key) => (body as Record<string, unknown>)[key])
          .find(Array.isArray)
      : undefined
  const rows = Array.isArray(body)
    ? body.length
    : Array.isArray(envelope)
      ? envelope.length
      : body && typeof body === 'object'
        ? 1
        : 0
  return {
    rows,
    paged: query.some(
      (parameter) =>
        PAGING.includes(parameter.name) ||
        PAGING.includes(parameter.filterType ?? ''),
    ),
  }
}
