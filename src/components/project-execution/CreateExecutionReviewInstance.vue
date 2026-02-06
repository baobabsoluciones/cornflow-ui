<template>
  <div class="review-instance-wrapper">
    <!-- Loading overlay for master table matching -->
    <div v-if="isMasterTableMatchingEnabled && isMasterTableLoading" class="master-table-loading-overlay">
      <div class="loading-content">
        <v-progress-circular
          indeterminate
          color="primary"
          size="40"
        />
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
      :instance-data="selectedMatchForComparison.instanceData"
      :master-data="selectedMatchForComparison.masterData"
      :diff-summary="selectedMatchForComparison.diffSummary"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, inject, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import ExecutionDataView from '@/components/project-execution/ExecutionDataView.vue'
import CoreDropdownMenu from '@/components/core/CoreDropdownMenu.vue'
import DataComparisonModal from '@/components/project-execution/DataComparisonModal.vue'
import { useFullscreen } from '@/composables/useFullscreen'
import {
  useExecutionExcel,
  type NewExecution,
} from '@/composables/project-execution/useExecutionExcel'
import { useMasterTableMatch } from '@/composables/project-execution/useMasterTableMatch'
import { Instance } from '@/app/models/Instance'
import { formatValidationErrorsWithTitle } from '@/utils/errorFormatting'
import { useGeneralStore } from '@/stores/general'
import appConfig from '@/app/config'
import { useTableChanges } from '@/composables/useTableChanges'

interface Props {
  newExecution: NewExecution
  instanceErrors?: string | null
  isEditMode?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  instanceErrors: null,
  isEditMode: false,
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

// Comparison modal state
const showComparisonModal = ref(false)
const selectedMatchForComparison = ref<any>(null)

// Computed property to add canReplaceMaster to each match
// Returns empty array if feature is disabled
const masterTableMatchesWithCanReplace = computed(() => {
  if (!isMasterTableMatchingEnabled.value) {
    return []
  }
  return masterTableMatch.matches.value.map((match) => ({
    ...match,
    canReplaceMaster: masterTableMatch.canReplaceMasterTable(match.tableKey),
  }))
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

// Detect master table matches when instance data changes (only if feature is enabled)
watch(
  () => props.newExecution.instance?.data,
  async (newData) => {
    // Skip detection if feature is disabled
    if (!isMasterTableMatchingEnabled.value) {
      masterTableMatch.reset()
      return
    }

    if (newData && typeof newData === 'object') {
      await masterTableMatch.detectMatches(newData as Record<string, any>)
    } else {
      masterTableMatch.reset()
    }
  },
  { immediate: true, deep: false },
)

// Handle 'use_master' choice - update instance with master data
const handleUseMasterChoice = (tableKey: string) => {
  const match = masterTableMatch.matches.value.find(
    (m) => m.tableKey === tableKey,
  )
  if (!match || !props.newExecution.instance) return

  const newTableData = [...match.masterData]
  const updatedData = {
    ...props.newExecution.instance.data,
    [tableKey]: newTableData,
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
  masterTableMatch.updateMatchAfterAction(tableKey, 'use_master', newTableData)

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
    if (showSnackbar) {
      const errorMessage = error instanceof Error
        ? error.message
        : t('masterTableMatch.messages.updateError')
      showSnackbar(errorMessage, 'error')
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

// Handle instance update callback
const handleInstanceUpdate = (instance: Instance) => {
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
const executionDataViewRef = ref<InstanceType<typeof ExecutionDataView> | null>(null)

// Handle pending changes update from ExecutionDataView
const handlePendingChangesUpdate = (hasChanges: boolean, changesCount: number) => {
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
