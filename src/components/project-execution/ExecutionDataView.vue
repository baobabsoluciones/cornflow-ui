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
        {{ t('projectExecution.steps.step5.check') }}
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
        {{ t('inputOutputData.dataChecksPassedMessage') }}
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
        {{ t('inputOutputData.dataChecksLoadingMessage') }}
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
        {{ t('inputOutputData.dataChecksFailedMessage') }}
      </v-alert>
    </div>

    <!-- Pending Changes Review Button (Excel mode) - At top for visibility -->
    <div
      v-if="enableExcelMode && hasPendingChanges"
      class="pending-changes-bar"
    >
      <v-chip color="success" variant="tonal" size="small" class="mr-2">
        <v-icon start size="small">mdi-pencil</v-icon>
        {{
          $t('pendingChanges.changesIndicator', { count: pendingChangesCount })
        }}
      </v-chip>
      <v-btn
        color="success"
        variant="flat"
        size="small"
        @click="openPendingChangesModal"
      >
        <v-icon start size="small">mdi-eye</v-icon>
        {{ $t('pendingChanges.reviewChanges') }}
      </v-btn>
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
              class="tab-with-indicator"
            >
              <span class="tab-label">{{ table.title }}</span>
              <!-- Master table match indicator -->
              <v-tooltip v-if="getMatchForTable(table.key)" location="top">
                <template #activator="{ props: tooltipProps }">
                  <v-icon
                    v-bind="tooltipProps"
                    size="small"
                    :color="
                      getMatchForTable(table.key)?.hasDifferences
                        ? 'warning'
                        : 'success'
                    "
                    class="ml-1 match-indicator"
                  >
                    {{
                      getMatchForTable(table.key)?.hasDifferences
                        ? 'mdi-database-sync'
                        : 'mdi-database-check'
                    }}
                  </v-icon>
                </template>
                <span>
                  {{
                    getMatchForTable(table.key)?.hasDifferences
                      ? t('masterTableMatch.hasDifferencesWithMaster')
                      : t('masterTableMatch.identicalToMaster')
                  }}
                </span>
              </v-tooltip>
            </CoreTab>
          </CoreTabs>

          <!-- Master table match action bar -->
          <div
            v-if="currentTableMatch && !currentTable.isValidationTable"
            class="master-match-action-bar"
          >
            <div class="match-info">
              <v-icon
                size="small"
                :color="
                  currentTableMatch.hasDifferences ? 'warning' : 'success'
                "
                class="mr-2"
              >
                {{
                  currentTableMatch.hasDifferences
                    ? 'mdi-database-sync'
                    : 'mdi-database-check'
                }}
              </v-icon>
              <span class="match-text">
                {{ t('masterTableMatch.matchFoundWith') }}
                <strong>{{ currentTableMatch.masterTableTitle }}</strong>
              </span>
              <!-- Diff summary badges -->
              <div
                class="diff-badges ml-3"
                v-if="currentTableMatch.hasDifferences"
              >
                <v-chip
                  v-if="currentTableMatch.diffSummary.onlyInInstance > 0"
                  size="x-small"
                  color="success"
                  variant="tonal"
                  class="mr-1"
                >
                  <v-icon start size="x-small">mdi-plus</v-icon>
                  {{ currentTableMatch.diffSummary.onlyInInstance }}
                </v-chip>
                <v-chip
                  v-if="currentTableMatch.diffSummary.onlyInMaster > 0"
                  size="x-small"
                  color="error"
                  variant="tonal"
                  class="mr-1"
                >
                  <v-icon start size="x-small">mdi-minus</v-icon>
                  {{ currentTableMatch.diffSummary.onlyInMaster }}
                </v-chip>
                <v-chip
                  v-if="currentTableMatch.diffSummary.different > 0"
                  size="x-small"
                  color="warning"
                  variant="tonal"
                >
                  <v-icon start size="x-small">mdi-pencil</v-icon>
                  {{ currentTableMatch.diffSummary.different }}
                </v-chip>
              </div>
              <v-chip
                v-else
                size="x-small"
                color="success"
                variant="tonal"
                class="ml-3"
              >
                {{ t('masterTableMatch.identical') }}
              </v-chip>
            </div>
            <div class="match-actions">
              <v-btn
                size="small"
                variant="text"
                color="primary"
                @click="handleShowComparison"
              >
                <v-icon start size="small">mdi-compare</v-icon>
                {{ t('masterTableMatch.viewDifferences') }}
              </v-btn>
              <v-divider vertical class="mx-2"></v-divider>
              <!-- Action buttons with confirmation -->
              <v-btn
                size="small"
                variant="outlined"
                color="primary"
                class="mr-2"
                :class="{
                  'v-btn--active':
                    currentTableMatch.userChoice === 'use_master',
                }"
                @click="showUseMasterConfirmDialog = true"
              >
                <v-tooltip activator="parent" location="top">
                  {{ t('masterTableMatch.option.useMaster.description') }}
                </v-tooltip>
                <v-icon start size="small">mdi-database</v-icon>
                {{ t('masterTableMatch.option.useMaster.short') }}
              </v-btn>
              <v-btn
                size="small"
                variant="outlined"
                color="accent"
                :disabled="!currentTableMatch.canReplaceMaster"
                :class="{
                  'v-btn--active':
                    currentTableMatch.userChoice === 'replace_master',
                }"
                @click="showReplaceMasterConfirmDialog = true"
              >
                <v-tooltip activator="parent" location="top">
                  {{
                    currentTableMatch.canReplaceMaster
                      ? t('masterTableMatch.option.replaceMaster.description')
                      : t('masterTableMatch.option.replaceMaster.notAvailable')
                  }}
                </v-tooltip>
                <v-icon start size="small">mdi-database-sync</v-icon>
                {{ t('masterTableMatch.option.replaceMaster.short') }}
              </v-btn>
            </div>
          </div>

          <v-card-text class="table-card-content">
            <CoreTable
              :items="currentTable.items"
              :headers="currentTable.headers"
              :table-title="currentTable.title"
              :table-key="currentTable.key"
              :loading="false"
              :elevation="0"
              :enable-search="true"
              :enable-filters="true"
              :enable-selection="!readOnly && !currentTable.isValidationTable"
              :enable-actions="!readOnly && !currentTable.isValidationTable"
              :enable-bulk-actions="
                !readOnly && !currentTable.isValidationTable
              "
              :enable-excel-mode="
                enableExcelMode && !readOnly && !currentTable.isValidationTable
              "
              :get-row-class="getRowClass"
              :is-cell-modified="isCellModified"
              :get-modified-value="getModifiedValue"
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
              :table-data="tableDataForCoreTable"
              :load-table-data="loadTableDataForCoreTable"
              :is-editing="isEditing"
              :editing-row-id="editingRowId"
              :editing-table-key="editingTableKey"
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
              @cell-change="handleCellChange"
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

    <!-- Pending Changes Review Modal -->
    <PendingChangesReviewModal
      v-model="showPendingChangesModal"
      :saving="savingChanges"
      :validation-error="saveValidationError"
      :row-identifiers="getRowIdentifiers"
      :rows-data="getRowsData"
      :table-headers="getTableHeaders"
      @save="handleSaveAllChanges"
      @close="handleClosePendingChangesModal"
      @update-change="handleModalUpdateChange"
      @revert-change="handleRevertChange"
      @revert-row="handleRevertRow"
      @revert-table="handleRevertTable"
      @revert-all="handleRevertAll"
      @clear-validation-error="saveValidationError = null"
    />

    <!-- Use Master Confirmation Dialog -->
    <CoreConfirmDialog
      v-model="showUseMasterConfirmDialog"
      :title="t('masterTableMatch.confirmUseMaster.title')"
      :message="
        t('masterTableMatch.confirmUseMaster.message', {
          tableName: currentTable.title,
        })
      "
      :confirm-text="t('masterTableMatch.confirmUseMaster.confirm')"
      :cancel-text="t('table.cancel')"
      confirm-color="var(--primary)"
      @confirm="handleConfirmUseMaster"
      @cancel="showUseMasterConfirmDialog = false"
    />

    <!-- Replace Master Confirmation Dialog -->
    <CoreConfirmDialog
      v-model="showReplaceMasterConfirmDialog"
      :title="$t('masterTableMatch.confirmReplaceMaster.title')"
      :message="
        $t('masterTableMatch.confirmReplaceMaster.message', {
          tableName: currentTable.title,
        })
      "
      :confirm-text="$t('masterTableMatch.confirmReplaceMaster.confirm')"
      :cancel-text="$t('table.cancel')"
      confirm-color="var(--accent)"
      @confirm="handleConfirmReplaceMaster"
      @cancel="showReplaceMasterConfirmDialog = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGeneralStore } from '@/stores/general'
