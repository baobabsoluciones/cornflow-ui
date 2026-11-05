<!--
  PendingChangesDialog: the pending changes of PendingChangesPanel opened large. Each row is a
  small table with all its columns and the values can still be corrected: edited cells show the
  old value struck out above the new one, new rows are editable in full, deleted rows read-only.
  A correction is validated as the table does and emitted with `update-field`; the host records it.

  It shares with the panel which tables are folded (`v-model:collapsed`). PendingChangesPanel
  opens it; it is not used on its own.
-->
<template>
  <CoreDialog
    :model-value="modelValue"
    :title="$t('dataTable.pending.title')"
    icon="mdi-file-compare"
    :width="1400"
    :persistent="saving"
    closable
    class="pending-dialog"
    data-testid="pending-changes-dialog"
    @update:model-value="!$event && emit('update:modelValue', false)"
  >
    <div class="pending-dialog__content">
      <p class="pending-dialog__subtitle">
        {{ hasChanges ? $t('dataTable.pending.dialogSubtitle', { summary }) : $t('dataTable.pending.nothingToSave') }}
      </p>

      <PendingValidationBanner v-if="validationError" :message="validationError" @close="emit('close-banner')" />

      <CoreEmptyState
        v-if="!hasChanges"
        icon="mdi-check-circle-outline"
        :title="$t('dataTable.pending.empty')"
        :message="$t('dataTable.pending.emptyTextDialog')"
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
            class="pending-dialog__group-toggle"
            :aria-expanded="isOpen(group.tableKey)"
            @click="toggle(group.tableKey)"
          >
            <CoreIcon
              :name="isOpen(group.tableKey) ? 'mdi-chevron-down' : 'mdi-chevron-right'"
              :size="20"
            />
            <span class="pending-dialog__group-title">{{ group.title }}</span>
            <span class="pending-dialog__group-count">{{
              $t('dataTable.pending.rowsAffected', group.items.length)
            }}</span>
          </button>
          <span class="pending-dialog__pills">
            <CoreBadge
              v-for="pill in pillsOf(group)"
              :key="pill.kind"
              :label="pill.label"
              :tone="PENDING_KINDS[pill.kind].tone"
              :icon="PENDING_KINDS[pill.kind].icon"
              size="small"
            />
          </span>
          <span class="pending-dialog__spacer" />
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
                :label="$t(PENDING_KINDS[item.kind].rowLabel)"
                :tone="PENDING_KINDS[item.kind].tone"
                :icon="PENDING_KINDS[item.kind].icon"
                size="small"
              />
              <span class="pending-dialog__row-label">{{ item.label }}</span>
              <span class="pending-dialog__spacer" />
              <button
                type="button"
                class="pending-dialog__link"
                :disabled="saving"
                @click="emit('revert-row', item.tableKey, item.rowId, item.kind)"
              >
                <CoreIcon name="mdi-undo-variant" :size="14" />
                {{ $t(PENDING_KINDS[item.kind].revert) }}
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
                    <span class="pending-dialog__old">{{ show(item.original?.[column.key], column) }}</span>
                    →
                  </span>
                  <div class="pending-dialog__cell-value">
                    <span
                      v-if="!isEditable(item, column)"
                      class="pending-dialog__cell-text"
                      :class="{ 'is-deleted': item.kind === 'deleted', 'is-readonly': column.readOnly }"
                      >{{ formatCellValue(item.row[column.key], column, locale, t) ?? '—' }}</span
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

      <PendingSavingOverlay v-if="saving" :spinner-size="20" />
    </div>

    <template #actions>
      <PendingRevertAllConfirm
        v-if="confirming"
        :count="countPendingChanges(groups)"
        @cancel="confirming = false"
        @confirm="revertAll"
      />
      <template v-else>
        <CoreButton
          v-if="hasChanges"
          variant="text"
          tone="danger"
          icon="mdi-undo"
          :text="$t('dataTable.pending.revertAllChanges')"
          :disabled="saving"
          @click="confirming = true"
        />
        <span class="pending-dialog__spacer" />
        <CoreButton
          variant="text"
          :text="hasChanges ? $t('dataTable.pending.cancel') : $t('common.close')"
          :disabled="saving"
          @click="emit('update:modelValue', false)"
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
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import CoreBadge from '@cornflow-ui/core/components/core/CoreBadge.vue'
import CoreButton from '@cornflow-ui/core/components/core/CoreButton.vue'
import CoreDialog from '@cornflow-ui/core/components/core/CoreDialog.vue'
import CoreEmptyState from '@cornflow-ui/core/components/core/CoreEmptyState.vue'
import CoreIcon from '@cornflow-ui/core/components/core/CoreIcon.vue'
import CoreSelect from '@cornflow-ui/core/components/core/CoreSelect.vue'
import type { CoreSelectOption } from '@cornflow-ui/core/components/core/CoreSelect.vue'
import CoreSwitch from '@cornflow-ui/core/components/core/CoreSwitch.vue'
import CoreTextField from '@cornflow-ui/core/components/core/CoreTextField.vue'
import PendingRevertAllConfirm from '@cornflow-ui/core/components/core/data-table/PendingRevertAllConfirm.vue'
import PendingSavingOverlay from '@cornflow-ui/core/components/core/data-table/PendingSavingOverlay.vue'
import PendingValidationBanner from '@cornflow-ui/core/components/core/data-table/PendingValidationBanner.vue'
import {
  PENDING_KINDS,
  countPendingChanges,
  showPendingValue,
  type PendingChangeGroup,
  type PendingChangeItem,
  type PendingChangeKind,
} from '@cornflow-ui/core/components/core/data-table/pendingChanges'
import type { DataColumn } from '@cornflow-ui/core/components/core/data-table/types'
import { formatCellValue, isTruthy, parseCellInput, toEditText } from '@cornflow-ui/core/utils/dataTable'

