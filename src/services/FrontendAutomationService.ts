import { TableSchema } from '@/config/views'
import {
  ConfigurationData,
  AutomationSectionDef,
} from '@/types/frontendAutomation'
import { TableOperation } from '@/types/table'

// Helper function to convert text to URL-friendly format
export function toUrlFriendly(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/[^a-z0-9\-_]/g, '') // Remove special characters except hyphens and underscores
    .replace(/-{2,}/g, '-') // Replace multiple hyphens with single hyphen (bounded quantifier)
    .replace(/^-|-$/g, '') // Remove leading/trailing single hyphens
}

// Helper function to convert URL-friendly format back to original key
export function fromUrlFriendly(urlText: string, config: TableSchema): string {
  // Try to find the original key by comparing URL-friendly versions
  for (const [key, value] of Object.entries(config)) {
    if (
      toUrlFriendly(key) === urlText ||
      toUrlFriendly(value.title) === urlText
    ) {
      return key
    }
  }
  // If not found, return the urlText as-is (fallback)
  return urlText
}

// Helper function to get groups from configuration
export function getGroupsFromConfig(config: TableSchema): {
  [group: string]: Array<{ key: string; title: string; to: string }>
} {
  const groups: {
    [group: string]: Array<{ key: string; title: string; to: string }>
  } = {}

  Object.entries(config).forEach(([key, value]) => {
    const group = value.group
    const groupKey = group === null ? 'null' : group
    if (!groups[groupKey]) {
      groups[groupKey] = []
    }

    // For null group, each table gets its own route
    // For other groups, tables share a group route with the first table as default
    const route =
      group === null
        ? `/configuration/${toUrlFriendly(key)}`
        : `/configuration/group/${toUrlFriendly(group)}`

    groups[groupKey].push({
      key,
      title: value.title,
      to: route,
    })
  })

  return groups
}

// Helper function to get navigation items from configuration
export function getNavigationItemsFromConfig(
  config: TableSchema,
  basePath: string = '/configuration',
): Array<{
  title: string
  icon: string
  to?: string
  subPages?: Array<{ key: string; title: string; to: string; icon: string }>
}> {
  const groups = getGroupsFromConfig(config)
  const navigationItems: Array<any> = []

  Object.entries(groups).forEach(([groupName, tables]) => {
    if (groupName === 'null') {
      // Each table in null group becomes its own navigation item
      tables.forEach((table) => {
        const tableConfig = config[table.key]
        navigationItems.push({
          title: table.title,
          icon: tableConfig?.icon || 'mdi-table', // Use icon from config or default
          to: table.to.replace('/configuration', basePath),
        })
      })
    } else {
      // Tables with same group become tabs under one navigation item
      // Get the icon from the first table in the group (they should all have the same icon)
      const firstTableKey = tables[0]?.key
      const firstTableConfig = firstTableKey ? config[firstTableKey] : null
      const groupIcon = firstTableConfig?.icon || 'mdi-folder-table'

      const groupItem = {
        title: groupName.charAt(0).toUpperCase() + groupName.slice(1), // Capitalize group name
        icon: groupIcon, // Use icon from first table in group
        to: `${basePath}/group/${toUrlFriendly(groupName)}`,
        subPages: tables.map((table) => {
          const tableConfig = config[table.key]
          return {
            key: table.key,
            title: table.title,
            to: `${basePath}/group/${toUrlFriendly(groupName)}/${toUrlFriendly(table.key)}`,
            icon: tableConfig?.icon || 'mdi-table', // Use icon from config or default
          }
        }),
      }
      navigationItems.push(groupItem)
    }
  })

  return navigationItems
}

export interface MasterDataSectionNav {
  sectionId: string | null
  /** Multilingual title or string; consumer resolves with locale. */
  title: Record<string, string> | string
  icon: string
  subPages: Array<{
    title: string
    icon: string
    to?: string
    subPages?: Array<{ key: string; title: string; to: string; icon: string }>
  }>
}

/**
 * Build master data navigation when schema defines sections (available_automations.sections).
 * Schema sections are returned first (in order); tables with no section go in a final "Master data" block.
 * Use this so schema sections appear above the default Master data section in the drawer.
 *
 * @param config - Master data table configuration (with section on each table)
 * @param sections - Section definitions from the schema (order preserved)
 * @param basePath - Base path for configuration routes (e.g. '/configuration')
 * @returns Array of section blocks: each has title, icon, subPages (groups/tables)
 */
export function getMasterDataNavigationWithSections(
  config: TableSchema,
  sections: AutomationSectionDef[],
  basePath: string = '/configuration',
): MasterDataSectionNav[] {
  if (!sections || sections.length === 0) {
    return []
  }

  const result: MasterDataSectionNav[] = []

  for (const section of sections) {
    const sectionId = section.id
    const filteredConfig: TableSchema = {}
    Object.entries(config).forEach(([key, value]) => {
      if (value.section === sectionId) {
        filteredConfig[key] = value
      }
    })

    if (Object.keys(filteredConfig).length === 0) {
      continue
    }

    const subPages = getNavigationItemsFromConfig(filteredConfig, basePath)
    result.push({
      sectionId,
      title: section.title,
      icon: section.icon ?? 'mdi-folder',
      subPages,
    })
  }

  // Tables with no section go in a final block (handled by caller with default "Master data" title)
  const noSectionConfig: TableSchema = {}
  Object.entries(config).forEach(([key, value]) => {
    const section = value.section
    if (section === undefined || section === null) {
      noSectionConfig[key] = value
    }
  })

  if (Object.keys(noSectionConfig).length > 0) {
    const subPages = getNavigationItemsFromConfig(noSectionConfig, basePath)
    result.push({
      sectionId: null,
      title: 'masterData', // i18n key for "Master data"; consumer resolves
      icon: 'mdi-database',
      subPages,
    })
  }

  return result
}

