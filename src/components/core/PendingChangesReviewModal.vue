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
      class="core-modal-base pending-changes-modal"
      :class="{ 'fullscreen-modal': isFullscreen }"
    >
      <!-- Header -->
      <v-card-title class="core-modal-base__header pending-changes-modal__header">
        <div class="d-flex align-center">
          <div class="pending-changes-modal__header-icon">
            <v-icon size="20" color="white">mdi-pencil-box-multiple</v-icon>
          </div>
          <span class="core-modal-base__title">{{ t('pendingChanges.title') }}</span>
          <v-chip
            size="small"
            variant="tonal"
            class="ml-3 pending-changes-modal__badge"
          >
            {{ totalChangesCount }} {{ $t('pendingChanges.changes') }}
          </v-chip>
        </div>
        <div class="d-flex align-center" style="gap: 4px;">
          <v-btn
            :icon="isFullscreen ? 'mdi-window-restore' : 'mdi-window-maximize'"
            variant="text"
            size="small"
            @click="toggleFullscreen"
            :title="
              isFullscreen
                ? t('projectExecution.minimize')
                : t('projectExecution.maximize')
            "
          />
          <v-btn
            icon="mdi-close"
            variant="text"
            size="small"
            class="core-modal-base__close"
            @click="handleClose"
          />
        </div>
      </v-card-title>

      <!-- Content -->
      <v-card-text class="core-modal-base__content pending-changes-modal__content">
        <!-- Validation error after save attempt -->
        <v-alert
          v-if="validationError"
          type="error"
          variant="tonal"
          density="comfortable"
          class="mb-4"
          :model-value="true"
          closable
          @click:close="clearValidationError"
        >
          <div v-html="validationError"></div>
        </v-alert>

        <!-- Processing changes message -->
        <v-alert
          v-if="saving"
          type="info"
          variant="tonal"
          density="comfortable"
          class="mb-4 pending-changes-modal__processing-alert"
          :model-value="true"
        >
          {{ t('pendingChanges.processingChanges') }}
        </v-alert>

        <!-- No changes state -->
        <div v-if="fullGroupedByTable.length === 0" class="pending-changes-modal__empty">
          <div class="pending-changes-modal__empty-icon">
            <v-icon size="40" color="white">mdi-check-all</v-icon>
          </div>
          <p class="pending-changes-modal__empty-text">{{ t('pendingChanges.noChanges') }}</p>
        </div>

        <!-- Changes grouped by table (edits + creates + deletes) -->
        <div v-else class="pending-changes-modal__list">
          <v-expansion-panels
            v-model="expandedPanels"
            multiple
            variant="accordion"
          >
            <v-expansion-panel
              v-for="tableGroup in fullGroupedByTable"
              :key="tableGroup.tableKey"
              class="pending-changes-modal__panel"
            >
              <v-expansion-panel-title class="pending-changes-modal__panel-title">
                <div class="d-flex align-center justify-space-between w-100">
                  <div class="d-flex align-center">
                    <v-icon class="mr-2" size="18" color="var(--primary)">mdi-table</v-icon>
                    <span class="pending-changes-modal__table-name">{{ tableGroup.tableTitle }}</span>
                    <v-chip
                      size="x-small"
                      variant="tonal"
                      class="ml-2 pending-changes-modal__count-chip"
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
                  class="pending-changes-modal__row pending-changes-modal__row--edited"
                  :class="{ 'pending-changes-modal__row--alt': rowIndex % 2 === 1 }"
                >
                  <div class="pending-changes-modal__row-table-wrap">
                    <!-- Label bar: type chip + revert -->
                    <div class="pending-changes-modal__row-bar">
                      <v-chip size="x-small" variant="tonal" class="pending-changes-modal__type-chip pending-changes-modal__type-chip--edited">
                        {{ t('pendingChanges.modifiedRow') }}
                      </v-chip>
                      <v-btn
                        size="x-small"
                        variant="text"
                        :disabled="saving"
                        @click="
                          revertRowChanges(
                            tableGroup.tableKey,
                            rowGroup.rowId,
                          )
                        "
                        class="pending-changes-modal__revert-btn"
                      >
                        <v-icon size="small" start>mdi-undo</v-icon>
                        {{ t('pendingChanges.revert') }}
                      </v-btn>
                    </div>
                    <!-- Row context as mini table -->
                    <table class="pending-changes-modal__table">
                      <thead>
                        <tr>
                          <th
                            v-for="header in getVisibleHeaders(
                              tableGroup.tableKey,
                            )"
                            :key="header.key"
                            :class="{
                              'pending-changes-modal__th--modified': isFieldModified(
                                rowGroup,
                                header.key,
                              ),
                            }"
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
                            :class="{
                              'pending-changes-modal__td--modified': isFieldModified(
                                rowGroup,
                                header.key,
                              ),
                              'pending-changes-modal__td--original': !isFieldModified(
                                rowGroup,
                                header.key,
                              ),
                            }"
                          >
                            <template
                              v-if="isFieldModified(rowGroup, header.key)"
                            >
                              <div class="pending-changes-modal__cell-change">
                                <span class="pending-changes-modal__old-val">{{
                                  formatValue(
                                    getFieldOldValue(rowGroup, header.key),
                                  )
                                }}</span>
                                <v-icon size="14" class="pending-changes-modal__arrow-icon"
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
                                  :type="getInputTypeForHeader(header)"
                                  variant="outlined"
                                  density="compact"
                                  hide-details
                                  class="pending-changes-modal__input"
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
                                  class="pending-changes-modal__switch"
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
                                :type="getInputTypeForHeader(header)"
                                variant="outlined"
                                density="compact"
                                hide-details
                                class="pending-changes-modal__input"
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
                                class="pending-changes-modal__switch"
                              />
                            </template>
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
                  class="pending-changes-modal__row pending-changes-modal__row--new"
                  :class="{ 'pending-changes-modal__row--alt': createIndex % 2 === 1 }"
                >
                  <div class="pending-changes-modal__row-table-wrap">
                    <!-- Label bar: type chip + revert -->
                    <div class="pending-changes-modal__row-bar">
                      <v-chip size="x-small" variant="tonal" class="pending-changes-modal__type-chip pending-changes-modal__type-chip--new">
                        {{ t('pendingChanges.newRow') }}
                      </v-chip>
                      <v-btn
                        size="x-small"
                        variant="text"
                        :disabled="saving"
                        @click="
                          tableChanges.revertCreate(
                            tableGroup.tableKey,
                            create.tempId,
                          )
                        "
                        class="pending-changes-modal__revert-btn"
                      >
                        <v-icon size="small" start>mdi-undo</v-icon>
                        {{ t('pendingChanges.revert') }}
                      </v-btn>
                    </div>
                    <table class="pending-changes-modal__table">
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
                              class="pending-changes-modal__td--new"
                            >
                            <v-text-field
                              v-if="(header.type || 'string') !== 'boolean'"
                              :model-value="getCreateFieldDisplayValue(create, header)"
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
                              :type="getInputTypeForHeader(header)"
                              variant="outlined"
                              density="compact"
                              hide-details
                              class="pending-changes-modal__input"
                            />
                            <v-switch
                              v-else
                              :model-value="!!getCreateFieldDisplayValue(create, header)"
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
                              class="pending-changes-modal__switch"
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
                  class="pending-changes-modal__row pending-changes-modal__row--deleted"
                  :class="{ 'pending-changes-modal__row--alt': deleteIndex % 2 === 1 }"
                >
                  <div class="pending-changes-modal__row-table-wrap">
                    <!-- Label bar: type chip + revert -->
                    <div class="pending-changes-modal__row-bar">
                      <v-chip size="x-small" variant="tonal" class="pending-changes-modal__type-chip pending-changes-modal__type-chip--deleted">
                        {{ t('pendingChanges.deletedRow') }}
                      </v-chip>
                      <v-btn
                        size="x-small"
                        variant="text"
                        :disabled="saving"
                        @click="
                          tableChanges.revertDelete(
                            tableGroup.tableKey,
                            deleteEntry.rowId,
                          )
                        "
                        class="pending-changes-modal__revert-btn"
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
                      class="pending-changes-modal__table"
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
                            class="pending-changes-modal__td--deleted"
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

      <!-- Actions -->
      <v-card-actions class="core-modal-base__actions pending-changes-modal__actions">
        <v-btn
          variant="text"
          @click="handleRevertAll"
          :disabled="totalChangesCount === 0 || saving"
          size="small"
          class="pending-changes-modal__revert-all-btn"
        >
          <v-icon start size="small">mdi-undo-variant</v-icon>
          {{ t('pendingChanges.revertAllChanges') }}
        </v-btn>
        <v-spacer></v-spacer>
        <v-btn
          variant="text"
          @click="handleClose"
          size="small"
          class="pending-changes-modal__cancel-btn"
          :disabled="saving"
        >
          {{ t('common.cancel') }}
        </v-btn>
        <v-btn
          type="button"
          variant="flat"
          @click.stop="handleSaveAll"
          :disabled="totalChangesCount === 0 || saving"
          :loading="saving"
          size="small"
          class="pending-changes-modal__save-btn"
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
import { parseJoinFrom } from '@/utils/schemaUtils'
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
  [tableKey: string]: Array<{
    key: string
    title: string
    type?: string
    joinFrom?: string
    foreignKeyField?: string
    /** FK columns (columns_to_join) are hidden from user; only sent to backend */
    isForeignKey?: boolean
    hidden?: boolean
  }>
}

