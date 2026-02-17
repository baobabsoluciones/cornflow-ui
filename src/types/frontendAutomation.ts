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
