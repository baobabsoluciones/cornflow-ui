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
        :disabled="selectedFiles.length === 0" 
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
  
  </div>
</template>

<script setup>
import { ref, watch, inject, computed, onMounted, defineProps, defineEmits } from 'vue'
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
const selectedFile = ref(null)
const selectedFiles = ref([])
const selectedInstance = ref(null)
const instanceErrors = ref(props.existingInstanceErrors)
const store = useGeneralStore()
const showSnackbar = inject('showSnackbar')
const processedInstances = ref([])

// Initialize with fileSelected if provided
onMounted(() => {
  if (props.fileSelected) {
    selectedFile.value = props.fileSelected
    selectedFiles.value = [props.fileSelected]
  }
})

// Watchers
watch(() => props.fileSelected, (newFile) => {
  if (!newFile) {
    selectedFile.value = null
    return
  }
  
  selectedFile.value = newFile
  // Don't update selectedFiles here as it's handled by onFileSelected
}, { immediate: true })

watch(() => props.existingInstanceErrors, (newErrors) => {
  instanceErrors.value = newErrors
}, { immediate: true })

// Methods
const removeFile = (index) => {
  selectedFiles.value.splice(index, 1)
  if (selectedFiles.value.length > 0) {
    selectedFile.value = selectedFiles.value[selectedFiles.value.length - 1]
  } else {
    selectedFile.value = null
  }
}

const onFileSelected = (files) => {
  // Reset states before processing the new files
  instanceErrors.value = null
  emit('update:existingInstanceErrors', instanceErrors.value)
  
  // Update our files array with what came from the component
  selectedFiles.value = [...files]
  
  // Set the selectedFile to the last file for backward compatibility
  if (files.length > 0) {
    selectedFile.value = files[files.length - 1]
  } else {
    selectedFile.value = null
  }
  
  // For backward compatibility
  emit('fileSelected', selectedFile.value)
}

const parseFile = async (file, extension, skipValidation = false) => {
  return new Promise((resolve, reject) => {
    var fileReader = new FileReader()
    fileReader.onload = async () => {
      try {
        const { Instance } = store.appConfig
        const schemas = store.getSchemaConfig
        
        // Check if the schema exists
        if (schemas.instanceSchema == null) {
          throw new Error(
            t('projectExecution.steps.step3.loadInstance.noSchemaError')
          )
        }
        
        // Check if this file needs special processing based on its filename
        if (needsSpecialProcessing(file.name)) {
          try {
            // Process the file with a special processor
            const specialInstance = await processFileByPrefix(
              file,
              fileReader.result,
              extension,
              schemas
            )
            
            if (specialInstance) {
              resolve(specialInstance)
              return
            }
          } catch (processingError) {
            console.error(`Error in special processing for ${file.name}:`, processingError)
            // If special processing fails, continue with standard processing
          }
        }
        
        // Standard processing
        let instance
        
        if (extension === 'xlsx') {
          instance = await Instance.fromExcel(
            fileReader.result,
            schemas.instanceSchema,
            schemas.name,
          )
        } else if (extension === 'json') {
          const jsonData = JSON.parse(fileReader.result)
          instance = new Instance(
            null,
            jsonData,
            schemas.instanceSchema,
            schemas.instanceChecksSchema,
            schemas.name,
          )
        } else if (extension === 'csv') {
          instance = await Instance.fromCsv(
            fileReader.result,
            file.name,
            schemas.instanceSchema,
            schemas.instanceChecksSchema,
            schemas.name,
          )
        }
        
        // Skip schema validation if we're processing multiple files
        if (!skipValidation) {
          const errors = instance.checkSchema()
          
          if (errors && errors.length > 0) {
            instanceErrors.value = `<p><strong>${file.name}:</strong></p>` + errors
              .map((error) => `<li>${error.instancePath} - ${error.message}</li>`)
              .join('')
            emit('update:existingInstanceErrors', instanceErrors.value)
            throw new Error(
              t('projectExecution.steps.step3.loadInstance.instanceSchemaError')
            )
          }
        }
        
        resolve(instance)
      } catch (error) {
        if (!skipValidation) {
          instanceErrors.value =
            (instanceErrors.value && instanceErrors.value.length > 0)
              ? instanceErrors.value
              : `<p><strong>${file.name}:</strong> ${t('projectExecution.steps.step3.loadInstance.unexpectedError')}</p>`
          emit('update:existingInstanceErrors', instanceErrors.value)
        }
        reject(error)
      }
    }
    fileReader.onerror = reject
    if (extension === 'xlsx') {
      fileReader.readAsArrayBuffer(file)
    } else {
      fileReader.readAsText(file)
    }
  })
}

// Keep this just for backward compatibility
const readFile = async (file, extension) => {
  return parseFile(file, extension, false).then(instance => ({ instance }))
}

