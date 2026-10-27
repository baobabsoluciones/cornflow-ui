<!--
  PendingChangesPanel: the review of the pending changes of every table, before they are saved
  (or applied, or relaunched).

  A side panel, docked by the host beside the table at the full height of its container, lists
  the changes per table: each changed row with its kind (modified, new, deleted) and, for an edited
  row, every changed field as "old → new". Rows and fields can be reverted one by one, a table at
  once or everything (after an inline confirmation). Clicking a row or a field asks the host to
  take the user to it (`go-to`).

  The expand button opens the same changes in a large dialog, where each row is a small table with
  all its columns and the values can still be corrected: edited cells show the old value struck
  out above the new one, new rows are editable in full, deleted rows read-only. A correction is
  validated as the table does and emitted with `update-field`; the host records it.

  The host owns the saving: `saving` locks the panel while it runs, `banner` shows a validation or
  server error (with a retry for the server), and `overwrite` asks for a second confirmation when
  the server reports data that depends on what is about to change.

  <PendingChangesPanel v-model:open="reviewOpen" :groups="groups" :saving="saving"
    :save-label="$t('dataTable.pending.save')" @save="saveAll" @revert-all="revertAll" />
-->
<template>
  <aside
    v-if="open && !expanded"
    class="pending-panel"
    :aria-label="$t('dataTable.pending.title')"
    data-testid="pending-changes-panel"
  >
    <header class="pending-panel__header">
      <CoreIcon name="mdi-file-compare" :size="20" class="pending-panel__header-icon" />
      <div class="pending-panel__heading">
        <span class="pending-panel__title">{{ $t('dataTable.pending.title') }}</span>
        <span class="pending-panel__subtitle">{{ summaryText }}</span>
      </div>
      <CoreButton
        variant="icon"
        size="small"
        icon="mdi-arrow-expand"
        :aria-label="$t('dataTable.pending.expand')"
        :title="$t('dataTable.pending.expand')"
        data-testid="pending-expand"
        @click="expanded = true"
      />
      <CoreButton
        variant="icon"
        size="small"
        icon="mdi-close"
        :aria-label="$t('common.close')"
        :title="$t('common.close')"
        :disabled="saving"
        data-testid="pending-close"
        @click="close"
      />
    </header>

    <div v-if="banner" class="pending-panel__banner">
      <CoreAlert
        tone="error"
        :title="bannerTitle"
        :message="banner.message"
        :action-label="banner.canRetry ? $t('dataTable.pending.retry') : ''"
        @action="emit('retry')"
      />
      <CoreButton
        variant="icon"
        size="xs"
        icon="mdi-close"
        class="pending-panel__banner-close"
        :aria-label="$t('dataTable.pending.closeBanner')"
        :title="$t('dataTable.pending.closeBanner')"
        @click="emit('close-banner')"
      />
    </div>

    <div class="pending-panel__body">
      <CoreEmptyState
        v-if="!hasChanges"
        icon="mdi-check-circle-outline"
        :title="$t('dataTable.pending.empty')"
        :text="$t('dataTable.pending.emptyText')"
      />
      <section
        v-for="group in groups"
        :key="group.tableKey"
        class="pending-panel__group"
        :data-testid="`pending-group-${group.tableKey}`"
      >
        <div class="pending-panel__group-header">
          <button
            type="button"
            class="pending-panel__group-toggle"
            :aria-expanded="isOpen(group.tableKey)"
            @click="toggle(group.tableKey)"
          >
            <CoreIcon
              :name="isOpen(group.tableKey) ? 'mdi-chevron-down' : 'mdi-chevron-right'"
              :size="18"
            />
            <span class="pending-panel__group-title">{{ group.title }}</span>
            <span class="pending-panel__group-count">{{
              $t('dataTable.pending.rowsAffected', group.items.length)
            }}</span>
          </button>
          <CoreButton
            variant="text"
            size="xs"
            icon="mdi-undo-variant"
            :text="$t('dataTable.pending.revertTable')"
            :title="$t('dataTable.pending.revertTableTitle')"
            :disabled="saving"
            :data-testid="`pending-revert-table-${group.tableKey}`"
            @click="emit('revert-table', group.tableKey)"
          />
        </div>

        <ul v-if="isOpen(group.tableKey)" class="pending-panel__items">
          <li
            v-for="item in group.items"
            :key="`${item.kind}-${item.rowId}`"
            class="pending-panel__item"
            :data-testid="`pending-item-${item.rowId}`"
          >
            <div class="pending-panel__item-head">
              <button
                type="button"
                class="pending-panel__item-go"
                :title="$t('dataTable.pending.goToRow')"
                @click="goTo(item, item.changedKeys[0] ?? group.columns[0]?.key)"
              >
                <CoreBadge
                  :label="$t(KINDS[item.kind].label)"
                  :tone="KINDS[item.kind].tone"
                  :icon="KINDS[item.kind].icon"
                  size="sm"
                />
                <span
                  class="pending-panel__item-label"
                  :class="{ 'is-deleted': item.kind === 'deleted' }"
                  >{{ item.label }}</span
                >
              </button>
              <button
                type="button"
                class="pending-panel__link"
                :disabled="saving"
                :data-testid="`pending-revert-row-${item.rowId}`"
                @click="emit('revert-row', item.tableKey, item.rowId, item.kind)"
              >
                <CoreIcon name="mdi-undo-variant" :size="14" />
                {{ $t(KINDS[item.kind].revert) }}
              </button>
            </div>

            <div v-if="item.kind === 'modified'" class="pending-panel__fields">
              <div
                v-for="field in fieldsOf(group, item)"
                :key="field.key"
                class="pending-panel__field"
              >
                <button
                  type="button"
                  class="pending-panel__field-go"
                  :title="$t('dataTable.pending.goToCell')"
                  @click="goTo(item, field.key)"
                >
                  <span class="pending-panel__field-title">{{ field.title }}</span>
                  <span class="pending-panel__field-values">
                    <span class="pending-panel__old">{{ field.old }}</span>
                    <CoreIcon name="mdi-arrow-right" :size="12" class="pending-panel__arrow" />
                    <span class="pending-panel__new">{{ field.new }}</span>
                  </span>
                </button>
                <CoreButton
                  variant="icon"
                  size="xs"
                  icon="mdi-undo-variant"
                  class="pending-panel__field-revert"
                  :aria-label="$t('dataTable.pending.revertField')"
                  :title="$t('dataTable.pending.revertField')"
                  :disabled="saving"
                  :data-testid="`pending-revert-field-${item.rowId}-${field.key}`"
                  @click="emit('revert-field', item.tableKey, item.rowId, field.key)"
                />
              </div>
            </div>
            <span
              v-else
              class="pending-panel__summary"
              :class="{ 'is-deleted': item.kind === 'deleted' }"
              >{{ summaryOf(group, item) }}</span
            >
          </li>
        </ul>
      </section>
    </div>

    <div v-if="saving" class="pending-panel__saving" role="status">
      <span class="pending-panel__saving-pill">
        <CoreSpinner :size="18" />
        {{ $t('dataTable.pending.processing') }}
      </span>
    </div>

    <footer v-if="hasChanges" class="pending-panel__footer">
      <template v-if="confirming">
        <span class="pending-panel__confirm-text">
          <CoreIcon name="mdi-alert-outline" :size="16" />
          {{ $t('dataTable.pending.confirmRevertAll', totalChanges) }}
        </span>
        <div class="pending-panel__actions">
          <CoreButton
            variant="text"
            size="small"
            :text="$t('dataTable.pending.no')"
            @click="confirming = false"
          />
          <CoreButton
            size="small"
            color="danger"
            :text="$t('dataTable.pending.revertAllConfirm')"
            data-testid="pending-revert-all-confirm"
            @click="revertAll"
          />
        </div>
      </template>
      <div v-else class="pending-panel__actions">
        <CoreButton
          variant="text"
          color="danger"
          icon="mdi-undo"
          :text="$t('dataTable.pending.revertAll')"
          :disabled="saving"
          data-testid="pending-revert-all"
          @click="confirming = true"
        />
        <span class="pending-panel__spacer" />
        <CoreButton
          icon="mdi-content-save-outline"
          :text="saveLabel"
          :disabled="saving"
          data-testid="pending-save"
          @click="emit('save')"
        />
      </div>
    </footer>
  </aside>

  <CoreDialog
    :model-value="open && expanded"
    :title="$t('dataTable.pending.title')"
    icon="mdi-file-compare"
    :width="1400"
    :persistent="saving"
    closable
    class="pending-dialog"
    data-testid="pending-changes-dialog"
    @update:model-value="!$event && (expanded = false)"
  >
    <div class="pending-dialog__content">
      <p class="pending-dialog__subtitle">
        {{ hasChanges ? $t('dataTable.pending.dialogSubtitle', { summary: summaryText }) : $t('dataTable.pending.nothingToSave') }}
      </p>

      <div v-if="banner" class="pending-dialog__banner">
        <CoreAlert
          tone="error"
          :title="bannerTitle"
          :message="banner.message"
          :action-label="banner.canRetry ? $t('dataTable.pending.retry') : ''"
          @action="emit('retry')"
        />
        <CoreButton
          variant="icon"
          size="xs"
          icon="mdi-close"
          class="pending-panel__banner-close"
          :aria-label="$t('dataTable.pending.closeBanner')"
          :title="$t('dataTable.pending.closeBanner')"
          @click="emit('close-banner')"
        />
      </div>

      <CoreEmptyState
        v-if="!hasChanges"
        icon="mdi-check-circle-outline"
        :title="$t('dataTable.pending.empty')"
        :text="$t('dataTable.pending.emptyTextDialog')"
      />

      <section
        v-for="group in groups"
        :key="group.tableKey"
        class="pending-dialog__group"
        :data-testid="`pending-dialog-group-${group.tableKey}`"
      >
        <div class="pending-dialog__group-header">
          <button
            type="button"
            class="pending-panel__group-toggle"
            :aria-expanded="isOpen(group.tableKey)"
            @click="toggle(group.tableKey)"
          >
            <CoreIcon
              :name="isOpen(group.tableKey) ? 'mdi-chevron-down' : 'mdi-chevron-right'"
              :size="20"
            />
            <span class="pending-dialog__group-title">{{ group.title }}</span>
            <span class="pending-panel__group-count">{{
              $t('dataTable.pending.rowsAffected', group.items.length)
            }}</span>
          </button>
          <span class="pending-dialog__pills">
            <CoreBadge
              v-for="pill in pillsOf(group)"
              :key="pill.kind"
              :label="pill.label"
              :tone="KINDS[pill.kind].tone"
              :icon="KINDS[pill.kind].icon"
              size="sm"
            />
          </span>
          <span class="pending-panel__spacer" />
          <CoreButton
            variant="text"
            size="xs"
            icon="mdi-undo-variant"
            :text="$t('dataTable.pending.revertTable')"
            :disabled="saving"
            @click="emit('revert-table', group.tableKey)"
          />
        </div>

        <div v-if="isOpen(group.tableKey)" class="pending-dialog__rows">
          <div
            v-for="item in group.items"
            :key="`${item.kind}-${item.rowId}`"
            class="pending-dialog__row"
            :data-testid="`pending-dialog-row-${item.rowId}`"
          >
            <div class="pending-dialog__row-head">
              <CoreBadge
                :label="$t(KINDS[item.kind].rowLabel)"
                :tone="KINDS[item.kind].tone"
                :icon="KINDS[item.kind].icon"
                size="sm"
              />
              <span class="pending-dialog__row-label">{{ item.label }}</span>
              <span class="pending-panel__spacer" />
              <button
                type="button"
                class="pending-panel__link"
                :disabled="saving"
                @click="emit('revert-row', item.tableKey, item.rowId, item.kind)"
              >
                <CoreIcon name="mdi-undo-variant" :size="14" />
                {{ $t(KINDS[item.kind].revert) }}
              </button>
            </div>

            <div class="pending-dialog__grid-wrap">
              <div class="pending-dialog__grid" :style="{ gridTemplateColumns: gridColumnsOf(group) }">
                <div
                  v-for="column in group.columns"
                  :key="`head-${column.key}`"
                  class="pending-dialog__head"
                  :title="headerOf(column)"
                >
                  {{ headerOf(column) }}
                </div>
                <div
                  v-for="column in group.columns"
                  :key="`cell-${column.key}`"
                  class="pending-dialog__cell"
                  :class="[`is-${item.kind}`, { 'is-changed': isChanged(item, column.key) }]"
                  :data-testid="`pending-cell-${item.rowId}-${column.key}`"
                >
                  <span v-if="isChanged(item, column.key)" class="pending-dialog__cell-old">
                    <span class="pending-panel__old">{{ show(item.original?.[column.key], column) }}</span>
                    →
                  </span>
                  <div class="pending-dialog__cell-value">
                    <span
                      v-if="!isEditable(item, column)"
                      class="pending-dialog__cell-text"
                      :class="{ 'is-deleted': item.kind === 'deleted', 'is-readonly': column.readOnly }"
                      >{{ formatted(item.row[column.key], column) ?? '—' }}</span
                    >
                    <CoreSwitch
                      v-else-if="column.type === 'switch'"
                      :model-value="isTruthy(item.row[column.key])"
                      :aria-label="column.title"
                      @update:model-value="commit(item, column, $event)"
                    />
                    <CoreSelect
                      v-else-if="choicesOf(column)"
                      size="small"
                      :model-value="item.row[column.key]"
                      :options="choicesOf(column) ?? []"
                      :placeholder="column.required ? $t('dataTable.pending.choose') : $t('dataTable.pending.emptyOption')"
                      :clearable="!column.required"
                      :invalid="!!errorOf(item, column)"
                      :aria-label="column.title"
                      @update:model-value="commit(item, column, $event)"
                    />
                    <CoreTextField
                      v-else
                      size="small"
                      lazy
                      :type="column.type === 'date' ? 'date' : 'text'"
                      :inputmode="column.type === 'number' ? 'decimal' : undefined"
                      :class="{ 'is-number': column.type === 'number' }"
                      :model-value="toEditText(item.row[column.key], column, locale)"
                      :invalid="!!errorOf(item, column)"
                      :aria-label="column.title"
                      @update:model-value="commit(item, column, $event)"
                    />
                    <CoreButton
                      v-if="isChanged(item, column.key)"
                      variant="icon"
                      size="xs"
                      icon="mdi-undo-variant"
                      :aria-label="$t('dataTable.pending.revertField')"
                      :title="$t('dataTable.pending.revertField')"
                      :disabled="saving"
                      @click="emit('revert-field', item.tableKey, item.rowId, column.key)"
                    />
                  </div>
                  <span v-if="errorOf(item, column)" class="pending-dialog__cell-error">{{
                    $t(errorOf(item, column) ?? '')
                  }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div v-if="saving" class="pending-panel__saving" role="status">
        <span class="pending-panel__saving-pill">
          <CoreSpinner :size="20" />
          {{ $t('dataTable.pending.processing') }}
        </span>
      </div>
    </div>

    <template #actions>
      <template v-if="confirming">
        <span class="pending-panel__confirm-text">
          <CoreIcon name="mdi-alert-outline" :size="16" />
          {{ $t('dataTable.pending.confirmRevertAll', totalChanges) }}
        </span>
        <CoreButton variant="text" :text="$t('dataTable.pending.no')" @click="confirming = false" />
        <CoreButton color="danger" :text="$t('dataTable.pending.revertAllConfirm')" @click="revertAll" />
      </template>
      <template v-else>
        <CoreButton
          v-if="hasChanges"
          variant="text"
          color="danger"
          icon="mdi-undo"
          :text="$t('dataTable.pending.revertAllChanges')"
          :disabled="saving"
          @click="confirming = true"
        />
        <span class="pending-panel__spacer" />
        <CoreButton
          variant="text"
          :text="hasChanges ? $t('dataTable.pending.cancel') : $t('common.close')"
          :disabled="saving"
          @click="expanded = false"
        />
        <CoreButton
          v-if="hasChanges"
          icon="mdi-content-save-outline"
          :text="saveLabel"
          :disabled="saving"
          data-testid="pending-dialog-save"
          @click="emit('save')"
        />
      </template>
    </template>
  </CoreDialog>

  <CoreDialog
    :model-value="open && !!overwrite"
    :title="$t('dataTable.pending.overwriteTitle')"
    icon="mdi-alert"
    tone="danger"
    :width="480"
    persistent
    data-testid="pending-overwrite"
    @update:model-value="!$event && emit('cancel-overwrite')"
  >
    <div class="pending-overwrite">
      <span>{{ $t('dataTable.pending.overwriteIntro') }}</span>
      <span class="pending-overwrite__message">{{ overwrite?.message }}</span>
      <span>{{ $t('dataTable.pending.overwriteNote') }}</span>
    </div>
    <template #actions>
      <CoreButton
        variant="text"
        :text="$t('dataTable.pending.cancel')"
        data-testid="pending-overwrite-cancel"
        @click="emit('cancel-overwrite')"
      />
      <CoreButton
        color="danger"
        :text="$t('dataTable.pending.overwriteConfirm')"
        data-testid="pending-overwrite-confirm"
        @click="emit('confirm-overwrite')"
      />
    </template>
  </CoreDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import CoreAlert from '@cornflow-ui/core/components/core/CoreAlert.vue'
import CoreBadge from '@cornflow-ui/core/components/core/CoreBadge.vue'
import CoreButton from '@cornflow-ui/core/components/core/CoreButton.vue'
import CoreDialog from '@cornflow-ui/core/components/core/CoreDialog.vue'
import CoreEmptyState from '@cornflow-ui/core/components/core/CoreEmptyState.vue'
import CoreIcon from '@cornflow-ui/core/components/core/CoreIcon.vue'
import CoreSelect from '@cornflow-ui/core/components/core/CoreSelect.vue'
import type { CoreSelectOption } from '@cornflow-ui/core/components/core/CoreSelect.vue'
import CoreSpinner from '@cornflow-ui/core/components/core/CoreSpinner.vue'
import CoreSwitch from '@cornflow-ui/core/components/core/CoreSwitch.vue'
import CoreTextField from '@cornflow-ui/core/components/core/CoreTextField.vue'
import type { DataColumn } from '@cornflow-ui/core/components/core/data-table/types'
import type { CoreTone } from '@cornflow-ui/core/types/ui'
import {
  formatCellValue,
  isTruthy,
  parseCellInput,
  toEditText,
} from '@cornflow-ui/core/utils/dataTable'

defineOptions({ name: 'PendingChangesPanel' })

export type PendingChangeKind = 'modified' | 'new' | 'deleted'

export interface PendingChangeItem {
  tableKey: string
  rowId: string | number
  kind: PendingChangeKind
  /** How the row reads: the first column's title and value, "Line L2". */
  label: string
  /** Current values of the row. */
  row: Record<string, unknown>
  /** Values before the edits (modified rows). */
  original?: Record<string, unknown>
  /** Edited columns (modified rows). */
  changedKeys: string[]
}

export interface PendingChangeGroup {
  tableKey: string
  title: string
  columns: DataColumn[]
  items: PendingChangeItem[]
}

export interface PendingChangesBanner {
  kind: 'validation' | 'server'
  message: string
  canRetry?: boolean
}

const props = withDefaults(
  defineProps<{
    open: boolean
    groups: PendingChangeGroup[]
    saving?: boolean
    /** The primary button: "Save changes", "Apply changes", "Relaunch"… */
    saveLabel: string
    banner?: PendingChangesBanner | null
    /** Second confirmation when the server reports data that depends on the changes. */
    overwrite?: { message: string } | null
  }>(),
  { saving: false, banner: null, overwrite: null },
)

const emit = defineEmits<{
  'update:open': [value: boolean]
  save: []
  'revert-all': []
  'revert-table': [tableKey: string]
  'revert-row': [tableKey: string, rowId: string | number, kind: PendingChangeKind]
  'revert-field': [tableKey: string, rowId: string | number, key: string]
  'update-field': [tableKey: string, rowId: string | number, key: string, value: unknown]
  'go-to': [tableKey: string, rowId: string | number, key: string | undefined]
  'close-banner': []
  retry: []
  'confirm-overwrite': []
  'cancel-overwrite': []
}>()

const { t, locale } = useI18n()

const KINDS: Record<
  PendingChangeKind,
  { label: string; rowLabel: string; revert: string; tone: CoreTone; icon: string }
> = {
  modified: {
    label: 'dataTable.pending.kind.modified',
    rowLabel: 'dataTable.pending.rowKind.modified',
    revert: 'dataTable.pending.revert',
    tone: 'warning',
    icon: 'mdi-pencil-outline',
  },
  new: {
    label: 'dataTable.pending.kind.new',
    rowLabel: 'dataTable.pending.rowKind.new',
    revert: 'dataTable.pending.remove',
    tone: 'success',
    icon: 'mdi-plus-circle-outline',
  },
  deleted: {
    label: 'dataTable.pending.kind.deleted',
    rowLabel: 'dataTable.pending.rowKind.deleted',
    revert: 'dataTable.pending.restore',
    tone: 'danger',
    icon: 'mdi-delete-outline',
  },
}

const expanded = ref(false)
const confirming = ref(false)
const collapsed = ref(new Set<string>())
/** Validation errors of the expanded dialog's cells, by `tableKey|rowId|key`. */
const errors = ref<Record<string, string>>({})

watch(
  () => props.open,
  (open) => {
    if (open) return
    expanded.value = false
    confirming.value = false
    errors.value = {}
  },
)

/** An edited row counts each changed cell; a new or deleted row counts one. */
const totalChanges = computed(() =>
  props.groups.reduce(
    (total, group) =>
      total +
      group.items.reduce(
        (sum, item) => sum + (item.kind === 'modified' ? Math.max(item.changedKeys.length, 1) : 1),
        0,
      ),
    0,
  ),
)

const hasChanges = computed(() => props.groups.some((group) => group.items.length > 0))

const summaryText = computed(
  () =>
    `${t('dataTable.pending.changes', totalChanges.value)} · ${t('dataTable.pending.tables', props.groups.length)}`,
)

const bannerTitle = computed(() =>
  props.banner?.kind === 'validation'
    ? t('dataTable.pending.validationTitle')
    : t('dataTable.pending.serverTitle'),
)

function close() {
  emit('update:open', false)
}

function isOpen(tableKey: string) {
  return !collapsed.value.has(tableKey)
}

function toggle(tableKey: string) {
  const next = new Set(collapsed.value)
  if (next.has(tableKey)) next.delete(tableKey)
  else next.add(tableKey)
  collapsed.value = next
}

function revertAll() {
  confirming.value = false
  emit('revert-all')
}

function goTo(item: PendingChangeItem, key: string | undefined) {
  emit('go-to', item.tableKey, item.rowId, key)
}

function columnOf(group: PendingChangeGroup, key: string): DataColumn {
  return group.columns.find((column) => column.key === key) ?? { key, title: key, type: 'text' }
}

function formatted(value: unknown, column: DataColumn): string | null {
  return formatCellValue(value, column, locale.value, t)
}

/** A value of the review: an empty one reads "empty". */
function show(value: unknown, column: DataColumn): string {
  return formatted(value, column) ?? t('dataTable.pending.emptyValue')
}

function fieldsOf(group: PendingChangeGroup, item: PendingChangeItem) {
  return item.changedKeys.map((key) => {
    const column = columnOf(group, key)
    return {
      key,
      title: column.title,
      old: show(item.original?.[key], column),
      new: show(item.row[key], column),
    }
  })
}

function summaryOf(group: PendingChangeGroup, item: PendingChangeItem): string {
  const values = group.columns
    .slice(1, 4)
    .map((column) => formatted(item.row[column.key], column))
    .filter((value): value is string => !!value)
  return values.length ? values.join(' · ') : t('dataTable.pending.noMoreData')
}

function pillsOf(group: PendingChangeGroup) {
  return (['modified', 'new', 'deleted'] as PendingChangeKind[])
    .map((kind) => ({ kind, count: group.items.filter((item) => item.kind === kind).length }))
    .filter((pill) => pill.count > 0)
    .map((pill) => ({ kind: pill.kind, label: t(`dataTable.pending.count.${pill.kind}`, pill.count) }))
}

function headerOf(column: DataColumn): string {
  return column.unit ? `${column.title} (${column.unit})` : column.title
}

function gridColumnsOf(group: PendingChangeGroup): string {
  return group.columns
    .map((column) => `${Math.max(130, Math.min(260, column.width ?? 160))}px`)
    .join(' ')
}

function isChanged(item: PendingChangeItem, key: string): boolean {
  return item.kind === 'modified' && item.changedKeys.includes(key)
}

function isEditable(item: PendingChangeItem, column: DataColumn): boolean {
  return item.kind !== 'deleted' && !column.readOnly && !props.saving
}

function choicesOf(column: DataColumn): CoreSelectOption[] | null {
  if (column.type === 'boolean') {
    return [
      { value: true, label: t('table.yes') },
      { value: false, label: t('table.no') },
    ]
  }
  if ((column.type === 'list' || column.type === 'reference') && column.options?.length) {
    return column.options
  }
  return null
}

function errorKey(item: PendingChangeItem, key: string) {
  return `${item.tableKey}|${item.rowId}|${key}`
}

function errorOf(item: PendingChangeItem, column: DataColumn): string | undefined {
  return errors.value[errorKey(item, column.key)]
}

/** A corrected value: switches and dropdowns give it as is, text is parsed as the table does. */
function commit(item: PendingChangeItem, column: DataColumn, raw: unknown) {
  const key = errorKey(item, column.key)
  const typed = column.type !== 'switch' && !choicesOf(column)
  const parsed = typed ? parseCellInput(raw, column, locale.value) : { value: raw }
  const next = { ...errors.value }
  if ('error' in parsed) {
    next[key] = parsed.error
    errors.value = next
    return
  }
  delete next[key]
  errors.value = next
  if (parsed.value === null && column.required) {
    errors.value = { ...next, [key]: 'dataTable.errors.required' }
    return
  }
  emit('update-field', item.tableKey, item.rowId, column.key, parsed.value)
}
</script>

<style scoped>
.pending-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 400px;
  height: 100%;
  min-height: 0;
  box-sizing: border-box;
  overflow: hidden;
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-md);
  font-family: var(--font-sans);
  color: var(--color-text);
}

