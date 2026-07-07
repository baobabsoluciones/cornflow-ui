/**
 * openApiTransform.ts — OpenAPI → table config transform (frontend-automation).
 *
 * Used only by the frontend-automation feature (via `FaRepository`): it takes the OpenAPI
 * schema from the `/frontend-automation/` endpoint and converts it to the internal
 * tables/sections/groups format. Kept in this module (not in `utils/schemaUtils`) so the
 * core's generic schema utilities don't carry feature-specific logic.
 *
 * Reuses generic helpers that stay in the core (`@cornflow-ui/core/utils/schemaUtils`):
 * `formatTitle`, `hasValidChoices`, `findFieldWithColumnsRef` (shared with the core's
 * master-data comparison/diff logic) and `resolveTitleWithLocale` (`@cornflow-ui/core/utils/i18nUtils`).
 */
import { resolveTitleWithLocale } from '@cornflow-ui/core/utils/i18nUtils'
import {
  formatTitle,
  hasValidChoices,
  findFieldWithColumnsRef,
} from '@cornflow-ui/core/utils/schemaUtils'

/** Result of transforming OpenAPI automation schema: table config, sections and groups. */
export interface TransformOpenApiResult {
  config: any
  sections: Array<{
    id: string
    title: Record<string, string> | string
    icon?: string
    order?: number
  }>
  groups: Array<{
    id: string
    title?: Record<string, string> | string
    icon?: string
    order?: number
  }>
}

const FORMAT_TO_TYPE: Record<string, string> = {
  date: 'date',
  'date-time': 'datetime',
  time: 'time',
}

// ─── Main transform ──────────────────────────────────────────────────────────

/** Normalize path for matching (ensure single trailing slash). */
function normalizePathKey(url: string): string {
  const s = (url || '').trim()
  if (!s) return ''
  return s.endsWith('/') ? s : s + '/'
}

/**
 * Get GET method parameters from paths for a given URL (e.g. get_list, or Excel download).
 * Paths keys may be "/e-planificaciones-atenea/"; url may be "/e-planificaciones-atenea/".
 */
function getGetParametersFromPath(
  paths: Record<string, any>,
  url: string,
): any[] | undefined {
  if (!paths || typeof url !== 'string') return undefined
  const normalized = normalizePathKey(url)
  const pathEntry =
    paths[url] ??
    paths[normalized] ??
    paths[url.replace(/\/$/, '')] ??
    paths[url + '/'] ??
    paths[
      Object.keys(paths).find((k) => normalizePathKey(k) === normalized) ?? ''
    ]
  const getParams = pathEntry?.get?.parameters
  return Array.isArray(getParams) ? getParams : undefined
}

const NON_OPERATION_KEYS = new Set([
  'group',
  'title',
  'icon',
  'section',
  'schemas',
  'model_table_name',
  '_groupKey',
  '_originalGroup',
  '_originalTitle',
  '_originalSection',
])

