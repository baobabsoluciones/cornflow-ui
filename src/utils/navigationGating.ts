/**
 * navigationGating.ts — Role and DAG gating of app sections, dashboard pages and their routes.
 *
 * An entry (drawer item or route meta) may declare `roles` and `schemas`. Without them it is
 * visible to everyone on every DAG.
 */

/** Optional gating an app section, a dashboard page or a route meta may declare. */
export interface NavigationGating {
  /** Visible only to users with at least one of these role names. */
  roles?: string[]
  /** Visible only while the session works on one of these DAGs. */
  schemas?: string[]
}

/** Who is looking: the user's role names and the DAG the session works on. */
export interface NavigationViewer {
  roleNames: string[]
  schema: string
}

/** True when `entry` may be shown to `viewer`. */
export function isEntryVisibleFor(
  entry: NavigationGating | null | undefined,
  viewer: NavigationViewer,
): boolean {
  if (!entry) return true
  const { roles, schemas } = entry
  if (
    Array.isArray(roles) &&
    !roles.some((role) => viewer.roleNames.includes(role))
  ) {
    return false
  }
  if (Array.isArray(schemas) && !schemas.includes(viewer.schema)) {
    return false
  }
  return true
}