.pending-panel__header {
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 2.5);
  padding: calc(var(--spacing) * 3.5) calc(var(--spacing) * 3) calc(var(--spacing) * 3)
    calc(var(--spacing) * 4.5);
  border-bottom: 1px solid var(--color-divider);
}

.pending-panel__header-icon {
  color: var(--color-primary);
}

.pending-panel__heading {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.pending-panel__title {
  font-size: var(--text-lg);
  font-weight: var(--font-weight-medium);
}

.pending-panel__subtitle {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.pending-panel__banner,
.pending-dialog__banner {
  position: relative;
  margin: calc(var(--spacing) * 3) calc(var(--spacing) * 3.5) 0;
}

.pending-dialog__banner {
  margin: 0;
}

.pending-panel__banner :deep(.core-alert),
.pending-dialog__banner :deep(.core-alert) {
  padding-right: calc(var(--spacing) * 9);
}

.pending-panel__banner-close {
  position: absolute;
  top: calc(var(--spacing) * 2);
  right: calc(var(--spacing) * 2);
}

.pending-panel__body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
}

.pending-panel__body :deep(.core-empty-state) {
  padding: calc(var(--spacing) * 16) calc(var(--spacing) * 6);
}

.pending-panel__group {
  display: flex;
  flex-direction: column;
  border-bottom: 1px solid var(--color-divider);
}

.pending-panel__group-header {
  position: sticky;
  top: 0;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 1.5);
  padding: calc(var(--spacing) * 1.5) calc(var(--spacing) * 3);
  background: var(--color-surface-muted);
}