// Transform OpenAPI schema to our internal table configuration format
export function transformOpenApiToTableConfig(
  openApiSchema: any,
  locale: string = 'en',
): TransformOpenApiResult {
  const { available_automations, definitions, paths } = openApiSchema
  const result: any = {}

  const tables = available_automations.tables || available_automations
  const groupsSource = available_automations.groups || {}
  const sectionsSource = available_automations.sections || {}

  const sections: Array<{
    id: string
    title: Record<string, string> | string
    icon?: string
    order?: number
  }> = Object.entries(sectionsSource)
    .map(([id, sectionInfo]: [string, any]) => ({
      id,
      title: sectionInfo?.title ?? id,
      icon: sectionInfo?.icon,
      order:
        typeof sectionInfo?.order === 'number' ? sectionInfo.order : undefined,
    }))
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999))

  const groups: Array<{
    id: string
    title?: Record<string, string> | string
    icon?: string
    order?: number
  }> = Object.entries(groupsSource)
    .map(([id, groupInfo]: [string, any]) => ({
      id,
      title: groupInfo?.title,
      icon: groupInfo?.icon,
      order: typeof groupInfo?.order === 'number' ? groupInfo.order : undefined,
    }))
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999))

  Object.entries(tables).forEach(([tableKey, tableInfo]: [string, any]) => {
    const groupKey = tableInfo.group
    const groupInfo = groupKey ? groupsSource[groupKey] : null

    const sectionId = tableInfo.section ?? groupInfo?.section ?? null

    const icon = tableInfo.icon || groupInfo?.icon

    result[tableKey] = {
      group: groupInfo
        ? resolveTitleWithLocale(groupInfo.title, locale, tableInfo.group)
        : tableInfo.group,
      title: resolveTitleWithLocale(tableInfo.title, locale, tableInfo.title),
      icon,
      ...(typeof tableInfo.order === 'number' && { order: tableInfo.order }),
      ...(sectionId !== null && { section: sectionId }),
      ...(tableInfo.schemas !== undefined && { schemas: tableInfo.schemas }),
      ...(tableInfo.model_table_name != null &&
        String(tableInfo.model_table_name).trim() !== '' && {
          model_table_name: tableInfo.model_table_name,
        }),
      ...(groupKey && { _groupKey: groupKey }),
      _originalGroup: groupInfo ? groupInfo.title : tableInfo.group,
      _originalTitle: tableInfo.title,
      ...(sectionId !== null && {
        _originalSection: sectionsSource[sectionId]?.title ?? sectionId,
      }),
    }

    Object.entries(tableInfo).forEach(
      ([operationKey, operationInfo]: [string, any]) => {
        if (NON_OPERATION_KEYS.has(operationKey)) return
        if (
          !operationInfo ||
          typeof operationInfo !== 'object' ||
          !operationInfo.url
        )
          return

        // Use parameters from table config if present; otherwise for get_list try to merge from paths
        let parameters = Array.isArray(operationInfo.parameters)
          ? operationInfo.parameters
          : undefined
        const shouldMergeQueryParamsFromPaths =
          (operationKey === 'get_list' ||
            operationKey === 'download_excel_table') &&
          !parameters &&
          paths
        if (shouldMergeQueryParamsFromPaths) {
          parameters = getGetParametersFromPath(paths, operationInfo.url)
        }

        const getListUrl =
          operationKey === 'get_list' ? operationInfo.url : undefined
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
            paths && getListUrl ? { paths, getListUrl } : undefined,
          ),
          ...(Array.isArray(parameters) &&
            parameters.length > 0 && { parameters }),
        }
      },
    )
  })

  return { config: result, sections, groups }
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
  return operationKey === 'post_bulk'
    ? { type: 'array', items: schema }
    : schema
}

/**
 * Normalize URL for path matching: strip protocol/host, ensure single leading/trailing slash.
 */
function normalizePathForMatch(url: string): string {
  const s = (url || '').trim()
  if (!s) return ''
  // Remove protocol and host if present
  const withoutHost = s.replace(/^https?:\/\/[^/]+/, '')
  // Trim leading/trailing slashes without a regex (avoids the ReDoS false
  // positive SonarQube reports on `/\/+$/`; behaviour is identical).
  let start = 0
  while (start < withoutHost.length && withoutHost[start] === '/') start++
  let end = withoutHost.length
  while (end > start && withoutHost[end - 1] === '/') end--
  const path = '/' + withoutHost.slice(start, end) + '/'
  return path.length > 1 && !path.endsWith('/') ? path + '/' : path
}

/**
 * Resolve definition key from path GET response (Swagger 2.0: schema.$ref or schema.items.$ref).
 * Tries exact match first, then normalized match, then match by path suffix, then by tableKey.
 */