// Helper function to get operation configuration from table config
export function getOperationConfig(
  tableConfig: any,
  operation: TableOperation,
): any {
  return tableConfig?.[operation] || null
}

// Helper function to validate if operation is supported
export function isOperationSupported(
  tableConfig: any,
  operation: TableOperation,
): boolean {
  return !!tableConfig?.[operation]?.url
}

// Helper function to get all supported operations for a table
export function getSupportedOperations(tableConfig: any): TableOperation[] {
  const operations: TableOperation[] = []

  Object.values(TableOperation).forEach((operation) => {
    if (isOperationSupported(tableConfig, operation)) {
      operations.push(operation)
    }
  })

  return operations
}

// Helper function to determine the section type based on route
export function getSectionType(
  route: string,
): 'configuration' | 'input-data' | 'results' {
  if (route.startsWith('/configuration')) return 'configuration'
  if (route.startsWith('/input-data')) return 'input-data'
  if (route.startsWith('/output-data') || route.startsWith('/results'))
    return 'results'
  return 'configuration' // default
}

/**
 * Check if a validation table has data
 */
export function hasValidationTableData(
  tableKey: string,
  executionData: any,
  isValidationTable: boolean,
): boolean {
  if (!executionData || !isValidationTable) return false

  const dataChecks = executionData.dataChecks
  if (!dataChecks) return false

  const tableData = dataChecks[tableKey]
  return Array.isArray(tableData) && tableData.length > 0
}

/**
 * Filter configuration to only include validation tables with data
 */
export function filterValidationTablesWithData(
  configuration: any,
  executionData: any,
): any {
  if (!configuration || !executionData) return configuration

  const filtered = { ...configuration }

  Object.keys(filtered).forEach((tableKey) => {
    const tableConfig = filtered[tableKey]
    const isValidationTable = isValidationGroup(tableConfig?.group)

    if (isValidationTable) {
      const hasData = hasValidationTableData(tableKey, executionData, true)
      if (!hasData) {
        delete filtered[tableKey]
      }
    }
  })

  return filtered
}

/**
 * Check if a group is a validation group
 */
function isValidationGroup(group: string | null): boolean {
  if (!group) return false
  const validationGroups = [
    'validations',
    'Validations',
    'Validaciones',
    'validaciones',
  ]
  return validationGroups.includes(group)
}

// Helper function to get the appropriate configuration based on section
export function getConfigurationBySection(
  configurations: ConfigurationData,
  section: 'configuration' | 'input-data' | 'results',
): TableSchema {
  switch (section) {
    case 'configuration':
      return configurations.masterData
    case 'input-data':
      return configurations.inputData
    case 'results':
      return configurations.resultsData
    default:
      return configurations.masterData
  }
}

/**
 * Checks if a user has access to a specific table based on the table's schemas property.
 *
 * Access control logic:
 * - If table has no `schemas` property: Visible to ALL users
 * - If table has empty `schemas` array []: Visible to NO users (hidden)
 * - If table has `schemas` with values: Visible only to users with access to ANY of the listed schemas
 *
 * @param tableSchemas - The schemas array from the table configuration (can be undefined)
 * @param userSchemas - The schemas the user has access to (undefined means full access)
 * @returns true if user can see the table, false otherwise
 */
export function canUserAccessTable(
  tableSchemas: string[] | undefined,
  userSchemas: string[] | undefined,
): boolean {
  // If table has no schemas property, it's visible to ALL users
  if (tableSchemas === undefined) {
    return true
  }

  // If table has empty schemas array, it's visible to NO users
  if (tableSchemas.length === 0) {
    return false
  }

  // If user has no schema restrictions (undefined or empty), they have full access
  if (userSchemas === undefined || userSchemas.length === 0) {
    return true
  }

  // Check if user has access to ANY of the table's required schemas
  return tableSchemas.some((schema) => userSchemas.includes(schema))
}

/**
 * Filters a table configuration to only include tables the user has access to.
 *
 * @param config - The table schema configuration to filter
 * @param userSchemas - The schemas the user has access to (undefined means full access)
 * @returns Filtered configuration with only accessible tables
 */
export function filterTablesByUserSchemas(
  config: TableSchema,
  userSchemas: string[] | undefined,
): TableSchema {
  if (!config) return config

  const filtered: TableSchema = {}

  Object.entries(config).forEach(([tableKey, tableConfig]) => {
    if (canUserAccessTable(tableConfig.schemas, userSchemas)) {
      filtered[tableKey] = tableConfig
    }
  })

  return filtered
}

/**
 * Filters all configuration data (masterData, inputData, resultsData) by user schema access.
 *
 * @param configurations - The full configuration data
 * @param userSchemas - The schemas the user has access to (undefined means full access)
 * @returns Filtered configuration data with only accessible tables
 */
export function filterConfigurationsByUserSchemas(
  configurations: ConfigurationData,
  userSchemas: string[] | undefined,
): ConfigurationData {
  if (!configurations) return configurations

  return {
    masterData: filterTablesByUserSchemas(configurations.masterData, userSchemas),
    inputData: filterTablesByUserSchemas(configurations.inputData, userSchemas),
    resultsData: filterTablesByUserSchemas(configurations.resultsData, userSchemas),
  }
}