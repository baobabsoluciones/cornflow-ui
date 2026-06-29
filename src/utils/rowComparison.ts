/**
 * Pure value-normalization and row-difference helpers extracted from
 * DataComparisonModal.vue. The allowed (schema) columns are injected so
 * `areRowsDifferent` does not depend on component props.
 */

import {
  resolveComparableLowercasedKeys,
  buildLowercasedKeyMap,
} from '@/utils/schemaUtils'

/** Normalize a string for comparison: numeric strings -> numbers, true/false -> booleans, '' -> null. */
export function normalizeStringValue(value: string): any {
  const trimmed = value.trim()
  if (trimmed === '') return null

  // Using non-capturing group to avoid ReDoS vulnerability
  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) {
    const num = Number.parseFloat(trimmed)
    if (!Number.isNaN(num)) {
      return Number.isInteger(num) ? num : Math.round(num * 1000000) / 1000000
    }
  }

  const lowerTrimmed = trimmed.toLowerCase()
  if (lowerTrimmed === 'true') return true
  if (lowerTrimmed === 'false') return false

  return trimmed
}

/** Normalize a number for comparison (NaN -> null, rounds to 6 decimals). */
export function normalizeNumberValue(value: number): number | null {
  if (Number.isNaN(value)) return null
  return Number.isInteger(value) ? value : Math.round(value * 1000000) / 1000000
}

/**
 * Normalize a value for comparison, coercing strings/numbers, trimming strings,
 * stringifying objects, and mapping empty/nullish to null.
 */
export function normalizeValue(value: any): any {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'string') return normalizeStringValue(value)
  if (typeof value === 'number') return normalizeNumberValue(value)
  if (typeof value === 'boolean') return value
  if (typeof value === 'object') return JSON.stringify(value)
  return value
}

/**
 * Returns true when two rows differ on any comparable column (after
 * normalization), considering only `allowedColumns` and skipping `excludedKeys`.
 */
export function areRowsDifferent(
  row1: any,
  row2: any,
  allowedColumns: string[] | null | undefined,
  excludedKeys: Set<string> = new Set(),
): boolean {
  const map1 = buildLowercasedKeyMap(row1)
  const map2 = buildLowercasedKeyMap(row2)
  const keysLower = resolveComparableLowercasedKeys({
    row1,
    row2,
    allowedColumns,
    excludedKeys,
  })

  for (const key of keysLower) {
    const val1 = normalizeValue(map1.get(key))
    const val2 = normalizeValue(map2.get(key))

    if (val1 === null && val2 === null) continue
    if (val1 === null || val2 === null) return true
    if (val1 !== val2) return true
  }

  return false
}
