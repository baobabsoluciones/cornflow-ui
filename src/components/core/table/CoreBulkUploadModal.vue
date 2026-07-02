<!--
/**
 * CoreBulkUploadModal component
 *
 * A reusable bulk upload modal component that maintains consistent look and feel with CoreModal and CoreConfirmDialog.
 *
 * Features:
 * - Consistent header styling with close button
 * - File upload with drag & drop support
 * - File format validation
 * - Progress indication
 * - Loading states
 * - Responsive layout
 * - i18n support
 *
 * Props:
 * - modelValue (Boolean): Controls modal visibility
 * - title (String): Modal title
 * - acceptedFormats (Array): Array of accepted file extensions
 * - loading (Boolean): Loading state for upload button
 * - multiple (Boolean): Allow multiple file selection
 * - maxSize (Number): Maximum file size in bytes
 * - availableOperations (Array): Available bulk operations ['post_update_bulk', 'post_bulk', 'overwrite_all']
 *
 * Usage examples:
 *
 * Basic usage:
 * <CoreBulkUploadModal
 *   v-model="showUploadModal"
 *   title="Bulk Upload"
 *   :accepted-formats="['.xlsx', '.json', '.csv']"
 *   :available-operations="['post_bulk', 'overwrite_all']"
 *   :loading="uploading"
 *   @upload="handleUpload"
 *   @cancel="handleCancel"
 * />
 *
 * With custom settings:
 * <CoreBulkUploadModal
 *   v-model="showUploadModal"
 *   title="Import Data"
 *   :accepted-formats="['.csv', '.json']"
 *   :loading="uploading"
 *   :multiple="false"
 *   :max-size="5242880"
 *   @upload="handleUpload"
 *   @cancel="handleCancel"
 * />
 *
 * Events:
 * - @upload: Emitted when upload button is clicked with selected files
 * - @cancel: Emitted when cancel button is clicked or modal is closed
 * - @update:modelValue: Emitted when modal visibility changes
 */
-->

