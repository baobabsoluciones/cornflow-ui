/**
 * The client's own backend, in front of Cornflow (`<backend>/external/…`): its master tables, its
 * warnings. What it gives is read from the page, with the user's session, as the app reads it.
 */
import type { Page } from '@playwright/test'
import type { Deployment } from './run'

/**
 * The address of `path` on the client's backend, with `query`. Relative where the app's backend is
 * (`/api`, behind the same host): the page reads it, so it goes where the app's requests go.
 */
export function externalUrl(
  deployment: Deployment,
  path: string,
  query: Record<string, string> = {},
): string {
  const address = `${deployment.backendUrl.replace(/\/+$/, '')}/external${path}`
  const absolute = /^[a-z][a-z\d+.-]*:/i.test(address)
  // Any host does to add the query; a relative address is given back without it.
  const url = new URL(address, 'http://relative.invalid')
  for (const [name, value] of Object.entries(query))
    url.searchParams.set(name, value)
  return absolute ? url.href : `${url.pathname}${url.search}`
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
