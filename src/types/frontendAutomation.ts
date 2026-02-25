import { TableSchema } from '@/config/views'

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
}

/** Filter info for query parameters. */
export interface QueryParameterFilterInfo {
  filters_on?: string | null
  filter_type: string
  symmetric?: string | null
}

/** Query parameter from path (in: "query", optional is_filter + filter_info). */
export interface QueryParameterDef {
  name: string
  in: string
  required?: boolean
  type?: string
  format?: string
  is_filter?: boolean
  filter_info?: QueryParameterFilterInfo
}

/** Date range filter pair (datetime_gte + datetime_lte with symmetric). */
export interface DateRangeFilterConfig {
  paramGte: string
  paramLte: string
  filtersOn: string
  label: string
}