<template>
  <v-dialog
    :model-value="modelValue && modelValue === true"
    @update:model-value="emit('update:modelValue', $event)"
    max-width="520px"
    persistent
    class="core-bulk-upload-modal"
  >
    <v-card class="core-modal-base__card core-bulk-upload-modal__card">
      <!-- Header -->
      <v-card-title
        class="core-modal-base__header core-bulk-upload-modal__header"
      >
        <span class="core-modal-base__title core-bulk-upload-modal__title">{{
          title
        }}</span>
        <v-btn
          icon="mdi-close"
          variant="text"
          size="small"
          class="core-modal-base__close core-bulk-upload-modal__close"
          @click="handleCancel"
        />
      </v-card-title>

      <!-- Content -->
      <v-card-text
        class="core-modal-base__content core-bulk-upload-modal__content"
      >
        <!-- Operation Selection -->
        <div
          v-if="showOperationSelection"
          class="core-bulk-upload-modal__operation-section"
          :class="{ 'core-bulk-upload-modal__operation-section--disabled': loading }"
        >
          <div class="core-bulk-upload-modal__options-list">
            <div
              v-if="availableOperations.includes('post_update_bulk')"
              class="core-bulk-upload-modal__option-card"
              :class="{
                'core-bulk-upload-modal__option-card--selected':
                  selectedOperation === 'post_update_bulk',
              }"
              @click="!loading && (selectedOperation = 'post_update_bulk')"
            >
              <v-checkbox
                :model-value="selectedOperation === 'post_update_bulk'"
                hide-details
                class="core-bulk-upload-modal__option-checkbox"
              />
              <div class="core-bulk-upload-modal__option-content">
                <div
                  class="core-bulk-upload-modal__option-title core-bulk-upload-modal__option-title-row"
                >
                  <span>{{ $t('table.updateMode') }}</span>
                  <v-chip
                    size="x-small"
                    color="primary"
                    variant="tonal"
                    class="core-bulk-upload-modal__recommended-chip"
                  >
                    {{ $t('table.recommended') }}
                  </v-chip>
                </div>
                <div class="core-bulk-upload-modal__option-description">
                  {{ $t('table.updateModeDescription') }}
                </div>
              </div>
            </div>

            <div
              v-if="availableOperations.includes('post_bulk')"
              class="core-bulk-upload-modal__option-card"
              :class="{
                'core-bulk-upload-modal__option-card--selected':
                  selectedOperation === 'post_bulk',
              }"
              @click="!loading && (selectedOperation = 'post_bulk')"
            >
              <v-checkbox
                :model-value="selectedOperation === 'post_bulk'"
                hide-details
                class="core-bulk-upload-modal__option-checkbox"
              />
              <div class="core-bulk-upload-modal__option-content">
                <div class="core-bulk-upload-modal__option-title">
                  {{ $t('table.addMode') }}
                </div>
                <div class="core-bulk-upload-modal__option-description">
                  {{ $t('table.addModeDescription') }}
                </div>
              </div>
            </div>

            <div
              v-if="availableOperations.includes('overwrite_all')"
              class="core-bulk-upload-modal__option-card"
              :class="{
                'core-bulk-upload-modal__option-card--selected':
                  selectedOperation === 'overwrite_all',
              }"
              @click="!loading && (selectedOperation = 'overwrite_all')"
            >
              <v-checkbox
                :model-value="selectedOperation === 'overwrite_all'"
                hide-details
                class="core-bulk-upload-modal__option-checkbox"
              />
              <div class="core-bulk-upload-modal__option-content">
                <div class="core-bulk-upload-modal__option-title">
                  {{ $t('table.overwriteMode') }}
                </div>
                <div class="core-bulk-upload-modal__option-description">
                  {{ $t('table.overwriteModeDescription') }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- File Input (only show after operation is selected or if no operation selection) -->
        <transition name="slide-down">
          <div
            v-if="!showOperationSelection || selectedOperation"
            class="core-bulk-upload-modal__upload-section"
          >
            <v-file-input
              :model-value="fileInputModelValue"
              :label="
                multiple ? $t('table.selectFiles') : $t('table.selectFile')
              "
              :accept="acceptedFormatsString"
              :multiple="multiple"
              :counter="multiple"
              variant="outlined"
              density="compact"
              focused
              show-size
              class="core-bulk-upload-modal__file-input"
              @update:model-value="handleFileInputUpdate"
            >
              <template v-slot:selection="{ fileNames }">
                <template v-for="fileName in fileNames" :key="fileName">
                  <v-chip size="small" label color="primary" class="me-2 mb-1">
                    {{ fileName }}
                  </v-chip>
                </template>
              </template>
            </v-file-input>
            <p
              v-if="multiple"
              class="text-caption text-medium-emphasis mt-1 mb-0"
            >
              {{ $t('table.multipleFileAccumulateHint') }}
            </p>

            <!-- File Information -->
            <div
              v-if="normalizedSelectedFiles.length > 0"
              class="core-bulk-upload-modal__file-info"
            >
              <div
                v-for="file in normalizedSelectedFiles"
                :key="`${file.name}-${file.size}-${file.lastModified}`"
                class="core-bulk-upload-modal__file-item"
              >
                <v-icon
                  :icon="getFileIcon(file.name)"
                  size="small"
                  class="me-2"
                  color="primary"
                />
                <span class="core-bulk-upload-modal__file-name">{{
                  file.name
                }}</span>
                <v-spacer />
                <span class="core-bulk-upload-modal__file-size">
                  {{ formatFileSize(file.size) }}
                </span>
                <v-btn
                  icon="mdi-close"
                  variant="text"
                  size="x-small"
                  class="ml-2"
                  @click="removeFile(file)"
                />
              </div>
            </div>

            <!-- Upload Info -->
            <v-alert
              type="info"
              variant="tonal"
              class="core-bulk-upload-modal__info-alert"
            >
              <div class="core-bulk-upload-modal__info-content">
                <div>
                  <div class="mb-1">
                    <span class="core-bulk-upload-modal__info-label">
                      {{ $t('table.supportedFormats') }}:
                    </span>
                    <span class="core-bulk-upload-modal__info-value">
                      {{ acceptedFormatsString }}
                    </span>
                  </div>
                  <div v-if="maxSize != null && maxSize > 0">
                    <span class="core-bulk-upload-modal__info-label">
                      {{ $t('table.maxFileSize') }}:
                    </span>
                    <span class="core-bulk-upload-modal__info-value">
                      {{ formatFileSize(maxSize) }}
                    </span>
                  </div>
                </div>
              </div>
            </v-alert>

            <!-- Loading state during overwrite/upload -->
            <div
              v-if="loading"
              class="core-bulk-upload-modal__loading-state mt-3"
            >
              <v-progress-circular
                indeterminate
                color="primary"
                size="24"
                width="3"
                class="core-bulk-upload-modal__loading-spinner"
              />
              <span class="core-bulk-upload-modal__loading-text">
                {{ progressMessage || $t('table.uploadingPleaseWait') }}
              </span>
            </div>
          </div>
        </transition>

        <!-- Error Messages -->
        <v-alert
          v-if="errorMessage"
          type="error"
          variant="tonal"
          class="core-bulk-upload-modal__error-alert"
        >
          {{ errorMessage }}
        </v-alert>
      </v-card-text>

      <!-- Actions -->
      <v-card-actions
        class="core-modal-base__actions core-bulk-upload-modal__actions"
      >
        <v-spacer />
        <CoreButton
          :text="$t('table.cancel')"
          variant="text"
          color="grey"
          size="small"
          @click="handleCancel"
        />
        <CoreButton
          :text="$t('table.upload')"
          variant="filled"
          color="primary"
          size="small"
          :loading="loading"
          :disabled="!hasValidFiles || loading"
          @click="handleUpload"
        />
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import CoreButton from '@cornflow-ui/core/components/core/CoreButton.vue'

// Types
interface BulkUploadData {
  files: File[]
  operation: string
}

interface Props {
  modelValue: boolean
  title?: string
  acceptedFormats?: string[]
  loading?: boolean
  multiple?: boolean
  maxSize?: number
  availableOperations?: string[]
  /** Live progress text shown in the loading state (e.g. async upload status + rows loaded). */
  progressMessage?: string
}

// Props
const props = withDefaults(defineProps<Props>(), {
  title: 'Bulk Upload',
  acceptedFormats: () => ['.xlsx', '.json', '.csv'],
  loading: false,
  multiple: false,
  maxSize: 0, // 0 = no client-side limit (server has no limit)
  availableOperations: () => ['post_bulk'],
  progressMessage: '',
})

// Emits
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  upload: [data: BulkUploadData]
  cancel: []
}>()

