<template>
  <div class="review-instance-wrapper">
    <!-- Loading overlay for master table matching -->
    <div
      v-if="isMasterTableMatchingEnabled && isMasterTableLoading"
      class="master-table-loading-overlay"
    >
      <div class="loading-content">
        <v-progress-circular indeterminate color="primary" size="40" />
        <span class="loading-text">{{ $t('masterTableMatch.loading') }}</span>
      </div>
    </div>

    <!-- Normal view with maximize button -->
    <div class="review-instance-container">
      <div v-if="!isMaximized" class="review-instance-header">
        <div class="header-buttons">
          <CoreDropdownMenu :items="excelActionItems" />
          <input
            ref="fileInput"
            type="file"
            accept=".xlsx,.xls"
            style="display: none"
            @change="handleFileUpload"
            :key="'file-input-normal'"
          />
          <v-btn
            icon="mdi-window-maximize"
            variant="text"
            size="small"
            class="maximize-button"
            @click="toggleMaximize"
            :title="$t('projectExecution.maximize')"
          />
        </div>
      </div>
      <ExecutionDataView
        ref="executionDataViewRef"
        :execution="newExecution"
        :can-check-data="false"
        :checks-finished="false"
        :checks-error="false"
        :master-table-matches="masterTableMatchesWithCanReplace"
        :master-table-loading="isMasterTableLoading"
        :enable-excel-mode="true"
        :external-etl-flow="externalEtlFlow"
        @save-changes="handleSaveChanges"
        @master-table-action="handleMasterTableChoice"
        @show-comparison="handleShowComparison"
        @pending-changes-update="handlePendingChangesUpdate"
      />
      <!-- Error Alert - Show validation errors if any (below the table) -->
      <v-alert
        v-if="instanceErrors"
        type="error"
        variant="tonal"
        density="comfortable"
        class="mt-3"
        :model-value="true"
      >
        <div v-html="instanceErrors"></div>
      </v-alert>
      <!-- Force retry dialog when overwrite (replace master) returns offer_force_retry (teleported so it is always on top and clickable) -->
      <Teleport to="body">
        <ForceRetryConfirmDialog
          v-if="hasValidForceRetryOffer"
          :model-value="hasValidForceRetryOffer"
          :message="forceRetryOfferValue?.message ?? ''"
          :loading="forceRetryLoadingValue"
          @confirm="handleForceRetryConfirm"
          @cancel="masterTableMatch.rejectForceRetry"
          @update:model-value="
            (v) => {
              if (!v) masterTableMatch.rejectForceRetry()
            }
          "
        />
      </Teleport>
    </div>

    <!-- Fullscreen overlay - Teleported to body to avoid stacking context issues -->
    <Teleport to="body">
      <transition name="fade">
        <div
          v-if="isMaximized"
          class="fullscreen-overlay"
          @click.self="toggleMaximize"
        >
          <div class="fullscreen-content">
            <div class="fullscreen-header">
              <h2 class="fullscreen-title">
                {{ $t('projectExecution.steps.step4.titleContent') }}
              </h2>
              <div class="fullscreen-header-buttons">
                <CoreDropdownMenu :items="excelActionItems" />
                <input
                  ref="fileInputFullscreen"
                  type="file"
                  accept=".xlsx,.xls"
                  style="display: none"
                  @change="handleFileUpload"
                  :key="'file-input-fullscreen'"
                />
                <v-btn
                  icon="mdi-window-restore"
                  variant="text"
                  size="small"
                  class="minimize-button"
                  @click="toggleMaximize"
                  :title="$t('projectExecution.minimize')"
                />
              </div>
            </div>
            <div class="fullscreen-body">
              <ExecutionDataView
                :execution="newExecution"
                :can-check-data="false"
                :checks-finished="false"
                :checks-error="false"
                :master-table-matches="masterTableMatchesWithCanReplace"
                :enable-excel-mode="true"
                :external-etl-flow="externalEtlFlow"
                @save-changes="handleSaveChanges"
                @master-table-action="handleMasterTableChoice"
                @show-comparison="handleShowComparison"
                @pending-changes-update="handlePendingChangesUpdate"
              />
            </div>
          </div>
        </div>
      </transition>
    </Teleport>

    <!-- Data comparison modal (only shown when master table matching is enabled) -->
    <DataComparisonModal
      v-if="isMasterTableMatchingEnabled && selectedMatchForComparison"
      v-model="showComparisonModal"
      :table-name="selectedMatchForComparison.tableName"
      :master-table-title="selectedMatchForComparison.masterTableTitle"
      :instance-data="effectiveInstanceDataForComparison"
      :master-data="selectedMatchForComparison.masterData"
      :diff-summary="selectedMatchForComparison.diffSummary"
      :master-table-config="selectedMatchForComparison.masterTableConfig"
      :full-instance-data="selectedMatchForComparison.fullInstanceData"
      :instance-schema-columns="selectedMatchForComparison.instanceSchemaColumns"
      :allow-row-restore="true"
      :allow-row-delete="true"
      @restore-master-row="handleRestoreMasterRow"
      @delete-instance-row="handleDeleteInstanceRow"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, inject, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import ExecutionDataView from '@/components/project-execution/ExecutionDataView.vue'
