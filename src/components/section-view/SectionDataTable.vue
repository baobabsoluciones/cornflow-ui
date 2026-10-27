<!--
  SectionDataTable: a table of a section (master data, the input data or the results of an
  execution) shown with CoreDataTable and fed by its `useTableData`.

  It turns the schema headers into columns, the table's pending changes into row and cell
  states, and the table's events into the `useTableData` handlers. A check that only returns
  sentences shows as a list of messages; a list of plain values, as a one-column table.
  The tabs of a group come in the `tabs` slot.
-->
<template>
  <CoreDataTable
    ref="table"
    v-model:sort="tableData.sort.value"
    v-model:selected="selectedIds"
    v-model:upload-open="tableData.showBulkUploadModal.value"
    v-model:density="density"
    :search="tableData.searchValue.value"
    :filters="tableData.activeFilters.value"
    :title="title"
    :columns="columns"
    :rows="rows"
    :cell-value="cellValue"
    :status="status"
    :loading-more="tableData.loadingMore.value"
    :has-more="tableData.hasMore.value"
    :filterable="!isMessageList"
    :editable="editable"
    :selectable="editable && tableData.enableSelection.value"
    :can-add="editable && tableData.canAdd.value"
    :can-delete="editable && tableData.canDelete.value"
    :can-bulk-edit="editable"
    :can-bulk-upload="!readOnly && tableData.canBulkUpload.value"
    :can-download-excel="tableData.canDownloadExcel.value"
    :stages-changes="tableData.enableExcelMode.value"
    :upload-operations="tableData.bulkUploadAvailableOperations.value"
    :upload-phase="tableData.uploading.value ? 'loading' : 'form'"
    :upload-progress-text="tableData.uploadProgressMessage.value"
    :downloading="tableData.downloading.value"
    :deleting="tableData.bulkDeleting.value"
    :row-state="tableData.getRowState"
    :row-level="rowLevel"
    :cell-modified="(row, key) => tableData.isCellModified(row.id, key)"
    :cell-disabled="cellDisabled"
    :row-pinned="rowPinned"
    :options-for="optionsFor"
    :highlighted-row-id="highlightedRowId"
    :pending-count="pendingCount"
    :pending-tables="pendingTables"
    :review-label="reviewLabel"
    :actions="actions"
    :date-ranges="dateRanges"
    :date-range-values="tableData.dateRangeValues.value"
    fill
    @update:search="tableData.handleSearch"
    @update:filters="tableData.setFilters"
    @cell-change="onCellChange"
    @add-row="tableData.addRow"
    @delete-rows="tableData.deleteRows"
    @restore-rows="tableData.restoreRows"
    @bulk-edit="tableData.bulkEditRows"
    @upload="tableData.handleBulkUpload"
    @download-excel="tableData.handleDownloadExcel"
    @need-options="loadOptions"
    @load-more="tableData.loadMore"
    @retry="tableData.loadData"
    @review="emit('review')"
    @discard="emit('review')"
    @action="emit('action', $event)"
    @date-range="onDateRange"
  >
    <template v-if="$slots.tabs" #tabs>
      <slot name="tabs" />
    </template>
    <template v-if="$slots.strip" #strip>
      <slot name="strip" />
    </template>
    <template v-if="isMessageList" #body>
      <MessageList :messages="messages" :level="messageLevel" />
    </template>
  </CoreDataTable>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import CoreDataTable, {
  type DataTableAction,
} from '@cornflow-ui/core/components/core/data-table/CoreDataTable.vue'
import MessageList from '@cornflow-ui/core/components/core/data-table/MessageList.vue'
import type {
  DataColumn,
  DataColumnOption,
  DataDensity,
  DataRow,
  DataRowLevel,
} from '@cornflow-ui/core/components/core/data-table/types'
import { cellText, columnsFromHeaders, isEmptyValue } from '@cornflow-ui/core/utils/dataTable'
import { parseJoinFrom } from '@cornflow-ui/core/utils/schemaUtils'
import { resolveTitleWithLocale } from '@cornflow-ui/core/utils/i18nUtils'
import { resolveJoinFromValue } from '@cornflow-ui/core/utils/tableCellValue'

defineOptions({ name: 'SectionDataTable' })

const props = withDefaults(
  defineProps<{
    /** The table's `useTableData` instance. */
    tableData: any
    tableKey: string
    /** Shows the data read-only (the data of an execution without recalculation). */
    readOnly?: boolean
    /** The table is still switching tabs. */
    switching?: boolean
    /** Rows of a check table, with their level. */
    checkLevel?: DataRowLevel
    /** Database or file origin of each column (data loaded through the ETL). */
    columnSources?: Record<string, { source: 'db' | 'file'; tooltip?: string }>
    pendingCount?: number
    pendingTables?: number
    reviewLabel?: string
    actions?: DataTableAction[]
    highlightedRowId?: string | number | null
  }>(),
  {
    readOnly: false,
    switching: false,
    checkLevel: undefined,
    columnSources: () => ({}),
    pendingCount: 0,
    pendingTables: 1,
    reviewLabel: '',
    actions: () => [],
    highlightedRowId: null,
  },
)

const emit = defineEmits<{
  review: []
  action: [key: string]
}>()

const { t, locale } = useI18n()

const table = ref<InstanceType<typeof CoreDataTable>>()
const density = ref<DataDensity>('default')

