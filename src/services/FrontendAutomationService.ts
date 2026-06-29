import { TableSchema } from '@/config/views'
import {
  ConfigurationData,
  AutomationSectionDef,
  AutomationGroupDef,
  type DateRangeFilterConfig,
} from '@/types/frontendAutomation'
import { TableOperation } from '@/types/table'
import { formatTitle } from '@/utils/schemaUtils'
import { resolveTitleWithLocale } from '@/utils/i18nUtils'

// Helper function to convert text to URL-friendly format
export function toUrlFriendly(text: string): string {
  return text
    .toLowerCase()
    .replaceAll(/\s+/g, '-') // Replace spaces with hyphens
    .replaceAll(/[^a-z0-9\-_]/g, '') // Remove special characters except hyphens and underscores
    .replaceAll(/-{2,}/g, '-') // Replace multiple hyphens with single hyphen (bounded quantifier)
    .replaceAll(/(?:^-)|(?:-$)/g, '') // Remove leading/trailing single hyphens
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
    // Use raw _groupKey when present so keys match schema group ids (for ordering)
    const groupKey = value._groupKey ?? (group === null ? 'null' : group)
    if (!groups[groupKey]) {
      groups[groupKey] = []
    }

    // For null group, each table gets its own route
    // For other groups, tables share a group route with the first table as default
    const route =
      group === null
        ? `/configuration/${toUrlFriendly(key)}`
        : `/configuration/group/${toUrlFriendly(groupKey)}`

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
  groupOrder?: AutomationGroupDef[],
): Array<{
  title: string
  icon: string
  to?: string
  subPages?: Array<{ key: string; title: string; to: string; icon: string }>
}> {
  const groups = getGroupsFromConfig(config)

  const itemsWithOrder: Array<{ order: number; bucket: number; item: any }> = []

  const navBucketForTableKeys = (tableKeys: string[]): number => {
    if (basePath !== '/results') return 0
    for (const key of tableKeys) {
      const tc = config[key] as { group?: string | null }
      if (tc && isValidationLikeGroup(tc.group)) return 3
    }
    for (const key of tableKeys) {
      const tc = config[key] as { _isFromRawKpis?: boolean }
      if (tc?._isFromRawKpis) return 2
    }
    return 1
  }

  Object.entries(groups).forEach(([groupName, tables]) => {
    if (!tables || tables.length === 0) return

    if (groupName === 'null') {
      tables.forEach((table) => {
        const tableConfig = config[table.key]
        const tableOrder = tableConfig?.order ?? 999
        itemsWithOrder.push({
          order: tableOrder,
          bucket: navBucketForTableKeys([table.key]),
          item: {
            title: table.title,
            icon: tableConfig?.icon || 'mdi-table',
            to: table.to.replace('/configuration', basePath),
          },
        })
      })
    } else {
      const groupOrderValue =
        groupOrder?.find((g) => g.id === groupName)?.order ?? 999

      const sortedTables = [...tables].sort((a, b) => {
        const orderA = config[a.key]?.order ?? 999
        const orderB = config[b.key]?.order ?? 999
        return orderA - orderB
      })

      const firstTableKey = sortedTables[0]?.key
      const firstTableConfig = firstTableKey ? config[firstTableKey] : null
      const groupIcon = firstTableConfig?.icon || 'mdi-folder-table'

      const groupTitle =
        firstTableConfig?.group ??
        groupName.charAt(0).toUpperCase() + groupName.slice(1)
      itemsWithOrder.push({
        order: groupOrderValue,
        bucket: navBucketForTableKeys(sortedTables.map((t) => t.key)),
        item: {
          title: groupTitle,
          icon: groupIcon,
          to: `${basePath}/group/${toUrlFriendly(groupName)}`,
          subPages: sortedTables.map((table) => {
            const tableConfig = config[table.key]
            return {
              key: table.key,
              title: table.title,
              to: `${basePath}/group/${toUrlFriendly(groupName)}/${toUrlFriendly(table.key)}`,
              icon: tableConfig?.icon || 'mdi-table',
            }
          }),
        },
      })
    }
  })

  itemsWithOrder.sort((a, b) => {
    if (basePath === '/results' && a.bucket !== b.bucket) {
      return a.bucket - b.bucket
    }
    return a.order - b.order
  })

  return itemsWithOrder.map((entry) => entry.item)
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

export function normalizeTableKeyForHierarchyMatch(key: string): string {
  return String(key || '')
    .toLowerCase()
    .replaceAll(/[-_]/g, '')
}

/**
 * Builds a table rank map that follows the same hierarchy and ordering principles
 * used by the drawer for master data: Section -> Group -> Table.
 * The resulting rank can be reused to order matched instance tables consistently.
 */
export function getMasterDataTableRankByDrawerHierarchy(
  config: TableSchema,
  sections?: AutomationSectionDef[],
  groupOrder?: AutomationGroupDef[],
): Map<string, number> {
  const rankMap = new Map<string, number>()
  if (!config || Object.keys(config).length === 0) return rankMap

  const groupOrderMap = new Map<string, number>()
  ;(groupOrder || []).forEach((g) => {
    if (typeof g?.order === 'number') {
      groupOrderMap.set(g.id, g.order)
    }
  })

  const sortedSectionIds =
    Array.isArray(sections) && sections.length > 0
      ? [...sections].map((s) => s.id)
      : [null]

  // Same drawer behavior: when schema sections exist, include a final no-section block.
  if (Array.isArray(sections) && sections.length > 0) {
    sortedSectionIds.push(null)
  }

  let nextRank = 0
  sortedSectionIds.forEach((sectionId) => {
    const scopedEntries = Object.entries(config).filter(([, tableCfg]: [string, any]) => {
      const tableSection = tableCfg?.section
      if (sectionId === null) {
        return tableSection === undefined || tableSection === null
      }
      return tableSection === sectionId
    })
    if (scopedEntries.length === 0) return

    const groups: Record<string, Array<[string, any]>> = {}
    const groupFirstSeenIndex = new Map<string, number>()

    scopedEntries.forEach(([tableKey, tableCfg], idx) => {
      const group = tableCfg?.group
      const groupKey =
        tableCfg?._groupKey ?? (group === null ? 'null' : group)
      if (!groups[groupKey]) groups[groupKey] = []
      groups[groupKey].push([tableKey, tableCfg])
      if (!groupFirstSeenIndex.has(groupKey)) groupFirstSeenIndex.set(groupKey, idx)
    })

    const sortedGroupKeys = Object.keys(groups).sort((a, b) => {
      const aOrder = groupOrderMap.get(a) ?? 999
      const bOrder = groupOrderMap.get(b) ?? 999
      if (aOrder !== bOrder) return aOrder - bOrder
      return (groupFirstSeenIndex.get(a) ?? 0) - (groupFirstSeenIndex.get(b) ?? 0)
    })

    sortedGroupKeys.forEach((groupKey) => {
      const sortedTables = [...groups[groupKey]].sort((a, b) => {
        const aOrder = a[1]?.order ?? 999
        const bOrder = b[1]?.order ?? 999
        return aOrder - bOrder
      })
      sortedTables.forEach(([tableKey]) => {
        rankMap.set(normalizeTableKeyForHierarchyMatch(tableKey), nextRank)
        nextRank += 1
      })
    })
  })

  return rankMap
}

/**
 * Order instance table keys by master drawer hierarchy when names match.
 * Matched keys are sorted by master hierarchy rank and unmatched keys keep
 * their original relative order after the matched block.
 */
export function getInstanceTableKeysOrderedByMasterHierarchy(
  instanceTableKeys: string[],
  masterDataConfig: TableSchema,
  sections?: AutomationSectionDef[],
  groupOrder?: AutomationGroupDef[],
): string[] {
  if (!Array.isArray(instanceTableKeys) || instanceTableKeys.length === 0) {
    return []
  }
  if (!masterDataConfig || Object.keys(masterDataConfig).length === 0) {
    return [...instanceTableKeys]
  }

  const rankByKey = getMasterDataTableRankByDrawerHierarchy(
    masterDataConfig,
    sections,
    groupOrder,
  )
  if (rankByKey.size === 0) {
    return [...instanceTableKeys]
  }

  const matched = instanceTableKeys
    .map((key) => ({
      key,
      rank: rankByKey.get(normalizeTableKeyForHierarchyMatch(key)),
    }))
    .filter((entry) => entry.rank !== undefined)
    .sort((a, b) => a.rank - b.rank)
    .map((entry) => entry.key)

  if (matched.length === 0) {
    return [...instanceTableKeys]
  }

  const matchedSet = new Set(matched)
  const unmatched = instanceTableKeys.filter((key) => !matchedSet.has(key))
  return [...matched, ...unmatched]
}

/**
 * Build master data navigation when schema defines sections (available_automations.sections).
 * Schema sections are returned first (in order); tables with no section go in a final "Master data" block.
 * Use this so schema sections appear above the default Master data section in the drawer.
 *
 * @param config - Master data table configuration (with section on each table)
 * @param sections - Section definitions from the schema (already sorted by order)
 * @param basePath - Base path for configuration routes (e.g. '/configuration')
 * @param groupOrder - Optional group definitions with order; groups within each section are sorted by this
 * @returns Array of section blocks: each has title, icon, subPages (groups/tables)
 */
export function getMasterDataNavigationWithSections(
  config: TableSchema,
  sections: AutomationSectionDef[],
  basePath: string = '/configuration',
  groupOrder?: AutomationGroupDef[],
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

    const subPages = getNavigationItemsFromConfig(
      filteredConfig,
      basePath,
      groupOrder,
    )
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
    const subPages = getNavigationItemsFromConfig(
      noSectionConfig,
      basePath,
      groupOrder,
    )
    result.push({
      sectionId: null,
      title: 'masterData', // i18n key for "Master data"; consumer resolves
      icon: 'mdi-database',
      subPages,
    })
  }

  return result
}

