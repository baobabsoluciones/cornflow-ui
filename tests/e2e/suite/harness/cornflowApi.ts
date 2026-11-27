/**
 * The Cornflow API as the end-to-end suite uses it: to sign in, to make the data a test needs
 * before it opens the interface, to wait for what Cornflow runs, and to clean up afterwards.
 *
 * Everything it creates is named `[e2e] <run id> <label>` and remembered, so `cleanup()` deletes
 * exactly what this run made: on a shared environment (a client's pre) the suite touches nothing
 * else, and two runs at the same time do not delete each other's data.
 *
 * It is plain `fetch`, with no Playwright and no import from `src`: the suite is copied into each
 * client's project, where the sources of core are not something Playwright can load.
 */
import { randomUUID } from 'node:crypto'

/** `length` random characters, 0-9 and a-f, from a cryptographically secure source (up to 32). */
export const randomHex = (length: number): string =>
  randomUUID().replace(/-/g, '').slice(0, length)

/** What every name the suite gives starts with. */
export const E2E_PREFIX = '[e2e]'

/** What the username of every user the suite creates starts with. */
export const E2E_USER_PREFIX = 'e2e_'

/** A role of the deployment, as `/roles/` lists it. */
export interface Role {
  id: number
  name: string
}

/** A role given to a user, as Cornflow lists them (`GET /user/role/`). */
export interface UserRole {
  user_id: number
  role_id: number
}

/** A user the suite created, with what it takes to sign in as it. */
export interface TestUser {
  id: number
  username: string
  password: string
  roleId: number
}

/**
 * A password for a user the suite creates: upper and lower case, digits and, as the only symbols,
 * `.` and `-` (a password that ends up in a connection URI breaks with others). As Cornflow's
 * policy asks: 22 characters, no run of six digits, and nothing of the user's name (the suite's
 * users are `e2e_…`). Its fixed `P`, `w`, `7`, `.` and `-` give it every kind of character the
 * policy asks for, whatever the random parts turn out to be.
 */
export function newPassword(): string {
  // A digit after five is turned into a letter: a run of six digits is not allowed.
  const random = () => randomHex(8).replace(/(\d{5})\d/g, '$1k')
  let password = ''
  do password = `Pw.${random()}-${random().toUpperCase()}q7`
  while (password.toLowerCase().includes('e2e'))
  return password
}

/**
 * Execution states as Cornflow reports them (`state` of an execution). The same values as
 * `ExecutionState` of `src/utils/executionStates.ts`, which the suite cannot import.
 */
export const ExecutionState = {
  Solved: 1,
  SolutionLoaded: 2,
  Running: 0,
  Queued: -7,
  Error: -1,
  Stopped: -2,
  NotStarted: -3,
  NotRun: -4,
  UnknownError: -5,
  FailedSaving: -6,
} as const

/**
 * What a DAG logs about a solution it found (`log` of the execution), in the codes every DAG
 * shares through cornflow-client: solved to optimality (`status_code` 1) with a solution
 * (`sol_code` 2). The interface shows it as the solution's state ("Optimal").
 */
export const SOLVED_LOG = {
  status: 'Optimal',
  status_code: 1,
  sol_code: 2,
} as const

/** Still to finish: queued or running. */
export function isExecutionActive(state: number): boolean {
  return state === ExecutionState.Running || state === ExecutionState.Queued
}

/** A new run id: when it started, and a few random characters in case two start together. */
export function newRunId(now: Date = new Date()): string {
  const stamp = now
    .toISOString()
    .slice(0, 16)
    .replace(/[-:]/g, '')
    .replace('T', '-')
  return `${stamp}-${randomHex(4)}`
}

/** The checks Cornflow stored for an instance or an execution: rows by check name. */
export type Checks = Record<string, Record<string, unknown>[]>

/** A JSON schema, or a part of one: only what the suite reads of it is typed. */
export interface JsonSchema {
  type?: string | string[]
  properties?: Record<string, JsonSchema>
  items?: JsonSchema
  required?: string[]
  minimum?: number
  maximum?: number
  [key: string]: unknown
}

export interface CornflowApiOptions {
  /** URL of the backend the interface talks to (`describe().backendUrl`). */
  backendUrl: string
  /**
   * Where Cornflow's routes start on that backend: `/cornflow` when the app has an external
   * backend in front of Cornflow (`hasExternalApp`), empty otherwise.
   */
  cornflowPath?: string
  /** The run whose data this client creates and cleans up. A new one if left out. */
  runId?: string
  /** How long to wait between two reads of something Cornflow is running. */
  pollMs?: number
}

