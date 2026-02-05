import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGeneralStore } from '@/stores/general'

/** Key for the single column when validation data is array of strings (shown as alert list) */
const VALIDATION_MESSAGE_FIELD = 'message'

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

  // Get table data from execution
  const tableData = computed(() => {
    if (!selectedExecution.value || !tableKey.value) return []

    try {
      let executionData
      if (executionType.value === 'instance') {
        executionData =
          selectedExecution.value.experiment?.instance ||
          selectedExecution.value.instance
      } else if (executionType.value === 'solution') {
        executionData =
          selectedExecution.value.experiment?.solution ||
          selectedExecution.value.solution
      }

      if (!executionData) return []

      // Choose data source based on table type
      let dataSource
      if (isValidationTable.value) {
        // For validation tables, look in dataChecks
        dataSource = executionData.dataChecks
      } else {
        // For regular tables, look in data
        dataSource = executionData.data
      }

      if (!dataSource) return []

      const data = dataSource[tableKey.value]

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
          readOnly: true,
        },
      ]
    }

    if (!tableConfig.value?.get_list?.response_schema?.items?.properties)
      return []

    const properties =
      tableConfig.value.get_list.response_schema.items.properties
    return Object.entries(properties).map(
      ([key, prop]: [string, any]) => ({
        title: prop.title || key,
        value: key,
        key: key,
        sortable: true,
        filterable: true,
        type: prop.type === 'integer' ? 'number' : prop.type,
        required:
          tableConfig.value.get_list.response_schema.items.required?.includes(
            key,
          ) || false,
        readOnly: prop.readOnly || false,
        choices: prop.choices || undefined,
      }),
    )
  })

  // Get available filter fields from headers
  const availableFilterFields = computed(() => {
    return headers.value.map((header) => ({
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
        items.value = data
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
