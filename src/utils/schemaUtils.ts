// Schema transformation utilities for OpenAPI to internal format conversion
import { resolveTitleWithLocale } from './i18nUtils'

// Transform OpenAPI schema to our internal table configuration format
export function transformOpenApiToTableConfig(
  openApiSchema: any,
  locale: string = 'en',
): any {
  const { available_automations, definitions } = openApiSchema
  const result: any = {}

  // Handle new schema structure with tables and groups
  const tables = available_automations.tables || available_automations
  const groups = available_automations.groups || {}

  // Process each table from available_automations.tables
  Object.entries(tables).forEach(([tableKey, tableInfo]: [string, any]) => {
    // Get group information from groups section if it exists
    const groupKey = tableInfo.group
    const groupInfo = groupKey ? groups[groupKey] : null

    // Determine the icon - use table icon first, then group icon, then default
    let icon = tableInfo.icon
    if (!icon && groupInfo?.icon) {
      icon = groupInfo.icon
    }

    result[tableKey] = {
      group: groupInfo
        ? resolveTitleWithLocale(groupInfo.title, locale, tableInfo.group)
        : tableInfo.group,
      title: resolveTitleWithLocale(tableInfo.title, locale, tableInfo.title),
      icon: icon, // Include icon from table or group configuration
      // Schema access control - preserve schemas property for user access filtering
      ...(tableInfo.schemas !== undefined && { schemas: tableInfo.schemas }),
      // Keep original multilingual data for dynamic resolution
      _originalGroup: groupInfo ? groupInfo.title : tableInfo.group,
      _originalTitle: tableInfo.title,
    }

    // Process each operation
    // Define non-operation keys that should be skipped
    const nonOperationKeys = ['group', 'title', 'icon', 'schemas', '_originalGroup', '_originalTitle']
    
    Object.entries(tableInfo).forEach(
      ([operationKey, operationInfo]: [string, any]) => {
        // Skip non-operation keys
        if (nonOperationKeys.includes(operationKey)) return
        
        // Skip if operationInfo is not a valid operation object
        if (!operationInfo || typeof operationInfo !== 'object' || !operationInfo.url) return

        // Convert operation info to our format
        result[tableKey][operationKey] = {
          url: operationInfo.url,
          http_method: operationInfo.http_method,
          request_schema: getRequestSchemaFromDefinitions(
            operationKey,
            definitions,
            tableKey,
            locale,
          ),
          response_schema: getResponseSchemaFromDefinitions(
            operationKey,
            tableKey,
            definitions,
            locale,
          ),
        }
      },
    )
  })

  return result
}

// Get request schema based on operation type and definitions
export function getRequestSchemaFromDefinitions(
  operationKey: string,
  definitions: any,
  tableKey?: string,
  locale: string = 'en',
): any {
  if (
    operationKey === 'get_list' ||
    operationKey === 'get_item' ||
    operationKey === 'delete_item'
  ) {
    return null // These operations don't have request bodies
  }

  // Find the correct definition for this table
  const definitionKey = tableKey
    ? findDefinitionKeyForTable(tableKey, definitions)
    : Object.keys(definitions)[0]

  if (!definitionKey || !definitions[definitionKey]) {
    return null
  }

  const definition = definitions[definitionKey]

  if (operationKey === 'post_bulk') {
    return {
      type: 'array',
      items: convertDefinitionToSchema(definition, locale),
    }
  }

  return convertDefinitionToSchema(definition, locale)
}

// Get response schema based on operation type and definitions
export function getResponseSchemaFromDefinitions(
  operationKey: string,
  tableKey: string,
  definitions: any,
  locale: string = 'en',
): any {
  // Find the correct definition for this table
  const definitionKey = findDefinitionKeyForTable(tableKey, definitions)
  if (!definitionKey || !definitions[definitionKey]) {
    return null
  }

  const definition = definitions[definitionKey]

  if (operationKey === 'get_list') {
    return {
      type: 'array',
      items: convertDefinitionToSchema(definition, locale),
    }
  }

  if (operationKey === 'get_item') {
    return convertDefinitionToSchema(definition, locale)
  }

  // Other operations typically don't return data
  return null
}

