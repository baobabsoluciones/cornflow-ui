import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGeneralStore } from '@/stores/general'
import {
  getListResponseRowProperties,
  normalizeGetListResponseToRows,
  isParameterPropertySchemaVisible,
  normalizeJsonSchemaPropertyTypeForUi,
} from '@/utils/schemaUtils'

/** Key for the single column when validation data is array of strings (shown as alert list) */
const VALIDATION_MESSAGE_FIELD = 'message'

/**
 * Ensures every row has an `id` property using a deterministic index-based scheme.
 * Execution data often lacks explicit IDs; without them CoreTable editing,
 * selection, and row identification break.
 * The same function is exported so `applyPendingChangesToData` can assign
 * matching IDs before reconciling staged changes.
 */
export function ensureItemIds(rows: any[]): any[] {
  if (!Array.isArray(rows) || rows.length === 0) return rows
  const needsId = rows.some((r) => r.id == null)
  if (!needsId) return rows
  return rows.map((row, index) => {
    if (row.id != null) return row
    return { ...row, id: `__row_${index}` }
  })
}

/**
 * Composable for handling execution data (instance/solution) tables
 * This is used when we have table configurations but the data comes from execution objects
 * rather than API endpoints
 */
export function useExecutionTableData(
  tableKey: any,
  tableConfig: any,
  executionType: any,
) {
  const generalStore = useGeneralStore()
  const { t } = useI18n()

  // State
  const loading = ref(false)
  const items = ref<any[]>([])
  const error = ref<string | null>(null)

  // Get the selected execution
  const selectedExecution = computed(() => generalStore.selectedExecution)

  // Check if this is a validation table
  const isValidationTable = computed(() => {
    const group = tableConfig.value?.group
    if (!group) return false

    // Check for validation group in different languages
    const validationGroups = [
      'validations',
      'Validations',
      'Validaciones',
      'validaciones',
    ]
    return validationGroups.includes(group)
  })

  // Validation messages (array of strings): we show as alert list, so report false to use CoreTable in list mode
  const isValidationMessageList = computed(
    () => isValidationTable.value && !!tableConfig.value?.isPrimitiveArray,
  )

  // For validation message list we use CoreTable in alert-list mode; for other primitives keep SimpleList
  const isPrimitiveArray = computed(() => {
    if (isValidationMessageList.value) return false
    return tableConfig.value?.isPrimitiveArray || false
  })

  const getExecutionDataByType = (execution: any, type: string) => {
    if (type === 'instance') {
      return execution.experiment?.instance || execution.instance
    }
    if (type === 'solution') {
      return execution.experiment?.solution || execution.solution
    }
    return undefined
  }

  // Get table data from execution
  const tableData = computed(() => {
    if (!selectedExecution.value || !tableKey.value) return []

    try {
      const executionData = getExecutionDataByType(
        selectedExecution.value,
        executionType.value,
      )

      if (!executionData) return []

      let data: any

      if (isValidationTable.value) {
        const dataChecks = executionData.dataChecks
        if (!dataChecks) return []
        data = dataChecks[tableKey.value]
      } else if (tableConfig.value?._isFromRawKpis) {
        const rawKpis = executionData.rawKpis
        if (!rawKpis || typeof rawKpis !== 'object') return []
        const sourceKey =
          tableConfig.value._rawKpisSourceKey ?? tableKey.value
        data = rawKpis[sourceKey]
      } else {
        const ds = executionData.data
        if (!ds) return []
        data = ds[tableKey.value]
      }

      if (tableConfig.value) {
        return normalizeGetListResponseToRows(data, tableConfig.value)
      }
      return Array.isArray(data) ? data : []
    } catch (err) {
      console.error('Error getting table data:', err)
      return []
    }
  })

  // Get table headers from schema (or single column for validation message list)
  const headers = computed(() => {
    if (isValidationMessageList.value) {
      return [
        {
          title: t('table.validationMessageColumn'),
          value: VALIDATION_MESSAGE_FIELD,
          key: VALIDATION_MESSAGE_FIELD,
          sortable: true,
          filterable: true,
          type: 'string',
          required: false,
          frontendReadOnly: true,
        },
      ]
    }

    const rowSchema = getListResponseRowProperties(tableConfig.value)
    if (!rowSchema) return []

    const properties = rowSchema.properties
    const requiredList = rowSchema.required
    return Object.entries(properties)
      .filter(([, prop]) => isParameterPropertySchemaVisible(prop))
      .map(([key, prop]: [string, any]) => ({
        title: prop.title || key,
        value: key,
        key: key,
        sortable: true,
        filterable: true,
        type: normalizeJsonSchemaPropertyTypeForUi(prop),
        required: requiredList.includes(key) || false,
        frontendReadOnly: prop.frontendReadOnly || false,
        choices: prop.choices || undefined,
      }))
  })

  // Keep filter fields aligned with visible table columns.
  const availableFilterFields = computed(() => {
    return headers.value
      .filter(
        (header) =>
          header.value !== 'selection' &&
          header.filterable &&
          !header.hidden &&
          !header.isForeignKey &&
          !(header.columnsToJoin && Array.isArray(header.columnsToJoin)),
      )
      .map((header) => ({
        key: header.key || header.value,
        title: header.title,
        type: header.type,
        filterable: header.filterable,
      }))
  })

  // Table title
  const tableTitle = computed(() => {
    return tableConfig.value?.title || tableKey.value || 'Table'
  })

  // Load data function (normalize validation message list to [{ id, message }])
  const loadData = async () => {
    if (!tableKey.value || !selectedExecution.value) {
      items.value = []
      return
    }

    loading.value = true
    error.value = null

    try {
      const data = tableData.value
      if (isValidationMessageList.value && Array.isArray(data)) {
        items.value = data.map((item: unknown, index: number) => ({
          id: index,
          [VALIDATION_MESSAGE_FIELD]: String(item),
        }))
      } else {
        items.value = ensureItemIds(data)
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error'
      items.value = []
    } finally {
      loading.value = false
    }
  }

  // Watch for changes in table key and reload data
  watch(
    [tableKey, selectedExecution],
    () => {
      loadData()
    },
    { immediate: true },
  )

  return {
    loading,
    items,
    error,
    headers,
    availableFilterFields,
    tableTitle,
    isPrimitiveArray,
    isValidationMessageList,

    hasData: computed(() => items.value.length > 0),

    loadData,
    refresh: loadData,
  }
}