type GetListParameterDefault = number | string | boolean

/**
 * Get GET list operation parameters (from path or table config).
 * Only returns parameters with in: "query" (filters, limit, offset, etc.).
 */
export function getGetListQueryParameters(getListConfig: {
  parameters?: Array<{
    name: string
    in?: string
    type?: string
    format?: string
    default?: GetListParameterDefault
    is_filter?: boolean
    filter_info?: unknown
  }>
}): Array<{
  name: string
  in: string
  type?: string
  format?: string
  default?: GetListParameterDefault
  is_filter?: boolean
  filter_info?: unknown
}> {
  const params = getListConfig?.parameters
  if (!Array.isArray(params)) return []
  return params.filter((p) => (p?.in || 'query') === 'query') as Array<{
    name: string
    in: string
    type?: string
    format?: string
    default?: GetListParameterDefault
    is_filter?: boolean
    filter_info?: unknown
  }>
}

/**
 * Query parameter name for global text search when `filter_info.filters_on` is null or empty.
 */
export function getGlobalSearchQueryParameterName(getListConfig: {
  parameters?: Array<{
    name: string
    in?: string
    is_filter?: boolean
    filter_info?: {
      filters_on?: string | null
      filter_type: string
    }
  }>
}): string | null {
  const params = getGetListQueryParameters(getListConfig)
  for (const p of params) {
    if (!p?.is_filter || !p.filter_info) continue
    const fi = p.filter_info as {
      filters_on?: string | null
      filter_type?: string
    }
    const fo = fi.filters_on
    if (fo != null && String(fo).trim() !== '') continue
    const ft = String(fi.filter_type || '').toLowerCase()
    if (
      ft === 'string_contains' ||
      ft === 'string_eq' ||
      ft === 'string' ||
      ft === 'search' ||
      ft === 'any_column_contains'
    ) {
      return p.name
    }
  }
  return null
}