const mergeInstances = async () => {
  try {
    const { Instance } = store.appConfig
    const schemas = store.getSchemaConfig
    
    // Reset instance errors before merging
    instanceErrors.value = null
    emit('update:existingInstanceErrors', instanceErrors.value)
    
    // Collect all data from instances to merge
    const allData = processedInstances.value.map(instance => instance.data)
    
    // Merge all instances data - enhance the merging logic
    const mergedData = {}
    
    // First pass: collect all keys from all instances
    const allKeys = new Set()
    for (const data of allData) {
      for (const key in data) {
        allKeys.add(key)
      }
    }
    
    // Second pass: merge data for each key
    for (const key of allKeys) {
      // Collect all values for this key
      const values = allData
        .filter(data => data[key] !== undefined)
        .map(data => data[key])
      
      if (values.length === 0) {
        continue
      } else if (values.length === 1) {
        // If only one instance has this key, use its value
        mergedData[key] = values[0]
      } else {
        // If multiple instances have this key, merge based on type
        const firstValue = values[0]
        
        if (Array.isArray(firstValue)) {
          // Merge arrays
          mergedData[key] = values.flat()
        } else if (typeof firstValue === 'object' && firstValue !== null) {
          // Merge objects recursively
          mergedData[key] = {}
          for (const value of values) {
            if (value && typeof value === 'object') {
              Object.assign(mergedData[key], value)
            }
          }
        } else {
          // For primitive values, use the first non-null value
          mergedData[key] = values.find(v => v !== null && v !== undefined) || firstValue
        }
      }
    }
    
    // Create a new instance with the merged data
    const mergedInstance = new Instance(
      null,
      mergedData,
      schemas.instanceSchema,
      schemas.instanceChecksSchema,
      schemas.name
    )
    
    // Validate the merged instance
    const errors = mergedInstance.checkSchema()
    if (errors && errors.length > 0) {
      instanceErrors.value = `<p><strong>Merged instance:</strong></p>` + errors
        .map((error) => `<li>${error.instancePath} - ${error.message}</li>`)
        .join('')
      emit('update:existingInstanceErrors', instanceErrors.value)
      throw new Error(
        t('projectExecution.steps.step3.loadInstance.instanceSchemaError')
      )
    }
    
    // Set as selected instance and notify parent
    selectedInstance.value = mergedInstance
    emit('instanceSelected', selectedInstance.value)
    instanceErrors.value = null
    emit('update:existingInstanceErrors', instanceErrors.value)
    showSnackbar(
      t('projectExecution.steps.step3.loadInstance.instancesLoaded')
    )
  } catch (error) {
    instanceErrors.value =
      (instanceErrors.value && instanceErrors.value.length > 0)
        ? instanceErrors.value
        : t('projectExecution.steps.step3.loadInstance.unexpectedError')
    emit('update:existingInstanceErrors', instanceErrors.value)
    showSnackbar(error.message || error, 'error')
    throw error
  }
}

const processFiles = async () => {
  if (selectedFiles.value.length === 0) {
    return
  }

  try {
    processedInstances.value = []
    instanceErrors.value = null
    emit('update:existingInstanceErrors', instanceErrors.value)
    
    const isMultipleFiles = selectedFiles.value.length > 1
    
    // Process each file
    for (const file of selectedFiles.value) {
      const extension = file.name.split('.').pop()
      try {
        // Skip schema validation for individual files when we have multiple files
        const instance = await parseFile(file, extension, isMultipleFiles)
        if (instance) {
          processedInstances.value.push(instance)
        }
      } catch (error) {
        // If error occurs during file processing, but we have other files, continue
        console.error(`Error processing file ${file.name}:`, error)
        
        // Only show errors for individual files if we're not processing multiple files
        if (!isMultipleFiles) {
          showSnackbar(error.message || error, 'error')
          return // Exit early if single file processing fails
        }
      }
    }
    
    if (processedInstances.value.length === 0) {
      throw new Error(t('projectExecution.steps.step3.loadInstance.noValidInstancesError'))
    }
    
    // Merge instances if there are multiple
    if (processedInstances.value.length > 1) {
      await mergeInstances()
    } else if (processedInstances.value.length === 1) {
      // If only one instance, validate and use it directly
      const instance = processedInstances.value[0]
      
      // Only validate schema if we didn't already do it during parsing
      if (isMultipleFiles) {
        const schemas = store.getSchemaConfig
        const errors = instance.checkSchema()
        
        if (errors && errors.length > 0) {
          instanceErrors.value = errors
            .map((error) => `<li>${error.instancePath} - ${error.message}</li>`)
            .join('')
          emit('update:existingInstanceErrors', instanceErrors.value)
          throw new Error(
            t('projectExecution.steps.step3.loadInstance.instanceSchemaError')
          )
        }
      }
      
      selectedInstance.value = instance
      emit('instanceSelected', selectedInstance.value)
      showSnackbar(
        t('projectExecution.steps.step3.loadInstance.instanceLoaded'),
      )
    }
  } catch (error) {
    showSnackbar(error.message || error, 'error')
  }
}
</script>
