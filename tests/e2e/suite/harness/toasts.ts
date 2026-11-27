/**
 * The toasts the app shows (`core-snackbar`): what each one said, and its kind (`success`,
 * `info`, `warning`, `error`). A toast goes after a few seconds, sooner than some steps take (a
 * sign-in with its code, for instance), so a test that checks one records them all from the start.
 */
import type { Page } from '@playwright/test'

export interface Toast {
  kind: string
  message: string
}

/**
 * Starts recording the toasts of `page`, before it loads its next address: call it before the
 * `goto`. Returns the list, which fills as they come, across reloads; poll it with `expect.poll`.
 */
export async function recordToasts(page: Page): Promise<Toast[]> {
  const toasts: Toast[] = []
  await page.exposeFunction('__e2eToast', (toast: Toast) => {
    toasts.push(toast)
  })
  await page.addInitScript(() => {
    const said = new WeakMap<Element, string>()
    const report = (window as unknown as { __e2eToast: (toast: Toast) => void })
      .__e2eToast
    new MutationObserver(() => {
      for (const toast of document.querySelectorAll(
        '[data-testid="core-snackbar"]',
      )) {
        const message =
          toast.querySelector('.core-snackbar__message')?.textContent?.trim() ??
          ''
        if (!message || said.get(toast) === message) continue
        said.set(toast, message)
        const icon = toast.querySelector('.core-snackbar__icon')
        const kind =
          [...(icon?.classList ?? [])]
            .find((name) => name.startsWith('is-'))
            ?.slice('is-'.length) ?? ''
        void report({ kind, message })
      }
    }).observe(document, {
      childList: true,
      subtree: true,
      characterData: true,
    })
  })
  return toasts
}
