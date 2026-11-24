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

/** What every name the suite gives starts with. */
export const E2E_PREFIX = '[e2e]'

/** What the username of every user the suite creates starts with. */
export const E2E_USER_PREFIX = 'e2e_'

/** A role of the deployment, as `/roles/` lists it. */
export interface Role {
  id: number
  name: string
}

/** A role given to a user, as `/user/role/` lists it. */
interface UserRole {
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
 * `.` and `-` (a password that ends up in a connection URI breaks with others).
 */
function newPassword(): string {
  const random = () => Math.random().toString(36).slice(2, 10)
  return `E2e.${random()}-${random().toUpperCase()}7`
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
  return `${stamp}-${Math.random().toString(36).slice(2, 6)}`
}

/** The checks Cornflow stored for an instance or an execution: rows by check name. */
export type Checks = Record<string, Record<string, unknown>[]>

export interface CornflowApiOptions {
  /** URL of the backend the interface talks to (its `VITE_APP_BACKEND_URL`). */
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

export class CornflowApi {
  readonly runId: string
  private readonly baseUrl: string
  private readonly pollMs: number
  private token: string | null = null
  private readonly instances = new Set<string>()
  private readonly executions = new Set<string>()
  private readonly users = new Set<number>()

  constructor(options: CornflowApiOptions) {
    this.baseUrl =
      options.backendUrl.replace(/\/+$/, '') + (options.cornflowPath ?? '')
    this.runId = options.runId ?? newRunId()
    this.pollMs = options.pollMs ?? 1000
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
  ): Promise<{ id: number; token: string }> {
    const content = await this.request<{ id: number; token: string }>(
      'POST',
      '/login/',
      {
        username,
        password,
      },
    )
    this.token = content.token
    return content
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

  /** Creates and runs an execution of an instance with `config`. Returns its id. */
  async createExecution(args: {
    instanceId: string
    schema: string
    config: Record<string, unknown>
    label: string
  }): Promise<string> {
    const { id } = await this.request<{ id: string }>('POST', '/execution/', {
      name: this.name(args.label),
      description: '',
      schema: args.schema,
      instance_id: args.instanceId,
      config: args.config,
    })
    this.executions.add(id)
    return id
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
    const username = this.username(args.label)
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

  /** Deletes a user. Gone already is fine. */
  async deleteUser(id: number): Promise<void> {
    await this.request('DELETE', `/user/${id}/`, undefined, [404])
    this.users.delete(id)
  }

  /**
   * Deletes whatever carries this run's id, whoever created it and whether or not this client
   * remembers it: the executions and instances named `[e2e] <run id> …` and the users named
   * `e2e_<run id>_…`. It is how a run cleans up at the end, after tests that may have stopped
   * half-way. Users are only listed by an admin; for anyone else there are none to delete.
   */
  async sweepRun(): Promise<{
    executions: number
    instances: number
    users: number
  }> {
    const namePrefix = this.name('')
    const userPrefix = this.username('')
    const named = (items: { id: string; name?: string }[]) =>
      items.filter((item) => item.name?.startsWith(namePrefix))

    const executions = named(
      await this.request<{ id: string; name?: string }[]>('GET', '/execution/'),
    )
    for (const { id } of executions) await this.deleteExecution(id)

    const instances = named(
      await this.request<{ id: string; name?: string }[]>('GET', '/instance/'),
    )
    for (const { id } of instances) await this.deleteInstance(id)

    const allUsers = await this.request<
      { id: number; username?: string }[] | null
    >('GET', '/user/', undefined, [403])
    const users = (Array.isArray(allUsers) ? allUsers : []).filter((user) =>
      user.username?.startsWith(userPrefix),
    )
    for (const { id } of users) await this.deleteUser(id)

    return {
      executions: executions.length,
      instances: instances.length,
      users: users.length,
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

    const response = await fetch(this.baseUrl + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
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
