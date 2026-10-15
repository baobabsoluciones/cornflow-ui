/**
 * globalContext.ts — Types of the global context (e.g. plant) and of the executions list source.
 *
 * Both are optional app config (`core.parameters` in `src/app/config.ts`). A project that does not
 * declare them keeps the single-context behaviour: no selector, no extra query parameters.
 */

/**
 * One dimension of the global context, e.g. the plant. The user picks one of the options the
 * backend offers, and the core applies the value:
 * - to the executions list, as the `key` query parameter;
 * - to the master-data tables whose `get_list.parameters` declare a parameter named `key`;
 * - to new executions, as `config[key]`, and to the ETL backend, as a pre-ETL parameter.
 * It never reaches the views of a loaded execution: that execution already belongs to one value.
 */
export interface GlobalContextDimension {
  /** Query parameter and execution config key (e.g. 'plant_id'). */
  key: string
  /** i18n key (or literal text) of the selector label. */
  labelKey: string
  /** Material Design icon shown in the selector (e.g. 'mdi-factory'). */
  icon?: string
  /**
   * Endpoint that returns the options the current user may pick: an array of objects. It receives
   * `schema` (the active DAG) and, when `dependsOn` is set, the parent dimension's value.
   */
  optionsEndpoint: string
  /** When true the endpoint is requested under `/external`. */
  isExternal?: boolean
  /** Field of each option object holding the value (e.g. 'plant_id'). */
  valueField: string
  /** Field of each option object holding the text shown (e.g. 'name'). Defaults to `valueField`. */
  labelField?: string
  /** Key of another dimension whose value filters this one's options (e.g. program → plant). */
  dependsOn?: string
  /**
   * Offer an "All" entry that sends no value. Reads (executions list, master data) are then not
   * filtered by this dimension, and a new execution cannot be launched until a value is picked.
   */
  allowEmpty?: boolean
}

/** One option of a dimension, as the selector shows it. */
export interface GlobalContextOption {
  /** Raw value as the backend returned it; stamped as is in the execution config. */
  value: unknown
  /** Text shown in the selector. */
  title: string
}

/** Selected value per dimension key; `null` means "All" (only with `allowEmpty`). */
export type GlobalContextValues = Record<string, unknown>

/** Where the executions list is requested. Defaults to Cornflow's `GET /execution/`. */
export interface ExecutionsListEndpoint {
  path: string
  isExternal?: boolean
}