.pending-panel__group-toggle {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 1.5);
  padding: calc(var(--spacing) * 1) 0;
  border: 0;
  background: none;
  font: inherit;
  color: var(--color-text-muted);
  text-align: left;
  cursor: pointer;
}

.pending-panel__group-title {
  font-size: var(--text-md);
  font-weight: var(--font-weight-medium);
  letter-spacing: 0.05em;
  color: var(--color-text);
}

.pending-panel__group-count {
  font-size: var(--text-sm);
  color: var(--color-text-subtle);
  white-space: nowrap;
}

.pending-panel__items {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 2px 0 calc(var(--spacing) * 2);
  list-style: none;
}

.pending-panel__item {
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 1);
  padding: calc(var(--spacing) * 2) calc(var(--spacing) * 3.5) calc(var(--spacing) * 2)
    calc(var(--spacing) * 9);
}

.pending-panel__item:hover {
  background: var(--color-surface-hover);
}

.pending-panel__item-head {
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 2);
}

.pending-panel__item-go,
.pending-panel__field-go {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 2);
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.pending-panel__item-label {
  overflow: hidden;
  font-size: var(--text-md);
  font-weight: var(--font-weight-medium);
  white-space: nowrap;
  text-overflow: ellipsis;
}

.is-deleted {
  text-decoration: line-through;
}

