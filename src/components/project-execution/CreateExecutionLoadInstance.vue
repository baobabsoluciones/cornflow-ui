<template>
  <div>
    <v-alert
      v-if="warningMessage"
      type="warning"
      variant="tonal"
      density="comfortable"
      class="mb-4 load-instance-warning"
      closable
      @click:close="warningMessage = null"
    >
      <div class="font-weight-medium mb-1">
        {{ t('projectExecution.steps.step3.loadInstance.warningTitle') }}
      </div>
      <div class="load-instance-warning-body">{{ warningMessage }}</div>
    </v-alert>
    <v-row class="load-instance-columns" align="stretch">
      <v-col
        cols="12"
        :md="showAlternativeColumn ? 5 : 12"
        class="load-instance-col d-flex flex-column"
      >
        <div class="load-instance-panel flex-grow-1 d-flex flex-column">
          <MDragNDropFile
            ref="dragDropFileRef"
            class="load-instance-drop flex-grow-1"
            multiple
            downloadIcon="mdi-upload"
            :description="
              t(
                'projectExecution.steps.step3.loadInstance.dragAndDropDescription',
              )
            "
            :uploadedFiles="selectedFiles"
            :formatsAllowed="instanceProcessing.supportedExtensions.value"
            :errors="displayedErrors"
            :downloadButtonTitle="
              t('projectExecution.steps.step3.loadInstance.uploadFile')
            "
            :invalidFileText="
              t('projectExecution.steps.step3.loadInstance.invalidFileFormat')
            "
            @files-selected="onFileSelected"
          />
        </div>

        <div class="d-flex justify-center mt-4">
          <v-btn
            color="primary"
            :disabled="!canProcess"
            @click="processFiles"
            class="load-instance-btn"
            elevation="2"
            large
          >
            <v-icon left>mdi-upload-multiple</v-icon>
            {{ t('projectExecution.steps.step3.loadInstance.loadInstance') }}
            <span class="ml-1" v-if="selectedFiles.length > 0">
              ({{ selectedFiles.length }}
              {{
                selectedFiles.length === 1
                  ? t('common.file')
                  : t('common.files')
              }})
            </span>
          </v-btn>
        </div>

        <template v-if="showLoadFromDbButton">
          <div class="optional-divider load-from-db-divider my-3" aria-hidden="true">
            <span class="optional-divider-line" />
            <span class="optional-divider-badge">
              {{ t('projectExecution.steps.step3.loadInstance.optionalOrDivider') }}
            </span>
            <span class="optional-divider-line" />
          </div>
          <div class="d-flex justify-center">
            <v-btn
              color="primary"
              :disabled="isCheckingSchema"
              @click="processFromDb"
              class="load-instance-btn load-from-db-btn"
              elevation="2"
              large
            >
              <v-icon left>mdi-database-arrow-down</v-icon>
              {{ t('projectExecution.steps.step3.loadInstance.loadFromDb') }}
            </v-btn>
          </div>
        </template>
      </v-col>

      <v-col
        v-if="showAlternativeColumn"
        cols="12"
        md="1"
        class="optional-divider-col d-flex align-center justify-center py-4 py-md-0"
      >
        <span class="optional-divider-sr">
          {{ t('projectExecution.steps.step3.loadInstance.optionalOrDivider') }}
        </span>
        <div class="optional-divider" aria-hidden="true">
          <span class="optional-divider-line" />
          <span class="optional-divider-badge">
            {{
              t('projectExecution.steps.step3.loadInstance.optionalOrDivider')
            }}
          </span>
        </div>
      </v-col>

      <v-col
        v-if="showAlternativeColumn"
        cols="12"
        md="6"
        class="load-instance-col d-flex flex-column"
      >
        <div
          class="load-instance-panel parameters-fields flex-grow-1 pa-4 d-flex flex-column"
        >
          <div class="parameters-fields-body">
            <h4 class="alternative-parameters-hint mb-4">
              {{
                t(
                  'projectExecution.steps.step3.loadInstance.alternativeParametersHint',
                )
              }}
            </h4>
            <div class="parameters-fields-inner">
              <v-text-field
                v-for="field in alternativeFields"
                :key="field.id"
                v-model="paramValues[field.id]"
                :label="t(field.titleKey)"
                :placeholder="
                  field.placeholderKey ? t(field.placeholderKey) : undefined
                "
                :type="inputTypeForField(field)"
                density="comfortable"
                variant="outlined"
                hide-details="auto"
                class="mb-3"
              />
            </div>
          </div>
        </div>

        <div class="d-flex justify-center mt-4">
          <v-btn
            color="primary"
            :disabled="!canProcessParameters"
            @click="processParameters"
            class="load-instance-btn load-parameters-btn"
            elevation="2"
            large
          >
            <v-icon left>mdi-upload-multiple</v-icon>
            {{ t('projectExecution.steps.step3.loadInstance.loadParameters') }}
          </v-btn>
        </div>
      </v-col>
    </v-row>

    <!-- Loading Spinner -->
    <div class="d-flex justify-center mt-2" v-if="isCheckingSchema">
      <v-progress-circular indeterminate color="primary" size="32" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, inject, onMounted, onUnmounted, computed } from 'vue'
