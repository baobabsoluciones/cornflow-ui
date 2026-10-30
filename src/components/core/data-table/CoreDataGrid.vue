<!--
  CoreDataGrid: the grid of a data table. It shows the rows it is given, in that order, and edits
  them like a spreadsheet; the table around it filters, sorts and keeps the changes.

  - Columns from `columns` (see `DataColumn`): an icon of their type, title, unit, the source
    icon, a sort button (`v-model:sort`) and a handle to resize (`v-model:widths`; double click
    fits the content). The columns share the width left in the card in proportion to their
    width; a resized column keeps its own. The first column stays visible when scrolling sideways.
  - Only the visible rows are drawn. Near the end it emits `load-more` while `hasMore`.
  - A cell is picked with a click or the arrows; Enter, F2, a double click or typing edits it,
    Delete empties it. Editing commits with Enter/Tab/a click elsewhere and emits `cell-change`;
    Escape cancels. Switch columns toggle with a click or Space without entering edit mode.
  - Row states (`rowState`): new, deleted (struck through, not editable) and modified, each with
    its mark at the left; `cellModified` tints the edited cells; `rowLevel` marks the rows of a
    check table.
  - `selectable` adds the checkboxes (`v-model:selected`, ids).
  - `adding` shows a row at the top to fill in; `commitAdd()` validates it and emits `add`.
  - `status`: `loading` draws skeleton rows; the `message` slot shows when there is nothing to
    draw (no rows, an error).
