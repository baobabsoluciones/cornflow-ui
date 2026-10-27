<!--
  CoreDataTable: a table of data in a card: the tabs of its group and the source bar (slots), a
  toolbar, the grid, and a footer with the row count and the pending changes.

  The table shows and edits; the screen that hosts it owns the data. It gets the rows already
  filtered and in order, and is told the search (`v-model:search`), the filters
  (`v-model:filters`), the order (`v-model:sort`) and the selection (`v-model:selected`), so a
  screen can filter on the server or in the browser as each table needs.

  - Toolbar: search (Ctrl/⌘K), a chip per filter (always visible, editable) and "Add filter";
    then "Add row", Excel, density, more actions (bulk upload, review changes, the screen's own
    `actions`) and full screen.
  - "Add row" puts a row to fill in at the top of the grid; Enter adds it (`add-row`).
  - Selecting rows shows a bar with bulk edit and delete (or restore, when they are all marked
    deleted). With `stagesChanges`, deleting only marks the rows; otherwise it asks first.
  - States: loading, loading more, empty, no rows for the search, none for the filters, and an
    error with "Retry" (`retry`).
  - Footer: "39 of 48 rows" and "Clear filters"; with `pendingCount`, the pending changes,
    "Discard" and "Review changes".
-->
<template>
  <section
    ref="card"
    class="data-table"
    :class="{ 'is-fullscreen': fullscreen, 'is-filled': fill }"
    :style="fill && !fullscreen ? { height: `${fillHeight}px` } : undefined"
    :aria-label="title"
    data-testid="data-table"
    @keydown.esc="adding = false"
  >
    <Teleport to="body">
      <div v-if="fullscreen" class="data-table__scrim" @click="fullscreen = false" />
    </Teleport>
    <slot name="tabs" />
    <slot name="strip" />

    <div class="data-table__toolbar">
      <CoreSearchInput
        v-if="searchable"
        :model-value="search"
        class="data-table__search"
        :placeholder="$t('dataTable.searchIn', { table: title })"
        :show-shortcut="!fullscreen"
        clearable
        @update:model-value="search = $event"
      />
      <div v-if="filterable || dateRanges.length" class="data-table__filters">
        <ConditionFilterChip
          v-for="range in dateRanges"
          :key="`range-${range.key}`"
          :filter="dateRangeFilter(range.key)"
          :column="{ key: range.key, title: range.label, type: 'date' }"
          fixed
          @apply="(filter) => emit('date-range', range.key, { from: filter.value, to: filter.value2 ?? '' })"
          @remove="emit('date-range', range.key, null)"
        />
        <template v-if="filterable">
        <ConditionFilterChip
          v-for="filter in filters"
          :key="filter.id"
          :filter="filter"
          :column="columnByKey[filter.field]"
          :choices="choicesFor(filter.field)"
          :boolean-counts="booleanCountsFor(filter.field)"
          :is-new="filter.id === newFilterId"
          @apply="replaceFilter"
          @remove="removeFilter"
        />
        <AddFilterMenu
          v-if="addableFilterFields.length"
          :label="$t('dataTable.filters.add')"
          :search-placeholder="$t('dataTable.filters.searchField')"
          :no-matches-text="$t('dataTable.filters.noField')"
          :groups="[{ key: 'columns', title: $t('dataTable.filters.columns'), fields: addableFilterFields }]"
          data-testid="data-table-add-filter"
          @add="addFilter"
        />
        </template>
      </div>

      <div class="data-table__actions">
        <CoreButton
          v-if="canAdd"
          variant="outlined"
          icon="mdi-table-row-plus-after"
          :text="$t('dataTable.addRow')"
          :disabled="adding"
          data-testid="data-table-add-row"
          @click="adding = true"
        />
        <CoreButton
          v-if="canDownloadExcel"
          variant="icon"
          icon="mdi-microsoft-excel"
          class="data-table__excel"
          :loading="downloading"
          :aria-label="$t('dataTable.downloadExcel')"
          :title="$t('dataTable.downloadExcel')"
          data-testid="data-table-excel"
          @click="emit('download-excel')"
        />
        <CorePopover v-model:open="densityOpen" :width="200" align="end">
          <template #trigger>
            <CoreButton
              variant="icon"
              icon="mdi-format-line-spacing"
              :aria-label="$t('dataTable.density.title')"
              :title="$t('dataTable.density.title')"
            />
          </template>
          <CoreMenu
            :title="$t('dataTable.density.title')"
            selectable
            :items="densityItems"
            @select="pickDensity($event.key)"
          />
        </CorePopover>
        <CorePopover v-if="actionItems.length" v-model:open="actionsOpen" :width="260" align="end">
          <template #trigger>
            <CoreButton
              variant="icon"
              icon="mdi-dots-vertical"
              :aria-label="$t('dataTable.moreActions')"
              :title="$t('dataTable.moreActions')"
              data-testid="data-table-actions"
            />
          </template>
          <CoreMenu :items="actionItems" @select="runAction($event.key)" />
        </CorePopover>
        <CoreButton
          variant="icon"
          :icon="fullscreen ? 'mdi-fullscreen-exit' : 'mdi-fullscreen'"
          :aria-label="fullscreen ? $t('dataTable.exitFullscreen') : $t('dataTable.fullscreen')"
          :title="fullscreen ? $t('dataTable.exitFullscreen') : $t('dataTable.fullscreen')"
          data-testid="data-table-fullscreen"
          @click="fullscreen = !fullscreen"
        />
      </div>
    </div>

    <div v-if="adding" class="data-table__adding" role="status">
      <CoreIcon name="mdi-table-row-plus-after" :size="18" />
      <span>
        <strong>{{ $t('dataTable.newRow.title') }}</strong>
        {{ requiredText }} {{ $t('dataTable.newRow.keys') }}
      </span>
      <CoreButton variant="text" size="small" :text="$t('dataTable.newRow.cancel')" @click="adding = false" />
      <CoreButton size="small" :text="$t('dataTable.addRow')" data-testid="data-table-add-confirm" @click="grid?.commitAdd()" />
    </div>

    <div v-if="$slots.body" class="data-table__body">
      <slot name="body" />
    </div>
    <CoreDataGrid
      v-else
      ref="grid"
      v-model:sort="sort"
      v-model:selected="selected"
      v-model:widths="widths"
      class="data-table__grid"
      :columns="columns"
      :rows="rows"
      :cell-value="cellValue"
      :status="status"
      :loading-more="loadingMore"
      :has-more="hasMore"
      :density="density"
      :editable="editable"
      :selectable="selectable"
      :row-state="rowState"
      :row-level="rowLevel"
      :cell-modified="cellModified"
      :cell-disabled="cellDisabled"
      :row-pinned="rowPinned"
      :options-for="optionsFor"
      :highlighted-row-id="highlightedRowId"
      :adding="adding"
      @cell-change="(row, key, value) => emit('cell-change', row, key, value)"
      @load-more="emit('load-more')"
      @need-options="emit('need-options', $event)"
      @add="addRow"
      @add-cancel="adding = false"
    >
      <template #message>
        <CoreEmptyState
          v-bind="message"
          @action="onMessageAction"
        />
      </template>
    </CoreDataGrid>

    <div v-if="selectable && selected.length" class="data-table__selection" role="region" :aria-label="$t('dataTable.selection.label')">
      <span class="data-table__selection-count">{{ $t('dataTable.selection.count', { count: selected.length }, selected.length) }}</span>
      <CoreButton
        v-if="canBulkEdit"
        variant="text"
        size="small"
        icon="mdi-pencil-outline"
        :text="$t('dataTable.selection.bulkEdit')"
        data-testid="data-table-bulk-edit"
        @click="bulkEditOpen = true"
      />
      <CoreButton
        v-if="canDelete"
        variant="text"
        size="small"
        :color="allSelectedDeleted ? undefined : 'danger'"
        :icon="allSelectedDeleted ? 'mdi-restore' : 'mdi-delete-outline'"
        :text="allSelectedDeleted ? $t('dataTable.selection.restore') : $t('dataTable.selection.delete')"
        data-testid="data-table-delete"
        @click="onDeleteSelected"
      />
      <CoreButton
        variant="icon"
        size="small"
        icon="mdi-close"
        :aria-label="$t('dataTable.selection.clear')"
        :title="$t('dataTable.selection.clear')"
        @click="selected = []"
      />
    </div>

    <footer class="data-table__footer">
      <span class="data-table__count" data-testid="data-table-count">{{ countText }}</span>
      <button v-if="isFiltered" type="button" class="data-table__link" @click="clearFilters">
        {{ $t('dataTable.clearFilters') }}
      </button>
      <span v-if="sortText" class="data-table__sort">{{ sortText }}</span>
      <span class="data-table__spacer" />
      <template v-if="pendingCount > 0">
        <span class="data-table__pending">
          <CoreIcon name="mdi-pencil-circle" :size="16" />
          {{ pendingText }}
        </span>
        <button type="button" class="data-table__link is-muted" @click="emit('discard')">
          {{ $t('dataTable.pending.discard') }}
        </button>
        <CoreButton
          size="small"
          icon="mdi-chevron-right"
          :text="reviewLabel || $t('dataTable.pending.review')"
          data-testid="data-table-review"
          @click="emit('review')"
        />
      </template>
    </footer>

    <BulkEditDialog
      v-if="canBulkEdit"
      v-model:open="bulkEditOpen"
      :columns="bulkColumns"
      :count="selected.length"
      :table-title="title"
      @apply="applyBulkEdit"
    />
    <BulkUploadDialog
      v-if="canBulkUpload"
      v-model:open="uploadOpen"
      :table-title="title"
      :operations="uploadOperations"
      :row-count="totalCount"
      :phase="uploadPhase"
      :progress-text="uploadProgressText"
      :error-text="uploadErrorText"
      @upload="emit('upload', $event)"
      @view-data="uploadOpen = false"
    />
    <CoreConfirmDialog
      v-model="deleteConfirmOpen"
      :title="$t('dataTable.deleteRows.title', { count: selected.length }, selected.length)"
      :message="$t('dataTable.deleteRows.message', { count: selected.length }, selected.length)"
      :confirm-text="$t('dataTable.deleteRows.confirm')"
      :cancel-text="$t('common.cancel')"
      confirm-color="var(--color-danger)"
      icon="mdi-delete-outline"
      :loading="deleting"
      :loading-message="$t('dataTable.deleteRows.deleting')"
      @confirm="confirmDelete"
      @cancel="deleteConfirmOpen = false"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import CoreButton from '@cornflow-ui/core/components/core/CoreButton.vue'