/**
 * When several query params map to the same column, pick the one that matches the UI operator.
 */
export function filterTypeMatchesUiOperator(
  filterType: string,
  operator: string,
  paramRole: 'single' | 'range_gte' | 'range_lte',
): boolean {
  const ft = filterType.toLowerCase()

  // value_is_none is never used by any current UI operator
  if (ft === 'value_is_none') return false

  switch (operator) {
    case 'contains':
      return ft === 'string_contains' || ft === 'string'
    case 'is':
      if (paramRole !== 'single') return false
      return (
        ft === 'string_eq' ||
        ft === 'numeric_eq' ||
        ft === 'boolean' ||
        ft === 'datetime_eq' ||
        ft === 'time_eq' ||
        ft === 'string'
      )
    case 'is_not':
      if (paramRole !== 'single') return false
      return (
        ft === 'string_not_eq' ||
        ft === 'numeric_not_eq' ||
        ft === 'string_ne' ||
        ft === 'numeric_ne' ||
        ft === 'string_neq' ||
        ft === 'numeric_neq' ||
        ft.endsWith('_not_eq')
      )
    case 'is_between':
      if (paramRole === 'range_gte') {
        return (
          ft === 'numeric_gte' || ft === 'datetime_gte' || ft === 'time_gte'
        )
      }
      if (paramRole === 'range_lte') {
        return (
          ft === 'numeric_lte' || ft === 'datetime_lte' || ft === 'time_lte'
        )
      }
      return false
    case 'has_any_value':
      return ft === 'value_is_not_none'
    default:
      return paramRole === 'single'
  }
}

