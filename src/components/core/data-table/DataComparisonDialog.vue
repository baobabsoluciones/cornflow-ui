<!--
  DataComparisonDialog: a loaded table against its master table, in three views.

  - Summary: how many rows each side has, and how many are new, removed, modified and identical.
    A card opens the view that lists those rows.
  - Side by side: one line per row key, the loaded row on the left and the master row on the
    right, aligned; the cells that differ are tinted. At most four columns, starting with the
    ones that differ.
  - Changes: a card per differing row, filtered by kind; a modified field reads
    "master value → loaded value".

  Removing a loaded row or restoring one from the master emits `delete` / `restore` with the
  line: the screen queues it as a pending change of the table, and the lines it passes back say
  so ("Pending delete", "Pending restore").

  <DataComparisonDialog v-model:open="open" table-title="Products" :columns="columns" :lines="lines"
    :loaded-count="36" :master-count="35" :pending-count="0" allow-restore allow-delete
    @restore="restore" @delete="remove" />
-->
<template>
  <CoreDialog
    :model-value="open"
    :title="$t('dataTable.comparison.title', { table: tableTitle })"
    icon="mdi-compare-horizontal"
    :width="1180"
    closable
    class="data-comparison"
    data-testid="data-comparison"
    @update:model-value="emit('update:open', $event)"
  >
    <div class="data-comparison__bar">
      <span class="data-comparison__subtitle">
        {{ $t('dataTable.comparison.subtitle', { loaded: loadedCount, master: masterCount }) }}
      </span>
      <CoreSegmentedControl v-model="view" :options="viewOptions" size="small" />
    </div>

    <div v-if="view === 'summary'" class="data-comparison__summary">
      <p class="data-comparison__totals">
        <span>
          <b>{{ loadedCount }}</b>
          {{ $t('dataTable.comparison.summary.loadedRows', loadedCount) }}
        </span>
        <CoreIcon name="mdi-arrow-left-right" :size="18" class="data-comparison__totals-arrow" />
        <span>
          <b>{{ masterCount }}</b>
          {{ $t('dataTable.comparison.summary.masterRows', masterCount) }}
        </span>
      </p>
      <div class="data-comparison__cards">
        <button
          v-for="card in cards"
          :key="card.bucket"
          type="button"
          class="data-comparison__card"
          :class="`is-${card.tone}`"
          :data-testid="`comparison-card-${card.bucket}`"
          @click="openBucket(card.bucket)"
        >
          <span class="data-comparison__card-title">
            <CoreIcon :name="card.icon" :size="18" />
            {{ $t(`dataTable.comparison.cards.${card.bucket}.title`) }}
          </span>
          <span class="data-comparison__card-count">{{ counts[card.bucket] }}</span>
          <span class="data-comparison__card-text">
            {{ $t(`dataTable.comparison.cards.${card.bucket}.text`) }}
          </span>
        </button>
      </div>
      <p class="data-comparison__note">{{ $t('dataTable.comparison.summary.note') }}</p>
    </div>

    <div v-else-if="view === 'side'" class="data-comparison__side">
      <p v-if="columns.length > sideColumns.length" class="data-comparison__columns-note">
        <CoreIcon name="mdi-information-outline" :size="15" />
        {{
          $t('dataTable.comparison.side.columnsNote', {
            shown: sideColumns.length,
            total: columns.length,
          })
        }}
      </p>
      <div
        ref="scroller"
        class="data-comparison__grid-scroll"
        data-testid="comparison-side"
        @scroll="onScroll"
      >
        <div class="data-comparison__grid-head" :style="gridStyle">
          <span class="data-comparison__side-title" :style="{ gridColumn: leftSpan }">
            {{ $t('dataTable.comparison.side.loaded', { count: loadedCount }) }}
          </span>
          <span class="data-comparison__side-title" :style="{ gridColumn: rightSpan }">
            {{ $t('dataTable.comparison.side.master', { count: masterCount }) }}
          </span>
          <span />
          <span
            v-for="column in sideColumns"
            :key="`l-${column.key}`"
            class="data-comparison__head-cell"
            :class="{ 'is-number': column.type === 'number' }"
          >
            {{ columnTitle(column) }}
          </span>
          <span class="data-comparison__head-cell is-status">
            {{ $t('dataTable.comparison.side.status') }}
          </span>
          <span
            v-for="column in sideColumns"
            :key="`m-${column.key}`"
            class="data-comparison__head-cell"
            :class="{ 'is-number': column.type === 'number' }"
          >
            {{ columnTitle(column) }}
          </span>
          <span />
        </div>
        <div class="data-comparison__grid-body" :style="{ height: `${lines.length * ROW_HEIGHT}px` }">
          <div
            v-for="line in visibleLines"
            :key="line.key"
            class="data-comparison__line"
            :style="{ ...gridStyle, transform: `translateY(${line.top}px)` }"
            :data-testid="`comparison-line-${line.key}`"
          >
            <span class="data-comparison__action">
              <button
                v-if="canDelete(line)"
                type="button"
                class="data-comparison__icon-button is-danger"
                :title="$t('dataTable.comparison.actions.remove')"
                :aria-label="$t('dataTable.comparison.actions.remove')"
                data-testid="comparison-delete"
                @click="emit('delete', line)"
              >
                <CoreIcon name="mdi-delete-outline" :size="17" />
              </button>
            </span>
            <span
              v-for="column in sideColumns"
              :key="`l-${column.key}`"
              :class="cellClass(line, column, 'loaded')"
            >
              {{ line.loaded ? show(valueIn(line.loaded, column.key), column) : '' }}
            </span>
            <span class="data-comparison__status">
              <CoreBadge v-bind="statusBadge(line.status)" size="sm" />
            </span>
            <span
              v-for="column in sideColumns"
              :key="`m-${column.key}`"
              :class="cellClass(line, column, 'master')"
            >
              {{ line.master ? show(valueIn(line.master, column.key), column) : '' }}
            </span>
            <span class="data-comparison__action">
              <button
                v-if="canRestore(line)"
                type="button"
                class="data-comparison__icon-button"
                :title="$t('dataTable.comparison.actions.restore')"
                :aria-label="$t('dataTable.comparison.actions.restore')"
                data-testid="comparison-restore"
                @click="emit('restore', line)"
              >
                <CoreIcon name="mdi-restore" :size="17" />
              </button>
            </span>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="data-comparison__changes">
      <CoreSegmentedControl v-model="filter" :options="filterOptions" size="small" />
      <div class="data-comparison__list" data-testid="comparison-changes">
        <CoreEmptyState
          v-if="filteredLines.length === 0"
          icon="mdi-check-circle-outline"
          :title="$t('dataTable.comparison.changes.empty')"
        />
        <article
          v-for="line in shownChanges"
          :key="line.key"
          class="data-comparison__change"
          :data-testid="`comparison-change-${line.key}`"
        >
          <header class="data-comparison__change-head">
            <CoreBadge v-bind="statusBadge(line.status)" size="sm" />
            <span class="data-comparison__change-label">{{ rowLabel(line) }}</span>
            <span class="data-comparison__change-actions">
              <CoreButton
                v-if="canDelete(line)"
                variant="text"
                size="small"
                color="danger"
                icon="mdi-delete-outline"
                :text="$t('dataTable.comparison.actions.removeShort')"
                @click="emit('delete', line)"
              />
              <CoreButton
                v-if="canRestore(line)"
                variant="text"
                size="small"
                icon="mdi-restore"
                :text="$t('dataTable.comparison.actions.restoreShort')"
                @click="emit('restore', line)"
              />
            </span>
          </header>
          <dl class="data-comparison__fields">
            <div
              v-for="field in fieldsOf(line)"
              :key="field.key"
              class="data-comparison__field"
              :class="{ 'is-changed': field.changed, 'is-muted': field.muted }"
            >
              <dt>{{ field.title }}</dt>
              <dd>
                <template v-if="field.changed">
                  <s class="data-comparison__old">{{ field.old }}</s>
                  <CoreIcon name="mdi-arrow-right" :size="13" class="data-comparison__arrow" />
                  <span class="data-comparison__new">{{ field.value }}</span>
                </template>
                <template v-else>{{ field.value }}</template>
              </dd>
            </div>
          </dl>
        </article>
        <CoreButton
          v-if="filteredLines.length > shownChanges.length"
          variant="outlined"
          size="small"
          class="data-comparison__more"
          :text="
            $t('dataTable.comparison.changes.more', {
              count: Math.min(PAGE, filteredLines.length - shownChanges.length),
            })
          "
          @click="page += 1"
        />
      </div>
    </div>

    <template #actions>
      <span class="data-comparison__pending" :class="{ 'has-pending': pendingCount > 0 }">
        <CoreIcon
          :name="pendingCount > 0 ? 'mdi-clock-outline' : 'mdi-cancel'"
          :size="16"
        />
        {{ $t('dataTable.comparison.pending', { count: pendingCount, table: tableTitle }, pendingCount) }}
      </span>
      <CoreButton :text="$t('common.close')" @click="emit('update:open', false)" />
    </template>
  </CoreDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import CoreBadge from '@cornflow-ui/core/components/core/CoreBadge.vue'
