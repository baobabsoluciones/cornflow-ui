/**
 * The `test` every spec of the suite uses (and the specs of the layers and apps that build on
 * it): Playwright's, with what a test of a deployment needs.
 *
 *   import { test, expect } from '../harness/fixtures'
 *
 *   test('…', async ({ page, deployment, uat, api }) => {
 *     test.skip(!deployment.core.parameters?.solverConfig?.showSolverStep, 'no solver step here')
 *     …
 *   })
 *
 * - `deployment`: what `describe()` said once signed in (see harness/run.ts). A test reads what is
 *   on and off from it, and skips with the reason what does not apply: the coverage report
 *   lists those reasons.
 * - `uat`: the app's UAT file, checked (harness/uat.ts).
 * - `session`: the run's user the page is signed in as: `default` unless the test or its project
 *   says otherwise (`test.use({ session: 'viewer' })`), or null to start signed out.
 * - `api`: the Cornflow API as that same user, so what a test makes there is what the page shows.
 *   What it creates is deleted when the test ends.
 * - `checkTranslations`: on by default. Every screen the test goes through is checked for text
 *   keys shown untranslated, and the test fails listing them.
 */
import { test as base, expect } from '@playwright/test'
import { CornflowApi } from './cornflowApi'
import {
  backendUrl,
  credentials,
  type Deployment,
  readDeployment,
  readRun,
  readSessionStorage,
  type RunInfo,
  runId,
  storageStateFile,
  uatFile,
} from './run'
import { restoreSession } from './session'
import { untranslatedMessage, watchTranslations } from './translations'
import { loadUat, type Uat } from './uat'

interface TestFixtures {
  session: string | null
  checkTranslations: boolean
  api: CornflowApi
}

interface WorkerFixtures {
  deployment: Deployment
  run: RunInfo
  uat: Uat
}

export const test = base.extend<TestFixtures, WorkerFixtures>({
  deployment: [async ({}, use) => use(readDeployment()), { scope: 'worker' }],
  run: [async ({}, use) => use(readRun()), { scope: 'worker' }],
  uat: [async ({}, use) => use(loadUat(uatFile())), { scope: 'worker' }],

  session: ['default', { option: true }],
  checkTranslations: [true, { option: true }],

  // The session's browser state; its sessionStorage goes back in through `context` below.
  storageState: async ({ session }, use) => {
    await use(session ? storageStateFile(session) : undefined)
  },

  context: async ({ context, session, checkTranslations, deployment }, use) => {
    if (session) await restoreSession(context, session)
    const untranslated = checkTranslations
      ? await watchTranslations(context, deployment.i18nNamespaces)
      : null

    await use(context)

    const keys = (await untranslated?.()) ?? []
    if (keys.length) throw new Error(untranslatedMessage(keys))
  },

  api: async ({ session, deployment }, use) => {
    const api = new CornflowApi({
      backendUrl: backendUrl(),
      cornflowPath: deployment.hasExternalApp ? '/cornflow' : '',
      runId: runId(),
    })
    const token = session ? readSessionStorage(session).token : undefined
    if (token) api.useToken(token)
    else {
      const { username, password } = credentials()
      await api.login(username, password)
    }
    await use(api)
    await api.cleanup()
  },
})

export { expect }