-->
<template>
  <div
    class="data-grid"
    :class="`data-grid--${density}`"
    :style="{
      '--grid-columns': gridTemplate,
      '--row-height': `${rowHeight}px`,
    }"
  >
    <div ref="scroller" class="data-grid__scroll" @scroll="onScroll">
      <table
        ref="table"
        class="data-grid__table"
        role="grid"
        tabindex="0"
        :aria-rowcount="rows.length + 1"
        :aria-colcount="columns.length"
        :aria-busy="status === 'loading' || loadingMore || undefined"
        :style="{ minWidth: `${totalWidth}px` }"
        data-testid="data-grid"
        @keydown="onGridKey"
      >
        <thead class="data-grid__head">
          <tr class="data-grid__row">
            <th
              v-if="selectable"
              class="data-grid__cell data-grid__cell--select is-sticky"
            >
              <CoreCheckbox
                :model-value="allSelected"
                :indeterminate="someSelected"
                :aria-label="$t('dataTable.grid.selectAll')"
                data-testid="data-grid-select-all"
                @update:model-value="toggleAll"
              />
            </th>
            <th
              class="data-grid__cell data-grid__cell--mark is-sticky"
              :style="{ left: `${selectWidth}px` }"
              aria-hidden="true"
            />
            <th
              v-for="(column, index) in columns"
              :key="column.key"
              :ref="(element) => setHeader(column.key, element)"
              class="data-grid__cell data-grid__header"
              :class="{
                'is-sticky': index === 0,
                'is-end': isEndAligned(column),
                'is-center': column.type === 'switch',
                'is-sorted': sort?.key === column.key,
              }"
              :style="index === 0 ? { left: `${frozenLeft}px` } : undefined"
              :aria-sort="ariaSort(column)"
              :title="
                column.description ||
                $t('dataTable.grid.sortBy', { column: column.title })
              "
            >
              <button
                type="button"
                class="data-grid__sort"
                :data-testid="`data-grid-sort-${column.key}`"
                @click="toggleSort(column)"
              >
                <CoreIcon
                  :name="typeIcon(column)"
                  :size="14"
                  class="data-grid__type"
                />
                <span class="data-grid__title">{{ column.title }}</span>
                <span v-if="column.unit" class="data-grid__unit"
                  >({{ column.unit }})</span
                >
                <CoreIcon
                  v-if="column.source"
                  :name="
                    column.source.kind === 'database'
                      ? 'mdi-database-outline'
                      : 'mdi-file-outline'
                  "
                  :size="14"
                  class="data-grid__source"
                  :label="column.source.tooltip"
                />
                <CoreIcon
                  :name="sortIcon(column)"
                  :size="14"
                  class="data-grid__sort-icon"
                />
              </button>
              <span
                class="data-grid__resize"
                :class="{ 'is-dragging': resizing === column.key }"
                :title="$t('dataTable.grid.resize')"
                @pointerdown="startResize(column, $event)"
                @dblclick="autoFit(column)"
                @click.stop
              />
            </th>
          </tr>
        </thead>

        <tbody v-if="adding" class="data-grid__add">
          <tr
            class="data-grid__row data-grid__row--add"
            data-testid="data-grid-add-row"
          >
            <td
              v-if="selectable"
              class="data-grid__cell data-grid__cell--select is-sticky"
            />
            <td
              class="data-grid__cell data-grid__cell--mark is-sticky"
              :style="{ left: `${selectWidth}px` }"
            >
              <CoreIcon
                name="mdi-plus-circle-outline"
                :size="16"
                class="data-grid__mark is-new"
              />
            </td>
            <td
              v-for="(column, index) in columns"
              :key="column.key"
              class="data-grid__cell data-grid__cell--editing"
              :class="{ 'is-sticky': index === 0 }"
              :style="index === 0 ? { left: `${frozenLeft}px` } : undefined"
              :title="
                addErrors[column.key] ? $t(addErrors[column.key]) : undefined
              "
            >
              <CoreSwitch
                v-if="column.type === 'switch'"
                :model-value="!!addDraft[column.key]"
                :aria-label="column.title"
                @update:model-value="addDraft[column.key] = $event"
              />
              <span v-else-if="column.readOnly" class="data-grid__text is-muted"
                >—</span
              >
              <DataGridEditor
                v-else
                :ref="(el) => setAddEditor(index, el)"
                v-model="addDraft[column.key]"
                :column="column"
                :options="optionsOf(column)"
                :loading="optionsLoading(column)"
                :invalid="!!addErrors[column.key]"
                bordered
                @commit="commitAdd"
                @cancel="emit('add-cancel')"
              />
            </td>
          </tr>
        </tbody>

        <tbody
          v-if="status === 'ready'"
          class="data-grid__body"
          :style="{ height: `${rows.length * rowHeight}px` }"
        >
          <tr
            v-for="(row, offset) in visibleRows"
            :key="row.id"
            class="data-grid__row"
            :class="rowClasses(row)"
            :aria-rowindex="start + offset + 2"
            :aria-selected="selectable ? isSelected(row) : undefined"
            :data-row-id="row.id"
            :style="{
              transform: `translateY(${(start + offset) * rowHeight}px)`,
            }"
          >
            <td
              v-if="selectable"
              class="data-grid__cell data-grid__cell--select is-sticky"
            >
              <CoreCheckbox
                :model-value="isSelected(row)"
                :aria-label="$t('dataTable.grid.selectRow')"
                @update:model-value="toggleRow(row)"
              />
            </td>
            <td
              class="data-grid__cell data-grid__cell--mark is-sticky"
              :style="{ left: `${selectWidth}px` }"
            >
              <CoreIcon
                v-if="markOf(row)"
                :name="markOf(row)!.icon"
                :size="16"
                class="data-grid__mark"
                :class="`is-${markOf(row)!.tone}`"
                :label="markOf(row)!.label"
              />
            </td>
            <td
              v-for="(column, index) in columns"
              :key="column.key"
              class="data-grid__cell"
              :class="cellClasses(row, column, index)"
              :style="index === 0 ? { left: `${frozenLeft}px` } : undefined"
              :aria-readonly="!canEditCell(row, column) || undefined"
              :title="cellTitle(row, column)"
              :data-column="column.key"
              @pointerdown="onCellDown(row, column, $event)"
              @dblclick="startEdit()"
            >
              <CoreSwitch
                v-if="column.type === 'switch'"
                :model-value="isTruthy(cellValue(row, column.key))"
                :disabled="
                  !canEditCell(row, column) || isCellDisabled(row, column)
                "
                :aria-label="column.title"
                @update:model-value="setValue(row, column, $event)"
              />
              <DataGridEditor
                v-else-if="isEditing(row, column)"
                ref="editor"
                v-model="editValue"
                :column="column"
                :options="optionsOf(column)"
                :loading="optionsLoading(column)"
                :invalid="!!errorOf(row, column)"
                commit-on-pick
                @commit="commitEdit"
                @cancel="cancelEdit"
              />
              <span
                v-else
                class="data-grid__text"
                :class="{ 'is-muted': isEmpty(row, column) }"
                >{{ displayOf(row, column) }}</span
              >
            </td>
          </tr>
        </tbody>

        <tbody
          v-if="status === 'loading' || loadingMore"
          class="data-grid__skeleton"
          aria-hidden="true"
        >
          <tr
            v-for="line in status === 'loading' ? 10 : 3"
            :key="`skeleton-${line}`"
            class="data-grid__row data-grid__row--skeleton"
          >
            <td
              v-if="selectable"
              class="data-grid__cell data-grid__cell--select"
            />
            <td class="data-grid__cell data-grid__cell--mark" />
            <td
              v-for="(column, index) in columns"
              :key="column.key"
              class="data-grid__cell"
            >
              <CoreSkeleton
                :width="`${40 + ((line * 7 + index * 13) % 50)}%`"
                :height="10"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="showMessage" class="data-grid__message">
      <slot name="message" />
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  inject,
  nextTick,
  onBeforeUnmount,
  reactive,
  ref,
  watch,
} from 'vue'
import { useI18n } from 'vue-i18n'
import CoreCheckbox from '@cornflow-ui/core/components/core/CoreCheckbox.vue'
import CoreIcon from '@cornflow-ui/core/components/core/CoreIcon.vue'
import CoreSkeleton from '@cornflow-ui/core/components/core/CoreSkeleton.vue'
import CoreSwitch from '@cornflow-ui/core/components/core/CoreSwitch.vue'
import DataGridEditor, { type GridMove } from './DataGridEditor.vue'
import type {
  DataColumn,
  DataColumnOption,
  DataDensity,
  DataRow,
  DataRowLevel,
  DataRowState,
  DataSort,
  DataTableStatus,
} from './types'
import {
  cellText,
  formatCellValue,
  isEmptyValue,
  isTruthy,
  parseCellInput,
  toEditText,
} from '@cornflow-ui/core/utils/dataTable'

