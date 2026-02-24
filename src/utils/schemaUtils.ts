// Schema transformation utilities for OpenAPI to internal format conversion
import { resolveTitleWithLocale } from './i18nUtils'

/** Result of transforming OpenAPI automation schema: table config and optional sections. */
export interface TransformOpenApiResult {
  config: any
  sections: Array<{ id: string; title: Record<string, string> | string; icon?: string }>
}

// ─── Shared helpers ──────────────────────────────────────────────────────────

const FORMAT_TO_TYPE: Record<string, string> = {
  'date': 'date',
  'date-time': 'datetime',
  'time': 'time',
}

function hasValidChoices(prop: any): boolean {
  return Array.isArray(prop?.choices) && prop.choices.length > 0
}

/**
 * Generic lookup: find the field whose `columnsProp` array includes `fieldKey`.
 * Works with both raw OpenAPI props (`columns_to_join`) and converted props (`columnsToJoin`).
 */
function findFieldWithColumnsRef(
  fieldKey: string,
  properties: Record<string, any>,
  columnsProp: 'columns_to_join' | 'columnsToJoin',
): string | null {
  for (const [key, prop] of Object.entries(properties)) {
    const columns = (prop as any)?.[columnsProp]
    if (Array.isArray(columns) && columns.includes(fieldKey)) return key
  }
  return null
}

// ─── Main transform ──────────────────────────────────────────────────────────

// Transform OpenAPI schema to our internal table configuration format
export function transformOpenApiToTableConfig(
  openApiSchema: any,
  locale: string = 'en',
): TransformOpenApiResult {
  const { available_automations, definitions } = openApiSchema
  const result: any = {}

  const tables = available_automations.tables || available_automations
  const groups = available_automations.groups || {}
  const sectionsSource = available_automations.sections || {}

  const sections: Array<{ id: string; title: Record<string, string> | string; icon?: string }> =
    Object.entries(sectionsSource).map(([id, sectionInfo]: [string, any]) => ({
      id,
      title: sectionInfo?.title ?? id,
      icon: sectionInfo?.icon,
    }))

  Object.entries(tables).forEach(([tableKey, tableInfo]: [string, any]) => {
    const groupKey = tableInfo.group
    const groupInfo = groupKey ? groups[groupKey] : null

    const sectionId =
      tableInfo.section !== undefined && tableInfo.section !== null
        ? tableInfo.section
        : groupInfo?.section ?? null

    const icon = tableInfo.icon || groupInfo?.icon

    result[tableKey] = {
      group: groupInfo
        ? resolveTitleWithLocale(groupInfo.title, locale, tableInfo.group)
        : tableInfo.group,
      title: resolveTitleWithLocale(tableInfo.title, locale, tableInfo.title),
      icon,
      ...(sectionId !== null && { section: sectionId }),
      ...(tableInfo.schemas !== undefined && { schemas: tableInfo.schemas }),
      _originalGroup: groupInfo ? groupInfo.title : tableInfo.group,
      _originalTitle: tableInfo.title,
      ...(sectionId !== null && {
        _originalSection: sectionsSource[sectionId]?.title ?? sectionId,
      }),
    }

    const nonOperationKeys = [
      'group', 'title', 'icon', 'section', 'schemas',
      '_originalGroup', '_originalTitle', '_originalSection',
    ]

    Object.entries(tableInfo).forEach(
      ([operationKey, operationInfo]: [string, any]) => {
        if (nonOperationKeys.includes(operationKey)) return
        if (!operationInfo || typeof operationInfo !== 'object' || !operationInfo.url) return

        result[tableKey][operationKey] = {
          url: operationInfo.url,
          http_method: operationInfo.http_method,
          request_schema: getRequestSchemaFromDefinitions(
            operationKey, definitions, tableKey, locale,
          ),
          response_schema: getResponseSchemaFromDefinitions(
            operationKey, tableKey, definitions, locale,
          ),
        }
      },
    )
  })

  return { config: result, sections }
}

// ─── Schema from definitions ─────────────────────────────────────────────────

