/**
 * executionFilters.ts — Types of the executions history filters (e.g. plant) and of the executions
 * list source.
 *
 * Both are optional app config (`core.parameters` in `src/app/config.ts`). A project that does not
 * declare them gets the history with its date filters only, listed from Cornflow's
 * `GET /execution/`.
 */
import type { EndpointOptionsSource } from '@cornflow-ui/core/types/endpointOptions'

/**
 * A selector of the executions history, e.g. the plant. It offers "All" and the options the
 * backend returns; the picked value goes to the executions list as the `key` query parameter.
 */
export interface ExecutionFilter extends EndpointOptionsSource {
  /** Query parameter of the executions list (e.g. 'plant_id'). */
  key: string
  /** i18n key (or literal text) of the selector label. */
  labelKey: string
  /** Material Design icon shown in the selector (e.g. 'mdi-factory'). */
  icon?: string
  /**
   * Key of another filter whose value filters this one's options (e.g. program → plant). The
   * options endpoint receives that value, and the filter is disabled while the other is on "All".
   */
  dependsOn?: string
}

/** Picked value per filter key; `null` means "All". */
export type ExecutionFilterValues = Record<string, unknown>

/** Where the executions list is requested. Defaults to Cornflow's `GET /execution/`. */
export interface ExecutionsListEndpoint {
  path: string
  isExternal?: boolean
}