import CoreButton from '@cornflow-ui/core/components/core/CoreButton.vue'
import CoreDialog from '@cornflow-ui/core/components/core/CoreDialog.vue'
import CoreEmptyState from '@cornflow-ui/core/components/core/CoreEmptyState.vue'
import CoreIcon from '@cornflow-ui/core/components/core/CoreIcon.vue'
import CoreSegmentedControl from '@cornflow-ui/core/components/core/CoreSegmentedControl.vue'
import type { DataColumn } from '@cornflow-ui/core/components/core/data-table/types'
import type { CoreTone } from '@cornflow-ui/core/types/ui'
import { formatCellValue } from '@cornflow-ui/core/utils/dataTable'
import {
  comparisonBucket,
  type ComparisonLine,
  type ComparisonStatus,
} from '@cornflow-ui/core/utils/dataComparison'

defineOptions({ name: 'DataComparisonDialog' })

export type { ComparisonLine, ComparisonStatus }

type Bucket = 'added' | 'removed' | 'modified' | 'identical'
type View = 'summary' | 'side' | 'changes'

const props = withDefaults(
  defineProps<{
    open: boolean
    tableTitle: string
    columns: DataColumn[]
    lines: ComparisonLine[]
    loadedCount: number
    masterCount: number
    /** Pending changes of this table, the queued removals and restorations among them. */
    pendingCount?: number
    allowRestore?: boolean
    allowDelete?: boolean
  }>(),
  { pendingCount: 0, allowRestore: false, allowDelete: false },
)