.pending-panel__link {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  font-size: var(--text-sm);
  color: var(--color-primary);
  white-space: nowrap;
  cursor: pointer;
}

.pending-panel__link:hover {
  text-decoration: underline;
}

.pending-panel__link:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.pending-panel__fields {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.pending-panel__field {
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 2);
  margin: 0 calc(var(--spacing) * -1.5);
  padding: 3px calc(var(--spacing) * 1.5);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
}

.pending-panel__field:hover {
  background: var(--color-warning-soft);
}

.pending-panel__field-go {
  display: grid;
  grid-template-columns: 110px minmax(0, 1fr);
  gap: calc(var(--spacing) * 2);
}

.pending-panel__field-title {
  overflow: hidden;
  color: var(--color-text-muted);
  white-space: nowrap;
  text-overflow: ellipsis;
}

.pending-panel__field-values {
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 1.5);
  min-width: 0;
  font-variant-numeric: tabular-nums;
}

.pending-panel__old {
  max-width: 45%;
  overflow: hidden;
  color: var(--color-text-subtle);
  text-decoration: line-through;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.pending-panel__arrow {
  flex: none;
  color: var(--color-text-subtle);
}

.pending-panel__new {
  overflow: hidden;
  font-weight: var(--font-weight-medium);
  white-space: nowrap;
  text-overflow: ellipsis;
}

.pending-panel__field-revert {
  color: var(--color-warning-strong);
}

.pending-panel__summary {
  overflow: hidden;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  white-space: nowrap;
  text-overflow: ellipsis;
}

.pending-panel__saving {
  position: absolute;
  inset: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--color-surface) 75%, transparent);
}