import CoreDropdownMenu from '@/components/core/CoreDropdownMenu.vue'
import DataComparisonModal from '@/components/project-execution/DataComparisonModal.vue'
import { useFullscreen } from '@/composables/useFullscreen'
import {
  useExecutionExcel,
  type NewExecution,
} from '@/composables/project-execution/useExecutionExcel'
import {
  useMasterTableMatch,
  getMasterCompareRowContext,
} from '@/composables/project-execution/useMasterTableMatch'
import { isForceRetryOfferError } from '@/repositories/TableRepository'
import ForceRetryConfirmDialog from '@/components/core/table/ForceRetryConfirmDialog.vue'
import { Instance } from '@/app/models/Instance'
import { formatValidationErrorsWithTitle } from '@/utils/errorFormatting'
import { useGeneralStore } from '@/stores/general'
import appConfig from '@/app/config'
import { useTableChanges } from '@/composables/useTableChanges'
import { parameterRowsToParameterObject, buildRowMatchKey } from '@/utils/schemaUtils'
import type { ExternalEtlFlowState } from '@/types/etlFlow'

interface Props {
  newExecution: NewExecution
  instanceErrors?: string | null
  isEditMode?: boolean
  externalEtlFlow?: ExternalEtlFlowState | null
  /** When true, we are on the review-instance step (used to clear stale force-retry dialog when entering the step). */
  isStepActive?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  instanceErrors: null,
  isEditMode: false,
  externalEtlFlow: null,
  isStepActive: false,
})

const emit = defineEmits<{
  (e: 'update:instance', instance: Instance): void
  (e: 'update:instanceErrors', errors: string | null): void
  (e: 'master-tables-updated', tables: string[]): void
  (e: 'has-pending-changes', hasChanges: boolean): void
}>()

// Table changes composable for tracking pending changes
const tableChanges = useTableChanges()

const generalStore = useGeneralStore()
const showSnackbar = inject('showSnackbar') as
  | ((message: string, color?: string, options?: any) => void)
  | undefined

const { t } = useI18n()
const { isMaximized, toggleMaximize } = useFullscreen()

// Check if master table matching feature is enabled
const isMasterTableMatchingEnabled = computed(() => {
  return appConfig.getCore().parameters.enableMasterTableMatching !== false
})

// Master table match composable
const masterTableMatch = useMasterTableMatch()

// Clear any stale force-retry dialog when entering this step (e.g. from a previous replace_master that returned offer_force_retry)
onMounted(() => {
  masterTableMatch.rejectForceRetry()
})

// When step becomes active (e.g. user navigates to this step; component may already be mounted if step content uses v-show), clear dialog
watch(
  () => props.isStepActive,
  (active) => {
    if (active) masterTableMatch.rejectForceRetry()
  },
)