export interface WaitOptions {
  /** How long to wait before giving up. */
  timeoutMs?: number
}

export class CornflowApiError extends Error {
  constructor(
    readonly method: string,
    readonly path: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    const detail =
      body && typeof body === 'object' && 'error' in body
        ? `: ${String(body.error)}`
        : ''
    super(`${method} ${path} answered ${status}${detail}`)
    this.name = 'CornflowApiError'
  }
}

/** The backend did not answer at all: down, or not at that address. */
export class BackendUnreachableError extends Error {
  constructor(
    readonly url: string,
    method: string,
    path: string,
    cause: unknown,
  ) {
    const reason =
      (cause as { cause?: { code?: string; message?: string } })?.cause?.code ??
      (cause as { cause?: { message?: string } })?.cause?.message ??
      (cause as Error)?.message ??
      String(cause)
    super(
      `[cornflow-e2e] Cannot reach the backend at ${url} (${method} ${path}: ${reason}). ` +
        'Check that it is up and that the address is right: the one the app talks to (its ' +
        'VITE_APP_BACKEND_URL or values.json), or E2E_BACKEND_URL when set.',
    )
    this.name = 'BackendUnreachableError'
  }
}

export class CornflowApi {
  readonly runId: string
  private readonly baseUrl: string
  private readonly pollMs: number
  private token: string | null = null
  private readonly instances = new Set<string>()
  private readonly executions = new Set<string>()
  private readonly users = new Set<number>()

  constructor(private readonly options: CornflowApiOptions) {
    this.baseUrl =
      options.backendUrl.replace(/\/+$/, '') + (options.cornflowPath ?? '')
    this.runId = options.runId ?? newRunId()
    this.pollMs = options.pollMs ?? 1000
  }

  /**
   * Another client on the same backend and run, signed in as another user: to do what this
   * client's user may not. It keeps its own list of what it creates.
   */
  async signedInAs(username: string, password: string): Promise<CornflowApi> {
    const other = new CornflowApi({ ...this.options, runId: this.runId })
    await other.login(username, password)
    return other
  }

  /** The name the suite gives something it creates: `[e2e] <run id> <label>`. */
  name(label: string): string {
    return `${E2E_PREFIX} ${this.runId} ${label}`
  }