// Helper function to convert snake_case or kebab-case to PascalCase
function toPascalCase(str: string): string {
  return str
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('')
}

// Helper function to normalize a string for comparison (remove underscores, hyphens, lowercase)
function normalizeForComparison(str: string): string {
  return str.replace(/[-_]/g, '').toLowerCase()
}

// Helper function to find the correct definition key for a table
function findDefinitionKeyForTable(
  tableKey: string,
  definitions: any,
): string | null {
  const definitionKeys = Object.keys(definitions)
  
  // Filter out BulkDelete definitions - they are not table schemas
  const tableDefinitions = definitionKeys.filter(
    (key) => !key.endsWith('BulkDelete')
  )

  // Try exact match first (case sensitive)
  if (definitions[tableKey] && !tableKey.endsWith('BulkDelete')) return tableKey

  // Try case-insensitive exact match
  const exactMatch = tableDefinitions.find(
    (key) => key.toLowerCase() === tableKey.toLowerCase(),
  )
  if (exactMatch) return exactMatch

  // Try PascalCase conversion (e.g., e_criterios_bondad -> ECriteriosBondad)
  const pascalCaseKey = toPascalCase(tableKey)
  if (definitions[pascalCaseKey] && !pascalCaseKey.endsWith('BulkDelete')) {
    return pascalCaseKey
  }

  // Try normalized comparison (remove underscores/hyphens and compare lowercase)
  // This handles cases like: e_criterios_bondad vs ECriteriosBondad
  const normalizedTableKey = normalizeForComparison(tableKey)
  const normalizedMatch = tableDefinitions.find(
    (key) => normalizeForComparison(key) === normalizedTableKey,
  )
  if (normalizedMatch) return normalizedMatch

  // Try capitalized version (simple first letter capitalization)
  const capitalizedKey = tableKey.charAt(0).toUpperCase() + tableKey.slice(1)
  if (definitions[capitalizedKey] && !capitalizedKey.endsWith('BulkDelete')) {
    return capitalizedKey
  }

  // Try plural forms
  const pluralForms = [
    pascalCaseKey + 's',
    capitalizedKey + 's',
    pascalCaseKey.slice(0, -1), // Remove 's' if ends with 's'
    capitalizedKey.slice(0, -1),
  ]

  for (const form of pluralForms) {
    if (definitions[form] && !form.endsWith('BulkDelete')) return form
  }

  // Do NOT fallback to first available definition - return null if no match found
  // This prevents incorrect schema associations
  console.warn(`[schemaUtils] Could not find definition for table: ${tableKey}`)
  return null
}

// Convert OpenAPI definition to our schema format
export function convertDefinitionToSchema(
  definition: any,
  locale: string = 'en',
): any {
  const properties: any = {}

  Object.entries(definition.properties).forEach(
    ([key, prop]: [string, any]) => {
      // Check if this field has columns_to_join (foreign key field)
      const hasColumnsToJoin =
        prop.columns_to_join && Array.isArray(prop.columns_to_join)

      // Check if this field has join_from (dependent field)
      const hasJoinFrom = prop.join_from && typeof prop.join_from === 'string'

      // Check if this dependent field should be the main selector
      const isMainSelector =
        hasJoinFrom && isMainSelectorField(key, prop, definition.properties)

      properties[key] = {
        title: resolveTitleWithLocale(prop.title, locale, formatTitle(key)),
        type: prop.type,
        ...(prop.readOnly && { readOnly: prop.readOnly }),
        // Choices property for select fields (use choices if available, ignore enum completely)
        ...(prop.choices &&
          Array.isArray(prop.choices) &&
          prop.choices.length > 0 && {
            choices: prop.choices,
          }),
        // Foreign key specific properties
        ...(hasColumnsToJoin && {
          columnsToJoin: prop.columns_to_join,
          isForeignKey: true,
          hidden: true, // Hide foreign key fields from UI
        }),
        // Dependent field specific properties
        ...(hasJoinFrom && {
          joinFrom: prop.join_from,
          isDependentField: true,
          isMainSelector: isMainSelector,
          foreignKeyField: findForeignKeyFieldForDependent(
            key,
            definition.properties,
          ),
        }),
        // Keep original multilingual data
        _originalTitle: prop.title,
      }
    },
  )

  return {
    type: 'object',
    properties,
    required: definition.required || [],
    additionalProperties: false,
    title: resolveTitleWithLocale(definition.title, locale, definition.title),
    description: resolveTitleWithLocale(
      definition.description,
      locale,
      definition.description,
    ),
    // Keep original multilingual data
    _originalTitle: definition.title,
    _originalDescription: definition.description,
  }
}