// Unwrap refs for ForceRetryConfirmDialog (composable returns refs; template would see Ref object as truthy and offer.match would be undefined)
const forceRetryOfferValue = computed(
  () => masterTableMatch.forceRetryOffer?.value ?? null,
)
const forceRetryLoadingValue = computed(
  () => !!masterTableMatch.forceRetryLoading?.value,
)
const hasValidForceRetryOffer = computed(
  () => !!forceRetryOfferValue.value?.match,
)

// Comparison modal state
const showComparisonModal = ref(false)
const selectedMatchForComparison = ref<any>(null)

/**
 * Effective instance data for the open comparison modal: base rows with pending edits applied,
 * pending deletes marked (shown with strikethrough), and pending creates appended.
 * This lets the side-by-side view reflect queued changes before they are saved.
 *
 * Gated on `showComparisonModal`: re-merging the base array on every reactive
 * tick is O(N) over the full table, so we only do it while the modal is open.
 */
// Apply queued edits to a single base row, returning a clone tagged as
// __pendingEdit. Assumes there is at least one edit for the row.
const applyPendingEditsToRow = (
  row: any,
  rowEdits: Record<string, any>,
): any => {
  const updated: any = { ...row, __pendingEdit: true }
  for (const [fieldKey, change] of Object.entries(rowEdits)) {
    updated[fieldKey] = (change as any).newValue
  }
  return updated
}

// Resolve how a single base row should appear in the comparison view:
// marked as a pending delete, with pending edits applied, or unchanged.
const buildComparisonRow = (
  row: any,
  pendingEditsForTable: Record<string, any>,
  deletedIds: Set<string>,
): any => {
  const rowId = row.id == null ? null : String(row.id)
  if (rowId && deletedIds.has(rowId)) {
    return { ...row, __pendingDelete: true }
  }
  const rowEdits: Record<string, any> = rowId
    ? pendingEditsForTable[rowId] ?? {}
    : {}
  if (Object.keys(rowEdits).length > 0) {
    return applyPendingEditsToRow(row, rowEdits)
  }
  return row
}

const effectiveInstanceDataForComparison = computed<any[]>(() => {
  if (!showComparisonModal.value) return []
  if (!selectedMatchForComparison.value) return []
  const tableKey: string = selectedMatchForComparison.value.tableKey
  const baseData: any[] = selectedMatchForComparison.value.instanceData

  const pendingEditsForTable = tableChanges.pendingChanges.value[tableKey] ?? {}
  const pendingCreatesForTable = tableChanges.pendingCreates.value[tableKey] ?? []
  const pendingDeletesForTable: Array<{ rowId: string }> =
    tableChanges.pendingDeletes.value[tableKey] ?? []
  const deletedIds = new Set(pendingDeletesForTable.map((d) => String(d.rowId)))

  const result: any[] = baseData.map((row) =>
    buildComparisonRow(row, pendingEditsForTable, deletedIds),
  )
  for (const create of pendingCreatesForTable) {
    result.push({ ...create.data, id: create.tempId, __pendingCreate: true })
  }
  return result
})

// Computed property to add canReplaceMaster to each match
// Returns empty array if feature is disabled
const masterTableMatchesWithCanReplace = computed(() => {
  if (!isMasterTableMatchingEnabled.value) {
    return []
  }
  const enableReplace =
    appConfig.getCore().parameters.enableReplaceMasterWithUploaded === true
  return masterTableMatch.matches.value.map((match) => {
    const canReplaceMaster = masterTableMatch.canReplaceMasterTable(
      match.tableKey,
    )
    return {
      ...match,
      canReplaceMaster,
      showReplaceMasterOption: canReplaceMaster && enableReplace,
    }
  })
})

// Computed property for master table loading state
const isMasterTableLoading = computed(() => {
  return isMasterTableMatchingEnabled.value && masterTableMatch.loading.value
})

