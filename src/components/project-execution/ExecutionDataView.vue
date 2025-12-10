<template>
  <div class="execution-data-view">
    <!-- Check Data Button-->
    <div v-if="canCheckData" class="check-data-button-container">
      <v-btn
        @click="handleCheckData"
        variant="outlined"
        prepend-icon="mdi-play"
        :disabled="checksLaunched && !checksFinished"
        size="small"
      >
        {{ $t('projectExecution.steps.step5.check') }}
      </v-btn>
    </div>

    <!-- Alerts Section -->
    <div v-if="checksFinished && !hasValidationErrors" class="alert-section">
      <v-alert
        class="mb-2 alert-text-size"
        color="green"
        elevation="2"
        icon="mdi-check"
        density="compact"
      >
        {{ $t('inputOutputData.dataChecksPassedMessage') }}
      </v-alert>
    </div>

    <div v-if="isLoadingChecks" class="alert-section">
      <v-alert
        class="mb-2 alert-text-size"
        color="blue"
        elevation="2"
        icon="mdi-alert"
        density="compact"
      >
        <v-progress-circular
          indeterminate
          color="white"
          size="14"
          class="mr-2"
        ></v-progress-circular>
        {{ $t('inputOutputData.dataChecksLoadingMessage') }}
      </v-alert>
    </div>

    <div v-if="checksError" class="alert-section">
      <v-alert
        class="mb-2 alert-text-size"
        color="error"
        elevation="2"
        icon="mdi-alert-circle"
        density="compact"
      >
        {{ $t('inputOutputData.dataChecksFailedMessage') }}
      </v-alert>
    </div>

    <!-- Instance data tables display -->
    <div v-if="instanceTables.length > 0" class="data-tables-container">
      <!-- Multiple tables with tabs -->
      <div class="multiple-tables-view">
        <v-card class="table-card">
          <CoreTabs v-model="selectedTabIndex" color="primary">
            <CoreTab
              v-for="(table, index) in instanceTables"
              :key="table.key"
              :value="index"
            >
              {{ table.title }}
            </CoreTab>
          </CoreTabs>

          <v-card-text class="table-card-content">
            <CoreTable
              :items="currentTable.items"
              :headers="currentTable.headers"
              :table-title="currentTable.title"
              :loading="false"
              :elevation="0"
              :enable-search="true"
              :enable-filters="true"
              :enable-selection="!readOnly && !currentTable.isValidationTable"
              :enable-actions="!readOnly && !currentTable.isValidationTable"
              :enable-bulk-actions="
                !readOnly && !currentTable.isValidationTable
              "
              :can-add="!readOnly && !currentTable.isValidationTable"
              :can-edit="!readOnly && !currentTable.isValidationTable"
              :can-delete="!readOnly && !currentTable.isValidationTable"
              :can-bulk-upload="false"
              :can-download-excel="false"
              :search-value="currentTableState.searchValue"
              :active-filters="currentTableState.activeFilters"
              :available-filter-fields="currentTable.headers"
              :selected-items="selectedItems"
              :show-add-edit-modal="showAddEditModal"
              :show-delete-dialog="showDeleteDialog"
              :show-bulk-delete-dialog="showBulkDeleteDialog"
              :form-fields="formFields"
              :form-data="formData"
              :is-editing="isEditing"
              :editing-row-id="editingRowId"
              :editing-data="editingData"
              :original-data="originalData"
              :is-editing-any-row="isEditingAnyRow"
              :get-operators-for-field-type="getOperatorsForFieldType"
              :get-operator-text="getOperatorText"
              :operator-needs-value="operatorNeedsValue"
              :operator-needs-second-value="operatorNeedsSecondValue"
              :generate-filter-id="generateFilterId"
              @search="handleSearch"
              @add-filter="handleAddFilter"
              @remove-filter="handleRemoveFilter"
              @clear-all-filters="handleClearAllFilters"
              @toggle-filters-panel="handleToggleFiltersPanel"
              @select-item="handleSelectItem"
              @select-all="handleSelectAll"
              @clear-selection="handleClearSelection"
              @add-item="handleAddItem"
              @edit-item="handleEditItem"
              @delete-item="handleDeleteItem"
              @bulk-delete="handleBulkDelete"
              @save-item="handleSaveItem"
              @cancel-edit="() => (showAddEditModal = false)"
              @confirm-delete="handleConfirmDelete"
              @confirm-bulk-delete="handleConfirmBulkDelete"
              @cancel-delete="() => (showDeleteDialog = false)"
              @cancel-bulk-delete="() => (showBulkDeleteDialog = false)"
              @update:selectedItems="(items) => (selectedItems = items)"
              @update:showAddEditModal="(show) => (showAddEditModal = show)"
              @update:showDeleteDialog="(show) => (showDeleteDialog = show)"
              @update:showBulkDeleteDialog="
                (show) => (showBulkDeleteDialog = show)
              "
              @update:formData="(data) => (formData = data)"
              @start-inline-edit="startInlineEdit"
              @save-inline-edit="saveInlineEdit"
              @cancel-inline-edit="cancelInlineEdit"
              @update-inline-field="updateInlineField"
            />
          </v-card-text>
        </v-card>
      </div>
    </div>

    <!-- No data message -->
    <div
      v-else-if="instanceTables.length === 0 && !canCheckData"
      class="no-data-container"
    >
      <v-alert type="info" class="ma-4">
        {{ t('inputOutputData.noDataAvailable') }}
      </v-alert>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGeneralStore } from '@/stores/general'