const emit = defineEmits<{
  'update:open': [value: boolean]
  restore: [line: ComparisonLine]
  delete: [line: ComparisonLine]
}>()

const { t, locale } = useI18n()

/** Side by side: rows of a fixed height, only the visible ones rendered. */
const ROW_HEIGHT = 37
const OVERSCAN = 8
/** Changes: cards rendered per page. */
const PAGE = 50
const MAX_SIDE_COLUMNS = 4

const view = ref<View>('summary')
const filter = ref<'all' | Exclude<Bucket, 'identical'>>('all')
const page = ref(1)

watch(
  () => props.open,
  (open) => {
    if (!open) return
    view.value = 'summary'
    filter.value = 'all'
    page.value = 1
  },
)
watch(filter, () => (page.value = 1))

const viewOptions = computed(() => [
  { value: 'summary', label: t('dataTable.comparison.views.summary') },
  { value: 'side', label: t('dataTable.comparison.views.side') },
  { value: 'changes', label: t('dataTable.comparison.views.changes') },
])

const counts = computed(() => {
  const result: Record<Bucket, number> = { added: 0, removed: 0, modified: 0, identical: 0 }
  for (const line of props.lines) result[comparisonBucket(line.status)] += 1
  return result
})

const cards: { bucket: Bucket; icon: string; tone: CoreTone }[] = [
  { bucket: 'added', icon: 'mdi-plus-circle-outline', tone: 'success' },
  { bucket: 'removed', icon: 'mdi-minus-circle-outline', tone: 'danger' },
  { bucket: 'modified', icon: 'mdi-pencil-outline', tone: 'warning' },
  { bucket: 'identical', icon: 'mdi-equal', tone: 'neutral' },
]

function openBucket(bucket: Bucket) {
  if (bucket === 'identical') {
    view.value = 'side'
    return
  }
  filter.value = bucket
  view.value = 'changes'
}

// ── Values ───────────────────────────────────────────────────────────────────

/** A row value by column key, whatever the case of the row's own keys. */
function valueIn(row: Record<string, unknown>, key: string): unknown {
  if (key in row) return row[key]
  const lower = key.toLowerCase()
  const match = Object.keys(row).find((k) => k.toLowerCase() === lower)
  return match === undefined ? undefined : row[match]
}