defineOptions({ name: 'CoreDataGrid' })

const props = withDefaults(
  defineProps<{
    columns: DataColumn[]
    rows: DataRow[]
    /** A cell's value; the table gives the pending one when the cell was edited. */
    cellValue?: (row: DataRow, key: string) => unknown
    status?: DataTableStatus
    loadingMore?: boolean
    hasMore?: boolean
    density?: DataDensity
    editable?: boolean
    selectable?: boolean
    rowState?: (row: DataRow) => DataRowState | undefined
    rowLevel?: (row: DataRow) => DataRowLevel | undefined
    cellModified?: (row: DataRow, key: string) => boolean
    /** A switch cell that cannot be toggled in that row. */
    cellDisabled?: (row: DataRow, key: string) => boolean
    /** Rows highlighted in the information tone (pinned rows). */
    rowPinned?: (row: DataRow) => boolean
    /** Options of a reference column, once loaded; `undefined` while loading. */
    optionsFor?: (column: DataColumn) => DataColumnOption[] | undefined
    /** A row briefly ringed, the one a "go to" lands on. */
    highlightedRowId?: string | number | null
    adding?: boolean
  }>(),
  {
    cellValue: (row: DataRow, key: string) => row[key],
    status: 'ready',
    loadingMore: false,
    hasMore: false,
    density: 'default',
    editable: false,
    selectable: false,
    rowState: undefined,
    rowLevel: undefined,
    cellModified: undefined,
    cellDisabled: undefined,
    rowPinned: undefined,
    optionsFor: undefined,
    highlightedRowId: null,
    adding: false,
  },
)

const emit = defineEmits<{
  'cell-change': [row: DataRow, key: string, value: unknown]
  'load-more': []
  /** A reference column about to be edited: its options are needed. */
  'need-options': [column: DataColumn]
  add: [values: Record<string, unknown>]
  'add-cancel': []
}>()

const sort = defineModel<DataSort | null>('sort', { default: null })
const selected = defineModel<Array<string | number>>('selected', {
  default: () => [],
})
const widths = defineModel<Record<string, number>>('widths', {
  default: () => ({}),
})

const { t, locale } = useI18n()
const showSnackbar = inject<
  ((message: string, type?: string) => void) | undefined
>('showSnackbar', undefined)

// ── Layout ──────────────────────────────────────────────────────────────────

const ROW_HEIGHTS: Record<DataDensity, number> = {
  compact: 32,
  default: 40,
  comfortable: 52,
}
const rowHeight = computed(() => ROW_HEIGHTS[props.density])
const selectWidth = computed(() => (props.selectable ? 40 : 0))
const MARK_WIDTH = 24
const frozenLeft = computed(() => selectWidth.value + MARK_WIDTH)

const TYPE_WIDTHS: Record<DataColumn['type'], number> = {
  text: 200,
  number: 140,
  boolean: 100,
  list: 140,
  reference: 150,
  date: 130,
  datetime: 170,
  time: 110,
  switch: 96,
}

function defaultWidth(column: DataColumn): number {
  if (column.width) return column.width
  const label = column.title.length + (column.unit ? column.unit.length + 3 : 0)
  return Math.max(
    TYPE_WIDTHS[column.type],
    Math.min(320, Math.ceil(label * 7.2 + 62)),
  )
}

const widthOf = (column: DataColumn) =>
  widths.value[column.key] ?? defaultWidth(column)

/**
 * The columns without a width of their own grow in proportion to their default width to fill
 * the card; when every column has one, the last one takes what is left.
 */
const gridTemplate = computed(() => {
  const flexible = props.columns.some((column) => widths.value[column.key] === undefined)
  const last = props.columns.length - 1
  const track = (column: DataColumn, index: number) => {
    const width = widthOf(column)
    if (widths.value[column.key] === undefined) return `minmax(${width}px, ${width}fr)`
    return !flexible && index === last ? `minmax(${width}px, 1fr)` : `${width}px`
  }
  return [
    props.selectable ? `${selectWidth.value}px` : '',
    `${MARK_WIDTH}px`,
    ...props.columns.map(track),
  ]
    .filter(Boolean)
    .join(' ')
})

const totalWidth = computed(
  () =>
    frozenLeft.value +
    props.columns.reduce((sum, column) => sum + widthOf(column), 0),
)

const TYPE_ICONS: Record<DataColumn['type'], string> = {
  text: 'mdi-format-text',
  number: 'mdi-numeric',
  boolean: 'mdi-checkbox-marked-outline',
  list: 'mdi-format-list-bulleted',
  reference: 'mdi-link-variant',
  date: 'mdi-calendar-blank-outline',
  datetime: 'mdi-calendar-clock-outline',
  time: 'mdi-clock-outline',
  switch: 'mdi-toggle-switch-outline',
}