/**
 * Extract date range filter configs for the table toolbar (Desde/Hasta next to search).
 * Only the column whose `filters_on` is `fecha` uses this strip; other datetime ranges
 * (e.g. f_creacion, f_actualizacion) are filtered from the filters panel like other columns.
 */
export function getDateRangeFilterConfigs(getListConfig: {
  parameters?: Array<{
    name: string
    in?: string
    format?: string
    is_filter?: boolean
    filter_info?: {
      filters_on?: string | null
      filter_type: string
      symmetric?: string | null
    }
  }>
}): DateRangeFilterConfig[] {
  const params = getListConfig?.parameters
  if (!Array.isArray(params)) return []

  const byName = new Map(params.map((p) => [p.name, p]))
  const result: DateRangeFilterConfig[] = []
  const seen = new Set<string>()

  for (const p of params) {
    if (!p?.is_filter || !p?.filter_info) continue
    const info = p.filter_info
    if (info.filter_type === 'datetime_gte' && info.symmetric) {
      const lteParam = byName.get(info.symmetric)
      if (
        lteParam?.filter_info?.filter_type === 'datetime_lte' &&
        !seen.has(p.name)
      ) {
        seen.add(p.name)
        seen.add(lteParam.name)
        const filtersOn =
          info.filters_on ?? lteParam.filter_info?.filters_on ?? ''
        const normalized = String(filtersOn).trim().toLowerCase()
        if (normalized !== 'fecha') continue
        result.push({
          paramGte: p.name,
          paramLte: lteParam.name,
          filtersOn,
          label: formatFilterColumnLabel(filtersOn),
        })
      }
    }
  }
  return result
}

/**
 * Build default query params from get_list.parameters (limit, offset, etc.).
 * Only includes parameters that have a default value; used as base for GET list requests.
 */
export function getDefaultListQueryParams(getListConfig: {
  parameters?: Array<{
    name: string
    in?: string
    default?: GetListParameterDefault
  }>
}): Record<string, string | number | boolean> {
  const params = getGetListQueryParameters(getListConfig)
  const out: Record<string, string | number | boolean> = {}
  for (const p of params) {
    if (p.default !== undefined && p.default !== null) {
      out[p.name] = p.default
    }
  }
  return out
}

/**
 * Returns the default limit value from get_list.parameters when present (param name "limit" or filter_type "limit").
 * Used to show a row-limit message in the UI.
 */
export function getDefaultListLimit(getListConfig: {
  parameters?: Array<{
    name: string
    in?: string
    type?: string
    default?: GetListParameterDefault
    is_filter?: boolean
    filter_info?: { filter_type?: string }
  }>
}): number | null {
  const params = getGetListQueryParameters(getListConfig)
  for (const p of params) {
    const isLimitParam =
      p.name === 'limit' ||
      (p.is_filter &&
        (p.filter_info as { filter_type?: string } | undefined)?.filter_type ===
          'limit')
    if (isLimitParam && p.default !== undefined && p.default !== null) {
      const n = typeof p.default === 'number' ? p.default : Number(p.default)
      if (Number.isInteger(n) && n > 0) return n
      return null
    }
  }
  return null
}