// Helper function to find the foreign key field for a dependent field
function findForeignKeyFieldForDependent(
  dependentFieldKey: string,
  properties: any,
): string | null {
  // Look for a field that has this dependent field in its columns_to_join array
  for (const [key, prop] of Object.entries(properties)) {
    const propWithColumns = prop as any
    if (
      propWithColumns.columns_to_join &&
      Array.isArray(propWithColumns.columns_to_join)
    ) {
      if (propWithColumns.columns_to_join.includes(dependentFieldKey)) {
        return key
      }
    }
  }
  return null
}

// Helper function to determine if a dependent field should be the main selector
function isMainSelectorField(
  fieldKey: string,
  fieldProp: any,
  properties: any,
): boolean {
  // Find the foreign key field that references this dependent field
  const foreignKeyField = findForeignKeyFieldForDependent(fieldKey, properties)
  if (!foreignKeyField) return false

  const foreignKeyProp = properties[foreignKeyField] as any
  if (
    !foreignKeyProp.columns_to_join ||
    !Array.isArray(foreignKeyProp.columns_to_join)
  ) {
    return false
  }

  const columnsToJoin = foreignKeyProp.columns_to_join

  // If this field is not in columns_to_join, it's not a selector
  if (!columnsToJoin.includes(fieldKey)) return false

  // Find the first non-readOnly field in columns_to_join
  for (const columnKey of columnsToJoin) {
    const columnProp = properties[columnKey]
    if (!columnProp) continue

    // If we find a non-readOnly field, it should be the selector
    if (!columnProp.readOnly) {
      return columnKey === fieldKey
    }
  }

  // If all fields are readOnly, the first one is the selector
  return columnsToJoin[0] === fieldKey
}

