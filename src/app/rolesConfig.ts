/**
 * Role-based permission configuration (denylist) — PROJECT DATA.
 *
 * For each role name (matching the `name` field returned by the backend `/roles/` endpoint),
 * list what that role CANNOT access.  Everything NOT listed is allowed.
 *
 * The gating MECHANISM lives in core (`@/services/rolePermissions`); this file provides only the
 * project-specific DATA and re-exports the mechanism bound to that data for convenience.
 *
 * Semantics
 * ---------
 * - `forbidden_views`     : view identifiers the role cannot navigate to.
 *   Identifiers correspond to route names / logical view ids used in the router
 *   and AppDrawer (e.g. 'project-execution', 'user-settings', 'dashboard').
 * - `forbidden_endpoints` : API calls the role cannot make.
 *   Format: '<METHOD> <path-pattern>' (e.g. 'POST /execution/', 'DELETE /execution/*').
 *   The '*' wildcard matches any single path segment.
 * - `defaultView`         : fallback landing view when the app's defaultView is forbidden.
 *
 * Default behaviour
 * -----------------
 * If the user has no role, or the role name is not present in this config,
 * NO extra restrictions are applied – behaviour stays as today.
 *
 * Example (commented out – uncomment and adapt for your project)
 * --------------------------------------------------------------
 * viewer: {
 *   forbidden_views: ['project-execution'],
 *   forbidden_endpoints: ['POST /execution/', 'PUT /execution/*', 'DELETE /execution/*'],
 * },
 */
import {
  isViewAllowed as coreIsViewAllowed,
  getRoleDefaultView as coreGetRoleDefaultView,
  isEndpointAllowed as coreIsEndpointAllowed,
} from '@cornflow-ui/core/services/rolePermissions'
import type { RolePermissions } from '@cornflow-ui/core/services/rolePermissions'

export type { RolePermissions } from '@cornflow-ui/core/services/rolePermissions'

/** Map of role name → forbidden views & endpoints. */
// The read-only roles must not see the execution-creation wizard: the server
// already answers 403 to their writes, but offering the action just to fail
// with a generic error is misleading (UAT 7.2). Note the mechanism is strict
// with multi-role users -- access is granted only when NO role forbids it,
// for views and endpoints alike -- so these entries assume viewer-type roles
// are not combined with write roles.
const rolesConfig: Record<string, RolePermissions> = {
  viewer: {
    forbidden_views: ['project-execution'],
    defaultView: 'history-execution',
  },
  platform_viewer: {
    forbidden_views: ['project-execution'],
    defaultView: 'history-execution',
  },
}

export default rolesConfig

// ── Helpers bound to this project's rolesConfig data ───────────────────────────
// Thin wrappers over the core mechanism so existing core consumers (router, AppDrawer)
// keep calling `isViewAllowed(roles, viewId)` without passing the data each time.

export function isViewAllowed(
  roleNames: string[] | string | undefined,
  viewId: string,
): boolean {
  return coreIsViewAllowed(roleNames, viewId, rolesConfig)
}

export function getRoleDefaultView(
  roleNames: string[] | string | undefined,
): string | null {
  return coreGetRoleDefaultView(roleNames, rolesConfig)
}

export function isEndpointAllowed(
  roleNames: string[] | string | undefined,
  method: string,
  path: string,
): boolean {
  return coreIsEndpointAllowed(roleNames, method, path, rolesConfig)
}
