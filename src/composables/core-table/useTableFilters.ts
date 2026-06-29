import { ref, computed } from 'vue'
import type { ComputedRef } from 'vue'
import { generateSecureId } from '@cornflow-ui/core/utils/tableFilterUtils'
import { getListResponseRowProperties } from '@cornflow-ui/core/utils/schemaUtils'

// Filter types based on field types
export type FilterOperator =
  | 'is'
  | 'is_not'
  | 'contains'
  | 'has_any_value'
  | 'is_greater_than'
  | 'is_less_than'
  | 'is_between'
  | 'is_greater_than_or_equal'
  | 'is_less_than_or_equal'

export interface FilterCondition {
  id: string
  field: string
  operator: FilterOperator
  value: any
  value2?: any // For "between" operations
}

export interface FilterField {
  key: string
  title: string
  type: 'string' | 'number' | 'integer' | 'boolean' | 'date'
  filterable?: boolean
  // Foreign key properties
  isForeignKey?: boolean
  isDependentField?: boolean
  isMainSelector?: boolean
  joinFrom?: string
  columnsToJoin?: string[]
  foreignKeyField?: string
  hidden?: boolean
  frontendReadOnly?: boolean
}

export interface FilterGroup {
  id: string
  conditions: FilterCondition[]
  logic: 'AND' | 'OR'
}