/**
 * True when get_list.parameters includes a query param for list limit (name `limit`
 * or filter_type `limit`). Used so the client does not send `limit` unless the API declares it.
 */
export function getListDeclaresLimitParam(getListConfig: {
  parameters?: Array<{
    name: string
    in?: string
    is_filter?: boolean
    filter_info?: { filter_type?: string }
  }>
}): boolean {
  for (const p of getGetListQueryParameters(getListConfig)) {
    if (p.name === 'limit') return true
    if (
      p.is_filter &&
      (p.filter_info as { filter_type?: string } | undefined)?.filter_type ===
        'limit'
    ) {
      return true
    }
  }
  return false
}

/**
 * True when get_list.parameters includes a query param for offset (name `offset`
 * or filter_type `offset`). Used so the client does not send `offset` unless the API declares it.
 */
export function getListDeclaresOffsetParam(getListConfig: {
  parameters?: Array<{
    name: string
    in?: string
    is_filter?: boolean
    filter_info?: { filter_type?: string }
  }>
}): boolean {
  for (const p of getGetListQueryParameters(getListConfig)) {
    if (p.name === 'offset') return true
    if (
      p.is_filter &&
      (p.filter_info as { filter_type?: string } | undefined)?.filter_type ===
        'offset'
    ) {
      return true
    }
  }
  return false
}