const typeIcon = (column: DataColumn) =>
  column.readOnly && props.editable
    ? 'mdi-lock-outline'
    : TYPE_ICONS[column.type]

const isEndAligned = (column: DataColumn) => column.type === 'number'

// ── Virtual scroll ──────────────────────────────────────────────────────────

const scroller = ref<HTMLElement>()
const table = ref<HTMLTableElement>()
const scrollTop = ref(0)
const viewportHeight = ref(600)
const OVERSCAN = 8

const start = computed(() =>
  Math.max(0, Math.floor(scrollTop.value / rowHeight.value) - OVERSCAN),
)
const visibleRows = computed(() => {
  const count = Math.ceil(viewportHeight.value / rowHeight.value) + OVERSCAN * 2
  return props.rows.slice(start.value, start.value + count)
})

let loadMoreAt = 0

function onScroll() {
  const element = scroller.value
  if (!element) return
  scrollTop.value = element.scrollTop
  viewportHeight.value = element.clientHeight
  const nearEnd =
    element.scrollTop + element.clientHeight >= element.scrollHeight - 200
  if (
    nearEnd &&
    props.hasMore &&
    !props.loadingMore &&
    Date.now() - loadMoreAt > 150
  ) {
    loadMoreAt = Date.now()
    emit('load-more')
  }
}

let resizeObserver: ResizeObserver | undefined
// Another table in the same grid starts at its top.
watch(
  () => props.columns.map((column) => column.key).join('|'),
  () => {
    if (scroller.value) scroller.value.scrollTop = 0
    scrollTop.value = 0
    active.value = null
    editing.value = false
  },
)

watch(scroller, (element) => {
  resizeObserver?.disconnect()
  if (!element || typeof ResizeObserver === 'undefined') return
  resizeObserver = new ResizeObserver(() => {
    viewportHeight.value = element.clientHeight
  })
  resizeObserver.observe(element)
})

const showMessage = computed(
  () =>
    props.status === 'error' ||
    (props.status === 'ready' && props.rows.length === 0 && !props.adding),
)

// ── Values and states ───────────────────────────────────────────────────────

const cellValue = (row: DataRow, key: string) => props.cellValue(row, key)

const isEmpty = (row: DataRow, column: DataColumn) =>
  isEmptyValue(cellValue(row, column.key))

function displayOf(row: DataRow, column: DataColumn): string {
  return (
    formatCellValue(cellValue(row, column.key), column, locale.value, t) ?? '—'
  )
}

const stateOf = (row: DataRow) => props.rowState?.(row)

function canEditCell(row: DataRow, column: DataColumn): boolean {
  return props.editable && !column.readOnly && stateOf(row) !== 'deleted'
}

const isCellDisabled = (row: DataRow, column: DataColumn) =>
  props.cellDisabled?.(row, column.key) ?? false

const MARKS: Record<string, { icon: string; tone: string; label: string }> = {
  error: {
    icon: 'mdi-alert-circle',
    tone: 'danger',
    label: 'dataTable.grid.levelError',
  },
  warning: {
    icon: 'mdi-alert',
    tone: 'warning',
    label: 'dataTable.grid.levelWarning',
  },
  deleted: {
    icon: 'mdi-delete-outline',
    tone: 'danger',
    label: 'dataTable.grid.rowDeleted',
  },
  new: {
    icon: 'mdi-plus-circle-outline',
    tone: 'new',
    label: 'dataTable.grid.rowNew',
  },
  modified: {
    icon: 'mdi-pencil-outline',
    tone: 'warning',
    label: 'dataTable.grid.rowModified',
  },
}

function markOf(row: DataRow) {
  const key = props.rowLevel?.(row) ?? stateOf(row)
  const mark = key ? MARKS[key] : undefined
  return mark ? { ...mark, label: t(mark.label) } : undefined
}

function rowClasses(row: DataRow) {
  const state = stateOf(row)
  return {
    'is-selected': props.selectable && isSelected(row),
    'is-new': state === 'new',
    'is-deleted': state === 'deleted',
    'is-pinned': props.rowPinned?.(row) ?? false,
    'is-highlighted':
      props.highlightedRowId != null && row.id === props.highlightedRowId,
  }
}

function cellClasses(row: DataRow, column: DataColumn, index: number) {
  return {
    'is-sticky': index === 0,
    'is-end': isEndAligned(column),
    'is-center': column.type === 'switch',
    'is-active': isActive(row, column),
    'is-editing': isEditing(row, column),
    'is-modified': props.cellModified?.(row, column.key) ?? false,
    'is-invalid': !!errorOf(row, column),
    'is-readonly': props.editable && !!column.readOnly,
  }
}

function cellTitle(row: DataRow, column: DataColumn): string | undefined {
  const error = errorOf(row, column)
  if (error) return t(error)
  if (props.editable && column.readOnly)
    return t('dataTable.grid.readOnlyField')
  const text = displayOf(row, column)
  return text.length > 18 ? text : undefined
}

// ── Selection ───────────────────────────────────────────────────────────────