import { Instance } from '@/app/models/Instance'
import { useI18n } from 'vue-i18n'
import {
  useInstanceProcessing,
  buildInstanceDataFromAlternativeFields,
} from '@/composables/useInstanceProcessing'
import { useErrorDownload } from '@/composables/useErrorDownload'
import { formatValidationErrors } from '@/utils/errorFormatting'
import type { ErrorObject } from 'ajv'
import { useGeneralStore } from '@/stores/general'
import type { LoadInstanceAlternativeParamField } from '@/app/config'

// Composables
const { t } = useI18n()
const instanceProcessing = useInstanceProcessing()
const errorDownload = useErrorDownload()
const generalStore = useGeneralStore()

// Props
const props = defineProps({
  instance: {
    type: Instance,
    default: null,
  },
  selectedFiles: {
    type: Array as () => File[],
    default: () => [],
  },
  existingInstanceErrors: {
    type: String,
    default: null,
  },
  newExecution: {
    type: Object,
    default: () => ({}),
  },
})

// Emits
const emit = defineEmits<{
  'update:existingInstanceErrors': [value: string | null]
  filesSelected: [files: File[]]
  instanceSelected: [instance: Instance]
  externalEtlData: [rawData: Record<string, any>]
}>()

// State
const selectedFiles = ref<File[]>(props.selectedFiles || [])
const instanceErrors = ref<string | null>(props.existingInstanceErrors)
const rawErrors = ref<ErrorObject[] | null>(null)
const dragDropFileRef = ref<any>(null)
const paramValues = ref<Record<string, unknown>>({})
const warningMessage = ref<string | null>(null)

const etlConfig = computed(() => generalStore.appConfig.parameters.etl)

const alternativeFields = computed(
  () => etlConfig.value?.alternativeParameterFields ?? [],
)

const showAlternativeColumn = computed(() => alternativeFields.value.length > 0)

const showLoadFromDbButton = computed(
  () => etlConfig.value?.useEtlBackend && etlConfig.value?.enableLoadFromDb,
)

const showSnackbar =
  inject<(message: string, color?: string) => void>('showSnackbar')

// Computed
const isCheckingSchema = computed(
  () => instanceProcessing.state.value.isProcessing,
)

const canProcess = computed(
  () =>
    selectedFiles.value.length > 0 && instanceProcessing.canProcessFiles.value,
)

const canProcessParameters = computed(() => {
  if (
    !showAlternativeColumn.value ||
    !instanceProcessing.canProcessFiles.value
  ) {
    return false
  }
  for (const field of alternativeFields.value) {
    const required = field.required !== false
    if (!required) continue
    const v = paramValues.value[field.id]
    if (v === null || v === undefined || v === '') {
      return false
    }
  }
  return true
})