// Local state for errors
const instanceErrors = ref<string | null>(props.instanceErrors)

// Watch for prop changes
watch(
  () => props.instanceErrors,
  (newErrors) => {
    instanceErrors.value = newErrors
  },
  { immediate: true },
)

// Detect master table matches when the instance is replaced, ETL metadata
// changes, or the automation catalog (re)loads.
//
// Reactivity contract: this flow never mutates `instance.data` rows in place
// — every edit goes through `useTableChanges` (a separate reactive map) and
// only materialises as a new `Instance` on save via `handleSaveChanges`. So
// watching the `instance?.data` *reference* (no `deep`) is enough; a deep
// watcher used to traverse every nested cell of 500k-row tables on each
// keystroke, which froze the UI.
const runMasterTableMatchDetection = async () => {
  if (!isMasterTableMatchingEnabled.value) {
    masterTableMatch.reset()
    return
  }

  const newData = props.newExecution.instance?.data
  if (newData && typeof newData === 'object') {
    await masterTableMatch.detectMatches(newData as Record<string, any>, {
      etlTablesFromDb: props.externalEtlFlow?.metadata?.tables_from_db,
    })
  } else {
    masterTableMatch.reset()
  }
}

watch(() => props.newExecution.instance?.data, runMasterTableMatchDetection, {
  immediate: true,
})
watch(
  () =>
    generalStore.rawConfigurations?.masterData
      ? Object.keys(generalStore.rawConfigurations.masterData).length
      : 0,
  runMasterTableMatchDetection,
)
watch(
  () => props.externalEtlFlow?.metadata?.tables_from_db?.length ?? 0,
  runMasterTableMatchDetection,
)

// Handle 'use_master' choice - update instance with master data
const handleUseMasterChoice = (tableKey: string) => {
  const match = masterTableMatch.matches.value.find(
    (m) => m.tableKey === tableKey,
  )
  if (!match || !props.newExecution.instance) return

  const newPayload =
    match.storageShape === 'parameter_object'
      ? parameterRowsToParameterObject(match.masterData)
      : [...match.masterData]
  const rowsForMatchState =
    match.storageShape === 'parameter_object'
      ? [...match.masterData]
      : newPayload

  const updatedData = {
    ...props.newExecution.instance.data,
    [tableKey]: newPayload,
  }

  const schemas = generalStore.getSchemaConfig
  const updatedInstance = new Instance(
    null,
    updatedData,
    schemas.instanceSchema,
    schemas.instanceChecksSchema,
    generalStore.getSchemaName,
  )

  emit('update:instance', updatedInstance)
  masterTableMatch.updateMatchAfterAction(
    tableKey,
    'use_master',
    rowsForMatchState as any[],
  )

  if (showSnackbar) {
    showSnackbar(
      t('masterTableMatch.messages.usingMasterData', {
        tableName: match.masterTableTitle,
      }),
      'info',
    )
  }
}

// Handle 'replace_master' choice - update master table with uploaded data
const handleReplaceMasterChoice = async (tableKey: string) => {
  try {
    const result = await masterTableMatch.applyChoices(
      props.newExecution.instance?.data as Record<string, any>,
      { onlyTableKey: tableKey },
    )

    if (result.masterTablesUpdated.length > 0) {
      emit('master-tables-updated', result.masterTablesUpdated)
      masterTableMatch.updateMatchAfterAction(tableKey, 'replace_master')

      if (showSnackbar) {
        showSnackbar(
          t('masterTableMatch.messages.masterTableUpdated', {
            tableName: result.masterTablesUpdated.join(', '),
          }),
          'success',
        )
      }
    }
  } catch (error) {
    // ForceRetryOfferError: dialog is shown via forceRetryOffer, do not show snackbar
    if (isForceRetryOfferError(error)) return
    if (showSnackbar) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : t('masterTableMatch.messages.updateError')
      showSnackbar(errorMessage, 'error')
    }
  }
}