const selectedIds = computed(() => new Set(selected.value))
const isSelected = (row: DataRow) => selectedIds.value.has(row.id)
const selectedVisible = computed(
  () => props.rows.filter((row) => selectedIds.value.has(row.id)).length,
)
const allSelected = computed(
  () => props.rows.length > 0 && selectedVisible.value === props.rows.length,
)
const someSelected = computed(
  () => selectedVisible.value > 0 && !allSelected.value,
)

function toggleRow(row: DataRow) {
  selected.value = isSelected(row)
    ? selected.value.filter((id) => id !== row.id)
    : [...selected.value, row.id]
}

function toggleAll() {
  const ids = new Set(props.rows.map((row) => row.id))
  selected.value = allSelected.value
    ? selected.value.filter((id) => !ids.has(id))
    : [...new Set([...selected.value, ...ids])]
}

// ── Sorting and widths ──────────────────────────────────────────────────────

function toggleSort(column: DataColumn) {
  const current = sort.value
  if (current?.key !== column.key)
    sort.value = { key: column.key, direction: 'asc' }
  else if (current.direction === 'asc')
    sort.value = { key: column.key, direction: 'desc' }
  else sort.value = null
}

function sortIcon(column: DataColumn): string {
  if (sort.value?.key !== column.key) return 'mdi-swap-vertical'
  return sort.value.direction === 'asc' ? 'mdi-arrow-up' : 'mdi-arrow-down'
}

function ariaSort(column: DataColumn) {
  if (sort.value?.key !== column.key) return 'none'
  return sort.value.direction === 'asc' ? 'ascending' : 'descending'
}

const resizing = ref<string | null>(null)
const headers = new Map<string, Element>()

function setHeader(key: string, element: unknown) {
  if (element instanceof Element) headers.set(key, element)
  else headers.delete(key)
}

const shownWidth = (column: DataColumn) =>
  Math.max(widthOf(column), Math.round(headers.get(column.key)?.getBoundingClientRect().width ?? 0))

/**
 * The column and those at its left keep the width they show, so the handle follows the
 * pointer while the columns at its right share what is left.
 */
function startResize(column: DataColumn, event: PointerEvent) {
  event.preventDefault()
  event.stopPropagation()
  const index = props.columns.indexOf(column)
  const shown = Object.fromEntries(props.columns.slice(0, index + 1).map((c) => [c.key, shownWidth(c)]))
  widths.value = { ...widths.value, ...shown }
  const startX = event.clientX
  const startWidth = shown[column.key]
  const maxWidth = Math.max(600, startWidth)
  resizing.value = column.key
  const move = (moveEvent: PointerEvent) => {
    const width = Math.max(
      56,
      Math.min(maxWidth, Math.round(startWidth + moveEvent.clientX - startX)),
    )
    widths.value = { ...widths.value, [column.key]: width }
  }
  const stop = () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', stop)
    resizing.value = null
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', stop)
}

let measureContext: CanvasRenderingContext2D | null | undefined

function textWidth(text: string, font: string): number {
  if (measureContext === undefined) {
    measureContext = document.createElement('canvas').getContext('2d')
  }
  if (!measureContext) return text.length * 7.5
  measureContext.font = font
  return measureContext.measureText(text).width
}

/** Fits a column to its title and the text of its first thousand rows. */
function autoFit(column: DataColumn) {
  const title = column.title + (column.unit ? ` (${column.unit})` : '')
  let width = textWidth(title, '500 12px Roboto, sans-serif') + 60
  if (column.type !== 'switch') {
    for (const row of props.rows.slice(0, 1000)) {
      width = Math.max(
        width,
        textWidth(displayOf(row, column), '400 13px Roboto, sans-serif') + 24,
      )
    }
  }
  widths.value = {
    ...widths.value,
    [column.key]: Math.max(56, Math.min(600, Math.ceil(width))),
  }
}

// ── Active cell and editing ─────────────────────────────────────────────────

const active = ref<{ rowId: string | number; key: string } | null>(null)
const editing = ref(false)
const editValue = ref<unknown>('')
const errors = reactive<Record<string, string>>({})
const editor = ref<Array<InstanceType<typeof DataGridEditor>>>()

const cellId = (rowId: string | number, key: string) => `${rowId}\u0000${key}`
const errorOf = (row: DataRow, column: DataColumn) =>
  errors[cellId(row.id, column.key)]
const isActive = (row: DataRow, column: DataColumn) => {
  const current = active.value
  return !!current && current.rowId === row.id && current.key === column.key
}
const isEditing = (row: DataRow, column: DataColumn) =>
  editing.value && isActive(row, column)

const activeRow = () => props.rows.find((row) => row.id === active.value?.rowId)
const activeColumn = () =>
  props.columns.find((column) => column.key === active.value?.key)

function notice(key: string, named?: Record<string, unknown>) {
  showSnackbar?.(t(key, named ?? {}), 'info')
}

function optionsOf(column: DataColumn) {
  if (column.type !== 'reference') return column.options
  return props.optionsFor?.(column) ?? column.options
}

const optionsLoading = (column: DataColumn) =>
  column.type === 'reference' &&
  !!props.optionsFor &&
  props.optionsFor(column) === undefined

