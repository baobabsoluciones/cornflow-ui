/**
 * endpointOptions.ts — Types of a selector whose options come from a backend endpoint (e.g. the
 * plants the user may pick), shared by the executions history filters and the execution config
 * fields.
 */

/** Endpoint that returns the options of a selector: an array of objects, one per option. */
export interface EndpointOptionsSource {
  /** Path of the endpoint. It receives `schema` (the active DAG) as a query parameter. */
  optionsEndpoint: string
  /** When true the endpoint is requested under `/external`. */
  isExternal?: boolean
  /** Field of each option object holding the value (e.g. 'plant_id'). */
  valueField: string
  /** Field of each option object holding the text shown (e.g. 'name'). Defaults to `valueField`. */
  labelField?: string
}

/** One option, as the selector shows it. */
export interface EndpointOption {
  /** Raw value as the backend returned it. */
  value: unknown
  /** Text shown in the selector. */
  title: string
}