// Composables
const { t: $t } = useI18n()

/** Possible shapes of a v-file-input model value. */
type FileInput = File[] | File | FileList

/** Normalize v-file-input model (File | File[] | FileList) to a File array. */
function toFileArray(
  value: File[] | File | FileList | null | undefined,
): File[] {
  if (value == null) return []
  if (Array.isArray(value)) {
    return value.filter((f): f is File => f instanceof File)
  }
  if (value instanceof FileList) return Array.from(value)
  if (value instanceof File) return [value]
  return []
}

/** Merge new picker result into existing list (dedupe by name + size + lastModified). */
function mergeUniqueFiles(existing: File[], incoming: File[]): File[] {
  const map = new Map<string, File>()
  const key = (f: File) => `${f.name}\0${f.size}\0${f.lastModified}`
  for (const f of existing) map.set(key(f), f)
  for (const f of incoming) map.set(key(f), f)
  return [...map.values()]
}

// State
const selectedFiles = ref<File[] | File | FileList | null>(null)
const errorMessage = ref('')
const selectedOperation = ref<string | null>(null)

// Computed
const acceptedFormatsString = computed(() => {
  return props.acceptedFormats.join(', ')
})

const normalizedSelectedFiles = computed(() =>
  toFileArray(selectedFiles.value),
)

/** Bound value for v-file-input (Vuetify expects File[] when multiple). */
const fileInputModelValue = computed(() => {
  if (props.multiple) {
    return normalizedSelectedFiles.value
  }
  return selectedFiles.value instanceof File ? selectedFiles.value : null
})

function handleFileInputUpdate(
  val: File | File[] | FileList | null | undefined,
) {
  if (!props.multiple) {
    if (val == null) {
      selectedFiles.value = null
      return
    }
    const arr = toFileArray(val as FileInput)
    selectedFiles.value = arr[0] ?? null
    return
  }
  const incoming = toFileArray(val as FileInput)
  if (incoming.length === 0) {
    selectedFiles.value = []
    return
  }
  const existing = toFileArray(selectedFiles.value)
  selectedFiles.value = mergeUniqueFiles(existing, incoming)
}

const hasValidFiles = computed(() => {
  const hasFiles = normalizedSelectedFiles.value.length > 0
  const noError = !errorMessage.value
  const hasOperation = !showOperationSelection.value || selectedOperation.value

  return hasFiles && noError && hasOperation
})

