/**
 * rolePermissions.ts — Mecanismo (CORE) de permisos por rol (denylist).
 *
 * El CORE provee la LÓGICA de gating por rol; el PROYECTO (`@/app/rolesConfig`) provee solo los
 * DATOS (mapa rol → vistas/endpoints prohibidos). Antes la lógica vivía en `@/app/rolesConfig`,
 * lo que obligaba a core y a los módulos premium a depender de la capa de proyecto para el
 * mecanismo. Ahora las funciones reciben el `config` de datos como parámetro, de modo que tanto el
 * core (router, AppDrawer) como los módulos premium (vía `ExtensionContext.isViewAllowed`) usan
 * el mismo mecanismo sin acoplarse a un proyecto concreto.
 *
 * Semántica: ver `@/app/rolesConfig` (denylist; multi-rol permisivo: un rol sin restricción concede).
 */

export interface RolePermissions {
  /** View identifiers this role CANNOT access (denylist). */
  forbidden_views?: string[]
  /** Endpoint patterns this role CANNOT call (denylist). Format: 'METHOD /path/' */
  forbidden_endpoints?: string[]
  /**
   * Fallback landing view for this role when the app's configured defaultView is forbidden.
   * Uses the same path-segment format as the app config (e.g. 'configuration').
   */
  defaultView?: string
}

/** Map of role name → forbidden views & endpoints (project-provided data). */
export type RolesConfig = Record<string, RolePermissions>

function normaliseRoleNames(input: string[] | string | undefined): string[] {
  if (!input) return []
  if (Array.isArray(input)) return input.filter(Boolean)
  return [input]
}

function matchesEndpointPattern(pattern: string, key: string): boolean {
  // Escape regex special chars except '*', then replace '*' with a segment wildcard
  const regexStr =
    '^' +
    pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]+') +
    '$'
  return new RegExp(regexStr).test(key)
}

/**
 * Returns true if the user (identified by their role names) is allowed to access the view
 * with `viewId`, given the project's role `config`.
 *
 * Multi-role semantics (restrictive union): forbidden if ANY configured role forbids the view;
 * unconfigured roles add no restrictions; no roles → always allowed (backwards-compatible).
 */
export function isViewAllowed(
  roleNames: string[] | string | undefined,
  viewId: string,
  config: RolesConfig,
): boolean {
  const names = normaliseRoleNames(roleNames)
  if (names.length === 0) return true
  return names.every((name) => {
    if (!(name in config)) return true
    const forbidden = config[name]?.forbidden_views ?? []
    return !forbidden.includes(viewId)
  })
}

/**
 * Returns the role-specific default landing view for the user, or null if none is configured.
 * When the user has multiple roles, the first role (in order) that defines a defaultView wins.
 */
export function getRoleDefaultView(
  roleNames: string[] | string | undefined,
  config: RolesConfig,
): string | null {
  const names = normaliseRoleNames(roleNames)
  for (const name of names) {
    const view = config[name]?.defaultView
    if (view) return view
  }
  return null
}

/**
 * Returns true if the user is allowed to call `method /path/`, given the project's role `config`.
 * Supports '*' as a wildcard for a single path segment. Multi-role permissive union.
 */
export function isEndpointAllowed(
  roleNames: string[] | string | undefined,
  method: string,
  path: string,
  config: RolesConfig,
): boolean {
  const names = normaliseRoleNames(roleNames)
  if (names.length === 0) return true
  const key = `${method.toUpperCase()} ${path}`
  return names.some((name) => {
    if (!(name in config)) return true
    const forbidden = config[name]?.forbidden_endpoints ?? []
    return !forbidden.some((pattern) => matchesEndpointPattern(pattern, key))
  })
}
