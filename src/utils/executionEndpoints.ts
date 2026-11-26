/**
 * executionEndpoints.ts — Where the executions of a DAG are read from.
 *
 * Each read goes, in this order, to:
 * 1. the endpoint the external backend declares for the DAG in the `executions` section of
 *    `GET /external/frontend-config/` (always under `/external`);
 * 2. for the list only (`get_list`), `executionsListEndpoint` of the app config;
 * 3. Cornflow.
 *
 * See the README, "Execution endpoints".
 */
import { resolveExecutionsListEndpoint } from '@cornflow-ui/core/utils/executionFilters'
import type {
  FrontendConfig,
  FrontendConfigExecutions,
} from '@cornflow-ui/core/utils/frontendConfig'

/** An operation on the executions of a DAG: a key of the `executions` section of the frontend config. */
export type ExecutionEndpointKey = keyof FrontendConfigExecutions

/** A request target: the path, under `/external` or under Cornflow. */
export interface ExecutionEndpoint {
  path: string
  isExternal: boolean
}

/** Stands for the id of the execution, or of its instance in `get_instance_data`. */
export const EXECUTION_ID_PLACEHOLDER = '{id}'

const CORNFLOW_ROUTES: Record<Exclude<ExecutionEndpointKey, 'get_list'>, string> = {
  get_detail: `/execution/${EXECUTION_ID_PLACEHOLDER}/`,
  put_detail: `/execution/${EXECUTION_ID_PLACEHOLDER}/`,
  delete_detail: `/execution/${EXECUTION_ID_PLACEHOLDER}/`,
  get_data: `/execution/${EXECUTION_ID_PLACEHOLDER}/data/`,
  get_instance_data: `/instance/${EXECUTION_ID_PLACEHOLDER}/data/`,
}

/** Routes already warned about, so that a poll does not repeat the warning. */
const warnedRoutes = new Set<string>()

function warnOnce(schema: string, key: ExecutionEndpointKey, route: unknown): void {
  const id = `${schema}:${key}:${String(route)}`
  if (warnedRoutes.has(id)) return
  warnedRoutes.add(id)
  console.warn(
    `The frontend config declares an unusable "${key}" route for the executions of "${schema}": ` +
      `it must be a path starting with "/"${key === 'get_list' ? '' : ` with "${EXECUTION_ID_PLACEHOLDER}"`}. ` +
      'The next source is used instead.',
    route,
  )
}

/**
 * The route the backend declares for `key` in the DAG, or null when it declares none or an
 * unusable one (not a path, or without `{id}` where an id goes).
 */
function declaredRoute(
  frontendConfig: FrontendConfig | null | undefined,
  schema: string,
  key: ExecutionEndpointKey,
): string | null {
  const route: unknown = frontendConfig?.executions?.[schema]?.[key]
  if (route === undefined || route === null) return null
  const usable =
    typeof route === 'string' &&
    route.startsWith('/') &&
    (key === 'get_list' || route.includes(EXECUTION_ID_PLACEHOLDER))
  if (!usable) {
    warnOnce(schema, key, route)
    return null
  }
  return route as string
}

function withId(route: string, id: string | undefined): string {
  return route.replaceAll(EXECUTION_ID_PLACEHOLDER, encodeURIComponent(String(id ?? '')))
}

/**
 * Where to send `key` on the executions of `schema`.
 *
 * @param frontendConfig - The answer of `GET /external/frontend-config/`, or null without one
 * @param schema - The DAG of the executions
 * @param key - The operation: the list, the read, update or deletion of one execution, its data
 *   or the instance of one
 * @param id - The id that replaces `{id}`: of the execution, or of its instance in
 *   `get_instance_data`
 */
export function resolveExecutionEndpoint(
  frontendConfig: FrontendConfig | null | undefined,
  schema: string,
  key: ExecutionEndpointKey,
  id?: string,
): ExecutionEndpoint {
  const declared = declaredRoute(frontendConfig, schema, key)
  if (declared !== null) {
    return { path: withId(declared, id), isExternal: true }
  }
  if (key === 'get_list') {
    const listEndpoint = resolveExecutionsListEndpoint()
    return { path: listEndpoint.path, isExternal: listEndpoint.isExternal === true }
  }
  return { path: withId(CORNFLOW_ROUTES[key], id), isExternal: false }
}