export function getRequestSchemaFromDefinitions(
  operationKey: string,
  definitions: any,
  tableKey?: string,
  locale: string = 'en',
): any {
  const readOnlyOps = ['get_list', 'get_item', 'delete_item']
  if (readOnlyOps.includes(operationKey)) return null

  const definitionKey = tableKey
    ? findDefinitionKeyForTable(tableKey, definitions)
    : Object.keys(definitions)[0]

  if (!definitionKey || !definitions[definitionKey]) return null

  const schema = convertDefinitionToSchema(definitions[definitionKey], locale)
  return operationKey === 'post_bulk' ? { type: 'array', items: schema } : schema
}

export function getResponseSchemaFromDefinitions(
  operationKey: string,
  tableKey: string,
  definitions: any,
  locale: string = 'en',
): any {
  const definitionKey = findDefinitionKeyForTable(tableKey, definitions)
  if (!definitionKey || !definitions[definitionKey]) return null

  const schema = convertDefinitionToSchema(definitions[definitionKey], locale)

  if (operationKey === 'get_list') return { type: 'array', items: schema }
  if (operationKey === 'get_item') return schema
  return null
}

// ─── Definition key resolution ───────────────────────────────────────────────

function toPascalCase(str: string): string {
  return str
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('')
}

function normalizeForComparison(str: string): string {
  return str.replace(/[-_]/g, '').toLowerCase()
}

function findDefinitionKeyForTable(
  tableKey: string,
  definitions: any,
): string | null {
  const tableDefinitions = Object.keys(definitions).filter(
    (key) => !key.endsWith('BulkDelete'),
  )

  const tryMatch = (candidate: string): string | null =>
    candidate && definitions[candidate] && !candidate.endsWith('BulkDelete')
      ? candidate
      : null

  // Exact match
  const exact = tryMatch(tableKey)
  if (exact) return exact

  // Case-insensitive exact match
  const ciMatch = tableDefinitions.find(
    (key) => key.toLowerCase() === tableKey.toLowerCase(),
  )
  if (ciMatch) return ciMatch

  // PascalCase conversion
  const pascalKey = toPascalCase(tableKey)
  const pascal = tryMatch(pascalKey)
  if (pascal) return pascal

  // Normalized comparison (remove separators, lowercase)
  const normalizedTableKey = normalizeForComparison(tableKey)
  const normalizedMatch = tableDefinitions.find(
    (key) => normalizeForComparison(key) === normalizedTableKey,
  )
  if (normalizedMatch) return normalizedMatch

  // Simple capitalization
  const capitalizedKey = tableKey.charAt(0).toUpperCase() + tableKey.slice(1)
  const capitalized = tryMatch(capitalizedKey)
  if (capitalized) return capitalized

  // Plural forms
  const pluralForms = [
    pascalKey + 's',
    capitalizedKey + 's',
    pascalKey.slice(0, -1),
    capitalizedKey.slice(0, -1),
  ]
  for (const form of pluralForms) {
    const match = tryMatch(form)
    if (match) return match
  }

  console.warn(`[schemaUtils] Could not find definition for table: ${tableKey}`)
  return null
}

// ─── Definition → schema conversion ─────────────────────────────────────────

function resolveFieldType(prop: any): { type: string; format?: string } {
  if (prop.type === 'string' && prop.format && FORMAT_TO_TYPE[prop.format]) {
    return { type: FORMAT_TO_TYPE[prop.format], format: prop.format }
  }
  return { type: prop.type }
}