// Handle force retry confirm (overwrite anyway when backend returned offer_force_retry)
const handleForceRetryConfirm = async () => {
  const offer = masterTableMatch.forceRetryOffer?.value ?? null
  if (!offer?.match) {
    masterTableMatch.rejectForceRetry()
    return
  }
  const { tableKey, tableName } = offer.match
  try {
    const replaced = await masterTableMatch.acceptForceRetry()
    if (replaced && showSnackbar) {
      masterTableMatch.updateMatchAfterAction(tableKey, 'replace_master')
      emit('master-tables-updated', [tableName])
      showSnackbar(
        t('masterTableMatch.messages.masterTableUpdated', {
          tableName,
        }),
        'success',
      )
    }
  } catch (err) {
    if (showSnackbar) {
      const msg =
        err instanceof Error
          ? err.message
          : t('masterTableMatch.messages.updateError')
      showSnackbar(msg, 'error')
    }
  }
}

// Handle user choice for master table match
const handleMasterTableChoice = async (
  tableKey: string,
  choice: 'keep_uploaded' | 'use_master' | 'replace_master',
) => {
  masterTableMatch.setUserChoice(tableKey, choice)

  if (choice === 'use_master') {
    handleUseMasterChoice(tableKey)
  } else if (choice === 'replace_master') {
    await handleReplaceMasterChoice(tableKey)
  }
  // 'keep_uploaded': do nothing, just record the choice
}

// Handle showing comparison modal
const handleShowComparison = (tableKey: string) => {
  const match = masterTableMatchesWithCanReplace.value.find(
    (m) => m.tableKey === tableKey,
  )
  if (match) {
    selectedMatchForComparison.value = match
    showComparisonModal.value = true
  }
}

// Handle per-row restore from master (git-diff style restore from right → left).
// Changes enter the normal manual-edit pending flow (tableChanges) so the user can
// review, accept, or discard them from the editable grid — not silently applied.
const handleRestoreMasterRow = (originalMasterRow: any) => {
  if (!props.newExecution.instance || !selectedMatchForComparison.value) return

  const tableKey = selectedMatchForComparison.value.tableKey
  const instanceData = props.newExecution.instance.data as Record<string, any>
  const tableData = instanceData[tableKey]

  if (!Array.isArray(tableData)) return

  const match = masterTableMatchesWithCanReplace.value.find(
    (m) => m.tableKey === tableKey,
  )
  if (!match) return

  const { keyFields } = getMasterCompareRowContext(
    match.instanceData,
    match.masterData,
    match.tableKey,
    match.fullInstanceData,
  )

  const masterRowKey = buildRowMatchKey(originalMasterRow, keyFields)
  const ignoredFields = new Set(['id', '_id', 'created_at', 'updated_at'])
  const { id: _si, _id: _sui, created_at: _ca, updated_at: _ua, ...cleanMasterRow } = originalMasterRow

  const tableTitle = match.masterTableTitle

  const existingRow = tableData.find(
    (r: any) => buildRowMatchKey(r, keyFields) === masterRowKey,
  )

  if (existingRow) {
    // Row exists in instance but differs from master — queue field-level edits
    const rowId = existingRow.id ?? existingRow._id
    if (rowId != null) {
      for (const [fieldKey, newValue] of Object.entries(cleanMasterRow)) {
        if (ignoredFields.has(fieldKey)) continue
        tableChanges.recordChange(
          tableKey,
          rowId,
          fieldKey,
          existingRow[fieldKey],
          newValue,
          fieldKey,
          tableTitle,
        )
      }
    }
  } else {
    // Row exists only in master — queue as a pending new row
    tableChanges.recordCreate(tableKey, cleanMasterRow, tableTitle)
  }

  if (showSnackbar) {
    showSnackbar(t('dataComparison.restoreRowQueued'), 'info')
  }
}

