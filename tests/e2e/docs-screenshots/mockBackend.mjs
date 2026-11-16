/**
 * Mock backend for the documentation screenshots.
 *
 * Answers, inside the browser, every request the app makes to Cornflow (`/cornflow/...`) and to
 * the application backend (`/external/...`) with the demo data of `demoData.mjs`, so the
 * screenshots show the real app with neutral data and need no backend at all.
 *
 * The backend URL is on the same origin as the app (`/demo-api`), so there is no CORS to answer.
 *
 * Plain JavaScript so that packages built on the core (enterprise) can import it from
 * node_modules and add the endpoints of their own modules with `handlers`.
 */
import {
  DEMO_DAG,
  demoValues,
  demoUser,
  demoUsers,
  demoRoles,
  demoRoleAssignments,
  demoSchema,
  demoExecutions,
  demoRunningExecution,
  demoInstanceData,
  demoInstanceChecks,
  demoSolutionData,
  demoSolutionChecks,
  demoKpis,
  demoFrontendAutomation,
  demoMasterRows,
  demoLicences,
} from './demoData.mjs'

export const DEMO_BACKEND_PATH = '/demo-api'

const clone = (value) => JSON.parse(JSON.stringify(value))

/**
 * @typedef {{ method: string, path: string, query: URLSearchParams, body: any, scope: 'cornflow' | 'external' }} MockRequest
 * @typedef {{ status?: number, json?: any, body?: string | Buffer, contentType?: string, headers?: Record<string,string>, delayMs?: number }} MockResponse
 * @typedef {(req: MockRequest, state: object) => MockResponse | undefined | Promise<MockResponse | undefined>} MockHandler
 */

/**
 * Installs the mock backend on a page. Call it before the first `page.goto`.
 *
 * @param {import('@playwright/test').Page} page
 * @param {{
 *   baseURL?: string,           // where the app runs (default http://localhost:3100)
 *   values?: object,            // external configuration (values.json) on top of the demo one
 *   grantedSchemas?: string[],  // DAGs `GET /schema/` grants the user
 *   executions?: object[],      // executions of the history (default: the demo ones)
 *   withKpis?: boolean,         // GET /execution/<id>/data/ returns `kpis` beside the solution
 *   frontendAutomation?: object | null, // GET /frontend-automation/ (null: 404, no master data)
 *   frontendConfig?: object | null,     // GET /external/frontend-config/ (null: 404)
 *   checksResult?: object,      // checks a data check finds in a new instance
 *   warnings?: object[],        // GET /external/warnings/ ([{ message }])
 *   handlers?: MockHandler[],   // answered before the demo ones (first match wins)
 * }} [options]
 * @returns {Promise<{ unhandled: string[], requests: MockRequest[], state: object }>}
 */
export async function installMockBackend(page, options = {}) {
  const values = {
    ...demoValues,
    ...(options.values ?? {}),
    backend_url: new URL(DEMO_BACKEND_PATH, options.baseURL ?? 'http://localhost:3100').href,
  }

  const state = {
    values,
    executions: clone(options.executions ?? demoExecutions),
    instances: new Map(),
    masterRows: clone(demoMasterRows),
    checksResult: options.checksResult ?? clone(demoInstanceChecks),
    nextId: 1,
  }
  const unhandled = []
  const requests = []
  const handlers = [...(options.handlers ?? []), (req) => demoHandler(req, state, options)]

  await page.route('**/values.json', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(values) }),
  )

  await page.route(`**${DEMO_BACKEND_PATH}/**`, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const rest = url.pathname.slice(url.pathname.indexOf(DEMO_BACKEND_PATH) + DEMO_BACKEND_PATH.length)
    const scope = rest.startsWith('/external/') ? 'external' : 'cornflow'
    const path = rest.replace(/^\/(cornflow|external)(?=\/)/, '')
    let body = null
    try {
      body = request.postDataJSON()
    } catch {
      body = request.postData()
    }
    /** @type {MockRequest} */
    const req = { method: request.method(), path, query: url.searchParams, body, scope }
    requests.push(req)

    let response
    for (const handler of handlers) {
      response = await handler(req, state)
      if (response) break
    }
    if (!response) {
      unhandled.push(`${req.method} ${scope} ${path}${url.search}`)
      response = { status: 404, json: { error: 'Not found in the demo backend' } }
    }
    if (response.delayMs) await new Promise((r) => setTimeout(r, response.delayMs))
    await route.fulfill({
      status: response.status ?? 200,
      contentType: response.contentType ?? 'application/json',
      headers: response.headers,
      body: response.body ?? JSON.stringify(response.json ?? {}),
    })
  })

  return { unhandled, requests, state }
}

