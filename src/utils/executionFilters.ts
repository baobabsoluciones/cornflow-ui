/**
 * executionFilters.ts — Reads the optional multi-DAG and executions history settings of the app
 * config.
 *
 * Projects written before these settings existed do not declare them in their `src/app/config.ts`,
 * so every reader here falls back to the single-DAG behaviour and the date-only history.
 */
import appConfig from '@/app/config'
import type {
  ExecutionFilter,
  ExecutionFilterValues,
  ExecutionsListEndpoint,
} from '@cornflow-ui/core/types/executionFilters'

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

function isExecutionFilter(value: unknown): value is ExecutionFilter {
  if (!value || typeof value !== 'object') return false
  const filter = value as Partial<ExecutionFilter>
  return (
    typeof filter.key === 'string' &&
    filter.key !== '' &&
    typeof filter.optionsEndpoint === 'string' &&
    filter.optionsEndpoint !== '' &&
    typeof filter.valueField === 'string' &&
    filter.valueField !== ''
  )
}

/** Filters of the executions history, in the order the app declares them. Empty when none. */
export function readExecutionFilters(): ExecutionFilter[] {
  const declared = readParameters().executionFilters
  if (!Array.isArray(declared)) return []
  return declared.filter(isExecutionFilter)
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
export function hasFilterValue(value: unknown): boolean {
  return value !== undefined && value !== null && value !== ''
}

/** Picked values as query parameters (strings), leaving out the filters set to "All". */
export function toFilterQueryParams(
  values: ExecutionFilterValues,
): Record<string, string> {
  const params: Record<string, string> = {}
  for (const [key, value] of Object.entries(values)) {
    if (hasFilterValue(value)) params[key] = String(value)
  }
  return params
}

/** Same value for both sides, comparing as strings (query values come back as text). */
export function isSameOptionValue(a: unknown, b: unknown): boolean {
  return String(a) === String(b)
}