export function convertDefinitionToSchema(
  definition: any,
  locale: string = 'en',
): any {
  const requiredSet = new Set(
    Array.isArray(definition.required) ? definition.required : [],
  )
  const properties: any = {}

  Object.entries(definition.properties).forEach(
    ([key, prop]: [string, any]) => {
      const hasColumnsToJoin =
        prop.columns_to_join && Array.isArray(prop.columns_to_join)
      const hasJoinFrom = prop.join_from && typeof prop.join_from === 'string'
      const isMainSelector =
        hasJoinFrom && isMainSelectorField(key, prop, definition.properties)

      const { type, format } = resolveFieldType(prop)

      properties[key] = {
        title: resolveTitleWithLocale(prop.title, locale, formatTitle(key)),
        type,
        ...(format && { format }),
        ...(prop.readOnly && { readOnly: prop.readOnly }),
        required: requiredSet.has(key),
        ...(hasValidChoices(prop) && { choices: prop.choices }),
        ...(hasColumnsToJoin && {
          columnsToJoin: prop.columns_to_join,
          isForeignKey: true,
          hidden: true,
        }),
        ...(hasJoinFrom && {
          joinFrom: prop.join_from,
          isDependentField: true,
          isMainSelector,
          foreignKeyField: findForeignKeyFieldForDependent(
            key, definition.properties,
          ),
        }),
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
      definition.description, locale, definition.description,
    ),
    _originalTitle: definition.title,
    _originalDescription: definition.description,
  }
}

// ─── Foreign key / dependent field helpers ────────────────────────────────────

/**
 * Find the FK field that includes `dependentFieldKey` in its `columns_to_join`
 * (raw OpenAPI format, used during schema conversion).
 */
function findForeignKeyFieldForDependent(
  dependentFieldKey: string,
  properties: any,
): string | null {
  return findFieldWithColumnsRef(dependentFieldKey, properties, 'columns_to_join')
}

function isMainSelectorField(
  fieldKey: string,
  _fieldProp: any,
  properties: any,
): boolean {
  const foreignKeyField = findForeignKeyFieldForDependent(fieldKey, properties)
  if (!foreignKeyField) return false

  const foreignKeyProp = properties[foreignKeyField] as any
  const columnsToJoin = foreignKeyProp?.columns_to_join
  if (!Array.isArray(columnsToJoin) || !columnsToJoin.includes(fieldKey)) {
    return false
  }

  for (const columnKey of columnsToJoin) {
    const columnProp = properties[columnKey]
    if (!columnProp) continue
    if (!columnProp.readOnly) return columnKey === fieldKey
  }

  return columnsToJoin[0] === fieldKey
}

// ─── Public FK helpers (converted camelCase schema) ──────────────────────────

export function getForeignKeyFieldName(
  dependentFieldKey: string,
  schema: any,
): string | null {
  if (!schema?.properties) return null
  return findFieldWithColumnsRef(dependentFieldKey, schema.properties, 'columnsToJoin')
}

export function getDependentFields(
  foreignKeyField: string,
  schema: any,
): string[] {
  if (!schema?.properties) return []
  return (schema.properties[foreignKeyField] as any)?.columnsToJoin || []
}

// ─── Formatting helpers ──────────────────────────────────────────────────────

export function formatTitle(key: string): string {
  return key
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export function resolveDefaultGroupName(
  groupKey: string,
  _locale: string = 'en',
): string {
  if (groupKey === 'input-tables') return 'table.groups.inputTables'
  if (groupKey === 'output-tables') return 'table.groups.outputTables'
  return groupKey
}

// ─── Parse join_from ─────────────────────────────────────────────────────────

export function parseJoinFrom(
  joinFrom: string,
): { table: string; field: string } | null {
  if (!joinFrom || typeof joinFrom !== 'string') return null
  const parts = joinFrom.split('.')
  if (parts.length !== 2) return null
  return { table: parts[0], field: parts[1] }
}

// ─── Locale resolution for table config ──────────────────────────────────────

export function resolveTableConfigTitles(
  tableConfig: any,
  locale: string,
): any {
  if (!tableConfig) return tableConfig

  const resolved = { ...tableConfig }

  Object.keys(resolved).forEach((tableKey) => {
    const table = resolved[tableKey]
    if (!table) return

    if (table._originalTitle) {
      table.title = resolveTitleWithLocale(table._originalTitle, locale, table.title)
    }
    if (table._originalGroup) {
      table.group = resolveTitleWithLocale(table._originalGroup, locale, table.group)
    }

    Object.keys(table).forEach((operationKey) => {
      const operation = table[operationKey]
      if (operation && typeof operation === 'object') {
        if (operation.request_schema) resolveSchemaObjectTitles(operation.request_schema, locale)
        if (operation.response_schema) resolveSchemaObjectTitles(operation.response_schema, locale)
      }
    })
  })

  return resolved
}

function resolveSchemaObjectTitles(schema: any, locale: string): void {
  if (!schema || typeof schema !== 'object') return

  if (schema._originalTitle) {
    schema.title = resolveTitleWithLocale(schema._originalTitle, locale, schema.title)
  }
  if (schema._originalDescription) {
    schema.description = resolveTitleWithLocale(schema._originalDescription, locale, schema.description)
  }

  if (schema.properties) {
    Object.values(schema.properties).forEach((prop: any) => {
      if (prop?._originalTitle) {
        prop.title = resolveTitleWithLocale(prop._originalTitle, locale, prop.title)
      }
    })
  }

  if (schema.items) resolveSchemaObjectTitles(schema.items, locale)
}

// ─── Multilingual helpers ────────────────────────────────────────────────────

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

function isMultilingualTitle(title: any): title is Record<string, string> {
  return title && typeof title === 'object' && !Array.isArray(title)
}

// ─── JSON schema → automation format ─────────────────────────────────────────

const DEFAULT_GROUPS: Record<string, Record<string, string>> = {
  instance: { en: 'Input data', es: 'Datos de entrada', fr: "Tables d'entrée" },
  solution: { en: 'Solution data', es: 'Datos de la solución', fr: 'Données de la solution' },
}

const TYPE_TO_GROUP_KEY: Record<string, string> = {
  instance: 'input-tables',
  solution: 'output-tables',
}

export function transformJsonSchemaToAutomationFormat(
  schema: any,
  checksSchema: any,
  type: string,
): any {
  if (!schema?.properties) return {}

  const result: any = {}
  const defaultGroup = DEFAULT_GROUPS[type] ?? null

  Object.entries(schema.properties).forEach(
    ([tableKey, tableSchema]: [string, any]) => {
      if (tableSchema.type !== 'array' || !tableSchema.items) return

      result[tableKey] = {
        group: defaultGroup ? TYPE_TO_GROUP_KEY[type] || null : null,
        title: formatTitle(tableKey),
        icon: 'mdi-table',
        _originalTitle: formatTitle(tableKey),
        _originalGroup: defaultGroup,
        get_list: {
          url: '',
          http_method: 'GET',
          request_schema: null,
          response_schema: {
            type: 'array',
            items: convertJsonSchemaItemToSchema(tableSchema.items),
          },
        },
      }
    },
  )

  if (checksSchema?.properties) {
    Object.entries(checksSchema.properties).forEach(
      ([checkKey, checkSchema]: [string, any]) => {
        if (checkSchema.type !== 'array' || !checkSchema.items) return

        const itemSchema = convertJsonSchemaItemToSchema(checkSchema.items)

        result[checkKey] = {
          group: 'validations',
          title: checkSchema.title || formatTitle(checkKey),
          icon: 'mdi-check-circle-outline',
          _originalTitle: checkSchema.title || formatTitle(checkKey),
          _originalGroup: { en: 'Validations', es: 'Validaciones', fr: 'Validations' },
          isPrimitiveArray: itemSchema.isPrimitiveArray || false,
          get_list: {
            url: '',
            http_method: 'GET',
            request_schema: null,
            response_schema: { type: 'array', items: itemSchema },
          },
        }
      },
    )
  }

  return result
}

// ─── JSON schema item conversion ─────────────────────────────────────────────

const PRIMITIVE_TYPES = ['string', 'number', 'integer']

function convertJsonSchemaItemToSchema(itemSchema: any): any {
  if (!itemSchema?.properties) {
    if (itemSchema && PRIMITIVE_TYPES.includes(itemSchema.type)) {
      return {
        type: itemSchema.type,
        isPrimitiveArray: true,
        title: itemSchema.title || 'Item',
        _originalTitle: itemSchema.title || 'Item',
      }
    }
    return { type: 'object', properties: {}, required: [] }
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
        ...(hasValidChoices(prop) && { choices: prop.choices }),
        _originalTitle: prop.title || formatTitle(key),
      }
    },
  )

  return {
    type: 'object',
    properties,
    required: itemSchema.required || [],
    additionalProperties: itemSchema.additionalProperties ?? false,
    title: itemSchema.title || 'Item',
    _originalTitle: itemSchema.title || 'Item',
  }
}

