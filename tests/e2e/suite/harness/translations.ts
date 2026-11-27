/**
 * Finds text keys shown untranslated: a text that is a whole key (`configParams.seconds`) instead
 * of what the key says. vue-i18n shows the key when it has no text for it.
 *
 * Every page of a browser context watches its own DOM. Whenever it changes and settles (another
 * route, a step of a wizard, a dialog), it looks at the visible text and at the `placeholder`,
 * `title` and `aria-label` of every element, and reports to the test what it found. Only a text
 * that starts with a first-level key of the app's texts counts (`describe().i18nNamespaces`), so
 * an e-mail address, a file name or a number are not taken for keys. The cells of data tables are
 * left out: what shows there is the user's data.
 */
import type { BrowserContext } from '@playwright/test'

/** A key found on screen, and where. */
export interface UntranslatedKey {
  key: string
  /** Path (and hash) of the page it was on. */
  where: string
}

const BINDING = '__cornflowE2eUntranslated'
const SCAN = '__cornflowE2eScan'

/** Runs inside the page: watches the DOM and reports what looks like a key. */
function watchForKeys(args: {
  namespaces: string[]
  binding: string
  scan: string
}): void {
  if (!args.namespaces.length) return
  // Where the user's own data shows (cells of a data table, editable text): a value there that
  // looks like a key (a file called `general.xlsx`) is data, not a text of the app.
  const USER_DATA = 'td, [role="gridcell"], [contenteditable="true"]'
  const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const keyPattern = new RegExp(
    `^(?:${args.namespaces.map(escape).join('|')})(?:\\.[\\w-]+)+$`,
  )
  const reported = new Set<string>()
  let sending: Promise<unknown>[] = []
  const report = (key: string) => {
    const where = location.pathname + location.hash
    if (reported.has(`${key}@${where}`)) return
    reported.add(`${key}@${where}`)
    const send = (window as any)[args.binding]
    if (typeof send === 'function') sending.push(send({ key, where }))
  }

  /** Looks at the page now; resolves once the test has whatever it found. */
  const scan = (): Promise<unknown> => {
    if (document.body) lookAtPage()
    const pending = sending
    sending = []
    return Promise.all(pending)
  }

  const lookAtPage = () => {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
    )
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.nodeValue?.trim()
      if (!text || text.length > 200 || !keyPattern.test(text)) continue
      const element = node.parentElement
      if (!element || element.closest(USER_DATA)) continue
      if (element.checkVisibility && !element.checkVisibility()) continue
      report(text)
    }
    for (const element of document.body.querySelectorAll(
      '[placeholder], [title], [aria-label]',
    )) {
      for (const name of ['placeholder', 'title', 'aria-label']) {
        const value = element.getAttribute(name)?.trim()
        if (value && keyPattern.test(value)) report(value)
      }
    }
  }

  let timer: ReturnType<typeof setTimeout> | undefined
  const scanSoon = () => {
    clearTimeout(timer)
    timer = setTimeout(scan, 150)
  }
  ;(window as any)[args.scan] = scan
  const start = () => {
    new MutationObserver(scanSoon).observe(document.documentElement, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [
        'placeholder',
        'title',
        'aria-label',
        'style',
        'class',
        'hidden',
      ],
    })
    scanSoon()
  }
  if (document.documentElement) start()
  else document.addEventListener('DOMContentLoaded', start)
}

/**
 * Makes every page of `context` look for untranslated keys. Returns what they found, read after
 * a last look at each open page.
 */
export async function watchTranslations(
  context: BrowserContext,
  namespaces: string[],
): Promise<() => Promise<UntranslatedKey[]>> {
  const found: UntranslatedKey[] = []
  await context.exposeBinding(BINDING, (_source, item: UntranslatedKey) => {
    if (!found.some((f) => f.key === item.key && f.where === item.where))
      found.push(item)
  })
  await context.addInitScript(watchForKeys, {
    namespaces,
    binding: BINDING,
    scan: SCAN,
  })

  return async () => {
    for (const page of context.pages()) {
      await page
        .evaluate((scan) => (window as any)[scan]?.(), SCAN)
        .catch(() => undefined)
    }
    return found
  }
}

/**
 * Faults of core that show keys untranslated, already known and waiting for their fix. A key
 * they explain does not fail the test: it is noted on it (annotation `known issue`) and listed by
 * the coverage report. Take the entry out once core is fixed, and the keys fail tests again.
 */
export const KNOWN_UNTRANSLATED: { pattern: RegExp; issue: string }[] = [
  {
    pattern: /^configParams\./,
    issue:
      'a parameter of the execution config of the schema that is not declared in configFields ' +
      'shows its raw key (pending fix in core)',
  },
]

/** The known fault that explains a key, if any. */
export function knownIssueOf(key: string): string | null {
  return (
    KNOWN_UNTRANSLATED.find(({ pattern }) => pattern.test(key))?.issue ?? null
  )
}

/** The message of a test that showed untranslated keys. */
export function untranslatedMessage(keys: UntranslatedKey[]): string {
  return (
    'Text keys shown untranslated:\n' +
    keys.map(({ key, where }) => `  ${key}  (on ${where})`).join('\n')
  )
}