/**
 * Gives the focus back to the grid once the event that called it is over: a click on a cell
 * would otherwise leave it on the page (cells are not focusable) and the arrows would not move.
 */
function focusGrid() {
  setTimeout(() => table.value?.focus({ preventScroll: true }))
}

function setValue(row: DataRow, column: DataColumn, value: unknown) {
  active.value = { rowId: row.id, key: column.key }
  if (!canEditCell(row, column) || isCellDisabled(row, column)) return
  if (value === cellValue(row, column.key)) return
  emit('cell-change', row, column.key, value)
}

/** Why the active cell cannot be edited, as the i18n key of the notice; `null` when it can. */
function editBlocker(row: DataRow, column: DataColumn): string | null {
  if (!props.editable) return null
  if (stateOf(row) === 'deleted') return 'dataTable.grid.deletedRowLocked'
  if (column.readOnly) return 'dataTable.grid.readOnlyField'
  return null
}

function startEdit(initial?: string) {
  const row = activeRow()
  const column = activeColumn()
  if (!row || !column || !props.editable) return
  const blocker = editBlocker(row, column)
  if (blocker) {
    notice(blocker)
    return
  }
  if (column.type === 'switch') {
    setValue(row, column, !isTruthy(cellValue(row, column.key)))
    return
  }
  if (column.type === 'reference') emit('need-options', column)
  editValue.value = initialEditValue(row, column, initial)
  editing.value = true
  setTimeout(() => editor.value?.[0]?.focus())
}

/** What the editor starts with: the key typed over a text or number cell, else the value. */
function initialEditValue(
  row: DataRow,
  column: DataColumn,
  typed?: string,
): unknown {
  if (
    typed !== undefined &&
    (column.type === 'text' || column.type === 'number')
  )
    return typed
  const current = cellValue(row, column.key)
  const selects =
    column.type === 'list' ||
    column.type === 'reference' ||
    column.type === 'boolean'
  return selects ? current : toEditText(current, column, locale.value)
}

function moveActive(move: GridMove) {
  const rowIndex = props.rows.findIndex((row) => row.id === active.value?.rowId)
  const columnIndex = props.columns.findIndex(
    (column) => column.key === active.value?.key,
  )
  if (rowIndex === -1 || columnIndex === -1) return
  const nextRow =
    props.rows[
      Math.max(0, Math.min(props.rows.length - 1, rowIndex + move.rows))
    ]
  const nextColumn =
    props.columns[
      Math.max(
        0,
        Math.min(props.columns.length - 1, columnIndex + move.columns),
      )
    ]
  active.value = { rowId: nextRow.id, key: nextColumn.key }
  scrollIntoView()
}

const STAY: GridMove = { rows: 0, columns: 0 }

function commitEdit(move: GridMove = STAY) {
  const row = activeRow()
  const column = activeColumn()
  if (!editing.value || !row || !column) return
  const id = cellId(row.id, column.key)
  const parsed = parseCellInput(editValue.value, column, locale.value)
  if ('error' in parsed) {
    errors[id] = parsed.error
    return
  }
  delete errors[id]
  editing.value = false
  if (!sameValue(parsed.value, cellValue(row, column.key))) {
    emit('cell-change', row, column.key, parsed.value)
  }
  moveActive(move)
  focusGrid()
}

const sameValue = (a: unknown, b: unknown) =>
  (isEmptyValue(a) && isEmptyValue(b)) || cellText(a) === cellText(b)

function cancelEdit() {
  const row = activeRow()
  const column = activeColumn()
  if (row && column) delete errors[cellId(row.id, column.key)]
  editing.value = false
  focusGrid()
}

function onCellDown(row: DataRow, column: DataColumn, event: PointerEvent) {
  if (isEditing(row, column)) return
  if (editing.value) commitEdit()
  if ((event.target as HTMLElement).closest('button, select, input')) return
  if (isActive(row, column) && !editing.value) {
    startEdit()
    return
  }
  active.value = { rowId: row.id, key: column.key }
  focusGrid()
}

function clearActiveCell() {
  const row = activeRow()
  const column = activeColumn()
  if (!row || !column || !canEditCell(row, column) || column.type === 'switch')
    return
  if (column.required) {
    notice('dataTable.grid.requiredCannotBeEmpty', { column: column.title })
    return
  }
  setValue(row, column, null)
}

const ARROWS: Record<string, GridMove> = {
  ArrowUp: { rows: -1, columns: 0 },
  ArrowDown: { rows: 1, columns: 0 },
  ArrowLeft: { rows: 0, columns: -1 },
  ArrowRight: { rows: 0, columns: 1 },
}

function onActionKey(event: KeyboardEvent): boolean {
  const column = activeColumn()
  switch (event.key) {
    case 'Enter':
    case 'F2':
      startEdit()
      return true
    case 'Escape':
      active.value = null
      return true
    case ' ':
      if (column?.type !== 'switch') return false
      startEdit()
      return true
    case 'Delete':
    case 'Backspace':
      clearActiveCell()
      return true
    default:
      return false
  }
}

