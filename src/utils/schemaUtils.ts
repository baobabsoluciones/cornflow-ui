// Schema transformation utilities for OpenAPI to internal format conversion
import type { MasterTableCompareStrategy } from '@/app/config'
import { resolveTitleWithLocale } from './i18nUtils'

// ─── Shared helpers ──────────────────────────────────────────────────────────

/** True when `prop.choices` is a non-empty array (shared with the FA OpenAPI transform). */
export function hasValidChoices(prop: any): boolean {
  return Array.isArray(prop?.choices) && prop.choices.length > 0
}

/**
 * Generic lookup: find the field whose `columnsProp` array includes `fieldKey`.
 * Works with both raw OpenAPI props (`columns_to_join`) and converted props (`columnsToJoin`).
 * Exported: shared by the core compare/diff helpers and the FA OpenAPI transform.
 */
export function findFieldWithColumnsRef(
  fieldKey: string,
  properties: Record<string, any>,
  columnsProp: 'columns_to_join' | 'columnsToJoin',
): string | null {
  for (const [key, prop] of Object.entries(properties)) {
    const columns = prop?.[columnsProp]
    if (Array.isArray(columns) && columns.includes(fieldKey)) return key
  }
  return null
}

/**
 * Field keys to skip when comparing uploaded instance rows vs master table rows.
 *
 * Only **raw foreign-key id columns** are excluded (e.g. `factoria_id`, `puerto_id`).
 * **Not** excluded: values denormalized into the row via `columns_to_join` / `columnsToJoin`
 * (e.g. `factoria`, `codigo_factoria`) or dependent `join_from` **label** fields — those are
 * what users see in the grid and should appear in the compare modal and in diffs.
 */

function resolveDependentFieldFkKey(
  fieldKey: string,
  p: Record<string, unknown>,
  props: Record<string, any>,
): string | null {
  const fkDirect = p.foreignKeyField
  if (typeof fkDirect === 'string' && fkDirect.length > 0) return fkDirect
  const fromCamel = getForeignKeyFieldName(fieldKey, { properties: props })
  if (fromCamel) return fromCamel
  return (
    findFieldWithColumnsRef(fieldKey, props, 'columns_to_join') ??
    findFieldWithColumnsRef(fieldKey, props, 'columnsToJoin')
  )
}

export function getExcludedKeysForMasterTableCompare(
  tableConfig: unknown,
): Set<string> {
  const set = new Set<string>()
  const props = getListResponseRowProperties(tableConfig)?.properties
  if (!props || typeof props !== 'object') return set

  for (const [fieldKey, prop] of Object.entries(props)) {
    const p = prop as Record<string, unknown> & {
      columns_to_join?: unknown
      columnsToJoin?: unknown
      join_from?: unknown
      joinFrom?: unknown
      foreignKeyField?: unknown
    }
    const joinCols = p.columns_to_join ?? p.columnsToJoin

    const hasJoinColumns = Array.isArray(joinCols) && joinCols.length > 0
    const isFk = p.isForeignKey === true || hasJoinColumns

    if (isFk) {
      // Exclude only the FK column itself, not columns_to_join targets (display/joined data).
      set.add(fieldKey)
    }

    const isDependent =
      p.isDependentField === true ||
      (typeof p.joinFrom === 'string' && p.joinFrom.length > 0) ||
      (typeof p.join_from === 'string' && p.join_from.length > 0)

    if (isDependent && !isFk) {
      // Dependent label field (e.g. `factoria` with join_from): exclude the backing FK id only.
      const fkKey = resolveDependentFieldFkKey(fieldKey, p, props)
      if (fkKey) set.add(fkKey)
    }
  }

  return set
}

// ─── Master vs instance row matching (composite key) ─────────────────────────

const ROW_MATCH_IGNORED_KEYS = new Set([
  'id',
  '_id',
  'created_at',
  'updated_at',
])

/** Regex order: more specific prefixes first (e.g. codigo_ before codigo). */
const ROW_MATCH_KEY_PRIORITY: RegExp[] = [
  /^codigo_/i,
  /^code_/i,
  /^codigo$/i,
  /^code$/i,
  /^key_/i,
  /^key$/i,
  /^producto/i,
  /^product/i,
  /^nombre/i,
  /^name/i,
]

/**
 * Column names from a sample row, ordered for building a stable composite match key.
 */
export function orderedRowMatchKeyCandidates(keys: string[]): string[] {
  const usable = keys.filter((k) => !ROW_MATCH_IGNORED_KEYS.has(k))
  const priority: string[] = []
  for (const re of ROW_MATCH_KEY_PRIORITY) {
    for (const k of usable) {
      if (re.test(k) && !priority.includes(k)) priority.push(k)
    }
  }
  const rest = usable
    .filter((k) => !priority.includes(k))
    .sort((a, b) => a.localeCompare(b))
  return [...priority, ...rest]
}