.pending-panel__saving-pill {
  display: inline-flex;
  align-items: center;
  gap: calc(var(--spacing) * 2);
  padding: calc(var(--spacing) * 2.5) calc(var(--spacing) * 3.5);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-full);
  background: var(--color-surface);
  box-shadow: var(--shadow-lg);
  font-size: var(--text-md);
}

.pending-panel__footer {
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 2);
  padding: calc(var(--spacing) * 3) calc(var(--spacing) * 3.5);
  border-top: 1px solid var(--color-divider);
  background: var(--color-surface-muted);
}

.pending-panel__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: calc(var(--spacing) * 2);
}

.pending-panel__spacer {
  flex: 1;
}

.pending-panel__confirm-text {
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 1.5);
  font-size: var(--text-sm);
  color: var(--color-danger-strong);
}

/* ── Expanded dialog ─────────────────────────────────────────────────────── */

.pending-dialog__content {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 3);
  min-height: 50vh;
  color: var(--color-text);
}

.pending-dialog__subtitle {
  margin: 0;
  font-size: var(--text-md);
  color: var(--color-text-muted);
}

.pending-dialog__group {
  flex: none;
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
}

.pending-dialog__group-header {
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 2.5);
  padding: calc(var(--spacing) * 2) calc(var(--spacing) * 3.5);
  border-radius: var(--radius-lg);
  background: var(--color-surface-muted);
}

