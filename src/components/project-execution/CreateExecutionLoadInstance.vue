<template>
  <div>
    <MDragNDropFile
      ref="dragDropFileRef"
      multiple
      downloadIcon="mdi-upload"
      :description="
        t('projectExecution.steps.step3.loadInstance.dragAndDropDescription')
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
          {{ selectedFiles.length === 1 ? t('common.file') : t('common.files') }})
        </span>
      </v-btn>
    </div>

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
import { useInstanceProcessing } from '@/composables/useInstanceProcessing'
import { useErrorDownload } from '@/composables/useErrorDownload'
import { formatValidationErrors } from '@/utils/errorFormatting'
import type { ErrorObject } from 'ajv'

// Composables
const { t } = useI18n()
const instanceProcessing = useInstanceProcessing()
const errorDownload = useErrorDownload()

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
}>()

// State
const selectedFiles = ref<File[]>(props.selectedFiles || [])
const selectedInstance = ref<Instance | null>(null)
const instanceErrors = ref<string | null>(props.existingInstanceErrors)
const rawErrors = ref<ErrorObject[] | null>(null)
const dragDropFileRef = ref<any>(null)

const showSnackbar = inject<(message: string, color?: string) => void>(
  'showSnackbar',
)

// Computed
const isCheckingSchema = computed(
  () => instanceProcessing.state.value.isProcessing,
)

const canProcess = computed(
  () =>
    selectedFiles.value.length > 0 && instanceProcessing.canProcessFiles.value,
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
  `.replace(/\s+/g, ' ').trim()
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
    if (newFiles && newFiles.length > 0) {
      selectedFiles.value = [...newFiles]
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
      handleProcessingSuccess(result.instance)
    } else if (result.errors) {
      handleProcessingError(result.errors, result.rawErrors)
    }
  } catch (error) {
    console.error('Error in processFiles:', error)
    const errorMessage =
      error instanceof Error ? error.message : String(error)
    handleProcessingError(errorMessage, null)
  }
}

const handleProcessingSuccess = (instance: Instance) => {
  selectedInstance.value = instance
  emit('instanceSelected', instance)

  if (showSnackbar) {
    showSnackbar(
      t('projectExecution.steps.step3.loadInstance.instancesLoaded'),
    )
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
  emit('update:existingInstanceErrors', instanceErrors.value)
}
</script>