function onGridKey(event: KeyboardEvent) {
  if (editing.value || event.target !== table.value) return
  if (!active.value) {
    if (ARROWS[event.key] && props.rows.length && props.columns.length) {
      event.preventDefault()
      active.value = { rowId: props.rows[0].id, key: props.columns[0].key }
    }
    return
  }
  const arrow =
    ARROWS[event.key] ??
    (event.key === 'Tab' ? { rows: 0, columns: event.shiftKey ? -1 : 1 } : null)
  if (arrow) {
    event.preventDefault()
    moveActive(arrow)
    return
  }
  if (onActionKey(event)) {
    event.preventDefault()
    return
  }
  const printable =
    event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey
  if (printable) {
    event.preventDefault()
    startEdit(event.key)
  }
}

/** Scrolls so the active cell is in view, beside the frozen columns. */
function scrollIntoView() {
  const element = scroller.value
  if (!element || !active.value) return
  const rowIndex = props.rows.findIndex((row) => row.id === active.value?.rowId)
  const top = rowIndex * rowHeight.value
  const headerHeight = 38
  const bodyTop = element.scrollTop
  const bodyBottom =
    bodyTop + element.clientHeight - headerHeight - rowHeight.value
  if (top < bodyTop) element.scrollTop = top
  else if (top > bodyBottom)
    element.scrollTop =
      top - element.clientHeight + headerHeight + rowHeight.value

  const columnIndex = props.columns.findIndex(
    (column) => column.key === active.value?.key,
  )
  if (columnIndex <= 0) return
  const left =
    frozenLeft.value +
    props.columns.slice(0, columnIndex).reduce((sum, c) => sum + widthOf(c), 0)
  const right = left + widthOf(props.columns[columnIndex])
  const firstWidth = widthOf(props.columns[0])
  if (left - firstWidth - frozenLeft.value < element.scrollLeft) {
    element.scrollLeft = left - firstWidth - frozenLeft.value
  } else if (right > element.scrollLeft + element.clientWidth) {
    element.scrollLeft = right - element.clientWidth
  }
}

/** Picks a cell and brings it into view: the landing of a "go to" from the pending changes. */
function focusCell(rowId: string | number, key: string) {
  active.value = { rowId, key }
  editing.value = false
  nextTick(() => {
    scrollIntoView()
    focusGrid()
  })
}

watch(
  () => props.rows,
  (rows) => {
    if (active.value && !rows.some((row) => row.id === active.value?.rowId)) {
      active.value = null
      editing.value = false
    }
  },
)

// ── The row being added ─────────────────────────────────────────────────────

const addDraft = ref<Record<string, unknown>>({})
const addErrors = ref<Record<string, string>>({})
const addEditors: Array<InstanceType<typeof DataGridEditor> | null> = []

function setAddEditor(index: number, element: unknown) {
  addEditors[index] = element as InstanceType<typeof DataGridEditor> | null
}

watch(
  () => props.adding,
  (adding) => {
    addErrors.value = {}
    if (!adding) return
    addDraft.value = Object.fromEntries(
      props.columns.map((column) => [
        column.key,
        column.type === 'switch' ? false : '',
      ]),
    )
    props.columns
      .filter((column) => column.type === 'reference')
      .forEach((column) => emit('need-options', column))
    nextTick(() => addEditors.find(Boolean)?.focus())
  },
  { immediate: true },
)

/** Validates the row being added and emits `add` with its values; marks the fields that fail. */
function commitAdd() {
  const values: Record<string, unknown> = {}
  const failures: Record<string, string> = {}
  for (const column of props.columns) {
    if (column.readOnly) continue
    const raw = addDraft.value[column.key]
    if (column.type === 'switch') {
      values[column.key] = !!raw
      continue
    }
    const parsed = parseCellInput(raw, column, locale.value)
    if ('error' in parsed) failures[column.key] = parsed.error
    else values[column.key] = parsed.value
  }
  addErrors.value = failures
  if (Object.keys(failures).length === 0) emit('add', values)
}

onBeforeUnmount(() => resizeObserver?.disconnect())

defineExpose({ commitAdd, focusCell })
</script>

<style scoped>
.data-grid {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  font-family: var(--font-sans);
  font-size: var(--text-md);
  color: var(--color-text);
}

.data-grid__scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
  outline: none;
}

/* A table laid out as a grid: each row a CSS grid of the column widths, the body as tall as
   all its rows, with only the visible ones placed in it. */
.data-grid__table {
  display: block;
  min-width: 100%;
  border-spacing: 0;
  outline: none;
}

.data-grid__table:focus-visible {
  box-shadow: inset 0 0 0 2px var(--color-primary);
}

.data-grid__table thead,
.data-grid__table tbody {
  display: block;
}

.data-grid__row {
  display: grid;
  grid-template-columns: var(--grid-columns);
  height: var(--row-height);
  background: var(--color-surface);
}

.data-grid__body {
  position: relative;
}

.data-grid__body .data-grid__row {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
}

.data-grid__body .data-grid__row:hover {
  --row-background: var(--color-surface-hover);
}

