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
 *   keys shown untranslated, and the test fails listing them; those a known fault of core
 *   explains (harness/translations.ts) are noted instead, and listed by the coverage report.
 */
import { test as base, expect } from '@playwright/test'
import type { CornflowApi } from './cornflowApi'
import {
  cornflowApiFor,
  credentials,
  type Deployment,
  readDeployment,
  readRun,
  readSessionStorage,
  type RunInfo,
  storageStateFile,
  uatFile,
} from './run'
import { restoreSession } from './session'
import {
  knownIssueOf,
  untranslatedMessage,
  watchTranslations,
} from './translations'
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
    const unknown = keys.filter(({ key, where }) => {
      const issue = knownIssueOf(key)
      if (issue) {
        test.info().annotations.push({
          type: 'known issue',
          description: `${key} shown untranslated on ${where}: ${issue}`,
        })
      }
      return !issue
    })
    if (unknown.length) throw new Error(untranslatedMessage(unknown))
  },

  api: async ({ session, deployment, baseURL }, use) => {
    const api = cornflowApiFor(deployment, baseURL)
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