function formatFilterColumnLabel(key: string): string {
  if (!key) return ''
  return key
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
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
 * Returns true if the path is a frontend-automation section (configuration).
 * Used to avoid prompting "unsaved changes" when navigating between these sections.
 */
export function isFrontendAutomationRoute(path: string): boolean {
  return path.startsWith('/configuration')
}

/**
 * Execution-backed routes (Input data / Results) where the same execution is edited.
 * When `enableSolutionRecalculation` is on, pending table changes are shared across
 * these sections, so moving between them must not show the route-leave confirmation.
 */
export function isExecutionDataSectionRoute(path: string): boolean {
  if (!path) return false
  return (
    path.startsWith('/input-data') ||
    path.startsWith('/results') ||
    path.startsWith('/output-data')
  )
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
 * Enrich configuration with validation tables from dataChecks that are not
 * already present in the config. Covers the case where the backend provides
 * checks data in the execution but the checks schema was missing / empty,
 * so no table entries were generated during schema transformation.
 */
export function enrichConfigWithChecksData(
  configuration: any,
  executionData: any,
  locale: string = 'en',
): any {
  if (!configuration || !executionData) return configuration

  const dataChecks = executionData.dataChecks
  if (!dataChecks || typeof dataChecks !== 'object') return configuration

  const checksSchema = executionData.schemaChecks as Record<string, any> | null
  const checksProperties = checksSchema?.properties ?? {}

  const VALIDATION_GROUP: Record<string, string> = {
    en: 'Validations',
    es: 'Validaciones',
    fr: 'Validations',
  }
  const resolvedGroup = resolveTitleWithLocale(
    VALIDATION_GROUP,
    locale,
    'Validations',
  )

  let enriched: any = null

  Object.entries(dataChecks).forEach(([checkKey, checkData]: [string, any]) => {
    if (configuration[checkKey]) return
    if (!Array.isArray(checkData) || checkData.length === 0) return

    if (!enriched) enriched = { ...configuration }

    const schemaEntry = checksProperties[checkKey]

    if (schemaEntry?.items?.properties) {
      const properties: any = {}
      Object.entries(schemaEntry.items.properties).forEach(
        ([key, prop]: [string, any]) => {
          properties[key] = {
            title: prop.title || formatTitle(key),
            type: prop.type,
            _originalTitle: prop.title || formatTitle(key),
          }
        },
      )
      enriched[checkKey] = {
        group: resolvedGroup,
        title: schemaEntry.title || formatTitle(checkKey),
        icon: 'mdi-check-circle-outline',
        _originalTitle: schemaEntry.title || formatTitle(checkKey),
        _originalGroup: VALIDATION_GROUP,
        get_list: {
          url: '',
          http_method: 'GET',
          request_schema: null,
          response_schema: {
            type: 'array',
            items: {
              type: 'object',
              properties,
              required: schemaEntry.items.required || [],
            },
          },
        },
      }
    } else {
      enriched[checkKey] = buildValidationConfigFromData(
        checkKey,
        checkData,
        resolvedGroup,
        VALIDATION_GROUP,
      )
    }
  })

  return enriched ?? configuration
}

function buildValidationConfigFromData(
  checkKey: string,
  data: any[],
  resolvedGroup: string,
  originalGroup: Record<string, string>,
): any {
  const firstItem = data[0]

  if (typeof firstItem === 'string') {
    return {
      group: resolvedGroup,
      title: formatTitle(checkKey),
      icon: 'mdi-check-circle-outline',
      _originalTitle: formatTitle(checkKey),
      _originalGroup: originalGroup,
      isPrimitiveArray: true,
      get_list: {
        url: '',
        http_method: 'GET',
        request_schema: null,
        response_schema: {
          type: 'array',
          items: { type: 'string', isPrimitiveArray: true },
        },
      },
    }
  }

  const properties: any = {}
  if (firstItem && typeof firstItem === 'object') {
    Object.entries(firstItem).forEach(([key, value]) => {
      let type = 'string'
      if (typeof value === 'number') {
        type = Number.isInteger(value) ? 'integer' : 'number'
      } else if (typeof value === 'boolean') {
        type = 'boolean'
      }
      properties[key] = {
        type,
        title: formatTitle(key),
        _originalTitle: formatTitle(key),
      }
    })
  }

  return {
    group: resolvedGroup,
    title: formatTitle(checkKey),
    icon: 'mdi-check-circle-outline',
    _originalTitle: formatTitle(checkKey),
    _originalGroup: originalGroup,
    get_list: {
      url: '',
      http_method: 'GET',
      request_schema: null,
      response_schema: {
        type: 'array',
        items: { type: 'object', properties, required: [] },
      },
    },
  }
}

/**
 * Check if a group is a validation group
 */
export function isValidationGroup(group: string | null): boolean {
  if (!group) return false
  const validationGroups = [
    'validations',
    'Validations',
    'Validaciones',
    'validaciones',
  ]
  return validationGroups.includes(group)
}

/** True for validation-style groups (exact names or substring, e.g. localized titles). */
export function isValidationLikeGroup(group: string | null | undefined): boolean {
  if (!group) return false
  if (isValidationGroup(group)) return true
  const g = group.toLowerCase()
  return g.includes('validation') || g.includes('validacion')
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
 * Checks if a table should be shown for the current schema (DAG) the user is viewing.
 *
 * - If table has no `schemas` property: Visible in ALL schemas
 * - If table has empty `schemas` array []: Visible in NO schema (hidden)
 * - If table has `schemas` with values: Visible only when currentSchema is in that list
 *
 * @param tableSchemas - The schemas array from the table configuration (can be undefined)
 * @param currentSchema - The schema (DAG) the user is currently viewing
 * @returns true if table should be shown in the current schema context
 */
export function isTableVisibleInCurrentSchema(
  tableSchemas: string[] | undefined,
  currentSchema: string,
): boolean {
  if (tableSchemas === undefined) {
    return true
  }
  if (tableSchemas.length === 0) {
    return false
  }
  return tableSchemas.includes(currentSchema)
}

/**
 * Filters a table configuration to only include tables that belong to the current schema.
 *
 * @param config - The table schema configuration to filter
 * @param currentSchema - The schema (DAG) the user is currently viewing
 * @returns Filtered configuration with only tables valid for the current schema
 */
export function filterTablesByCurrentSchema(
  config: TableSchema,
  currentSchema: string,
): TableSchema {
  if (!config || !currentSchema) return config ?? {}

  const filtered: TableSchema = {}
  Object.entries(config).forEach(([tableKey, tableConfig]) => {
    if (isTableVisibleInCurrentSchema(tableConfig.schemas, currentSchema)) {
      filtered[tableKey] = tableConfig
    }
  })
  return filtered
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
    masterData: filterTablesByUserSchemas(
      configurations.masterData,
      userSchemas,
    ),
    inputData: filterTablesByUserSchemas(configurations.inputData, userSchemas),
    resultsData: filterTablesByUserSchemas(
      configurations.resultsData,
      userSchemas,
    ),
  }
}