.data-grid__cell {
  position: relative;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  min-width: 0;
  padding: 0 calc(var(--spacing) * 2.5);
  border-right: 1px solid var(--color-divider);
  border-bottom: 1px solid var(--color-divider);
  background: var(--row-background, var(--color-surface));
}

.data-grid__cell.is-end {
  justify-content: flex-end;
  font-variant-numeric: tabular-nums;
}

.data-grid__cell.is-center {
  justify-content: center;
}

.data-grid__cell.is-sticky {
  position: sticky;
  left: 0;
  z-index: 1;
}

.data-grid__cell--select,
.data-grid__cell--mark {
  justify-content: center;
  padding: 0;
}

.data-grid__cell--mark {
  border-right: 0;
}

/* Header */
.data-grid__head {
  position: sticky;
  top: 0;
  z-index: 3;
}

.data-grid__head .data-grid__row {
  height: 38px;
}

.data-grid__head .data-grid__cell {
  --row-background: var(--color-surface-muted);
  text-align: left;
  font-size: var(--text-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-muted);
}

.data-grid__head .data-grid__cell.is-sticky {
  z-index: 4;
}

.data-grid__header {
  padding-right: calc(var(--spacing) * 1.5);
}

.data-grid__sort {
  display: flex;
  flex: 1;
  align-items: center;
  gap: calc(var(--spacing) * 1.5);
  min-width: 0;
  height: 100%;
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  color: inherit;
  cursor: pointer;
}

.data-grid__header.is-end .data-grid__sort {
  justify-content: flex-end;
}

.data-grid__header.is-center .data-grid__sort {
  justify-content: center;
}

.data-grid__title {
  overflow: hidden;
  color: var(--color-text);
  white-space: nowrap;
  text-overflow: ellipsis;
}

.data-grid__header.is-sorted .data-grid__title,
.data-grid__header.is-sorted .data-grid__sort-icon {
  color: var(--color-primary);
}

.data-grid__unit {
  flex: none;
  font-weight: var(--font-weight-regular);
  color: var(--color-text-subtle);
}

.data-grid__type,
.data-grid__source {
  flex: none;
  color: var(--color-text-subtle);
}

.data-grid__sort-icon {
  flex: none;
  color: var(--color-text-subtle);
  opacity: 0.5;
}

.data-grid__header.is-sorted .data-grid__sort-icon,
.data-grid__sort:hover .data-grid__sort-icon {
  opacity: 1;
}

.data-grid__resize {
  position: absolute;
  top: 0;
  right: -3px;
  z-index: 2;
  width: 6px;
  height: 100%;
  cursor: col-resize;
}

/* Inside the last column, so it does not widen the table past its card. */
.data-grid__header:last-child .data-grid__resize {
  right: 0;
}

.data-grid__resize:hover,
.data-grid__resize.is-dragging {
  background: var(--color-primary);
}

/* Cells */
.data-grid__text {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.data-grid__text.is-muted,
.data-grid__cell.is-readonly .data-grid__text {
  color: var(--color-text-subtle);
}

.data-grid__cell.is-active {
  box-shadow: inset 0 0 0 2px var(--color-primary);
}

.data-grid__cell.is-editing {
  padding: 0;
  box-shadow: inset 0 0 0 2px var(--color-primary);
}

.data-grid__cell--editing {
  padding: 0 calc(var(--spacing) * 1);
}

.data-grid__cell.is-modified {
  --row-background: var(--color-warning-soft);
}

.data-grid__cell.is-modified::after {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  border-top: 7px solid var(--color-warning);
  border-left: 7px solid transparent;
}

.data-grid__cell.is-invalid {
  box-shadow: inset 0 0 0 2px var(--color-danger);
}

/* Rows */
.data-grid__row.is-pinned {
  --row-background: var(--color-info-soft);
}

.data-grid__row.is-new,
.data-grid__row--add {
  --row-background: var(--color-success-soft);
}

.data-grid__row.is-deleted {
  --row-background: var(--color-danger-soft);
}

.data-grid__row.is-deleted .data-grid__text {
  color: var(--color-text-subtle);
  text-decoration: line-through;
}

.data-grid__row.is-selected {
  --row-background: var(--color-primary-subtle);
}

.data-grid__row.is-highlighted .data-grid__cell {
  box-shadow:
    inset 0 2px 0 var(--color-warning),
    inset 0 -2px 0 var(--color-warning);
}

.data-grid__mark.is-danger {
  color: var(--color-danger);
}

.data-grid__mark.is-warning {
  color: var(--color-warning);
}

.data-grid__mark.is-new {
  color: var(--color-success);
}

.data-grid__row--skeleton .data-grid__cell {
  border-right-color: transparent;
}

.data-grid__message {
  position: absolute;
  inset: 38px 0 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: calc(var(--spacing) * 6);
  background: var(--color-surface);
}

/* Densities: the row height comes from --row-height; the text follows. */
.data-grid--compact .data-grid__body .data-grid__cell {
  font-size: var(--text-sm);
}

.data-grid--comfortable .data-grid__body .data-grid__cell {
  font-size: var(--text-base);
}
</style>
