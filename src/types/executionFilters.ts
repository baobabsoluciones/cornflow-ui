/**
 * executionFilters.ts — Types of the executions history filters (e.g. plant), of the options they
 * offer and of the executions list source.
 *
 * All optional app config (`core.parameters` in `src/app/config.ts`). A project that declares none
 * gets the history with its date filters only, listed from Cornflow's `GET /execution/`.
 */

/**
 * A selector of the executions history, e.g. the plant. Its options are the rows of a
 * frontend-automation table; the picked one goes to the executions list as the `key` query
 * parameter.
 */
export interface ExecutionFilter {
  /** Query parameter of the executions list (e.g. 'plant_id'). */
  key: string
  /** i18n key (or literal text) of the selector label. */
  labelKey: string
  /** Material Design icon shown in the selector (e.g. 'mdi-factory'). */
  icon?: string
  /**
   * Frontend-automation table the options come from and the column they show, as
   * `<table>.<column>` (e.g. 'plants.name'), the same format as `join_from` in frontend
   * automation. The value of each option is the row's `id`.
   */
  joinFrom: string
}

/** Picked value per filter key; `null` means "All". */
export type ExecutionFilterValues = Record<string, unknown>

/** One option taken from a frontend-automation table row. */
export interface TableOption {
  /** The row's `id`. */
  value: unknown
  /** The row's value in the `join_from` column. */
  title: string
}

/** Where the executions list is requested. Defaults to Cornflow's `GET /execution/`. */
export interface ExecutionsListEndpoint {
  path: string
  isExternal?: boolean
}