const ok = (json, status = 200) => ({ status, json })

function executionDetail(execution) {
  return clone(execution)
}

function executionData(execution, withKpis) {
  const base = executionDetail(execution)
  const hasSolution = execution.state === 1 && execution.log?.status_code !== -1
  return {
    ...base,
    data: hasSolution ? clone(demoSolutionData) : {},
    checks: hasSolution && execution.id !== 'exec-historical' ? clone(demoSolutionChecks) : {},
    ...(withKpis && hasSolution ? { kpis: clone(demoKpis) } : {}),
  }
}

function findExecution(state, id) {
  if (id === demoRunningExecution.id) return state.runningExecution ?? demoRunningExecution
  // The execution the backend creates for the historical data of a dashboard.
  if (id === 'exec-historical') return { ...demoExecutions[0], id, name: 'Histórico', instance_id: 'inst-historical' }
  return state.executions.find((e) => e.id === id) ?? state.extraExecutions?.[id]
}

function filterByCreationDate(executions, query) {
  const gte = query.get('creation_date_gte')
  const lte = query.get('creation_date_lte')
  return executions.filter((e) => {
    const at = new Date(`${e.created_at.replace(/\.\d+$/, '')}Z`).getTime()
    if (gte && at < new Date(gte).getTime()) return false
    if (lte && at > new Date(lte).getTime()) return false
    return true
  })
}

/** @type {(req: MockRequest, state: any, options: any) => MockResponse | undefined} */
function demoHandler(req, state, options) {
  const { method, path, query, body, scope } = req
  let m

  if (scope === 'external') return externalHandler(req, state, options)

  // ── Session ──
  if (method === 'POST' && path === '/login/') {
    if (body?.password === 'wrong') return { status: 400, json: { error: 'Invalid username and/or password.' } }
    return ok({ token: 'demo-token', id: demoUser.id })
  }
  if (method === 'GET' && path === '/health/') return ok({ cornflow_status: 'healthy', airflow_status: 'healthy', cornflow_version: '1.3.0' })
  if (method === 'GET' && path === '/licences/') return ok(demoLicences)

  // ── Users and roles ──
  if (method === 'GET' && path === '/user/') return ok(demoUsers)
  if ((m = path.match(/^\/user\/(\d+)\/$/))) {
    const user = demoUsers.find((u) => String(u.id) === m[1]) ?? demoUser
    if (method === 'GET') return ok(user)
    if (method === 'PUT') return ok({ ...user, ...(body ?? {}) })
  }
  if (path === '/user/role/') {
    if (method === 'GET') return ok(demoRoleAssignments)
    if (method === 'POST') return ok({ id: 99, ...body }, 201)
  }
  if (/^\/user\/role\/\d+\/\d+\/$/.test(path) && method === 'DELETE') return ok({ message: 'Deleted' })
  if (path === '/roles/') {
    if (method === 'GET') return ok(demoRoles)
    if (method === 'POST') return ok({ id: 9, name: body?.name }, 201)
  }
  if (/^\/roles\/\d+\/$/.test(path)) return ok({ id: 9, name: body?.name ?? 'role' })

  // ── Schemas ──
  if (method === 'GET' && path === '/schema/') {
    const granted = options.grantedSchemas ?? [DEMO_DAG]
    return ok(granted.map((name) => ({ name })))
  }
  if (method === 'GET' && (m = path.match(/^\/schema\/([^/]+)\/$/))) return ok({ ...clone(demoSchema), name: m[1] })

  // ── Executions ──
  if (method === 'GET' && path === '/execution/') {
    const list = filterByCreationDate(state.executions, query)
    const limit = Number(query.get('limit') ?? 100)
    return ok(list.slice(0, limit))
  }
  if (method === 'POST' && path === '/execution/') {
    const id = `exec-new-${state.nextId++}`
    const created = {
      ...clone(demoRunningExecution),
      id,
      name: body?.name ?? 'Nueva ejecución',
      description: body?.description ?? '',
      config: body?.config ?? {},
      instance_id: body?.instance_id,
      created_at: '2026-10-21T09:30:00.000000',
      updated_at: '2026-10-21T09:30:00.000000',
    }
    state.extraExecutions = { ...(state.extraExecutions ?? {}), [id]: created }
    return ok(created, 201)
  }
  if ((m = path.match(/^\/execution\/files\/([^/]+)\/$/))) return { status: 501, json: { error: 'Execution files are not active' } }
  if ((m = path.match(/^\/execution\/([^/]+)\/data\/$/)) && method === 'GET') {
    if (m[1].startsWith('check-')) {
      return ok({ id: m[1], name: 'checks', state: 1, message: '', instance_id: m[1].slice('check-'.length), data: {}, checks: {}, config: {}, created_at: '2026-10-21T09:30:00.000000' })
    }
    const execution = findExecution(state, m[1])
    return execution ? ok(executionData(execution, options.withKpis)) : { status: 404, json: { error: 'Execution not found' } }
  }
  if ((m = path.match(/^\/execution\/([^/]+)\/$/))) {
    if (method === 'GET') {
      if (m[1].startsWith('check-')) return ok({ id: m[1], state: 1, schema: DEMO_DAG })
      const execution = findExecution(state, m[1])
      return execution ? ok(executionDetail(execution)) : { status: 404, json: { error: 'Execution not found' } }
    }
    if (method === 'DELETE') {
      state.executions = state.executions.filter((e) => e.id !== m[1])
      return ok({ message: 'The object has been deleted' })
    }
    if (method === 'PUT') return ok({ message: 'Updated' })
  }

  // ── Instances and data checks ──
  if (method === 'POST' && path === '/instance/') {
    const id = `inst-new-${state.nextId++}`
    state.instances.set(id, { data: body?.data ?? {}, checks: {} })
    return ok({ id, name: body?.name, schema: body?.schema }, 201)
  }
  if ((m = path.match(/^\/instance\/([^/]+)\/data\/$/)) && method === 'GET') {
    const created = state.instances.get(m[1])
    if (created) return ok({ id: m[1], data: created.data, checks: created.checks })
    // The data of a historical period comes with no checks to review.
    const checks = m[1] === 'inst-historical' ? {} : clone(demoInstanceChecks)
    return ok({ id: m[1], data: clone(demoInstanceData), checks })
  }
  if ((m = path.match(/^\/data-check\/instance\/([^/]+)\/$/)) && method === 'POST') {
    const created = state.instances.get(m[1])
    if (created) created.checks = clone(state.checksResult)
    return ok({ id: `check-${m[1]}` }, 201)
  }
  if ((m = path.match(/^\/data-check-kpis\/execution\/([^/]+)\/$/))) return ok({ id: m[1] }, 201)

  return undefined
}

