<template>
  <div>
    <MDragNDropFile
      multiple
      downloadIcon="mdi-upload"
      :description="
        t('projectExecution.steps.step3.loadInstance.dragAndDropDescription')
      "
      :uploadedFiles="selectedFiles"
      :formatsAllowed="instanceProcessing.supportedExtensions.value"
      :errors="instanceErrors"
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
          {{ selectedFiles.length === 1 ? 'file' : 'files' }})
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
import { ref, watch, inject, onMounted, computed } from 'vue'
import { Instance } from '@/app/models/Instance'
import { useI18n } from 'vue-i18n'
import { useInstanceProcessing } from '@/composables/useInstanceProcessing'

const { t } = useI18n()
const instanceProcessing = useInstanceProcessing()

const props = defineProps({
  instance: {
    type: Instance,
    default: null,
  },
  selectedFiles: {
    type: Array,
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

const emit = defineEmits([
  'update:existingInstanceErrors',
  'filesSelected',
  'instanceSelected',
])

// State
const selectedFiles = ref<File[]>(props.selectedFiles || [])
const selectedInstance = ref<Instance | null>(null)
const instanceErrors = ref<string | null>(props.existingInstanceErrors)

const showSnackbar = inject('showSnackbar') as
  | ((message: string, color?: string) => void)
  | undefined

// Computed
const isCheckingSchema = computed(
  () => instanceProcessing.state.value.isProcessing,
)
const canProcess = computed(
  () =>
    selectedFiles.value.length > 0 && instanceProcessing.canProcessFiles.value,
)

// Initialize with selectedFiles if provided
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
  },
  { immediate: true },
)

// Methods
const onFileSelected = (files: File[]) => {
  // Reset states before processing the new files
  resetErrors()
  instanceProcessing.resetState()

  // Update our files array with what came from the component
  selectedFiles.value = [...files]
  // Emit the files to the parent component
  emit('filesSelected', selectedFiles.value)
}

const processFiles = async () => {
  if (selectedFiles.value.length === 0) {
    return
  }

  // Reset errors before processing
  resetErrors()

  try {
    const result = await instanceProcessing.processFiles(selectedFiles.value)

    if (result.success && result.instance) {
      // Success case
      selectedInstance.value = result.instance
      emit('instanceSelected', selectedInstance.value)

      if (showSnackbar) {
        showSnackbar(
          t('projectExecution.steps.step3.loadInstance.instancesLoaded'),
        )
      }
    } else if (result.errors) {
      // Error case
      handleProcessingError(result.errors)
    }
  } catch (error) {
    console.error('Error in processFiles:', error)
    handleProcessingError(error.message || String(error))
  }
}

const handleProcessingError = (errorMessage: string) => {
  instanceErrors.value = errorMessage
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
  emit('update:existingInstanceErrors', instanceErrors.value)
}
</script>
