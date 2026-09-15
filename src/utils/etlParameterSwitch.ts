/**
 * Pure helpers for ETL parameter-switch handling, extracted from
 * ExecutionDataView.vue so the logic can be unit-tested in isolation.
 *
 * These functions only operate on their arguments (no component state):
 * - {@link resolveEtlParamKey} derives the `parameterSwitches` key for a cell.
 * - {@link resolveReuploadedParameterSwitchValue} maps a reuploaded-table
 *   toggle to its `parameterSwitches` value.
 * - {@link applyEtlParameterSwitch} writes the resolved value onto the flow.
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
 * Writes the resolved switch value onto `etlFlow.parameterSwitches[paramKey]`.
 * For non-reuploaded tables the single "From DB" toggle maps ON -> false
 * (from DB) and OFF -> true (fixed). For reuploaded tables the value is
 * derived from the specific field via {@link resolveReuploadedParameterSwitchValue}.
 */
export function applyEtlParameterSwitch(
  etlFlow: any,
  paramKey: string,
  fieldKey: string,
  newValue: any,
  isReuploaded: boolean,
): void {
  if (!isReuploaded) {
    // Single column: toggling "From DB" switch
    // ON = from DB (false in parameterSwitches), OFF = fixed (true in parameterSwitches)
    etlFlow.parameterSwitches[paramKey] = !newValue
    return
  }

  const value = resolveReuploadedParameterSwitchValue(fieldKey, newValue)
  if (value === undefined) return
  etlFlow.parameterSwitches[paramKey] = value
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
 * After a manual value edit, flips the matching "from DB" switch (stored as
 * `false`) back to fixed (`true`). Resolves the key first; if that fails,
 * falls back to the first matching normalized-table + row candidate.
 */
export function turnOffEtlParameterFromDbSwitchAfterManualValueEdit(
  flow: { parameterSwitches: Record<string, any> },
  tableKey: string,
  rowId: string | number,
): void {
  const switches = flow.parameterSwitches
  const key = resolveEtlParameterSwitchKey(flow, tableKey, rowId)
  if (key != null) {
    if (switches[key] === false) switches[key] = true
    return
  }
  const rowKey = String(rowId)
  const rowKeyLower = rowKey.toLowerCase()
  const normTable = normalizeTableNameForLookup(tableKey)
  const candidates = Object.keys(switches).filter((k) => {
    const dot = k.lastIndexOf('.')
    if (dot < 0) return false
    const rk = k.slice(dot + 1)
    if (rk !== rowKey && rk.toLowerCase() !== rowKeyLower) return false
    return normalizeTableNameForLookup(k.slice(0, dot)) === normTable
  })
  for (const k of candidates) {
    if (switches[k] === false) {
      switches[k] = true
      return
    }
  }
}