const displayedErrors = computed(() => {
  if (!instanceErrors.value) return null

  // If no raw errors, show original errors as-is
  if (!rawErrors.value || rawErrors.value.length === 0) {
    return instanceErrors.value
  }

  const totalErrorsMessage = createTotalErrorsMessage(rawErrors.value.length)

  // If errors are within limit, show all with total and download button
  if (rawErrors.value.length <= errorDownload.DISPLAY_ERROR_LIMIT) {
    const downloadButtonHtml = createDownloadButtonHtml(rawErrors.value.length)
    return totalErrorsMessage + instanceErrors.value + downloadButtonHtml
  }

  // Limit displayed errors to first DISPLAY_ERROR_LIMIT
  return createLimitedErrorsHtml(
    rawErrors.value,
    instanceErrors.value,
    totalErrorsMessage,
  )
})

function inputTypeForField(field: LoadInstanceAlternativeParamField) {
  if (field.type === 'date') return 'date'
  if (field.type === 'number') return 'number'
  return 'text'
}

// Utility functions for error display
const createTotalErrorsMessage = (total: number): string => {
  return `<p style="color: var(--danger-variant); font-weight: bold; margin-bottom: 10px;">
    ${t('projectExecution.steps.step3.loadInstance.totalErrors', { total })}
  </p>`
}

const createDownloadButtonHtml = (errorCount: number): string => {
  const errorText = errorCount === 1 ? t('common.error') : t('common.errors')
  return `
    <div style="text-align: center; margin-top: 15px; padding-top: 15px; border-top: 1px solid #e0e0e0;">
      <button 
        id="${errorDownload.DOWNLOAD_BUTTON_ID}" 
        style="${getDownloadButtonStyles()}"
        onmouseover="this.style.backgroundColor='var(--primary-variant)'"
        onmouseout="this.style.backgroundColor='var(--primary)'"
      >
        ${t('projectExecution.steps.step3.loadInstance.downloadAllErrors')} 
        (${errorCount} ${errorText})
      </button>
    </div>
  `
}

const getDownloadButtonStyles = (): string => {
  return `
    background-color: var(--primary); 
    color: white; 
    border: none; 
    padding: 10px 20px; 
    border-radius: 4px; 
    cursor: pointer; 
    font-size: 14px;
    display: inline-flex;
    align-items: center;
    gap: 8px;
  `
    .replaceAll(/\s+/g, ' ')
    .trim()
}

const createLimitedErrorsHtml = (
  errors: ErrorObject[],
  originalErrors: string,
  totalErrorsMessage: string,
): string => {
  const limitedErrors = errors.slice(0, errorDownload.DISPLAY_ERROR_LIMIT)
  const limitedHtml = formatValidationErrors(limitedErrors, t)

  // Extract title from original errors
  const titleMatch = originalErrors.match(/<p><strong>(.*?)<\/strong><\/p>/)
  const title = titleMatch ? titleMatch[1] : 'Errors'

  const titleHtml = `<p><strong>${title}:</strong></p>`
  const limitedHtmlWithTitle =
    titleHtml + (limitedHtml ? `<ul>${limitedHtml}</ul>` : '')

  // Add message about remaining errors
  const remainingCount = errors.length - errorDownload.DISPLAY_ERROR_LIMIT
  const remainingMessage = `<p style="color: var(--danger-variant); font-weight: bold; margin-top: 10px;">
    ${t('projectExecution.steps.step3.loadInstance.andMoreErrors', {
      count: remainingCount,
    })}
  </p>`

  const downloadButtonHtml = createDownloadButtonHtml(errors.length)

  return (
    totalErrorsMessage +
    limitedHtmlWithTitle +
    remainingMessage +
    downloadButtonHtml
  )
}

