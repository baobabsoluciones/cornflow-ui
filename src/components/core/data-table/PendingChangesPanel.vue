<!--
  PendingChangesPanel: the review of the pending changes of every table, before they are saved
  (or applied, or relaunched).

  A side panel, docked by the host beside the table at the full height of its container, lists
  the changes per table: each changed row with its kind (modified, new, deleted) and, for an edited
  row, every changed field as "old → new". Rows and fields can be reverted one by one, a table at
  once or everything (after an inline confirmation). Clicking a row or a field asks the host to
  take the user to it (`go-to`).

  The expand button opens the same changes in a large dialog (PendingChangesDialog), where each
  row is a small table with all its columns and the values can still be corrected.

  The host owns the saving: `saving` locks the panel while it runs, `validationError` says why the
  edited data does not match the schema, and `overwrite` asks for a second confirmation when the
  server reports data that depends on what is about to change.

  <PendingChangesPanel v-model:open="reviewOpen" :groups="groups" :saving="saving"
    :save-label="$t('dataTable.pending.save')" @save="saveAll" @revert-all="revertAll" />
-->
<template>
  <aside
    v-bind="$attrs"
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

    <PendingValidationBanner
      v-if="validationError"
      class="pending-panel__banner"
      :message="validationError"
      @close="emit('close-banner')"
    />

    <div class="pending-panel__body">
      <CoreEmptyState
        v-if="!hasChanges"
        icon="mdi-check-circle-outline"
        :title="$t('dataTable.pending.empty')"
        :message="$t('dataTable.pending.emptyText')"
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
                  :label="$t(PENDING_KINDS[item.kind].label)"
                  :tone="PENDING_KINDS[item.kind].tone"
                  :icon="PENDING_KINDS[item.kind].icon"
                  size="small"
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
                {{ $t(PENDING_KINDS[item.kind].revert) }}
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

    <PendingSavingOverlay v-if="saving" />

    <footer v-if="hasChanges" class="pending-panel__footer">
      <PendingRevertAllConfirm
        v-if="confirming"
        :count="totalChanges"
        size="small"
        @cancel="confirming = false"
        @confirm="revertAll"
      />
      <div v-else class="pending-panel__actions">
        <CoreButton
          variant="text"
          tone="danger"
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

  <PendingChangesDialog
    v-model:collapsed="collapsed"
    :model-value="open && expanded"
    :groups="groups"
    :saving="saving"
    :save-label="saveLabel"
    :summary="summaryText"
    :validation-error="validationError"
    @update:model-value="expanded = $event"
    @save="emit('save')"
    @revert-all="emit('revert-all')"
    @revert-table="emit('revert-table', $event)"
    @revert-row="(tableKey, rowId, kind) => emit('revert-row', tableKey, rowId, kind)"
    @revert-field="(tableKey, rowId, key) => emit('revert-field', tableKey, rowId, key)"
    @update-field="(tableKey, rowId, key, value) => emit('update-field', tableKey, rowId, key, value)"
    @close-banner="emit('close-banner')"
  />

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
        tone="danger"
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
import CoreBadge from '@cornflow-ui/core/components/core/CoreBadge.vue'
import CoreButton from '@cornflow-ui/core/components/core/CoreButton.vue'
import CoreDialog from '@cornflow-ui/core/components/core/CoreDialog.vue'
import CoreEmptyState from '@cornflow-ui/core/components/core/CoreEmptyState.vue'
import CoreIcon from '@cornflow-ui/core/components/core/CoreIcon.vue'
import PendingChangesDialog from '@cornflow-ui/core/components/core/data-table/PendingChangesDialog.vue'
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
import { formatCellValue } from '@cornflow-ui/core/utils/dataTable'

defineOptions({ name: 'PendingChangesPanel', inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    open: boolean
    groups: PendingChangeGroup[]
    saving?: boolean
    /** The primary button: "Save changes", "Apply changes", "Relaunch"… */
    saveLabel: string
    /** Why the edited data does not match the schema, above the changes. */
    validationError?: string | null
    /** Second confirmation when the server reports data that depends on the changes. */
    overwrite?: { message: string } | null
  }>(),
  { saving: false, validationError: null, overwrite: null },
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
  'confirm-overwrite': []
  'cancel-overwrite': []
}>()

const { t, locale } = useI18n()

const expanded = ref(false)
const confirming = ref(false)
const collapsed = ref(new Set<string>())

watch(
  () => props.open,
  (open) => {
    if (open) return
    expanded.value = false
    confirming.value = false
  },
)

const totalChanges = computed(() => countPendingChanges(props.groups))

const hasChanges = computed(() => props.groups.some((group) => group.items.length > 0))

const summaryText = computed(
  () =>
    `${t('dataTable.pending.changes', totalChanges.value)} · ${t('dataTable.pending.tables', props.groups.length)}`,
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

function show(value: unknown, column: DataColumn): string {
  return showPendingValue(value, column, locale.value, t)
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

.pending-panel__banner {
  margin: calc(var(--spacing) * 3) calc(var(--spacing) * 3.5) 0;
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