export function rowMatchKeyPart(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

/**
 * Stable string key for a row using the given field list (composite business key).
 */
export function buildRowMatchKey(row: unknown, fields: string[]): string {
  if (!row || typeof row !== 'object' || fields.length === 0) return ''
  const r = row as Record<string, unknown>
  let lowerIndex: Map<string, string> | null = null
  const getValue = (field: string): unknown => {
    // Prefer the exact key so a business field and a UI-internal field that
    // differ only in case (e.g. row carries both an uppercase business id and
    // a lowercase synthetic row id) resolve to the intended value.
    if (Object.hasOwn(r, field)) return r[field]
    // Fall back to a case-insensitive lookup so keys picked from one side
    // still resolve against rows from the other side that use a different
    // casing for the same column. Without this fallback every row on the
    // mismatched side produces the same empty key and they collapse to a
    // single entry in the diff maps.
    if (!lowerIndex) {
      lowerIndex = new Map<string, string>()
      for (const k of Object.keys(r)) {
        const lower = k.toLowerCase()
        if (!lowerIndex.has(lower)) lowerIndex.set(lower, k)
      }
    }
    const actualKey = lowerIndex.get(field.toLowerCase())
    return actualKey === undefined ? undefined : r[actualKey]
  }
  return fields.map((f) => rowMatchKeyPart(getValue(f))).join('\u0001')
}

/**
 * True if `fields` uniquely identifies every row in `rows`.
 */
export function isUniqueKeyForRows(rows: unknown[], fields: string[]): boolean {
  if (!rows.length || !fields.length) return true
  const seen = new Set<string>()
  for (const row of rows) {
    const k = buildRowMatchKey(row, fields)
    if (seen.has(k)) return false
    seen.add(k)
  }
  return true
}

/**
 * Chooses a minimal list of columns that uniquely identifies rows in **both** datasets
 * (instance and master), so pairing does not collapse many physical rows into one Map entry.
 *
 * Falls back to legacy single-field behavior when no composite can be built from row shape.
 *
 * When `configuredMatchFields` is provided and every field exists on a sample row, those
 * fields are used as the business key (app config). Otherwise the heuristic below applies.
 */
function isUniqueKeyForBothDataSets(
  fields: string[],
  instanceData: unknown[],
  masterData: unknown[],
): boolean {
  const okI = !instanceData?.length || isUniqueKeyForRows(instanceData, fields)
  const okM = !masterData?.length || isUniqueKeyForRows(masterData, fields)
  return okI && okM
}

/**
 * Returns the configured match fields when every one of them is present on the
 * sample row, otherwise null so the heuristic resolution can take over.
 */
function resolveConfiguredMatchFields(
  sampleRow: object,
  configuredMatchFields?: string[] | null,
): string[] | null {
  if (!configuredMatchFields || configuredMatchFields.length === 0) return null
  const rowKeys = new Set(Object.keys(sampleRow))
  const present = configuredMatchFields.filter((f) => rowKeys.has(f))
  return present.length === configuredMatchFields.length ? present : null
}

/**
 * Grows `fields` one candidate at a time, returning the first prefix that is a
 * unique key for both datasets, or null if none of the candidates achieves it.
 */
function growToUniqueKey(
  fields: string[],
  candidates: string[],
  instanceData: unknown[],
  masterData: unknown[],
): string[] | null {
  for (const k of candidates) {
    fields.push(k)
    if (isUniqueKeyForBothDataSets(fields, instanceData, masterData)) {
      return [...fields]
    }
  }
  return null
}

export function resolveMatchKeyFields(
  instanceData: unknown[],
  masterData: unknown[],
  configuredMatchFields?: string[] | null,
): string[] {
  const sampleRow =
    (instanceData?.length ? instanceData[0] : null) ??
    (masterData?.length ? masterData[0] : null)
  if (!sampleRow || typeof sampleRow !== 'object') {
    return ['id']
  }

  const configured = resolveConfiguredMatchFields(
    sampleRow,
    configuredMatchFields,
  )
  if (configured) return configured

  const keys = Object.keys(sampleRow).filter(
    (k) => !ROW_MATCH_IGNORED_KEYS.has(k),
  )
  const candidates = orderedRowMatchKeyCandidates(keys)

  const fields: string[] = []
  const byCandidates = growToUniqueKey(
    fields,
    candidates,
    instanceData,
    masterData,
  )
  if (byCandidates) return byCandidates

  const remaining = keys
    .filter((k) => !fields.includes(k))
    .sort((a, b) => a.localeCompare(b))
  const byRemaining = growToUniqueKey(
    fields,
    remaining,
    instanceData,
    masterData,
  )
  if (byRemaining) return byRemaining

  if (keys.length) {
    const all = [...keys].sort((a, b) => a.localeCompare(b))
    if (isUniqueKeyForBothDataSets(all, instanceData, masterData)) return all
  }

  return candidates.length ? [candidates[0]] : ['id']
}

/**
 * For each row, fills display fields from `fullInstanceData[sourceTable]` when the display
 * value is empty or equals the row's code (`keyField`). Generic; driven by app config only.
 */

function buildSourceDict(
  sourceRows: unknown[],
  keyField: string,
  valueField: string,
): Map<string, string> {
  const dict = new Map<string, string>()
  for (const sr of sourceRows) {
    if (!sr || typeof sr !== 'object') continue
    const s = sr as Record<string, unknown>
    const k = rowMatchKeyPart(s[keyField])
    if (k === '') continue
    const v = s[valueField]
    if (v != null && v !== '' && !dict.has(k)) {
      dict.set(k, String(v))
    }
  }
  return dict
}

function applyDictToRow(
  out: Record<string, unknown>,
  rule: unknown,
  fullInstanceData: Record<string, unknown>,
): void {
  const r = rule as { sourceTable: string; keyField: string; valueField: string; targetFields: string[] }
  const sourceRows = fullInstanceData[r.sourceTable]
  if (!Array.isArray(sourceRows)) return

  const dict = buildSourceDict(sourceRows, r.keyField, r.valueField)

  const codeKey = rowMatchKeyPart(out[r.keyField])
  if (codeKey === '') return
  const resolved = dict.get(codeKey)
  if (resolved === undefined) return

  for (const tf of r.targetFields) {
    const cur = out[tf]
    if (cur === null || cur === undefined || cur === '' || String(cur) === codeKey) {
      out[tf] = resolved
    }
  }
}

export function applyMasterTableDisplayNormalization(
  rows: unknown[],
  fullInstanceData: Record<string, unknown>,
  strategy: MasterTableCompareStrategy | undefined,
): unknown[] {
  if (!rows.length) return rows
  const dicts = strategy?.dictionaries
  if (!dicts || Object.keys(dicts).length === 0) {
    return rows
  }

  const rules = Object.values(dicts)

  return rows.map((row) => {
    if (!row || typeof row !== 'object') return row
    const out = { ...(row as Record<string, unknown>) }
    for (const rule of rules) {
      applyDictToRow(out, rule, fullInstanceData)
    }
    return out
  })
}

// ─── Public FK helpers (converted camelCase schema) ──────────────────────────

export function getForeignKeyFieldName(
  dependentFieldKey: string,
  schema: any,
): string | null {
  if (!schema?.properties) return null
  return findFieldWithColumnsRef(
    dependentFieldKey,
    schema.properties,
    'columnsToJoin',
  )
}

export function getDependentFields(
  foreignKeyField: string,
  schema: any,
): string[] {
  if (!schema?.properties) return []
  return schema.properties[foreignKeyField]?.columnsToJoin || []
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

    Object.keys(table).forEach((operationKey) => {
      const operation = table[operationKey]
      if (operation && typeof operation === 'object') {
        if (operation.request_schema)
          resolveSchemaObjectTitles(operation.request_schema, locale)
        if (operation.response_schema)
          resolveSchemaObjectTitles(operation.response_schema, locale)
      }
    })
  })

  return resolved
}