function show(value: unknown, column: DataColumn): string {
  return formatCellValue(value, column, locale.value, t) ?? '—'
}

function columnTitle(column: DataColumn): string {
  return column.unit ? `${column.title} (${column.unit})` : column.title
}

function isChanged(line: ComparisonLine, key: string): boolean {
  const lower = key.toLowerCase()
  return line.changedKeys.some((changed) => changed.toLowerCase() === lower)
}

function rowLabel(line: ComparisonLine): string {
  const first = props.columns[0]
  const row = line.loaded ?? line.master
  if (!first || !row) return line.key
  const value = formatCellValue(valueIn(row, first.key), first, locale.value, t)
  return t('dataTable.comparison.rowLabel', {
    column: first.title,
    value: value ?? t('dataTable.comparison.noValue'),
  })
}

// ── Status and actions ───────────────────────────────────────────────────────

const STATUS_BADGES: Record<ComparisonStatus, { tone: CoreTone; icon: string }> = {
  added: { tone: 'success', icon: 'mdi-plus-circle-outline' },
  removed: { tone: 'danger', icon: 'mdi-minus-circle-outline' },
  modified: { tone: 'warning', icon: 'mdi-pencil-outline' },
  identical: { tone: 'neutral', icon: 'mdi-equal' },
  pendingDelete: { tone: 'danger', icon: 'mdi-delete-clock-outline' },
  pendingCreate: { tone: 'success', icon: 'mdi-clock-plus-outline' },
  pendingRestore: { tone: 'primary', icon: 'mdi-backup-restore' },
}

function statusBadge(status: ComparisonStatus) {
  return { ...STATUS_BADGES[status], label: t(`dataTable.comparison.status.${status}`) }
}

function canDelete(line: ComparisonLine): boolean {
  return props.allowDelete && !!line.loaded && line.status !== 'pendingDelete'
}

function canRestore(line: ComparisonLine): boolean {
  return (
    props.allowRestore &&
    !!line.master &&
    (line.status === 'removed' || line.status === 'modified' || line.status === 'pendingDelete')
  )
}

// ── Side by side ─────────────────────────────────────────────────────────────

/** The first column, then the ones that differ somewhere, then others (not dates) up to four. */
const sideColumns = computed<DataColumn[]>(() => {
  const [first, ...rest] = props.columns
  if (!first) return []
  const differing = new Set(
    props.lines.flatMap((line) => line.changedKeys.map((key) => key.toLowerCase())),
  )
  const picked = [first, ...rest.filter((c) => differing.has(c.key.toLowerCase()))]
  for (const column of rest) {
    if (picked.length >= MAX_SIDE_COLUMNS) break
    if (!picked.includes(column) && column.type !== 'date' && column.type !== 'datetime') {
      picked.push(column)
    }
  }
  return picked.slice(0, MAX_SIDE_COLUMNS)
})

const gridStyle = computed(() => {
  const side = sideColumns.value.map(() => 'minmax(90px, 1fr)').join(' ')
  return { gridTemplateColumns: `36px ${side} 150px ${side} 36px` }
})
const leftSpan = computed(() => `1 / span ${sideColumns.value.length + 1}`)
const rightSpan = computed(() => `${sideColumns.value.length + 3} / span ${sideColumns.value.length + 1}`)

function cellClass(line: ComparisonLine, column: DataColumn, side: 'loaded' | 'master') {
  const row = side === 'loaded' ? line.loaded : line.master
  return [
    'data-comparison__cell',
    {
      'is-number': column.type === 'number',
      'is-missing': !row,
      'is-changed': !!row && isChanged(line, column.key),
      'is-struck': side === 'loaded' && line.status === 'pendingDelete',
    },
  ]
}

const scroller = ref<HTMLElement>()
const scrollTop = ref(0)
const viewportHeight = ref(480)

function onScroll() {
  scrollTop.value = scroller.value?.scrollTop ?? 0
  viewportHeight.value = scroller.value?.clientHeight || viewportHeight.value
}

const visibleLines = computed(() => {
  const start = Math.max(0, Math.floor(scrollTop.value / ROW_HEIGHT) - OVERSCAN)
  const end = Math.min(
    props.lines.length,
    Math.ceil((scrollTop.value + viewportHeight.value) / ROW_HEIGHT) + OVERSCAN,
  )
  return props.lines.slice(start, end).map((line, i) => ({ ...line, top: (start + i) * ROW_HEIGHT }))
})

