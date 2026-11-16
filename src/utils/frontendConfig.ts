/**
 * What the backend tells the interface about each DAG of the user (`GET /external/frontend-config/`,
 * see the README): the load filters the ETL of each DAG asks for, and the endpoints the executions
 * of each DAG are read from.
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

/**
 * The endpoints of the external backend the executions of one DAG are read from, as paths under
 * `/external` (e.g. `/executions/{id}/`). `{id}` stands for the id of the execution, or of its
 * instance in `instance_data`. A key the backend leaves out is read from Cornflow. See the README,
 * "Execution endpoints".
 */
export interface FrontendConfigExecutions {
  /** The executions list of the history and the drawer. Cornflow's: `/execution/`. */
  list?: string
  /**
   * One execution: its details and state (`GET`), the upload of its solution (`PUT` with
   * `{ data }`) and its deletion (`DELETE`).
   * Cornflow's: `/execution/{id}/`.
   */
  details?: string
  /** The data of one execution: its solution, checks and `instance_id`. Cornflow's: `/execution/{id}/data/`. */
  data?: string
  /** The instance of a loaded execution. Cornflow's: `/instance/{id}/data/`. */
  instance_data?: string
}

export interface FrontendConfig {
  /** By DAG name (the `schema`). */
  etl?: Record<string, FrontendConfigEtl>
  /** By DAG name (the `schema`). */
  executions?: Record<string, FrontendConfigExecutions>
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