import CoreEmptyState from '@cornflow-ui/core/components/core/CoreEmptyState.vue'
import CoreIcon from '@cornflow-ui/core/components/core/CoreIcon.vue'
import CoreMenu, { type CoreMenuItem } from '@cornflow-ui/core/components/core/CoreMenu.vue'
import CorePopover from '@cornflow-ui/core/components/core/CorePopover.vue'
import CoreConfirmDialog from '@cornflow-ui/core/components/core/table/CoreConfirmDialog.vue'
import CoreSearchInput from '@cornflow-ui/core/components/core/table/CoreSearchInput.vue'
import AddFilterMenu from '@cornflow-ui/core/components/core/filters/AddFilterMenu.vue'
import ConditionFilterChip from '@cornflow-ui/core/components/core/filters/ConditionFilterChip.vue'
import BulkEditDialog from './BulkEditDialog.vue'
import BulkUploadDialog from './BulkUploadDialog.vue'
import CoreDataGrid from './CoreDataGrid.vue'
import type {
  DataColumn,
  DataColumnOption,
  DataDensity,
  DataFilter,
  DataRow,
  DataRowLevel,
  DataRowState,
  DataSort,
  DataTableStatus,
} from './types'
import { cellText, emptyFilter, filterKindOf, formatCellValue, isTruthy } from '@cornflow-ui/core/utils/dataTable'
import { generateFilterId } from '@cornflow-ui/core/utils/tableFilterUtils'
import { useFillHeight } from '@cornflow-ui/core/composables/core-table/useFillHeight'

