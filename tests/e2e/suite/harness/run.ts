/**
 * What one run of the suite shares between its set-up, its tests and its clean-up: the run id,
 * the deployment as `describe()` told it, and a signed-in session per user. The set-up writes them
 * into the app's `tests/e2e/.auth/` (gitignored); the rest reads them from there.
 *
 * The config factory sets the environment this reads (`E2E_RUN_ID`, `E2E_STATE_DIR`,
 * `E2E_UAT_FILE`) once per run, so every worker sees the same values.
 */
import fs from 'node:fs'
import path from 'node:path'
import { CornflowApi } from './cornflowApi'
import type { Mode } from './uat'

/** What `window.cornflowUi.describe()` returns (see `src/utils/appDescription.ts`). */
export interface Deployment {
  name: string
  schemas: string[]
  authType: string
  backendUrl: string
  hasExternalApp: boolean
  isDeveloperMode: boolean
  /** The staging notice runs along the top of every page. */
  isStagingEnvironment: boolean
  languages: string[]
  modules: string[]
  core: Record<string, any>
  appSections: unknown[]
  /** Per role, the views it cannot open and where it lands (see `RolePermissions`). */
  rolesConfig: Record<string, RolePermissions>
  helpMenuFiles: unknown[]
  dashboards: { solution: unknown[]; instance: unknown[] }
  frontendConfig: {
    etl?: Record<string, { exists?: boolean; query?: Record<string, any> }>
    executions?: Record<string, Record<string, string>>
  } | null
  i18nNamespaces: string[]
  /** The master tables of frontend automation (see `MasterData`); null until the user signs in. */
  masterData: MasterData | null
}

/** A master table, as the app took it from frontend automation. */
export interface MasterTable {
  /** A text, or one per language. */
  title: unknown
  section: string | null
  group: string | null
  /** The DAGs it is for; null for every DAG. */
  schemas: string[] | null
  /** Each operation it allows (`get_list`, `download_excel_table`…): endpoint, method, parameters. */
  operations: Record<
    string,
    { url: string; method: string; parameters: MasterParameter[] }
  >
}

/** A parameter of an operation of a master table. */
export interface MasterParameter {
  name: string
  /** Where it goes (`query`, `path`…). */
  in: string
  /** Its default value, which the app sends; null when it has none. */
  default: unknown
  /** What it filters by, for a filter (`limit`, `offset`…). */
  filterType: string | null
}

/** The master tables of frontend automation, and the sections and groups of the menu, in order. */
export interface MasterData {
  tables: Record<string, MasterTable>
  sections: { id: string; title?: unknown; order?: number }[]
  groups: { id: string; title?: unknown; order?: number }[]
}

/** What a role of the app's `rolesConfig` cannot reach, and where it lands. */
export interface RolePermissions {
  forbidden_views?: string[]
  forbidden_endpoints?: string[]
  defaultView?: string
}

/** A user the run signs in as. `default` is the one the tests use unless they ask for a role. */
export interface SessionUser {
  name: string
  username: string
  /** Set for the users the run created (disposable mode), which the clean-up deletes. */
  id?: number
}

export interface RunInfo {
  runId: string
  mode: Mode
  sessions: SessionUser[]
}

function required(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `[cornflow-e2e] ${name} is not set. Run the suite through its config factory.`,
    )
  }
  return value
}

export const runId = (): string => required('E2E_RUN_ID')
export const stateDir = (): string => required('E2E_STATE_DIR')
export const uatFile = (): string => required('E2E_UAT_FILE')

/** Where the browser state of a user's session is: what Playwright takes as `storageState`. */
export const storageStateFile = (user: string): string =>
  path.join(stateDir(), `${user}.json`)

/** Where the `sessionStorage` of a user's session is, which Playwright does not keep. */
export const sessionStorageFile = (user: string): string =>
  path.join(stateDir(), `${user}.session.json`)

const deploymentFile = (): string => path.join(stateDir(), 'deployment.json')
const runFile = (): string => path.join(stateDir(), 'run.json')

function write(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(value, null, 2))
}

