<template>
  <div class="execution-data-view">
    <!-- Checks of the data (the step of the wizard that runs them) -->
    <div v-if="canCheckData" class="execution-data-view__checks">
      <CoreButton
        variant="outlined"
        size="small"
        icon="mdi-play"
        :text="t('projectExecution.steps.step5.check')"
        :disabled="checksLaunched && !checksFinished"
        @click="handleCheckData"
      />
      <CoreAlert
        v-if="checksFinished && !hasValidationErrors"
        tone="success"
        :message="t('inputOutputData.dataChecksPassedMessage')"
      />
      <CoreAlert
        v-if="isLoadingChecks"
        tone="info"
        icon="mdi-loading"
        :message="t('inputOutputData.dataChecksLoadingMessage')"
      />
      <CoreAlert
        v-if="checksError"
        tone="error"
        :message="t('inputOutputData.dataChecksFailedMessage')"
      />
    </div>

    <div v-if="instanceTables.length > 0" class="execution-data-view__body">
      <CoreDataTable
        ref="dataTable"
        v-model:search="currentSearch"
        v-model:filters="currentFilters"
        v-model:sort="currentSort"
        v-model:selected="selectedIds"
        v-model:fullscreen="fullscreen"
        class="execution-data-view__table"
        :title="currentTable.title"
        :columns="currentColumns"
        :rows="windowedCurrentItems"
        :source-rows="currentSourceRows"
        :cell-value="cellValue"
        :has-more="windowedHasMore"
        :total-count="currentTotalCount"
        :filtered-count="currentFilteredCount"
        :searchable="!isParametersView"
        :filterable="!isParametersView && !isMessageView"
        :editable="isEditableTable"
        :selectable="isEditableTable && !currentTable.isObjectTable"
        :can-add="isEditableTable && !currentTable.isObjectTable"
        :can-delete="isEditableTable && !currentTable.isObjectTable"
        :can-bulk-edit="isEditableTable && !currentTable.isObjectTable"
        :stages-changes="enableExcelMode"
        :row-state="rowState"
        :row-level="rowLevel"
        :cell-modified="(row, key) => isCellModified(row.id, key)"
        :cell-disabled="cellDisabled"
        :row-pinned="rowPinned"
        :options-for="optionsFor"
        :highlighted-row-id="highlightedRowId"
        :pending-count="enableExcelMode && !readOnly ? pendingChangesCount : 0"
        :pending-tables="tableChanges.modifiedTableKeys.value.length"
        fill
        @cell-change="onCellChange"
        @add-row="addRow"
        @delete-rows="deleteRows"
        @restore-rows="restoreRows"
        @bulk-edit="bulkEditRows"
        @need-options="loadOptions"
        @load-more="loadMoreWindow"
        @review="openPendingChangesModal"
        @discard="openPendingChangesModal"
      >
        <template #tabs>
          <DataTableTabs v-model="selectedTabKey" :tabs="tableTabs" />
        </template>
        <template v-if="sourceOrigin || sourceMaster" #strip>
          <TableSourceStrip
            :source-choice="sourceChoice"
            :origin="sourceOrigin"
            :show-source-choice="!!sourceOrigin && !isCurrentTableParameterTable"
            :master="sourceMaster"
            @update:source-choice="setSourceChoice"
            @compare="handleShowComparison"
            @use-master="handleMasterTableAction('use_master')"
            @save-master="handleMasterTableAction('replace_master')"
          />
        </template>
        <template v-if="isParametersView" #body>
          <ParametersTable
            :rows="parameterRows"
            :read-only="!isEditableTable"
            :source-title="parameterSourceTitle"
            @update:value="setParameterValue"
            @update:source="setParameterSource"
            @revert="revertParameter"
          />
        </template>
        <template v-else-if="isMessageView" #body>
          <MessageList :messages="messageRows" :level="currentTable.isWarning ? 'warning' : 'error'" />
        </template>
      </CoreDataTable>

      <PendingChangesPanel
        v-if="enableExcelMode && !readOnly"
        v-model:open="showPendingChangesModal"
        class="execution-data-view__panel"
        :groups="pendingGroups"
        :saving="savingChanges"
        :save-label="t('dataTable.pending.apply')"
        :banner="saveValidationError ? { kind: 'validation', message: saveValidationError } : null"
        @save="handleSaveAllChanges"
        @revert-all="handleRevertAll"
        @revert-table="revertTable"
        @revert-row="revertRow"
        @revert-field="handleRevertChange"
        @update-field="updateReviewField"
        @go-to="goToChange"
        @close-banner="saveValidationError = null"
      />
    </div>

    <CoreEmptyState
      v-else-if="!canCheckData"
      icon="mdi-table-off"
      :title="t('inputOutputData.noDataAvailable')"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGeneralStore } from '@cornflow-ui/core/stores/general'