// Handle per-row delete from instance panel — queues a pending delete in the normal edit flow
const handleDeleteInstanceRow = (row: any) => {
  if (!selectedMatchForComparison.value) return
  const tableKey: string = selectedMatchForComparison.value.tableKey
  const match = masterTableMatchesWithCanReplace.value.find(
    (m) => m.tableKey === tableKey,
  )
  const tableTitle = match?.masterTableTitle ?? tableKey

  const rowId = row.id ?? row._id
  if (rowId == null) return

  const idStr = String(rowId)
  if (idStr.startsWith('create-')) {
    // This is a pending-create row (restored from master but not yet saved) — cancel the restore
    tableChanges.revertCreate(tableKey, idStr)
  } else {
    tableChanges.recordDelete(tableKey, rowId, row)
    tableChanges.setTableTitle(tableKey, tableTitle)
  }

  if (showSnackbar) {
    showSnackbar(t('dataComparison.deleteRowQueued'), 'info')
  }
}

// Clear errors handler
const clearErrors = () => {
  instanceErrors.value = null
  emit('update:instanceErrors', null)
}

// Use a single file input ref that works for both views
const fileInput = ref<HTMLInputElement>()
const fileInputFullscreen = ref<HTMLInputElement>()

// Get the active file input based on view mode
const getActiveFileInput = () => {
  return isMaximized.value ? fileInputFullscreen.value : fileInput.value
}

// Handle instance update callback (e.g. from Excel re-upload)
const handleInstanceUpdate = (instance: Instance) => {
  // When ETL flow is active and user re-uploads Excel, mark all tables as reuploaded
  if (props.externalEtlFlow?.tableSwitches) {
    for (const switchState of Object.values(
      props.externalEtlFlow.tableSwitches,
    )) {
      ;(switchState as any).variant = 'reuploaded'
      ;(switchState as any).fixed = true
    }
    // Reset all parameter switches to null (default behavior) for re-upload
    if (props.externalEtlFlow.parameterSwitches) {
      for (const key of Object.keys(props.externalEtlFlow.parameterSwitches)) {
        props.externalEtlFlow.parameterSwitches[key] = null
      }
    }
  }
  emit('update:instance', {
    ...props.newExecution.instance!,
    data: instance.data,
  } as Instance)
}

const { downloadExcel, handleFileUpload, triggerFileUpload } =
  useExecutionExcel(
    computed(() => props.newExecution),
    handleInstanceUpdate,
  )

// Excel action items for dropdown menu
const excelActionItems = computed(() => [
  {
    id: 'download-excel',
    title: t('projectExecution.downloadExcel'),
    icon: 'mdi-microsoft-excel',
    action: downloadExcel,
  },
  {
    id: 'upload-excel',
    title: t('projectExecution.uploadExcel'),
    icon: 'mdi-file-arrow-up-down',
    action: () => {
      const activeInput = getActiveFileInput()
      if (activeInput) {
        activeInput.click()
      }
    },
  },
])

const handleSaveChanges = async (data: object) => {
  if (!props.newExecution.instance) {
    return
  }

  // Create a new instance with updated data for validation
  const schemas = generalStore.getSchemaConfig
  const updatedInstance = new Instance(
    null,
    data,
    schemas.instanceSchema,
    schemas.instanceChecksSchema,
    generalStore.getSchemaName,
  )

  // Validate the instance against the schema
  try {
    const validationErrors = await updatedInstance.checkSchema()

    if (validationErrors && validationErrors.length > 0) {
      // Format validation errors with full Ajv error details and translations
      const errorMessage = formatValidationErrorsWithTitle(
        t('projectExecution.steps.step3.loadInstance.instanceSchemaError'),
        validationErrors, // Pass full Ajv ErrorObject array
        t, // Pass translation function
      )

      // Update local errors and emit to parent
      instanceErrors.value = errorMessage
      emit('update:instanceErrors', errorMessage)

      // Show snackbar notification (persistent - won't auto-close)
      if (showSnackbar) {
        showSnackbar(
          t('projectExecution.steps.step3.loadInstance.instanceSchemaError'),
          'error',
          { persistent: true }, // Make it persistent so it doesn't auto-close
        )
      }

      return // Don't update instance if validation fails
    }

    // Validation passed - clear errors and update instance
    instanceErrors.value = null
    emit('update:instanceErrors', null)
    emit('update:instance', updatedInstance)
  } catch (error) {
    // Handle validation exception
    const errorMessage = error instanceof Error ? error.message : String(error)
    instanceErrors.value = errorMessage
    emit('update:instanceErrors', errorMessage)

    if (showSnackbar) {
      showSnackbar(
        t('projectExecution.steps.step3.loadInstance.unexpectedError'),
        'error',
        { persistent: true },
      )
    }
  }
}