export function useTableFilters<T extends Record<string, any>>(
  items: ComputedRef<T[]>,
  tableConfig: ComputedRef<any>,
  $t?: (key: string) => string,
) {
  // Filter state
  const showFilterModal = ref(false)
  const activeFilters = ref<FilterCondition[]>([])
  const filterGroups = ref<FilterGroup[]>([])

  // Get available fields for filtering from table config
  const availableFields = computed((): FilterField[] => {
    if (!tableConfig.value) return []

    const fields: FilterField[] = []

    // Get fields from response schema (get_list operation)
    const rowSchema = getListResponseRowProperties(tableConfig.value)
    if (rowSchema?.properties) {
      const properties = rowSchema.properties

      Object.entries(properties).forEach(([key, prop]: [string, any]) => {
        // Skip id and frontendReadOnly fields for filtering
        if (key === 'id' || prop.frontendReadOnly) return

        fields.push({
          key,
          title: prop.title || formatFieldTitle(key),
          type: mapSchemaTypeToFilterType(prop.type),
        })
      })
    }

    return fields.sort((a, b) => a.title.localeCompare(b.title))
  })

  // Get available operators for a field type
  const getOperatorsForFieldType = (fieldType: string): FilterOperator[] => {
    switch (fieldType) {
      case 'string':
        return ['is', 'is_not', 'contains', 'has_any_value']
      case 'number':
      case 'integer':
        return [
          'is',
          'is_not',
          'is_greater_than',
          'is_less_than',
          'is_between',
          'is_greater_than_or_equal',
          'is_less_than_or_equal',
          'has_any_value',
        ]
      case 'boolean':
        return ['is', 'is_not']
      case 'date':
        return [
          'is',
          'is_not',
          'is_greater_than',
          'is_less_than',
          'is_between',
          'has_any_value',
        ]
      default:
        return ['is', 'is_not', 'contains', 'has_any_value']
    }
  }

  // Get operator display text
  const getOperatorText = (operator: FilterOperator): string => {
    if ($t) {
      // Use translations if available
      return $t(`table.filters.operators.${operator}`)
    }

    // Fallback to English if no translation function provided
    const operatorTexts: Record<FilterOperator, string> = {
      is: 'is',
      is_not: 'is not',
      contains: 'contains',
      has_any_value: 'has any value',
      is_greater_than: 'is greater than',
      is_less_than: 'is less than',
      is_between: 'is between',
      is_greater_than_or_equal: 'is greater than or equal to',
      is_less_than_or_equal: 'is less than or equal to',
    }
    return operatorTexts[operator] || operator
  }

  // Check if operator needs value input
  const operatorNeedsValue = (operator: FilterOperator): boolean => {
    return operator !== 'has_any_value'
  }

  // Check if operator needs second value (for between)
  const operatorNeedsSecondValue = (operator: FilterOperator): boolean => {
    return operator === 'is_between'
  }

  // Apply filters to items
  const filteredItems = computed(() => {
    if (activeFilters.value.length === 0) {
      return items.value
    }

    return items.value.filter((item) => {
      return activeFilters.value.every((filter) => {
        return evaluateFilterCondition(item, filter)
      })
    })
  })

  // Evaluate a single filter condition
  const evaluateFilterCondition = (
    item: T,
    condition: FilterCondition,
  ): boolean => {
    const fieldValue = item[condition.field]
    const { operator, value, value2 } = condition

    // Get field type for proper comparison
    const field = availableFields.value.find((f) => f.key === condition.field)
    const fieldType = field?.type || 'string'

    switch (operator) {
      case 'is':
        return compareValues(fieldValue, value, fieldType)

      case 'is_not':
        return !compareValues(fieldValue, value, fieldType)

      case 'contains':
        if (typeof fieldValue === 'string' && typeof value === 'string') {
          return fieldValue.toLowerCase().includes(value.toLowerCase())
        }
        return false

      case 'has_any_value':
        return (
          fieldValue != null && fieldValue !== '' && fieldValue !== undefined
        )

      case 'is_greater_than':
        return Number(fieldValue) > Number(value)

      case 'is_less_than':
        return Number(fieldValue) < Number(value)

      case 'is_greater_than_or_equal':
        return Number(fieldValue) >= Number(value)

      case 'is_less_than_or_equal':
        return Number(fieldValue) <= Number(value)

      case 'is_between': {
        const numValue = Number(fieldValue)
        const minValue = Number(value)
        const maxValue = Number(value2)
        return numValue >= minValue && numValue <= maxValue
      }

      default:
        return true
    }
  }

  // Helper function to compare values based on field type
  const compareValues = (
    fieldValue: any,
    filterValue: any,
    fieldType: string,
  ): boolean => {
    // Handle null/undefined cases
    if (fieldValue == null && filterValue == null) return true
    if (fieldValue == null || filterValue == null) return false

    switch (fieldType) {
      case 'number':
      case 'integer': {
        // Convert both to numbers for comparison
        const numFieldValue = Number(fieldValue)
        const numFilterValue = Number(filterValue)
        // Handle NaN cases
        if (Number.isNaN(numFieldValue) || Number.isNaN(numFilterValue))
          return false
        return numFieldValue === numFilterValue
      }

      case 'boolean': {
        // Convert both to boolean for comparison
        const boolFieldValue = Boolean(fieldValue)
        const boolFilterValue = Boolean(filterValue)
        return boolFieldValue === boolFilterValue
      }

      case 'string':
      default:
        // For strings, convert both to string and compare
        return String(fieldValue) === String(filterValue)
    }
  }

  // Add a new filter
  const addFilter = (condition: FilterCondition) => {
    activeFilters.value.push(condition)
  }

  // Remove a filter
  const removeFilter = (filterId: string) => {
    activeFilters.value = activeFilters.value.filter((f) => f.id !== filterId)
  }

  // Clear all filters
  const clearAllFilters = () => {
    activeFilters.value = []
  }

  // Update a filter
  const updateFilter = (
    filterId: string,
    updates: Partial<FilterCondition>,
  ) => {
    const index = activeFilters.value.findIndex((f) => f.id === filterId)
    if (index !== -1) {
      activeFilters.value[index] = { ...activeFilters.value[index], ...updates }
    }
  }

  // Generate unique filter ID
  const generateFilterId = (): string => {
    return generateSecureId('filter')
  }

  // Create a new empty filter condition
  const createEmptyFilter = (): FilterCondition => {
    const firstField = availableFields.value[0]
    const firstOperator = firstField
      ? getOperatorsForFieldType(firstField.type)[0]
      : 'is'

    return {
      id: generateFilterId(),
      field: firstField?.key || '',
      operator: firstOperator,
      value: '',
      value2: undefined,
    }
  }

  // Open filter modal
  const openFilterModal = () => {
    showFilterModal.value = true
  }

  // Close filter modal
  const closeFilterModal = () => {
    showFilterModal.value = false
  }

  // Get active filters count
  const activeFiltersCount = computed(() => activeFilters.value.length)

  // Check if filters are active
  const hasActiveFilters = computed(() => activeFiltersCount.value > 0)

  return {
    // State
    showFilterModal,
    activeFilters,
    filterGroups,

    // Computed
    availableFields,
    filteredItems,
    activeFiltersCount,
    hasActiveFilters,

    // Methods
    getOperatorsForFieldType,
    getOperatorText,
    operatorNeedsValue,
    operatorNeedsSecondValue,
    addFilter,
    removeFilter,
    clearAllFilters,
    updateFilter,
    generateFilterId,
    createEmptyFilter,
    openFilterModal,
    closeFilterModal,
    evaluateFilterCondition,
  }
}

// Helper functions
function mapSchemaTypeToFilterType(
  schemaType: string,
): 'string' | 'number' | 'integer' | 'boolean' | 'date' {
  switch (schemaType) {
    case 'integer':
      return 'integer'
    case 'number':
      return 'number'
    case 'boolean':
      return 'boolean'
    case 'string':
    default:
      return 'string'
  }
}

function formatFieldTitle(key: string): string {
  return key
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