// Format property key to readable title
export function formatTitle(key: string): string {
  return key
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * Resolve default group name using i18n translations
 * @param groupKey - The group key ('input-tables' or 'output-tables')
 * @param locale - The current locale
 * @returns Resolved group name
 */
export function resolveDefaultGroupName(
  groupKey: string,
  locale: string = 'en',
): string {
  // This will be resolved by the store using i18n
  if (groupKey === 'input-tables') {
    return `table.groups.inputTables`
  } else if (groupKey === 'output-tables') {
    return `table.groups.outputTables`
  }
  return groupKey
}

/**
 * Resolves table configuration titles dynamically based on current locale
 * @param tableConfig - The table configuration object
 * @param locale - The target locale
 * @returns Updated table configuration with resolved titles
 */
export function resolveTableConfigTitles(
  tableConfig: any,
  locale: string,
): any {
  if (!tableConfig) return tableConfig

  const resolved = { ...tableConfig }

  // Resolve table-level titles
  Object.keys(resolved).forEach((tableKey) => {
    const table = resolved[tableKey]
    if (table) {
      // Resolve table title and group
      if (table._originalTitle) {
        table.title = resolveTitleWithLocale(
          table._originalTitle,
          locale,
          table.title,
        )
      }
      if (table._originalGroup) {
        table.group = resolveTitleWithLocale(
          table._originalGroup,
          locale,
          table.group,
        )
      }

      // Resolve schema titles for operations
      Object.keys(table).forEach((operationKey) => {
        const operation = table[operationKey]
        if (operation && typeof operation === 'object') {
          // Resolve request schema titles
          if (operation.request_schema) {
            resolveSchemaObjectTitles(operation.request_schema, locale)
          }
          // Resolve response schema titles
          if (operation.response_schema) {
            resolveSchemaObjectTitles(operation.response_schema, locale)
          }
        }
      })
    }
  })

  return resolved
}

/**
 * Recursively resolves titles in schema objects
 * @param schema - The schema object to resolve
 * @param locale - The target locale
 */
function resolveSchemaObjectTitles(schema: any, locale: string): void {
  if (!schema || typeof schema !== 'object') return

  // Resolve schema title and description
  if (schema._originalTitle) {
    schema.title = resolveTitleWithLocale(
      schema._originalTitle,
      locale,
      schema.title,
    )
  }
  if (schema._originalDescription) {
    schema.description = resolveTitleWithLocale(
      schema._originalDescription,
      locale,
      schema.description,
    )
  }

  // Resolve properties titles
  if (schema.properties) {
    Object.keys(schema.properties).forEach((propKey) => {
      const prop = schema.properties[propKey]
      if (prop && prop._originalTitle) {
        prop.title = resolveTitleWithLocale(
          prop._originalTitle,
          locale,
          prop.title,
        )
      }
    })
  }

  // Handle array items
  if (schema.items) {
    resolveSchemaObjectTitles(schema.items, locale)
  }
}

/**
 * Gets available locales from a multilingual title object
 * @param multilingualObject - Object that may contain multilingual titles
 * @returns Array of available locale codes
 */
export function getAvailableLocales(multilingualObject: any): string[] {
  const locales = new Set<string>()

  function extractLocales(obj: any) {
    if (isMultilingualTitle(obj)) {
      Object.keys(obj).forEach((key) => locales.add(key))
    } else if (typeof obj === 'object' && obj !== null) {
      Object.values(obj).forEach((value) => extractLocales(value))
    }
  }

  extractLocales(multilingualObject)
  return Array.from(locales).sort((a, b) => a.localeCompare(b))
}

/**
 * Type guard to check if a title is multilingual
 * @param title - The title to check
 * @returns True if title is a multilingual object
 */
function isMultilingualTitle(title: any): title is Record<string, string> {
  return title && typeof title === 'object' && !Array.isArray(title)
}

/**
 * Transform JSON schema (instance/solution) to automation format
 * @param schema - The JSON schema
 * @param checksSchema - The checks schema
 * @param type - The type ('instance' or 'solution')
 * @returns Transformed table configuration in automation format
 */
export function transformJsonSchemaToAutomationFormat(
  schema: any,
  checksSchema: any,
  type: string,
): any {
  if (!schema || !schema.properties) return {}

  const result: any = {}

  // Determine default group based on type
  const getDefaultGroup = (type: string) => {
    if (type === 'instance') {
      return {
        en: 'Input data',
        es: 'Datos de entrada',
        fr: "Tables d'entrée",
      }
    } else if (type === 'solution') {
      return {
        en: 'Solution data',
        es: 'Datos de la solución',
        fr: 'Données de la solution',
      }
    }
    return null
  }

  const defaultGroup = getDefaultGroup(type)

  // Process main data tables
  Object.entries(schema.properties).forEach(
    ([tableKey, tableSchema]: [string, any]) => {
      if (tableSchema.type === 'array' && tableSchema.items) {
        result[tableKey] = {
          group: defaultGroup
            ? type === 'instance'
              ? 'input-tables'
              : 'output-tables'
            : null,
          title: formatTitle(tableKey),
          icon: 'mdi-table',
          _originalTitle: formatTitle(tableKey),
          _originalGroup: defaultGroup,
          // Since these are read-only data, we only provide get operations
          get_list: {
            url: '', // No actual URL since this is read-only data
            http_method: 'GET',
            request_schema: null,
            response_schema: {
              type: 'array',
              items: convertJsonSchemaItemToSchema(tableSchema.items),
            },
          },
        }
      }
    },
  )

  // Process checks tables if they exist
  if (checksSchema && checksSchema.properties) {
    Object.entries(checksSchema.properties).forEach(
      ([checkKey, checkSchema]: [string, any]) => {
        if (checkSchema.type === 'array' && checkSchema.items) {
          const itemSchema = convertJsonSchemaItemToSchema(checkSchema.items)

          result[checkKey] = {
            group: 'validations', // All checks go to validations group
            title: checkSchema.title || formatTitle(checkKey),
            icon: 'mdi-check-circle-outline',
            _originalTitle: checkSchema.title || formatTitle(checkKey),
            _originalGroup: {
              en: 'Validations',
              es: 'Validaciones',
              fr: 'Validations',
            },
            // Add primitive array flag to table config
            isPrimitiveArray: itemSchema.isPrimitiveArray || false,
            get_list: {
              url: '',
              http_method: 'GET',
              request_schema: null,
              response_schema: {
                type: 'array',
                items: itemSchema,
              },
            },
          }
        }
      },
    )
  }

  return result
}

/**
 * Parse join_from string to extract table and field information
 * @param joinFrom - String in format "table.field"
 * @returns Object with table and field names
 */
export function parseJoinFrom(
  joinFrom: string,
): { table: string; field: string } | null {
  if (!joinFrom || typeof joinFrom !== 'string') return null

  const parts = joinFrom.split('.')
  if (parts.length !== 2) return null

  return {
    table: parts[0],
    field: parts[1],
  }
}

/**
 * Get foreign key field name from a dependent field configuration
 * @param dependentFieldKey - The dependent field key
 * @param schema - The schema properties
 * @returns Foreign key field name or null
 */
export function getForeignKeyFieldName(
  dependentFieldKey: string,
  schema: any,
): string | null {
  if (!schema || !schema.properties) return null

  for (const [key, prop] of Object.entries(schema.properties)) {
    const propWithColumns = prop as any
    if (
      propWithColumns.columnsToJoin &&
      Array.isArray(propWithColumns.columnsToJoin)
    ) {
      if (propWithColumns.columnsToJoin.includes(dependentFieldKey)) {
        return key
      }
    }
  }
  return null
}

/**
 * Get all dependent fields for a foreign key field
 * @param foreignKeyField - The foreign key field name
 * @param schema - The schema properties
 * @returns Array of dependent field names
 */
export function getDependentFields(
  foreignKeyField: string,
  schema: any,
): string[] {
  if (!schema || !schema.properties) return []

  const foreignKeyProp = schema.properties[foreignKeyField] as any
  if (!foreignKeyProp || !foreignKeyProp.columnsToJoin) return []

  return foreignKeyProp.columnsToJoin || []
}

/**
 * Convert JSON schema item definition to our schema format
 * @param itemSchema - The JSON schema item definition
 * @returns Converted schema
 */
function convertJsonSchemaItemToSchema(itemSchema: any): any {
  if (!itemSchema || !itemSchema.properties) {
    // Check if it's a primitive type (like { type: "string" })
    if (
      itemSchema &&
      (itemSchema.type === 'string' ||
        itemSchema.type === 'number' ||
        itemSchema.type === 'integer')
    ) {
      return {
        type: itemSchema.type,
        isPrimitiveArray: true, // Mark as primitive array
        title: itemSchema.title || 'Item',
        _originalTitle: itemSchema.title || 'Item',
      }
    }

    return {
      type: 'object',
      properties: {},
      required: [],
    }
  }

  const properties: any = {}

  Object.entries(itemSchema.properties).forEach(
    ([key, prop]: [string, any]) => {
      properties[key] = {
        title: prop.title || formatTitle(key),
        type: prop.type,
        ...(prop.readOnly && { readOnly: prop.readOnly }),
        ...(prop.description && { description: prop.description }),
        ...(prop.minimum !== undefined && { minimum: prop.minimum }),
        ...(prop.maximum !== undefined && { maximum: prop.maximum }),
        // Choices property for select fields (use choices if available, ignore enum completely)
        ...(prop.choices &&
          Array.isArray(prop.choices) &&
          prop.choices.length > 0 && {
            choices: prop.choices,
          }),
        _originalTitle: prop.title || formatTitle(key),
      }
    },
  )

  return {
    type: 'object',
    properties,
    required: itemSchema.required || [],
    additionalProperties:
      itemSchema.additionalProperties !== undefined
        ? itemSchema.additionalProperties
        : false,
    title: itemSchema.title || 'Item',
    _originalTitle: itemSchema.title || 'Item',
  }
}