.pending-dialog__group-header .pending-panel__group-toggle {
  flex: none;
}

.pending-dialog__group-title {
  font-size: var(--text-base);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
}

.pending-dialog__pills {
  display: flex;
  gap: calc(var(--spacing) * 1.5);
}

.pending-dialog__rows {
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 2.5);
  padding: calc(var(--spacing) * 3) calc(var(--spacing) * 3.5) calc(var(--spacing) * 3.5);
  border-top: 1px solid var(--color-divider);
}

.pending-dialog__row {
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 1.5);
}

.pending-dialog__row-head {
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 2);
}

.pending-dialog__row-label {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.pending-dialog__grid-wrap {
  overflow-x: auto;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.pending-dialog__grid {
  display: grid;
  width: max-content;
  min-width: 100%;
}

.pending-dialog__head {
  overflow: hidden;
  padding: calc(var(--spacing) * 1.5) calc(var(--spacing) * 2);
  border-right: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface-muted);
  font-size: var(--text-xs);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-muted);
  white-space: nowrap;
  text-overflow: ellipsis;
}

.pending-dialog__cell {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 3px;
  min-width: 0;
  box-sizing: border-box;
  padding: calc(var(--spacing) * 1.5) calc(var(--spacing) * 2);
  border-right: 1px solid var(--color-divider);
}

