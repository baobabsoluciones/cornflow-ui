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
          <CoreTabs v-model="selectedTableKey" color="primary">
            <CoreTab
              v-for="table in instanceTables"
              :key="table.key"
              :value="table.key"
              :title="resolveTitle(table.title as any, formatTitle(table.key))"
            >
              <span class="tab-title-row">
                <span class="tab-leading-indicators">
                  <!-- Validation check: icon left of title (warning vs blocking error) -->
                  <v-tooltip v-if="table.isValidationTable" location="top">
                    <template #activator="{ props: tooltipProps }">
                      <v-icon
                        v-bind="tooltipProps"
                        size="20"
                        :class="
                          table.isWarning
                            ? 'check-data-tab-icon check-data-tab-icon--warning'
                            : 'check-data-tab-icon check-data-tab-icon--error'
                        "
                      >
                        {{ table.isWarning ? 'mdi-alert' : 'mdi-close-octagon' }}
                      </v-icon>
                    </template>
                    <span>{{
                      table.isWarning
                        ? t('sectionView.validationWarningTab')
                        : t('sectionView.validationErrorTab')
                    }}</span>
                  </v-tooltip>
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
                        class="match-indicator"
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
                </span>
                <span class="tab-label">{{ table.title }}</span>
              </span>
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
              <!-- Non-ETL mode: show Use Master and optionally Replace Master (overwrite DB with uploaded) -->
              <template v-if="!externalEtlFlow">
                <v-divider vertical class="mx-2"></v-divider>
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
                  v-if="currentTableMatch.showReplaceMasterOption"
                  size="small"
                  variant="outlined"
                  color="warning"
                  class="mr-2"
                  :class="{
                    'v-btn--active':
                      currentTableMatch.userChoice === 'replace_master',
                  }"
                  @click="showReplaceMasterConfirmDialog = true"
                >
                  <v-tooltip activator="parent" location="top">
                    {{ t('masterTableMatch.option.replaceMaster.description') }}
                  </v-tooltip>
                  <v-icon start size="small">mdi-database-sync</v-icon>
                  {{ t('masterTableMatch.option.replaceMaster.short') }}
                </v-btn>
              </template>
            </div>
          </div>

          <!-- ETL metadata info bar (shown when ETL flow is active, for non-parameter tables) -->
          <div
            v-if="
              externalEtlFlow &&
              currentTableSwitchState &&
              !isCurrentTableParameterTable
            "
            class="etl-metadata-bar"
            :class="`etl-metadata-bar--${currentTableSwitchState.variant}`"
          >
            <div class="etl-metadata-bar__info">
              <v-icon size="16" class="mr-2">{{ etlInfoIcon }}</v-icon>
              <span class="etl-metadata-bar__text">{{ etlInfoText }}</span>
            </div>
            <div class="etl-metadata-bar__action">
              <!-- from_db: Static mode / Track changes with tooltips -->
              <template v-if="currentTableSwitchState.variant === 'from_db'">
                <v-tooltip :text="$t('externalEtl.switch.staticModeTooltip')" location="top" max-width="260">
                  <template #activator="{ props: tooltipProps }">
                    <span
                      v-bind="tooltipProps"
                      class="etl-metadata-bar__switch-label etl-metadata-bar__switch-label--tooltipable"
                      :class="{ 'etl-metadata-bar__switch-label--active': !etlSwitchModelValue }"
                    >{{ $t('externalEtl.switch.staticMode') }}</span>
                  </template>
                </v-tooltip>
                <v-switch
                  :model-value="etlSwitchModelValue"
                  @update:model-value="handleEtlSwitchChange(currentTable.key, $event)"
                  density="compact"
                  hide-details
                  color="primary"
                  class="etl-metadata-bar__switch"
                />
                <v-tooltip :text="$t('externalEtl.switch.trackChangesTooltip')" location="top" max-width="260">
                  <template #activator="{ props: tooltipProps }">
                    <span
                      v-bind="tooltipProps"
                      class="etl-metadata-bar__switch-label etl-metadata-bar__switch-label--tooltipable"
                      :class="{ 'etl-metadata-bar__switch-label--active': etlSwitchModelValue }"
                    >{{ $t('externalEtl.switch.trackChanges') }}</span>
                  </template>
                </v-tooltip>
              </template>
              <!-- from_excel / edited_from_db / reuploaded: Use excel data / Use database data -->
              <template v-else>
                <span
                  class="etl-metadata-bar__switch-label"
                  :class="{ 'etl-metadata-bar__switch-label--active': !etlSwitchModelValue }"
                >{{ $t('externalEtl.switch.useExcelData') }}</span>
                <v-switch
                  :model-value="etlSwitchModelValue"
                  @update:model-value="handleEtlSwitchChange(currentTable.key, $event)"
                  density="compact"
                  hide-details
                  color="primary"
                  class="etl-metadata-bar__switch"
                />
                <span
                  class="etl-metadata-bar__switch-label"
                  :class="{ 'etl-metadata-bar__switch-label--active': etlSwitchModelValue }"
                >{{ $t('externalEtl.switch.useDbData') }}</span>
              </template>
            </div>
          </div>

          <v-card-text class="table-card-content">
            <CoreTable
              :items="windowedCurrentItems"
              :has-more="windowedHasMore"
              @load-more="loadMoreWindow"
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
              :can-add="
                !readOnly &&
                !currentTable.isValidationTable &&
                !currentTable.isObjectTable
              "
              :can-edit="!readOnly && !currentTable.isValidationTable"
              :can-delete="
                !readOnly &&
                !currentTable.isValidationTable &&
                !currentTable.isObjectTable
              "
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
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGeneralStore } from '@cornflow-ui/core/stores/general'
import CoreTable from '@cornflow-ui/core/components/core/table/CoreTable.vue'
import CoreTab from '@cornflow-ui/core/components/core/CoreTab.vue'
import CoreTabs from '@cornflow-ui/core/components/core/CoreTabs.vue'
import CoreConfirmDialog from '@cornflow-ui/core/components/core/table/CoreConfirmDialog.vue'
import PendingChangesReviewModal from '@cornflow-ui/core/components/core/PendingChangesReviewModal.vue'
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
} from '@cornflow-ui/core/utils/tableFilterUtils'
import {
  transformJsonSchemaToAutomationFormat,
  stripInvisibleParameterPropertiesFromInstanceData,
} from '@cornflow-ui/core/utils/schemaUtils'
import { resolveTitle } from '@cornflow-ui/core/utils/i18nUtils'
import {
  resolveEtlParamKey,
  applyEtlParameterSwitch,
  normalizeTableNameForLookup,
  turnOffEtlParameterFromDbSwitchAfterManualValueEdit,
} from '@cornflow-ui/core/utils/etlParameterSwitch'
import {
  OBJECT_TABLE_ROW_ID,
  formatTitle,
  createParameterTableVertical,
  createObjectTableObject,
  createValidationTables,
  createTableObject,
  injectParameterSwitchColumns,
} from '@cornflow-ui/core/utils/executionTableBuilders'
import { useTableChanges } from '@cornflow-ui/core/composables/useTableChanges'
import { formatValidationErrorsWithTitle } from '@cornflow-ui/core/utils/errorFormatting'
import {
  getMasterDataTableRankByDrawerHierarchy,
  normalizeTableKeyForHierarchyMatch,
} from '@cornflow-ui/core/services/FrontendAutomationService'