// Download handler
const handleDownloadErrors = errorDownload.createDownloadHandler(
  () => rawErrors.value,
  () => {
    // Success callback
    showSnackbar?.(
      t('projectExecution.steps.step3.loadInstance.errorsDownloadStarted'),
      'success',
    )
  },
  () => {
    // Error callback
    showSnackbar?.(
      t('projectExecution.steps.step3.loadInstance.errorsDownloadError'),
      'error',
    )
  },
)

// Setup download button watcher
watch(
  () => displayedErrors.value,
  () => {
    if (rawErrors.value && rawErrors.value.length > 0) {
      errorDownload.cleanupDownloadButton(handleDownloadErrors)
      errorDownload.setupDownloadButton(handleDownloadErrors)
    }
  },
)

function initParamValuesFromFields() {
  const next: Record<string, unknown> = {}
  for (const f of alternativeFields.value) {
    next[f.id] = paramValues.value[f.id] ?? null
  }
  paramValues.value = next
}

watch(
  alternativeFields,
  () => {
    initParamValuesFromFields()
  },
  { immediate: true },
)

onUnmounted(() => {
  errorDownload.cleanupDownloadButton(handleDownloadErrors)
})

// Lifecycle hooks
onMounted(() => {
  if (props.selectedFiles && props.selectedFiles.length > 0) {
    selectedFiles.value = [...props.selectedFiles]
  }
})

// Watchers
watch(
  () => props.selectedFiles,
  (newFiles) => {
    // Always sync with props, even if empty array
    if (newFiles) {
      selectedFiles.value = [...newFiles]
    } else {
      selectedFiles.value = []
    }

    // Reset drag and drop component if files are cleared
    if ((!newFiles || newFiles.length === 0) && dragDropFileRef.value) {
      // Clear the drag and drop component's internal state
      if (dragDropFileRef.value.clearFiles) {
        dragDropFileRef.value.clearFiles()
      }
    }
  },
  { immediate: true },
)

watch(
  () => props.existingInstanceErrors,
  (newErrors) => {
    instanceErrors.value = newErrors
    if (!newErrors) {
      rawErrors.value = null
    }
  },
  { immediate: true },
)

// File handling methods
const onFileSelected = (files: File[]) => {
  resetErrors()
  instanceProcessing.resetState()
  selectedFiles.value = [...files]
  emit('filesSelected', selectedFiles.value)
}

