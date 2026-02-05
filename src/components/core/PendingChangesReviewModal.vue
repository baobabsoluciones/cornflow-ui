<template>
  <v-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    :max-width="isFullscreen ? undefined : 1100"
    :fullscreen="isFullscreen"
    scrollable
    persistent
  >
    <v-card
      class="pending-changes-modal"
      :class="{ 'fullscreen-modal': isFullscreen }"
    >
      <v-card-title class="modal-header">
        <div class="d-flex align-center">
          <v-icon class="mr-2" color="success">mdi-pencil-box-multiple</v-icon>
          {{ t('pendingChanges.title') }}
          <v-chip size="small" color="success" variant="tonal" class="ml-2">
            {{ totalChangesCount }} {{ $t('pendingChanges.changes') }}
          </v-chip>
        </div>
        <div class="d-flex align-center">
          <v-btn
            :icon="isFullscreen ? 'mdi-window-restore' : 'mdi-window-maximize'"
            variant="text"
            size="small"
            @click="toggleFullscreen"
            class="mr-1"
            :title="
              isFullscreen
                ? t('projectExecution.minimize')
                : t('projectExecution.maximize')
            "
          />
          <v-btn variant="text" size="small" @click="handleClose">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </div>
      </v-card-title>

      <v-divider></v-divider>

      <v-card-text class="modal-content">
        <!-- Validation error after save attempt -->
        <v-alert
          v-if="validationError"
          type="error"
          variant="tonal"
          density="comfortable"
          class="mb-3"
          :model-value="true"
          closable
          @click:close="clearValidationError"
        >
          <div v-html="validationError"></div>
        </v-alert>

        <!-- No changes state -->
        <div v-if="fullGroupedByTable.length === 0" class="no-changes">
          <v-icon size="64" color="grey-lighten-1">mdi-check-all</v-icon>
          <p class="text-grey mt-2">{{ t('pendingChanges.noChanges') }}</p>
        </div>

        <!-- Changes grouped by table (edits + creates + deletes) -->
        <div v-else class="changes-list">
          <v-expansion-panels
            v-model="expandedPanels"
            multiple
            variant="accordion"
          >
            <v-expansion-panel
              v-for="tableGroup in fullGroupedByTable"
              :key="tableGroup.tableKey"
              class="table-changes-panel"
            >
              <v-expansion-panel-title class="table-panel-title">
                <div class="d-flex align-center justify-space-between w-100">
                  <div class="d-flex align-center">
                    <v-icon class="mr-2" size="small">mdi-table</v-icon>
                    <span class="table-name">{{ tableGroup.tableTitle }}</span>
                    <v-chip
                      size="x-small"
                      color="success"
                      variant="tonal"
                      class="ml-2"
                    >
                      {{
                        tableGroup.changes.length +
                        tableGroup.creates.length +
                        tableGroup.deletes.length
                      }}
                      {{
                        tableGroup.changes.length +
                          tableGroup.creates.length +
                          tableGroup.deletes.length ===
                        1
                          ? t('pendingChanges.row')
                          : t('pendingChanges.modifiedRows').toLowerCase()
                      }}
                    </v-chip>
                  </div>
                </div>
              </v-expansion-panel-title>

              <v-expansion-panel-text class="pa-0">
                <!-- Modified rows (cell edits) -->
                <div
                  v-for="(rowGroup, rowIndex) in tableGroup.changes"
                  :key="rowGroup.rowId"
                  class="row-change-block"
                  :class="{ 'row-change-block--alt': rowIndex % 2 === 1 }"
                >
                  <!-- Row context as mini table -->
                  <div class="row-context-table">
                    <table class="context-table">
                      <thead>
                        <tr>
                          <th
                            v-for="header in getVisibleHeaders(
                              tableGroup.tableKey,
                            )"
                            :key="header.key"
                            :class="{
                              'header-modified': isFieldModified(
                                rowGroup,
                                header.key,
                              ),
                            }"
                          >
                            {{ header.title }}
                          </th>
                          <th class="actions-header"></th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td
                            v-for="header in getVisibleHeaders(
                              tableGroup.tableKey,
                            )"
                            :key="header.key"
                            :class="{
                              'cell-modified': isFieldModified(
                                rowGroup,
                                header.key,
                              ),
                              'cell-original': !isFieldModified(
                                rowGroup,
                                header.key,
                              ),
                            }"
                          >
                            <template
                              v-if="isFieldModified(rowGroup, header.key)"
                            >
                              <div class="cell-change cell-change--editable">
                                <span class="old-val">{{
                                  formatValue(
                                    getFieldOldValue(rowGroup, header.key),
                                  )
                                }}</span>
                                <v-icon size="x-small" class="mx-1"
                                  >mdi-arrow-right</v-icon
                                >
                                <v-text-field
                                  v-if="(header.type || 'string') !== 'boolean'"
                                  :model-value="
                                    getRowFieldValue(
                                      tableGroup.tableKey,
                                      rowGroup.rowId,
                                      header.key,
                                      rowGroup,
                                    )
                                  "
                                  @update:model-value="
                                    (val) =>
                                      emit(
                                        'update-change',
                                        tableGroup.tableKey,
                                        rowGroup.rowId,
                                        header.key,
                                        header.type === 'number'
                                          ? val === ''
                                            ? undefined
                                            : Number(val)
                                          : val,
                                      )
                                  "
                                  variant="outlined"
                                  density="compact"
                                  hide-details
                                  class="cell-edit-input"
                                />
                                <v-switch
                                  v-else
                                  :model-value="
                                    !!getRowFieldValue(
                                      tableGroup.tableKey,
                                      rowGroup.rowId,
                                      header.key,
                                      rowGroup,
                                    )
                                  "
                                  @update:model-value="
                                    (val) =>
                                      emit(
                                        'update-change',
                                        tableGroup.tableKey,
                                        rowGroup.rowId,
                                        header.key,
                                        val,
                                      )
                                  "
                                  hide-details
                                  density="compact"
                                  color="primary"
                                  class="cell-edit-switch"
                                />
                              </div>
                            </template>
                            <template v-else>
                              <v-text-field
                                v-if="(header.type || 'string') !== 'boolean'"
                                :model-value="
                                  getRowFieldValue(
                                    tableGroup.tableKey,
                                    rowGroup.rowId,
                                    header.key,
                                    rowGroup,
                                  )
                                "
                                @update:model-value="
                                  (val) =>
                                    emit(
                                      'update-change',
                                      tableGroup.tableKey,
                                      rowGroup.rowId,
                                      header.key,
                                      header.type === 'number'
                                        ? val === ''
                                          ? undefined
                                          : Number(val)
                                        : val,
                                    )
                                "
                                variant="outlined"
                                density="compact"
                                hide-details
                                class="cell-edit-input"
                              />
                              <v-switch
                                v-else
                                :model-value="
                                  !!getRowFieldValue(
                                    tableGroup.tableKey,
                                    rowGroup.rowId,
                                    header.key,
                                    rowGroup,
                                  )
                                "
                                @update:model-value="
                                  (val) =>
                                    emit(
                                      'update-change',
                                      tableGroup.tableKey,
                                      rowGroup.rowId,
                                      header.key,
                                      val,
                                    )
                                "
                                hide-details
                                density="compact"
                                color="primary"
                                class="cell-edit-switch"
                              />
                            </template>
                          </td>
                          <td class="actions-cell">
                            <v-btn
                              size="x-small"
                              variant="tonal"
                              color="error"
                              @click="
                                revertRowChanges(
                                  tableGroup.tableKey,
                                  rowGroup.rowId,
                                )
                              "
                              class="revert-btn"
                            >
                              <v-icon size="small" start>mdi-undo</v-icon>
                              {{ t('pendingChanges.revert') }}
                            </v-btn>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <!-- New rows (pending creates) - editable -->
                <div
                  v-for="(create, createIndex) in tableGroup.creates"
                  :key="create.tempId"
                  class="row-change-block row-change-block--new"
                  :class="{ 'row-change-block--alt': createIndex % 2 === 1 }"
                >
                  <div class="row-context-table">
                    <div class="row-change-label">
                      <v-chip size="x-small" color="primary" variant="tonal">
                        {{ t('pendingChanges.newRow') }}
                      </v-chip>
                      <v-btn
                        size="x-small"
                        variant="tonal"
                        color="error"
                        @click="
                          tableChanges.revertCreate(
                            tableGroup.tableKey,
                            create.tempId,
                          )
                        "
                        class="revert-btn ml-2"
                      >
                        <v-icon size="small" start>mdi-undo</v-icon>
                        {{ t('pendingChanges.revert') }}
                      </v-btn>
                    </div>
                    <table class="context-table">
                      <thead>
                        <tr>
                          <th
                            v-for="header in getVisibleHeaders(
                              tableGroup.tableKey,
                            )"
                            :key="header.key"
                          >
                            {{ header.title }}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td
                            v-for="header in getVisibleHeaders(
                              tableGroup.tableKey,
                            )"
                            :key="header.key"
                            class="cell-new cell-new--editable"
                          >
                            <v-text-field
                              v-if="(header.type || 'string') !== 'boolean'"
                              :model-value="create.data[header.key]"
                              @update:model-value="
                                (val) =>
                                  handleUpdateCreate(
                                    tableGroup.tableKey,
                                    create.tempId,
                                    header.key,
                                    header.type === 'number'
                                      ? val === ''
                                        ? undefined
                                        : Number(val)
                                      : val,
                                  )
                              "
                              variant="outlined"
                              density="compact"
                              hide-details
                              class="cell-edit-input"
                            />
                            <v-switch
                              v-else
                              :model-value="!!create.data[header.key]"
                              @update:model-value="
                                (val) =>
                                  handleUpdateCreate(
                                    tableGroup.tableKey,
                                    create.tempId,
                                    header.key,
                                    val,
                                  )
                              "
                              hide-details
                              density="compact"
                              color="primary"
                              class="cell-edit-switch"
                            />
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <!-- Deleted rows (pending deletes) -->
                <div
                  v-for="(deleteEntry, deleteIndex) in tableGroup.deletes"
                  :key="`del-${tableGroup.tableKey}-${deleteEntry.rowId}`"
                  class="row-change-block row-change-block--deleted"
                  :class="{ 'row-change-block--alt': deleteIndex % 2 === 1 }"
                >
                  <div class="row-context-table">
                    <div class="row-change-label">
                      <v-chip size="x-small" color="error" variant="tonal">
                        {{ t('pendingChanges.deletedRow') }}
                      </v-chip>
                      <v-btn
                        size="x-small"
                        variant="tonal"
                        color="primary"
                        @click="
                          tableChanges.revertDelete(
                            tableGroup.tableKey,
                            deleteEntry.rowId,
                          )
                        "
                        class="revert-btn ml-2"
                      >
                        <v-icon size="small" start>mdi-undo</v-icon>
                        {{ t('pendingChanges.revert') }}
                      </v-btn>
                    </div>
                    <!-- Show row data when available -->
                    <table
                      v-if="
                        deleteEntry.data &&
                        Object.keys(deleteEntry.data).length > 0
                      "
                      class="context-table"
                    >
                      <thead>
                        <tr>
                          <th
                            v-for="header in getVisibleHeaders(
                              tableGroup.tableKey,
                            )"
                            :key="header.key"
                          >
                            {{ header.title }}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td
                            v-for="header in getVisibleHeaders(
                              tableGroup.tableKey,
                            )"
                            :key="header.key"
                            class="cell-deleted"
                          >
                            {{ formatValue(deleteEntry.data[header.key]) }}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                    <!-- Fallback when no row data (e.g. legacy) -->
                    <div v-else class="d-flex align-center pa-2 text-caption">
                      ID: {{ deleteEntry.rowId }}
                    </div>
                  </div>
                </div>
              </v-expansion-panel-text>
            </v-expansion-panel>
          </v-expansion-panels>
        </div>
      </v-card-text>

      <v-divider></v-divider>

      <v-card-actions class="modal-actions">
        <v-btn
          color="error"
          variant="text"
          @click="handleRevertAll"
          :disabled="totalChangesCount === 0"
          size="small"
        >
          <v-icon start size="small">mdi-undo-variant</v-icon>
          {{ t('pendingChanges.revertAllChanges') }}
        </v-btn>
        <v-spacer></v-spacer>
        <v-btn variant="text" @click="handleClose" size="small">
          {{ t('common.cancel') }}
        </v-btn>
        <v-btn
          color="success"
          variant="flat"
          @click="handleSaveAll"
          :disabled="totalChangesCount === 0"
          :loading="saving"
          size="small"
        >
          <v-icon start size="small">mdi-content-save-all</v-icon>
          {{ t('pendingChanges.saveAllChanges') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- Confirmation dialogs -->
  <CoreConfirmDialog
    v-model="showRevertAllConfirm"
    :title="t('pendingChanges.confirmRevertAll.title')"
    :message="t('pendingChanges.confirmRevertAll.message')"
    :confirm-text="t('pendingChanges.confirmRevertAll.confirm')"
    :cancel-text="t('table.cancel')"
    confirm-color="var(--danger)"
    @confirm="confirmRevertAll"
    @cancel="showRevertAllConfirm = false"
  />
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTableChanges } from '@/composables/useTableChanges'
import CoreConfirmDialog from '@/components/core/table/CoreConfirmDialog.vue'

const { t } = useI18n()

interface RowData {
  [key: string]: any
}

interface TableRowsData {
  [rowId: string]: RowData
}

interface AllRowsData {
  [tableKey: string]: TableRowsData
}

interface TableHeaders {
  [tableKey: string]: Array<{ key: string; title: string; type?: string }>
}

interface Props {
  modelValue: boolean
  saving?: boolean
  validationError?: string | null
  rowIdentifiers?: Record<string, Record<string, string>>
  rowsData?: AllRowsData
  tableHeaders?: TableHeaders
  /** When provided, only show and count changes for these table keys (e.g. current group). */
  tableKeysFilter?: string[]
}

const props = withDefaults(defineProps<Props>(), {
  saving: false,
  validationError: null,
  rowIdentifiers: () => ({}),
  rowsData: () => ({}),
  tableHeaders: () => ({}),
  tableKeysFilter: undefined,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'save', data: any): void
  (e: 'close'): void
  (e: 'clear-validation-error'): void
  (
    e: 'update-change',
    tableKey: string,
    rowId: string,
    fieldKey: string,
    newValue: any,
  ): void
  (e: 'revert-change', tableKey: string, rowId: string, fieldKey: string): void
  (e: 'revert-row', tableKey: string, rowId: string): void
  (e: 'revert-table', tableKey: string): void
  (e: 'revert-all'): void
}>()

const clearValidationError = () => {
  emit('clear-validation-error')
}

const tableChanges = useTableChanges()

// State
const isFullscreen = ref(false)
const expandedPanels = ref<number[]>([0])
const showRevertAllConfirm = ref(false)

// Toggle fullscreen
const toggleFullscreen = () => {
  isFullscreen.value = !isFullscreen.value
}

/** Row is valid for display (excludes placeholder/undefined rowIds that cause empty inputs). */
const isValidRowId = (rowId: string): boolean =>
  rowId != null && String(rowId).trim() !== '' && String(rowId) !== 'undefined'

// Full grouped data (edits + creates + deletes); filter by tableKeysFilter and invalid rowIds
const fullGroupedByTable = computed(() => {
  const all = tableChanges.getFullGroupedChanges()
  const byTable = props.tableKeysFilter?.length
    ? all.filter((g) => new Set(props.tableKeysFilter).has(g.tableKey))
    : all
  return byTable
    .map((g) => ({
      ...g,
      changes: g.changes.filter((row) => isValidRowId(row.rowId)),
    }))
    .filter(
      (g) =>
        g.changes.length > 0 || g.creates.length > 0 || g.deletes.length > 0,
    )
})

// For backward compatibility and save payload: edits-only structure
const changesGroupedByTable = computed(() =>
  fullGroupedByTable.value.map((g) => ({
    tableKey: g.tableKey,
    tableTitle: g.tableTitle,
    changes: g.changes,
  })),
)

const totalChangesCount = computed(() => {
  if (!props.tableKeysFilter?.length)
    return tableChanges.totalChangesCount.value
  return fullGroupedByTable.value.reduce((sum, g) => {
    const editCount = g.changes.reduce((r, c) => r + c.fields.length, 0)
    return sum + editCount + g.creates.length + g.deletes.length
  }, 0)
})

// Get full row data for display
const getRowData = (tableKey: string, rowId: string): RowData | null => {
  return props.rowsData[tableKey]?.[rowId] || null
}

// Get headers for a table, filtering out 'id', selection, and other non-data columns
const getVisibleHeaders = (
  tableKey: string,
): Array<{ key: string; title: string; type?: string }> => {
  const headers = props.tableHeaders[tableKey] || []
  return headers.filter((h) => {
    const keyLower = (h.key || '').toLowerCase()
    return (
      keyLower !== 'id' &&
      keyLower !== 'selection' &&
      !keyLower.endsWith('_id') &&
      keyLower !== 'rowid'
    )
  })
}

// Check if a field is modified in a row group
const isFieldModified = (rowGroup: any, fieldKey: string): boolean => {
  return rowGroup.fields.some((f: any) => f.fieldKey === fieldKey)
}

// Get the old value of a modified field
const getFieldOldValue = (rowGroup: any, fieldKey: string): any => {
  const field = rowGroup.fields.find((f: any) => f.fieldKey === fieldKey)
  return field?.oldValue
}

// Get the current value of a field (modified value if changed, original otherwise)
const getRowFieldValue = (
  tableKey: string,
  rowId: string,
  fieldKey: string,
  rowGroup: any,
): any => {
  const modifiedField = rowGroup.fields.find(
    (f: any) => f.fieldKey === fieldKey,
  )
  if (modifiedField) {
    return modifiedField.newValue
  }
  const rowData = getRowData(tableKey, rowId)
  return rowData?.[fieldKey]
}

// Format value for display
const formatValue = (value: any): string => {
  if (value === null || value === undefined) return '-'
  if (typeof value === 'boolean') return value ? '✓ Sí' : '✗ No'
  if (typeof value === 'object') return JSON.stringify(value)
  const str = String(value)
  // Truncate long values
  return str.length > 50 ? str.substring(0, 47) + '...' : str
}

// Revert handlers
const revertRowChanges = (tableKey: string, rowId: string) => {
  tableChanges.revertRowChanges(tableKey, rowId)
  emit('revert-row', tableKey, rowId)
}

const handleUpdateCreate = (
  tableKey: string,
  tempId: string,
  fieldKey: string,
  value: any,
) => {
  tableChanges.updateCreateField(tableKey, tempId, fieldKey, value)
}

const handleRevertAll = () => {
  showRevertAllConfirm.value = true
}

const confirmRevertAll = () => {
  if (props.tableKeysFilter?.length) {
    props.tableKeysFilter.forEach((key) => {
      tableChanges.revertTableChanges(key)
      tableChanges.clearCreatesForTable(key)
      tableChanges.clearDeletesForTable(key)
    })
  } else {
    tableChanges.clearAllChanges()
  }
  showRevertAllConfirm.value = false
  emit('revert-all')
}

// Save handler
const handleSaveAll = () => {
  emit('save', changesGroupedByTable.value)
}

// Close handler
const handleClose = () => {
  emit('close')
  emit('update:modelValue', false)
}

// Auto-expand all panels when modal opens
watch(
  () => props.modelValue,
  (newValue) => {
    if (newValue) {
      expandedPanels.value = fullGroupedByTable.value.map((_, index) => index)
    }
  },
  { immediate: true },
)
</script>

<style scoped>
.pending-changes-modal {
  max-height: 90vh;
}

.pending-changes-modal.fullscreen-modal {
  max-height: 100vh;
  height: 100vh;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: linear-gradient(
    135deg,
    rgba(76, 175, 80, 0.08) 0%,
    rgba(76, 175, 80, 0.02) 100%
  );
}

.modal-content {
  min-height: 200px;
  max-height: 60vh;
  overflow-y: auto;
  padding: 16px;
}

.fullscreen-modal .modal-content {
  flex: 1;
  max-height: none;
}

.no-changes {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px;
}

.changes-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.table-changes-panel {
  border-radius: 8px !important;
  overflow: hidden;
}

.table-panel-title {
  min-height: 44px !important;
  padding: 8px 16px !important;
}

.table-name {
  font-weight: 600;
  font-size: 0.9rem;
}

/* Row change blocks */
.row-change-block {
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.row-change-block:last-child {
  border-bottom: none;
}

.row-change-block--alt {
  background-color: rgba(0, 0, 0, 0.015);
}

.row-change-block--new {
  border-left: 3px solid var(--primary-variant, #1976d2);
}

.row-change-block--deleted {
  border-left: 3px solid var(--danger, #c62828);
}

.context-table td.cell-deleted {
  background-color: rgba(198, 40, 40, 0.06);
  color: var(--subtitle, #666);
}

.row-change-label {
  display: flex;
  align-items: center;
  padding: 4px 0;
}

.context-table td.cell-new {
  background-color: rgba(25, 118, 210, 0.06);
}

/* Context table styles */
.row-context-table {
  overflow-x: auto;
  padding: 8px 12px;
}

.context-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8rem;
}

.context-table th {
  text-align: left;
  padding: 6px 10px;
  background-color: rgba(0, 0, 0, 0.03);
  font-weight: 500;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  color: var(--subtitle, #666);
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  white-space: nowrap;
}

.context-table th.header-modified {
  background-color: rgba(76, 175, 80, 0.12);
  color: #2e7d32;
}

.context-table td {
  padding: 8px 10px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.04);
  vertical-align: middle;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.context-table td.cell-modified {
  background-color: rgba(76, 175, 80, 0.08);
  white-space: normal;
}

.context-table td.cell-original {
  color: var(--subtitle, #666);
}

.actions-header {
  width: 80px;
}

.actions-cell {
  text-align: right;
  width: 80px;
}

/* Cell change display */
.cell-change {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 2px;
}

.cell-change--editable {
  gap: 6px;
}

.old-val {
  color: #c62828;
  text-decoration: line-through;
  opacity: 0.7;
  font-size: 0.75rem;
}

/* Editable inputs in modal */
.cell-edit-input {
  min-width: 80px;
  max-width: 160px;
}

.cell-edit-input :deep(.v-field) {
  font-size: 0.8rem;
}

.cell-edit-switch {
  flex-shrink: 0;
}

.new-val {
  color: #2e7d32;
  font-weight: 600;
}

/* Revert button */
.revert-btn {
  text-transform: none;
  font-size: 0.7rem;
}

/* Modal actions */
.modal-actions {
  padding: 12px 16px;
  gap: 8px;
}

.w-100 {
  width: 100%;
}
</style>
