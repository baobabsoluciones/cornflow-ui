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
 * - `checkAppErrors`: on by default. An uncaught error, an error inside a component or a 5xx
 *   response while the test runs fails it (harness/appErrors.ts), with the same handling of
 *   known faults. A test that causes one on purpose turns it off: `test.use({ checkAppErrors: false })`.
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
import { appErrorsMessage, knownAppIssueOf, watchAppErrors } from './appErrors'
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
  checkAppErrors: boolean
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
  checkAppErrors: [true, { option: true }],

  // The session's browser state; its sessionStorage goes back in through `context` below.
  storageState: async ({ session }, use) => {
    await use(session ? storageStateFile(session) : undefined)
  },

  context: async (
    { context, session, checkTranslations, checkAppErrors, deployment },
    use,
  ) => {
    if (session) await restoreSession(context, session)
    const untranslated = checkTranslations
      ? await watchTranslations(context, deployment.i18nNamespaces)
      : null
    const appErrors = checkAppErrors ? watchAppErrors(context) : null

    await use(context)

    const noteKnown = (description: string) =>
      test.info().annotations.push({ type: 'known issue', description })
    const problems: string[] = []

    const keys = (await untranslated?.()) ?? []
    const unknownKeys = keys.filter(({ key, where }) => {
      const issue = knownIssueOf(key)
      if (issue) noteKnown(`${key} shown untranslated on ${where}: ${issue}`)
      return !issue
    })
    if (unknownKeys.length) problems.push(untranslatedMessage(unknownKeys))

    const errors = appErrors?.() ?? []
    const unknownErrors = errors.filter((error) => {
      const issue = knownAppIssueOf(error)
      if (issue) noteKnown(`${error.message} on ${error.where}: ${issue}`)
      return !issue
    })
    if (unknownErrors.length) {
      problems.push(appErrorsMessage(unknownErrors))
      const stacks = unknownErrors
        .filter((error) => error.stack)
        .map((error) => `${error.where}\n${error.stack}`)
      if (stacks.length) {
        await test.info().attach('app errors', {
          body: stacks.join('\n\n'),
          contentType: 'text/plain',
        })
      }
    }

    if (problems.length) throw new Error(problems.join('\n\n'))
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