defineOptions({ name: 'CoreDataTable' })

export interface DataTableAction {
  key: string
  label: string
  icon?: string
  disabled?: boolean
}

const props = withDefaults(
  defineProps<{
    /** Name of the table: the search placeholder and the dialogs use it. */
    title: string
    columns: DataColumn[]
    /** The rows to show, already filtered and in order. */
    rows: DataRow[]
    /** Every loaded row, before filtering: the list filters count their values in it. */
    sourceRows?: DataRow[]
    cellValue?: (row: DataRow, key: string) => unknown
    status?: DataTableStatus
    loadingMore?: boolean
    hasMore?: boolean
    /** Rows of the table before filtering (the "of 48" of the count). */
    totalCount?: number
    /** Rows that pass the search and filters, when more than the ones loaded. */
    filteredCount?: number
    searchable?: boolean
    filterable?: boolean
    editable?: boolean
    selectable?: boolean
    canAdd?: boolean
    canDelete?: boolean
    canBulkEdit?: boolean
    canBulkUpload?: boolean
    canDownloadExcel?: boolean
    /** Edits, additions and deletions stay pending until saved, instead of happening at once. */
    stagesChanges?: boolean
    uploadOperations?: string[]
    uploadPhase?: 'form' | 'waiting' | 'loading' | 'done' | 'error'
    uploadProgressText?: string
    uploadErrorText?: string
    downloading?: boolean
    deleting?: boolean
    rowState?: (row: DataRow) => DataRowState | undefined
    rowLevel?: (row: DataRow) => DataRowLevel | undefined
    cellModified?: (row: DataRow, key: string) => boolean
    cellDisabled?: (row: DataRow, key: string) => boolean
    rowPinned?: (row: DataRow) => boolean
    optionsFor?: (column: DataColumn) => DataColumnOption[] | undefined
    highlightedRowId?: string | number | null
    /** Pending changes of every table of the screen, for the footer. */
    pendingCount?: number
    pendingTables?: number
    /** Text of the review button ("Review changes" by default). */
    reviewLabel?: string
    /** The screen's own entries of the more-actions menu. */
    actions?: DataTableAction[]
    /** Takes the height left down to the bottom of the window (or of `data-table-bounds`). */
    fill?: boolean
    /** Fixed date ranges the data is loaded with, each a chip before the filters. */
    dateRanges?: Array<{ key: string; label: string }>
    dateRangeValues?: Record<string, { from: string; to: string }>
  }>(),
  {
    sourceRows: undefined,
    cellValue: undefined,
    status: 'ready',
    loadingMore: false,
    hasMore: false,
    totalCount: undefined,
    filteredCount: undefined,
    searchable: true,
    filterable: true,
    editable: false,
    selectable: false,
    canAdd: false,
    canDelete: false,
    canBulkEdit: false,
    canBulkUpload: false,
    canDownloadExcel: false,
    stagesChanges: true,
    uploadOperations: () => ['post_bulk'],
    uploadPhase: 'form',
    uploadProgressText: '',
    uploadErrorText: '',
    downloading: false,
    deleting: false,
    rowState: undefined,
    rowLevel: undefined,
    cellModified: undefined,
    cellDisabled: undefined,
    rowPinned: undefined,
    optionsFor: undefined,
    highlightedRowId: null,
    pendingCount: 0,
    pendingTables: 1,
    reviewLabel: '',
    actions: () => [],
    fill: false,
    dateRanges: () => [],
    dateRangeValues: () => ({}),
  },
)