// Props
interface Props {
  execution?: any
  canCheckData?: boolean
  checksFinished?: boolean
  checksError?: boolean
  /** Set by parent while create + data-check requests run; avoids stale prop timing vs checksLaunched */
  checksInProgress?: boolean
  readOnly?: boolean
  masterTableMatches?: any[]
  enableExcelMode?: boolean
  externalEtlFlow?: any | null
  /** Instance checks schema (instanceChecksSchema from SchemaConfig). Used to determine which check tables are warnings (is_warning: true). */
  checksSchema?: any | null
}

const props = withDefaults(defineProps<Props>(), {
  canCheckData: false,
  checksFinished: false,
  checksError: false,
  checksInProgress: false,
  readOnly: false,
  masterTableMatches: () => [],
  enableExcelMode: true,
  externalEtlFlow: null,
  checksSchema: null,
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
/** Stable tab id (schema / table key); avoids CoreTabs registry corruption when instanceTables reorder */
const selectedTableKey = ref<string | undefined>(undefined)
// Each table has its own search and filters.
// `searchValue` updates immediately for the input display; `debouncedSearchValue`
// lags ~250ms and is what feeds `applyFiltersAndSearch`, so each keystroke on a
// 500k-row table doesn't re-run the full filter pass.
const tableStates = ref<
  Record<
    string,
    {
      searchValue: string
      debouncedSearchValue: string
      activeFilters: FilterCondition[]
    }
  >
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

// Helper function to get or create table state
const getTableState = (tableKey: string) => {
  if (!tableStates.value[tableKey]) {
    tableStates.value[tableKey] = {
      searchValue: '',
      debouncedSearchValue: '',
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
    state.debouncedSearchValue,
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

/** Subscribe `instanceTables` to ETL param switch mutations (row `__etl_from_db__` is set at build time). */
const etlParameterSwitchesSignature = computed(() => {
  const sw = props.externalEtlFlow?.parameterSwitches
  if (!sw || typeof sw !== 'object') return ''
  return Object.keys(sw)
    .sort((a, b) => a.localeCompare(b))
    .map((k) => `${k}:${String(sw[k])}`)
    .join('|')
})

// Computed
const instanceTables = computed(() => {
  // Read the signature so this recomputes when ETL parameter switches change.
  // (The guard never triggers — the signature is always a string — it only
  // registers the reactive dependency without a bare/void expression.)
  if (etlParameterSwitchesSignature.value === undefined) return []

  const execution = props.execution || generalStore.selectedExecution
  if (!execution?.instance?.data) return []

  const tables: any[] = []

  // If we're in check data mode, show validation tables if they exist
  if (props.canCheckData) {
    // Show validation tables if they exist (don't wait for checks to finish)
    const validationTables = createValidationTables(execution, {
      applyFilters: applyFiltersAndSearch,
      checksSchema: props.checksSchema,
    })
    if (validationTables.length > 0) {
      tables.push(...validationTables)
    }
    return tables
  }

  // Normal mode: show instance data tables in schema order
  const instanceData = execution.instance.data
  const schema = instanceSchema.value
  const rawSchema = execution.instance.schema
  // Schema may be full format { name, instance, solution, config } — use instance.properties when present
  const instanceSchemaRoot =
    rawSchema?.instance &&
    typeof rawSchema.instance === 'object' &&
    rawSchema.instance.properties
      ? rawSchema.instance
      : rawSchema
  const schemaProperties = instanceSchemaRoot?.properties
  const schemaOrder =
    schemaProperties && typeof schemaProperties === 'object'
      ? Object.keys(schemaProperties)
      : []

  const dataKeys = Object.keys(instanceData)
  // Include schema keys that are object-type (parameters, requirements, penalties, etc.) so we show them even when missing or empty in data
  const schemaObjectKeys =
    schemaProperties && typeof schemaProperties === 'object'
      ? Object.entries(schemaProperties)
          .filter(([k, prop]: [string, any]) => {
            if (!prop || typeof prop !== 'object') return false
            // Explicit object type, or has .properties (treat as object config)
            const isObjectType =
              prop.type === 'object' ||
              (prop.properties && typeof prop.properties === 'object')
            // Exclude array tables (they have .items for row schema)
            const isArrayType = prop.type === 'array' && prop.items
            return isObjectType && !isArrayType
          })
          .map(([key]) => key)
      : []
  const seen = new Set<string>()
  const orderedKeys: string[] = []
  schemaOrder
    .filter((k) => dataKeys.includes(k))
    .forEach((k) => {
      if (!seen.has(k)) {
        orderedKeys.push(k)
        seen.add(k)
      }
    })
  schemaObjectKeys.forEach((k) => {
    if (!seen.has(k)) {
      orderedKeys.push(k)
      seen.add(k)
    }
  })
  dataKeys.forEach((k) => {
    if (!seen.has(k)) {
      orderedKeys.push(k)
      seen.add(k)
    }
  })

  orderedKeys.forEach((tableKey) => {
    const baseData = instanceData[tableKey]
    const objectSchema = instanceSchemaRoot?.properties?.[tableKey]
    const hasObjectSchema =
      objectSchema?.properties && typeof objectSchema.properties === 'object'
    const isSchemaObjectKey = schemaObjectKeys.includes(tableKey)
    const isPlainObject =
      baseData != null &&
      typeof baseData === 'object' &&
      !Array.isArray(baseData)
    // Object-type keys (parameters, requirements, penalties, etc.)
    if (isSchemaObjectKey || (hasObjectSchema && isPlainObject)) {
      const objectData = isPlainObject ? { ...baseData } : {}
      const isParameterTableWithEtl =
        props.externalEtlFlow &&
        props.externalEtlFlow.parameterTableNames?.has(tableKey)
      const table = isParameterTableWithEtl
        ? createParameterTableVertical(tableKey, objectData, instanceSchemaRoot, {
            t,
            instanceSchema: props.execution?.instance?.schema,
            etlFlow: props.externalEtlFlow,
          })
        : createObjectTableObject(tableKey, objectData, instanceSchemaRoot, {
            instanceSchema: props.execution?.instance?.schema,
          })
      tables.push(table)
      return
    }
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
      { applyFilters: applyFiltersAndSearch },
    )
    if (tableObject) {
      if (
        props.externalEtlFlow &&
        props.externalEtlFlow.parameterTableNames?.has(tableKey)
      ) {
        injectParameterSwitchColumns(tableObject, tableKey, {
          t,
          etlFlow: props.externalEtlFlow,
        })
      }
      tables.push(tableObject)
    }
  })

  // Tab order: master-matched tables first using the same hierarchy order as AppDrawer
  // (Section -> Group -> Table), then others keep schema/data order.
  if (
    props.masterTableMatches &&
    props.masterTableMatches.length > 0 &&
    !props.canCheckData
  ) {
    const masterDataConfig = generalStore.getConfigurations?.masterData || {}
    const masterRankByKey = getMasterDataTableRankByDrawerHierarchy(
      masterDataConfig,
      generalStore.masterDataSections ?? undefined,
      generalStore.masterDataGroups ?? undefined,
    )
    const matches = props.masterTableMatches as Array<{
      tableKey: string
      masterTableConfig?: { order?: number }
    }>
    const hasMasterMatch = (tableKey: string) =>
      matches.some((m) => m.tableKey === tableKey)
    const getMasterOrderRank = (tableKey: string): number => {
      const rankByHierarchy = masterRankByKey.get(
        normalizeTableKeyForHierarchyMatch(tableKey),
      )
      if (typeof rankByHierarchy === 'number') return rankByHierarchy
      const m = matches.find((x) => x.tableKey === tableKey)
      const o = m?.masterTableConfig?.order
      return typeof o === 'number' && !Number.isNaN(o)
        ? o
        : Number.MAX_SAFE_INTEGER
    }
    const indexed = tables.map((t, i) => ({ t, i }))
    indexed.sort((a, b) => {
      const ha = hasMasterMatch(a.t.key)
      const hb = hasMasterMatch(b.t.key)
      if (ha && !hb) return -1
      if (!ha && hb) return 1
      if (ha && hb) {
        const ra = getMasterOrderRank(a.t.key)
        const rb = getMasterOrderRank(b.t.key)
        if (ra !== rb) return ra - rb
      }
      return a.i - b.i
    })
    return indexed.map(({ t }) => t)
  }

  return tables
})

// After table-building helpers (createTableObject, createValidationTables, …) so
// immediate watch does not evaluate instanceTables while those consts are still in TDZ.
watch(
  () => instanceTables.value.map((t) => t.key),
  (keys) => {
    if (keys.length === 0) {
      selectedTableKey.value = undefined
      return
    }
    const current = selectedTableKey.value
    if (current === undefined || !keys.includes(current)) {
      selectedTableKey.value = keys[0]
    }
  },
  { immediate: true },
)

const currentTable = computed(() => {
  if (instanceTables.value.length === 0)
    return { headers: [], items: [], key: '' }
  const key = selectedTableKey.value
  const byKey =
    key === undefined
      ? undefined
      : instanceTables.value.find((t) => t.key === key)
  return byKey ?? instanceTables.value[0]
})

/**
 * Client-side windowing for the visible table. `currentTable.items` can be
 * hundreds of thousands of rows on heavy ETL uploads; even though `CoreTable`
 * virtualizes the DOM via `v-data-table-virtual`, Vuetify's internal
 * sort/filter pipeline iterates the full array on mount and freezes the UI.
 * We slice to a small initial window and grow it via `@load-more` (reusing
 * the infinite-scroll wiring already in `CoreTable`). Same pattern as
 * `useTableData` for SectionView instance/solution tables.
 */
const EXECUTION_WINDOW_PAGE_SIZE = 200
const executionWindowSize = ref(EXECUTION_WINDOW_PAGE_SIZE)

// Reset to the first page whenever the visible (filtered) items reference
// changes — switching tab, applying a filter, editing a row that causes a
// re-filter. Watching the reference (not deep) keeps this cheap.
watch(
  () => currentTable.value.items,
  () => {
    executionWindowSize.value = EXECUTION_WINDOW_PAGE_SIZE
  },
)

const windowedCurrentItems = computed(() => {
  const items = currentTable.value.items
  if (!Array.isArray(items)) return items
  return items.slice(0, executionWindowSize.value)
})

const windowedHasMore = computed(() => {
  const items = currentTable.value.items
  return Array.isArray(items) && executionWindowSize.value < items.length
})

const loadMoreWindow = () => {
  executionWindowSize.value += EXECUTION_WINDOW_PAGE_SIZE
}

const currentTableState = computed(() => {
  const table = currentTable.value
  if (!table.key)
    return { searchValue: '', debouncedSearchValue: '', activeFilters: [] }
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

const currentTableSwitchState = computed(() => {
  if (!props.externalEtlFlow) return null
  const key = currentTable.value?.key
  if (!key) return null
  return props.externalEtlFlow.tableSwitches[key] ?? null
})

const isCurrentTableParameterTable = computed(() => {
  if (!props.externalEtlFlow) return false
  const key = currentTable.value?.key
  if (!key) return false
  return props.externalEtlFlow.parameterTableNames?.has(key) ?? false
})

const etlInfoIcon = computed(() => {
  const variant = currentTableSwitchState.value?.variant
  switch (variant) {
    case 'from_db':
      return 'mdi-database'
    case 'from_excel':
      return 'mdi-file-excel'
    case 'edited_from_db':
      return 'mdi-database-edit'
    case 'reuploaded':
      return 'mdi-file-replace'
    default:
      return 'mdi-table'
  }
})

const etlInfoText = computed(() => {
  const variant = currentTableSwitchState.value?.variant
  switch (variant) {
    case 'from_db':
      return t('externalEtl.switch.fromDbLabel')
    case 'from_excel':
      return t('externalEtl.switch.fromExcelLabel')
    case 'edited_from_db':
      return t('externalEtl.switch.editedFromDbLabel')
    case 'reuploaded':
      return t('externalEtl.switch.reuploadedLabel')
    default:
      return ''
  }
})

const etlSwitchLabel = computed(() => {
  const variant = currentTableSwitchState.value?.variant
  switch (variant) {
    case 'from_db':
      return t('externalEtl.switch.fixTable')
    case 'from_excel':
    case 'edited_from_db':
    case 'reuploaded':
      return t('externalEtl.switch.replaceWithDb')
    default:
      return ''
  }
})

/** Unified: switch ON = track changes (fixed: false), switch OFF = static mode (fixed: true/null). */
const etlSwitchModelValue = computed(() => {
  const state = currentTableSwitchState.value
  if (!state) return false
  return state.fixed === false
})

function handleEtlSwitchChange(tableKey: string, value: boolean | null) {
  if (!props.externalEtlFlow) return
  const switchState = props.externalEtlFlow.tableSwitches[tableKey]
  if (!switchState) return
  // Unified: switch ON = track changes (fixed: false), switch OFF = static mode (fixed: true)
  switchState.fixed = value !== true
}

function handleEtlParameterChange(paramKey: string, value: boolean | null) {
  if (!props.externalEtlFlow) return
  props.externalEtlFlow.parameterSwitches[paramKey] = value
}

/**
 * Handle cell change for ETL parameter switch columns in the table.
 * Vertical parameter table: rowId is the parameter key, paramKey = tableKey.rowId.
 * Array-type: paramKey = tableKey.paramName (from row.name/ID/key).
 */
function handleEtlParameterCellChange(
  tableKey: string,
  rowId: string | number,
  fieldKey: string,
  newValue: any,
) {
  if (!props.externalEtlFlow) return

  const table = instanceTables.value.find((t) => t.key === tableKey)
  const row = table?.items.find(
    (item: any) => String(item.id) === String(rowId),
  )
  if (!row) return

  const paramKey = resolveEtlParamKey(table, row, tableKey, rowId, fieldKey)
  if (paramKey == null) return

  const switchState = props.externalEtlFlow.tableSwitches[tableKey]
  const isReuploaded = switchState?.variant === 'reuploaded'

  applyEtlParameterSwitch(props.externalEtlFlow, paramKey, fieldKey, newValue, isReuploaded)
}

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

  const shouldHideFieldFromForm = (header: any): boolean => {
    // Internal/non-data column
    if (header.key === 'selection') return true
    // Explicitly hidden from schema/config
    if (header.hidden === true) return true
    // Raw FK ids used with columnsToJoin should stay technical (user edits display fields instead)
    if (
      header.isForeignKey &&
      Array.isArray(header.columnsToJoin) &&
      header.columnsToJoin.length > 0
    ) {
      return true
    }
    return false
  }

  // Convert headers to form fields format with validation rules and dropdown config (choices, joinFrom)
  return table.headers
    .filter((header: any) => !shouldHideFieldFromForm(header))
    .map((header: any) => ({
      key: header.key,
      title: header.title,
      type: header.type,
      required: header.required || false,
      frontendReadOnly: header.key === 'id',
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
  if (props.checksInProgress) return true
  return checksLaunched.value && !props.checksFinished && !props.checksError
})

watch(
  () =>
    [props.checksInProgress, props.checksFinished, props.checksError] as const,
  ([inProgress, finished, error]) => {
    if (!inProgress && (finished || error)) {
      checksLaunched.value = false
    }
  },
)

// Wrapper for getOperatorText to provide t function
const getOperatorText = (operator: string): string => {
  return getOperatorTextUtil(operator, t)
}

// Event handlers for CoreTable
//
// Search input flow:
//   - `state.searchValue` updates synchronously so the textbox stays
//     responsive (controlled input).
//   - `state.debouncedSearchValue` updates ~250ms after the user stops
//     typing; that's the value that drives `applyFiltersAndSearch`.
//     Without this, every keystroke re-ran the full filter pass over the
//     entire table (catastrophic on 500k-row Excel uploads).
const SEARCH_DEBOUNCE_MS = 250
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null
const handleSearch = (value: string) => {
  const table = currentTable.value
  if (!table.key) return
  const state = getTableState(table.key)
  state.searchValue = value
  const targetKey = table.key
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
  searchDebounceTimer = setTimeout(() => {
    searchDebounceTimer = null
    getTableState(targetKey).debouncedSearchValue = value
  }, SEARCH_DEBOUNCE_MS)
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
  const idsToDelete = new Set(selectedItems.value.map((item) => item.id))

  for (let i = tableData.length - 1; i >= 0; i--) {
    if (idsToDelete.has(tableData[i].id)) {
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
    typeof value === 'number' ? Math.floor(value) : Number.parseInt(String(value), 10)
  return Number.isNaN(result) ? 0 : result
}

// Convert value to number type
const convertToNumber = (value: any): number => {
  const result = typeof value === 'number' ? value : Number.parseFloat(String(value))
  return Number.isNaN(result) ? 0 : result
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
  const masterRs = match?.masterTableConfig?.get_list?.response_schema
  if (masterRs?.items) {
    return masterRs.items
  }
  if (masterRs?.type === 'object' && masterRs.properties) {
    return masterRs
  }
  const execution = props.execution || generalStore.selectedExecution
  const schema = execution?.instance?.schema
  // Schema may be full format { name, instance, solution, config } — use instance.properties when present
  const instanceRoot =
    schema?.instance?.properties == null ? schema : schema.instance
  const propSchema = instanceRoot?.properties?.[tableKey]
  // For array tables use .items; for object-type keys use the property schema itself (so .properties are the field schemas)
  return propSchema?.items ?? propSchema ?? null
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

function applyInlineEditToObjectTable(
  tableData: any,
  table: any,
  editingRowIdVal: any,
) {
  if (table.isParameterTableVertical) {
    const paramKey = editingRowIdVal
    const itemSchema = getItemSchemaForTypeConversion(table.key)
    const fieldSchema = itemSchema?.properties?.[paramKey]
    const typed = fieldSchema
      ? convertFieldValue(
          editingData.value.value,
          fieldSchema.type || 'string',
        )
      : editingData.value.value
    tableData[paramKey] = typed
  } else {
    const converted = convertDataTypesBasedOnSchema(
      { ...editingData.value },
      table.key,
    )
    delete converted.id
    Object.assign(tableData, converted)
  }
}

const saveInlineEdit = () => {
  const table = currentTable.value
  if (!table.key || !props.execution?.instance?.data || !editingRowId.value)
    return

  // Excel mode: cell changes are already in tableChanges; apply to JSON only on Save all
  if (!props.enableExcelMode) {
    const tableData = props.execution.instance.data[table.key]
    if (
      tableData != null &&
      typeof tableData === 'object' &&
      !Array.isArray(tableData)
    ) {
      applyInlineEditToObjectTable(tableData, table, editingRowId.value)
      emit('save-changes', props.execution.instance.data)
    } else {
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

/**
 * Records a cell change with the value coerced to its schema type, and (for ETL vertical
 * parameter `value` edits) turns off the matching "from DB" switch. Shared by handleCellChange
 * and handleModalUpdateChange. Returns the resolved `table` so callers can do extra work
 * (e.g. mirroring editingData) without re-looking it up.
 */
const recordTypedCellChange = (
  tableKey: string,
  rowId: string | number,
  fieldKey: string,
  oldValue: any,
  newValue: any,
): any => {
  const table = instanceTables.value.find((t) => t.key === tableKey)
  const header = table?.headers?.find((h: any) => h.key === fieldKey)
  const fieldTitle = header?.title || fieldKey

  const itemSchema = getItemSchemaForTypeConversion(tableKey)
  let fieldType = itemSchema?.properties?.[fieldKey]?.type ?? header?.type
  if (fieldKey === 'value' && table?.isParameterTableVertical) {
    const row = table?.items.find(
      (item: any) => String(item.id) === String(rowId),
    )
    if (row?.parameter) {
      fieldType = itemSchema?.properties?.[row.parameter]?.type ?? fieldType
    }
  }
  const typedNewValue =
    fieldType == null ? newValue : convertFieldValue(newValue, fieldType)

  tableChanges.recordChange(
    tableKey,
    rowId,
    fieldKey,
    oldValue,
    typedNewValue,
    fieldTitle,
    table?.title,
  )

  if (
    props.externalEtlFlow &&
    table?.isParameterTableVertical &&
    fieldKey === 'value'
  ) {
    turnOffEtlParameterFromDbSwitchAfterManualValueEdit(
      props.externalEtlFlow,
      tableKey,
      rowId,
    )
  }

  return table
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

  // ETL parameter switch columns: update parameterSwitches instead of recording a table change
  if (fieldKey.startsWith('__etl_') && props.externalEtlFlow) {
    handleEtlParameterCellChange(tableKey, rowId, fieldKey, newValue)
    return
  }

  const table = recordTypedCellChange(
    tableKey,
    rowId,
    fieldKey,
    oldValue,
    newValue,
  )

  // ETL vertical parameters: "Desde base de datos" ON => parameterSwitches[key] === false.
  // Manual value edit => fixed (true); `instanceTables` also depends on etlParameterSwitchesSignature so switches re-render.
  if (
    props.externalEtlFlow &&
    table?.isParameterTableVertical &&
    fieldKey === 'value'
  ) {
    // CoreTable keeps `editingData` for the row; `__etl_from_db__` must mirror `parameterSwitches` while editing.
    if (
      editingRowId.value != null &&
      String(editingRowId.value) === String(rowId) &&
      editingTableKey.value === tableKey
    ) {
      editingData.value = { ...editingData.value, __etl_from_db__: false }
    }
  }

  // ETL: table-level "editado manualmente" text only after Save all (handleSaveAllChanges).

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

function applyArrayTableChanges(
  updatedData: any,
  tableKey: string,
) {
  const raw = updatedData[tableKey]
  if (!Array.isArray(raw)) return

  let tableRows = [...raw]

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
}

function applyObjectTableChanges(
  updatedData: any,
  tableKey: string,
) {
  const raw = updatedData[tableKey]
  if (Array.isArray(raw)) return
  if (raw != null && typeof raw !== 'object') return
  const changes = tableChanges.getChangesForTable(tableKey)
  if (!changes) return
  const merged = raw != null && typeof raw === 'object' ? { ...raw } : {}

  const rowChangesHorizontal = changes[OBJECT_TABLE_ROW_ID]
  if (rowChangesHorizontal) {
    Object.entries(rowChangesHorizontal).forEach(
      ([fieldKey, change]: [string, any]) => {
        merged[fieldKey] = change.newValue
      },
    )
  } else {
    // Vertical parameter table: each row id is the parameter key, field 'value'
    for (const rowId of Object.keys(changes)) {
      const rowChanges = changes[rowId]
      if (rowChanges?.value) {
        merged[rowId] = rowChanges.value.newValue
      }
    }
  }
  updatedData[tableKey] = merged
}

function applyEtlTableSwitchesAfterSave(
  modifiedKeysForEtl: string[],
) {
  if (!props.externalEtlFlow) return
  for (const tableKey of modifiedKeysForEtl) {
    const current = props.externalEtlFlow.tableSwitches[tableKey]
    if (current && current.variant === 'from_db') {
      props.externalEtlFlow.tableSwitches[tableKey] = {
        variant: 'edited_from_db',
        fixed: true,
      }
    }
  }
}

// Turn off the "From DB" parameter switch for every manually edited param key in a single table.
function applyEtlParameterSwitchesForTableAfterSave(
  etlFlow: NonNullable<typeof props.externalEtlFlow>,
  tableKey: string,
  changes: Record<string, any>,
) {
  const horizontal = changes[OBJECT_TABLE_ROW_ID]
  if (horizontal) {
    for (const fieldKey of Object.keys(horizontal)) {
      turnOffEtlParameterFromDbSwitchAfterManualValueEdit(
        etlFlow,
        tableKey,
        fieldKey,
      )
    }
    return
  }

  for (const rowId of Object.keys(changes)) {
    if (rowId === OBJECT_TABLE_ROW_ID) continue
    if (!changes[rowId]?.value) continue
    turnOffEtlParameterFromDbSwitchAfterManualValueEdit(
      etlFlow,
      tableKey,
      rowId,
    )
  }
}

function applyEtlParameterSwitchesAfterSave(
  modifiedKeysForEtl: string[],
) {
  const etlFlow = props.externalEtlFlow
  if (!etlFlow) return
  // Parameter "Desde base de datos": false = from DB (switch ON). After user saves a new value, fix it (true = switch OFF).
  const paramTables = etlFlow.parameterTableNames
  if (!paramTables?.size) return
  for (const tableKey of modifiedKeysForEtl) {
    if (!paramTables.has(tableKey)) continue
    const changes = tableChanges.getChangesForTable(tableKey)
    if (!changes) continue
    applyEtlParameterSwitchesForTableAfterSave(etlFlow, tableKey, changes)
  }
}

// Handle save all changes from modal (apply edits + creates + deletes to JSON only; no API)
const handleSaveAllChanges = async () => {
  saveValidationError.value = null

  if (!props.execution?.instance?.data) {
    saveValidationError.value = t('pendingChanges.saveErrorNoInstanceData')
    return
  }

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

    // Apply changes for array-type tables
    allTableKeys.forEach((tableKey) => applyArrayTableChanges(updatedData, tableKey))

    // Apply edits for object-type keys (parameters, requirements, penalties, etc.)
    allTableKeys.forEach((tableKey) => applyObjectTableChanges(updatedData, tableKey))

    const instanceSchemaForStrip = generalStore.schemaConfig?.instanceSchema
    const dataAfterSave = instanceSchemaForStrip
      ? stripInvisibleParameterPropertiesFromInstanceData(
          updatedData,
          instanceSchemaForStrip,
        )
      : updatedData

    // Replace instance.data so the object reference changes; shallow watch on instance.data
    // (e.g. master table re-match) will run after save. In-place mutation would skip it.
    instance.data = dataAfterSave

    const validationErrors = await instance.checkSchema()

    if (validationErrors && validationErrors.length > 0) {
      instance.data = previousData
      saveValidationError.value = formatValidationErrorsWithTitle(
        t('projectExecution.steps.step3.loadInstance.instanceSchemaError'),
        validationErrors,
        t,
      )
      return
    }

    // ETL: only after accepted save — mark DB-sourced tables as manually edited (same rules as useExternalEtlFlow.markTableEdited).
    const modifiedKeysForEtl = [...tableChanges.modifiedTableKeys.value]
    applyEtlTableSwitchesAfterSave(modifiedKeysForEtl)
    applyEtlParameterSwitchesAfterSave(modifiedKeysForEtl)

    emit('save-changes', instance.data)
    tableChanges.clearAllChanges()
    showPendingChangesModal.value = false
    emit('pending-changes-update', false, 0)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    saveValidationError.value = message
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
  if (
    tableData != null &&
    typeof tableData === 'object' &&
    !Array.isArray(tableData)
  ) {
    return fieldKey === 'value' ? tableData[rowId] : undefined
  }
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
  recordTypedCellChange(tableKey, rowId, fieldKey, oldValue, newValue)
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
    const tableData = props.execution.instance.data[tableKey]
    if (Array.isArray(tableData)) {
      const rowIndex = tableData.findIndex(
        (item: any) => String(item.id) === rowId,
      )
      if (rowIndex !== -1) {
        tableData[rowIndex][fieldKey] = change.oldValue
      }
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

/* ETL metadata info bar */
.etl-metadata-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  font-size: 13px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}

.etl-metadata-bar--from_db {
  background: linear-gradient(
    90deg,
    rgba(33, 150, 243, 0.08) 0%,
    rgba(33, 150, 243, 0.02) 100%
  );
}

.etl-metadata-bar--from_excel {
  background: linear-gradient(
    90deg,
    rgba(76, 175, 80, 0.08) 0%,
    rgba(76, 175, 80, 0.02) 100%
  );
}

.etl-metadata-bar--edited_from_db {
  background: linear-gradient(
    90deg,
    rgba(255, 152, 0, 0.08) 0%,
    rgba(255, 152, 0, 0.02) 100%
  );
}

.etl-metadata-bar--reuploaded {
  background: linear-gradient(
    90deg,
    rgba(156, 39, 176, 0.08) 0%,
    rgba(156, 39, 176, 0.02) 100%
  );
}

.etl-metadata-bar__info {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
}

.etl-metadata-bar__text {
  color: var(--subtitle);
  line-height: 1.3;
}

.etl-metadata-bar__action {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  margin-left: 24px;
}

.etl-metadata-bar__switch-label {
  font-size: 12px;
  color: var(--subtitle);
  white-space: nowrap;
  transition: color 0.15s ease, font-weight 0.15s ease;
}

.etl-metadata-bar__switch-label--tooltipable {
  cursor: help;
  text-decoration: underline dotted;
  text-underline-offset: 2px;
}

.etl-metadata-bar__switch-label--active {
  color: var(--title);
  font-weight: 500;
}

.etl-metadata-bar__switch {
  flex-shrink: 0;
}

/* Tab label row: validation / match icons on the left, title truncates after */
.tab-title-row {
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  width: 100%;
  min-width: 0;
}

.tab-leading-indicators {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  gap: 4px;
}

.tab-label {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: start;
}

.check-data-tab-icon--warning {
  color: #e65100 !important;
}

.check-data-tab-icon--error {
  color: #b71c1c !important;
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
<style src="@cornflow-ui/core/assets/styles/components/core/PendingChangesBar.css"></style>
