/**
 * Runs once before the tests. It checks the UAT file, finds out what the deployment is, makes the
 * users the run needs and signs each one in, so the tests start from there:
 *
 * - `shared`: one session, `default`, for the user of E2E_USER.
 * - `disposable`: E2E_USER (an admin) creates a user per role of the deployment, each with that
 *   role alone, and each gets a session named after its role. `default` is the planner's.
 *
 * What it leaves is in the app's `tests/e2e/.auth/` (see `harness/run.ts`).
 */
import { test as setup } from '@playwright/test'
import type { TestUser } from '../harness/cornflowApi'
import {
  clearRunState,
  cornflowApiFor,
  credentials,
  saveDeployment,
  saveRun,
  saveSessionStorage,
  type SessionUser,
  storageStateFile,
  uatFile,
} from '../harness/run'
import {
  readDescription,
  readPageSessionStorage,
  signInThroughForm,
} from '../harness/session'
import { loadUat } from '../harness/uat'

/** Roles no person signs in with: Cornflow's placeholder role and the one airflow uses. */
const ROLES_LEFT_OUT = ['dummy', 'service']
/**
 * Roles a run of the suite made and could not delete (Cornflow 1.3 cannot delete a role): not the
 * deployment's, so no user of theirs.
 */
const SUITE_ROLE = /^e2e_/
/** The role of the `default` session in disposable mode: the one users plan with. */
const DEFAULT_ROLE = 'planner'

setup('prepare the run', async ({ browser, baseURL }) => {
  setup.setTimeout(5 * 60_000)
  clearRunState()
  const uat = loadUat(uatFile())
  const admin = credentials()

  // What the deployment is, as it shows before anyone signs in.
  const firstPage = await (await browser.newContext({ baseURL })).newPage()
  await firstPage.goto('/')
  const before = await readDescription(firstPage)
  await firstPage.context().close()

  if (before.authType !== 'cornflow') {
    throw new Error(
      `[cornflow-e2e] This deployment signs in with "${before.authType}". The suite signs in ` +
        "with Cornflow's own user and password, so it cannot run here yet.",
    )
  }
  const unknown = Object.keys(uat.schemas).filter(
    (s) => !before.schemas.includes(s),
  )
  if (unknown.length) {
    throw new Error(
      `[cornflow-e2e] The UAT file has data for ${unknown.join(', ')}, which this deployment ` +
        `does not work on (it works on ${before.schemas.join(', ')}).`,
    )
  }

  const api = cornflowApiFor(before, baseURL)
  await api.login(admin.username, admin.password)
  // Kept once signed in, so the clean-up knows the backend even if the set-up stops before the
  // end. Before that the run has made nothing, and the clean-up leaves the backend alone.
  saveDeployment(before)

  // The users to sign in as, and the session each one's is saved under.
  const users: {
    sessions: string[]
    user: TestUser | null
    password: string
    username: string
  }[] = []
  if (uat.mode === 'shared') {
    users.push({ sessions: ['default'], user: null, ...admin })
  } else {
    const roles = (await api.roles()).filter(
      (role) =>
        !ROLES_LEFT_OUT.includes(role.name) && !SUITE_ROLE.test(role.name),
    )
    for (const role of roles) {
      const user = await api
        .createUser({ roleId: role.id, label: role.name })
        .catch((error) => {
          throw new Error(
            `[cornflow-e2e] Could not create a "${role.name}" user (${error.message}). In ` +
              'disposable mode E2E_USER has to be an admin.',
          )
        })
      users.push({ sessions: [role.name], user, ...user })
    }
    const planner =
      users.find((u) => u.sessions.includes(DEFAULT_ROLE)) ?? users[0]
    planner.sessions.push('default')
  }

  const sessions: SessionUser[] = []
  for (const { sessions: names, user, username, password } of users) {
    const context = await browser.newContext({ baseURL })
    const page = await context.newPage()
    await signInThroughForm(page, username, password)
    const entries = await readPageSessionStorage(page)
    for (const name of names) {
      await context.storageState({ path: storageStateFile(name) })
      saveSessionStorage(name, entries)
      sessions.push({ name, username, ...(user ? { id: user.id } : {}) })
    }
    // Signed in, the app also has what the backend says about each DAG and every parameter.
    if (names.includes('default')) saveDeployment(await readDescription(page))
    await context.close()
  }

  saveRun({ runId: api.runId, mode: uat.mode, sessions })
})
