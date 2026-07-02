/**
 * Utility functions for table filtering and searching
 * Shared between ExecutionDataView and other table components
 */

/**
 * Generate a cryptographically secure unique ID
 * Uses crypto.randomUUID() which is safe for non-security UI purposes
 */
export const generateSecureId = (prefix: string = ''): string => {
  const uuid = crypto.randomUUID().replaceAll('-', '').substring(0, 12)
  return prefix ? `${prefix}_${uuid}` : uuid
}

export interface FilterCondition {
  id: string
  field: string
  operator: string
  value: string
  value2?: string
}

/**
 * Column type for filter UI: JSON Schema often uses `type: string` with `format: date` or `date-time`.
 */
export function getFilterFieldTypeFromSchemaProperty(prop: {
  type?: string
  format?: string
}): string {
  if (!prop) return 'string'
  if (prop.format === 'date') return 'date'
  if (prop.format === 'date-time' || prop.format === 'datetime') {
    return 'date-time'
  }
  if (prop.type === 'integer') return 'number'
  return prop.type || 'string'
}

/** Date columns use only a Desde/Hasta range in the filter panel (no is/contains operators). */
export function isDateLikeFieldType(fieldType: string): boolean {
  return (
    fieldType === 'date' ||
    fieldType === 'date-time' ||
    fieldType === 'datetime'
  )
}

/**
 * Get available operators for a field type
 */
export const getOperatorsForFieldType = (fieldType: string): string[] => {
  switch (fieldType) {
    case 'string':
      return ['is', 'is_not', 'contains', 'has_any_value']
    case 'number':
    case 'integer':
      return ['is', 'is_not', 'is_between', 'has_any_value']
    case 'date':
    case 'date-time':
    case 'datetime':
      return ['is_between']
    case 'boolean':
      return ['is', 'is_not']
    default:
      return ['is', 'is_not', 'has_any_value']
  }
}

/**
 * Get translated text for an operator
 */
export const getOperatorText = (
  operator: string,
  t: (key: string) => string,
): string => {
  const operatorTexts: Record<string, string> = {
    is: t('table.filters.operators.is'),
    is_not: t('table.filters.operators.is_not'),
    contains: t('table.filters.operators.contains'),
    is_between: t('table.filters.operators.is_between'),
    has_any_value: t('table.filters.operators.has_any_value'),
  }
  return operatorTexts[operator] || operator
}

/**
 * Check if operator needs a value
 */
export const operatorNeedsValue = (operator: string): boolean => {
  return operator !== 'has_any_value'
}

/**
 * Check if operator needs a second value (for ranges)
 */
export const operatorNeedsSecondValue = (operator: string): boolean => {
  return operator === 'is_between'
}

/**
 * Generate a unique filter ID
 */
export const generateFilterId = (): string => {
  return generateSecureId('filter')
}

const applyIsBetweenFilter = (
  raw: any,
  a: any,
  b: any,
): boolean => {
  const n = Number(raw)
  const n1 = Number(a)
  const n2 = Number(b)
  if (!Number.isNaN(n) && !Number.isNaN(n1) && !Number.isNaN(n2) && String(raw).trim() !== '') {
    return n >= n1 && n <= n2
  }
  const sv = String(raw ?? '')
  const s1 = String(a ?? '').trim()
  const s2 = String(b ?? '').trim()
  if (!s1 && !s2) return true
  if (s1 && s2) return sv >= s1 && sv <= s2
  return s1 ? sv >= s1 : sv <= s2
}

/**
 * Apply a single filter to an item
 */
export const applyFilterToItem = (
  item: any,
  filter: FilterCondition,
): boolean => {
  const fieldValue = item[filter.field]
  const filterValue = filter.value
  const filterValue2 = filter.value2

  switch (filter.operator) {
    case 'is':
      return String(fieldValue) === String(filterValue)
    case 'is_not':
      return String(fieldValue) !== String(filterValue)
    case 'contains':
      return String(fieldValue)
        .toLowerCase()
        .includes(String(filterValue).toLowerCase())
    case 'is_between':
      return applyIsBetweenFilter(fieldValue, filterValue, filterValue2)
    case 'has_any_value':
      return (
        fieldValue !== null && fieldValue !== undefined && fieldValue !== ''
      )
    default:
      return true
  }
}

/**
 * Apply search term to an item
 */
export const itemMatchesSearch = (item: any, searchTerm: string): boolean => {
  if (!searchTerm) return true

  const lowerSearchTerm = searchTerm.toLowerCase()
  return Object.values(item).some((value) => {
    if (value === null || value === undefined) return false
    return String(value).toLowerCase().includes(lowerSearchTerm)
  })
}

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
 * search term. Mirrors `itemMatchesSearch` but avoids the per-row
 * `Object.values()` allocation on the hot path.
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