import CoreTable from '@/components/core/table/CoreTable.vue'
import CoreTab from '@/components/core/CoreTab.vue'
import CoreTabs from '@/components/core/CoreTabs.vue'
import {
  getOperatorsForFieldType,
  getOperatorText as getOperatorTextUtil,
  operatorNeedsValue,
  operatorNeedsSecondValue,
  generateFilterId,
  applyFiltersAndSearch as applyFiltersAndSearchUtil,
  generateHeadersFromData,
  type FilterCondition,
} from '@/utils/tableFilterUtils'
import { transformJsonSchemaToAutomationFormat } from '@/utils/schemaUtils'

// Props
interface Props {
  execution?: any
  canCheckData?: boolean
  checksFinished?: boolean
  checksError?: boolean
  readOnly?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  canCheckData: false,
  checksFinished: false,
  checksError: false,
  readOnly: false,
})

// Emits
const emit = defineEmits<{
  'save-changes': [data: any]
  'check-data': []
}>()

// Composables
const { t } = useI18n()
const generalStore = useGeneralStore()

// State
const checksLaunched = ref(false)
const selectedTabIndex = ref(0)
// Each table has its own search and filters
const tableStates = ref<
  Record<string, { searchValue: string; activeFilters: FilterCondition[] }>
>({})

// State for modals and CRUD operations
const showAddEditModal = ref(false)
const showDeleteDialog = ref(false)
const showBulkDeleteDialog = ref(false)
const isEditing = ref(false)
const formData = ref<any>({})
const itemToDelete = ref<any>(null)
const selectedItems = ref<any[]>([])

// State for inline editing
const editingRowId = ref<string | number | null>(null)
const editingData = ref<any>({})
const originalData = ref<any>({})
const isEditingAnyRow = computed(() => editingRowId.value !== null)

// Use the utility function for generating headers
const generateHeaders = generateHeadersFromData

// Helper function to format table titles
const formatTitle = (key: string): string => {
  return key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ')
}

// Helper function to get or create table state
const getTableState = (tableKey: string) => {
  if (!tableStates.value[tableKey]) {
    tableStates.value[tableKey] = {
      searchValue: '',
      activeFilters: [],
    }
  }
  return tableStates.value[tableKey]
}

// Use utility function for filtering and searching
const applyFiltersAndSearch = (items: any[], tableKey: string): any[] => {
  const state = getTableState(tableKey)
  return applyFiltersAndSearchUtil(
    items,
    state.searchValue,
    state.activeFilters,
  )
}

// Get schema for headers and validation (transformed to automation format)
const instanceSchema = computed(() => {
  const execution = props.execution || generalStore.selectedExecution
  if (!execution?.instance?.schema) {
    console.warn('ExecutionDataView: No instance schema found')
    return null
  }

  // Transform the JSON schema to automation format (like table configs)
  const transformedSchema = transformJsonSchemaToAutomationFormat(
    execution.instance.schema,
    execution.instance.schemaChecks || {},
    'instance',
  )

  return transformedSchema
})

