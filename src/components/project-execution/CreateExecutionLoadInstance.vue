<template>
  <div>
    <MDragNDropFile
      multiple
      downloadIcon="mdi-upload"
      :description="
        t('projectExecution.steps.step3.loadInstance.dragAndDropDescription')
      "
      :uploadedFiles="selectedFiles"
      :formatsAllowed="['json', 'xlsx', 'csv']"
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
        :disabled="selectedFiles.length === 0 || isCheckingSchema" 
        @click="processFiles"
        class="load-instance-btn"
        elevation="2"
        large
      >
        <v-icon left>mdi-upload-multiple</v-icon>
        {{ t('projectExecution.steps.step3.loadInstance.loadInstance') }}
        <span class="ml-1" v-if="selectedFiles.length > 0">
          ({{ selectedFiles.length }} {{ selectedFiles.length === 1 ? 'file' : 'files' }})
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
import { ref, watch, inject, onMounted } from 'vue'
import { Instance } from '@/app/models/Instance'
import { useGeneralStore } from '@/stores/general'
import { useI18n } from 'vue-i18n'
import { useFileProcessors } from '@/app/composables/useFileProcessors'

const { t } = useI18n()
const { processFileByPrefix, needsSpecialProcessing } = useFileProcessors()

const props = defineProps({
  instance: {
    type: Instance,
    default: null,
  },
  fileSelected: {
    type: File,
    default: null,
  },
  existingInstanceErrors: {
    type: String,
    default: null,
  },
  newExecution: {
    type: Object,
    default: () => ({}),
  }
})

const emit = defineEmits(['update:existingInstanceErrors', 'fileSelected', 'instanceSelected'])

// State
const selectedFiles = ref([])
const selectedInstance = ref(null)
const instanceErrors = ref(props.existingInstanceErrors)
const store = useGeneralStore()
const showSnackbar = inject('showSnackbar') as ((message: string, color?: string) => void) | undefined
const processedInstances = ref([])
const isCheckingSchema = ref(false)

// Initialize with fileSelected if provided
onMounted(() => {
  if (props.fileSelected) {
    selectedFiles.value = [props.fileSelected]
  }
})

// Watchers
watch(() => props.existingInstanceErrors, (newErrors) => {
  instanceErrors.value = newErrors
}, { immediate: true })

// Methods
const onFileSelected = (files) => {
  // Reset states before processing the new files
  instanceErrors.value = null
  emit('update:existingInstanceErrors', instanceErrors.value)
  
  // Update our files array with what came from the component
  selectedFiles.value = [...files]
}

const processFiles = async () => {
  if (selectedFiles.value.length === 0) {
    return
  }

  try {
    isCheckingSchema.value = true
    processedInstances.value = []
    instanceErrors.value = null
    emit('update:existingInstanceErrors', instanceErrors.value)
      
    // Process each file
    for (const file of selectedFiles.value) {
      const extension = file.name.split('.').pop()
      try {
        const instance = await parseFile(file, extension)
        if (instance) {
          processedInstances.value.push(instance)
        }
      } catch (error) {
        if (showSnackbar) {
          showSnackbar(error.message || error, 'error')
        }
        isCheckingSchema.value = false
        return // Exit immediately on any file processing error
      }
    }
    
    if (processedInstances.value.length === 0) {
      throw new Error(t('projectExecution.steps.step3.loadInstance.noValidInstancesError'))
    }
    
    const finalInstance = processedInstances.value.length > 1 ? await mergeInstances() : processedInstances.value[0]
    selectedInstance.value = finalInstance

    // Validate the instance
    try {
      const errors = await finalInstance.checkSchema()
      if (errors && errors.length > 0) {
        instanceErrors.value = `<p><strong>Merged instance:</strong></p>` + errors
          .map((error) => `<li>${error.instancePath} - ${error.message}</li>`)
          .join('')
        emit('update:existingInstanceErrors', instanceErrors.value)
        if (showSnackbar) {
          showSnackbar(
            t('projectExecution.steps.step3.loadInstance.instanceSchemaError'),
            'error'
          )
        }
        return // Exit if there are validation errors
      }
    } catch (error) {
      console.error('Schema validation error:', error)
      instanceErrors.value = `<p><strong>Error validating instance:</strong></p><li>${error.message}</li>`
      emit('update:existingInstanceErrors', instanceErrors.value)
      if (showSnackbar) {
        showSnackbar(
          t('projectExecution.steps.step3.loadInstance.instanceSchemaError'),
          'error'
        )
      }
      return // Exit if there's an error in validation
    }

    // Only proceed if there are no errors
    emit('instanceSelected', selectedInstance.value)
    instanceErrors.value = null
    emit('update:existingInstanceErrors', instanceErrors.value)
    if (showSnackbar) {
      showSnackbar(
        t('projectExecution.steps.step3.loadInstance.instancesLoaded')
      )
    }
  } catch (error) {
    console.error('Error in processFiles:', error)
    if (showSnackbar) {
      showSnackbar(error.message || error, 'error')
    }
  } finally {
    isCheckingSchema.value = false
  }
}

