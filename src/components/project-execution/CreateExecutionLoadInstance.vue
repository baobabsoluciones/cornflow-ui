<template>
  <div class="load-step">
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

    <div class="load-form">
      <!-- What data: the parameters the ETL loads the data with. -->
      <section v-if="showPreEtlFields" class="load-form__section pre-etl-fields">
        <h4 class="load-form__heading">
          {{ t('projectExecution.steps.step3.loadInstance.preEtlParamsHint') }}
        </h4>
        <CreateExecutionConfigParams
          :model-value="newExecution"
          scope="preEtl"
          layout="form"
          @update:model-value="onPreEtlUpdate"
        />
        <v-alert
          v-if="preEtlChangedAfterLoad"
          type="warning"
          variant="tonal"
          density="compact"
        >
          <div class="load-form__changed">
            <span>{{
              t('projectExecution.steps.step3.loadInstance.preEtlChangedAfterLoad')
            }}</span>
            <v-btn
              variant="text"
              color="primary"
              class="reload-btn"
              :disabled="!canLoad"
              @click="loadData"
            >
              {{ t('projectExecution.steps.step3.loadInstance.reload') }}
            </v-btn>
          </div>
        </v-alert>
      </section>

      <!-- Where from: master tables or a file. -->
      <section class="load-form__section">
        <div v-if="sourceOptions.length > 1" class="load-form__row">
          <div class="load-form__label">
            {{ t('projectExecution.steps.step3.loadInstance.source') }}
          </div>
          <OptionCards
            v-model="selectedSource"
            :options="sourceOptions"
            :label="t('projectExecution.steps.step3.loadInstance.source')"
          />
        </div>

        <div
          class="load-form__row load-form__row--top"
          :class="{ 'load-form__row--wide': sourceOptions.length <= 1 }"
        >
          <div v-if="sourceOptions.length > 1" class="load-form__label" />
          <div class="load-form__source">
            <MDragNDropFile
              v-if="selectedSource === 'file'"
              ref="dragDropFileRef"
              class="load-instance-drop"
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
            <div
              v-else
              class="load-form__panel load-form__database"
            >
              <v-icon size="28" color="primary">mdi-database-arrow-down</v-icon>
              <span>{{
                t('projectExecution.steps.step3.loadInstance.databaseSummary')
              }}</span>
            </div>
            <div
              v-if="selectedSource !== 'file' && displayedErrors"
              class="load-form__errors"
              v-html="displayedErrors"
            />
          </div>
        </div>
      </section>

      <div class="load-form__actions">
        <span v-if="isLoaded" class="load-form__loaded" data-testid="load-instance-loaded">
          <v-icon size="20">mdi-check-circle</v-icon>
          {{ t('projectExecution.steps.step3.loadInstance.loaded') }}
        </span>
        <v-btn
          color="primary"
          size="large"
          class="load-instance-btn"
          :class="{ 'load-from-db-btn': selectedSource === 'database' }"
          :disabled="!canLoad"
          @click="loadData"
        >
          <v-icon start>{{ loadButtonIcon }}</v-icon>
          {{ loadButtonLabel }}
        </v-btn>
      </div>
    </div>

    <div class="d-flex justify-center mt-2" v-if="isCheckingSchema">
      <v-progress-circular indeterminate color="primary" size="32" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, inject, onMounted, onUnmounted, computed } from 'vue'
import { Instance } from '@/app/models/Instance'
import { useI18n } from 'vue-i18n'
import { useInstanceProcessing } from '@cornflow-ui/core/composables/useInstanceProcessing'
import { useErrorDownload } from '@cornflow-ui/core/composables/useErrorDownload'
import { formatValidationErrors } from '@cornflow-ui/core/utils/errorFormatting'
import type { ErrorObject } from 'ajv'
import { useGeneralStore } from '@cornflow-ui/core/stores/general'
import { pickPreEtlConfigValues } from '@cornflow-ui/core/utils/schemaUtils'
import CreateExecutionConfigParams from '@cornflow-ui/core/components/project-execution/CreateExecutionConfigParams.vue'
import OptionCards from '@cornflow-ui/core/components/core/OptionCards.vue'

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
  /** The pre-ETL fields are edited here, so the execution config is written back up. */
  'update:config': [config: Record<string, any>]
  filesSelected: [files: File[]]
  instanceSelected: [instance: Instance]
  externalEtlData: [rawData: Record<string, any>]
}>()

// State
const selectedFiles = ref<File[]>(props.selectedFiles || [])
const instanceErrors = ref<string | null>(props.existingInstanceErrors)
const rawErrors = ref<ErrorObject[] | null>(null)
const dragDropFileRef = ref<any>(null)
const warningMessage = ref<string | null>(null)

/**
 * The pre-ETL values the instance on screen was actually loaded with, serialized. Null
 * until something is loaded. Compared against the current ones to tell the user when
 * they have edited a value the loaded data was not filtered by.
 */
const loadedPreEtlValues = ref<string | null>(null)

const etlConfig = computed(() => generalStore.appConfig.parameters.etl)

const showLoadFromDbButton = computed(
  () => etlConfig.value?.useEtlBackend && etlConfig.value?.enableLoadFromDb,
)

type DataSource = 'database' | 'file'

/** Ways to bring the data in: a file always; master tables when configured. */
const sourceOptions = computed(() => [
  ...(showLoadFromDbButton.value
    ? [
        {
          value: 'database',
          title: t('projectExecution.steps.step3.loadInstance.sourceDatabase'),
          description: t(
            'projectExecution.steps.step3.loadInstance.sourceDatabaseDescription',
          ),
          icon: 'mdi-database-outline',
        },
      ]
    : []),
  {
    value: 'file',
    title: t('projectExecution.steps.step3.loadInstance.sourceFile'),
    description: t('projectExecution.steps.step3.loadInstance.sourceFileDescription'),
    icon: 'mdi-file-upload-outline',
  },
])

