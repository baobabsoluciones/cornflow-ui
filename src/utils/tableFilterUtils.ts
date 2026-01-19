/**
 * Utility functions for table filtering and searching
 * Shared between ExecutionDataView and other table components
 */

/**
 * Generate a cryptographically secure unique ID
 * Uses crypto.randomUUID() which is safe for non-security UI purposes
 */
export const generateSecureId = (prefix: string = ''): string => {
  const uuid = crypto.randomUUID().replace(/-/g, '').substring(0, 12)
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
 * Get available operators for a field type
 */
export const getOperatorsForFieldType = (fieldType: string): string[] => {
  switch (fieldType) {
    case 'string':
      return ['is', 'is_not', 'contains', 'has_any_value']
    case 'number':
    case 'integer':
      return ['is', 'is_not', 'is_between', 'has_any_value']
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
      const numValue = Number(fieldValue)
      const numFilter1 = Number(filterValue)
      const numFilter2 = Number(filterValue2)
      return numValue >= numFilter1 && numValue <= numFilter2
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
 * Apply filters and search to a list of items
 */
export const applyFiltersAndSearch = (
  items: any[],
  searchValue: string,
  filters: FilterCondition[],
): any[] => {
  let filteredItems = [...items]

  // Apply search
  if (searchValue) {
    filteredItems = filteredItems.filter((item) =>
      itemMatchesSearch(item, searchValue),
    )
  }

  // Apply filters
  filters.forEach((filter) => {
    filteredItems = filteredItems.filter((item) =>
      applyFilterToItem(item, filter),
    )
  })

  return filteredItems
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