const parseFile = async (file, extension) => {
  return new Promise((resolve, reject) => {
    const fileReader = new FileReader()
    
    fileReader.onload = async () => {
      try {
        // Check if this file needs special processing based on its filename
        if (needsSpecialProcessing(file.name)) {
          try {
            const specialInstance = await processFileByPrefix(
              file,
              fileReader.result,
              extension,
              store.getSchemaConfig
            )
            
            if (specialInstance) {
              selectedInstance.value = specialInstance
              resolve(specialInstance)
              return
            }
          } catch (processingError) {
            const errorMessage = `<p><strong>${file.name}:</strong> ${processingError.message}</p>`
            instanceErrors.value = errorMessage
            emit('update:existingInstanceErrors', instanceErrors.value)
            reject(new Error(`${file.name}: ${processingError.message}`))
            return
          }
        }
        
        // Standard processing
        const instance = await createInstanceFromData(fileReader.result, extension, file)                
        resolve(instance)
      } catch (error) {
        const errorMessage = `<p><strong>${file.name}:</strong> ${t('projectExecution.steps.step3.loadInstance.unexpectedError')}</p>`
        instanceErrors.value = errorMessage
        emit('update:existingInstanceErrors', instanceErrors.value)
        reject(new Error(`${file.name}: ${t('projectExecution.steps.step3.loadInstance.unexpectedError')}`))
      }
    }
    
    fileReader.onerror = (error) => {
      const errorMessage = t('projectExecution.steps.step3.loadInstance.fileReadError')
      instanceErrors.value = `<p><strong>${file.name}:</strong> ${errorMessage}</p>`
      emit('update:existingInstanceErrors', instanceErrors.value)
      reject(new Error(`${file.name}: ${errorMessage}`))
    }
    
    if (extension === 'xlsx') {
      fileReader.readAsArrayBuffer(file)
    } else {
      fileReader.readAsText(file)
    }
  })
}

const createInstanceFromData = (data, extension, file) => {
  const { Instance } = store.appConfig
  const schemas = store.getSchemaConfig

  if (extension === 'xlsx') {
    return Instance.fromExcel(
      data,
      schemas.instanceSchema,
      store.appConfig.parameters.schema
    )
  } else if (extension === 'json') {
    const jsonData = JSON.parse(data)
    return new Instance(
      null,
      jsonData,
      schemas.instanceSchema,
      schemas.instanceChecksSchema,
      store.appConfig.parameters.schema
    )
  } else if (extension === 'csv') {
    return Instance.fromCsv(
      data,
      file.name,
      schemas.instanceSchema,
      schemas.instanceChecksSchema,
      store.appConfig.parameters.schema
    )
  }
  throw new Error(t('projectExecution.steps.step3.loadInstance.unsupportedFileFormat'))
}

const mergeInstances = async () => {
  try {
    const { Instance } = store.appConfig
    const schemas = store.getSchemaConfig

    // Collect all data from instances to merge
    const allData = processedInstances.value.map(instance => instance.data as Record<string, any>)
    // Merge all instances data - enhance the merging logic
    const mergedData: Record<string, any> = {}
    const allKeys = new Set<string>()
    for (const data of allData) {
      for (const key in data) {
        allKeys.add(key)
      }
    }
    for (const key of allKeys) {
      const values = allData.filter(data => data[key] !== undefined).map(data => data[key])
      if (values.length === 0) {
        continue
      } else if (values.length === 1) {
        mergedData[key] = values[0]
      } else {
        const firstValue = values[0]
        if (Array.isArray(firstValue)) {
          mergedData[key] = values.flat()
        } else if (typeof firstValue === 'object' && firstValue !== null) {
          mergedData[key] = {}
          for (const value of values) {
            if (value && typeof value === 'object') {
              Object.assign(mergedData[key], value)
            }
          }
        } else {
          mergedData[key] = values.find(v => v !== null && v !== undefined) || firstValue
        }
      }
    }
    // Create a new instance with the merged data
    return new Instance(
      null,
      mergedData,
      schemas.instanceSchema,
      schemas.instanceChecksSchema,
      store.appConfig.parameters.schema
    )
  } catch (error) {
    instanceErrors.value =
      (instanceErrors.value && instanceErrors.value.length > 0)
        ? instanceErrors.value
        : t('projectExecution.steps.step3.loadInstance.unexpectedError')
    emit('update:existingInstanceErrors', instanceErrors.value)
    if (showSnackbar) {
      showSnackbar(error.message || error, 'error')
    }
    throw error
  }
}
</script>