import CoreTable from '@/components/core/table/CoreTable.vue'
import CoreTab from '@/components/core/CoreTab.vue'
import CoreTabs from '@/components/core/CoreTabs.vue'
import CoreConfirmDialog from '@/components/core/table/CoreConfirmDialog.vue'
import PendingChangesReviewModal from '@/components/core/PendingChangesReviewModal.vue'
import {
  getOperatorsForFieldType,
  getOperatorText as getOperatorTextUtil,
  operatorNeedsValue,
  operatorNeedsSecondValue,
  generateFilterId,
  applyFiltersAndSearch as applyFiltersAndSearchUtil,
  generateHeadersFromData,
  generateSecureId,
  type FilterCondition,
} from '@/utils/tableFilterUtils'
import { transformJsonSchemaToAutomationFormat } from '@/utils/schemaUtils'
import { useTableChanges } from '@/composables/useTableChanges'
import { formatValidationErrorsWithTitle } from '@/utils/errorFormatting'

// Props
interface Props {
  execution?: any
  canCheckData?: boolean
  checksFinished?: boolean
  checksError?: boolean
  readOnly?: boolean
  masterTableMatches?: any[]
  enableExcelMode?: boolean // Enable Excel-like editing mode
}

const props = withDefaults(defineProps<Props>(), {
  canCheckData: false,
  checksFinished: false,
  checksError: false,
  readOnly: false,
  masterTableMatches: () => [],
  enableExcelMode: true, // Enable by default
})