.pending-dialog__cell.is-new {
  background: var(--color-success-soft);
}

.pending-dialog__cell.is-deleted {
  background: var(--color-danger-soft);
}

.pending-dialog__cell.is-changed {
  background: var(--color-warning-soft);
}

.pending-dialog__cell-old {
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 1);
  overflow: hidden;
  font-size: var(--text-xs);
  color: var(--color-text-subtle);
  white-space: nowrap;
}

.pending-dialog__cell-old .pending-panel__old {
  max-width: none;
}

.pending-dialog__cell-value {
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 1);
  min-width: 0;
}

.pending-dialog__cell-value > :deep(.core-text-field),
.pending-dialog__cell-value > :deep(.core-select) {
  flex: 1;
}

.pending-dialog__cell-value :deep(.is-number input) {
  text-align: right;
}

.pending-dialog__cell-text {
  display: flex;
  align-items: center;
  height: 28px;
  overflow: hidden;
  font-size: var(--text-md);
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.pending-dialog__cell-text.is-readonly {
  color: var(--color-text-subtle);
}

.pending-dialog__cell-error {
  font-size: var(--text-xs);
  color: var(--color-danger);
  white-space: nowrap;
}

.pending-overwrite {
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 3);
  color: var(--color-text-muted);
}

.pending-overwrite__message {
  padding: calc(var(--spacing) * 2.5) calc(var(--spacing) * 3);
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: var(--text-sm);
  color: var(--color-text);
}
</style>
