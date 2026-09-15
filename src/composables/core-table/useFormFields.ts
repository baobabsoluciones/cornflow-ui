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
import { getFieldValidationRules } from '@cornflow-ui/core/utils/validationRules'
import { parseJoinFrom } from '@cornflow-ui/core/utils/schemaUtils'
import { resolveTitleWithLocale } from '@cornflow-ui/core/utils/i18nUtils'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface FieldConfig {
  key?: string
  type:
    | 'string'
    | 'number'
    | 'integer'
    | 'boolean'
    | 'date'
    | 'datetime'
    | 'time'
    | 'email'
    | 'textarea'
    | 'selector'
  title?: string
  label?: string
  required?: boolean
  frontendReadOnly?: boolean
  placeholder?: string
  min?: number | string
  max?: number | string
  minLength?: number
  maxLength?: number
  pattern?: string
  /** Schema format for string (e.g. date, date-time, time) when type is date/datetime/time */
  format?: string
  isForeignKey?: boolean
  isDependentField?: boolean
  isMainSelector?: boolean
  columnsToJoin?: string[]
  joinFrom?: string
  foreignKeyField?: string
  hidden?: boolean
  visible?: boolean
  /** When set, the selector shows this option first; selecting it sends null for the FK. Title can be string or multilingual. */
  valueNone?: { title: string | Record<string, string> }
  options?: Array<{ value: any; text: string }>
  loadingOptions?: boolean
  choices?: any[]
}

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

// ─── Ref unwrap helper ───────────────────────────────────────────────────────

function unwrapRef<T>(
  value: ComputedRef<T> | Ref<T> | T | undefined | null,
  fallback: T,
): T {
  if (value === undefined || value === null) return fallback
  if (typeof value === 'object' && value !== null && 'value' in value) {
    return (value as Ref<T>).value
  }
  return value as T
}

// ─── Date/time type sets ─────────────────────────────────────────────────────

const DATE_TIME_TYPES = new Set(['date', 'datetime', 'time'])
const TEXT_TYPES = new Set(['string', 'email'])
const NUMERIC_TYPES = new Set(['number', 'integer'])

// ─── Input type mapping ──────────────────────────────────────────────────────

const FIELD_TYPE_TO_INPUT: Record<string, string> = {
  email: 'email',
  number: 'number',
  integer: 'number',
  date: 'date',
  datetime: 'datetime-local',
  time: 'time',
}

// ─── Main composable ────────────────────────────────────────────────────────

