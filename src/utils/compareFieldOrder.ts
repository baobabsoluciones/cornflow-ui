/**
 * Pure helpers that decide which compare-display fields to show and in what
 * order. Extracted from DataComparisonModal.vue; the instance schema columns
 * are injected via `allowedColumns` instead of read from props.
 */

const IGNORED_COMPARE_DISPLAY_FIELDS = new Set(['id', '_id', 'created_at', 'updated_at'])

/** True when a field should be hidden from the compare display (ignored or excluded). */
export function shouldSkipCompareDisplayKey(key: string, excluded: Set<string>): boolean {
  const lower = key.toLowerCase()
  if (IGNORED_COMPARE_DISPLAY_FIELDS.has(lower)) return true
  for (const e of excluded) {
    if (e.toLowerCase() === lower) return true
  }
  return false
}

/**
 * Restrict the label map to the instance schema columns when provided, adding
 * any schema columns not yet present. Mutates `labelByLower` in place.
 */
export function restrictLabelsToSchema(
  labelByLower: Map<string, string>,
  excluded: Set<string>,
  allowedColumns: string[] | null | undefined,
): void {
  if (!allowedColumns || allowedColumns.length === 0) {
    return
  }
  const allowedLower = new Set(allowedColumns.map((k) => k.toLowerCase()))
  for (const lower of Array.from(labelByLower.keys())) {
    if (!allowedLower.has(lower)) labelByLower.delete(lower)
  }
  for (const k of allowedColumns) {
    const lower = k.toLowerCase()
    if (!shouldSkipCompareDisplayKey(k, excluded) && !labelByLower.has(lower)) {
      labelByLower.set(lower, k)
    }
  }
}

/**
 * Order labels by priority (keyFields > headerKeys > the rest alphabetically),
 * deduplicating by lowercased form.
 */
export function orderLabelsByPriority(
  labelByLower: Map<string, string>,
  headerKeys: string[],
  keyFields: string[],
): string[] {
  const ordered: string[] = []
  const usedLower = new Set<string>()
  const tryPush = (key: string) => {
    const lower = key.toLowerCase()
    if (usedLower.has(lower)) return
    if (!labelByLower.has(lower)) return
    ordered.push(labelByLower.get(lower))
    usedLower.add(lower)
  }
  for (const f of keyFields) tryPush(f)
  for (const k of headerKeys) tryPush(k)
  const rest: string[] = []
  labelByLower.forEach((label, lower) => {
    if (!usedLower.has(lower)) rest.push(label)
  })
  rest.sort((a, b) => a.localeCompare(b))
  ordered.push(...rest)
  return ordered
}

/**
 * Builds the ordered list of field labels to display for a modified row,
 * deduplicating case-variant columns and honoring the schema column set.
 */
export function buildOrderedFieldKeys(
  instanceRow: Record<string, any>,
  masterRow: Record<string, any>,
  excluded: Set<string>,
  headerKeys: string[],
  keyFields: string[],
  allowedColumns: string[] | null | undefined,
): string[] {
  // Track keys by their lowercased form so columns differing only in case are
  // deduplicated. Preserve the first original-case label seen (instance > master
  // > schema/header > keyField).
  const labelByLower = new Map<string, string>()
  const addKey = (k: string) => {
    if (shouldSkipCompareDisplayKey(k, excluded)) return
    const lower = k.toLowerCase()
    if (!labelByLower.has(lower)) labelByLower.set(lower, k)
  }

  for (const k of Object.keys(instanceRow)) addKey(k)
  for (const k of Object.keys(masterRow)) addKey(k)

  restrictLabelsToSchema(labelByLower, excluded, allowedColumns)

  return orderLabelsByPriority(labelByLower, headerKeys, keyFields)
}