const showOperationSelection = computed(() => {
  return props.availableOperations.length > 1
})

const defaultOperation = computed(() => {
  return props.availableOperations[0] || 'post_bulk'
})

// Methods
const initializeDefaultOperation = () => {
  if (props.availableOperations && props.availableOperations.length > 0) {
    // Only set default operation if there's no operation selection available
    // If there are multiple operations, user must select one explicitly
    if (!showOperationSelection.value && !selectedOperation.value) {
      selectedOperation.value = defaultOperation.value
    }
  }
}

const forceInitializeOperation = () => {
  // Force set the default operation regardless of current state
  if (props.availableOperations && props.availableOperations.length > 0) {
    selectedOperation.value = defaultOperation.value
  }
}

const normalizeToFileArray = (files: FileInput): File[] | null => {
  if (Array.isArray(files)) return files
  if (files instanceof FileList) return Array.from(files)
  if (typeof files === 'object' && (files as any).name) return [files as File]
  if (typeof files === 'object' && Object.keys(files).length === 0) return null
  return []
}

const validateSingleFile = (file: File): boolean => {
  if (!file || !file.name) return true

  if (props.maxSize != null && props.maxSize > 0 && file.size > props.maxSize) {
    errorMessage.value = `${file.name} exceeds maximum file size of ${formatFileSize(props.maxSize)}`
    selectedFiles.value = props.multiple ? [] : null
    return false
  }

  const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase()
  if (!props.acceptedFormats.includes(fileExtension)) {
    errorMessage.value = `${file.name} is not a supported file format. Supported formats: ${acceptedFormatsString.value}`
    selectedFiles.value = props.multiple ? [] : null
    return false
  }

  return true
}

const validateFiles = (files: File[] | File | FileList | null) => {
  errorMessage.value = ''

  if (!files) {
    return
  }

  // Handle different file formats
  const fileArray = normalizeToFileArray(files)
  if (fileArray === null) return

  // Validate files
  for (const file of fileArray) {
    if (!validateSingleFile(file)) return
  }
}

const removeFile = (fileToRemove: File) => {
  if (selectedFiles.value == null) return
  const current = toFileArray(selectedFiles.value)
  const updatedFiles = current.filter((file: File) => file !== fileToRemove)
  if (updatedFiles.length === 0) {
    selectedFiles.value = props.multiple ? [] : null
  } else {
    selectedFiles.value = props.multiple ? updatedFiles : updatedFiles[0]!
  }
}

const getFileIcon = (fileName: string): string => {
  const extension = fileName.split('.').pop()?.toLowerCase()
  switch (extension) {
    case 'xlsx':
    case 'xls':
      return 'mdi-file-excel'
    case 'csv':
      return 'mdi-file-delimited'
    case 'json':
      return 'mdi-code-json'
    case 'pdf':
      return 'mdi-file-pdf-box'
    default:
      return 'mdi-file-document'
  }
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const handleUpload = () => {
  if (hasValidFiles.value) {
    const operation = selectedOperation.value || defaultOperation.value
    const actualFiles = toFileArray(selectedFiles.value)

    emit('upload', {
      files: actualFiles,
      operation: operation,
    })
  }
}

const handleCancel = () => {
  emit('cancel')
  emit('update:modelValue', false)
}

// Watchers
watch(
  () => props.modelValue,
  (newValue) => {
    if (newValue) {
      // When modal opens, force set default operation with a small delay
      nextTick(() => {
        forceInitializeOperation()
        if (props.multiple && selectedFiles.value == null) {
          selectedFiles.value = []
        }
      })
    } else {
      // Reset when modal is closed
      selectedFiles.value = props.multiple ? [] : null
      errorMessage.value = ''
      selectedOperation.value = null
    }
  },
)

watch(
  () => props.availableOperations,
  () => {
    // Set default operation when operations change
    nextTick(() => {
      initializeDefaultOperation()
    })
  },
  { immediate: true },
)

watch(selectedFiles, (newFiles) => {
  validateFiles(newFiles)
})

// Lifecycle
onMounted(() => {
  initializeDefaultOperation()
})
</script>

<style>
@import '@cornflow-ui/core/assets/styles/components/core/CoreModalBase.css';
@import '@cornflow-ui/core/assets/styles/components/core/CoreBulkUploadModal.css';
</style>