interface Props {
  modelValue: boolean
  saving?: boolean
  validationError?: string | null
  rowIdentifiers?: Record<string, Record<string, string>>
  rowsData?: AllRowsData
  tableHeaders?: TableHeaders
  /** Referenced table data for resolving joinFrom display (e.g. building name from id). */
  tableData?: Record<string, any[]>
  /** When provided, only show and count changes for these table keys (e.g. current group). */
  tableKeysFilter?: string[]
}

const props = withDefaults(defineProps<Props>(), {
  saving: false,
  validationError: null,
  rowIdentifiers: () => ({}),
  rowsData: () => ({}),
  tableHeaders: () => ({}),
  tableData: () => ({}),
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

// Get headers for a table: hide 'id', selection, FK columns (columns_to_join), and other non-display columns.
// FK fields are only for the backend; user sees only the joined display columns.
const getVisibleHeaders = (
  tableKey: string,
): Array<{ key: string; title: string; type?: string }> => {
  const headers = props.tableHeaders[tableKey] || []
  return headers.filter((h) => {
    const keyLower = (h.key || '').toLowerCase()
    if (keyLower === 'id' || keyLower === 'selection' || keyLower === 'rowid') return false
    if (keyLower.endsWith('_id')) return false
    if ((h as any).isForeignKey === true || (h as any).hidden === true) return false
    return true
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

/** Get HTML input type for a header (date, datetime-local, time, number, text). */
const getInputTypeForHeader = (header: { type?: string }): string => {
  const t = header.type || 'string'
  if (t === 'date') return 'date'
  if (t === 'datetime') return 'datetime-local'
  if (t === 'time') return 'time'
  if (t === 'number') return 'number'
  return 'text'
}

/** Resolve joinFrom display value for a create row field. */
const getCreateFieldDisplayValue = (create: { data: Record<string, any> }, header: any): any => {
  const val = create.data[header.key]
  if (val != null && val !== '') return val
  const joinFrom = (header as any).joinFrom
  const foreignKeyField = (header as any).foreignKeyField
  if (!joinFrom || !foreignKeyField) return val
  const fkId = create.data[foreignKeyField]
  if (fkId == null) return val
  const joinInfo = parseJoinFrom(joinFrom)
  if (!joinInfo) return val
  const tableRows = props.tableData?.[joinInfo.table]
  if (!Array.isArray(tableRows)) return val
  const fkField = (header as any).foreignKeyField
  const refRow = tableRows.find(
    (r: any) =>
      String(r?.id) === String(fkId) ||
      (fkField && String(r?.[fkField]) === String(fkId)),
  )
  return refRow && joinInfo.field in refRow ? refRow[joinInfo.field] : val
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

<style>
@import '@/assets/styles/components/core/CoreModalBase.css';
</style>

<style scoped>
/* ── Modal card ── */
.pending-changes-modal {
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
  max-height: 90vh;
}

.pending-changes-modal.fullscreen-modal {
  max-height: 100vh;
  height: 100vh;
  border-radius: 0;
}

/* ── Header ── */
.pending-changes-modal__header {
  background: var(--background, #f6f6f6);
}

.pending-changes-modal__header-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background-color: var(--primary, #326786);
  margin-right: 12px;
  flex-shrink: 0;
}

.pending-changes-modal__badge {
  background-color: var(--primary-light-variant, #e6f1f7) !important;
  color: var(--primary, #326786) !important;
  font-weight: 600;
  font-size: 12px;
}

/* ── Content area ── */
.pending-changes-modal__content {
  min-height: 200px;
  max-height: 60vh;
  overflow-y: auto;
  padding: 20px;
}

.fullscreen-modal .pending-changes-modal__content {
  flex: 1;
  max-height: none;
}

/* ── Empty state ── */
.pending-changes-modal__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 56px 24px;
}

.pending-changes-modal__empty-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background-color: var(--disabled, #f2f4f7);
  margin-bottom: 16px;
}

.pending-changes-modal__empty-icon .v-icon {
  color: var(--subtitle, #6e6e6e) !important;
}

.pending-changes-modal__empty-text {
  color: var(--subtitle, #6e6e6e);
  font-size: 14px;
  margin: 0;
}

/* ── Changes list ── */
.pending-changes-modal__list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* ── Expansion panels ── */
.pending-changes-modal__panel {
  border-radius: 10px !important;
  border: 1px solid rgba(0, 0, 0, 0.08);
  overflow: hidden;
  box-shadow: none !important;
}

.pending-changes-modal__panel::before {
  box-shadow: none !important;
}

.pending-changes-modal__panel-title {
  min-height: 48px !important;
  padding: 10px 16px !important;
  background-color: var(--background, #f6f6f6);
  transition: background-color 0.2s ease;
}

.pending-changes-modal__panel-title:hover {
  background-color: var(--primary-light-variant, #e6f1f7);
}

.pending-changes-modal__table-name {
  font-weight: 600;
  font-size: 0.875rem;
  color: var(--title, #404040);
}

.pending-changes-modal__count-chip {
  background-color: var(--primary-light-variant, #e6f1f7) !important;
  color: var(--primary, #326786) !important;
  font-weight: 600;
}

/* ── Row blocks ── */
.pending-changes-modal__row {
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  transition: background-color 0.15s ease;
}

.pending-changes-modal__row:last-child {
  border-bottom: none;
}

.pending-changes-modal__row--alt {
  background-color: rgba(0, 0, 0, 0.015);
}

.pending-changes-modal__row--edited {
  border-left: 3px solid var(--warning, #ffb458);
}

.pending-changes-modal__row--new {
  border-left: 3px solid var(--primary, #326786);
}

.pending-changes-modal__row--deleted {
  border-left: 3px solid var(--danger, #f44336);
}

/* ── Unified row bar (chip + revert) ── */
.pending-changes-modal__row-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 0;
}

/* Type chips - each tinted to match the row border */
.pending-changes-modal__type-chip--edited {
  background-color: color-mix(in srgb, var(--warning, #ffb458) 15%, white) !important;
  color: var(--title, #404040) !important;
}

.pending-changes-modal__type-chip--new {
  background-color: color-mix(in srgb, var(--primary, #326786) 12%, white) !important;
  color: var(--primary-variant, #1e3f4f) !important;
}

.pending-changes-modal__type-chip--deleted {
  background-color: color-mix(in srgb, var(--danger, #f44336) 12%, white) !important;
  color: var(--danger-variant, #b43c31) !important;
}

/* ── Mini tables ── */
.pending-changes-modal__row-table-wrap {
  overflow-x: auto;
  padding: 10px 14px;
}

.pending-changes-modal__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8rem;
}

.pending-changes-modal__table th {
  text-align: left;
  padding: 7px 10px;
  background-color: var(--background, #f6f6f6);
  font-weight: 600;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: var(--subtitle, #6e6e6e);
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  white-space: nowrap;
}

.pending-changes-modal__th--modified {
  background-color: color-mix(in srgb, var(--success, #3ba780) 12%, var(--background, #f6f6f6)) !important;
  color: var(--success, #3ba780) !important;
}


.pending-changes-modal__table td {
  padding: 8px 10px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.04);
  vertical-align: middle;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pending-changes-modal__td--modified {
  background-color: color-mix(in srgb, var(--success, #3ba780) 8%, transparent);
  white-space: normal;
}

.pending-changes-modal__td--original {
  color: var(--subtitle, #6e6e6e);
}

.pending-changes-modal__td--new {
  background-color: color-mix(in srgb, var(--primary, #326786) 6%, transparent);
}

.pending-changes-modal__td--deleted {
  background-color: color-mix(in srgb, var(--danger, #f44336) 6%, transparent);
  color: var(--subtitle, #6e6e6e);
}

/* ── Cell change display ── */
.pending-changes-modal__cell-change {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.pending-changes-modal__old-val {
  color: var(--danger, #f44336);
  text-decoration: line-through;
  opacity: 0.75;
  font-size: 0.75rem;
}

.pending-changes-modal__arrow-icon {
  color: var(--subtitle, #6e6e6e);
}

/* ── Editable inputs ── */
.pending-changes-modal__input {
  min-width: 80px;
  max-width: 160px;
}

.pending-changes-modal__input :deep(.v-field) {
  font-size: 0.8rem;
  border-radius: 6px;
}

.pending-changes-modal__switch {
  flex-shrink: 0;
}

/* ── Revert button (unified for all row types) ── */
.pending-changes-modal__revert-btn {
  text-transform: none;
  font-size: 0.72rem;
  letter-spacing: 0;
  color: var(--subtitle, #6e6e6e) !important;
  transition: color 0.15s ease, background-color 0.15s ease;
}

.pending-changes-modal__revert-btn:hover {
  color: var(--danger, #f44336) !important;
  background-color: color-mix(in srgb, var(--danger, #f44336) 8%, transparent) !important;
}

/* ── Footer actions ── */
.pending-changes-modal__actions {
  border-top: 1px solid rgba(0, 0, 0, 0.08);
}

.pending-changes-modal__revert-all-btn {
  color: var(--danger, #f44336) !important;
  text-transform: none;
  letter-spacing: 0;
  font-weight: 500;
}

.pending-changes-modal__cancel-btn {
  color: var(--subtitle, #6e6e6e) !important;
  text-transform: none;
  letter-spacing: 0;
}

.pending-changes-modal__save-btn {
  background-color: var(--primary, #326786) !important;
  color: white !important;
  text-transform: none;
  letter-spacing: 0;
  font-weight: 500;
  border-radius: 8px;
}

.pending-changes-modal__save-btn:hover {
  box-shadow: 0 2px 8px rgba(50, 103, 134, 0.3);
}

.pending-changes-modal__processing-alert {
  font-weight: 500;
}

.pending-changes-modal__save-btn:disabled {
  background-color: var(--disabled, #f2f4f7) !important;
  color: var(--subtitle, #6e6e6e) !important;
  box-shadow: none;
}

/* ── Utilities ── */
.w-100 {
  width: 100%;
}

/* ── Responsive ── */
@media (max-width: 600px) {
  .pending-changes-modal__content {
    padding: 16px;
  }

  .pending-changes-modal__row-table-wrap {
    padding: 8px 10px;
  }
}
</style>