const emit = defineEmits<{
  'cell-change': [row: DataRow, key: string, value: unknown]
  'add-row': [values: Record<string, unknown>]
  'delete-rows': [ids: Array<string | number>]
  'restore-rows': [ids: Array<string | number>]
  'bulk-edit': [ids: Array<string | number>, values: Record<string, unknown>]
  upload: [payload: { files: File[]; operation: string }]
  'download-excel': []
  'need-options': [column: DataColumn]
  'load-more': []
  retry: []
  review: []
  discard: []
  action: [key: string]
  /** A date range applied (`null`: reset). */
  'date-range': [key: string, range: { from: string; to: string } | null]
}>()

const search = defineModel<string>('search', { default: '' })
const filters = defineModel<DataFilter[]>('filters', { default: () => [] })
const sort = defineModel<DataSort | null>('sort', { default: null })
const selected = defineModel<Array<string | number>>('selected', { default: () => [] })
const density = defineModel<DataDensity>('density', { default: 'default' })
const widths = defineModel<Record<string, number>>('widths', { default: () => ({}) })
const fullscreen = defineModel<boolean>('fullscreen', { default: false })
const uploadOpen = defineModel<boolean>('uploadOpen', { default: false })

const { t, locale } = useI18n()

const card = ref<HTMLElement>()
const grid = ref<InstanceType<typeof CoreDataGrid>>()
const fillHeight = useFillHeight(card, { min: 360 })

