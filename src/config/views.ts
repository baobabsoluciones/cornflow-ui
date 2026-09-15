// Table configuration types for the application

export interface TableConfig {
  group: string
  title: string
  icon?: string
  /**
   * Optional top-level section id (from available_automations.sections).
   * When set, table is shown under that section in the drawer; sections appear above the default "Master data" block.
   */
  section?: string | null
  /**
   * Optional array of schema (DAG) names that restrict table visibility.
   * - If not defined: Table is visible in all schemas and to all users with access
   * - If empty array []: Table is hidden in all schemas
   * - If has values: Table is shown only when the current schema (DAG being viewed) is in this list,
   *   and only to users with access to that schema
   */
  schemas?: string[]
  /** Display order (lower first). Tables within a section or group are sorted by this value. */
  order?: number
  /** Raw group id from schema (for ordering); group is the resolved title. */
  _groupKey?: string
  /** Set when the table config is generated from `solution.rawKpis` (KPI display mode). */
  _isFromRawKpis?: boolean
  /** Key in `solution.rawKpis` to load rows from (set when config key differs, e.g. `foo__kpi`). */
  _rawKpisSourceKey?: string
  _originalGroup?: any
  _originalTitle?: any
  _originalSection?: any
  // Operations
  get_list?: OperationConfig
  get_item?: OperationConfig
  post_item?: OperationConfig
  put_item?: OperationConfig
  delete_item?: OperationConfig
  post_bulk?: OperationConfig
  /** Bulk upsert: update existing rows and create new ones (PUT .../bulk/). */
  post_update_bulk?: OperationConfig
  delete_bulk?: OperationConfig
  overwrite_all?: OperationConfig
  /** Optional GET Excel export; automation key must be `download_excel_table` (same filter query params as `get_list` when defined on paths). */
  download_excel_table?: OperationConfig
  /**
   * When set, instance–master table matching uses this name instead of the config key
   * (e.g. Django model `ePlanificacionesAtenea` vs key `gme_e_planificaciones_atenea`).
   */
  model_table_name?: string | null
}

export interface OperationConfig {
  url: string
  http_method: string
  request_schema?: any
  response_schema?: any
  /** Query parameters from path (e.g. filters with is_filter + filter_info). */
  parameters?: Array<{
    name: string
    in: string
    required?: boolean
    type?: string
    format?: string
    is_filter?: boolean
    filter_info?: {
      filters_on?: string | null
      filter_type: string
      symmetric?: string | null
    }
  }>
}

export interface TableSchema {
  [tableName: string]: TableConfig
}