function read<T>(file: string, what: string): T {
  if (!fs.existsSync(file)) {
    throw new Error(
      `[cornflow-e2e] No ${what} at ${file}: the set-up (project "setup") did not run.`,
    )
  }
  return JSON.parse(fs.readFileSync(file, 'utf-8')) as T
}

/**
 * Forgets what an earlier run left (its deployment and run information), so a clean-up never
 * works from a run that is not this one. The sessions are written again by the set-up.
 */
/**
 * The users to go through, one per role: in disposable mode the run's users of each role (not
 * `default`, the same user as one of them); in shared mode, `default`, the only one there is.
 */
export function roleSessions(run: RunInfo): SessionUser[] {
  const others = run.sessions.filter((session) => session.name !== 'default')
  return others.length ? others : run.sessions
}

export function clearRunState(): void {
  for (const file of [deploymentFile(), runFile()])
    fs.rmSync(file, { force: true })
}

export const saveDeployment = (deployment: Deployment): void =>
  write(deploymentFile(), deployment)
export const readDeployment = (): Deployment =>
  read(deploymentFile(), 'deployment description')

export const saveRun = (run: RunInfo): void => write(runFile(), run)
export const readRun = (): RunInfo => read(runFile(), 'run information')

export const saveSessionStorage = (
  user: string,
  entries: Record<string, string>,
): void => write(sessionStorageFile(user), entries)
export const readSessionStorage = (user: string): Record<string, string> =>
  read(sessionStorageFile(user), `session of "${user}"`)

/**
 * The username and password of a session's user, in the same gitignored folder: each test signs
 * in again with them (harness/session.ts `freshSessionStorage`), as a saved session runs out.
 */
const sessionCredentialsFile = (user: string): string =>
  path.join(stateDir(), `${user}.credentials.json`)
export const saveSessionCredentials = (
  user: string,
  credentials: { username: string; password: string },
): void => write(sessionCredentialsFile(user), credentials)
export const readSessionCredentials = (
  user: string,
): { username: string; password: string } =>
  read(sessionCredentialsFile(user), `credentials of "${user}"`)

/** The credentials the suite signs in with, from the environment. */
export function credentials(): { username: string; password: string } {
  const username = process.env.E2E_USER
  const password = process.env.E2E_PASSWORD
  if (!username || !password) {
    // The names the previous suite read them from.
    if (
      process.env.PLAYWRIGHT_TEST_USER ||
      process.env.PLAYWRIGHT_TEST_PASSWORD
    ) {
      throw new Error(
        '[cornflow-e2e] PLAYWRIGHT_TEST_USER and PLAYWRIGHT_TEST_PASSWORD are the names of the ' +
          'previous suite: rename them to E2E_USER and E2E_PASSWORD (in tests/e2e/.env.test or ' +
          'the environment). See tests/e2e/.env.test.example.',
      )
    }
    throw new Error(
      '[cornflow-e2e] Set E2E_USER and E2E_PASSWORD (in tests/e2e/.env.test or the environment): ' +
        'the user the suite signs in as, an admin when the mode is "disposable".',
    )
  }
  return { username, password }
}

/**
 * The Cornflow API of the backend the app talks to, as `describe()` told it: the suite prepares
 * and cleans up its data on the same one. `E2E_BACKEND_URL` replaces it when the backend has to
 * be reached at another address from where the suite runs. A relative address is the app's own.
 */
export function cornflowApiFor(
  deployment: Pick<Deployment, 'backendUrl' | 'hasExternalApp'>,
  baseURL: string | undefined,
): CornflowApi {
  const url = process.env.E2E_BACKEND_URL || deployment.backendUrl
  if (!url) {
    throw new Error(
      '[cornflow-e2e] The app does not say which backend it talks to (describe().backendUrl ' +
        'is empty). Set E2E_BACKEND_URL.',
    )
  }
  return new CornflowApi({
    backendUrl: new URL(url, baseURL).href,
    cornflowPath: deployment.hasExternalApp ? '/cornflow' : '',
    runId: runId(),
  })
}
