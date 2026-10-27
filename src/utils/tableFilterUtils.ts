/**
 * Utility functions for table filtering and searching
 * Shared between ExecutionDataView and other table components
 */
import type { DataFilter } from '@cornflow-ui/core/components/core/data-table/types'
import { valuePassesFilter } from '@cornflow-ui/core/utils/dataTable'

/**
 * Generate a cryptographically secure unique ID
 * Uses crypto.randomUUID() which is safe for non-security UI purposes
 */
export const generateSecureId = (prefix: string = ''): string => {
  const uuid = crypto.randomUUID().replaceAll('-', '').substring(0, 12)
  return prefix ? `${prefix}_${uuid}` : uuid
}

// Random part of a secure id: 12 lowercase hex chars (see generateSecureId).
const FRONTEND_ROW_ID_SUFFIX = /^(?:\d+_)?[0-9a-f]{12}$/

/**
 * Frontend-only row id for an instance table row: `{tableKey}_{index}_{hex}`
 * or `{tableKey}_{hex}`. Used to track edits/selection; never sent to the
 * backend (see `stripFrontendRowIdsFromInstanceData`).
 */
export const generateFrontendRowId = (
  tableKey: string,
  index?: number,
): string =>
  generateSecureId(index === undefined ? tableKey : `${tableKey}_${index}`)

/**
 * True when `value` was produced by `generateFrontendRowId` for `tableKey`.
 */
export const isFrontendRowId = (value: unknown, tableKey: string): boolean => {
  if (typeof value !== 'string' || !tableKey) return false
  const prefix = `${tableKey}_`
  return (
    value.startsWith(prefix) &&
    FRONTEND_ROW_ID_SUFFIX.test(value.slice(prefix.length))
  )
}

/** A column filter: see `DataFilter`. */
export type FilterCondition = DataFilter

/**
 * Generate a unique filter ID
 */
export const generateFilterId = (): string => {
  return generateSecureId('filter')
}

/**
 * Apply a single filter to an item
 */
export const applyFilterToItem = (item: any, filter: FilterCondition): boolean =>
  valuePassesFilter(item[filter.field], filter)

/**
 * Apply filters and search to a list of items.
 *
 * Hot path on 500k-row tables — every search keystroke after debounce runs
 * this. Two micro-optimisations vs. the naïve `items.filter(search).filter(f1).filter(f2)…`:
 *
 *  1. **Single pass / single allocation.** N+1 chained `.filter()` calls
 *     allocate N+1 intermediate arrays (each up to ~500k entries) and walk
 *     the dataset N+1 times. We collapse search + all column filters into
 *     one predicate so the array is only allocated once.
 *  2. **No `Object.values(item)` per row.** That helper allocates a fresh
 *     array per row just to feed `.some()`. With 500k rows × ~20 columns
 *     that's 500k throwaway allocations per keystroke. A `for…in` loop
 *     reads the same keys without the intermediate array, and we also
 *     pre-lowercase the search term once instead of per cell.
 */
export const applyFiltersAndSearch = (
  items: any[],
  searchValue: string,
  filters: FilterCondition[],
): any[] => {
  const hasSearch = !!searchValue
  const hasFilters = filters.length > 0
  // No-op path: return the input reference. Avoids an O(n) `[...items]` clone
  // (which `.filter()` would do anyway right after) when the user lands on a
  // table with no active search or filters — the common case after a tab
  // switch on a 500k-row solution table.
  if (!hasSearch && !hasFilters) return items

  const lowerSearch = hasSearch ? searchValue.toLowerCase() : ''

  return items.filter((item) => {
    if (hasSearch && !itemMatchesLowerSearch(item, lowerSearch)) return false
    if (hasFilters && !itemMatchesAllFilters(item, filters)) return false
    return true
  })
}

/**
 * True if any of the item's own values contains the (already lower-cased)
 * search term. Walks the keys with `for…in` rather than `Object.values()` so the
 * hot path allocates no array per row.
 */
const itemMatchesLowerSearch = (item: any, lowerSearch: string): boolean => {
  for (const key in item) {
    const value = item[key]
    if (value === null || value === undefined) continue
    if (String(value).toLowerCase().includes(lowerSearch)) return true
  }
  return false
}

/**
 * True if the item satisfies every column filter.
 */
const itemMatchesAllFilters = (
  item: any,
  filters: FilterCondition[],
): boolean => {
  for (const filter of filters) {
    if (!applyFilterToItem(item, filter)) return false
  }
  return true
}

/**
 * Generate headers from data array
 */
export const generateHeadersFromData = (data: any[]): any[] => {
  if (!data || data.length === 0) return []

  const firstItem = data[0]
  return Object.keys(firstItem).map((key) => {
    const value = firstItem[key]
    let type = 'string'

    if (typeof value === 'number') {
      type = Number.isInteger(value) ? 'integer' : 'number'
    } else if (typeof value === 'boolean') {
      type = 'boolean'
    }

    return {
      title: key,
      key: key,
      value: key,
      sortable: true,
      filterable: true,
      type: type,
    }
  })
}