const cellValue = (row: DataRow, key: string) => (props.cellValue ? props.cellValue(row, key) : row[key])

const columnByKey = computed<Record<string, DataColumn>>(() =>
  Object.fromEntries(props.columns.map((column) => [column.key, column])),
)

// ── Filters ─────────────────────────────────────────────────────────────────

const newFilterId = ref<string | null>(null)

const FILTER_ICONS: Record<string, string> = {
  text: 'mdi-format-text',
  range: 'mdi-numeric',
  dates: 'mdi-calendar-blank-outline',
  list: 'mdi-format-list-bulleted',
  boolean: 'mdi-checkbox-marked-outline',
}

const addableFilterFields = computed(() =>
  props.columns
    .filter((column) => column.type !== 'time')
    .map((column) => ({
      key: column.key,
      title: column.title,
      icon: FILTER_ICONS[filterKindOf(column.type)],
    })),
)

function addFilter(field: string) {
  const column = columnByKey.value[field]
  if (!column) return
  const filter = emptyFilter(generateFilterId(), field, filterKindOf(column.type))
  newFilterId.value = filter.id
  filters.value = [...filters.value, filter]
}

function replaceFilter(filter: DataFilter) {
  if (filter.id === newFilterId.value) newFilterId.value = null
  filters.value = filters.value.map((current) => (current.id === filter.id ? filter : current))
}

function removeFilter(id: string) {
  if (id === newFilterId.value) newFilterId.value = null
  filters.value = filters.value.filter((filter) => filter.id !== id)
}

function clearFilters() {
  filters.value = []
  search.value = ''
}

const countRows = computed(() => props.sourceRows ?? props.rows)

function choicesFor(field: string) {
  const column = columnByKey.value[field]
  if (!column || filterKindOf(column.type) !== 'list') return []
  const counts = new Map<string, { value: unknown; count: number }>()
  for (const row of countRows.value) {
    const value = cellValue(row, field)
    const key = cellText(value)
    if (!key) continue
    const entry = counts.get(key) ?? { value, count: 0 }
    entry.count += 1
    counts.set(key, entry)
  }
  const known = (column.options ?? []).map((option) => ({
    ...option,
    count: counts.get(cellText(option.value))?.count ?? 0,
  }))
  const extra = [...counts.values()]
    .filter((entry) => !known.some((option) => cellText(option.value) === cellText(entry.value)))
    .map((entry) => ({
      value: entry.value,
      label: formatCellValue(entry.value, column, locale.value, t) ?? cellText(entry.value),
      count: entry.count,
    }))
  return [...known, ...extra].sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }))
}

function booleanCountsFor(field: string) {
  const column = columnByKey.value[field]
  if (!column || filterKindOf(column.type) !== 'boolean') return undefined
  const yes = countRows.value.filter((row) => isTruthy(cellValue(row, field))).length
  return { yes, no: countRows.value.length - yes }
}

function dateRangeFilter(key: string): DataFilter {
  const range = props.dateRangeValues[key]
  return { id: `range-${key}`, field: key, operator: 'is_between', value: range?.from ?? '', value2: range?.to ?? '' }
}

const isFiltered = computed(() => filters.value.length > 0 || search.value.trim() !== '')

// ── Toolbar menus ───────────────────────────────────────────────────────────

const densityOpen = ref(false)
const actionsOpen = ref(false)

const densityItems = computed<CoreMenuItem[]>(() =>
  (['compact', 'default', 'comfortable'] as DataDensity[]).map((key) => ({
    key,
    label: t(`dataTable.density.${key}`),
    selected: density.value === key,
  })),
)

function pickDensity(key: string) {
  density.value = key as DataDensity
  densityOpen.value = false
}