const title = computed(() => cellText(props.tableData.tableTitle.value) || props.tableKey)
const editable = computed(() => !props.readOnly && !!props.tableData.enableExcelMode.value && !!props.tableData.canEdit.value)
const isMessageList = computed(() => !!props.tableData.isValidationMessageList?.value)
const isPrimitive = computed(() => !!props.tableData.isPrimitiveArray.value)

const headers = computed<any[]>(() => props.tableData.headers.value ?? [])

const columns = computed<DataColumn[]>(() => {
  if (isPrimitive.value) {
    const first = props.tableData.items.value?.[0]
    return [{ key: 'value', title: t('inputOutputData.value'), type: typeof first === 'number' ? 'number' : 'text' }]
  }
  return columnsFromHeaders(headers.value).map((column) => {
    const origin = props.columnSources[column.key]
    if (!origin) return column
    return {
      ...column,
      source: { kind: origin.source === 'db' ? 'database' : 'file', tooltip: origin.tooltip },
    } as DataColumn
  })
})

const rows = computed<DataRow[]>(() => {
  const items: unknown[] = props.tableData.items.value ?? []
  if (isPrimitive.value) return items.map((value, index) => ({ id: index, value }))
  return items as DataRow[]
})

const status = computed(() => {
  if (props.switching || props.tableData.loading.value) return 'loading'
  return props.tableData.error.value ? 'error' : 'ready'
})

const headerByKey = computed<Record<string, any>>(() =>
  Object.fromEntries(headers.value.map((header) => [header.key ?? header.value, header])),
)

/** The value a cell shows: the pending one when edited; for an added row, its references resolved. */
function cellValue(row: DataRow, key: string): unknown {
  if (props.tableData.isCellModified(row.id, key)) return props.tableData.getModifiedValue(row.id, key)
  const value = row[key]
  const header = headerByKey.value[key]
  if (isEmptyValue(value) && header?.joinFrom && header?.foreignKeyField) {
    return resolveJoinFromValue(row, header, props.tableData.tableData.value) ?? value
  }
  return value
}

function onCellChange(row: DataRow, key: string, value: unknown) {
  props.tableData.handleCellChange(props.tableKey, row.id, key, cellValue(row, key), value)
}

const rowLevel = computed(() => (props.checkLevel ? () => props.checkLevel : undefined))

/** A switch column that marks rows as pinned highlights them. */
const pinColumn = computed(() => columns.value.find((column) => column.type === 'switch' && column.key.toLowerCase() === 'fijar'))
const rowPinned = computed(() => {
  const column = pinColumn.value
  return column ? (row: DataRow) => cellValue(row, column.key) === true : undefined
})

function cellDisabled(row: DataRow, key: string): boolean {
  const disabledKey = headerByKey.value[key]?.cellDisabledKey
  return !!disabledKey && !!row[disabledKey]
}

// ── Selection, as ids ───────────────────────────────────────────────────────

const selectedIds = computed<Array<string | number>>({
  get: () => (props.tableData.selectedItems.value ?? []).map((item: any) => item.id),
  set: (ids) => {
    const wanted = new Set(ids.map((id) => cellText(id)))
    props.tableData.selectedItems.value = rows.value.filter((row) => wanted.has(cellText(row.id)))
  },
})

// ── Options of the references ───────────────────────────────────────────────

const options = reactive<Record<string, DataColumnOption[]>>({})

watch(
  () => props.tableKey,
  () => Object.keys(options).forEach((key) => delete options[key]),
)

const optionsFor = (column: DataColumn) => options[column.key]

function noneOption(header: any): DataColumnOption[] {
  const title = header?.valueNone?.title
  if (!title) return []
  const label = typeof title === 'string' ? title : resolveTitleWithLocale(title, locale.value, '')
  return [{ value: null, label }]
}

async function loadOptions(column: DataColumn) {
  if (options[column.key]) return
  const header = headerByKey.value[column.key]
  const join = parseJoinFrom(header?.joinFrom ?? '')
  if (!join) {
    options[column.key] = column.options ?? []
    return
  }
  try {
    const referenced: any[] = await props.tableData.loadTableData(join.table)
    const values = [...new Set(referenced.map((row) => row[join.field]).filter((value) => !isEmptyValue(value)))]
    options[column.key] = [
      ...noneOption(header),
      ...values.map((value) => ({ value, label: cellText(value) })),
    ]
  } catch {
    options[column.key] = noneOption(header)
  }
}

// ── Checks that only return sentences ───────────────────────────────────────

const messages = computed(() => rows.value.map((row) => cellText(row.message)))
const messageLevel = computed(() => props.checkLevel ?? 'warning')

// ── Date ranges ─────────────────────────────────────────────────────────────

const dateRanges = computed(() =>
  (props.tableData.apiDateRangeFilterConfigs.value ?? []).map((config: any) => ({
    key: config.paramGte,
    label: config.label ?? t('dataTable.filters.dateRange'),
  })),
)

function onDateRange(key: string, range: { from: string; to: string } | null) {
  if (range) props.tableData.handleApplyDateRange(key, range)
  else props.tableData.handleResetDateRange(key)
}

defineExpose({
  focusCell: (rowId: string | number, key: string) => table.value?.focusCell(rowId, key),
})
</script>