// Reference to ExecutionDataView
const executionDataViewRef = ref<InstanceType<typeof ExecutionDataView> | null>(
  null,
)

// Handle pending changes update from ExecutionDataView
const handlePendingChangesUpdate = (
  hasChanges: boolean,
  changesCount: number,
) => {
  emit('has-pending-changes', hasChanges)
}

// Check if there are pending changes
const hasPendingChanges = computed(() => {
  return tableChanges.hasChanges.value
})

// Expose methods for parent component
defineExpose({
  hasPendingChanges,
  clearPendingChanges: tableChanges.clearAllChanges,
})
</script>

<style scoped>
.review-instance-wrapper {
  position: relative;
  width: 100%;
}

/* Loading overlay for master table matching */
.master-table-loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(255, 255, 255, 0.85);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
}

.loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.loading-text {
  color: var(--subtitle);
  font-size: 0.9rem;
  font-weight: 500;
}

.review-instance-container {
  width: 100%;
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  position: relative;
}

.review-instance-container :deep(.execution-data-view) {
  flex: 0 1 auto;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.review-instance-header {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 20;
}

.header-buttons {
  display: flex;
  gap: 4px;
  align-items: center;
  margin-top: -95px;
}

.maximize-button {
  background: transparent !important;
  box-shadow: none !important;
  color: var(--subtitle);
}

@media (max-width: 1500px) {
  .header-buttons {
    margin-top: -110px;
  }
}

.maximize-button:hover {
  background-color: transparent !important;
  color: var(--title);
}
</style>

<!-- Fullscreen overlay styles - not scoped because it's teleported to body -->
<style>
.fullscreen-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.fullscreen-content {
  width: 100%;
  height: 100%;
  background-color: white;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  overflow: hidden;
}

.fullscreen-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.12);
  flex-shrink: 0;
}

.fullscreen-header-buttons {
  display: flex;
  gap: 8px;
  align-items: center;
}

.fullscreen-title {
  font-size: 18px;
  font-weight: 500;
  color: var(--title);
  margin: 0;
}

.minimize-button {
  background-color: rgba(0, 0, 0, 0.05);
}

.minimize-button:hover {
  background-color: rgba(0, 0, 0, 0.1);
}

.fullscreen-body {
  flex: 1;
  overflow: auto;
  padding: 24px;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.fullscreen-body :deep(.execution-data-view) {
  flex: 0 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Ensure Vuetify dialogs appear above the fullscreen overlay */
/* These styles target dialogs that are rendered in body alongside the overlay */
body.fullscreen-overlay-active .v-overlay,
body.fullscreen-overlay-active .v-dialog,
body.fullscreen-overlay-active .v-overlay__content {
  z-index: 10001 !important;
}

/* Ensure Vuetify menu components also appear above */
body.fullscreen-overlay-active .v-menu__content,
body.fullscreen-overlay-active .v-select__menu {
  z-index: 10001 !important;
}

/* Transition animations */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.fade-enter-active .fullscreen-content,
.fade-leave-active .fullscreen-content {
  transition:
    transform 0.3s ease,
    opacity 0.3s ease;
}

.fade-enter-from .fullscreen-content,
.fade-leave-to .fullscreen-content {
  transform: scale(0.95);
  opacity: 0;
}
</style>