// ─── Display value → FK ID resolution ────────────────────────────────────────

export async function resolveDisplayValuesToFkIds(
  payload: Record<string, any>,
  tableConfig: any,
  loadTableData: (tableName: string) => Promise<any[]>,
): Promise<Record<string, any>> {
  const properties = tableConfig?.get_list?.response_schema?.items?.properties
  if (!properties) return { ...payload }

  const result = { ...payload }

  for (const [fieldKey, prop] of Object.entries(properties)) {
    const p = prop as any
    if (!p?.joinFrom || !p?.isDependentField) continue

    const displayValue = result[fieldKey]
    if (displayValue === undefined || displayValue === null || displayValue === '') continue

    const foreignKeyField = getForeignKeyFieldName(fieldKey, { properties })
    const joinInfo = foreignKeyField ? parseJoinFrom(p.joinFrom) : null

    if (!foreignKeyField || !joinInfo) {
      delete result[fieldKey]
      continue
    }

    try {
      const tableRows = await loadTableData(joinInfo.table)
      const matchingItem = tableRows.find((item: any) => {
        const refVal = item[joinInfo.field]
        if (refVal === displayValue) return true
        return (
          typeof refVal === 'string' &&
          typeof displayValue === 'string' &&
          refVal.trim().toLowerCase() === displayValue.trim().toLowerCase()
        )
      })
      if (matchingItem != null) {
        result[foreignKeyField] =
          matchingItem[foreignKeyField] ?? matchingItem.id
      }
    } catch (e) {
      console.error(`Resolve display value for ${fieldKey}:`, e)
    }
    delete result[fieldKey]
  }
  return result
}