// ── Changes ──────────────────────────────────────────────────────────────────

const differingLines = computed(() =>
  props.lines.filter((line) => comparisonBucket(line.status) !== 'identical'),
)

const filterOptions = computed(() =>
  (['all', 'added', 'removed', 'modified'] as const).map((value) => ({
    value,
    label: t(`dataTable.comparison.filters.${value}`),
    count: value === 'all' ? differingLines.value.length : counts.value[value],
  })),
)

const filteredLines = computed(() =>
  filter.value === 'all'
    ? differingLines.value
    : differingLines.value.filter((line) => comparisonBucket(line.status) === filter.value),
)

const shownChanges = computed(() => filteredLines.value.slice(0, page.value * PAGE))

interface ChangeField {
  key: string
  title: string
  value: string
  old?: string
  changed: boolean
  muted: boolean
}

/** Every column but the first (it names the row); a modified row dims what did not change. */
function fieldsOf(line: ComparisonLine): ChangeField[] {
  const row = line.status === 'removed' || line.status === 'pendingDelete'
    ? (line.master ?? line.loaded)
    : (line.loaded ?? line.master)
  const empty = t('dataTable.comparison.emptyValue')
  return props.columns.slice(1).map((column) => {
    const changed = !!line.master && !!line.loaded && isChanged(line, column.key)
    const value = row ? formatCellValue(valueIn(row, column.key), column, locale.value, t) : null
    const old = changed && line.master
      ? formatCellValue(valueIn(line.master, column.key), column, locale.value, t)
      : null
    return {
      key: column.key,
      title: columnTitle(column),
      value: value ?? (changed ? empty : '—'),
      old: changed ? (old ?? empty) : undefined,
      changed,
      muted: line.status === 'modified' && !changed,
    }
  })
}
</script>

<!-- Not scoped: the dialog is rendered in a portal (see CoreDialog). -->
<style>
.data-comparison.core-dialog {
  height: min(780px, calc(100vh - 32px));
  overflow: hidden;
}

.data-comparison .core-dialog__body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 4);
  color: var(--color-text);
}

.data-comparison .core-dialog__actions {
  align-items: center;
  margin-top: 0;
}
</style>

<style scoped>
.data-comparison__bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: calc(var(--spacing) * 3);
}

.data-comparison__subtitle {
  font-size: var(--text-md);
  color: var(--color-text-muted);
}

/* Summary */
.data-comparison__summary {
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 5);
}

.data-comparison__totals {
  display: flex;
  align-items: baseline;
  gap: calc(var(--spacing) * 6);
  margin: 0;
  font-size: var(--text-base);
  color: var(--color-text-muted);
}

.data-comparison__totals b {
  font-size: var(--text-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text);
}

.data-comparison__totals-arrow {
  align-self: center;
  color: var(--color-text-subtle);
}

.data-comparison__cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: calc(var(--spacing) * 3);
}

.data-comparison__card {
  --card-tone: var(--color-text-muted);

  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: calc(var(--spacing) * 2);
  padding: calc(var(--spacing) * 4);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color var(--duration-fast) var(--ease-standard);
}

.data-comparison__card:hover {
  border-color: var(--color-border-strong);
}

.data-comparison__card.is-success {
  --card-tone: var(--color-success-strong);
}

.data-comparison__card.is-danger {
  --card-tone: var(--color-danger-strong);
}

.data-comparison__card.is-warning {
  --card-tone: var(--color-warning-strong);
}

.data-comparison__card-title {
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 1.5);
  font-size: var(--text-md);
  font-weight: var(--font-weight-medium);
  color: var(--card-tone);
}

.data-comparison__card-count {
  font-size: var(--text-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text);
}

.data-comparison__card-text,
.data-comparison__note {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

/* Side by side */
.data-comparison__side {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 2);
}

.data-comparison__columns-note {
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 1.5);
  margin: 0;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.data-comparison__grid-scroll {
  position: relative;
  flex: 1;
  min-height: 240px;
  overflow: auto;
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-md);
}

.data-comparison__grid-head {
  position: sticky;
  top: 0;
  z-index: 1;
  display: grid;
  background: var(--color-surface-muted);
  border-bottom: 1px solid var(--color-border);
}

