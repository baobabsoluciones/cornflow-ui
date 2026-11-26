/**
 * What every page of a test is checked for, whatever the screen: text keys shown untranslated
 * (harness/translations.ts) and errors of the app (harness/appErrors.ts). The `context` fixture
 * checks the test's own pages this way; a test that opens a page as another user (`asUser`) has it
 * checked too.
 */
import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Page,
} from '@playwright/test'
import { appErrorsMessage, knownAppIssueOf, watchAppErrors } from './appErrors'
import type { Deployment } from './run'
import { newSignedInContext } from './session'
import {
  knownIssueOf,
  untranslatedMessage,
  watchTranslations,
} from './translations'

/**
 * Starts watching every page of `context`. `finish()`, once the test is done with it, notes the
 * known faults it met on the test (annotation `known issue`), attaches the stacks of the errors,
 * and throws listing the rest.
 */
export async function watchContext(
  context: BrowserContext,
  deployment: Deployment,
  {
    checkTranslations = true,
    checkAppErrors = true,
  }: { checkTranslations?: boolean; checkAppErrors?: boolean } = {},
): Promise<() => Promise<void>> {
  const untranslated = checkTranslations
    ? await watchTranslations(context, deployment.i18nNamespaces)
    : null
  const appErrors = checkAppErrors ? watchAppErrors(context) : null

  return async () => {
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
  }
}

/**
 * Runs `use` on a page signed in as one of the run's users, checked as the test's own pages are
 * (untranslated texts, errors of the app). The page is closed however `use` ends.
 */
export async function asUser(
  browser: Browser,
  deployment: Deployment,
  session: string,
  use: (page: Page) => Promise<void>,
): Promise<void> {
  const context = await newSignedInContext(browser, session)
  try {
    const finish = await watchContext(context, deployment)
    const page = await context.newPage()
    await page.goto('/')
    await expect(page.getByTestId('app-drawer')).toBeAttached({
      timeout: 30_000,
    })
    await use(page)
    await context.close()
    await finish()
  } finally {
    await context.close()
  }
}