import CoreAlert from '@cornflow-ui/core/components/core/CoreAlert.vue'
import CoreButton from '@cornflow-ui/core/components/core/CoreButton.vue'
import CoreEmptyState from '@cornflow-ui/core/components/core/CoreEmptyState.vue'
import CoreDataTable from '@cornflow-ui/core/components/core/data-table/CoreDataTable.vue'
import DataTableTabs, {
  type DataTableTab,
} from '@cornflow-ui/core/components/core/data-table/DataTableTabs.vue'
import MessageList from '@cornflow-ui/core/components/core/data-table/MessageList.vue'
import ParametersTable, {
  type ParameterRow,
  type SourceChoice,
} from '@cornflow-ui/core/components/core/data-table/ParametersTable.vue'
import PendingChangesPanel from '@cornflow-ui/core/components/core/data-table/PendingChangesPanel.vue'
import TableSourceStrip, {
  type TableMasterComparison,
  type TableOrigin,
} from '@cornflow-ui/core/components/core/data-table/TableSourceStrip.vue'
import type {
  DataColumn,
  DataColumnOption,
  DataFilter,
  DataRow,
  DataRowState,
  DataSort,
} from '@cornflow-ui/core/components/core/data-table/types'
import { pendingChangeGroups } from '@cornflow-ui/core/composables/core-table/useDataTableChanges'
import {
  cellText,
  columnsFromHeaders,
  isEmptyValue,
  sortRows,
} from '@cornflow-ui/core/utils/dataTable'
import {
  applyFiltersAndSearch as applyFiltersAndSearchUtil,
  generateFrontendRowId,
  type FilterCondition,
} from '@cornflow-ui/core/utils/tableFilterUtils'
import {
  transformJsonSchemaToAutomationFormat,
  stripInvisibleParameterPropertiesFromInstanceData,
  isTableSchemaVisible,
  normalizeJsonSchemaPropertyTypeForUi,
  parseJoinFrom,
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
  /** The comparison with the master tables is still running. */
  masterTableLoading?: boolean
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
  masterTableLoading: false,
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
      sort: DataSort | null
    }
  >
>({})

const selectedItems = ref<any[]>([])

// State for pending changes review modal
const showPendingChangesModal = ref(false)
const savingChanges = ref(false)
const saveValidationError = ref<string | null>(null)

// Computed for pending changes
const hasPendingChanges = computed(() => tableChanges.hasChanges.value)
const pendingChangesCount = computed(() => tableChanges.totalChangesCount.value)