const selectedSource = ref<DataSource>('file')

watch(sourceOptions, (options) => {
  if (!options.some((option) => option.value === selectedSource.value)) {
    selectedSource.value = 'file'
  }
})

const configFields = computed(
  () => generalStore.appConfig.parameters.configFields || [],
)

const preEtlFields = computed(() =>
  configFields.value.filter((field: any) => field.preEtl === true),
)

/**
 * The parameters the ETL filters the loaded data with are asked for here, next to the
 * upload, rather than in the parameters step further down the wizard: by the time that
 * step is reached the data has already been loaded and filtering it again would mean
 * loading it all over.
 */
const showPreEtlFields = computed(() => preEtlFields.value.length > 0)

/** Serialized pre-ETL values currently in the execution config. */
const currentPreEtlValues = computed(() =>
  JSON.stringify(
    pickPreEtlConfigValues(props.newExecution?.config, configFields.value),
  ),
)

/**
 * A pre-ETL parameter is only mandatory when the config schema's root `required` lists
 * it. A nullable one such as a date is meant to be left blank, which is how the backend
 * is told to resolve it itself.
 */
const preEtlIncomplete = computed(() =>
  preEtlFields.value.some((field: any) => {
    if (!field.required) return false
    const value = props.newExecution?.config?.[field.key]
    if (field.type === 'boolean') return typeof value !== 'boolean'
    return value === null || value === undefined || value === ''
  }),
)

/**
 * True once the user edits a pre-ETL value after having loaded data. The instance is
 * kept -- throwing away a load over a keystroke would be worse -- but the new value
 * does not reach the already loaded data, so the user is told to load again.
 */
const preEtlChangedAfterLoad = computed(
  () =>
    loadedPreEtlValues.value !== null &&
    loadedPreEtlValues.value !== currentPreEtlValues.value,
)

const onPreEtlUpdate = (updated: Record<string, any>) => {
  emit('update:config', updated.config)
}

const showSnackbar =
  inject<(message: string, color?: string) => void>('showSnackbar')

// Computed
const isCheckingSchema = computed(
  () => instanceProcessing.state.value.isProcessing,
)

const canProcess = computed(
  () =>
    selectedFiles.value.length > 0 &&
    instanceProcessing.canProcessFiles.value &&
    !preEtlIncomplete.value,
)

/** The load button of the picked source can run. */
const canLoad = computed(() => {
  if (selectedSource.value === 'database') {
    return !isCheckingSchema.value && !preEtlIncomplete.value
  }
  return canProcess.value
})

const loadButtonLabel = computed(() => {
  if (selectedSource.value === 'database') {
    return t('projectExecution.steps.step3.loadInstance.loadFromDb')
  }
  const label = t('projectExecution.steps.step3.loadInstance.loadInstance')
  const count = selectedFiles.value.length
  if (count === 0) return label
  return `${label} (${count} ${count === 1 ? t('common.file') : t('common.files')})`
})

const loadButtonIcon = computed(() =>
  selectedSource.value === 'database' ? 'mdi-database-arrow-down' : 'mdi-upload-multiple',
)

/** An instance is loaded and the last load left no errors. */
const isLoaded = computed(
  () => Boolean(props.newExecution?.instance) && !instanceErrors.value,
)

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

/** Loads the data from the picked source. */
const loadData = () => {
  if (selectedSource.value === 'database') return processFromDb()
  return processFiles()
}

const processFiles = async () => {
  if (selectedFiles.value.length === 0) {
    return
  }

  resetErrors()

  try {
    const result = await instanceProcessing.processFiles(
      selectedFiles.value,
      props.newExecution?.config,
    )

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
    const result = await instanceProcessing.processFromDb(
      props.newExecution?.config,
    )

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

const handleProcessingSuccess = (
  instance: Instance,
  warning: string | null | undefined = null,
) => {
  loadedPreEtlValues.value = currentPreEtlValues.value
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
.load-instance-warning-body {
  white-space: pre-wrap;
  word-break: break-word;
}

.load-form {
  display: flex;
  flex-direction: column;
  gap: 28px;
}

.load-form__section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.load-form__heading {
  font-size: 0.8125rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--subtitle);
}

/* Same columns as the parameters (CreateExecutionConfigParams, layout "form"). */
.load-form__row {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  align-items: center;
  gap: 16px;
}

.load-form__row--top {
  align-items: start;
}

.load-form__row--wide {
  grid-template-columns: minmax(0, 1fr);
}

.load-form__label {
  font-size: 0.9375rem;
  color: var(--subtitle);
}

.load-form__source {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.load-instance-drop {
  min-height: 220px;
}

.load-form__panel {
  padding: 18px 20px;
  border: 1px dashed #cfd6e0;
  border-radius: 12px;
  background-color: #fafbfc;
}

.load-form__database {
  display: flex;
  align-items: center;
  gap: 14px;
  color: var(--title);
}

.load-form__errors {
  padding: 12px 16px;
  border-radius: 10px;
  background-color: color-mix(in srgb, var(--danger) 6%, #fff);
}

.load-form__changed {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.load-form__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 16px;
}

.load-form__loaded {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  color: var(--success);
}

@media (max-width: 700px) {
  .load-form__row {
    grid-template-columns: minmax(0, 1fr);
    gap: 6px;
  }
}
</style>