function resolveSchemaObjectTitles(schema: any, locale: string): void {
  if (!schema || typeof schema !== 'object') return

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

  if (schema.properties) {
    Object.values(schema.properties).forEach((prop: any) => {
      if (prop?._originalTitle) {
        prop.title = resolveTitleWithLocale(
          prop._originalTitle,
          locale,
          prop.title,
        )
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

// ─── Parameter (object-type) table detection ──────────────────────────────────

/**
 * Returns true when the schema describes a parameter table: a single object (dictionary)
 * with properties, not an array of rows. Used for instance schema, frontend-automation
 * definitions, and data handling (Excel, ETL).
 */
export function isParameterTableSchema(schema: any): boolean {
  if (!schema || typeof schema !== 'object') return false
  const hasObjectType = schema.type === 'object'
  const hasProperties =
    schema.properties && typeof schema.properties === 'object'
  const notArray = schema.type !== 'array' && !schema.items
  return Boolean(hasObjectType && hasProperties && notArray)
}

/**
 * True when a frontend-automation table config is a parameter (single-object) table:
 * merged from instance schema with `isParameterTable`, or GET `response_schema` is object-shaped.
 */
export function isParameterTableAutomationConfig(tableConfig: any): boolean {
  if (tableConfig?.isParameterTable === true) return true
  return isParameterTableSchema(tableConfig?.get_list?.response_schema)
}

/**
 * Row-level properties for list UI: array tables use `response_schema.items`;
 * parameter tables use `response_schema` (object with `properties`).
 */
export function getListResponseRowProperties(tableConfig: any): {
  properties: Record<string, any>
  required: string[]
} | null {
  const rs = tableConfig?.get_list?.response_schema
  if (!rs) return null
  if (rs.items?.properties && typeof rs.items.properties === 'object') {
    return {
      properties: rs.items.properties,
      required: Array.isArray(rs.items.required) ? rs.items.required : [],
    }
  }
  if (isParameterTableSchema(rs) && rs.properties) {
    return {
      properties: rs.properties,
      required: Array.isArray(rs.required) ? rs.required : [],
    }
  }
  return null
}

/**
 * When the API wraps the row list in `results`, `data`, or `items`, return that array.
 */
function unwrapListEnvelope(data: Record<string, unknown>): any[] | null {
  if (Array.isArray(data.results)) return data.results
  if (Array.isArray(data.data)) return data.data
  if (Array.isArray(data.items)) return data.items
  return null
}

/**
 * True when `data` looks like a paginated envelope but is **not** a single row object
 * (used to avoid wrapping `{ count, next, results: [...] }` as one fake row).
 */
function isPaginatedListEnvelope(data: Record<string, unknown>): boolean {
  if (data.results !== undefined && Array.isArray(data.results)) return true
  if (data.data !== undefined && Array.isArray(data.data)) return true
  if (data.items !== undefined && Array.isArray(data.items)) return true
  return false
}

/**
 * Normalizes GET list response to row array.
 * - Unwraps common envelopes (`results` / `data` / `items` arrays).
 * - Parameter tables may return one object instead of `[{...}]`.
 * - OpenAPI `get_list` is always modeled as `{ type: 'array', items: rowSchema }` by the
 *   frontend-automation OpenAPI transform, even when the backend returns a single
 *   object for a one-row / settings table — wrap that object as one row.
 */
export function normalizeGetListResponseToRows(
  data: any,
  tableConfig: any,
): any[] {
  if (data == null) return []
  if (Array.isArray(data)) return data
  if (typeof data !== 'object') return []

  const asRecord = data as Record<string, unknown>
  const unwrapped = unwrapListEnvelope(asRecord)
  if (unwrapped) return unwrapped

  if (isParameterTableAutomationConfig(tableConfig)) {
    return [asRecord]
  }

  const rs = tableConfig?.get_list?.response_schema
  if (
    rs?.type === 'array' &&
    rs.items?.properties &&
    typeof rs.items.properties === 'object' &&
    !isPaginatedListEnvelope(asRecord)
  ) {
    return [asRecord]
  }

  return []
}

/**
 * Returns true when the property has allow_load_from_db === false in the instance schema.
 * When false, "load from DB" options must be disabled for this parameter (mandatory manual load).
 */
export function isAllowLoadFromDbDisabled(prop: any): boolean {
  return prop && typeof prop === 'object' && prop.allow_load_from_db === false
}

/**
 * JSON Schema extension: `visible: false` hides a property everywhere in the UI for
 * instance/solution data — tabular row fields (`items.properties`), parameter objects,
 * tables, Excel export, and add/edit forms. Omission of `visible` means shown.
 */
export function isParameterPropertySchemaVisible(prop: unknown): boolean {
  if (!prop || typeof prop !== 'object') return true
  return (prop as any).visible !== false
}

/** Single type string for table headers / CoreModal (matches `FieldConfig.type` primitives). */
export type JsonSchemaNormalizedUiType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'time'

/**
 * JSON Schema allows `type` as an array (e.g. `["integer", "number", "null"]`). The UI
 * (CoreModal add/edit, CoreTable metadata) expects a single string `FieldConfig.type`;
 * unknown compound types would otherwise render no input control (empty grid cell).
 */
export function normalizeJsonSchemaPropertyTypeForUi(
  prop: any,
): JsonSchemaNormalizedUiType {
  if (!prop || typeof prop !== 'object') return 'string'
  const raw = prop.type
  const scalarParts: string[] = raw != null && raw !== '' ? [String(raw)] : []
  const parts: string[] = Array.isArray(raw)
    ? raw.filter((p: any) => p != null && p !== 'null')
    : scalarParts
  const fmt = prop.format
  if (fmt === 'date') return 'date'
  if (fmt === 'date-time') return 'datetime'
  if (fmt === 'time') return 'time'
  if (parts.includes('integer') || parts.includes('number')) return 'number'
  if (parts.includes('boolean')) return 'boolean'
  if (parts.includes('string')) return 'string'
  return 'string'
}

/**
 * Resolves the instance JSON Schema object that holds top-level table properties
 * (either `schema.instance` or root `schema` with `.properties`).
 */
export function getInstanceSchemaRootForTables(instanceSchema: any): {
  properties?: Record<string, any>
} | null {
  if (!instanceSchema || typeof instanceSchema !== 'object') return null
  if (
    instanceSchema.instance?.properties &&
    typeof instanceSchema.instance.properties === 'object'
  ) {
    return instanceSchema.instance
  }
  if (instanceSchema.properties) return instanceSchema
  return null
}

function normalizeSchemaTableKeyForLookup(key: string): string {
  return String(key).toLowerCase().replaceAll('-', '_')
}

/**
 * Normalizes instance / ETL table keys for matching `instance.data` with
 * `__metadata__.tables_from_db` and UI table keys (same rules as ExecutionDataView).
 */
export function normalizeTableNameForEtlLookup(name: string): string {
  if (!name) return ''
  const withUnderscores = name.replaceAll(/\s+/g, '_').replaceAll('-', '_')
  if (withUnderscores.includes('_')) {
    return withUnderscores.toLowerCase()
  }
  if (
    withUnderscores !== withUnderscores.toLowerCase() &&
    withUnderscores !== withUnderscores.toUpperCase()
  ) {
    return withUnderscores.replaceAll(/([a-z])([A-Z])/g, '$1_$2').toLowerCase()
  }
  return withUnderscores.toLowerCase()
}

/**
 * Instance JSON Schema property for a master table key (exact key or normalized match).
 */
export function getInstanceTableJsonSchemaForKey(
  tableKey: string,
  instanceSchema: any,
): any {
  if (!tableKey) return null
  const root = getInstanceSchemaRootForTables(instanceSchema)
  const props = root?.properties
  if (!props || typeof props !== 'object') return null
  if (props[tableKey]) return props[tableKey]
  const target = normalizeSchemaTableKeyForLookup(tableKey)
  for (const k of Object.keys(props)) {
    if (normalizeSchemaTableKeyForLookup(k) === target) {
      return props[k]
    }
  }
  return null
}

/**
 * Property names defined for a single table inside the instance JSON Schema.
 * Handles both array-of-objects tables (`items.properties`) and parameter
 * object tables (`properties`). Returns undefined when no schema is provided
 * so callers can fall back to comparing every row key.
 */
export function getInstanceTableSchemaColumns(
  instanceTableJsonSchema: any,
): string[] | undefined {
  if (!instanceTableJsonSchema || typeof instanceTableJsonSchema !== 'object') {
    return undefined
  }
  const itemProps = instanceTableJsonSchema.items?.properties
  if (itemProps && typeof itemProps === 'object') {
    return Object.keys(itemProps)
  }
  if (
    instanceTableJsonSchema.properties &&
    typeof instanceTableJsonSchema.properties === 'object'
  ) {
    return Object.keys(instanceTableJsonSchema.properties)
  }
  return undefined
}

/**
 * Display column names that replace foreign-key IDs in a master table's row
 * shape. For each FK property in the master config we collect the targets of
 * `columns_to_join` / `columnsToJoin`, which are denormalized into the row by
 * the backend and shown in the compare UI instead of the raw FK id. Returned
 * in original case so the diff can reconcile casing via lowercased lookup.
 */
export function getMasterJoinedDisplayColumns(
  masterTableConfig: unknown,
): string[] {
  const props = getListResponseRowProperties(masterTableConfig)?.properties
  if (!props || typeof props !== 'object') return []
  const out: string[] = []
  for (const prop of Object.values(props)) {
    const cols = prop?.columns_to_join ?? prop?.columnsToJoin
    if (Array.isArray(cols)) {
      for (const c of cols) {
        if (typeof c === 'string' && c.length > 0) out.push(c)
      }
    }
  }
  return out
}

/**
 * Build a case-insensitive lookup map: lowercased key → original value.
 * Used by row-diff helpers so columns that differ only in case (e.g. `Name`
 * vs `name`) collapse to the same column for comparison.
 */
export function buildLowercasedKeyMap(row: any): Map<string, any> {
  const map = new Map<string, any>()
  if (row && typeof row === 'object') {
    for (const k of Object.keys(row)) {
      map.set(k.toLowerCase(), row[k])
    }
  }
  return map
}

/**
 * Lowercased column names to consider when diffing two rows. When
 * `allowedColumns` is provided (typically from the instance JSON schema),
 * we restrict the diff to those columns — extra columns present in either
 * row are ignored. Otherwise the union of both rows' keys is used.
 *
 * `excludedKeys` (e.g. `columns_to_join` foreign-key IDs) and the standard
 * ignored fields (`id`, `_id`, `created_at`, `updated_at`) are removed.
 */
/** Adds the lowercased keys of `row` (when it is an object) to `candidates`. */
function addLowercasedRowKeys(candidates: Set<string>, row: unknown): void {
  if (row && typeof row === 'object') {
    for (const k of Object.keys(row)) candidates.add(k.toLowerCase())
  }
}

export function resolveComparableLowercasedKeys(options: {
  row1?: any
  row2?: any
  allowedColumns?: Iterable<string>
  excludedKeys?: Set<string>
}): string[] {
  const ignoredLower = new Set(['id', '_id', 'created_at', 'updated_at'])
  const excludedLower = new Set<string>()
  if (options.excludedKeys) {
    options.excludedKeys.forEach((k) => excludedLower.add(k.toLowerCase()))
  }

  const candidates = new Set<string>()
  if (options.allowedColumns) {
    for (const k of options.allowedColumns) candidates.add(k.toLowerCase())
  } else {
    addLowercasedRowKeys(candidates, options.row1)
    addLowercasedRowKeys(candidates, options.row2)
  }

  const out: string[] = []
  for (const k of candidates) {
    if (ignoredLower.has(k)) continue
    if (excludedLower.has(k)) continue
    out.push(k)
  }
  return out
}

/**
 * Resolves the solution JSON Schema object that holds top-level table properties
 * (either `schema.solution` or root `schema` with `.properties`).
 */
export function getSolutionSchemaRootForTables(solutionSchema: any): {
  properties?: Record<string, any>
} | null {
  if (!solutionSchema || typeof solutionSchema !== 'object') return null
  if (
    solutionSchema.solution?.properties &&
    typeof solutionSchema.solution.properties === 'object'
  ) {
    return solutionSchema.solution
  }
  if (solutionSchema.properties) return solutionSchema
  return null
}

/**
 * Solution JSON Schema property for a table key (exact key or normalized match).
 */
export function getSolutionTableJsonSchemaForKey(
  tableKey: string,
  solutionSchema: any,
): any {
  if (!tableKey) return null
  const root = getSolutionSchemaRootForTables(solutionSchema)
  const props = root?.properties
  if (!props || typeof props !== 'object') return null
  if (props[tableKey]) return props[tableKey]
  const target = normalizeSchemaTableKeyForLookup(tableKey)
  for (const k of Object.keys(props)) {
    if (normalizeSchemaTableKeyForLookup(k) === target) {
      return props[k]
    }
  }
  return null
}

/**
 * Prepares instance payloads for POST `/etl/update/` (and related) during solution
 * recalculation: drops top-level keys that are **solution-only** (declared on the
 * solution schema but not on the instance schema), so edited solution tables are not
 * sent as instance data. All other keys are kept — including instance tables omitted
 * from the UI schema (e.g. `visible: false`) so the backend still receives required
 * tables such as `areas`. Preserves `__metadata__`; skips other `__*` keys.
 */
export function pickInstanceDataForEtlPayload(
  data: Record<string, any> | null | undefined,
  instanceSchema: any,
  solutionSchema?: any,
): Record<string, any> {
  if (!data || typeof data !== 'object') return {}
  const out: Record<string, any> = {}
  for (const [key, value] of Object.entries(data)) {
    if (key === '__metadata__') {
      out[key] = value
      continue
    }
    if (key.startsWith('__')) continue

    const inInstance =
      instanceSchema && getInstanceTableJsonSchemaForKey(key, instanceSchema)
    const inSolution =
      solutionSchema && getSolutionTableJsonSchemaForKey(key, solutionSchema)

    if (inSolution && !inInstance) continue

    out[key] = value
  }
  return out
}

/**
 * Master-data / frontend-automation table config for a key (exact or normalized match).
 */
export function getMasterDataTableConfigForKey(
  masterData: Record<string, any> | null | undefined,
  tableKey: string,
): any {
  if (!masterData || typeof masterData !== 'object' || !tableKey) return null
  if (masterData[tableKey]?.get_list) return masterData[tableKey]
  const target = normalizeSchemaTableKeyForLookup(tableKey)
  for (const k of Object.keys(masterData)) {
    if (
      normalizeSchemaTableKeyForLookup(k) === target &&
      masterData[k]?.get_list
    ) {
      return masterData[k]
    }
  }
  return null
}

function parseAlternativeInstancePath(instancePath: string): {
  table: string
  column: string
} | null {
  const dot = instancePath.indexOf('.')
  if (dot <= 0 || dot === instancePath.length - 1) return null
  return {
    table: instancePath.slice(0, dot),
    column: instancePath.slice(dot + 1),
  }
}

function arrayItemsImplyNameValueRows(itemsSchema: any): boolean {
  const p = itemsSchema?.properties
  if (!p || typeof p !== 'object') return false
  const keys = Object.keys(p).filter((k) => {
    const prop = p[k]
    return prop != null && prop.visible !== false
  })
  if (keys.length !== 2) return false
  return keys.includes('name') && keys.includes('value')
}

/** First row of an EAV payload: exactly `name` and `value`. */
function isNameValueDataRow(row: unknown): boolean {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return false
  const o = row as Record<string, unknown>
  const keys = Object.keys(o).filter((k) => o[k] !== undefined)
  return keys.length === 2 && keys.includes('name') && keys.includes('value')
}

export type AlternativeParameterPayloadShape =
  | 'object'
  | 'arrayWide'
  | 'arrayNameValue'

/**
 * How instance.data[tableKey] should be shaped for alternative parameter fields:
 * - `object`: single object `{ col: val, ... }` (instance schema parameter object / type object).
 * - `arrayWide`: `[{ col: val, ... }]` (tabular array; Excel = header row + data rows).
 * - `arrayNameValue`: `[{ name, value }, ...]` (EAV rows).
 *
 * Uses instance JSON Schema first, then frontend-automation `get_list.response_schema` / flags.
 */
/** Payload shape for an `array`-typed schema: name/value EAV rows vs. wide rows. */
function arrayPayloadShape(itemsSchema: any): AlternativeParameterPayloadShape {
  return arrayItemsImplyNameValueRows(itemsSchema) ? 'arrayNameValue' : 'arrayWide'
}

/**
 * Payload shape inferred from the instance JSON Schema for the table, or null
 * when the instance schema does not describe the table well enough.
 */
function payloadShapeFromInstanceSchema(
  inst: any,
): AlternativeParameterPayloadShape | null {
  if (!inst) return null
  /**
   * Parameter tables are `type: object` in the instance schema (one keyed object in API data).
   * ETL Excel uses a **horizontal** sheet (header row + data rows); `schemaDataToTable` only does that
   * for `type: array` tables — see `patchInstanceSchemaRootForParameterTableEtlExport`.
   */
  if (isParameterTableSchema(inst)) return 'object'
  if (inst.type === 'object' && inst.properties) return 'object'
  if (inst.type === 'array' && inst.items) return arrayPayloadShape(inst.items)
  return null
}

/**
 * Payload shape inferred from the frontend-automation table config, or null when
 * the config does not determine a shape.
 */
function payloadShapeFromAutomationConfig(
  automationTableConfig: any,
): AlternativeParameterPayloadShape | null {
  if (automationTableConfig?.isParameterTable === true) return 'object'
  if (isParameterTableAutomationConfig(automationTableConfig)) return 'object'

  const rs = automationTableConfig?.get_list?.response_schema
  if (rs && isParameterTableSchema(rs)) return 'object'
  if (rs?.type === 'array' && rs.items) return arrayPayloadShape(rs.items)
  return null
}

export function resolveAlternativeParameterPayloadShapeForTable(
  tableKey: string,
  instanceSchema: any,
  automationTableConfig: any,
): AlternativeParameterPayloadShape {
  const inst = getInstanceTableJsonSchemaForKey(tableKey, instanceSchema)
  const fromInstance = payloadShapeFromInstanceSchema(inst)
  if (fromInstance) return fromInstance

  const fromAutomation = payloadShapeFromAutomationConfig(automationTableConfig)
  if (fromAutomation) return fromAutomation

  return 'arrayWide'
}

function normalizeAlternativeFieldValue(
  field: { type: string },
  raw: unknown,
): unknown {
  let v = raw
  if (field.type === 'number' && v !== '' && v !== null && v !== undefined) {
    const n = typeof v === 'number' ? v : Number(v)
    v = Number.isFinite(n) ? n : v
  }
  return v
}

export interface AlternativeParameterFieldInput {
  id: string
  instancePath: string
  type: string
}

/**
 * Builds partial `instance.data` for the “load parameters” flow from form fields,
 * matching instance schema and (when needed) master-data automation config.
 */
/** Groups fields by their instance-path table, skipping unparseable paths. */
function groupAlternativeFieldsByTable(
  fields: AlternativeParameterFieldInput[],
): Record<string, AlternativeParameterFieldInput[]> {
  const byTable: Record<string, AlternativeParameterFieldInput[]> = {}
  for (const f of fields) {
    const p = parseAlternativeInstancePath(f.instancePath)
    if (!p) continue
    if (!byTable[p.table]) byTable[p.table] = []
    byTable[p.table].push(f)
  }
  return byTable
}

/** Builds a single wide `{ column: value }` row from a table's fields. */
function buildAlternativeWideRow(
  tableFields: AlternativeParameterFieldInput[],
  values: Record<string, unknown>,
): Record<string, any> {
  const row: Record<string, any> = {}
  for (const f of tableFields) {
    const p = parseAlternativeInstancePath(f.instancePath)
    row[p.column] = normalizeAlternativeFieldValue(f, values[f.id])
  }
  return row
}

/** Builds `{ name, value }[]` EAV rows from a table's fields. */
function buildAlternativeNameValueRows(
  tableFields: AlternativeParameterFieldInput[],
  values: Record<string, unknown>,
): { name: string; value: unknown }[] {
  return tableFields.map((f) => {
    const p = parseAlternativeInstancePath(f.instancePath)
    return {
      name: p.column,
      value: normalizeAlternativeFieldValue(f, values[f.id]),
    }
  })
}

export function buildAlternativeParameterInstanceData(
  fields: AlternativeParameterFieldInput[],
  values: Record<string, unknown>,
  instanceSchema: any,
  masterDataTables: Record<string, any> | null | undefined,
): Record<string, any> {
  const byTable = groupAlternativeFieldsByTable(fields)

  const out: Record<string, any> = {}

  for (const [table, tableFields] of Object.entries(byTable)) {
    const automationTable = getMasterDataTableConfigForKey(
      masterDataTables ?? null,
      table,
    )
    const shape = resolveAlternativeParameterPayloadShapeForTable(
      table,
      instanceSchema,
      automationTable,
    )

    if (shape === 'object') {
      out[table] = buildAlternativeWideRow(tableFields, values)
    } else if (shape === 'arrayNameValue') {
      out[table] = buildAlternativeNameValueRows(tableFields, values)
    } else {
      out[table] = [buildAlternativeWideRow(tableFields, values)]
    }
  }

  return out
}

/**
 * Merges `[{ name, value }]` arrays back into `{ [name]: value }` for tables that are parameter objects
 * in the instance schema (client-side validation / Instance constructor).
 */
export function convertParameterNameValueArraysToObjectsForInstance(
  data: Record<string, any>,
  instanceSchema: any,
): Record<string, any> {
  if (!data || typeof data !== 'object') return data
  const out: Record<string, any> = { ...data }
  for (const [key, val] of Object.entries(data)) {
    if (!Array.isArray(val) || val.length === 0) continue
    const first = val[0]
    if (
      !first ||
      typeof first !== 'object' ||
      !Object.hasOwn(first, 'name') ||
      !Object.hasOwn(first, 'value')
    ) {
      continue
    }
    const tableSchema = getInstanceTableJsonSchemaForKey(key, instanceSchema)
    if (!isParameterTableSchema(tableSchema)) continue
    const obj: Record<string, any> = {}
    for (const row of val) {
      if (row && typeof row === 'object' && row.name != null) {
        obj[String(row.name)] = row.value
      }
    }
    out[key] = obj
  }
  return out
}

/**
 * Instance schema often declares parameter tables as `type: object`, but `schemaDataToTable` writes
 * **horizontal** sheets only for `type: array` (header row + data rows). Object-typed sheets use a
 * vertical key-value layout, which ETL may reject. This patch rewrites parameter-table properties to
 * `type: array` + `items: { type: object, properties }` so export matches a normal table (e.g. `start_date` | `end_date`).
 * When data is already `[{ name, value }, …]` (schema-resolved EAV), keeps the name/value column layout.
 */
export function patchInstanceSchemaRootForParameterTableEtlExport(
  data: Record<string, any>,
  root: { properties?: Record<string, any> } | null,
): { properties?: Record<string, any> } | null {
  if (!root?.properties) return root
  const props = { ...root.properties }
  let changed = false
  for (const [key, val] of Object.entries(data)) {
    const orig = props[key]
    if (!orig || !isParameterTableSchema(orig)) continue

    if (Array.isArray(val) && val.length > 0 && isNameValueDataRow(val[0])) {
      props[key] = {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            value: {},
          },
        },
      }
      changed = true
      continue
    }

    props[key] = {
      type: 'array',
      items: {
        type: 'object',
        properties: orig.properties ? { ...orig.properties } : {},
        ...(Array.isArray(orig.required) && orig.required.length > 0
          ? { required: [...orig.required] }
          : {}),
      },
    }
    changed = true
  }
  return changed ? { ...root, properties: props } : root
}

/**
 * True for master data tables that represent a single parameter object (no add-row).
 * Uses automation config and instance schema — OpenAPI often models get_list as an array
 * even when the domain table is one object; instance schema still has type object.
 */
export function isMasterDataParameterObjectTable(
  tableKey: string,
  tableConfig: any,
  instanceSchema: any,
): boolean {
  if (!tableConfig) return false
  if (isParameterTableAutomationConfig(tableConfig)) return true
  const tableSchema = getInstanceTableJsonSchemaForKey(tableKey, instanceSchema)
  return isParameterTableSchema(tableSchema)
}

/**
 * Drops parameter keys marked `visible: false` in the instance schema.
 * Preserves `__*` keys. If instance values are shaped as `{ value, visible }`, omits when `visible === false`.
 */
export function filterParameterObjectByVisibleProperties(
  objectData: Record<string, any>,
  tableKey: string,
  instanceSchema: any,
): Record<string, any> {
  if (!objectData || typeof objectData !== 'object') return {}
  const root = getInstanceSchemaRootForTables(instanceSchema)
  const tableProp = root?.properties?.[tableKey]
  const props = tableProp?.properties
  const out: Record<string, any> = {}
  for (const key of Object.keys(objectData)) {
    if (key.startsWith('__')) {
      out[key] = objectData[key]
      continue
    }
    const rawVal = objectData[key]
    if (
      rawVal &&
      typeof rawVal === 'object' &&
      !Array.isArray(rawVal) &&
      rawVal.visible === false
    ) {
      continue
    }
    const ps = props?.[key]
    if (ps !== undefined && !isParameterPropertySchemaVisible(ps)) continue
    out[key] = rawVal
  }
  return out
}

/**
 * Clones instance `data` and removes parameter object properties hidden via `visible: false`.
 */
export function stripInvisibleParameterPropertiesFromInstanceData(
  data: Record<string, any>,
  instanceSchema: any,
): Record<string, any> {
  if (!data || typeof data !== 'object') return data
  const root = getInstanceSchemaRootForTables(instanceSchema)
  const topProps = root?.properties
  if (!topProps) return { ...data }

  const clone: Record<string, any> = { ...data }
  for (const tableKey of Object.keys(data)) {
    const val = data[tableKey]
    if (val == null || typeof val !== 'object' || Array.isArray(val)) continue
    const tableSchema = topProps[tableKey]
    if (!isParameterTableSchema(tableSchema)) continue
    clone[tableKey] = filterParameterObjectByVisibleProperties(
      val as Record<string, any>,
      tableKey,
      instanceSchema,
    )
  }
  return clone
}

/**
 * Builds `{ id, parameter, value }[]` from master list data for parameter-object diffing.
 */
export function normalizeMasterListToParameterRows(
  masterData: any[],
  masterTableConfig: any,
): any[] {
  if (!masterData?.length) return []

  const rowProps = getListResponseRowProperties(masterTableConfig)?.properties
  const first = masterData[0]

  const keyVisible = (k: string): boolean => {
    if (['id', '_id', 'created_at', 'updated_at'].includes(k)) return false
    if (rowProps?.[k] !== undefined) {
      return isParameterPropertySchemaVisible(rowProps[k])
    }
    return true
  }

  const looksLikeKeyValueRows =
    masterData.length > 1 &&
    first &&
    typeof first === 'object' &&
    ('name' in first || 'parameter' in first || 'key' in first)

  if (looksLikeKeyValueRows) {
    return masterData.map((row, i) => {
      const param = String(row.parameter ?? row.name ?? row.key ?? row.id ?? i)
      const value = row.value ?? row.val
      return { id: param, parameter: param, value }
    })
  }

  if (masterData.length === 1 && first && typeof first === 'object') {
    const row = first as Record<string, any>
    const keys = Object.keys(row).filter(keyVisible)
    return keys.map((k) => ({ id: k, parameter: k, value: row[k] }))
  }

  return masterData.map((row, i) => {
    const param = String(row.parameter ?? row.name ?? row.key ?? row.id ?? i)
    return {
      id: param,
      parameter: param,
      value: row.value ?? row.val ?? row,
    }
  })
}

/**
 * Converts synthetic parameter rows back to a single object for instance.data.
 */
export function parameterRowsToParameterObject(
  rows: any[],
): Record<string, any> {
  const out: Record<string, any> = {}
  if (!Array.isArray(rows)) return out
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue
    const k = row.parameter ?? row.name ?? row.key ?? row.id
    if (k == null) continue
    out[String(k)] = row.value
  }
  return out
}

// ─── JSON schema → automation format ─────────────────────────────────────────

const DEFAULT_GROUPS: Record<string, Record<string, string>> = {
  instance: { en: 'Input data', es: 'Datos de entrada', fr: "Tables d'entrée" },
  solution: {
    en: 'Solution data',
    es: 'Datos de la solución',
    fr: 'Données de la solution',
  },
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
      // Array tables (rows)
      if (tableSchema.type === 'array' && tableSchema.items) {
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
        return
      }

      // Parameter (object-type) tables: single object with properties
      if (isParameterTableSchema(tableSchema)) {
        const objectSchema = convertObjectTablePropertiesToSchema(tableSchema)
        result[tableKey] = {
          group: defaultGroup ? TYPE_TO_GROUP_KEY[type] || null : null,
          title: tableSchema.title || formatTitle(tableKey),
          icon: 'mdi-cog',
          _originalTitle: tableSchema.title || formatTitle(tableKey),
          _originalGroup: defaultGroup,
          isParameterTable: true,
          get_list: {
            url: '',
            http_method: 'GET',
            request_schema: null,
            response_schema: {
              type: 'object',
              properties: objectSchema.properties,
              required: objectSchema.required || [],
            },
          },
        }
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
          is_warning: checkSchema.is_warning === true,
          _originalTitle: checkSchema.title || formatTitle(checkKey),
          _originalGroup: {
            en: 'Validations',
            es: 'Validaciones',
            fr: 'Validations',
          },
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

// ─── Object (parameter) table property conversion ──────────────────────────────

/**
 * Converts an instance/frontend-automation object-type table schema to internal format.
 * Preserves allow_load_from_db so the UI can disable "load from DB" when false.
 */
function convertObjectTablePropertiesToSchema(tableSchema: any): {
  properties: Record<string, any>
  required: string[]
} {
  if (!tableSchema?.properties || typeof tableSchema.properties !== 'object') {
    return { properties: {}, required: [] }
  }
  const properties: any = {}
  Object.entries(tableSchema.properties).forEach(
    ([key, prop]: [string, any]) => {
      if (!isParameterPropertySchemaVisible(prop)) return
      properties[key] = {
        title: prop?.title || formatTitle(key),
        type: normalizeJsonSchemaPropertyTypeForUi(prop),
        ...(isAllowLoadFromDbDisabled(prop) && { allowLoadFromDb: false }),
        _originalTitle: prop?.title || formatTitle(key),
      }
    },
  )
  const requiredRaw = Array.isArray(tableSchema.required)
    ? tableSchema.required
    : []
  return {
    properties,
    required: requiredRaw.filter((k: string) => properties[k] != null),
  }
}

// ─── JSON schema item conversion ─────────────────────────────────────────────

const PRIMITIVE_TYPES = new Set(['string', 'number', 'integer'])

function convertJsonSchemaItemToSchema(itemSchema: any): any {
  if (!itemSchema?.properties) {
    if (itemSchema && PRIMITIVE_TYPES.has(itemSchema.type)) {
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
      if (!isParameterPropertySchemaVisible(prop)) return
      properties[key] = {
        title: prop.title || formatTitle(key),
        type: normalizeJsonSchemaPropertyTypeForUi(prop),
        ...(prop.frontendReadOnly && {
          frontendReadOnly: prop.frontendReadOnly,
        }),
        ...(prop.description && { description: prop.description }),
        ...(prop.minimum !== undefined && { minimum: prop.minimum }),
        ...(prop.maximum !== undefined && { maximum: prop.maximum }),
        ...(hasValidChoices(prop) && { choices: prop.choices }),
        ...(isAllowLoadFromDbDisabled(prop) && { allowLoadFromDb: false }),
        _originalTitle: prop.title || formatTitle(key),
      }
    },
  )

  const requiredRaw = Array.isArray(itemSchema.required)
    ? itemSchema.required
    : []
  return {
    type: 'object',
    properties,
    required: requiredRaw.filter((k: string) => properties[k] != null),
    additionalProperties: itemSchema.additionalProperties ?? false,
    title: itemSchema.title || 'Item',
    _originalTitle: itemSchema.title || 'Item',
  }
}

// ─── Display value → FK ID resolution ────────────────────────────────────────

/**
 * True when `displayValue` equals one of the multilingual `value_none` / `valueNone` labels (e.g. "ALL").
 * Used by form submit resolution and Excel bulk upload FK mapping.
 */
export function displayValueMatchesValueNone(
  displayValue: unknown,
  prop: Record<string, any> | undefined | null,
): boolean {
  if (prop == null || displayValue == null || displayValue === '') return false
  const p = prop as any
  const title = p.valueNone?.title ?? p.value_none?.title
  if (title == null) return false
  const valueNoneTitles =
    typeof title === 'object' && !Array.isArray(title)
      ? Object.values(title)
      : [title]
  if (valueNoneTitles.length === 0) return false
  const dv = String(displayValue).trim().toLowerCase()
  return valueNoneTitles.some(
    (t: unknown) => String(t).trim().toLowerCase() === dv,
  )
}

/** True when `refVal` matches `displayValue` (exact, or case-insensitive for strings). */
function fkRefValueMatchesDisplay(refVal: unknown, displayValue: unknown): boolean {
  if (refVal === displayValue) return true
  return (
    typeof refVal === 'string' &&
    typeof displayValue === 'string' &&
    refVal.trim().toLowerCase() === displayValue.trim().toLowerCase()
  )
}

/**
 * Loads the joined table and writes the resolved FK id into `result` when a
 * matching row is found. Errors are logged and swallowed (FK left untouched).
 */
async function resolveFkIdForDependentField(
  result: Record<string, any>,
  fieldKey: string,
  foreignKeyField: string,
  joinInfo: { table: string; field: string },
  displayValue: unknown,
  loadTableData: (tableName: string) => Promise<any[]>,
): Promise<void> {
  try {
    const tableRows = await loadTableData(joinInfo.table)
    const matchingItem = tableRows.find((item: any) =>
      fkRefValueMatchesDisplay(item[joinInfo.field], displayValue),
    )
    if (matchingItem != null) {
      result[foreignKeyField] = matchingItem[foreignKeyField] ?? matchingItem.id
    }
  } catch (e) {
    console.error(`Resolve display value for ${fieldKey}:`, e)
  }
}

/** Resolve a single dependent field's display value into its FK id, mutating `result`. */
async function resolveDependentFieldFkId(
  result: Record<string, any>,
  fieldKey: string,
  p: any,
  properties: Record<string, any>,
  loadTableData: (tableName: string) => Promise<any[]>,
): Promise<void> {
  const displayValue = result[fieldKey]
  const foreignKeyField = getForeignKeyFieldName(fieldKey, { properties })

  // value_none: display value is the "none" label (e.g. "ALL") → send FK as null, do not resolve
  if (foreignKeyField && displayValueMatchesValueNone(displayValue, p)) {
    result[foreignKeyField] = null
    delete result[fieldKey]
    return
  }

  const isEmptyDisplay =
    displayValue === undefined || displayValue === null || displayValue === ''
  if (isEmptyDisplay) {
    if (foreignKeyField) result[foreignKeyField] = null
    delete result[fieldKey]
    return
  }

  const joinInfo = foreignKeyField ? parseJoinFrom(p.joinFrom) : null
  if (foreignKeyField && joinInfo) {
    await resolveFkIdForDependentField(
      result,
      fieldKey,
      foreignKeyField,
      joinInfo,
      displayValue,
      loadTableData,
    )
  }
  delete result[fieldKey]
}

export async function resolveDisplayValuesToFkIds(
  payload: Record<string, any>,
  tableConfig: any,
  loadTableData: (tableName: string) => Promise<any[]>,
): Promise<Record<string, any>> {
  const properties = getListResponseRowProperties(tableConfig)?.properties
  if (!properties) return { ...payload }

  const result = { ...payload }

  for (const [fieldKey, prop] of Object.entries(properties)) {
    const p = prop
    if (!p?.joinFrom || !p?.isDependentField) continue
    await resolveDependentFieldFkId(result, fieldKey, p, properties, loadTableData)
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

const CONFIG_FIELDS_EXCLUDED_KEYS = new Set(['solver', 'msg'])

interface ExecutionConfigField {
  key: string
  title: string
  placeholder?: string
  suffix?: string
  icon?: string
  type: string
  minutes?: boolean
  default?: unknown
  options?: Array<{ value: string; label: string }>
}

/** Resolves solver list and default from the `solver` schema property. */
function resolveSolverConfig(solverProp: any): {
  executionSolvers: string[]
  defaultSolver: string
} {
  let defaultSolver = 'MIPModel.gurobi'
  let executionSolvers: string[] = ['MIPModel.gurobi']

  if (solverProp && Array.isArray(solverProp.enum) && solverProp.enum.length > 0) {
    executionSolvers = solverProp.enum.map(String)
    defaultSolver =
      solverProp.default == null
        ? executionSolvers[0]
        : String(solverProp.default)
  }

  return { executionSolvers, defaultSolver }
}

/** Applies select-type overrides to `field` when the prop has a non-empty enum. */
function applyEnumOptionsToField(field: ExecutionConfigField, prop: any): void {
  if (Array.isArray(prop.enum) && prop.enum.length > 0) {
    field.type = 'select'
    field.options = prop.enum.map((v: string) => ({
      value: String(v),
      label: String(v),
    }))
    field.icon = DEFAULT_FIELD_ICONS.select
  }
}

/** Applies time-related suffix/icon overrides for numeric time fields. */
function applyTimeFieldOverrides(
  field: ExecutionConfigField,
  prop: any,
  fieldType: string,
  key: string,
): void {
  if (fieldType !== 'number' || !key.toLowerCase().includes('time')) return
  if (key.toLowerCase() === 'timelimit') {
    field.minutes = prop.minutes === true
    field.suffix = field.minutes
      ? 'configParams.minutesSuffix'
      : 'configParams.secondsSuffix'
  } else {
    field.suffix = 'configParams.minutesSuffix'
  }
  field.icon = 'mdi-timer-sand'
}

/** Builds a single config field descriptor from a schema property. */
function buildExecutionConfigField(
  key: string,
  prop: any,
): ExecutionConfigField {
  const schemaType = Array.isArray(prop.type) ? prop.type[0] : prop.type
  const fieldType = SCHEMA_TYPE_TO_FIELD_TYPE[schemaType] || 'text'

  const titleKey = `configParams.${key}`
  const field: ExecutionConfigField = {
    key,
    title: titleKey,
    placeholder: `${titleKey}Placeholder`,
    icon: DEFAULT_FIELD_ICONS[fieldType] || 'mdi-tune',
    type: fieldType,
  }

  if (prop.default !== undefined) field.default = prop.default
  applyEnumOptionsToField(field, prop)
  applyTimeFieldOverrides(field, prop, fieldType, key)

  return field
}

export function getExecutionConfigFromSchemaConfig(schemaConfig: any): {
  solverConfig: { showSolverStep: boolean; defaultSolver: string }
  executionSolvers: string[]
  configFields: ExecutionConfigField[]
} | null {
  if (
    !schemaConfig ||
    typeof schemaConfig !== 'object' ||
    !schemaConfig.properties
  ) {
    return null
  }

  const props = schemaConfig.properties
  const { executionSolvers, defaultSolver } = resolveSolverConfig(props.solver)

  const configFields: ExecutionConfigField[] = []
  for (const [key, prop] of Object.entries(props)) {
    if (!prop || typeof prop !== 'object') continue
    if (CONFIG_FIELDS_EXCLUDED_KEYS.has(key)) continue
    configFields.push(buildExecutionConfigField(key, prop))
  }

  return {
    solverConfig: { showSolverStep: false, defaultSolver },
    executionSolvers,
    configFields,
  }
}

/** JSON Schema `type` may be a string or e.g. `['number', 'null']`. */
function getJsonSchemaTypes(fieldSchema: any): string[] {
  if (!fieldSchema || typeof fieldSchema !== 'object') return []
  const t = fieldSchema.type
  if (typeof t === 'string') return [t]
  if (Array.isArray(t))
    return t.filter((x) => typeof x === 'string')
  return []
}

/**
 * Coerces a single value to match JSON Schema field types (after inline edits often yield strings).
 */
/**
 * Sentinel returned by coercion helpers to signal "no coercion applied" so the
 * caller can fall through to the next type branch (distinct from a real value).
 */
const COERCE_NO_MATCH = Symbol('coerceNoMatch')

const toIntOrFloat = (n: number, isInteger: boolean): number =>
  isInteger ? Math.trunc(n) : n

/** Coerces a string toward number/integer. Returns the sentinel if it doesn't parse. */
function coerceStringToNumeric(
  value: string,
  isInteger: boolean,
  allowsNull: boolean,
): unknown {
  const trimmed = value.trim()
  if (trimmed === '') return allowsNull ? null : value
  const n = isInteger ? Number.parseInt(trimmed, 10) : Number.parseFloat(trimmed)
  return Number.isNaN(n) ? COERCE_NO_MATCH : toIntOrFloat(n, isInteger)
}

/** Coerces a value toward number/integer types. Returns the sentinel if no rule applied. */
function coerceToNumeric(
  value: unknown,
  isInteger: boolean,
  allowsNull: boolean,
): unknown {
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return toIntOrFloat(value, isInteger)
  }
  if (typeof value === 'string') {
    return coerceStringToNumeric(value, isInteger, allowsNull)
  }
  if (typeof value === 'boolean') {
    return value ? 1 : 0
  }
  return COERCE_NO_MATCH
}

/** Coerces a value toward boolean. Returns the sentinel if no rule applied. */
function coerceToBoolean(value: unknown): unknown {
  if (typeof value === 'boolean') return value
  if (value === 'true' || value === '1' || value === 1) return true
  if (value === 'false' || value === '0' || value === 0) return false
  return COERCE_NO_MATCH
}

/** Coerces a value toward string (used when schema declares 'string' and value isn't one). */
function coerceToStringType(value: unknown, allowsNull: boolean): unknown {
  if (value === undefined || value === null) return allowsNull ? null : ''
  return String(value)
}

/** Tries number/integer, then boolean, then string coercion. Sentinel if none applied. */
function coerceByDeclaredTypes(
  value: unknown,
  types: string[],
  allowsNull: boolean,
): unknown {
  if (types.includes('number') || types.includes('integer')) {
    const coerced = coerceToNumeric(value, types.includes('integer'), allowsNull)
    if (coerced !== COERCE_NO_MATCH) return coerced
  }
  if (types.includes('boolean')) {
    const coerced = coerceToBoolean(value)
    if (coerced !== COERCE_NO_MATCH) return coerced
  }
  if (types.includes('string') && typeof value !== 'string') {
    return coerceToStringType(value, allowsNull)
  }
  return COERCE_NO_MATCH
}

export function coerceValueToJsonSchemaField(
  value: unknown,
  fieldSchema: any,
): unknown {
  const types = getJsonSchemaTypes(fieldSchema)
  if (types.length === 0) return value

  const allowsNull = types.includes('null')

  if (allowsNull && (value === '' || value === undefined)) return null
  if (value === null) return null

  const coerced = coerceByDeclaredTypes(value, types, allowsNull)
  return coerced === COERCE_NO_MATCH ? value : coerced
}

function coerceTableRowsByItemsSchema(rows: any[], itemsSchema: any): any[] {
  if (!Array.isArray(rows) || !itemsSchema?.properties) return rows
  const props = itemsSchema.properties as Record<string, any>
  return rows.map((row) => {
    if (row == null || typeof row !== 'object' || Array.isArray(row)) return row
    const next: Record<string, any> = { ...row }
    for (const fieldKey of Object.keys(props)) {
      if (Object.hasOwn(next, fieldKey)) {
        next[fieldKey] = coerceValueToJsonSchemaField(
          next[fieldKey],
          props[fieldKey],
        )
      }
    }
    return next
  })
}

/**
 * Coerces solution `data` object values (per-table row arrays) using the solution JSON Schema,
 * so PUT /execution/…/ validates after Excel-like string edits.
 */
export function coerceSolutionDataBySchema(
  solutionData: Record<string, any>,
  solutionSchema: any,
): Record<string, any> {
  if (
    !solutionData ||
    typeof solutionData !== 'object' ||
    !solutionSchema?.properties
  ) {
    return solutionData
  }
  const top = solutionSchema.properties as Record<string, any>
  const out: Record<string, any> = { ...solutionData }
  for (const key of Object.keys(out)) {
    if (key.startsWith('__')) continue
    const val = out[key]
    if (!Array.isArray(val)) continue
    const tableSchema = top[key]
    const itemsSchema = tableSchema?.items
    if (itemsSchema && typeof itemsSchema === 'object') {
      out[key] = coerceTableRowsByItemsSchema(val, itemsSchema)
    }
  }
  return out
}