// Helper function to get or create table state
const getTableState = (tableKey: string) => {
  if (!tableStates.value[tableKey]) {
    tableStates.value[tableKey] = {
      searchValue: '',
      debouncedSearchValue: '',
      activeFilters: [],
      sort: null,
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

  const showTablesWithoutSchema =
    generalStore.appConfig?.parameters?.showTablesWithoutSchema === true

  orderedKeys.forEach((tableKey) => {
    const baseData = instanceData[tableKey]
    const objectSchema = instanceSchemaRoot?.properties?.[tableKey]
    if (!isTableSchemaVisible(objectSchema)) return
    // A table matched to a master table is defined by the master config even when the
    // instance schema does not declare it.
    const isDeclared =
      objectSchema != null ||
      !!props.masterTableMatches?.some((m: any) => m.tableKey === tableKey)
    if (!isDeclared && !showTablesWithoutSchema) return
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
 * hundreds of thousands of rows on heavy ETL uploads: the table gets a first
 * window of them and asks for the next one (`load-more`) when scrolled near
 * the end. Same pattern as `useTableData` for SectionView instance/solution
 * tables.
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

const windowedCurrentItems = computed(() => sortedItems.value.slice(0, executionWindowSize.value))

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
    return { searchValue: '', debouncedSearchValue: '', activeFilters: [], sort: null }
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

const handleShowComparison = () => {
  const table = currentTable.value
  if (!table.key) return
  emit('show-comparison', table.key)
}

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

/**
 * Records a cell change with the value coerced to its schema type, and (for ETL vertical
 * parameter `value` edits) turns off the matching "from DB" switch. Shared by handleCellChange
 * and handleModalUpdateChange.
 */
const recordTypedCellChange = (
  tableKey: string,
  rowId: string | number,
  fieldKey: string,
  oldValue: any,
  newValue: any,
): void => {
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

  recordTypedCellChange(tableKey, rowId, fieldKey, oldValue, newValue)

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



// Open pending changes review modal
const openPendingChangesModal = () => {
  showPendingChangesModal.value = true
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
    const newId = generateFrontendRowId(tableKey)
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

// Handle save all changes from modal (apply edits + creates + deletes to JSON only; no API).
// Resolves whether the changes were applied: a schema error keeps them pending.
const handleSaveAllChanges = async (): Promise<boolean> => {
  saveValidationError.value = null

  if (!props.execution?.instance?.data) {
    saveValidationError.value = t('pendingChanges.saveErrorNoInstanceData')
    return false
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
      return false
    }

    // ETL: only after accepted save — mark DB-sourced tables as manually edited (same rules as useExternalEtlFlow.markTableEdited).
    const modifiedKeysForEtl = [...tableChanges.modifiedTableKeys.value]
    applyEtlTableSwitchesAfterSave(modifiedKeysForEtl)
    applyEtlParameterSwitchesAfterSave(modifiedKeysForEtl)

    emit('save-changes', instance.data)
    tableChanges.clearAllChanges()
    showPendingChangesModal.value = false
    emit('pending-changes-update', false, 0)
    return true
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    saveValidationError.value = message
    return false
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




// ── The table of the current tab ────────────────────────────────────────────

const dataTable = ref<InstanceType<typeof CoreDataTable>>()
const fullscreen = ref(false)
const highlightedRowId = ref<string | number | null>(null)

const selectedTabKey = computed<string>({
  get: () => currentTable.value.key ?? '',
  set: (key) => (selectedTableKey.value = key),
})

const isEditableTable = computed(
  () => props.enableExcelMode && !props.readOnly && !currentTable.value.isValidationTable,
)

const currentColumns = computed<DataColumn[]>(() => columnsFromHeaders(currentTable.value.headers ?? []))

/** A cell's value: the pending one when it was edited. */
const cellValue = (row: DataRow, key: string): unknown => {
  const tableKey = currentTable.value.key
  if (!props.enableExcelMode || !tableKey) return row[key]
  return tableChanges.getCurrentValue(tableKey, row.id, key, row[key])
}

const currentSearch = computed<string>({
  get: () => currentTableState.value.searchValue,
  set: (value) => handleSearch(value),
})

const currentFilters = computed<DataFilter[]>({
  get: () => currentTableState.value.activeFilters,
  set: (filters) => {
    const key = currentTable.value.key
    if (key) getTableState(key).activeFilters = filters
  },
})

const currentSort = computed<DataSort | null>({
  get: () => currentTableState.value.sort,
  set: (sort) => {
    const key = currentTable.value.key
    if (key) getTableState(key).sort = sort
  },
})

/** Every row of the table, before the search and filters: the list filters count in them. */
const currentSourceRows = computed<DataRow[]>(() => currentTable.value.originalItems ?? currentTable.value.items ?? [])
const currentTotalCount = computed(() => currentSourceRows.value.length)
const currentFilteredCount = computed(() => (currentTable.value.items ?? []).length)

const selectedIds = computed<Array<string | number>>({
  get: () => selectedItems.value.map((item: any) => item.id),
  set: (ids) => {
    const wanted = new Set(ids.map((id) => cellText(id)))
    selectedItems.value = (currentTable.value.items ?? []).filter((item: any) => wanted.has(cellText(item.id)))
  },
})

const rowState = (row: DataRow): DataRowState | undefined => {
  const tableKey = currentTable.value.key
  if (!props.enableExcelMode || !tableKey) return undefined
  const rowClass = tableChanges.getRowClass(tableKey, row)
  if (rowClass === 'row-deleted') return 'deleted'
  if (rowClass === 'row-new') return 'new'
  return tableChanges.isRowModified(tableKey, row.id) ? 'modified' : undefined
}

const rowLevel = computed(() =>
  currentTable.value.isValidationTable
    ? () => (currentTable.value.isWarning ? 'warning' : 'error')
    : undefined,
)

const headerByKey = computed<Record<string, any>>(() =>
  Object.fromEntries((currentTable.value.headers ?? []).map((header: any) => [header.key, header])),
)

const cellDisabled = (row: DataRow, key: string): boolean => {
  const disabledKey = headerByKey.value[key]?.cellDisabledKey
  return !!disabledKey && !!row[disabledKey]
}

/** Rows whose pin switch is on are highlighted. */
const rowPinned = computed(() => {
  const pin = currentColumns.value.find((column) => column.type === 'switch' && column.key.toLowerCase() === 'fijar')
  return pin ? (row: DataRow) => cellValue(row, pin.key) === true : undefined
})

const sortedItems = computed<DataRow[]>(() => {
  const sort = currentSort.value
  const column = sort ? currentColumns.value.find((c) => c.key === sort.key) : undefined
  return sortRows(currentTable.value.items ?? [], sort, column, cellValue)
})

// ── Editing ─────────────────────────────────────────────────────────────────

const notifyPendingChanges = () =>
  emit('pending-changes-update', tableChanges.hasChanges.value, tableChanges.totalChangesCount.value)

const onCellChange = (row: DataRow, key: string, value: unknown) => {
  const tableKey = currentTable.value.key
  if (!tableKey) return
  if (cellText(row.id).startsWith('create-')) {
    const [typed] = [convertDataTypesBasedOnSchema({ [key]: value }, tableKey)[key]]
    tableChanges.updateCreateField(tableKey, cellText(row.id), key, typed)
    notifyPendingChanges()
    return
  }
  handleCellChange(tableKey, row.id, key, cellValue(row, key), value)
}

/** Adds a row: a pending change in Excel mode, at once in the data otherwise. */
const addRow = (values: Record<string, unknown>) => {
  const table = currentTable.value
  if (!table.key || !props.execution?.instance?.data) return
  const { id: _id, ...data } = convertDataTypesBasedOnSchema(values, table.key)
  if (props.enableExcelMode) {
    tableChanges.recordCreate(table.key, data as Record<string, any>, table.title)
    notifyPendingChanges()
    return
  }
  props.execution.instance.data[table.key].push({ ...data, id: generateFrontendRowId(table.key) })
  emit('save-changes', props.execution.instance.data)
}

/** Deletes rows: marked as pending deletes in Excel mode, removed from the data otherwise. */
const deleteRows = (ids: Array<string | number>) => {
  const table = currentTable.value
  if (!table.key || !props.execution?.instance?.data) return
  const wanted = new Set(ids.map((id) => cellText(id)))
  if (props.enableExcelMode) {
    for (const item of table.items ?? []) {
      if (wanted.has(cellText(item.id))) tableChanges.recordDelete(table.key, item.id, item)
    }
    selectedItems.value = []
    notifyPendingChanges()
    return
  }
  const rows = props.execution.instance.data[table.key]
  for (let i = rows.length - 1; i >= 0; i--) {
    if (wanted.has(cellText(rows[i].id))) rows.splice(i, 1)
  }
  selectedItems.value = []
  emit('save-changes', props.execution.instance.data)
}

const restoreRows = (ids: Array<string | number>) => {
  const tableKey = currentTable.value.key
  if (!tableKey) return
  ids.forEach((id) => tableChanges.revertDelete(tableKey, id))
  notifyPendingChanges()
}

const bulkEditRows = (ids: Array<string | number>, values: Record<string, unknown>) => {
  const wanted = new Set(ids.map((id) => cellText(id)))
  for (const row of currentTable.value.items ?? []) {
    if (!wanted.has(cellText(row.id)) || rowState(row) === 'deleted') continue
    Object.entries(values).forEach(([key, value]) => onCellChange(row, key, value))
  }
}

// ── Options of the references (from the tables of the instance) ─────────────

const referenceOptions = reactive<Record<string, DataColumnOption[]>>({})

watch(
  () => currentTable.value.key,
  () => Object.keys(referenceOptions).forEach((key) => delete referenceOptions[key]),
)

const optionsFor = (column: DataColumn) => referenceOptions[column.key]

const loadOptions = async (column: DataColumn) => {
  if (referenceOptions[column.key]) return
  const join = parseJoinFrom(headerByKey.value[column.key]?.joinFrom ?? '')
  if (!join) {
    referenceOptions[column.key] = column.options ?? []
    return
  }
  const rows = await loadTableDataForCoreTable(join.table)
  const values = [...new Set(rows.map((row: any) => row[join.field]).filter((value: unknown) => !isEmptyValue(value)))]
  referenceOptions[column.key] = values.map((value) => ({ value, label: cellText(value) }))
}

// ── Tabs and the bar of the source ──────────────────────────────────────────

const SOURCE_VARIANTS: Record<string, TableOrigin['variant']> = {
  from_db: 'database',
  from_excel: 'file',
  edited_from_db: 'edited',
  reuploaded: 'reuploaded',
}

const pendingCountOf = (tableKey: string): number => {
  const edits = tableChanges.getChangesForTable(tableKey) ?? {}
  return (
    Object.values(edits).reduce((sum, row) => sum + Object.keys(row).length, 0) +
    tableChanges.getPendingCreates(tableKey).length +
    tableChanges.getPendingDeletes(tableKey).length
  )
}

const tableTabs = computed<DataTableTab[]>(() =>
  instanceTables.value.map((table: any) => {
    const match = getMatchForTable(table.key)
    const variant = props.externalEtlFlow?.tableSwitches[table.key]?.variant
    return {
      key: table.key,
      label: resolveTitle(table.title as any, formatTitle(table.key)),
      rows: (table.originalItems ?? table.items ?? []).length,
      pending: pendingCountOf(table.key),
      level: table.isValidationTable ? (table.isWarning ? 'warning' : 'error') : undefined,
      master: match ? (match.hasDifferences ? 'different' : 'identical') : undefined,
      source: variant ? SOURCE_VARIANTS[variant] : undefined,
    }
  }),
)

const sourceOrigin = computed<TableOrigin | null>(() => {
  const variant = currentTableSwitchState.value?.variant
  if (!variant || !SOURCE_VARIANTS[variant]) return null
  return { variant: SOURCE_VARIANTS[variant], perParameter: isCurrentTableParameterTable.value }
})

const sourceChoice = computed(() => {
  const live = etlSwitchModelValue.value
  if (sourceOrigin.value?.variant === 'database') return live ? 'live' : 'static'
  return live ? 'database' : 'file'
})

const setSourceChoice = (choice: string) => {
  const key = currentTable.value.key
  if (key) handleEtlSwitchChange(key, choice === 'live' || choice === 'database')
}

const sourceMaster = computed<TableMasterComparison | null>(() => {
  const match = currentTableMatch.value
  if (!match || currentTable.value.isValidationTable) return null
  return {
    state: props.masterTableLoading ? 'comparing' : 'ready',
    name: match.masterTableTitle,
    added: match.diffSummary?.onlyInInstance ?? 0,
    removed: match.diffSummary?.onlyInMaster ?? 0,
    modified: match.diffSummary?.different ?? 0,
    canUseMaster: !props.externalEtlFlow,
    canSaveMaster: !props.externalEtlFlow && !!match.showReplaceMasterOption,
  }
})

// ── Tables of one record, as a list of parameters ───────────────────────────

const isParametersView = computed(() => !!currentTable.value.isObjectTable)

const isMessageView = computed(() => {
  const table = currentTable.value
  if (!table.isValidationTable) return false
  const keys = currentColumns.value.map((column) => column.key)
  return keys.length === 1 && keys[0] === 'value'
})

const messageRows = computed(() => sortedItems.value.map((row) => cellText(row.value)))

const parameterSourceTitle = computed(() =>
  currentTableSwitchState.value?.variant === 'reuploaded'
    ? t('dataTable.parameters.originOfValue')
    : t('externalEtl.parameter.columnFromDb'),
)

const parameterColumn = (key: string, title: string, schema: any): DataColumn => {
  const [column] = columnsFromHeaders([
    {
      key,
      title,
      type: schema ? normalizeJsonSchemaPropertyTypeForUi(schema) : 'string',
      choices: schema?.choices ?? schema?.enum,
    },
  ])
  return column
}

const parameterRows = computed<ParameterRow[]>(() => {
  const table = currentTable.value
  if (!table.key || !table.isObjectTable) return []
  const itemSchema = getItemSchemaForTypeConversion(table.key)
  if (table.isParameterTableVertical) {
    const reuploaded = currentTableSwitchState.value?.variant === 'reuploaded'
    return (table.items ?? []).map((row: any) => ({
      id: cellText(row.id),
      label: cellText(row.parameterTitle),
      column: parameterColumn('value', cellText(row.parameterTitle), itemSchema?.properties?.[row.parameter]),
      value: cellValue(row, 'value'),
      modified: isCellModified(row.id, 'value'),
      source: !props.externalEtlFlow
        ? undefined
        : reuploaded
          ? {
              mode: 'choice' as const,
              value: row.__etl_default__ ? 'default' : row.__etl_from_db__ ? 'database' : 'fixed',
              databaseDisabled: !!row.__etl_from_db_disabled__,
            }
          : { mode: 'switch' as const, fromDatabase: !!row.__etl_from_db__, disabled: !!row.__etl_from_db_disabled__ },
    }))
  }
  const [single] = table.items ?? []
  return (table.headers ?? [])
    .filter((header: any) => header.key !== 'selection')
    .map((header: any) => ({
      id: header.key,
      label: cellText(header.title) || formatTitle(header.key),
      column: columnsFromHeaders([header])[0] ?? parameterColumn(header.key, header.title, null),
      value: single ? cellValue(single, header.key) : undefined,
      modified: single ? isCellModified(single.id, header.key) : false,
    }))
})

const parameterRowId = (id: string) => (currentTable.value.isParameterTableVertical ? id : OBJECT_TABLE_ROW_ID)
const parameterField = (id: string) => (currentTable.value.isParameterTableVertical ? 'value' : id)

const setParameterValue = (id: string, value: unknown) => {
  const tableKey = currentTable.value.key
  const row = (currentTable.value.items ?? []).find((item: any) => cellText(item.id) === parameterRowId(id))
  if (!tableKey || !row) return
  handleCellChange(tableKey, row.id, parameterField(id), cellValue(row, parameterField(id)), value)
}

const SOURCE_FIELDS: Record<SourceChoice, string> = {
  default: '__etl_default__',
  database: '__etl_from_db__',
  fixed: '__etl_fixed__',
}

const setParameterSource = (id: string, value: boolean | SourceChoice) => {
  const tableKey = currentTable.value.key
  if (!tableKey) return
  if (typeof value === 'boolean') handleCellChange(tableKey, id, '__etl_from_db__', !value, value)
  else handleCellChange(tableKey, id, SOURCE_FIELDS[value], false, true)
}

const revertParameter = (id: string) => {
  const tableKey = currentTable.value.key
  if (tableKey) handleRevertChange(tableKey, parameterRowId(id), parameterField(id))
}

// ── Review of the pending changes ───────────────────────────────────────────

const pendingGroups = computed(() =>
  pendingChangeGroups(
    instanceTables.value.map((table: any) => ({
      key: table.key,
      title: resolveTitle(table.title as any, formatTitle(table.key)),
      columns: columnsFromHeaders(table.headers ?? []),
      rows: table.originalItems ?? table.items ?? [],
    })),
  ),
)

const revertTable = (tableKey: string) => {
  handleRevertTable(tableKey)
  tableChanges.clearCreatesForTable(tableKey)
  tableChanges.clearDeletesForTable(tableKey)
  notifyPendingChanges()
}

const revertRow = (tableKey: string, rowId: string | number, kind: string) => {
  if (kind === 'new') tableChanges.revertCreate(tableKey, cellText(rowId))
  else if (kind === 'deleted') tableChanges.revertDelete(tableKey, rowId)
  else handleRevertRow(tableKey, cellText(rowId))
  notifyPendingChanges()
}

const updateReviewField = (tableKey: string, rowId: string | number, key: string, value: unknown) => {
  if (cellText(rowId).startsWith('create-')) {
    tableChanges.updateCreateField(tableKey, cellText(rowId), key, value)
    notifyPendingChanges()
    return
  }
  handleModalUpdateChange(tableKey, cellText(rowId), key, value)
}

/** Shows a pending change in its table: switches to its tab, clears what hides it and picks the cell. */
const goToChange = async (tableKey: string, rowId: string | number, key: string) => {
  if (!instanceTables.value.some((table: any) => table.key === tableKey)) return
  selectedTableKey.value = tableKey
  const state = getTableState(tableKey)
  state.searchValue = ''
  state.debouncedSearchValue = ''
  state.activeFilters = []
  await nextTick()
  const row = (currentTable.value.items ?? []).find((item: any) => cellText(item.id) === cellText(rowId))
  const id = row?.id ?? rowId
  dataTable.value?.focusCell(id, key)
  highlightedRowId.value = id
  setTimeout(() => (highlightedRowId.value = null), 1800)
}

// Methods
const handleCheckData = () => {
  checksLaunched.value = true
  emit('check-data')
}

// Expose methods for parent component
defineExpose({
  /** Shows the table over the whole window, or back in its place. */
  toggleFullscreen: () => (fullscreen.value = !fullscreen.value),
  hasPendingChanges,
  pendingChangesCount,
  openPendingChangesModal,
  saveAllChanges: handleSaveAllChanges,
  clearAllChanges: tableChanges.clearAllChanges,
})
</script>

<style scoped>
.execution-data-view {
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 3);
  width: 100%;
  height: 100%;
  min-height: 0;
}

.execution-data-view__checks {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: calc(var(--spacing) * 2);
}

.execution-data-view__checks > :deep(.core-alert) {
  align-self: stretch;
}

.execution-data-view__body {
  flex: 1;
  display: flex;
  gap: calc(var(--spacing) * 4);
  min-height: 0;
}

.execution-data-view__table {
  flex: 1;
  min-width: 0;
}

.execution-data-view__panel {
  flex: none;
  width: 400px;
}
</style>