// Emits
const emit = defineEmits<{
  'save-changes': [data: any]
  'check-data': []
  'master-table-action': [
    tableKey: string,
    action: 'keep_uploaded' | 'use_master' | 'replace_master',
  ]
  'show-comparison': [tableKey: string]
  'pending-changes-update': [hasChanges: boolean, changesCount: number]
}>()

// Composables
const { t } = useI18n()
const generalStore = useGeneralStore()
const tableChanges = useTableChanges()

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
const editingTableKey = ref<string | null>(null)
const editingData = ref<any>({})
const originalData = ref<any>({})

// State for master table action confirmation dialogs
const showUseMasterConfirmDialog = ref(false)
const showReplaceMasterConfirmDialog = ref(false)
const isEditingAnyRow = computed(() => editingRowId.value !== null)

// State for pending changes review modal
const showPendingChangesModal = ref(false)
const savingChanges = ref(false)
const saveValidationError = ref<string | null>(null)

// Computed for pending changes
const hasPendingChanges = computed(() => tableChanges.hasChanges.value)
const pendingChangesCount = computed(() => tableChanges.totalChangesCount.value)

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

  // Normal mode: show instance data tables in schema order
  const instanceData = execution.instance.data
  const schema = instanceSchema.value
  const rawSchema = execution.instance.schema
  const schemaOrder =
    rawSchema?.properties && typeof rawSchema.properties === 'object'
      ? Object.keys(rawSchema.properties)
      : []

  const dataKeys = Object.keys(instanceData)
  const orderedKeys = [
    ...schemaOrder.filter((k) => dataKeys.includes(k)),
    ...dataKeys.filter((k) => !schemaOrder.includes(k)),
  ]

  orderedKeys.forEach((tableKey) => {
    const baseData = instanceData[tableKey]
    if (!Array.isArray(baseData)) return
    // In Excel mode, show all base rows (including pending deletes, styled red) plus pending creates (styled green)
    let tableData = baseData
    if (props.enableExcelMode) {
      const creates = tableChanges.getPendingCreates(tableKey)
      tableData = [...baseData].concat(
        creates.map((c) => ({ ...c.data, id: c.tempId })),
      )
    }
    // When table matches a master table, use master config (types, joinFrom, columnsToJoin, choices)
    const match = props.masterTableMatches?.find(
      (m: any) => m.tableKey === tableKey,
    )
    const effectiveConfig = match?.masterTableConfig ?? schema?.[tableKey]
    const tableObject = createTableObject(
      tableKey,
      tableData,
      schema,
      effectiveConfig,
    )
    if (tableObject) {
      tables.push(tableObject)
    }
  })

  return tables
})