const actionItems = computed<CoreMenuItem[]>(() => [
  ...(props.canBulkUpload
    ? [{ key: 'bulk-upload', label: t('dataTable.bulkUpload.title'), icon: 'mdi-upload-outline' }]
    : []),
  ...(props.editable && props.pendingCount > 0
    ? [{ key: 'review', label: t('dataTable.pending.review'), icon: 'mdi-file-compare', count: props.pendingCount }]
    : []),
  ...props.actions.map((action) => ({ ...action })),
])

function runAction(key: string) {
  actionsOpen.value = false
  if (key === 'bulk-upload') uploadOpen.value = true
  else if (key === 'review') emit('review')
  else emit('action', key)
}

function onFullscreenKey(event: KeyboardEvent) {
  if (event.key === 'Escape' && fullscreen.value && !document.querySelector('[role="dialog"]')) {
    fullscreen.value = false
  }
}

watch(fullscreen, (on) => {
  if (on) document.addEventListener('keydown', onFullscreenKey)
  else document.removeEventListener('keydown', onFullscreenKey)
})
onBeforeUnmount(() => document.removeEventListener('keydown', onFullscreenKey))

// ── Adding a row ────────────────────────────────────────────────────────────

const adding = ref(false)

const requiredText = computed(() => {
  const names = props.columns.filter((column) => column.required && !column.readOnly).map((c) => c.title)
  if (names.length === 0) return ''
  return t('dataTable.newRow.required', { fields: new Intl.ListFormat(locale.value, { type: 'conjunction' }).format(names) }, names.length)
})

function addRow(values: Record<string, unknown>) {
  emit('add-row', values)
  adding.value = false
}

// ── Selection ───────────────────────────────────────────────────────────────

const bulkEditOpen = ref(false)
const deleteConfirmOpen = ref(false)

const selectedRows = computed(() => {
  const ids = new Set(selected.value)
  return props.rows.filter((row) => ids.has(row.id))
})

const allSelectedDeleted = computed(
  () =>
    selectedRows.value.length > 0 &&
    selectedRows.value.every((row) => props.rowState?.(row) === 'deleted'),
)

const bulkColumns = computed(() =>
  props.columns.filter((column) => !column.readOnly && column.type !== 'reference'),
)

function onDeleteSelected() {
  if (allSelectedDeleted.value) {
    emit('restore-rows', [...selected.value])
    selected.value = []
  } else if (props.stagesChanges) {
    emit('delete-rows', [...selected.value])
    selected.value = []
  } else {
    deleteConfirmOpen.value = true
  }
}

function confirmDelete() {
  emit('delete-rows', [...selected.value])
  deleteConfirmOpen.value = false
  selected.value = []
}

function applyBulkEdit(values: Record<string, unknown>) {
  emit('bulk-edit', [...selected.value], values)
  bulkEditOpen.value = false
}

// ── Messages and footer ─────────────────────────────────────────────────────

const total = computed(() => props.totalCount ?? props.rows.length)
const shown = computed(() => props.filteredCount ?? props.rows.length)

const message = computed(() => {
  if (props.status === 'error') {
    return {
      icon: 'mdi-alert-circle-outline',
      title: t('dataTable.messages.errorTitle'),
      text: t('dataTable.messages.errorText'),
      actionLabel: t('dataTable.messages.retry'),
    }
  }
  if (total.value === 0 || !isFiltered.value) {
    return {
      icon: 'mdi-table-off',
      title: t('dataTable.messages.emptyTitle'),
      text: props.canAdd ? t('dataTable.messages.emptyEditable') : t('dataTable.messages.emptyText'),
      actionLabel: props.canAdd ? t('dataTable.addRow') : undefined,
    }
  }
  if (filters.value.length === 0) {
    return {
      icon: 'mdi-magnify-close',
      title: t('dataTable.messages.noSearchTitle', { search: search.value.trim() }),
      text: t('dataTable.messages.noSearchText'),
      actionLabel: t('dataTable.messages.clearSearch'),
    }
  }
  return {
    icon: 'mdi-filter-remove-outline',
    title: t('dataTable.messages.noFilterTitle'),
    text: t('dataTable.messages.noFilterText', { count: formatCount(total.value) }, total.value),
    actionLabel: t('dataTable.clearFilters'),
  }
})

function onMessageAction() {
  if (props.status === 'error') emit('retry')
  else if (!isFiltered.value || total.value === 0) adding.value = true
  else if (filters.value.length === 0) search.value = ''
  else clearFilters()
}

