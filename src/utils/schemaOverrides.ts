/**
 * schemaOverrides.ts — Per-DAG settings of `src/app/config.ts`.
 *
 * A deployment that serves several DAGs may give each one its own `parameters` and dashboard
 * layouts under `core.schemaOverrides`, keyed by DAG name. The settings of a DAG are the app's
 * `parameters` with its entry merged on top: plain objects merge key by key, and any other value
 * (arrays, functions, classes, primitives) replaces the app's. A DAG without an entry uses the
 * app's settings as they are.
 */

/** Per-DAG entry of `core.schemaOverrides`. */
export interface SchemaOverride {
  /** Keys of `core.parameters` this DAG sets differently (see `APP_WIDE_PARAMETERS`). */
  parameters?: Record<string, unknown>
  /** Layout of the custom dashboards (`dashboardLayout`) on this DAG. */
  dashboardLayout?: unknown[]
  /** Layout of the instance dashboards (`instanceDashboardLayout`) on this DAG. */
  instanceDashboardLayout?: unknown[]
}

/** `core.schemaOverrides`: DAG name → its settings. */
export type SchemaOverrides = Record<string, SchemaOverride>

/**
 * Parameters that belong to the deployment, not to a DAG: they are read before the session
 * picks a DAG, or they describe the DAGs themselves. A DAG entry cannot set them.
 */
export const APP_WIDE_PARAMETERS: readonly string[] = [
  'valuesJsonPath',
  'schemaLabels',
  'enableRolesManagement',
  'allowEditRoles',
  'showOpenIdUsername',
  'enableDarkMode',
]

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

/**
 * Copies plain objects and arrays, so a DAG's settings never share a container with the app's
 * (the store writes the schema's solver settings into them). Functions, class instances and
 * primitives are kept as they are.
 */
export function cloneConfigValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => cloneConfigValue(item)) as T
  }
  if (isPlainObject(value)) {
    const copy: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value)) {
      copy[key] = cloneConfigValue(item)
    }
    return copy as T
  }
  return value
}

function mergeConfigValue(base: unknown, override: unknown): unknown {
  if (isPlainObject(base) && isPlainObject(override)) {
    const merged: Record<string, unknown> = { ...base }
    for (const [key, value] of Object.entries(override)) {
      merged[key] = mergeConfigValue(base[key], value)
    }
    return merged
  }
  return cloneConfigValue(override)
}

/**
 * Settings of a DAG: a copy of the app's `parameters` with the DAG's `parameters` merged on top.
 * Keys of `APP_WIDE_PARAMETERS` and keys the app does not declare are left out, with a console
 * warning naming the DAG.
 */
export function resolveSchemaParameters<P extends Record<string, unknown>>(
  base: P,
  schema: string,
  override: Record<string, unknown> | undefined,
): P {
  const resolved = cloneConfigValue(base) as Record<string, unknown>
  for (const [key, value] of Object.entries(override ?? {})) {
    if (APP_WIDE_PARAMETERS.includes(key)) {
      console.warn(
        `schemaOverrides.${schema}.parameters.${key} is ignored: it applies to the whole application`,
      )
      continue
    }
    if (!(key in base)) {
      console.warn(
        `schemaOverrides.${schema}.parameters.${key} is ignored: core.parameters has no such key`,
      )
      continue
    }
    resolved[key] = mergeConfigValue(resolved[key], value)
  }
  return resolved as P
}