// Helper function to create table object (effectiveConfig = master table config when match, else instance schema)
const createTableObject = (
  tableKey: string,
  tableData: any[],
  schema: any,
  effectiveConfig?: any,
) => {
  // Ensure all items have an ID (before generating headers)
  tableData.forEach((item: any, index: number) => {
    if (!item.id) {
      item.id = generateSecureId(`${tableKey}_${index}`)
    }
  })

  const tableConfig = effectiveConfig ?? schema?.[tableKey]
  let headers: any[]
  let title = tableKey

  if (tableConfig?.title) {
    title = tableConfig.title
  }

  const selectionHeader = {
    title: '',
    value: 'selection',
    key: 'selection',
    sortable: false,
    filterable: false,
    type: 'selection',
    required: false,
    width: '48px',
  }

  const responseSchema = tableConfig?.get_list?.response_schema
  if (responseSchema?.items?.properties) {
    const properties = responseSchema.items.properties
    const requiredFields = responseSchema.items.required || []

    // SAFETY CHECK: Verify that schema property keys actually exist in the data.
    // When a master table config is used (effectiveConfig), its column keys may differ
    // from the instance data keys (e.g., different casing or different column set),
    // which would cause empty cells since item[header.key] wouldn't find a match.
    const schemaKeys = Object.keys(properties).filter((k) => k !== 'id')
    const dataKeys =
      tableData.length > 0
        ? Object.keys(tableData[0]).filter((k) => k !== 'id' && k !== '_id')
        : []

    const keysMatchData =
      dataKeys.length === 0 || schemaKeys.some((sk) => dataKeys.includes(sk))

    if (keysMatchData) {
      // Schema keys match data keys - use schema headers with full metadata
      const schemaHeaders = Object.entries(properties)
        .filter(([key]) => key !== 'id')
        .map(([key, prop]: [string, any]) => ({
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
          isForeignKey: prop.isForeignKey || false,
          isDependentField: prop.isDependentField || false,
          isMainSelector: prop.isMainSelector || false,
          joinFrom: prop.joinFrom || undefined,
          columnsToJoin: prop.columnsToJoin || undefined,
          foreignKeyField: prop.foreignKeyField || undefined,
          hidden: prop.hidden || false,
          // Use explicit choices from config, or schema enum (e.g. 'refineria' | 'factoria') so dropdowns show options without lookup
          choices:
            prop.choices ??
            (Array.isArray(prop.enum) && prop.enum.length > 0
              ? prop.enum
              : undefined),
        }))

      headers = [selectionHeader, ...schemaHeaders]
    } else {
      // Schema keys DON'T match data keys (e.g., master table config has different
      // column names than the instance data). Fall back to data-derived headers
      // but enrich them with metadata from the master config via case-insensitive matching.
      console.warn(
        `ExecutionDataView: Schema property keys for "${tableKey}" don't match data keys (schema: [${schemaKeys.join(', ')}], data: [${dataKeys.join(', ')}]). Falling back to data-derived headers.`,
      )

      // Build a case-insensitive lookup from the config properties for enrichment
      const configPropsLookup = new Map<string, any>()
      Object.entries(properties).forEach(([key, prop]) => {
        configPropsLookup.set(key.toLowerCase(), prop as any)
      })

      const dataHeaders = generateHeaders(tableData)
      const enrichedHeaders = dataHeaders
        .filter((h: any) => h.key !== 'id' && h.key !== 'selection')
        .map((h: any) => {
          const configProp = configPropsLookup.get(h.key.toLowerCase())
          if (configProp) {
            return {
              ...h,
              title: configProp.title || h.title,
              type:
                configProp.type === 'integer'
                  ? 'number'
                  : configProp.type || h.type,
              required: requiredFields.includes(h.key),
              readOnly: configProp.readOnly || false,
              isForeignKey: configProp.isForeignKey || false,
              isDependentField: configProp.isDependentField || false,
              isMainSelector: configProp.isMainSelector || false,
              joinFrom: configProp.joinFrom || undefined,
              columnsToJoin: configProp.columnsToJoin || undefined,
              foreignKeyField: configProp.foreignKeyField || undefined,
              hidden: configProp.hidden || false,
              choices:
                configProp.choices ??
                (Array.isArray(configProp.enum) && configProp.enum.length > 0
                  ? configProp.enum
                  : undefined),
            }
          }
          return h
        })

      headers = [selectionHeader, ...enrichedHeaders]
    }
  } else {
    console.warn(
      `ExecutionDataView: No response schema items.properties for "${tableKey}", using fallback`,
    )
    const dataHeaders = generateHeaders(tableData)
    headers = [
      selectionHeader,
      ...dataHeaders.filter(
        (h: any) => h.key !== 'id' && h.key !== 'selection',
      ),
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
          id: generateSecureId(`validation_${tableKey}_${index}`),
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
          id: item.id || generateSecureId(`validation_${tableKey}_${index}`),
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

// Master table match computed properties
const getMatchForTable = (tableKey: string) => {
  if (!props.masterTableMatches || props.masterTableMatches.length === 0)
    return null
  return (
    props.masterTableMatches.find((m: any) => m.tableKey === tableKey) || null
  )
}

const currentTableMatch = computed(() => {
  const table = currentTable.value
  if (!table.key) return null
  return getMatchForTable(table.key)
})

const hasAnyMatches = computed(() => {
  return props.masterTableMatches && props.masterTableMatches.length > 0
})

// Dropdown options come from the instance JSON (tables that match), not from masterData API.
// Expose both original keys and normalized keys (e.g. operadores_intercambios) so useFormFields
// can find tables by joinFrom (e.g. "operadores_intercambios.operador") even when instance.data
// uses different key format (e.g. "Operadores Intercambios").
const tableDataForCoreTable = computed(() => {
  const data = props.execution?.instance?.data
  if (!data || typeof data !== 'object') return {}
  const normalized: Record<string, any[]> = {}
  for (const key of Object.keys(data)) {
    const value = data[key]
    if (!Array.isArray(value)) continue
    const norm = normalizeTableNameForLookup(key)
    if (norm && norm !== key && !(norm in data)) {
      normalized[norm] = value
    }
  }
  return { ...data, ...normalized }
})

// Normalize table name to match instance.data keys (snake_case, spaces, camelCase, etc.)
const normalizeTableNameForLookup = (name: string): string => {
  if (!name) return ''
  const withUnderscores = name.replace(/\s+/g, '_').replace(/-/g, '_')
  if (withUnderscores.includes('_')) {
    return withUnderscores.toLowerCase()
  }
  if (
    withUnderscores !== withUnderscores.toLowerCase() &&
    withUnderscores !== withUnderscores.toUpperCase()
  ) {
    return withUnderscores.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase()
  }
  return withUnderscores.toLowerCase()
}

// Return dropdown options from the matching table in the instance JSON (no API / no masterData)
const loadTableDataForCoreTable = async (tableName: string): Promise<any[]> => {
  const instanceData = props.execution?.instance?.data
  if (!instanceData || typeof instanceData !== 'object') return []

  let table = instanceData[tableName]
  if (Array.isArray(table)) return table

  const normalized = normalizeTableNameForLookup(tableName)
  const key = Object.keys(instanceData).find(
    (k) => normalizeTableNameForLookup(k) === normalized,
  )
  table = key ? instanceData[key] : null
  return Array.isArray(table) ? table : []
}

// Master table action handlers
const handleMasterTableAction = (
  action: 'keep_uploaded' | 'use_master' | 'replace_master',
) => {
  const table = currentTable.value
  if (!table.key) return
  emit('master-table-action', table.key, action)
}

// Confirmation handlers for master table actions
const handleConfirmUseMaster = () => {
  handleMasterTableAction('use_master')
  showUseMasterConfirmDialog.value = false
}

const handleConfirmReplaceMaster = () => {
  handleMasterTableAction('replace_master')
  showReplaceMasterConfirmDialog.value = false
}

const handleShowComparison = () => {
  const table = currentTable.value
  if (!table.key) return
  emit('show-comparison', table.key)
}

const formFields = computed(() => {
  const table = currentTable.value
  if (!table.headers || table.headers.length === 0) return []

  // Convert headers to form fields format with validation rules and dropdown config (choices, joinFrom)
  return table.headers.map((header: any) => ({
    key: header.key,
    title: header.title,
    type: header.type,
    required: header.required || false,
    readOnly: header.key === 'id',
    minLength: header.minLength,
    maxLength: header.maxLength,
    min: header.min,
    max: header.max,
    pattern: header.pattern,
    choices: header.choices,
    joinFrom: header.joinFrom,
    isDependentField: header.isDependentField,
    isMainSelector: header.isMainSelector,
    foreignKeyField: header.foreignKeyField,
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

  const convertedData = convertDataTypesBasedOnSchema(data, table.key)
  const { id, ...dataWithoutId } = convertedData

  // Excel mode (review instance): stage add; no API, apply to JSON on Save all
  if (props.enableExcelMode && !isEditing.value) {
    tableChanges.recordCreate(
      table.key,
      dataWithoutId as Record<string, any>,
      table.title,
    )
    showAddEditModal.value = false
    formData.value = {}
    emit(
      'pending-changes-update',
      tableChanges.hasChanges.value,
      tableChanges.totalChangesCount.value,
    )
    return
  }

  const tableData = props.execution.instance.data[table.key]

  if (isEditing.value) {
    const index = tableData.findIndex((item: any) => item.id === data.id)
    if (index !== -1) {
      tableData[index] = { ...dataWithoutId, id: data.id }
    }
  } else {
    const tempId = generateSecureId(table.key)
    tableData.push({ ...dataWithoutId, id: tempId })
  }

  showAddEditModal.value = false
  formData.value = {}

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

  // Excel mode: stage delete; no API, apply to JSON on Save all
  if (props.enableExcelMode) {
    tableChanges.recordDelete(
      table.key,
      itemToDelete.value.id,
      itemToDelete.value,
    )
    showDeleteDialog.value = false
    itemToDelete.value = null
    emit(
      'pending-changes-update',
      tableChanges.hasChanges.value,
      tableChanges.totalChangesCount.value,
    )
    return
  }

  const tableData = props.execution.instance.data[table.key]
  const index = tableData.findIndex(
    (item: any) => item.id === itemToDelete.value.id,
  )

  if (index !== -1) {
    tableData.splice(index, 1)
  }

  showDeleteDialog.value = false
  itemToDelete.value = null

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

  // Excel mode: stage deletes; no API, apply to JSON on Save all
  if (props.enableExcelMode) {
    selectedItems.value.forEach((item) =>
      tableChanges.recordDelete(table.key, item.id, item),
    )
    showBulkDeleteDialog.value = false
    selectedItems.value = []
    emit(
      'pending-changes-update',
      tableChanges.hasChanges.value,
      tableChanges.totalChangesCount.value,
    )
    return
  }

  const tableData = props.execution.instance.data[table.key]
  const idsToDelete = selectedItems.value.map((item) => item.id)

  for (let i = tableData.length - 1; i >= 0; i--) {
    if (idsToDelete.includes(tableData[i].id)) {
      tableData.splice(i, 1)
    }
  }

  showBulkDeleteDialog.value = false
  selectedItems.value = []

  emit('save-changes', props.execution.instance.data)
}

// Inline editing handlers
const startInlineEdit = (item: any, field?: string) => {
  const tableKey = currentTable.value?.key ?? null
  // If we're already editing the same row of the same table, don't reset the editing data
  // This preserves any pending changes (like Fijar toggle)
  if (editingRowId.value === item.id && editingTableKey.value === tableKey) {
    return
  }

  editingRowId.value = item.id
  editingTableKey.value = tableKey
  // Start from item and overlay any pending changes (e.g. Fijar) so edit form shows current state
  editingData.value = { ...item }
  originalData.value = { ...item }

  if (props.enableExcelMode) {
    const table = currentTable.value
    if (table?.key) {
      const rowChanges = tableChanges.getChangesForTable(table.key)?.[
        String(item.id)
      ]
      if (rowChanges) {
        Object.entries(rowChanges).forEach(([fieldKey, change]) => {
          editingData.value[fieldKey] = change.newValue
        })
      }
    }
  }
}

// Convert value to integer type
const convertToInteger = (value: any): number => {
  const result =
    typeof value === 'number' ? Math.floor(value) : parseInt(String(value), 10)
  return isNaN(result) ? 0 : result
}

// Convert value to number type
const convertToNumber = (value: any): number => {
  const result = typeof value === 'number' ? value : parseFloat(String(value))
  return isNaN(result) ? 0 : result
}

// Convert value to boolean type
const convertToBoolean = (value: any): boolean => {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string')
    return value.toLowerCase() === 'true' || value === '1'
  return Boolean(value)
}

// Convert a single field value based on schema type
const convertFieldValue = (value: any, schemaType: string): any => {
  if (value === null || value === undefined) return value

  switch (schemaType) {
    case 'integer':
      return convertToInteger(value)
    case 'number':
      return convertToNumber(value)
    case 'boolean':
      return convertToBoolean(value)
    default:
      return value
  }
}

// Get item schema for type conversion: use master table config when match, else instance schema (so int stays int)
const getItemSchemaForTypeConversion = (tableKey: string): any => {
  const match = props.masterTableMatches?.find(
    (m: any) => m.tableKey === tableKey,
  )
  if (match?.masterTableConfig?.get_list?.response_schema?.items) {
    return match.masterTableConfig.get_list.response_schema.items
  }
  const execution = props.execution || generalStore.selectedExecution
  return execution?.instance?.schema?.properties?.[tableKey]?.items ?? null
}

// Helper function to convert data types based on effective schema (master or instance)
const convertDataTypesBasedOnSchema = (data: any, tableKey: string): any => {
  const itemSchema = getItemSchemaForTypeConversion(tableKey)
  if (!itemSchema?.properties) return data

  const convertedData = { ...data }
  Object.keys(convertedData).forEach((key) => {
    if (key === 'id') return
    const fieldSchema = itemSchema.properties[key]
    if (!fieldSchema) return
    convertedData[key] = convertFieldValue(
      convertedData[key],
      fieldSchema.type || 'string',
    )
  })
  return convertedData
}

const saveInlineEdit = () => {
  const table = currentTable.value
  if (!table.key || !props.execution?.instance?.data || !editingRowId.value)
    return

  // Excel mode: cell changes are already in tableChanges; apply to JSON only on Save all
  if (!props.enableExcelMode) {
    const tableData = props.execution.instance.data[table.key]
    const index = tableData.findIndex(
      (item: any) => item.id === editingRowId.value,
    )

    if (index !== -1) {
      const convertedData = convertDataTypesBasedOnSchema(
        editingData.value,
        table.key,
      )
      tableData[index] = convertedData
    }
    emit('save-changes', props.execution.instance.data)
  }

  editingRowId.value = null
  editingTableKey.value = null
  editingData.value = {}
  originalData.value = {}
}

const cancelInlineEdit = () => {
  editingRowId.value = null
  editingTableKey.value = null
  editingData.value = {}
  originalData.value = {}
}

const updateInlineField = (field: string, value: any) => {
  editingData.value[field] = value
}

// Excel mode handlers
const handleCellChange = (
  tableKey: string,
  rowId: string | number,
  fieldKey: string,
  oldValue: any,
  newValue: any,
) => {
  if (!props.enableExcelMode) return

  const table = instanceTables.value.find((t) => t.key === tableKey)
  const header = table?.headers.find((h: any) => h.key === fieldKey)
  const fieldTitle = header?.title || fieldKey

  // Convert newValue to correct type (int, number, boolean) so it is stored and saved as such
  const itemSchema = getItemSchemaForTypeConversion(tableKey)
  const fieldType = itemSchema?.properties?.[fieldKey]?.type ?? header?.type
  const typedNewValue =
    fieldType != null ? convertFieldValue(newValue, fieldType) : newValue

  tableChanges.recordChange(
    tableKey,
    rowId,
    fieldKey,
    oldValue,
    typedNewValue,
    fieldTitle,
    table?.title,
  )

  // Emit event to parent
  emit(
    'pending-changes-update',
    tableChanges.hasChanges.value,
    tableChanges.totalChangesCount.value,
  )
}

// Check if a cell is modified
const isCellModified = (rowId: string | number, fieldKey: string): boolean => {
  if (!props.enableExcelMode) return false
  const table = currentTable.value
  if (!table.key) return false
  return tableChanges.isCellModified(table.key, rowId, fieldKey)
}

// Get the modified value for a cell
const getModifiedValue = (rowId: string | number, fieldKey: string): any => {
  if (!props.enableExcelMode) return undefined
  const table = currentTable.value
  if (!table.key) return undefined

  const changes = tableChanges.getChangesForTable(table.key)
  if (!changes) return undefined

  const rowChanges = changes[String(rowId)]
  if (!rowChanges) return undefined

  const fieldChange = rowChanges[fieldKey]
  if (!fieldChange) return undefined

  return fieldChange.newValue
}

// Row class for pending changes: new rows green, deleted rows red (Excel mode only)
const getRowClass = (item: any): string => {
  if (!props.enableExcelMode || !item) return ''
  const tableKey = currentTable.value?.key
  if (!tableKey) return ''
  return tableChanges.getRowClass(tableKey, item)
}

// Open pending changes review modal
const openPendingChangesModal = () => {
  showPendingChangesModal.value = true
}

// Close pending changes modal and clear validation error
const handleClosePendingChangesModal = () => {
  saveValidationError.value = null
  showPendingChangesModal.value = false
}

// Handle save all changes from modal (apply edits + creates + deletes to JSON only; no API)
const handleSaveAllChanges = async () => {
  if (!props.execution?.instance?.data) return

  saveValidationError.value = null
  savingChanges.value = true

  try {
    const instance = props.execution.instance
    const previousData = JSON.parse(JSON.stringify(instance.data))

    // Build updated data: apply cell edits, then remove deletes, then add creates (JSON only)
    const updatedData = JSON.parse(JSON.stringify(instance.data))

    const allTableKeys = new Set([
      ...Object.keys(updatedData),
      ...tableChanges.modifiedTableKeys.value,
    ])

    allTableKeys.forEach((tableKey) => {
      if (!updatedData[tableKey]) updatedData[tableKey] = []

      let tableRows = [...updatedData[tableKey]]

      // 1. Remove pending deletes
      const deletes = tableChanges.getPendingDeletes(tableKey)
      if (deletes.length > 0) {
        const deleteSet = new Set(deletes.map(String))
        tableRows = tableRows.filter(
          (row: any) => !deleteSet.has(String(row.id)),
        )
      }

      // 2. Apply cell edits
      const changes = tableChanges.getChangesForTable(tableKey)
      if (changes) {
        tableRows = tableRows.map((row: any) => {
          const rowChanges = changes[String(row.id)]
          if (!rowChanges) return row
          const merged = { ...row }
          Object.entries(rowChanges).forEach(
            ([fieldKey, change]: [string, any]) => {
              merged[fieldKey] = change.newValue
            },
          )
          return merged
        })
      }

      // 3. Add pending creates (with new id for JSON)
      const creates = tableChanges.getPendingCreates(tableKey)
      creates.forEach((c) => {
        const newId = generateSecureId(tableKey)
        const row = convertDataTypesBasedOnSchema(
          { ...c.data, id: newId },
          tableKey,
        )
        tableRows.push(row)
      })

      updatedData[tableKey] = tableRows
    })

    // Write back to instance.data
    Object.keys(updatedData).forEach((tableKey) => {
      instance.data[tableKey] = updatedData[tableKey]
    })

    const validationErrors = await instance.checkSchema()

    if (validationErrors && validationErrors.length > 0) {
      Object.keys(previousData).forEach((tableKey) => {
        instance.data[tableKey] = previousData[tableKey]
      })
      saveValidationError.value = formatValidationErrorsWithTitle(
        t('projectExecution.steps.step3.loadInstance.instanceSchemaError'),
        validationErrors,
        t,
      )
      return
    }

    emit('save-changes', instance.data)
    tableChanges.clearAllChanges()
    showPendingChangesModal.value = false
  } finally {
    savingChanges.value = false
  }
}

// Get original row value (from instance data, before pending changes) for modal edit
const getOriginalRowValue = (
  tableKey: string,
  rowId: string,
  fieldKey: string,
): any => {
  const tableData = props.execution?.instance?.data?.[tableKey]
  if (!tableData) return undefined
  const row = tableData.find((item: any) => String(item.id) === String(rowId))
  return row?.[fieldKey]
}

// Handle edit from modal (update or add a change)
const handleModalUpdateChange = (
  tableKey: string,
  rowId: string,
  fieldKey: string,
  newValue: any,
) => {
  const existing =
    tableChanges.getChangesForTable(tableKey)?.[String(rowId)]?.[fieldKey]
  const oldValue = existing
    ? existing.oldValue
    : getOriginalRowValue(tableKey, rowId, fieldKey)
  const table = instanceTables.value.find((t) => t.key === tableKey)
  const header = table?.headers?.find((h: any) => h.key === fieldKey)
  const fieldTitle = header?.title || fieldKey
  const itemSchema = getItemSchemaForTypeConversion(tableKey)
  const fieldType = itemSchema?.properties?.[fieldKey]?.type ?? header?.type
  const typedNewValue =
    fieldType != null ? convertFieldValue(newValue, fieldType) : newValue
  tableChanges.recordChange(
    tableKey,
    rowId,
    fieldKey,
    oldValue,
    typedNewValue,
    fieldTitle,
    table?.title,
  )
  emit(
    'pending-changes-update',
    tableChanges.hasChanges.value,
    tableChanges.totalChangesCount.value,
  )
}

// Handle revert change from modal
const handleRevertChange = (
  tableKey: string,
  rowId: string,
  fieldKey: string,
) => {
  const change = tableChanges.revertChange(tableKey, rowId, fieldKey)
  if (change && props.execution?.instance?.data?.[tableKey]) {
    // Revert the value in the actual data
    const tableData = props.execution.instance.data[tableKey]
    const rowIndex = tableData.findIndex(
      (item: any) => String(item.id) === rowId,
    )
    if (rowIndex !== -1) {
      tableData[rowIndex][fieldKey] = change.oldValue
    }
  }
  emit(
    'pending-changes-update',
    tableChanges.hasChanges.value,
    tableChanges.totalChangesCount.value,
  )
}

// Handle revert row from modal
const handleRevertRow = (tableKey: string, rowId: string) => {
  const changes = tableChanges.revertRowChanges(tableKey, rowId)
  if (changes && props.execution?.instance?.data?.[tableKey]) {
    // Revert all values in the actual data
    const tableData = props.execution.instance.data[tableKey]
    const rowIndex = tableData.findIndex(
      (item: any) => String(item.id) === rowId,
    )
    if (rowIndex !== -1) {
      Object.entries(changes).forEach(([fieldKey, change]) => {
        tableData[rowIndex][fieldKey] = change.oldValue
      })
    }
  }
  emit(
    'pending-changes-update',
    tableChanges.hasChanges.value,
    tableChanges.totalChangesCount.value,
  )
}

// Handle revert table from modal
const handleRevertTable = (tableKey: string) => {
  const changes = tableChanges.revertTableChanges(tableKey)
  if (changes && props.execution?.instance?.data?.[tableKey]) {
    // Revert all values in the actual data
    const tableData = props.execution.instance.data[tableKey]
    Object.entries(changes).forEach(([rowId, rowChanges]) => {
      const rowIndex = tableData.findIndex(
        (item: any) => String(item.id) === rowId,
      )
      if (rowIndex !== -1) {
        Object.entries(rowChanges).forEach(([fieldKey, change]) => {
          tableData[rowIndex][fieldKey] = change.oldValue
        })
      }
    })
  }
  emit(
    'pending-changes-update',
    tableChanges.hasChanges.value,
    tableChanges.totalChangesCount.value,
  )
}

// Handle revert all from modal
const handleRevertAll = () => {
  // Get all changes before clearing
  const allChanges = tableChanges.getAllChanges()

  // Revert all values in the actual data
  if (props.execution?.instance?.data) {
    Object.entries(allChanges).forEach(([tableKey, tableChangesData]) => {
      const tableData = props.execution.instance.data[tableKey]
      if (tableData) {
        Object.entries(tableChangesData).forEach(([rowId, rowChanges]) => {
          const rowIndex = tableData.findIndex(
            (item: any) => String(item.id) === rowId,
          )
          if (rowIndex !== -1) {
            Object.entries(rowChanges).forEach(([fieldKey, change]) => {
              tableData[rowIndex][fieldKey] = change.oldValue
            })
          }
        })
      }
    })
  }

  tableChanges.clearAllChanges()
  emit('pending-changes-update', false, 0)
}

// Get row identifiers for the modal
const getRowIdentifiers = computed(() => {
  const identifiers: Record<string, Record<string, string>> = {}

  instanceTables.value.forEach((table) => {
    identifiers[table.key] = {}
    table.items.forEach((item: any) => {
      // Try to find a meaningful identifier
      const idFields = ['name', 'nombre', 'code', 'codigo', 'title', 'titulo']
      let identifier = String(item.id)

      for (const field of idFields) {
        if (item[field]) {
          identifier = String(item[field])
          break
        }
      }

      identifiers[table.key][String(item.id)] = identifier
    })
  })

  return identifiers
})

// Get all rows data for the modal to show context
const getRowsData = computed(() => {
  const rowsData: Record<string, Record<string, any>> = {}

  instanceTables.value.forEach((table) => {
    rowsData[table.key] = {}
    table.items.forEach((item: any) => {
      rowsData[table.key][String(item.id)] = { ...item }
    })
  })

  return rowsData
})

// Get table headers for the modal (with type for editable inputs)
const getTableHeaders = computed(() => {
  const headers: Record<
    string,
    Array<{ key: string; title: string; type?: string }>
  > = {}

  instanceTables.value.forEach((table) => {
    headers[table.key] = table.headers
      .filter((h: any) => h.key !== 'selection')
      .map((h: any) => ({
        key: h.key,
        title: h.title,
        type: h.type === 'integer' ? 'number' : h.type,
      }))
  })

  return headers
})

// Methods
const handleCheckData = () => {
  checksLaunched.value = true
  emit('check-data')
}

// Expose methods for parent component
defineExpose({
  hasPendingChanges,
  pendingChangesCount,
  openPendingChangesModal,
  clearAllChanges: tableChanges.clearAllChanges,
})
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

/* Master table match styles */
.tab-with-indicator {
  display: flex !important;
  align-items: center !important;
}

.tab-label {
  display: inline-block;
}

.match-indicator {
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}

.master-match-action-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: linear-gradient(
    90deg,
    rgba(251, 140, 0, 0.08) 0%,
    rgba(251, 140, 0, 0.02) 100%
  );
  border-bottom: 1px solid rgba(251, 140, 0, 0.2);
  flex-wrap: wrap;
  gap: 8px;
}

.match-info {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
}

.match-text {
  font-size: 0.875rem;
  color: var(--subtitle);
}

.match-text strong {
  color: var(--title);
}

.diff-badges {
  display: flex;
  align-items: center;
}

.match-actions {
  display: flex;
  align-items: center;
}

.match-actions .v-btn-toggle {
  border-radius: 4px;
}

.match-actions .v-btn-toggle .v-btn {
  text-transform: none;
  font-size: 0.75rem;
}

/* Responsive adjustments */
@media (max-width: 960px) {
  .master-match-action-bar {
    flex-direction: column;
    align-items: flex-start;
  }

  .match-actions {
    width: 100%;
    justify-content: flex-end;
    margin-top: 8px;
  }
}
</style>
<style src="@/assets/styles/components/core/PendingChangesBar.css"></style>
