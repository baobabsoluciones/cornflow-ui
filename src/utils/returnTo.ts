/**
 * returnTo — where to take the user back to after a forced sign-in.
 *
 * When the session ends (expired token, rejected refresh) the route being shown is remembered, and
 * the next successful sign-in in this tab navigates back to it, once. Only paths of this same app
 * are accepted: a relative path starting with a single `/`. Anything else (an absolute URL, a
 * protocol-relative `//host`, the sign-in/out routes) is ignored, so the value can never be used
 * to send the user to another site.
 */
const STORAGE_KEY = 'returnTo'

/** Routes that are not worth coming back to: the ones that end or start a session. */
const SESSION_ROUTES = new Set(['/sign-in', '/sign-out', '/logout'])

/** True for a relative path of this app (`/path?query#hash`) that is not a sign-in/out route. */
export function isReturnable(path: unknown): path is string {
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) return false
  // Backslashes and control characters are read as slashes by some browsers (`/\evil.com`)
  if (/[\\\u0000-\u001f\u007f]/.test(path)) return false
  try {
    if (new URL(path, 'http://app.invalid').origin !== 'http://app.invalid') return false
  } catch {
    return false
  }
  const pathname = path.split(/[?#]/)[0].replace(/\/+$/, '') || '/'
  return !SESSION_ROUTES.has(pathname.toLowerCase())
}

/** Remembers the route (full path + query) to come back to; a path that is not returnable is ignored. */
export function rememberReturnTo(fullPath: unknown): void {
  if (!isReturnable(fullPath)) return
  try {
    sessionStorage.setItem(STORAGE_KEY, fullPath)
  } catch {
    // Storage unavailable: the user lands on the default page, as before
  }
}

/** The remembered route, or null. It is forgotten as it is read: a return-to is used once. */
export function takeReturnTo(): string | null {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY)
    sessionStorage.removeItem(STORAGE_KEY)
    return isReturnable(stored) ? stored : null
  } catch {
    return null
  }
}

/** Forgets the remembered route (an explicit sign-out has nothing to come back to). */
export function clearReturnTo(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // nothing to clear
  }
}