.data-comparison__side-title {
  padding: calc(var(--spacing) * 2) calc(var(--spacing) * 3) 0;
  font-size: var(--text-xs);
  font-weight: var(--font-weight-medium);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}

.data-comparison__head-cell {
  padding: calc(var(--spacing) * 2) calc(var(--spacing) * 3);
  overflow: hidden;
  font-size: var(--text-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
  white-space: nowrap;
  text-overflow: ellipsis;
}

.data-comparison__head-cell.is-status {
  border-inline: 1px solid var(--color-border-subtle);
  text-align: center;
}

.data-comparison__grid-body {
  position: relative;
}

.data-comparison__line {
  position: absolute;
  inset-inline: 0;
  top: 0;
  display: grid;
  align-items: stretch;
  height: 37px;
  box-sizing: border-box;
  border-bottom: 1px solid var(--color-divider);
}

.data-comparison__cell {
  display: flex;
  align-items: center;
  min-width: 0;
  padding: 0 calc(var(--spacing) * 3);
  overflow: hidden;
  font-size: var(--text-md);
  color: var(--color-text);
  white-space: nowrap;
  text-overflow: ellipsis;
}

.data-comparison__cell.is-number,
.data-comparison__head-cell.is-number {
  justify-content: flex-end;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.data-comparison__cell.is-changed {
  background: var(--color-warning-soft);
  font-weight: var(--font-weight-medium);
}

.data-comparison__cell.is-struck {
  color: var(--color-text-subtle);
  text-decoration: line-through;
}

.data-comparison__cell.is-missing {
  background: repeating-linear-gradient(
    135deg,
    var(--color-surface-muted) 0 6px,
    var(--color-surface) 6px 12px
  );
}

.data-comparison__status {
  display: flex;
  align-items: center;
  justify-content: center;
  border-inline: 1px solid var(--color-border-subtle);
}

.data-comparison__action {
  display: flex;
  align-items: center;
  justify-content: center;
}

.data-comparison__icon-button {
  display: inline-flex;
  padding: calc(var(--spacing) * 1);
  border: 0;
  border-radius: var(--radius-sm);
  background: none;
  color: var(--color-primary);
  cursor: pointer;
}

.data-comparison__icon-button.is-danger {
  color: var(--color-danger-strong);
}

.data-comparison__icon-button:hover {
  background: var(--color-surface-hover);
}

/* Changes */
.data-comparison__changes {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 3);
}

.data-comparison__list {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 2.5);
  overflow: auto;
}

.data-comparison__change {
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 2.5);
  padding: calc(var(--spacing) * 3) calc(var(--spacing) * 4);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
}

.data-comparison__change-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: calc(var(--spacing) * 2.5);
}

.data-comparison__change-label {
  font-size: var(--text-md);
  font-weight: var(--font-weight-medium);
}

.data-comparison__change-actions {
  display: flex;
  gap: calc(var(--spacing) * 1);
  margin-left: auto;
}

.data-comparison__fields {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: calc(var(--spacing) * 2) calc(var(--spacing) * 4);
  margin: 0;
}

.data-comparison__field dt {
  font-size: var(--text-xs);
  color: var(--color-text-subtle);
}

.data-comparison__field dd {
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 1);
  min-width: 0;
  margin: 0;
  font-size: var(--text-md);
  color: var(--color-text);
}

.data-comparison__field.is-muted {
  opacity: 0.5;
}

.data-comparison__field.is-changed dt {
  color: var(--color-text);
}

.data-comparison__old {
  color: var(--color-text-subtle);
}

.data-comparison__arrow {
  flex: none;
  color: var(--color-text-subtle);
}

.data-comparison__new {
  overflow: hidden;
  padding: 0 calc(var(--spacing) * 1);
  border-radius: var(--radius-sm);
  background: var(--color-warning-soft);
  font-weight: var(--font-weight-medium);
  white-space: nowrap;
  text-overflow: ellipsis;
}

.data-comparison__more {
  align-self: center;
}

/* Footer */
.data-comparison__pending {
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 1.5);
  margin-right: auto;
  font-size: var(--text-md);
  color: var(--color-text-muted);
}

.data-comparison__pending.has-pending {
  color: var(--color-warning-strong);
}
</style>