function getDefinitionKeyFromPathGetResponse(
  paths: Record<string, any>,
  getListUrl: string,
  tableKey?: string,
): string | null {
  if (!paths || typeof getListUrl !== 'string') return null

  const normalized = normalizePathKey(normalizePathForMatch(getListUrl))
  const pathKeys = Object.keys(paths)

  let pathEntry: any =
    paths[getListUrl] ??
    paths[normalized] ??
    paths[getListUrl.replace(/\/$/, '')] ??
    paths[getListUrl + '/'] ??
    paths[normalizePathForMatch(getListUrl)]

  if (!pathEntry) {
    const matchedKey = pathKeys.find(
      (k) => normalizePathKey(normalizePathForMatch(k)) === normalized,
    )
    if (matchedKey) pathEntry = paths[matchedKey]
  }

  // Fallback: find path whose key ends with the same segment (e.g. /api/v1/areas/ -> /areas/)
  if (!pathEntry && pathKeys.length > 0) {
    const segment = normalized.replace(/^\//, '').replace(/\/$/, '')
    const bySuffix = pathKeys.find((k) => {
      const n = normalizePathForMatch(k)
      return segment
        ? n === normalized ||
            n.endsWith('/' + segment + '/') ||
            n.endsWith('/' + segment)
        : n === normalized
    })
    if (bySuffix) pathEntry = paths[bySuffix]
  }

  // Fallback: find path by tableKey (path key often is kebab-case of table key)
  if (!pathEntry && tableKey && pathKeys.length > 0) {
    const tableKeyKebab = tableKey.replaceAll('_', '-').toLowerCase()
    const tableKeyNorm = tableKey.toLowerCase().replaceAll('-', '_')
    const byTableKey = pathKeys.find((k) => {
      const seg = normalizePathForMatch(k).replace(/^\//, '').replace(/\/$/, '')
      const segNorm = seg.replaceAll('-', '_')
      return seg === tableKeyKebab || segNorm === tableKeyNorm
    })
    if (byTableKey) pathEntry = paths[byTableKey]
  }

  const getSchema = pathEntry?.get?.responses?.default?.schema
  if (!getSchema) return null
  const ref = getSchema.$ref ?? getSchema.items?.$ref
  if (typeof ref !== 'string' || !ref.startsWith('#/definitions/')) return null
  return ref.replace('#/definitions/', '')
}

export function getResponseSchemaFromDefinitions(
  operationKey: string,
  tableKey: string,
  definitions: any,
  locale: string = 'en',
  options?: { paths?: Record<string, any>; getListUrl?: string },
): any {
  let definitionKey: string | null = null

  // Prefer path-based resolution for get_list: use the path's $ref as source of truth so columns always match the API
  if (operationKey === 'get_list' && options?.paths && options?.getListUrl) {
    const pathDefinitionKey = getDefinitionKeyFromPathGetResponse(
      options.paths,
      options.getListUrl,
      tableKey,
    )
    if (pathDefinitionKey && definitions[pathDefinitionKey]) {
      definitionKey = pathDefinitionKey
    }
  }

  if (!definitionKey) {
    definitionKey = findDefinitionKeyForTable(tableKey, definitions)
  }

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
  return str.replaceAll(/[-_]/g, '').toLowerCase()
}

/** Convert PascalCase to snake_case for definition key comparison. */
function toSnakeCase(str: string): string {
  return str
    .replaceAll(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '')
}

function findDefinitionKeyForTable(
  tableKey: string,
  definitions: any,
): string | null {
  const tableDefinitions = Object.keys(definitions).filter(
    (key) => !key.endsWith('BulkDelete') && !key.endsWith('FromExcel'),
  )

  const tryMatch = (candidate: string): string | null =>
    candidate &&
    definitions[candidate] &&
    !candidate.endsWith('BulkDelete') &&
    !candidate.endsWith('FromExcel')
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

  // Definition key to snake_case match
  const normalizedTableKey = tableKey.toLowerCase().replaceAll('-', '_')
  const snakeMatch = tableDefinitions.find(
    (key) => toSnakeCase(key) === normalizedTableKey,
  )
  if (snakeMatch) return snakeMatch

  // Normalized comparison (remove separators, lowercase)
  const normalizedCompare = normalizeForComparison(tableKey)
  const normalizedMatch = tableDefinitions.find(
    (key) => normalizeForComparison(key) === normalizedCompare,
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
  if (!definition || typeof definition !== 'object') {
    return { type: 'object', properties: {}, required: [] }
  }
  const rawProperties = definition.properties
  if (!rawProperties || typeof rawProperties !== 'object') {
    return {
      type: 'object',
      properties: {},
      required: definition.required || [],
    }
  }
  const requiredSet = new Set(
    Array.isArray(definition.required) ? definition.required : [],
  )
  const properties: any = {}

  Object.entries(rawProperties).forEach(([key, prop]: [string, any]) => {
    const hasColumnsToJoin =
      prop.columns_to_join && Array.isArray(prop.columns_to_join)
    const hasJoinFrom = prop.join_from && typeof prop.join_from === 'string'
    const isMainSelector =
      hasJoinFrom && isMainSelectorField(key, prop, rawProperties)

    const { type, format } = resolveFieldType(prop)

    properties[key] = {
      title: resolveTitleWithLocale(prop.title, locale, formatTitle(key)),
      type,
      ...(format && { format }),
      ...(prop.frontendReadOnly && { frontendReadOnly: prop.frontendReadOnly }),
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
        foreignKeyField: findForeignKeyFieldForDependent(key, rawProperties),
        ...(prop.value_none &&
          typeof prop.value_none === 'object' &&
          prop.value_none.title != null && {
            valueNone: { title: prop.value_none.title },
          }),
      }),
      _originalTitle: prop.title,
    }
  })

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
  return findFieldWithColumnsRef(
    dependentFieldKey,
    properties,
    'columns_to_join',
  )
}

function isMainSelectorField(
  fieldKey: string,
  _fieldProp: any,
  properties: any,
): boolean {
  const foreignKeyField = findForeignKeyFieldForDependent(fieldKey, properties)
  if (!foreignKeyField) return false

  const foreignKeyProp = properties[foreignKeyField]
  const columnsToJoin = foreignKeyProp?.columns_to_join
  if (!Array.isArray(columnsToJoin) || !columnsToJoin.includes(fieldKey)) {
    return false
  }

  for (const columnKey of columnsToJoin) {
    const columnProp = properties[columnKey]
    if (!columnProp) continue
    if (!columnProp.frontendReadOnly) return columnKey === fieldKey
  }

  return columnsToJoin[0] === fieldKey
}
