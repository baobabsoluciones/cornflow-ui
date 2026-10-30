<template>
  <div class="review-instance-wrapper">
    <div v-if="showToolbar" class="review-instance-header">
      <CoreButton
        variant="outlined"
        size="small"
        icon="mdi-microsoft-excel"
        :text="t('projectExecution.downloadExcel')"
        @click="downloadExcel"
      />
      <CoreButton
        variant="outlined"
        size="small"
        icon="mdi-file-arrow-up-down"
        :text="t('projectExecution.uploadExcel')"
        @click="uploadExcel"
      />
      <CoreButton
        variant="icon"
        size="small"
        icon="mdi-fullscreen"
        :aria-label="t('projectExecution.maximize')"
        :title="t('projectExecution.maximize')"
        @click="toggleMaximize"
      />
    </div>
    <input
      ref="fileInput"
      type="file"
      accept=".xlsx,.xls"
      hidden
      @change="handleFileUpload"
    />
    <ExecutionDataView
      ref="executionDataViewRef"
      :execution="newExecution"
      :master-table-matches="masterTableMatchesWithCanReplace"
      :master-table-loading="isMasterTableMatchingEnabled && isMasterTableLoading"
      :enable-excel-mode="true"
      :external-etl-flow="externalEtlFlow"
      @save-changes="handleSaveChanges"
      @master-table-action="handleMasterTableChoice"
      @show-comparison="handleShowComparison"
    />
    <!-- Validation errors of the data, below the table -->
    <CoreAlert v-if="instanceErrors" tone="error" class="review-instance-errors">
      <span v-html="instanceErrors" />
    </CoreAlert>
    <!-- Replacing a master table that other data depends on (offer_force_retry) -->
    <ForceRetryConfirmDialog
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

    <DataComparisonDialog
      v-if="isMasterTableMatchingEnabled && selectedMatchForComparison"
      v-model:open="showComparisonModal"
      :table-title="selectedMatchForComparison.masterTableTitle"
      :columns="comparisonColumns"
      :lines="comparisonLines"
      :loaded-count="selectedMatchForComparison.diffSummary?.totalInstance ?? comparisonLines.length"
      :master-count="selectedMatchForComparison.diffSummary?.totalMaster ?? 0"
      :pending-count="comparisonPendingCount"
      allow-restore
      allow-delete
      @restore="(line) => handleRestoreMasterRow(line.masterRow)"
      @delete="(line) => handleDeleteInstanceRow(line.loadedRow)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, inject, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import ExecutionDataView from '@cornflow-ui/core/components/project-execution/ExecutionDataView.vue'
import CoreAlert from '@cornflow-ui/core/components/core/CoreAlert.vue'
import CoreButton from '@cornflow-ui/core/components/core/CoreButton.vue'
import DataComparisonDialog from '@cornflow-ui/core/components/core/data-table/DataComparisonDialog.vue'
import { columnsFromHeaders, formatColumnKey } from '@cornflow-ui/core/utils/dataTable'
import { comparisonLinesFrom } from '@cornflow-ui/core/utils/dataComparison'
import {
  useExecutionExcel,
  type NewExecution,
} from '@cornflow-ui/core/composables/project-execution/useExecutionExcel'
import {
  useMasterTableMatch,
  getMasterCompareRowContext,
} from '@cornflow-ui/core/composables/project-execution/useMasterTableMatch'
import { isForceRetryOfferError } from '@cornflow-ui/core/repositories/TableRepository'
import ForceRetryConfirmDialog from '@cornflow-ui/core/components/core/table/ForceRetryConfirmDialog.vue'
import { Instance } from '@/app/models/Instance'
import { formatValidationErrorsWithTitle } from '@cornflow-ui/core/utils/errorFormatting'
import { useGeneralStore } from '@cornflow-ui/core/stores/general'
import { getAppParameters } from '@cornflow-ui/core/utils/appParameters'
import { useTableChanges } from '@cornflow-ui/core/composables/useTableChanges'
import { parameterRowsToParameterObject, buildRowMatchKey } from '@cornflow-ui/core/utils/schemaUtils'
import type { ExternalEtlFlowState } from '@cornflow-ui/core/types/etlFlow'

interface Props {
  newExecution: NewExecution
  instanceErrors?: string | null
  externalEtlFlow?: ExternalEtlFlowState | null
  /**
   * Show the floating Excel menu and maximize button. A screen that offers them in its own header
   * turns it off and calls the exposed `downloadExcel`, `uploadExcel` and `toggleMaximize`.
   */
  showToolbar?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  instanceErrors: null,
  externalEtlFlow: null,
  showToolbar: true,
})