const formatCount = (count: number) => new Intl.NumberFormat(locale.value).format(count)

const countText = computed(() => {
  if (props.status !== 'ready') return ''
  if (isFiltered.value) {
    return t('dataTable.count.filtered', { shown: formatCount(shown.value), total: formatCount(total.value) }, total.value)
  }
  return t('dataTable.count.all', { total: formatCount(total.value) }, total.value)
})

const sortText = computed(() => {
  const current = sort.value
  if (!current) return ''
  const column = columnByKey.value[current.key]
  if (!column) return ''
  return t(`dataTable.sortedBy.${current.direction}`, { column: column.title })
})

const pendingText = computed(() =>
  props.pendingTables > 1
    ? t('dataTable.pending.summaryTables', { count: props.pendingCount, tables: props.pendingTables }, props.pendingCount)
    : t('dataTable.pending.summary', { count: props.pendingCount }, props.pendingCount),
)

defineExpose({
  /** Picks a cell and brings it into view (the landing of a "go to" from the pending changes). */
  focusCell: (rowId: string | number, key: string) => grid.value?.focusCell(rowId, key),
})
</script>

<style scoped>
.data-table {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-sm);
  font-family: var(--font-sans);
}

.data-table.is-fullscreen {
  position: fixed;
  inset: calc(var(--spacing) * 3);
  z-index: var(--z-popover);
  box-shadow: var(--shadow-xl);
}

.data-table__scrim {
  position: fixed;
  inset: 0;
  z-index: var(--z-popover);
  background: var(--color-scrim);
}

.data-table__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: calc(var(--spacing) * 2.5);
  padding: calc(var(--spacing) * 3) calc(var(--spacing) * 4);
  border-bottom: 1px solid var(--color-divider);
}

.data-table__search {
  flex: 0 1 260px;
}

.data-table__filters {
  display: flex;
  flex: 1 1 auto;
  flex-wrap: wrap;
  align-items: center;
  gap: calc(var(--spacing) * 2);
  min-width: 0;
}

.data-table__actions {
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 2);
  margin-left: auto;
}

.data-table__excel {
  color: var(--color-success);
}

.data-table__adding {
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 2.5);
  margin: calc(var(--spacing) * 3) calc(var(--spacing) * 4) 0;
  padding: calc(var(--spacing) * 2) calc(var(--spacing) * 3);
  border: 1px solid var(--color-success-border);
  border-radius: var(--radius-md);
  background: var(--color-success-soft);
  font-size: var(--text-md);
  color: var(--color-text);
}

.data-table__adding > span {
  flex: 1;
}

.data-table__grid {
  flex: 1;
  min-height: 200px;
}

.data-table__body {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.data-table__selection {
  position: absolute;
  bottom: calc(var(--spacing) * 14);
  left: 50%;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 2);
  padding: calc(var(--spacing) * 1.5) calc(var(--spacing) * 2) calc(var(--spacing) * 1.5)
    calc(var(--spacing) * 4);
  transform: translateX(-50%);
  border-radius: var(--radius-lg);
  background: var(--color-inverse);
  box-shadow: var(--shadow-lg);
  color: var(--color-on-inverse);
}

.data-table__selection :deep(.core-button) {
  --button-tone: var(--color-on-inverse);
  color: var(--color-on-inverse);
}

.data-table__selection-count {
  font-size: var(--text-md);
  font-weight: var(--font-weight-medium);
}

.data-table {
  position: relative;
}

.data-table__footer {
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 3);
  min-height: 44px;
  padding: calc(var(--spacing) * 1.5) calc(var(--spacing) * 4);
  border-top: 1px solid var(--color-divider);
  background: var(--color-surface-muted);
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.data-table__spacer {
  flex: 1;
}

.data-table__link {
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  color: var(--color-primary);
  cursor: pointer;
}

.data-table__link.is-muted {
  color: var(--color-text-muted);
}

.data-table__pending {
  display: inline-flex;
  align-items: center;
  gap: calc(var(--spacing) * 1.5);
  font-weight: var(--font-weight-medium);
  color: var(--color-warning-strong);
}

.data-table__sort {
  color: var(--color-text-subtle);
}
</style>