  /** The username the suite gives a user it creates: `e2e_<run id>_<label>`, as a username allows. */
  username(label: string): string {
    const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '_')
    return `${E2E_USER_PREFIX}${this.runId.replace(/-/g, '_')}_${slug}`
  }

  /** Signs in; the calls after it are made as that user. Returns the user's id and token. */
  async login(
    username: string,
    password: string,
  ): Promise<{ id: number; token: string; refresh_token?: string }> {
    // `refresh_token` from Cornflow 1.4, where refresh tokens are on.
    const content = await this.request<{
      id: number
      token: string
      refresh_token?: string
    }>('POST', '/login/', {
      username,
      password,
    })
    this.token = content.token
    return content
  }

  /** Acts as the user a token belongs to, such as the one a signed-in page holds. */
  useToken(token: string): void {
    this.token = token
  }

  /** Creates an instance of `schema` with `data`. Returns its id. */
  async createInstance(args: {
    schema: string
    data: Record<string, unknown>
    label: string
  }): Promise<string> {
    const { id } = await this.request<{ id: string }>('POST', '/instance/', {
      name: this.name(args.label),
      schema: args.schema,
      data: args.data,
    })
    this.instances.add(id)
    return id
  }

  /**
   * Runs the checks of an instance, as the interface does before letting the user solve, and
   * returns what they found. Cornflow keeps them in the instance, not in an execution.
   */
  async checkInstance(
    instanceId: string,
    schema: string,
    config?: Record<string, unknown>,
    wait?: WaitOptions,
  ): Promise<Checks> {
    const body = config ? { schema, config } : { schema }
    const run = await this.request<{ id: string }>(
      'POST',
      `/data-check/instance/${instanceId}/`,
      body,
    )
    this.executions.add(run.id)
    await this.waitForExecution(run.id, wait)
    const instance = await this.request<{ checks?: Checks | null }>(
      'GET',
      `/instance/${instanceId}/data/`,
    )
    return instance.checks ?? {}
  }

  /**
   * Creates an execution of an instance with `config` and runs it, or, with `run: false`, only
   * creates it (state `NotRun`): enough for a test that needs it listed, with no solver involved.
   * Returns its id.
   */
  async createExecution(args: {
    instanceId: string
    schema: string
    config: Record<string, unknown>
    label: string
    run?: boolean
  }): Promise<string> {
    const query = args.run === false ? '?run=0' : ''
    const { id } = await this.request<{ id: string }>(
      'POST',
      `/execution/${query}`,
      {
        name: this.name(args.label),
        description: '',
        schema: args.schema,
        instance_id: args.instanceId,
        config: args.config,
      },
    )
    this.executions.add(id)
    return id
  }

  /**
   * The execution called `name` that the user made (through the interface, for instance), with
   * its instance; null when there is none. The latest one if there are several (a retried test
   * makes it again). Both are deleted with the rest when this client cleans up.
   */
  async findExecution(
    name: string,
  ): Promise<{ id: string; instanceId: string } | null> {
    const executions = await this.request<
      { id: string; name?: string; instance_id: string; created_at?: string }[]
    >('GET', '/execution/')
    const found = executions
      .filter((execution) => execution.name === name)
      .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))[0]
    if (!found) return null
    this.executions.add(found.id)
    this.instances.add(found.instance_id)
    return { id: found.id, instanceId: found.instance_id }
  }

  /**
   * An execution as the user's list of executions has it: its name, state, config and the state
   * of its solution (`status_code` of its log; -3, as the interface takes it, without a log).
   * Null when it is not listed: deleted, or not the user's.
   */
  async execution(id: string): Promise<{
    name: string
    /** The DAG it runs on. */
    schema: string
    state: number
    config: Record<string, unknown>
    instanceId: string
    solutionStatus: number
  } | null> {
    const executions = await this.request<
      {
        id: string
        name: string
        schema: string
        state: number
        config?: Record<string, unknown> | null
        instance_id: string
        log?: { status_code?: number } | null
      }[]
    >('GET', '/execution/')
    const execution = executions.find((candidate) => candidate.id === id)
    if (!execution) return null
    return {
      name: execution.name,
      schema: execution.schema,
      state: execution.state,
      config: execution.config ?? {},
      instanceId: execution.instance_id,
      solutionStatus: execution.log?.status_code ?? -3,
    }
  }

  /** The state of an execution (`ExecutionState`). */
  async executionState(id: string): Promise<number> {
    const execution = await this.request<{ state: number }>(
      'GET',
      `/execution/${id}/`,
    )
    return execution.state
  }

  /** Waits until an execution is neither queued nor running, and returns how it ended. */
  async waitForExecution(
    id: string,
    { timeoutMs = 120_000 }: WaitOptions = {},
  ): Promise<number> {
    const giveUpAt = Date.now() + timeoutMs
    for (;;) {
      const state = await this.executionState(id)
      if (!isExecutionActive(state)) return state
      if (Date.now() > giveUpAt) {
        throw new Error(
          `Execution ${id} still running after ${timeoutMs} ms (state ${state})`,
        )
      }
      await new Promise((resolve) => setTimeout(resolve, this.pollMs))
    }
  }

  /**
   * Saves `data` as the solution of an execution, as the DAG does when it ends (`PUT /dag/<id>/`):
   * solved, with the log of a solution found (`SOLVED_LOG`) unless told otherwise. Only an admin
   * or the service user may; anyone else gets a 403.
   */
  async saveResults(
    id: string,
    data: Record<string, unknown>,
    {
      state = ExecutionState.Solved,
      log = SOLVED_LOG,
    }: { state?: number; log?: Record<string, unknown> } = {},
  ): Promise<void> {
    await this.request('PUT', `/dag/${id}/`, { data, state, log_json: log })
  }

  /**
   * Uploads `data` as the solution of an execution, as a user does from the interface instead of
   * solving (`PUT /execution/<id>/`). Cornflow keeps the execution's state.
   */
  async uploadSolution(
    id: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    await this.request('PUT', `/execution/${id}/`, { data })
  }

  /** The data of an instance and the checks Cornflow keeps with it (none until they run). */
  async instanceData(
    id: string,
  ): Promise<{ data: Record<string, unknown> | null; checks: Checks }> {
    const instance = await this.request<{
      data?: Record<string, unknown> | null
      checks?: Checks | null
    }>('GET', `/instance/${id}/data/`)
    return { data: instance.data ?? null, checks: instance.checks ?? {} }
  }

  /** The JSON schema of the input data of a DAG, as Cornflow has it (`GET /schema/<dag>/`). */
  async instanceSchema(dag: string): Promise<JsonSchema> {
    return (await this.schemas(dag)).instance ?? {}
  }

  /** The JSON schema of the solution of a DAG, as Cornflow has it (`GET /schema/<dag>/`). */
  async solutionSchema(dag: string): Promise<JsonSchema> {
    return (await this.schemas(dag)).solution ?? {}
  }

  /** The JSON schema of the checks of the instance of a DAG (`instance_checks`). */
  async instanceChecksSchema(dag: string): Promise<JsonSchema> {
    return (await this.schemas(dag)).instance_checks ?? {}
  }

  private schemas(dag: string): Promise<{
    instance?: JsonSchema
    solution?: JsonSchema
    instance_checks?: JsonSchema
  }> {
    return this.request('GET', `/schema/${dag}/`)
  }

  /** The solution of an execution and the checks of that solution. */
  async executionData(
    id: string,
  ): Promise<{ data: Record<string, unknown> | null; checks: Checks }> {
    const execution = await this.request<{
      data?: Record<string, unknown> | null
      checks?: Checks | null
    }>('GET', `/execution/${id}/data/`)
    return { data: execution.data ?? null, checks: execution.checks ?? {} }
  }

  /** Deletes an execution. Gone already is fine. */
  async deleteExecution(id: string): Promise<void> {
    await this.request('DELETE', `/execution/${id}/`, undefined, [404])
    this.executions.delete(id)
  }

  /** Deletes an instance, and with it, in Cornflow, its executions. Gone already is fine. */
  async deleteInstance(id: string): Promise<void> {
    await this.request('DELETE', `/instance/${id}/`, undefined, [404])
    this.instances.delete(id)
  }

  /** The DAGs this client's user may work on (`GET /schema/`). */
  async schemaNames(): Promise<string[]> {
    const listed = await this.request<{ name: string }[]>('GET', '/schema/')
    return listed.map((schema) => schema.name)
  }

  /** How Cornflow is, and its version (`GET /health/`). */
  async health(): Promise<{
    cornflow_status?: string
    airflow_status?: string
    cornflow_version?: string
  }> {
    return this.request('GET', '/health/')
  }

  /** The libraries Cornflow uses, with their licences (`GET /licences/`). */
  async licences(): Promise<{ library: string; license: string }[]> {
    return this.request('GET', '/licences/')
  }

  /** The roles of the deployment: Cornflow's own and any the deployment added. */
  async roles(): Promise<Role[]> {
    return this.request<Role[]>('GET', '/roles/')
  }

  /**
   * Creates a user that has the role `roleId` and no other, for the tests that act as that role.
   * Only for a disposable deployment: it takes an admin, and sign-up being on (Cornflow's default).
   * Cornflow gives every new user its default role, which is taken away when it is not `roleId`.
   */
  async createUser(args: { roleId: number; label: string }): Promise<TestUser> {
    // A few random characters at the end: a test or set-up retried makes its user again, while the
    // one of the attempt that failed is still there until the clean-up.
    const username = `${this.username(args.label)}_${randomHex(4)}`
    const password = newPassword()
    const { id } = await this.request<{ id: number }>('POST', '/signup/', {
      username,
      email: `${username}@example.com`,
      password,
    })
    this.users.add(id)

    const assignments = await this.request<UserRole[]>('GET', '/user/role/')
    const current = assignments
      .filter((assignment) => assignment.user_id === id)
      .map((assignment) => assignment.role_id)
    if (!current.includes(args.roleId)) {
      await this.request('POST', '/user/role/', {
        user_id: id,
        role_id: args.roleId,
      })
    }
    for (const roleId of current.filter((role) => role !== args.roleId)) {
      await this.request('DELETE', `/user/role/${id}/${roleId}/`)
    }
    return { id, username, password, roleId: args.roleId }
  }

  /** The users of the deployment, as an admin sees them (`GET /user/`). */
  async listUsers(): Promise<{ id: number; username: string }[]> {
    return this.request('GET', '/user/')
  }

  /** Which user has which role (`GET /user/role/`). Only an admin sees them. */
  async userRoles(): Promise<UserRole[]> {
    return this.request('GET', '/user/role/')
  }

  /** Deletes a user. Gone already is fine. */
  async deleteUser(id: number): Promise<void> {
    await this.request('DELETE', `/user/${id}/`, undefined, [404])
    this.users.delete(id)
  }

  /**
   * Deletes whatever carries this run's id, whoever created it and whether or not this client
   * remembers it: the executions and instances named `[e2e] <run id> …`, and the users and the
   * roles named `e2e_<run id>_…`. It is how a run cleans up at the end, after tests that may have
   * stopped half-way. Users and roles are only changed by an admin; for anyone else there are none
   * to delete. One that cannot be deleted does not stop the rest: they are all tried, and then it
   * throws listing those left.
   */
  async sweepRun(): Promise<{
    executions: number
    instances: number
    users: number
    roles: number
  }> {
    const namePrefix = this.name('')
    const userPrefix = this.username('')
    const named = (items: { id: string; name?: string }[]) =>
      items.filter((item) => item.name?.startsWith(namePrefix))
    const failures: string[] = []
    const remove = async (
      what: string,
      id: string | number,
      deleting: () => Promise<unknown>,
    ) => {
      try {
        await deleting()
      } catch (error) {
        failures.push(`${what} ${id}: ${(error as Error).message}`)
      }
    }

    const executions = named(
      await this.request<{ id: string; name?: string }[]>('GET', '/execution/'),
    )
    for (const { id } of executions)
      await remove('execution', id, () => this.deleteExecution(id))

    const instances = named(
      await this.request<{ id: string; name?: string }[]>('GET', '/instance/'),
    )
    for (const { id } of instances)
      await remove('instance', id, () => this.deleteInstance(id))

    const allUsers = await this.request<
      { id: number; username?: string }[] | null
    >('GET', '/user/', undefined, [403])
    const users = (Array.isArray(allUsers) ? allUsers : []).filter((user) =>
      user.username?.startsWith(userPrefix),
    )
    for (const { id } of users)
      await remove('user', id, () => this.deleteUser(id))

    const allRoles = await this.request<{ id: number; name?: string }[] | null>(
      'GET',
      '/roles/',
      undefined,
      [403],
    )
    const roles = (Array.isArray(allRoles) ? allRoles : []).filter((role) =>
      role.name?.startsWith(userPrefix),
    )
    // Cornflow 1.3 cannot delete roles (501): the suite does not create any it cannot delete.
    for (const { id } of roles)
      await remove('role', id, () =>
        this.request('DELETE', `/roles/${id}/`, undefined, [403, 404, 501]),
      )

    if (failures.length) {
      throw new Error(
        `[cornflow-e2e] Could not clean up all of run ${this.runId}; left on the backend:\n` +
          failures.join('\n'),
      )
    }
    return {
      executions: executions.length,
      instances: instances.length,
      users: users.length,
      roles: roles.length,
    }
  }

  /**
   * Deletes everything this run created: its executions, its instances and then its users. Goes on
   * after a failure so that one leftover does not keep the rest, and reports them all at the end.
   */
  async cleanup(): Promise<void> {
    const failures: string[] = []
    const remove = async (
      what: string,
      id: string,
      deleting: (id: string) => Promise<void>,
    ) => {
      try {
        await deleting(id)
      } catch (error) {
        failures.push(`${what} ${id}: ${(error as Error).message}`)
      }
    }
    for (const id of [...this.executions])
      await remove('execution', id, (i) => this.deleteExecution(i))
    for (const id of [...this.instances])
      await remove('instance', id, (i) => this.deleteInstance(i))
    for (const id of [...this.users])
      await remove('user', String(id), () => this.deleteUser(id))
    if (failures.length) {
      throw new Error(
        `Could not clean up after run ${this.runId}:\n${failures.join('\n')}`,
      )
    }
  }

  private async request<T = unknown>(
    method: string,
    path: string,
    body?: unknown,
    allowedStatuses: number[] = [],
  ): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    if (this.token) headers.Authorization = `Bearer ${this.token}`

    let response: Response
    try {
      response = await fetch(this.baseUrl + path, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      })
    } catch (error) {
      throw new BackendUnreachableError(this.baseUrl, method, path, error)
    }
    const text = await response.text()
    let content: unknown = text
    try {
      content = text ? JSON.parse(text) : null
    } catch {
      // Not JSON (an HTML error page, for instance): kept as text for the error message.
    }
    if (!response.ok && !allowedStatuses.includes(response.status)) {
      throw new CornflowApiError(method, path, response.status, content)
    }
    return content as T
  }
}