const processFiles = async () => {
  if (selectedFiles.value.length === 0) {
    return
  }

  resetErrors()

  try {
    const result = await instanceProcessing.processFiles(selectedFiles.value)

    if (result.success && result.instance) {
      handleProcessingSuccess(result.instance, result.warning)
      if (result.rawData) {
        emit('externalEtlData', result.rawData)
      }
    } else if (result.errors) {
      handleProcessingError(result.errors, result.rawErrors)
    }
  } catch (error) {
    console.error('Error in processFiles:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    handleProcessingError(errorMessage, null)
  }
}

const processFromDb = async () => {
  resetErrors()

  try {
    const result = await instanceProcessing.processFromDb()

    if (result.success && result.instance) {
      handleProcessingSuccess(result.instance, result.warning)
      if (result.rawData) {
        emit('externalEtlData', result.rawData)
      }
    } else if (result.errors) {
      handleProcessingError(result.errors, result.rawErrors)
    }
  } catch (error) {
    console.error('Error in processFromDb:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    handleProcessingError(errorMessage, null)
  }
}

const processParameters = async () => {
  if (!canProcessParameters.value) return

  resetErrors()

  const payload = buildInstanceDataFromAlternativeFields(
    alternativeFields.value,
    paramValues.value as Record<string, unknown>,
    {
      instanceSchema: generalStore.getSchemaConfig.instanceSchema,
      masterDataTables: generalStore.rawConfigurations?.masterData ?? null,
    },
  )

  try {
    const result = await instanceProcessing.processInstanceData(payload)

    if (result.success && result.instance) {
      handleProcessingSuccess(result.instance, result.warning)
      if (result.rawData) {
        emit('externalEtlData', result.rawData)
      }
    } else if (result.errors) {
      handleProcessingError(result.errors, result.rawErrors)
    }
  } catch (error) {
    console.error('Error in processParameters:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    handleProcessingError(errorMessage, null)
  }
}

const handleProcessingSuccess = (
  instance: Instance,
  warning: string | null | undefined = null,
) => {
  emit('instanceSelected', instance)
  warningMessage.value = warning ?? null

  if (showSnackbar) {
    showSnackbar(t('projectExecution.steps.step3.loadInstance.instancesLoaded'))
  }
}

const handleProcessingError = (
  errorMessage: string,
  rawErrorsData: ErrorObject[] | null = null,
) => {
  instanceErrors.value = errorMessage
  rawErrors.value = rawErrorsData
  emit('update:existingInstanceErrors', instanceErrors.value)

  if (showSnackbar) {
    showSnackbar(
      t('projectExecution.steps.step3.loadInstance.instanceSchemaError'),
      'error',
    )
  }
}

const resetErrors = () => {
  instanceErrors.value = null
  rawErrors.value = null
  warningMessage.value = null
  emit('update:existingInstanceErrors', instanceErrors.value)
}
</script>

<style scoped>
/* Match load-zone copy: color + margin-top (inline) and h4 { font-weight: 500 } */
.alternative-parameters-hint {
  margin-top: -10px;
  color: var(--title);
  font-weight: 500;
}

.optional-divider-col {
  position: relative;
  min-width: 0;
}

@media (min-width: 960px) {
  .optional-divider-col.d-flex {
    align-self: stretch;
  }
}

.optional-divider-sr {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.optional-divider {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 48px;
}

.optional-divider-line {
  position: absolute;
  background: rgba(var(--v-theme-on-surface), 0.14);
  pointer-events: none;
}

.optional-divider-badge {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  border-radius: 50%;
  background: rgb(var(--v-theme-surface));
  color: rgba(var(--v-theme-on-surface), 0.42);
  font-weight: 700;
  font-size: 0.65rem;
  line-height: 1;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  box-shadow: 0 0 0 1px rgba(var(--v-theme-on-surface), 0.1);
}

@media (min-width: 960px) {
  .optional-divider {
    flex: 1 1 auto;
    width: 100%;
    min-height: 260px;
  }

  .optional-divider-line {
    left: 50%;
    top: 0;
    bottom: 0;
    width: 1px;
    transform: translateX(-50%);
  }
}

@media (max-width: 959.98px) {
  .optional-divider-line {
    left: 0;
    right: 0;
    top: 50%;
    height: 1px;
    transform: translateY(-50%);
  }
}

/* Horizontal "— o —" divider between the two buttons in the same column */
.load-from-db-divider {
  display: flex;
  align-items: center;
  min-height: unset;
  gap: 8px;
}

.load-from-db-divider .optional-divider-line {
  position: static;
  flex: 1 1 auto;
  height: 1px;
  width: auto;
  transform: none;
}

.load-from-db-divider .optional-divider-badge {
  position: static;
  box-shadow: none;
}

.load-instance-col {
  min-width: 0;
}

.load-instance-warning-body {
  white-space: pre-wrap;
  word-break: break-word;
}

.load-instance-panel {
  border: 1px dashed rgba(var(--v-theme-on-surface), 0.22);
  border-radius: 8px;
  min-height: 260px;
  overflow: hidden;
}

.parameters-fields {
  min-height: 0;
}

.parameters-fields-body {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 0;
}

/* Stretch built-in dropzone to fill the dashed panel (mango-vue root). */
.load-instance-drop {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

@media (min-width: 960px) {
  .load-instance-columns {
    flex-wrap: nowrap;
  }

  .load-instance-col {
    align-items: stretch;
  }
}
</style>
