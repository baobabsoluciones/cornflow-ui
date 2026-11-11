/**
 * What the backend tells the interface about each DAG of the user (`GET /external/frontend-config/`,
 * see the README): today, the load filters the ETL of each DAG asks for.
 */
import {
  getLoadFilterFields,
  type ExecutionConfigField,
} from '@cornflow-ui/core/utils/schemaUtils'

/** The ETL of one DAG as the backend describes it. */
export interface FrontendConfigEtl {
  /** Whether the DAG has an ETL. Part of the answer; the interface does not read it. */
  exists?: boolean
  /** JSON schema of the load filters: its `properties` and root `required`. */
  query?: Record<string, any>
}

export interface FrontendConfig {
  /** By DAG name (the `schema`). */
  etl?: Record<string, FrontendConfigEtl>
}

/**
 * The load filters the ETL of `schema` asks for. None for a DAG the answer leaves out, or without
 * an answer at all (`null`: no endpoint, an error).
 */
export function loadFilterFieldsOfDag(
  frontendConfig: FrontendConfig | null | undefined,
  schema: string,
): ExecutionConfigField[] {
  return getLoadFilterFields(frontendConfig?.etl?.[schema]?.query)
}