// Computed
const instanceTables = computed(() => {
  const execution = props.execution || generalStore.selectedExecution
  if (!execution?.instance?.data) return []

  const tables: any[] = []

  // If we're in check data mode, show validation tables if they exist
  if (props.canCheckData) {
    // Show validation tables if they exist (don't wait for checks to finish)
    const validationTables = createValidationTables(execution)
    if (validationTables.length > 0) {
      tables.push(...validationTables)
    }
    return tables
  }

  // Normal mode: show instance data tables
  const instanceData = execution.instance.data
  const schema = instanceSchema.value

  Object.keys(instanceData).forEach((tableKey) => {
    const tableData = instanceData[tableKey]
    if (Array.isArray(tableData)) {
      const tableObject = createTableObject(tableKey, tableData, schema)
      if (tableObject) {
        tables.push(tableObject)
      }
    }
  })

  return tables
})

// Helper function to create table object
const createTableObject = (tableKey: string, tableData: any[], schema: any) => {
  // Ensure all items have an ID (before generating headers)
  tableData.forEach((item: any, index: number) => {
    if (!item.id) {
      item.id = `${tableKey}_${index}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }
  })

  // Get headers from transformed schema (automation format)
  let headers: any[]
  let title = tableKey

  // The transformed schema has structure: schema[tableKey].get_list.response_schema.items.properties
  if (schema?.[tableKey]) {
    const tableConfig = schema[tableKey]

    // Get title from schema config
    if (tableConfig.title) {
      title = tableConfig.title
    }

    // Generate headers from get_list operation schema
    const responseSchema = tableConfig.get_list?.response_schema
    if (responseSchema?.items?.properties) {
      const properties = responseSchema.items.properties
      const requiredFields = responseSchema.items.required || []

      // Generate headers from schema properties
      const schemaHeaders = Object.entries(properties).map(
        ([key, prop]: [string, any]) => ({
          title: prop.title || key,
          value: key,
          key: key,
          sortable: true,
          filterable: true,
          type: prop.type === 'integer' ? 'number' : prop.type,
          required: requiredFields.includes(key),
          minLength: prop.minLength,
          maxLength: prop.maxLength,
          min: prop.minimum,
          max: prop.maximum,
          pattern: prop.pattern,
          readOnly: prop.readOnly || false,
        }),
      )

      // IMPORTANT: Add special headers for CoreTable functionality
      headers = [
        // Selection header (for checkboxes) - MUST be first
        {
          title: '',
          value: 'selection',
          key: 'selection',
          sortable: false,
          filterable: false,
          type: 'selection',
          required: false,
          width: '48px',
        },
        // ID header (for row identification) - hidden from display
        {
          title: 'ID',
          value: 'id',
          key: 'id',
          sortable: false,
          filterable: false,
          type: 'string',
          required: false,
          align: ' d-none',
        },
        // Schema fields
        ...schemaHeaders,
      ]
    } else {
      console.warn(
        `ExecutionDataView: No response schema items.properties for "${tableKey}", using fallback`,
      )
      // Fallback to generating from data
      let dataHeaders = generateHeaders(tableData)
      // Add selection and ID headers
      headers = [
        {
          title: '',
          value: 'selection',
          key: 'selection',
          sortable: false,
          filterable: false,
          type: 'selection',
          width: '48px',
        },
        {
          title: 'ID',
          value: 'id',
          key: 'id',
          sortable: false,
          filterable: false,
          type: 'string',
          align: ' d-none',
        },
        ...dataHeaders.filter((h) => h.key !== 'id' && h.key !== 'selection'),
      ]
    }
  } else {
    console.warn(
      `ExecutionDataView: No transformed schema config found for table "${tableKey}", using fallback`,
    )
    // Fallback to generating from data
    let dataHeaders = generateHeaders(tableData)
    // Add selection and ID headers
    headers = [
      {
        title: '',
        value: 'selection',
        key: 'selection',
        sortable: false,
        filterable: false,
        type: 'selection',
        width: '48px',
      },
      {
        title: 'ID',
        value: 'id',
        key: 'id',
        sortable: false,
        filterable: false,
        type: 'string',
        align: ' d-none',
      },
      ...dataHeaders.filter((h) => h.key !== 'id' && h.key !== 'selection'),
    ]
  }

  // Apply filters and ensure IDs are preserved and accessible
  let filteredItems = applyFiltersAndSearch(tableData, tableKey)

  // CRITICAL: Ensure ID is explicitly in each filtered item (not just in Proxy)
  filteredItems = filteredItems.map((item: any) => ({
    id: item.id, // Explicitly add ID first
    ...item, // Then spread the rest
  }))

  return {
    key: tableKey,
    title: title,
    headers: headers,
    items: filteredItems,
    originalItems: tableData,
  }
}

// Helper function to create validation tables
const createValidationTables = (execution: any) => {
  const validationTables: any[] = []
  const instanceData = execution.instance.dataChecks || {}

  Object.keys(instanceData).forEach((tableKey) => {
    const tableData = instanceData[tableKey]
    // Only create table if it's an array with data
    if (Array.isArray(tableData) && tableData.length > 0) {
      // Check if array contains primitives (strings, numbers, etc.) or objects
      const isPrimitiveArray =
        typeof tableData[0] !== 'object' ||
        tableData[0] === null ||
        Array.isArray(tableData[0])

      let processedData: any[]
      let headers: any[]

      if (isPrimitiveArray) {
        // Convert primitives to objects with a 'value' field
        processedData = tableData.map((value: any, index: number) => ({
          id: `validation_${tableKey}_${index}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          value: value,
        }))
        headers = [
          {
            title: 'ID',
            value: 'id',
            key: 'id',
            sortable: false,
            filterable: false,
            type: 'string',
            align: ' d-none',
          },
          {
            title: formatTitle(tableKey),
            value: 'value',
            key: 'value',
            sortable: true,
            filterable: true,
            type: typeof tableData[0],
          },
        ]
      } else {
        // Object array - ensure all items have an ID
        processedData = tableData.map((item: any, index: number) => ({
          id:
            item.id ||
            `validation_${tableKey}_${index}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          ...item,
        }))

        // Generate headers from data for validation tables
        const dataHeaders = generateHeaders(processedData)
        headers = [
          {
            title: 'ID',
            value: 'id',
            key: 'id',
            sortable: false,
            filterable: false,
            type: 'string',
            align: ' d-none',
          },
          ...dataHeaders.filter((h) => h.key !== 'id' && h.key !== 'selection'),
        ]
      }

      // Apply filters
      let filteredItems = applyFiltersAndSearch(
        processedData,
        `validation_${tableKey}`,
      )
      filteredItems = filteredItems.map((item: any) => ({
        id: item.id,
        ...item,
      }))

      validationTables.push({
        key: `validation_${tableKey}`,
        title: `${formatTitle(tableKey)}`,
        headers: headers,
        items: filteredItems,
        originalItems: tableData,
        isValidationTable: true,
      })
    }
  })

  return validationTables
}

const currentTable = computed(() => {
  if (instanceTables.value.length === 0)
    return { headers: [], items: [], key: '' }
  const table =
    instanceTables.value[selectedTabIndex.value] || instanceTables.value[0]
  return table
})

const currentTableState = computed(() => {
  const table = currentTable.value
  if (!table.key) return { searchValue: '', activeFilters: [] }
  return getTableState(table.key)
})

const formFields = computed(() => {
  const table = currentTable.value
  if (!table.headers || table.headers.length === 0) return []

  // Convert headers to form fields format with validation rules from schema
  return table.headers.map((header: any) => ({
    key: header.key,
    title: header.title,
    type: header.type,
    required: header.required || false, // Use required from schema
    readOnly: header.key === 'id', // ID field is read-only when editing
    minLength: header.minLength,
    maxLength: header.maxLength,
    min: header.min,
    max: header.max,
    pattern: header.pattern,
  }))
})

const hasValidationErrors = computed(() => {
  // Check if there are validation errors in the execution data
  const execution = props.execution || generalStore.selectedExecution
  if (!execution) return false

  const instanceData = execution.instance
  const dataChecks = instanceData?.dataChecks

  // Check if dataChecks exists and has at least one key with non-empty array
  if (!dataChecks || !Object.keys(dataChecks).length) return false

  // Return true if at least one key has an array with items
  return Object.values(dataChecks).some(
    (check: any) => Array.isArray(check) && check.length > 0,
  )
})

const isLoadingChecks = computed(() => {
  // Show spinner only when checks are launched and not finished
  return checksLaunched.value && !props.checksFinished && !props.checksError
})

// Wrapper for getOperatorText to provide t function
const getOperatorText = (operator: string): string => {
  return getOperatorTextUtil(operator, t)
}

// Event handlers for CoreTable
const handleSearch = (value: string) => {
  const table = currentTable.value
  if (table.key) {
    const state = getTableState(table.key)
    state.searchValue = value
  }
}

const handleAddFilter = (filter: any) => {
  const table = currentTable.value
  if (table.key) {
    const state = getTableState(table.key)
    state.activeFilters.push(filter)
  }
}

const handleRemoveFilter = (filterId: string) => {
  const table = currentTable.value
  if (table.key) {
    const state = getTableState(table.key)
    state.activeFilters = state.activeFilters.filter((f) => f.id !== filterId)
  }
}

const handleClearAllFilters = () => {
  const table = currentTable.value
  if (table.key) {
    const state = getTableState(table.key)
    state.activeFilters = []
  }
}

const handleToggleFiltersPanel = (show: boolean) => {
  // This is handled by CoreTable internally
}

// Selection handlers
const handleSelectItem = (item: any) => {
  const index = selectedItems.value.findIndex((i) => i.id === item.id)
  if (index > -1) {
    selectedItems.value.splice(index, 1)
  } else {
    selectedItems.value.push(item)
  }
}

const handleSelectAll = (items: any[]) => {
  selectedItems.value = [...items]
}

const handleClearSelection = () => {
  selectedItems.value = []
}

// CRUD Operations - Modify instanceData directly
const handleAddItem = () => {
  isEditing.value = false
  formData.value = {}
  showAddEditModal.value = true
}

const handleEditItem = (item: any) => {
  isEditing.value = true
  formData.value = { ...item }
  showAddEditModal.value = true
}

const handleSaveItem = (data: any) => {
  const table = currentTable.value
  if (!table.key || !props.execution?.instance?.data) return

  const tableData = props.execution.instance.data[table.key]

  // Convert types based on schema before saving
  const convertedData = convertDataTypesBasedOnSchema(data, table.key)

  // Create a copy without the internal ID for storage
  const { id, ...dataWithoutId } = convertedData

  if (isEditing.value) {
    // Edit existing item
    const index = tableData.findIndex((item: any) => item.id === data.id)
    if (index !== -1) {
      // Keep the ID for internal tracking, but don't include it in the stored data
      tableData[index] = { ...dataWithoutId, id: data.id }
    }
  } else {
    // Add new item
    // Generate a temporary ID for UI tracking
    const tempId = `${table.key}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    tableData.push({ ...dataWithoutId, id: tempId })
  }

  showAddEditModal.value = false
  formData.value = {}

  // Emit event to notify parent that data has changed
  emit('save-changes', props.execution.instance.data)
}

const handleDeleteItem = (item: any) => {
  itemToDelete.value = item
  showDeleteDialog.value = true
}

const handleBulkDelete = () => {
  if (selectedItems.value.length === 0) return
  showBulkDeleteDialog.value = true
}

const handleConfirmDelete = () => {
  const table = currentTable.value
  if (!table.key || !props.execution?.instance?.data || !itemToDelete.value)
    return

  const tableData = props.execution.instance.data[table.key]
  const index = tableData.findIndex(
    (item: any) => item.id === itemToDelete.value.id,
  )

  if (index !== -1) {
    tableData.splice(index, 1)
  }

  showDeleteDialog.value = false
  itemToDelete.value = null

  // Emit event to notify parent that data has changed
  emit('save-changes', props.execution.instance.data)
}

const handleConfirmBulkDelete = () => {
  const table = currentTable.value
  if (
    !table.key ||
    !props.execution?.instance?.data ||
    selectedItems.value.length === 0
  )
    return

  const tableData = props.execution.instance.data[table.key]
  const idsToDelete = selectedItems.value.map((item) => item.id)

  // Remove all selected items
  for (let i = tableData.length - 1; i >= 0; i--) {
    if (idsToDelete.includes(tableData[i].id)) {
      tableData.splice(i, 1)
    }
  }

  showBulkDeleteDialog.value = false
  selectedItems.value = []

  // Emit event to notify parent that data has changed
  emit('save-changes', props.execution.instance.data)
}

// Inline editing handlers
const startInlineEdit = (item: any, field?: string) => {
  editingRowId.value = item.id
  editingData.value = { ...item }
  originalData.value = { ...item }
}

// Helper function to convert data types based on JSON schema
const convertDataTypesBasedOnSchema = (data: any, tableKey: string): any => {
  const execution = props.execution || generalStore.selectedExecution
  if (!execution?.instance?.schema?.properties?.[tableKey]?.items?.properties) {
    return data
  }

  const itemSchema = execution.instance.schema.properties[tableKey].items
  const convertedData = { ...data }

  Object.keys(convertedData).forEach((key) => {
    if (key === 'id') return // Skip internal ID

    const fieldSchema = itemSchema.properties?.[key]
    if (!fieldSchema) return

    const value = convertedData[key]
    if (value === null || value === undefined) return

    // Convert based on schema type
    switch (fieldSchema.type) {
      case 'integer':
        convertedData[key] =
          typeof value === 'number'
            ? Math.floor(value)
            : parseInt(String(value), 10)
        if (isNaN(convertedData[key])) {
          convertedData[key] = 0
        }
        break

      case 'number':
        convertedData[key] =
          typeof value === 'number' ? value : parseFloat(String(value))
        if (isNaN(convertedData[key])) {
          convertedData[key] = 0
        }
        break

      case 'boolean':
        if (typeof value === 'boolean') {
          convertedData[key] = value
        } else if (typeof value === 'string') {
          convertedData[key] =
            value.toLowerCase() === 'true' || value === '1'
        } else {
          convertedData[key] = Boolean(value)
        }
        break

      default:
        // Keep as is for string and other types
        break
    }
  })

  return convertedData
}

const saveInlineEdit = () => {
  const table = currentTable.value
  if (!table.key || !props.execution?.instance?.data || !editingRowId.value)
    return

  const tableData = props.execution.instance.data[table.key]
  const index = tableData.findIndex(
    (item: any) => item.id === editingRowId.value,
  )

  if (index !== -1) {
    // Convert types based on schema before saving
    const convertedData = convertDataTypesBasedOnSchema(
      editingData.value,
      table.key,
    )
    tableData[index] = convertedData
  }

  editingRowId.value = null
  editingData.value = {}
  originalData.value = {}

  // Emit event to notify parent that data has changed
  emit('save-changes', props.execution.instance.data)
}

const cancelInlineEdit = () => {
  editingRowId.value = null
  editingData.value = {}
  originalData.value = {}
}

const updateInlineField = (field: string, value: any) => {
  editingData.value[field] = value
}

// Methods
const handleCheckData = () => {
  checksLaunched.value = true
  emit('check-data')
}
</script>

<style scoped>
.execution-data-view {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.check-data-button-container {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 6px 0;
  margin-bottom: 8px;
  flex-shrink: 0;
}

.alert-section {
  margin-bottom: 8px;
  flex-shrink: 0;
}

.alert-text-size {
  font-size: 0.875rem;
}

.data-tables-container {
  flex: 1;
  min-height: 0; /* Important for flex scrolling */
  display: flex;
  flex-direction: column;
}

.single-table-view,
.multiple-tables-view {
  width: 100%;
  height: 100%;
  flex: 1;
  min-height: 0;
}

.table-card {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.table-card-content {
  flex: 1;
  min-height: 0;
  padding: 16px 0 0 0;
}

.no-data-container {
  margin-top: 2rem;
}
</style>