const emit = defineEmits<{
  (e: 'update:instance', instance: Instance): void
  (e: 'update:instanceErrors', errors: string | null): void
}>()

// Table changes composable for tracking pending changes
const tableChanges = useTableChanges()

const generalStore = useGeneralStore()
const showSnackbar = inject('showSnackbar') as
  | ((message: string, color?: string, options?: any) => void)
  | undefined

const { t } = useI18n()

// Check if master table matching feature is enabled
const isMasterTableMatchingEnabled = computed(() => {
  return getAppParameters().enableMasterTableMatching !== false
})

// Master table match composable
const masterTableMatch = useMasterTableMatch()

// A force-retry offer left by an earlier replace_master (offer_force_retry) does not carry over
onMounted(() => {
  masterTableMatch.rejectForceRetry()
})

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
    (tableChanges.pendingDeletes.value[tableKey] ?? []) as Array<{ rowId: string }>
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
    getAppParameters().enableReplaceMasterWithUploaded === true
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
    if (replaced) {
      masterTableMatch.updateMatchAfterAction(tableKey, 'replace_master')
      showSnackbar?.(
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

const fileInput = ref<HTMLInputElement>()
const getActiveFileInput = () => fileInput.value

/** Shows the table over the whole window, or back in its place. */
const toggleMaximize = () => executionDataViewRef.value?.toggleFullscreen()

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

const { downloadExcel, handleFileUpload } =
  useExecutionExcel(
    computed(() => props.newExecution),
    handleInstanceUpdate,
  )

// ── The comparison with the master table ────────────────────────────────────

const comparisonLines = computed(() => {
  const match = selectedMatchForComparison.value
  if (!showComparisonModal.value || !match) return []
  return comparisonLinesFrom({
    tableKey: match.tableKey,
    instanceRows: effectiveInstanceDataForComparison.value,
    masterRows: match.masterData ?? [],
    masterTableConfig: match.masterTableConfig,
    fullInstanceData: match.fullInstanceData,
    instanceSchemaColumns: match.instanceSchemaColumns,
  })
})

/** Columns of the compared table: the instance schema's, else the keys of its rows. */
const comparisonColumns = computed(() => {
  const match = selectedMatchForComparison.value
  if (!match) return []
  const schema = (props.newExecution.instance as any)?.schema?.properties?.[match.tableKey]?.items
  if (schema?.properties) {
    return columnsFromHeaders(
      Object.entries(schema.properties).map(([key, prop]: [string, any]) => ({
        key,
        title: prop?.title,
        type: prop?.type === 'integer' ? 'number' : prop?.format ?? prop?.type,
      })),
    )
  }
  const keys = new Set<string>()
  for (const line of comparisonLines.value) {
    Object.keys(line.loaded ?? line.master ?? {}).forEach((key) => keys.add(key))
  }
  return [...keys]
    .filter((key) => key !== 'id' && !key.startsWith('__'))
    .map((key) => ({ key, title: formatColumnKey(key), type: 'text' as const }))
})

const comparisonPendingCount = computed(() => {
  const key = selectedMatchForComparison.value?.tableKey
  if (!key) return 0
  const edits = tableChanges.getChangesForTable(key) ?? {}
  return (
    Object.values(edits).reduce((sum, row) => sum + Object.keys(row).length, 0) +
    tableChanges.getPendingCreates(key).length +
    tableChanges.getPendingDeletes(key).length
  )
})

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

// Check if there are pending changes
const hasPendingChanges = computed(() => {
  return tableChanges.hasChanges.value
})

// Expose methods for parent component
/**
 * Applies the pending edits as "Save all changes" does. Resolves false when there was nothing to
 * apply into or the edited data breaks the schema (the edits stay pending and the error shows).
 */
async function applyPendingChanges(): Promise<boolean> {
  if (!tableChanges.hasChanges.value) return true
  const view = executionDataViewRef.value
  return view ? view.saveAllChanges() : false
}

/** Opens the file picker of "Upload Excel": the picked workbook replaces the data. */
function uploadExcel() {
  getActiveFileInput()?.click()
}

defineExpose({
  hasPendingChanges,
  clearPendingChanges: tableChanges.clearAllChanges,
  applyPendingChanges,
  downloadExcel,
  uploadExcel,
  toggleMaximize,
})
</script>

<style scoped>
.review-instance-wrapper {
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 3);
  height: 100%;
  min-height: 0;
}

.review-instance-header {
  display: flex;
  justify-content: flex-end;
  gap: calc(var(--spacing) * 2);
}

.review-instance-wrapper > :deep(.execution-data-view) {
  flex: 1;
  min-height: 0;
}
</style>