export function useFormFields(props: UseFormFieldsProps) {
  const { t, locale } = useI18n()

  const selectorOptions = ref<
    Record<string, Array<{ value: any; text: string }>>
  >({})
  const loadingSelectorOptions = ref<Record<string, boolean>>({})

  // ── Unwrap accessors ────────────────────────────────────────────────────

  const getFields = () => unwrapRef(props.fields, [] as FieldConfig[])
  const getTableData = () =>
    unwrapRef(props.tableData, {} as Record<string, any[]>)

  // ── Visible fields ──────────────────────────────────────────────────────

  const visibleFields = computed(() => {
    const fields = getFields()
    if (!fields) return {} as Record<string, FieldConfig>

    const entries: [string, FieldConfig][] = Array.isArray(fields)
      ? fields
          .filter((f) => f?.key)
          .map((f) => [f.key, f] as [string, FieldConfig])
      : Object.entries(fields).map(
          ([key, f]) =>
            [key, { ...f, key: f.key || key }] as [string, FieldConfig],
        )

    const filtered: Record<string, FieldConfig> = {}
    for (const [key, field] of entries) {
      if (
        key !== 'id' &&
        !field.hidden &&
        field.visible !== false &&
        !field.isForeignKey
      ) {
        filtered[key] = field
      }
    }
    return filtered
  })

  // ── Type checking ───────────────────────────────────────────────────────

  const isTextType = (
    type: string | undefined,
    field?: FieldConfig,
  ): boolean => {
    if (!type) return false
    if (field && isSelectorType(field)) return false
    if (DATE_TIME_TYPES.has(type)) return false
    return TEXT_TYPES.has(type)
  }

  const isNumberType = (
    type: string | undefined,
    field?: FieldConfig,
  ): boolean => {
    if (!type) return false
    if (field && isSelectorType(field)) return false
    return NUMERIC_TYPES.has(type)
  }

  const isSelectorType = (field: FieldConfig | undefined): boolean => {
    if (!field) return false
    if (field.type === 'selector') return true
    if (field.isDependentField && field.isMainSelector) return true
    if (field.type === 'boolean') return true
    return Array.isArray(field.choices) && field.choices.length > 0
  }

  const getInputType = (fieldType: string | undefined): string => {
    if (!fieldType) return 'text'
    return FIELD_TYPE_TO_INPUT[fieldType] || 'text'
  }

  // ── Validation ──────────────────────────────────────────────────────────

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

  // ── Formatting ──────────────────────────────────────────────────────────

  const formatFieldName = (key: string): string => {
    return key
      .replaceAll(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase())
      .trim()
  }

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
      case 'datetime':
        return formatDateTime(value)
      case 'time':
        return formatTime(value)
      default:
        return String(value)
    }
  }

  const formatDateTime = (value: any): string => {
    if (value == null || value === '') return ''
    const str = String(value)
    try {
      const d = new Date(str)
      if (Number.isNaN(d.getTime())) return str
      return d.toLocaleString(undefined, {
        dateStyle: 'short',
        timeStyle: 'short',
      })
    } catch {
      return str
    }
  }

  const formatTime = (value: any): string => {
    if (value == null || value === '') return ''
    const str = String(value)
    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(str)) return str
    try {
      const d = new Date(`1970-01-01T${str}`)
      if (Number.isNaN(d.getTime())) return str
      return d.toTimeString().slice(0, 8)
    } catch {
      return str
    }
  }

  const formatDate = (dateString: string): string => {
    if (!dateString) return ''
    try {
      return new Date(dateString).toLocaleDateString()
    } catch {
      return dateString
    }
  }

  // ── Layout ──────────────────────────────────────────────────────────────

  const getFieldCols = (): number => 12

  const getFieldMd = (field: FieldConfig | undefined): number => {
    if (!field) return 6
    if (field.type === 'textarea') return 12
    return 6
  }

  // ── Selector / choices options ──────────────────────────────────────────

  const getChoicesOptions = (
    field: FieldConfig,
  ): Array<{ value: any; text: string }> => {
    if (!field) return []
    if (field.type === 'boolean') {
      return [
        { value: true, text: t('table.yes') },
        { value: false, text: t('table.no') },
      ]
    }
    if (Array.isArray(field.choices) && field.choices.length > 0) {
      return field.choices.map((choice) => ({
        value: choice,
        text: String(choice),
      }))
    }
    return []
  }

  const hasLocalOptions = (field: FieldConfig): boolean =>
    field.type === 'boolean' ||
    (Array.isArray(field.choices) && field.choices.length > 0)

  const loadSelectorOptions = async (fieldKey: string, field: FieldConfig) => {
    if (hasLocalOptions(field)) {
      selectorOptions.value[fieldKey] = getChoicesOptions(field)
      return
    }

    if (!field.joinFrom || !props.loadTableData) return

    const joinInfo = parseJoinFrom(field.joinFrom)
    if (!joinInfo) return

    loadingSelectorOptions.value[fieldKey] = true

    try {
      const tableDataValue = getTableData()
      const rows =
        tableDataValue?.[joinInfo.table] ??
        (await props.loadTableData(joinInfo.table))

      const options = rows.map((item) => ({
        value: item[joinInfo.field],
        text: item[joinInfo.field],
      }))
      if (field.valueNone?.title) {
        const currentLocale = locale?.value ?? 'en'
        const noneText =
          typeof field.valueNone.title === 'string'
            ? field.valueNone.title
            : resolveTitleWithLocale(field.valueNone.title, currentLocale, '')
        selectorOptions.value[fieldKey] = [
          { value: null, text: noneText },
          ...options,
        ]
      } else {
        selectorOptions.value[fieldKey] = options
      }
    } catch (error) {
      console.error(`Error loading options for ${fieldKey}:`, error)
      selectorOptions.value[fieldKey] = []
    } finally {
      loadingSelectorOptions.value[fieldKey] = false
    }
  }

  // ── Field normalization ─────────────────────────────────────────────────

  const normalizeFields = (): Record<string, FieldConfig> => {
    const fieldsValue = getFields()
    if (!fieldsValue) return {}
    return Array.isArray(fieldsValue)
      ? fieldsValue.reduce(
          (acc, field) => ({ ...acc, [field.key || '']: field }),
          {} as Record<string, FieldConfig>,
        )
      : fieldsValue
  }

  // ── Dependent field updates ─────────────────────────────────────────────

  const updateColumnsFromMatch = (
    formData: Record<string, any>,
    fields: Record<string, FieldConfig>,
    columnsToJoin: string[],
    matchingItem: any,
    excludeKey?: string,
  ): void => {
    for (const columnKey of columnsToJoin) {
      if (columnKey === excludeKey) continue

      const dependentFieldConfig = fields[columnKey]
      if (!dependentFieldConfig?.isDependentField) continue

      const depJoinInfo = parseJoinFrom(dependentFieldConfig.joinFrom || '')
      if (depJoinInfo && matchingItem[depJoinInfo.field] !== undefined) {
        formData[columnKey] = matchingItem[depJoinInfo.field]
      }
    }
  }

  const handleMainSelectorUpdate = (
    changedFieldKey: string,
    newValue: any,
    formData: Record<string, any>,
    fields: Record<string, any>,
    changedField: any,
    joinInfo: { table: string; field: string },
    tableRows: any[],
  ): Record<string, any> => {
    const foreignKeyField = changedField.foreignKeyField
    if (!foreignKeyField) return formData

    if (newValue === null && changedField.valueNone?.title) {
      formData[foreignKeyField] = null
      const currentLocale = locale?.value ?? 'en'
      formData[changedFieldKey] =
        typeof changedField.valueNone.title === 'string'
          ? changedField.valueNone.title
          : resolveTitleWithLocale(changedField.valueNone.title, currentLocale, '')
      return formData
    }

    const matchingItem = tableRows.find((item) => item[joinInfo.field] === newValue)
    if (!matchingItem) return formData

    formData[foreignKeyField] = matchingItem[foreignKeyField] ?? matchingItem.id

    const foreignKeyFieldConfig = fields[foreignKeyField]
    if (foreignKeyFieldConfig?.columnsToJoin) {
      updateColumnsFromMatch(formData, fields, foreignKeyFieldConfig.columnsToJoin, matchingItem, changedFieldKey)
    }

    return formData
  }

  const handleForeignKeyUpdate = (
    newValue: any,
    formData: Record<string, any>,
    fields: Record<string, any>,
    changedField: any,
    tableRows: any[],
  ): Record<string, any> => {
    const matchingItem = tableRows.find((item) => item.id === newValue)
    if (matchingItem) {
      updateColumnsFromMatch(formData, fields, changedField.columnsToJoin, matchingItem)
    }
    return formData
  }

  const updateDependentFields = (
    changedFieldKey: string,
    newValue: any,
    formData: Record<string, any>,
  ): Record<string, any> => {
    const fields = normalizeFields()
    const changedField = fields[changedFieldKey]
    if (!changedField) return formData

    const joinInfo = parseJoinFrom(changedField.joinFrom || '')
    if (!joinInfo) return formData

    const tableRows = getTableData()?.[joinInfo.table] || []

    if (changedField.isDependentField && changedField.isMainSelector) {
      return handleMainSelectorUpdate(changedFieldKey, newValue, formData, fields, changedField, joinInfo, tableRows)
    } else if (changedField.isForeignKey && changedField.columnsToJoin) {
      return handleForeignKeyUpdate(newValue, formData, fields, changedField, tableRows)
    }

    return formData
  }

  // ── Submission helpers ──────────────────────────────────────────────────

  const filterDependentFields = (
    formData: Record<string, any>,
  ): Record<string, any> => {
    const fields = normalizeFields()
    const filtered: Record<string, any> = {}

    for (const [key, value] of Object.entries(formData)) {
      if (!fields[key]?.isDependentField) {
        filtered[key] = value
      }
    }
    return filtered
  }

  const isTempId = (value: any): boolean =>
    typeof value === 'string' && value.startsWith('create-')

  const toInteger = (value: any): number => {
    const result =
      typeof value === 'number'
        ? Math.floor(value)
        : Number.parseInt(String(value), 10)
    return Number.isNaN(result) ? 0 : result
  }

  const toNumber = (value: any): number => {
    const result =
      typeof value === 'number' ? value : Number.parseFloat(String(value))
    return Number.isNaN(result) ? 0 : result
  }

  const toBoolean = (value: any): boolean => {
    if (typeof value === 'boolean') return value
    if (typeof value === 'string')
      return value.toLowerCase() === 'true' || value === '1'
    return Boolean(value)
  }

  const convertValueByType = (value: any, fieldType: string): any => {
    if (isTempId(value)) return value
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

  const convertFormDataTypes = (
    formData: Record<string, any>,
  ): Record<string, any> => {
    const fields = normalizeFields()
    const converted: Record<string, any> = {}

    for (const [key, value] of Object.entries(formData)) {
      if (value === null || value === undefined) {
        converted[key] = value
        continue
      }
      const fieldType = fields[key]?.type
      converted[key] = fieldType ? convertValueByType(value, fieldType) : value
    }
    return converted
  }

  const prepareFormDataForSubmit = (
    formData: Record<string, any>,
    _mode: 'add' | 'edit' = 'add',
    options?: { keepDependentFields?: boolean },
  ): Record<string, any> => {
    let data = convertFormDataTypes(formData)
    if (!options?.keepDependentFields) {
      data = filterDependentFields(data)
    }
    const { id: _id, ...dataWithoutId } = data
    return dataWithoutId
  }

  // ── Field type inference ────────────────────────────────────────────────

  const getFieldType = (
    fieldKey: string,
    fields: FieldConfig[] | Record<string, FieldConfig>,
    items?: any[],
  ): string => {
    const field = Array.isArray(fields)
      ? fields.find((f) => f.key === fieldKey)
      : fields[fieldKey]

    if (field?.type) {
      return field.type === 'integer' ? 'number' : field.type
    }

    if (items?.length) {
      const sampleValue = items[0][fieldKey]
      if (typeof sampleValue === 'boolean') return 'boolean'
      if (typeof sampleValue === 'number') return 'number'
    }

    return 'string'
  }

  // ── Public API ──────────────────────────────────────────────────────────

  return {
    visibleFields,
    selectorOptions,
    loadingSelectorOptions,

    isTextType,
    isNumberType,
    isSelectorType,
    getInputType,
    getFieldType,

    getFieldRules,

    formatFieldName,
    formatCellValue,
    formatDate,

    getFieldCols,
    getFieldMd,

    loadSelectorOptions,
    getChoicesOptions,

    updateDependentFields,
    filterDependentFields,
    prepareFormDataForSubmit,
  }
}