defineOptions({ name: 'PendingChangesDialog' })

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    groups: PendingChangeGroup[]
    saving?: boolean
    saveLabel: string
    /** "3 changes · 2 tables". */
    summary: string
    validationError?: string | null
  }>(),
  { saving: false, validationError: null },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  save: []
  'revert-all': []
  'revert-table': [tableKey: string]
  'revert-row': [tableKey: string, rowId: string | number, kind: PendingChangeKind]
  'revert-field': [tableKey: string, rowId: string | number, key: string]
  'update-field': [tableKey: string, rowId: string | number, key: string, value: unknown]
  'close-banner': []
}>()

/** The tables folded, shared with the panel. */
const collapsed = defineModel<Set<string>>('collapsed', { required: true })

const { t, locale } = useI18n()

const confirming = ref(false)
/** Validation errors of the cells, by `tableKey|rowId|key`. */
const errors = ref<Record<string, string>>({})

watch(
  () => props.modelValue,
  (open) => {
    if (open) return
    confirming.value = false
    errors.value = {}
  },
)

const hasChanges = computed(() => props.groups.some((group) => group.items.length > 0))

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

function show(value: unknown, column: DataColumn): string {
  return showPendingValue(value, column, locale.value, t)
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

.pending-dialog__group-toggle {
  flex: none;
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

.pending-dialog__group-title {
  font-size: var(--text-base);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
}

.pending-dialog__group-count {
  font-size: var(--text-sm);
  color: var(--color-text-subtle);
  white-space: nowrap;
}

.pending-dialog__pills {
  display: flex;
  gap: calc(var(--spacing) * 1.5);
}

.pending-dialog__spacer {
  flex: 1;
}

.pending-dialog__link {
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

.pending-dialog__link:hover {
  text-decoration: underline;
}

.pending-dialog__link:disabled {
  cursor: not-allowed;
  opacity: 0.5;
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

.pending-dialog__old {
  overflow: hidden;
  color: var(--color-text-subtle);
  text-decoration: line-through;
  white-space: nowrap;
  text-overflow: ellipsis;
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

.pending-dialog__cell-text.is-deleted {
  text-decoration: line-through;
}

.pending-dialog__cell-text.is-readonly {
  color: var(--color-text-subtle);
}

.pending-dialog__cell-error {
  font-size: var(--text-xs);
  color: var(--color-danger);
  white-space: nowrap;
}
</style>
