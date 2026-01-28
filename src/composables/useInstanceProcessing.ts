/**
 * Composable for processing instance files with improved architecture
 * Handles ETL backend decisions, file processing, and instance merging
 */

import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGeneralStore } from '@/stores/general'
import { useFileProcessors } from '@/app/composables/useFileProcessors'
import { Instance } from '@/app/models/Instance'
import {
  formatValidationErrorsWithTitle,
  formatErrorDetails,
  ValidationError,
} from '@/utils/errorFormatting'
import type { ErrorObject } from 'ajv'
import {
  FILE_EXTENSIONS,
  SUPPORTED_DATA_EXTENSIONS,
  isExcelExtension,
  getFileExtension,
} from '@/utils/fileConstants'

export interface ProcessingResult {
  instance: Instance | null
  errors: string | null
  rawErrors: ErrorObject[] | null
  success: boolean
}

export interface ProcessingState {
  isProcessing: boolean
  processedInstances: Instance[]
  errors: string | null
}

export function useInstanceProcessing() {
  const { t } = useI18n()
  const store = useGeneralStore()
  const { processFileByPrefix, needsSpecialProcessing } = useFileProcessors()

  // State
  const state = ref<ProcessingState>({
    isProcessing: false,
    processedInstances: [],
    errors: null,
  })

  // Computed
  const supportedExtensions = computed(() => SUPPORTED_DATA_EXTENSIONS)
  const canProcessFiles = computed(() => !state.value.isProcessing)

  /**
   * Main processing function that handles both ETL backend and frontend processing
   */
  const processFiles = async (files: File[]): Promise<ProcessingResult> => {
    if (files.length === 0) {
      return createErrorResult(
        t('projectExecution.steps.step3.loadInstance.noFilesSelectedError'),
        null,
      )
    }

    state.value.isProcessing = true
    state.value.processedInstances = []
    state.value.errors = null

    try {
      // Check if ETL backend should be used BEFORE processing any files
      if (store.appConfig.parameters.useEtlBackend) {
        return await processWithEtlBackend(files)
      } else {
        return await processWithFrontend(files)
      }
    } catch (error) {
      console.error('Error in processFiles:', error)
      return createErrorResult(error.message || String(error), null)
    } finally {
      state.value.isProcessing = false
    }
  }

  /**
   * Process files using ETL backend - no individual file processing needed
   */
  const processWithEtlBackend = async (
    files: File[],
  ): Promise<ProcessingResult> => {
    try {
      const mergedData = await store.useEtlBackend(files)
      const schemas = store.getSchemaConfig
      const instance = new Instance(
        null,
        mergedData,
        schemas.instanceSchema,
        schemas.instanceChecksSchema,
        store.appConfig.parameters.schema,
      )

      // Validate the merged instance
      const validationResult = await validateInstance(
        instance,
        'ETL Backend processed instance',
      )
      if (!validationResult.success) {
        return validationResult
      }

      return createSuccessResult(instance)
    } catch (error) {
      console.error('ETL Backend processing error:', error)
      return createErrorResult(
        formatErrorDetails(
          'Error',
          [{ instancePath: '', message: error.message }],
          t('projectExecution.steps.step3.loadInstance.unexpectedError'),
          t,
        ),
        null,
      )
    }
  }

  /**
   * Process files using frontend logic
   */
  const processWithFrontend = async (
    files: File[],
  ): Promise<ProcessingResult> => {
    try {
      // Process each file individually
      for (const file of files) {
        const result = await processIndividualFile(file)
        if (!result.success) {
          return result // Return immediately on any file processing error
        }
        if (result.instance) {
          state.value.processedInstances.push(result.instance)
        }
      }

      if (state.value.processedInstances.length === 0) {
        return createErrorResult(
          t('projectExecution.steps.step3.loadInstance.noValidInstancesError'),
          null,
        )
      }

      // Merge instances
      const mergedInstance = await mergeInstances(
        state.value.processedInstances,
      )
      if (!mergedInstance) {
        return createErrorResult(
          t('projectExecution.steps.step3.loadInstance.mergingError'),
          null,
        )
      }

      // Validate the merged instance
      const validationResult = await validateInstance(
        mergedInstance,
        'Merged instance',
      )
      if (!validationResult.success) {
        return validationResult
      }

      return createSuccessResult(mergedInstance)
    } catch (error) {
      console.error('Frontend processing error:', error)
      return createErrorResult(error.message || String(error), null)
    }
  }

  /**
   * Process a single file
   */
  const processIndividualFile = async (
    file: File,
  ): Promise<ProcessingResult> => {
    const extension = getFileExtension(file.name)

    try {
      const fileContent = await readFile(file, extension)

      // Check if this file needs special processing
      if (needsSpecialProcessing(file.name)) {
        const specialInstance = await processFileByPrefix(
          file,
          fileContent,
          extension,
          store.getSchemaConfig,
        )

        if (specialInstance) {
          return createSuccessResult(specialInstance)
        }
      }

      // Standard processing
      const instance = createInstanceFromData(
        fileContent,
        extension,
        file,
      )
      return createSuccessResult(instance)
    } catch (error) {
      console.error(`Error processing file ${file.name}:`, error)
      // Format error message - if it's already HTML formatted, use it directly
      // Otherwise, format it as a file processing error
      const errorMessage = error.message || String(error)
      const formattedError = formatErrorDetails(
        file.name,
        [{ instancePath: '', message: errorMessage }],
        errorMessage,
        t,
      )
      return createErrorResult(formattedError, null)
    }
  }

  /**
   * Read file content based on extension
   */
  const readFile = (
    file: File,
    extension: string,
  ): Promise<string | ArrayBuffer> => {
    return new Promise((resolve, reject) => {
      const fileReader = new FileReader()

      fileReader.onload = () => resolve(fileReader.result!)
      fileReader.onerror = () =>
        reject(
          new Error(
            t('projectExecution.steps.step3.loadInstance.fileReadError'),
          ),
        )

      if (extension === FILE_EXTENSIONS.XLSX) {
        fileReader.readAsArrayBuffer(file)
      } else {
        fileReader.readAsText(file)
      }
    })
  }

  /**
   * Create instance from file data
   */
  const createInstanceFromData = (
    data: string | ArrayBuffer,
    extension: string,
    file: File,
  ): Instance => {
    const { Instance } = store.appConfig
    const schemas = store.getSchemaConfig

    if (isExcelExtension(extension)) {
      return Instance.fromExcel(
        data,
        schemas.instanceSchema,
        store.appConfig.parameters.schema,
      )
    } else if (extension === FILE_EXTENSIONS.JSON) {
      const jsonData = JSON.parse(data as string)
      return new Instance(
        null,
        jsonData,
        schemas.instanceSchema,
        schemas.instanceChecksSchema,
        store.appConfig.parameters.schema,
      )
    } else if (extension === FILE_EXTENSIONS.CSV) {
      return Instance.fromCsv(
        data as string,
        file.name,
        schemas.instanceSchema,
        schemas.instanceChecksSchema,
        store.appConfig.parameters.schema,
      )
    }

    throw new Error(
      t('projectExecution.steps.step3.loadInstance.unsupportedFileFormat'),
    )
  }

  /**
   * Merge multiple instances into one
   */
  const mergeInstances = async (
    instances: Instance[],
  ): Promise<Instance | null> => {
    if (instances.length === 0) return null
    if (instances.length === 1) return instances[0]

    try {
      const schemas = store.getSchemaConfig
      const allData = instances.map(
        (instance) => instance.data as Record<string, any>,
      )
      const mergedData = mergeInstanceData(allData)

      return new Instance(
        null,
        mergedData,
        schemas.instanceSchema,
        schemas.instanceChecksSchema,
        store.appConfig.parameters.schema,
      )
    } catch (error) {
      console.error('Error merging instances:', error)
      throw error
    }
  }

  /**
   * Merge instance data objects
   */
  const mergeInstanceData = (
    dataArray: Record<string, any>[],
  ): Record<string, any> => {
    const mergedData: Record<string, any> = {}
    const allKeys = new Set<string>()

    // Collect all keys
    for (const data of dataArray) {
      for (const key in data) {
        allKeys.add(key)
      }
    }

    // Merge values for each key
    for (const key of allKeys) {
      const values = dataArray
        .filter((data) => data[key] !== undefined)
        .map((data) => data[key])

      if (values.length === 0) {
        continue
      } else if (values.length === 1) {
        mergedData[key] = values[0]
      } else {
        mergedData[key] = mergeValues(values)
      }
    }

    return mergedData
  }

  /**
   * Merge array of values based on their type
   */
  const mergeValues = (values: any[]): any => {
    const firstValue = values[0]

    if (Array.isArray(firstValue)) {
      return values.flat()
    } else if (typeof firstValue === 'object' && firstValue !== null) {
      const merged = {}
      for (const value of values) {
        if (value && typeof value === 'object') {
          Object.assign(merged, value)
        }
      }
      return merged
    } else {
      return values.find((v) => v !== null && v !== undefined) || firstValue
    }
  }

  /**
   * Validate instance and return result
   */
  const validateInstance = async (
    instance: Instance,
    title: string,
  ): Promise<ProcessingResult> => {
    try {
      const errors = await instance.checkSchema()
      console.log(errors)
      if (errors && errors.length > 0) {
        return createErrorResult(
          formatValidationErrorsWithTitle(title, errors, t),
          errors,
        )
      }
      return createSuccessResult(instance)
    } catch (error) {
      return createErrorResult(
        formatErrorDetails(
          t('projectExecution.steps.step3.loadInstance.unexpectedError'),
          [{ instancePath: '', message: error.message }],
          error.message,
          t,
        ),
        null,
      )
    }
  }

  /**
   * Helper to create success result
   */
  const createSuccessResult = (instance: Instance): ProcessingResult => ({
    instance,
    errors: null,
    rawErrors: null,
    success: true,
  })

  /**
   * Helper to create error result
   */
  const createErrorResult = (
    errors: string,
    rawErrors: ErrorObject[] | null = null,
  ): ProcessingResult => {
    state.value.errors = errors
    return {
      instance: null,
      errors,
      rawErrors,
      success: false,
    }
  }

  /**
   * Reset processing state
   */
  const resetState = () => {
    state.value.processedInstances = []
    state.value.errors = null
    state.value.isProcessing = false
  }

  return {
    // State
    state: computed(() => state.value),
    supportedExtensions,
    canProcessFiles,

    // Methods
    processFiles,
    resetState,
  }
}