// ─── Execution config from schema config ─────────────────────────────────────

const SCHEMA_TYPE_TO_FIELD_TYPE: Record<string, string> = {
  boolean: 'boolean',
  number: 'number',
  integer: 'number',
  string: 'text',
}

const DEFAULT_FIELD_ICONS: Record<string, string> = {
  boolean: 'mdi-toggle-switch',
  number: 'mdi-numeric',
  text: 'mdi-form-textbox',
  select: 'mdi-format-list-checks',
}

const CONFIG_FIELDS_EXCLUDED_KEYS = ['solver', 'msg']

export function getExecutionConfigFromSchemaConfig(schemaConfig: any): {
  solverConfig: { showSolverStep: boolean; defaultSolver: string }
  executionSolvers: string[]
  configFields: Array<{
    key: string
    title: string
    placeholder?: string
    suffix?: string
    icon?: string
    type: string
    default?: unknown
    options?: Array<{ value: string; label: string }>
  }>
} | null {
  if (!schemaConfig || typeof schemaConfig !== 'object' || !schemaConfig.properties) {
    return null
  }

  const props = schemaConfig.properties
  let defaultSolver = 'MIPModel.gurobi'
  let executionSolvers: string[] = ['MIPModel.gurobi']

  if (props.solver) {
    const solverProp = props.solver
    if (Array.isArray(solverProp.enum) && solverProp.enum.length > 0) {
      executionSolvers = solverProp.enum.map((v: string) => String(v))
      defaultSolver = solverProp.default != null
        ? String(solverProp.default)
        : executionSolvers[0]
    }
  }

  const configFields: Array<{
    key: string
    title: string
    placeholder?: string
    suffix?: string
    icon?: string
    type: string
    default?: unknown
    options?: Array<{ value: string; label: string }>
  }> = []

  for (const [key, prop] of Object.entries(props) as [string, any][]) {
    if (!prop || typeof prop !== 'object') continue
    if (CONFIG_FIELDS_EXCLUDED_KEYS.includes(key)) continue

    const schemaType = Array.isArray(prop.type) ? prop.type[0] : prop.type
    const fieldType = SCHEMA_TYPE_TO_FIELD_TYPE[schemaType] || 'text'

    const titleKey = `configParams.${key}`
    const field: {
      key: string
      title: string
      placeholder?: string
      suffix?: string
      icon?: string
      type: string
      default?: unknown
      options?: Array<{ value: string; label: string }>
    } = {
      key,
      title: titleKey,
      placeholder: `${titleKey}Placeholder`,
      icon: DEFAULT_FIELD_ICONS[fieldType] || 'mdi-tune',
      type: fieldType,
    }

    if (prop.default !== undefined) field.default = prop.default

    if (Array.isArray(prop.enum) && prop.enum.length > 0) {
      field.type = 'select'
      field.options = prop.enum.map((v: string) => ({
        value: String(v),
        label: String(v),
      }))
      field.icon = DEFAULT_FIELD_ICONS.select
    }

    if (fieldType === 'number' && key.toLowerCase().includes('time')) {
      field.suffix = key.toLowerCase() === 'timelimit'
        ? 'configParams.secondsSuffix'
        : 'configParams.minutesSuffix'
      field.icon = 'mdi-timer-sand'
    }

    configFields.push(field)
  }

  return {
    solverConfig: { showSolverStep: false, defaultSolver },
    executionSolvers,
    configFields,
  }
}
