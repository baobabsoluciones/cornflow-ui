/**
 * Finds what goes wrong in the app while a test goes through it, even when the screen looks fine:
 *
 * - `uncaught`: a JavaScript error nothing caught, in any page of the test.
 * - `vue`: an error inside a component (Vue warns "Unhandled error during execution of …"). In
 *   development Vue throws it again, so it is also `uncaught`; the warning says where it happened.
 * - `server`: a response with a 5xx status, from the backend or anything else the app calls.
 *
 * Left out on purpose: 4xx responses (a wrong password answers 401, and a backend without an
 * optional endpoint answers 404), requests cut short by a navigation, what the app itself logs
 * with `console.error` for a failure it handles, and the development server's own 504 when it
 * finds a new dependency half-way through and reloads the page ("Outdated Optimize Dep" of Vite,
 * which a built app does not have).
 *
 * Errors inside components are thrown only when the app runs in development mode, as the suite
 * starts it by default. Against a production build only `uncaught` and `server` are found.
 */
import type { BrowserContext, Page } from '@playwright/test'

export type AppErrorKind = 'uncaught' | 'vue' | 'server'

/** Something that went wrong, and where. */
export interface AppError {
  kind: AppErrorKind
  message: string
  /** Path (and hash) of the page it happened on. */
  where: string
  /** The stack of an uncaught error, for the report. */
  stack?: string
}

const VUE_UNHANDLED = /^\[Vue warn\]: Unhandled error/

/** Vite's development server answers 504 for a dependency it optimises anew, then reloads. */
function isDevServerReoptimizing(status: number, url: string): boolean {
  return status === 504 && url.includes('/node_modules/.vite/deps/')
}

function pathOf(page: Page | null | undefined): string {
  if (!page) return '(no page)'
  try {
    const url = new URL(page.url())
    return url.pathname + url.hash
  } catch {
    return page.url()
  }
}

/**
 * Starts watching every page of `context`. Returns what was found until then, each error once
 * per page.
 */
export function watchAppErrors(context: BrowserContext): () => AppError[] {
  const found: AppError[] = []
  const add = (error: AppError) => {
    if (
      !found.some(
        (f) =>
          f.kind === error.kind &&
          f.message === error.message &&
          f.where === error.where,
      )
    )
      found.push(error)
  }

  context.on('weberror', (webError) => {
    const error = webError.error()
    add({
      kind: 'uncaught',
      message: error.message || String(error),
      where: pathOf(webError.page()),
      stack: error.stack,
    })
  })

  context.on('console', (message) => {
    if (message.type() !== 'warning' || !VUE_UNHANDLED.test(message.text()))
      return
    // The first line names the hook; the rest is the component trace.
    add({
      kind: 'vue',
      message: message.text().split('\n')[0].trim(),
      where: pathOf(message.page()),
    })
  })

  context.on('response', (response) => {
    if (response.status() < 500) return
    if (isDevServerReoptimizing(response.status(), response.url())) return
    let page: Page | null = null
    try {
      page = response.frame().page()
    } catch {
      // A response of a service worker has no frame.
    }
    add({
      kind: 'server',
      message: `${response.request().method()} ${response.url()} answered ${response.status()}`,
      where: pathOf(page),
    })
  })

  return () => [...found]
}

/**
 * Faults already known that make the app fail this way, waiting for their fix. An error they
 * explain does not fail the test: it is noted on it (annotation `known issue`) and listed by the
 * coverage report. Take the entry out once it is fixed, and the error fails tests again.
 */
export const KNOWN_APP_ERRORS: {
  kind: AppErrorKind
  pattern: RegExp
  issue: string
}[] = []

/** The known fault that explains an error, if any. */
export function knownAppIssueOf(error: AppError): string | null {
  return (
    KNOWN_APP_ERRORS.find(
      ({ kind, pattern }) => kind === error.kind && pattern.test(error.message),
    )?.issue ?? null
  )
}

const KIND_NAMES: Record<AppErrorKind, string> = {
  uncaught: 'uncaught error',
  vue: 'error in a component',
  server: 'server error',
}

/** The message of a test that ran into errors of the app. */
export function appErrorsMessage(errors: AppError[]): string {
  return (
    'The app ran into errors:\n' +
    errors
      .map(
        ({ kind, message, where }) =>
          `  ${KIND_NAMES[kind]}: ${message}  (on ${where})`,
      )
      .join('\n')
  )
}
