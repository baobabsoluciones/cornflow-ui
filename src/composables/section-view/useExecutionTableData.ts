import { ref, computed, watch } from 'vue'
import { useGeneralStore } from '@/stores/general'

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

  // Check if this is a primitive array (list of strings)
  const isPrimitiveArray = computed(() => {
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

  // Get table headers from schema
  const headers = computed(() => {
    if (!tableConfig.value?.get_list?.response_schema?.items?.properties)
      return []

    const properties =
      tableConfig.value.get_list.response_schema.items.properties
    const headers = Object.entries(properties).map(
      ([key, prop]: [string, any]) => ({
        title: prop.title || key,
        value: key,
        key: key, // Add key property for CoreTable compatibility
        sortable: true,
        filterable: true,
        type: prop.type === 'integer' ? 'number' : prop.type,
        required:
          tableConfig.value.get_list.response_schema.items.required?.includes(
            key,
          ) || false,
        readOnly: prop.readOnly || false,
        // Choices property
        choices: prop.choices || undefined,
      }),
    )

    return headers
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

  // Load data function
  const loadData = async () => {
    if (!tableKey.value || !selectedExecution.value) {
      items.value = []
      return
    }

    loading.value = true
    error.value = null

    try {
      const data = tableData.value
      items.value = data
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

  // Return reactive data and methods
  return {
    // State
    loading,
    items,
    error,
    headers,
    availableFilterFields,
    tableTitle,
    isPrimitiveArray,

    // Computed
    hasData: computed(() => items.value.length > 0),

    // Methods
    loadData,
    refresh: loadData,
  }
}
