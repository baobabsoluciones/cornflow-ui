/**
 * The client's own backend, in front of Cornflow (`<backend>/external/…`): its master tables, its
 * warnings. What it gives is read from the page, with the user's session, as the app reads it.
 */
import type { Page } from '@playwright/test'
import type { Deployment } from './run'

/** The address of `path` on the client's backend, with `query`. */
export function externalUrl(
  deployment: Deployment,
  path: string,
  query: Record<string, string> = {},
): string {
  const url = new URL(
    `${deployment.backendUrl.replace(/\/+$/, '')}/external${path}`,
  )
  for (const [name, value] of Object.entries(query))
    url.searchParams.set(name, value)
  return url.href
}

/** Reads `href` from the page with the user's session: its status and its JSON, if any. */
export function readFromPage(
  page: Page,
  href: string,
): Promise<{ status: number; body: unknown }> {
  return page.evaluate(async (href) => {
    const response = await fetch(href, {
      headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` },
    })
    return {
      status: response.status,
      body: await response.json().catch(() => null),
    }
  }, href)
}
