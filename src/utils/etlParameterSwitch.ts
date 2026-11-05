/**
 * Pure helpers for ETL parameter-switch handling, extracted from
 * ExecutionDataView.vue so the logic can be unit-tested in isolation.
 *
 * These functions only operate on their arguments (no component state):
 * - {@link resolveEtlParamKey} derives the `parameterSwitches` key for a cell.
 * - {@link resolveReuploadedParameterSwitchValue} maps a reuploaded-table
 *   toggle to its `parameterSwitches` value.
 * - {@link etlParameterSwitchValue} gives the value a switch column toggle sets.
 * - {@link fromDbParameterSwitchKey} finds the "from DB" switch a manual edit fixes.
 */

/**
 * Resolves the `parameterSwitches` key for an edited cell, or null when the
 * field is not an ETL parameter switch.
 */
export function resolveEtlParamKey(
  table: any,
  row: any,
  tableKey: string,
  rowId: string | number,
  fieldKey: string,
): string | null {
  if (table?.isParameterTableVertical) {
    return `${tableKey}.${rowId}`
  }
  if (
    fieldKey === '__etl_default__' ||
    fieldKey === '__etl_from_db__' ||
    fieldKey === '__etl_fixed__'
  ) {
    const paramName = row.name ?? row.ID ?? row.key
    if (paramName == null) return null
    return `${tableKey}.${paramName}`
  }
  return null
}

/**
 * Mutual exclusion: activating one option sets the value; deactivating falls
 * back to default. Returns the parameterSwitches value, or `undefined` for
 * unknown field keys (no change).
 */
export function resolveReuploadedParameterSwitchValue(
  fieldKey: string,
  newValue: any,
): boolean | null | undefined {
  switch (fieldKey) {
    case '__etl_default__':
      return newValue ? null : false
    case '__etl_from_db__':
      return newValue ? false : null
    case '__etl_fixed__':
      return newValue ? true : null
    default:
      return undefined
  }
}

/**
 * The `parameterSwitches` value a toggle in the switch columns sets. For non-reuploaded tables
 * the single "From DB" toggle maps ON -> false (from DB) and OFF -> true (fixed). For reuploaded
 * tables the value is derived from the specific field via
 * {@link resolveReuploadedParameterSwitchValue}; `undefined` for unknown field keys.
 */
export function etlParameterSwitchValue(
  fieldKey: string,
  newValue: any,
  isReuploaded: boolean,
): boolean | null | undefined {
  if (!isReuploaded) return !newValue
  return resolveReuploadedParameterSwitchValue(fieldKey, newValue)
}

/**
 * Normalizes a table name to match `instance.data` keys (snake_case, spaces,
 * camelCase, etc.). Empty input yields an empty string.
 */
export function normalizeTableNameForLookup(name: string): string {
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
 * Maps a UI tableKey + param row id to its `parameterSwitches` key. The
 * metadata may use a different table-name casing, so this tries (in order):
 * exact match, case-insensitive full match, normalized-table + matching row,
 * and finally a unique row-suffix match. Returns null when none resolves.
 */
export function resolveEtlParameterSwitchKey(
  flow: { parameterSwitches: Record<string, any> },
  tableKey: string,
  rowId: string | number,
): string | null {
  const switches = flow.parameterSwitches
  const rowKey = String(rowId)
  const rowKeyLower = rowKey.toLowerCase()
  const primary = `${tableKey}.${rowKey}`
  if (primary in switches) return primary

  const ciFull = Object.keys(switches).find(
    (k) => k.toLowerCase() === primary.toLowerCase(),
  )
  if (ciFull) return ciFull

  const normTable = normalizeTableNameForLookup(tableKey)
  const found = Object.keys(switches).find((k) => {
    const dot = k.lastIndexOf('.')
    if (dot < 0) return false
    const rk = k.slice(dot + 1)
    if (rk !== rowKey && rk.toLowerCase() !== rowKeyLower) return false
    return normalizeTableNameForLookup(k.slice(0, dot)) === normTable
  })
  if (found) return found

  const bySuffix = Object.keys(switches).filter((k) => {
    const dot = k.lastIndexOf('.')
    if (dot < 0) return false
    const rk = k.slice(dot + 1)
    return rk === rowKey || rk.toLowerCase() === rowKeyLower
  })
  if (bySuffix.length === 1) return bySuffix[0]

  return null
}

/**
 * The "from DB" switch (stored as `false`) a manual value edit turns to fixed. Null when the
 * parameter has no switch ({@link resolveEtlParameterSwitchKey}) or it is not from DB.
 */
export function fromDbParameterSwitchKey(
  flow: { parameterSwitches: Record<string, any> },
  tableKey: string,
  rowId: string | number,
): string | null {
  const key = resolveEtlParameterSwitchKey(flow, tableKey, rowId)
  return key != null && flow.parameterSwitches[key] === false ? key : null
}