/** @type {(req: MockRequest, state: any, options: any) => MockResponse | undefined} */
function externalHandler(req, state, options) {
  const { method, path, query, body } = req
  let m

  if (method === 'GET' && path === '/frontend-automation/') {
    if (options.frontendAutomation === null) return { status: 404, json: { error: 'Not found' } }
    return ok(clone(options.frontendAutomation ?? demoFrontendAutomation))
  }
  if (method === 'GET' && path === '/frontend-config/') {
    if (!options.frontendConfig) return { status: 404, json: { error: 'Not found' } }
    return ok(clone(options.frontendConfig))
  }
  if (method === 'GET' && path === '/warnings/') return ok(clone(options.warnings ?? []))
  if (method === 'POST' && path === '/historical-kpis/') return ok({ id_execution: 'exec-historical' }, 201)

  // Frontend-automation tables: /<table>/, /<table>/<id>/, /<table>/bulk/, /<table>/excel/
  if ((m = path.match(/^\/([a-z_]+)\/(?:([^/]+)\/)?$/)) && state.masterRows[m[1]]) {
    const table = m[1]
    const rows = state.masterRows[table]
    const sub = m[2]
    if (!sub && method === 'GET') {
      const gte = query.get('fecha_gte')
      const lte = query.get('fecha_lte')
      return ok(rows.filter((r) => (!gte || r.fecha >= gte) && (!lte || r.fecha <= lte)))
    }
    if (!sub && method === 'POST') {
      const row = { id: rows.length + 1, ...(body ?? {}) }
      rows.push(row)
      return ok(row, 201)
    }
    if (sub === 'excel') return { status: 200, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', body: '' }
    if (sub === 'bulk' || sub === 'overwrite') return ok({ message: 'Saved' }, method === 'POST' ? 201 : 200)
    const row = rows.find((r) => String(r.id) === sub)
    if (method === 'GET') return row ? ok(row) : { status: 404, json: { error: 'Not found' } }
    // Saved changes stay for the rest of the shot, as they would in a real backend.
    if (method === 'PUT' && row) {
      Object.assign(row, body ?? {}, { id: row.id })
      return ok(row)
    }
    if (method === 'DELETE') {
      state.masterRows[table] = rows.filter((r) => r !== row)
      return ok({ message: 'Deleted' })
    }
  }

  return undefined
}
