import { TableSchema } from '@cornflow-ui/core/config/views'

export interface ConfigurationData {
  masterData: TableSchema
  inputData: TableSchema
  resultsData: TableSchema
}

/** Section definition from available_automations.sections (frontend-automation schema). */
export interface AutomationSectionDef {
  id: string
  title: Record<string, string> | string
  icon?: string
  /** Display order (lower first). Used to sort sections in the UI. */
  order?: number
}

/** Group definition from available_automations.groups (frontend-automation schema). */
export interface AutomationGroupDef {
  id: string
  title?: Record<string, string> | string
  icon?: string
  /** Display order (lower first). Used to sort groups within a section. */
  order?: number
}

/**
 * Filter types for query parameters (filter_info.filter_type).
 * Used by the frontend to build filter UI and map operators to API params.
 */
export type FilterType =
  | 'string_startswith'
  | 'string_contains'
  | 'string_endswith'
  | 'string_eq'
  | 'numeric_gt'
  | 'numeric_gte'
  | 'numeric_lt'
  | 'numeric_lte'
  | 'numeric_eq'
  | 'boolean'
  | 'datetime_lte'
  | 'datetime_gte'
  | 'datetime_eq'
  | 'time_lte'
  | 'time_gte'
  | 'time_eq'
  | 'limit'
  | 'offset'

/** Filter info for query parameters (is_filter: true). */
export interface QueryParameterFilterInfo {
  /** Column name the filter applies to; null for limit/offset or global search. */
  filters_on?: string | null
  /** Filter type; backend may also send "string" as shorthand for string_eq. */
  filter_type: string
  /** Name of the symmetric parameter for range pairs (e.g. fecha_lte ↔ fecha_gte). */
  symmetric?: string | null
}

/** Query parameter from path (in: "query", optional is_filter + filter_info, optional default). */
export interface QueryParameterDef {
  name: string
  in: 'query'
  required?: boolean
  type?: string
  format?: string
  /** When true, parameter is a list filter; frontend uses filter_info for UI and API. */
  is_filter?: boolean
  filter_info?: QueryParameterFilterInfo
  /** Default value (e.g. limit: 500, offset: 0). */
  default?: number | string | boolean
}

/** Path parameter (e.g. id for /entities/{id}/). */
export interface PathParameterDef {
  name: string
  in: 'path'
  required: boolean
  type?: string
}

/** Body parameter (e.g. body for POST with schema $ref). */
export interface BodyParameterDef {
  name: string
  in: 'body'
  required?: boolean
  schema?: { $ref?: string }
}

/** Union of all parameter definitions in a path operation. */
export type PathOperationParameter =
  | QueryParameterDef
  | PathParameterDef
  | BodyParameterDef

/** Date range filter pair (datetime_gte + datetime_lte with symmetric). */
export interface DateRangeFilterConfig {
  paramGte: string
  paramLte: string
  filtersOn: string
  label: string
}

/**
 * Optional "none" option for join_from (selector) fields in definitions.
 * When present, the selector shows this option first; selecting it sends null for the
 * corresponding foreign key to the backend.
 */
export interface DefinitionValueNone {
  /** Multilingual label for the "none" option (e.g. "ALL", "TODOS", "TOUS"). */
  title: Record<string, string>
}

/**
 * Parameter tables are tables that are represented as a single object (dictionary)
 * instead of an array of rows. They can appear in:
 * - Instance JSON schema: property with type "object" and "properties" (no "items")
 * - Instance / master data: one object per table key, e.g. { id, below_safety_stock, ... }
 * - Frontend-automation definitions: definition with type "object" and "properties"
 *
 * When enableEtlMetadataAndReview is true, parameter tables are treated as such for
 * "From DB" switches (per-field when object-type, per-row when array-type).
 */

/** Instance schema property can set allow_load_from_db; when false, "load from DB" is disabled for that parameter. */
export interface InstanceSchemaParameterProperty {
  type?: string
  allow_load_from_db?: boolean
  title?: Record<string, string> | string
  [key: string]: unknown
}

/** Request `operation` for POST `/edit-all-tables/` (multipart). */
export type EditAllTablesApiOperation =
  | 'post_bulk'
  | 'overwrite_all'
  | 'post_update_bulk'

/**
 * Status of an async bulk upload (frontend-automation `async_upload_status`).
 * Terminal states (stop polling): `completed`, `failed`.
 * `downloading` is legacy and treated like `queued`. `status` is the primary field
 * for UI logic; `dag_state` (raw Airflow run state) is secondary.
 */
export type AsyncUploadStatusValue =
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'downloading'

/** Terminal async upload states; polling stops once `status` is one of these. */
export const ASYNC_UPLOAD_TERMINAL_STATUSES: readonly AsyncUploadStatusValue[] =
  ['completed', 'failed'] as const

/** True when an async upload status means processing has finished (success or error). */
export function isAsyncUploadTerminal(status: string | null | undefined): boolean {
  return (
    status === 'completed' ||
    status === 'failed'
  )
}

/**
 * Response of an async bulk upload start (`async_post_bulk` / `async_post_update_bulk` /
 * `async_overwrite_all`). Returned with HTTP 202; `upload_id` is used to poll status.
 */
export interface AsyncUploadInitResponse {
  upload_id: string
  dag_run_id?: string
  status: string
}

/**
 * Response of `async_upload_status` (HTTP 200). `status` drives the UI;
 * `total_rows_loaded` shows progress; `error_message` is set when `status` is `failed`.
 */
export interface AsyncUploadStatusResponse {
  id: string
  filename?: string
  status: string
  total_rows_loaded?: number
  error_message?: string | null
  dag_run_id?: string
  dag_state?: string
  created_at?: string
  updated_at?: string
}
