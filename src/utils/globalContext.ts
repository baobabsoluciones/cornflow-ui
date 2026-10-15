/**
 * globalContext.ts — Reads the optional multi-DAG and global-context settings of the app config.
 *
 * Projects written before these settings existed do not declare them in their `src/app/config.ts`,
 * so every reader here falls back to the single-DAG, no-context behaviour.
 */
import appConfig from '@/app/config'
import type {
  ExecutionsListEndpoint,
  GlobalContextDimension,
  GlobalContextValues,
} from '@cornflow-ui/core/types/globalContext'

const DEFAULT_EXECUTIONS_LIST_ENDPOINT: ExecutionsListEndpoint = {
  path: '/execution/',
  isExternal: false,
}

function readParameters(): Record<string, unknown> {
  try {
    return (appConfig.getCore()?.parameters ?? {}) as Record<string, unknown>
  } catch {
    return {}
  }
}

function isDimension(value: unknown): value is GlobalContextDimension {
  if (!value || typeof value !== 'object') return false
  const dimension = value as Partial<GlobalContextDimension>
  return (
    typeof dimension.key === 'string' &&
    dimension.key !== '' &&
    typeof dimension.optionsEndpoint === 'string' &&
    dimension.optionsEndpoint !== '' &&
    typeof dimension.valueField === 'string' &&
    dimension.valueField !== ''
  )
}

/** Dimensions of the global context, in the order the app declares them. Empty when none. */
export function readGlobalContextDimensions(): GlobalContextDimension[] {
  const declared = readParameters().globalContext
  if (!Array.isArray(declared)) return []
  return declared.filter(isDimension)
}

/** Text to show for each DAG name in the module selector (literal text or i18n key). */
export function readSchemaLabels(): Record<string, string> {
  const labels = readParameters().schemaLabels
  if (!labels || typeof labels !== 'object' || Array.isArray(labels)) return {}
  return labels as Record<string, string>
}

/** Where the executions list is requested: `executionsListEndpoint`, or `GET /execution/`. */
export function resolveExecutionsListEndpoint(): ExecutionsListEndpoint {
  const declared = readParameters().executionsListEndpoint as
    | Partial<ExecutionsListEndpoint>
    | null
    | undefined
  if (!declared || typeof declared.path !== 'string' || declared.path === '') {
    return DEFAULT_EXECUTIONS_LIST_ENDPOINT
  }
  return { path: declared.path, isExternal: declared.isExternal === true }
}

/** True when the value counts as picked (not "All" and not missing). */
export function hasContextValue(value: unknown): boolean {
  return value !== undefined && value !== null && value !== ''
}

/** Picked values as query parameters (strings), leaving out the dimensions set to "All". */
export function toContextQueryParams(
  values: GlobalContextValues,
): Record<string, string> {
  const params: Record<string, string> = {}
  for (const [key, value] of Object.entries(values)) {
    if (hasContextValue(value)) params[key] = String(value)
  }
  return params
}

/** Picked values with their raw type, leaving out the dimensions set to "All". */
export function toContextConfig(
  values: GlobalContextValues,
): Record<string, unknown> {
  const config: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(values)) {
    if (hasContextValue(value)) config[key] = value
  }
  return config
}

/** Same value for both sides, comparing as strings (query values come back as text). */
export function isSameContextValue(a: unknown, b: unknown): boolean {
  return String(a) === String(b)
}
