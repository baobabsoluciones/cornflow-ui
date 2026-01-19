/**
 * useFormFields composable
 *
 * Shared composable for managing form field logic across CoreModal and CoreTable.
 * Provides consistent field type handling, validation, and data loading for both
 * create (modal) and edit (inline) operations.
 *
 * Features:
 * - Field type checking and validation
 * - Foreign key selector loading
 * - Dependent field management
 * - Field value formatting
 * - Consistent behavior between create and edit modes
 */

import { ref, computed } from 'vue'
import type { Ref, ComputedRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { getFieldValidationRules } from '@/utils/validationRules'
import {
  parseJoinFrom,
  getForeignKeyFieldName,
  getDependentFields,
} from '@/utils/schemaUtils'

// Field configuration interface
export interface FieldConfig {
  key?: string
  type:
    | 'string'
    | 'number'
    | 'integer'
    | 'boolean'
    | 'date'
    | 'email'
    | 'textarea'
    | 'selector'
  title?: string
  label?: string
  required?: boolean
  readOnly?: boolean
  placeholder?: string
  min?: number | string
  max?: number | string
  minLength?: number
  maxLength?: number
  pattern?: string
  // Foreign key specific properties
  isForeignKey?: boolean
  isDependentField?: boolean
  isMainSelector?: boolean
  columnsToJoin?: string[]
  joinFrom?: string
  foreignKeyField?: string
  hidden?: boolean
  // Selector options
  options?: Array<{ value: any; text: string }>
  loadingOptions?: boolean
  // Choices for select fields
  choices?: any[]
}

// Props interface for components using this composable
export interface UseFormFieldsProps {
  fields?:
    | ComputedRef<Record<string, FieldConfig> | FieldConfig[]>
    | Ref<Record<string, FieldConfig> | FieldConfig[]>
    | Record<string, FieldConfig>
    | FieldConfig[]
  formData?:
    | ComputedRef<Record<string, any>>
    | Ref<Record<string, any>>
    | Record<string, any>
  mode?: ComputedRef<'add' | 'edit'> | Ref<'add' | 'edit'> | 'add' | 'edit'
  loadTableData?: (tableName: string) => Promise<any[]>
  tableData?:
    | ComputedRef<Record<string, any[]>>
    | Ref<Record<string, any[]>>
    | Record<string, any[]>
}

/**
 * Main composable function
 */
export function useFormFields(props: UseFormFieldsProps) {
  const { t } = useI18n()

  // State for selector options loading
  const selectorOptions = ref<
    Record<string, Array<{ value: any; text: string }>>
  >({})
  const loadingSelectorOptions = ref<Record<string, boolean>>({})

  /**
   * Get fields value (unwrap if computed)
   */
  const getFields = () => {
    if (!props.fields) return []
    // Unwrap computed ref if necessary
    return 'value' in props.fields ? props.fields.value : props.fields
  }

  /**
   * Get formData value (unwrap if computed)
   */
  const getFormData = () => {
    if (!props.formData) return {}
    // Unwrap computed ref if necessary
    return 'value' in props.formData ? props.formData.value : props.formData
  }

  /**
   * Get mode value (unwrap if computed)
   */
  const getMode = (): 'add' | 'edit' => {
    if (!props.mode) return 'add'
    // Unwrap computed ref if necessary
    return typeof props.mode === 'object' && 'value' in props.mode
      ? props.mode.value
      : props.mode
  }

  /**
   * Get tableData value (unwrap if computed)
   */
  const getTableData = () => {
    if (!props.tableData) return {}
    // Unwrap computed ref if necessary
    return 'value' in props.tableData ? props.tableData.value : props.tableData
  }

  /**
   * Computed: Get visible fields (filter out hidden and foreign key fields)
   */
  const visibleFields = computed(() => {
    const filtered: Record<string, FieldConfig> = {}
    const fields = getFields()

    if (!fields) return filtered

    // Handle Array format
    if (Array.isArray(fields)) {
      fields.forEach((field) => {
        if (
          field &&
          field.key &&
          field.key !== 'id' &&
          !field.hidden &&
          !field.isForeignKey // Hide fields with columns_to_join (foreign key IDs)
        ) {
          // Show all fields except hidden ones
          // readOnly fields should be visible but disabled
          filtered[field.key] = field
        }
      })
    }
    // Handle Object format
    else if (typeof fields === 'object') {
      Object.entries(fields).forEach(([key, field]) => {
        if (
          field &&
          key !== 'id' &&
          !field.hidden &&
          !field.isForeignKey // Hide fields with columns_to_join (foreign key IDs)
        ) {
          // Show all fields except hidden ones
          // readOnly fields should be visible but disabled
          // Ensure field.key is set to the object key for consistency
          filtered[key] = {
            ...field,
            key: field.key || key,
          }
        }
      })
    }

    return filtered
  })

  /**
   * Check if field type is text-based
   */
  const isTextType = (
    type: string | undefined,
    field?: FieldConfig,
  ): boolean => {
    if (!type) return false
    // Don't treat selector fields as text fields
    if (field && isSelectorType(field)) return false
    return ['string', 'email'].includes(type)
  }

  /**
   * Check if field type is number-based
   */
  const isNumberType = (
    type: string | undefined,
    field?: FieldConfig,
  ): boolean => {
    if (!type) return false
    // Don't treat selector fields (including fields with choices) as number fields
    if (field && isSelectorType(field)) return false
    return ['number', 'integer'].includes(type)
  }

  /**
   * Check if field is a selector type (foreign key selector or choices field)
   */
  const isSelectorType = (field: FieldConfig | undefined): boolean => {
    if (!field) return false
    // Check for foreign key selector
    if (
      field.type === 'selector' ||
      (field.isDependentField === true && field.isMainSelector === true)
    ) {
      return true
    }
    // Check for choices field
    if (
      field.choices &&
      Array.isArray(field.choices) &&
      field.choices.length > 0
    ) {
      return true
    }
    // Check for boolean type (always a selector with Yes/No)
    if (field.type === 'boolean') {
      return true
    }
    return false
  }

  /**
   * Get input type for HTML input element
   */
  const getInputType = (fieldType: string | undefined): string => {
    if (!fieldType) return 'text'
    switch (fieldType) {
      case 'email':
        return 'email'
      case 'number':
      case 'integer':
        return 'number'
      default:
        return 'text'
    }
  }

  /**
   * Get field validation rules
   */
  const getFieldRules = (
    field: FieldConfig | undefined,
  ): Array<(v: any) => boolean | string> => {
    if (!field) return []

    return getFieldValidationRules(
      {
        type: field.type,
        required: field.required,
        min: field.min,
        max: field.max,
        minLength: field.minLength,
        maxLength: field.maxLength,
        pattern: field.pattern,
      },
      t,
    )
  }

  /**
   * Format field name to readable label
   */
  const formatFieldName = (key: string): string => {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase())
      .trim()
  }

  /**
   * Format cell value for display
   */
  const formatCellValue = (value: any, type: string): string => {
    if (value === null || value === undefined) return ''

    switch (type) {
      case 'boolean':
        return value ? 'True' : 'False'
      case 'number':
      case 'integer':
        return typeof value === 'number' ? value.toString() : String(value)
      case 'date':
        return formatDate(value)
      default:
        return String(value)
    }
  }

  /**
   * Format date for display
   */
  const formatDate = (dateString: string): string => {
    if (!dateString) return ''
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString()
    } catch (error) {
      return dateString
    }
  }

  /**
   * Get field columns for responsive layout
   * Returns 12 (full width) for all fields on small screens
   */
  const getFieldCols = (): number => 12

  /**
   * Get field md breakpoint columns
   */
  const getFieldMd = (field: FieldConfig | undefined): number => {
    if (!field) return 6
    if (field.type === 'boolean') return 6
    if (field.type === 'textarea') return 12
    return 6
  }

  /**
   * Get options for choices fields (including boolean special case)
   */
  const getChoicesOptions = (
    field: FieldConfig,
  ): Array<{ value: any; text: string }> => {
    if (!field) return []

    // Handle boolean type - always show Yes/No
    if (field.type === 'boolean') {
      return [
        { value: true, text: t('table.yes') },
        { value: false, text: t('table.no') },
      ]
    }

    // Handle choices - convert to options array (show values as-is)
    if (
      field.choices &&
      Array.isArray(field.choices) &&
      field.choices.length > 0
    ) {
      return field.choices.map((choice) => ({
        value: choice,
        text: String(choice),
      }))
    }

    return []
  }

  /**
   * Load options for selector fields (foreign keys)
   */
  const loadSelectorOptions = async (fieldKey: string, field: FieldConfig) => {
    // If field has choices, use getChoicesOptions instead
    if (
      field.choices &&
      Array.isArray(field.choices) &&
      field.choices.length > 0
    ) {
      selectorOptions.value[fieldKey] = getChoicesOptions(field)
      return
    }

    // If field is boolean, use getChoicesOptions
    if (field.type === 'boolean') {
      selectorOptions.value[fieldKey] = getChoicesOptions(field)
      return
    }

    // Otherwise, load from foreign key table
    if (!field.joinFrom || !props.loadTableData) return

    const joinInfo = parseJoinFrom(field.joinFrom)
    if (!joinInfo) return

    loadingSelectorOptions.value[fieldKey] = true

    try {
      // Check if we already have the data
      const tableDataValue = getTableData()
      if (tableDataValue && tableDataValue[joinInfo.table]) {
        const options = tableDataValue[joinInfo.table].map((item) => ({
          value: item[joinInfo.field],
          text: item[joinInfo.field],
        }))
        selectorOptions.value[fieldKey] = options
      } else {
        // Load data from API
        const data = await props.loadTableData(joinInfo.table)
        const options = data.map((item) => ({
          value: item[joinInfo.field],
          text: item[joinInfo.field],
        }))
        selectorOptions.value[fieldKey] = options
      }
    } catch (error) {
      console.error(`Error loading options for ${fieldKey}:`, error)
      selectorOptions.value[fieldKey] = []
    } finally {
      loadingSelectorOptions.value[fieldKey] = false
    }
  }

  /**
   * Helper: Get fields as a record (normalize array to object)
   */
  const normalizeFields = (): Record<string, FieldConfig> => {
    const fieldsValue = getFields()
    if (!fieldsValue) return {}
    
    return Array.isArray(fieldsValue)
      ? fieldsValue.reduce(
          (acc, field) => ({ ...acc, [field.key || '']: field }),
          {},
        )
      : fieldsValue
  }

  /**
   * Helper: Update dependent fields from a matching item
   */
  const updateColumnsFromMatch = (
    formData: Record<string, any>,
    fields: Record<string, FieldConfig>,
    columnsToJoin: string[],
    matchingItem: any,
    excludeKey?: string,
  ): void => {
    columnsToJoin.forEach((columnKey: string) => {
      if (columnKey === excludeKey) return
      
      const dependentFieldConfig = fields[columnKey]
      if (!dependentFieldConfig?.isDependentField) return
      
      const depJoinInfo = parseJoinFrom(dependentFieldConfig.joinFrom || '')
      if (depJoinInfo && matchingItem[depJoinInfo.field] !== undefined) {
        formData[columnKey] = matchingItem[depJoinInfo.field]
      }
    })
  }

  /**
   * Update dependent fields when a selector field changes
   */
  const updateDependentFields = (
    changedFieldKey: string,
    newValue: any,
    formData: Record<string, any>,
  ): Record<string, any> => {
    const fields = normalizeFields()
    const changedField = fields[changedFieldKey]
    if (!changedField) return formData

    const tableDataValue = getTableData()
    const joinInfo = parseJoinFrom(changedField.joinFrom || '')
    if (!joinInfo) return formData

    const tableData = tableDataValue?.[joinInfo.table] || []

    // Case 1: Changed field is a main selector field
    if (changedField.isDependentField && changedField.isMainSelector) {
      const foreignKeyField = changedField.foreignKeyField
      if (!foreignKeyField) return formData

      const matchingItem = tableData.find((item) => item[joinInfo.field] === newValue)
      if (!matchingItem) return formData

      formData[foreignKeyField] = matchingItem.id

      const foreignKeyFieldConfig = fields[foreignKeyField]
      if (foreignKeyFieldConfig?.columnsToJoin) {
        updateColumnsFromMatch(
          formData, 
          fields, 
          foreignKeyFieldConfig.columnsToJoin, 
          matchingItem, 
          changedFieldKey
        )
      }
    }
    // Case 2: Changed field is a foreign key field
    else if (changedField.isForeignKey && changedField.columnsToJoin) {
      const matchingItem = tableData.find((item) => item.id === newValue)
      if (matchingItem) {
        updateColumnsFromMatch(formData, fields, changedField.columnsToJoin, matchingItem)
      }
    }

    return formData
  }

  /**
   * Filter out dependent fields from form data before submission
   * Only send foreign key fields (columns_to_join), not display fields (join_from)
   */
  const filterDependentFields = (
    formData: Record<string, any>,
  ): Record<string, any> => {
    const fields = normalizeFields()
    const filtered: Record<string, any> = {}

    Object.entries(formData).forEach(([key, value]) => {
      const field = fields[key]
      // Only include fields that are NOT dependent fields
      // Dependent fields are only for display, the actual data is in the foreign key fields
      if (!field || !field.isDependentField) {
        filtered[key] = value
      }
    })

    return filtered
  }

  /**
   * Helper: Convert value to integer
   */
  const toInteger = (value: any): number => {
    const result = typeof value === 'number' ? Math.floor(value) : parseInt(String(value), 10)
    return isNaN(result) ? 0 : result
  }

  /**
   * Helper: Convert value to number (float)
   */
  const toNumber = (value: any): number => {
    const result = typeof value === 'number' ? value : parseFloat(String(value))
    return isNaN(result) ? 0 : result
  }

  /**
   * Helper: Convert value to boolean
   */
  const toBoolean = (value: any): boolean => {
    if (typeof value === 'boolean') return value
    if (typeof value === 'string') return value.toLowerCase() === 'true' || value === '1'
    return Boolean(value)
  }

  /**
   * Helper: Convert a single value based on field type
   */
  const convertValueByType = (value: any, fieldType: string): any => {
    switch (fieldType) {
      case 'integer':
        return toInteger(value)
      case 'number':
        return toNumber(value)
      case 'boolean':
        return toBoolean(value)
      default:
        return value
    }
  }

  /**
   * Convert form data values to their correct types based on field configuration
   */
  const convertFormDataTypes = (
    formData: Record<string, any>,
  ): Record<string, any> => {
    const fields = normalizeFields()
    const convertedData: Record<string, any> = {}

    Object.entries(formData).forEach(([key, value]) => {
      if (value === null || value === undefined) {
        convertedData[key] = value
        return
      }

      const fieldType = fields[key]?.type
      convertedData[key] = fieldType ? convertValueByType(value, fieldType) : value
    })

    return convertedData
  }

  /**
   * Prepare form data for submission
   * - Convert types (integer, number, boolean)
   * - Filter out dependent fields
   * - Exclude id field for create operations
   * - Keep id for edit operations (handled by parent)
   */
  const prepareFormDataForSubmit = (
    formData: Record<string, any>,
    mode: 'add' | 'edit' = 'add',
  ): Record<string, any> => {
    // First, convert types
    let data = convertFormDataTypes(formData)

    // Then, filter out dependent fields
    data = filterDependentFields(data)

    // For edit mode, exclude id (will be passed separately to PUT endpoint)
    if (mode === 'edit') {
      const { id, ...dataWithoutId } = data
      return dataWithoutId
    }

    // For add mode, also exclude id if it exists
    const { id, ...dataWithoutId } = data
    return dataWithoutId
  }

  /**
   * Get field type from field configuration or infer from value
   */
  const getFieldType = (
    fieldKey: string,
    fields: FieldConfig[] | Record<string, FieldConfig>,
    items?: any[],
  ): string => {
    // Try to get type from field configuration
    let field: FieldConfig | undefined

    if (Array.isArray(fields)) {
      field = fields.find((f) => f.key === fieldKey)
    } else {
      field = fields[fieldKey]
    }

    if (field?.type) {
      return field.type === 'integer' ? 'number' : field.type
    }

    // Fallback: try to infer from data
    if (items && items.length > 0) {
      const sampleValue = items[0][fieldKey]
      if (typeof sampleValue === 'boolean') return 'boolean'
      if (typeof sampleValue === 'number') return 'number'
    }

    return 'string'
  }

  return {
    // Computed properties
    visibleFields,
    selectorOptions,
    loadingSelectorOptions,

    // Type checking functions
    isTextType,
    isNumberType,
    isSelectorType,
    getInputType,
    getFieldType,

    // Validation functions
    getFieldRules,

    // Formatting functions
    formatFieldName,
    formatCellValue,
    formatDate,

    // Layout functions
    getFieldCols,
    getFieldMd,

    // Data loading functions
    loadSelectorOptions,
    getChoicesOptions,

    // Data manipulation functions
    updateDependentFields,
    filterDependentFields,
    prepareFormDataForSubmit,
  }
}
