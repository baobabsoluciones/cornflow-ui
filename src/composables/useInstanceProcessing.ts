/**
 * Composable for processing instance files with improved architecture
 * Handles ETL backend decisions, file processing, and instance merging
 */

import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGeneralStore } from '@cornflow-ui/core/stores/general'
import { getPremiumEtlBackend } from '@cornflow-ui/core/plugins/extensions'
import { useFilePreProcessing } from '@cornflow-ui/core/composables/useFilePreProcessing'
import { useFileProcessors } from '@/app/composables/useFileProcessors'
import { Instance } from '@/app/models/Instance'
import {
  formatValidationErrorsWithTitle,
  formatErrorDetails,
  formatEtlCheckErrors,
} from '@cornflow-ui/core/utils/errorFormatting'
import type {
  EtlCheckError,
  EtlChecksSummary,
} from '@cornflow-ui/core/utils/errorFormatting'
import type { EtlBackendError } from '@cornflow-ui/core/types/extension'
import type { ErrorObject } from 'ajv'
import {
  FILE_EXTENSIONS,
  SUPPORTED_DATA_EXTENSIONS,
  resolveAllowedExtensions,
  isExcelExtension,
  getFileExtension,
} from '@cornflow-ui/core/utils/fileConstants'
import { buildExcelBuffer } from '@cornflow-ui/core/utils/data_io'
import {
  buildAlternativeParameterInstanceData,
  convertParameterNameValueArraysToObjectsForInstance,
  getInstanceSchemaRootForTables,
  patchInstanceSchemaRootForParameterTableEtlExport,
  pickPreEtlConfigValues,
} from '@cornflow-ui/core/utils/schemaUtils'
import { unwrapEtlResponse } from '@cornflow-ui/core/utils/etlResponse'
import type { LoadInstanceAlternativeParamField } from '@/app/config'

export interface ProcessingResult {
  instance: Instance | null
  errors: string | null
  rawErrors: ErrorObject[] | null
  success: boolean
  rawData?: Record<string, any> | null
  /** Optional non-blocking message returned by the ETL backend; resolved to current locale. */
  warning?: string | null
  /** Set when `rawErrors` are the ETL backend's pre-check errors rather than schema errors. */
  errorSource?: 'etl'
  /** The ETL error body's `checks`, used to head each group of `rawErrors`. */
  etlChecks?: EtlChecksSummary | null
}

// Re-exported from `@/utils/etlResponse` so existing imports keep working.
export { unwrapEtlResponse } from '@cornflow-ui/core/utils/etlResponse'

/**
 * Normalizes the `details` of an ETL backend error to the shape the error list and the
 * download expect. Entries without a `message` are dropped; the rest get the fields they
 * lack.
 */
function normalizeEtlErrorDetails(details: unknown): EtlCheckError[] {
  if (!Array.isArray(details)) return []
  return details
    .filter(
      (detail) =>
        detail && typeof detail === 'object' && detail.message,
    )
    .map((detail) => ({
      ...detail,
      instancePath: detail.instancePath ?? '',
      schemaPath: detail.schemaPath ?? '',
      keyword: detail.keyword ?? detail.check ?? '',
      params: detail.params ?? {},
      message: String(detail.message),
    }))
}

/**
 * The `checks` of the ETL error body, when the implementation passed the body on. Their
 * presence is what tells a pre-check report from any other ETL failure.
 */
function etlChecksFromBody(body: unknown): EtlChecksSummary | null {
  const checks = (body as Record<string, any> | null | undefined)?.checks
  return checks && typeof checks === 'object' && !Array.isArray(checks)
    ? checks
    : null
}

export interface ProcessingState {
  isProcessing: boolean
  processedInstances: Instance[]
  errors: string | null
}

export interface BuildInstanceDataFromAlternativeFieldsContext {
  instanceSchema: any
  /** `rawConfigurations.masterData` from the general store (frontend-automation tables). */
  masterDataTables?: Record<string, any> | null
}

/**
 * Build `instance.data` for the optional parameter form using instance schema + master-data config.
 */
export function buildInstanceDataFromAlternativeFields(
  fields: LoadInstanceAlternativeParamField[],
  values: Record<string, unknown>,
  context: BuildInstanceDataFromAlternativeFieldsContext,
): Record<string, any> {
  return buildAlternativeParameterInstanceData(
    fields,
    values,
    context.instanceSchema,
    context.masterDataTables ?? null,
  )
}

export function useInstanceProcessing() {
  const { t, locale: i18nLocale } = useI18n()
  const store = useGeneralStore()
  // ETL backend injected by the premium `etl` module (§3.7); null if ETL is not enabled.
  // The core no longer imports `useEtlStore` — it consumes the backend through the interface.
  const etlBackend = getPremiumEtlBackend()
  const { processFileByPrefix, needsSpecialProcessing } = useFileProcessors()
  // Shared with the master-data uploads: a processed file has to look the same whichever
  // endpoint it is headed for.
  const { preProcessFiles: preProcessFilesForEtl } = useFilePreProcessing()

  // State
  const state = ref<ProcessingState>({
    isProcessing: false,
    processedInstances: [],
    errors: null,
  })

  // Computed
  // What the instance drop zone accepts. A deployment can narrow it through
  // `parameters.instanceFileFormats`: a project that only ever receives Excel gains nothing
  // from offering json and csv, beyond an upload that cannot work. Left unset, this is what
  // it has always been.
  const supportedExtensions = computed(() =>
    resolveAllowedExtensions(
      store.appConfig?.parameters?.instanceFileFormats,
      SUPPORTED_DATA_EXTENSIONS,
    ),
  )
  const canProcessFiles = computed(() => !state.value.isProcessing)

  /**
   * Main processing function that handles both ETL backend and frontend processing
   */
  /**
   * Process partial instance JSON: same validation as file upload; with ETL enabled,
   * builds an XLSX (one sheet per table) and sends it as FormData like file upload.
   */
  /**
   * The values the ETL backend needs out of an execution config, i.e. the parameters the
   * config schema marked `pre_etl: true`. Callers hand over the whole config and this
   * picks the subset, so no caller has to know which parameters those are.
   */
  const preEtlParamsFrom = (
    executionConfig?: Record<string, any> | null,
  ): Record<string, unknown> =>
    pickPreEtlConfigValues(
      executionConfig,
      store.appConfig.parameters.configFields,
    )

  const processInstanceData = async (
    data: Record<string, any>,
    executionConfig?: Record<string, any> | null,
  ): Promise<ProcessingResult> => {
    if (!data || Object.keys(data).length === 0) {
      return createErrorResult(
        t('projectExecution.steps.step3.loadInstance.noParametersDataError'),
        null,
      )
    }

    state.value.isProcessing = true
    state.value.processedInstances = []
    state.value.errors = null

    try {
      if (
        etlBackend &&
        (store.appConfig.parameters.etl.enableEtlMetadataAndReview ||
          store.appConfig.parameters.etl.useEtlBackend)
      ) {
        const tableSchemaRoot =
          getInstanceSchemaRootForTables(store.getSchemaConfig.instanceSchema) ??
          (store.getSchemaConfig.instanceSchema as Record<string, any> | null)
        const exportSchemaRoot = patchInstanceSchemaRootForParameterTableEtlExport(
          data,
          tableSchemaRoot,
        )
        const effectiveRoot = exportSchemaRoot ?? tableSchemaRoot
        if (!instanceDataHasVisibleSheets(data, effectiveRoot)) {
          return createErrorResult(
            t('projectExecution.steps.step3.loadInstance.noParametersSheetsError'),
            null,
          )
        }
        const file = await buildInstanceXlsxFile(
          data,
          'instance-from-parameters.xlsx',
          effectiveRoot,
        )
        if (!file.size) {
          return createErrorResult(
            t('projectExecution.steps.step3.loadInstance.noParametersSheetsError'),
            null,
          )
        }
        return await processWithEtlBackend([file], executionConfig)
      }

      const schemas = store.getSchemaConfig
      const dataForInstance = convertParameterNameValueArraysToObjectsForInstance(
        data,
        schemas.instanceSchema,
      )
      const instance = new Instance(
        null,
        dataForInstance,
        schemas.instanceSchema,
        schemas.instanceChecksSchema,
        store.getSchemaName,
      )
      const validationResult = await validateInstance(
        instance,
        'Parameters instance',
      )
      if (!validationResult.success) {
        return validationResult
      }
      return {
        instance,
        errors: null,
        rawErrors: null,
        success: true,
      }
    } catch (error: any) {
      return createErrorResult(error.message || String(error), null)
    } finally {
      state.value.isProcessing = false
    }
  }

  const processFiles = async (
    files: File[],
    executionConfig?: Record<string, any> | null,
  ): Promise<ProcessingResult> => {
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
      if (
        etlBackend &&
        (store.appConfig.parameters.etl.enableEtlMetadataAndReview ||
          store.appConfig.parameters.etl.useEtlBackend)
      ) {
        return await processWithEtlBackend(files, executionConfig)
      } else {
        return await processWithFrontend(files)
      }
    } catch (error: any) {
      return createErrorResult(error.message || String(error), null)
    } finally {
      state.value.isProcessing = false
    }
  }

  /**
   * Resolves the schema root used when serialising instance data to xlsx for the
   * ETL endpoint.
   */
  const resolveInstanceSchemaRoot = (
    schemaRoot?: Record<string, any> | null,
  ): Record<string, any> | null => {
    if (schemaRoot !== undefined) return schemaRoot
    return (
      getInstanceSchemaRootForTables(store.getSchemaConfig.instanceSchema) ??
      (store.getSchemaConfig.instanceSchema as Record<string, any> | null)
    )
  }

  /**
   * Mirrors `prepareSheetData` + visibility checks from `schemaDataToTable`:
   * returns true if at least one sheet would be written to the workbook. Used
   * to detect the "no parameters" empty-export case without first materialising
   * a workbook on the main thread.
   */
  const instanceDataHasVisibleSheets = (
    data: Record<string, any>,
    schemaRoot: Record<string, any> | null,
  ): boolean => {
    for (const [sheetName, rawSheetData] of Object.entries(data)) {
      if (schemaRoot?.properties?.[sheetName]?.visible === false) continue
      const normalized = Array.isArray(rawSheetData) ? rawSheetData : [rawSheetData]
      if (normalized.length === 0) {
        const requiredHeaders =
          schemaRoot?.properties?.[sheetName]?.items?.required
        if (!requiredHeaders) continue
      }
      return true
    }
    return false
  }

  /**
   * Builds an xlsx `File` from instance data using the Excel worker (falls back
   * to the main thread when no worker is available). Keeps heavy ExcelJS
   * serialisation off the main thread for large datasets.
   */
  const buildInstanceXlsxFile = async (
    data: Record<string, any>,
    filename: string,
    schemaRoot?: Record<string, any> | null,
  ): Promise<File> => {
    const root = resolveInstanceSchemaRoot(schemaRoot)
    // The ETL upload requires a real xlsx file. In practice the data passed
    // through this code path (parameter forms, file pre-processing) is small
    // enough to stay below the worker's huge-dataset threshold, so the
    // returned format is always 'xlsx' here.
    const { bytes } = await buildExcelBuffer(data, root)
    const blob = new Blob([bytes as BlobPart], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    return new File([blob], filename, { type: blob.type })
  }

  /**
   * Builds an Instance from a raw ETL backend response: unwraps it, strips `__metadata__`
   * (returning it as `rawData` only when `enableEtlMetadataAndReview` is on), and constructs
   * the Instance from the configured schemas. Shared by processWithEtlBackend and processFromDb.
   */
  const buildInstanceFromEtlResponse = (
    rawResponse: any,
  ): {
    instance: Instance
    rawData: Record<string, any> | null
    warning: string | null
  } => {
    const { data: responseData, warning } = unwrapEtlResponse(
      rawResponse,
      i18nLocale.value,
    )
    const expectMetadataAndReview =
      store.appConfig.parameters.etl.enableEtlMetadataAndReview

    let instanceData = responseData
    let rawData: Record<string, any> | null = null

    if (responseData.__metadata__ && expectMetadataAndReview) {
      instanceData = { ...responseData }
      delete instanceData.__metadata__
      rawData = responseData
    } else if (responseData.__metadata__) {
      instanceData = { ...responseData }
      delete instanceData.__metadata__
    }

    const schemas = store.getSchemaConfig
    const instance = new Instance(
      null,
      instanceData,
      schemas.instanceSchema,
      schemas.instanceChecksSchema,
      store.getSchemaName,
    )

    return { instance, rawData, warning }
  }

  /**
   * Build a standard error result from an ETL backend failure.
   * When the body is the pre-check report (it has `checks`) and the error carries the
   * failed checks (`details`), they become `rawErrors`, listed by check like schema errors
   * and downloadable. Any other failure keeps showing the backend's own message, falling
   * back to the generic "unexpected error" i18n string: other ETL backends may put in
   * `message` what their `errors` do not say, and listing only the errors would hide it.
   * Shared by processWithEtlBackend and processFromDb to keep their catch blocks identical.
   */
  const buildEtlBackendErrorResult = (
    error: EtlBackendError | any,
  ): ProcessingResult => {
    const etlChecks = etlChecksFromBody(error?.body)
    const checkErrors = etlChecks ? normalizeEtlErrorDetails(error?.details) : []
    if (checkErrors.length > 0) {
      return {
        ...createErrorResult(
          formatEtlCheckErrors(checkErrors, etlChecks, t),
          checkErrors,
        ),
        errorSource: 'etl',
        etlChecks,
      }
    }

    const backendMessage =
      (error?.message && String(error.message).trim()) || String(error || '')
    const message =
      backendMessage ||
      t('projectExecution.steps.step3.loadInstance.unexpectedError')
    return createErrorResult(
      formatErrorDetails('Error', [{ instancePath: '', message }], message, t),
      null,
    )
  }

  /**
   * Process files using the ETL backend. Both useEtlBackend and enableEtlMetadataAndReview
   * use the same endpoint (POST /external/etl/). When enableEtlMetadataAndReview is true
   * and the response contains __metadata__, it is stripped from the instance data and
   * returned as rawData so the review flow (switches + POST /etl/update/) can run.
   * When fileProcessors are configured, files are pre-processed before being sent to the ETL.
   */
  const processWithEtlBackend = async (
    files: File[],
    executionConfig?: Record<string, any> | null,
  ): Promise<ProcessingResult> => {
    try {
      const preprocessed = await preProcessFilesForEtl(files)
      const filesToSend = preprocessed ?? files
      const rawResponse = await etlBackend!.useEtlBackend(
        filesToSend,
        preEtlParamsFrom(executionConfig),
      )
      const { instance, rawData, warning } =
        buildInstanceFromEtlResponse(rawResponse)

      const validationResult = await validateInstance(
        instance,
        'ETL processed instance',
      )
      if (!validationResult.success) {
        return validationResult
      }

      return {
        instance,
        errors: null,
        rawErrors: null,
        success: true,
        ...(rawData ? { rawData } : {}),
        ...(warning ? { warning } : {}),
      }
    } catch (error: any) {
      return buildEtlBackendErrorResult(error)
    }
  }

  /**
   * Load instance data directly from the database via the ETL endpoint (no files).
   * Used when `etl.enableLoadFromDb` is true and the user clicks "Obtener todos los datos de base de datos".
   * Reuses the same metadata/review logic as processWithEtlBackend.
   */
  const processFromDb = async (
    executionConfig?: Record<string, any> | null,
  ): Promise<ProcessingResult> => {
    if (!etlBackend) {
      return createErrorResult(
        t('projectExecution.steps.step3.loadInstance.unexpectedError'),
        null,
      )
    }

    state.value.isProcessing = true
    state.value.processedInstances = []
    state.value.errors = null

    try {
      const rawResponse = await etlBackend.useEtlBackendFromDb(
        preEtlParamsFrom(executionConfig),
      )
      const { instance, rawData, warning } =
        buildInstanceFromEtlResponse(rawResponse)

      const validationResult = await validateInstance(instance, 'ETL DB instance')
      if (!validationResult.success) {
        return validationResult
      }

      return {
        instance,
        errors: null,
        rawErrors: null,
        success: true,
        ...(rawData ? { rawData } : {}),
        ...(warning ? { warning } : {}),
      }
    } catch (error: any) {
      return buildEtlBackendErrorResult(error)
    } finally {
      state.value.isProcessing = false
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
    } catch (error: any) {
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
      const instance = await createInstanceFromData(
        fileContent,
        extension,
        file,
      )
      return createSuccessResult(instance)
    } catch (error: any) {
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

      fileReader.onload = () => resolve(fileReader.result)
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
  const createInstanceFromData = async (
    data: string | ArrayBuffer,
    extension: string,
    file: File,
  ): Promise<Instance> => {
    const { Instance } = store.appConfig
    const schemas = store.getSchemaConfig
    const schemaName = (store.appConfig.parameters as any).schema

    if (isExcelExtension(extension)) {
      return await Instance.fromExcel(
        data,
        schemas.instanceSchema,
        schemaName,
      )
    } else if (extension === FILE_EXTENSIONS.JSON) {
      const jsonData = JSON.parse(data as string)
      return new Instance(
        null,
        jsonData,
        schemas.instanceSchema,
        schemas.instanceChecksSchema,
        schemaName,
      )
    } else if (extension === FILE_EXTENSIONS.CSV) {
      return await Instance.fromCsv(
        data as string,
        file.name,
        schemas.instanceSchema,
        schemas.instanceChecksSchema,
        schemaName,
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
      (store.appConfig.parameters as any).schema as string,
    )
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
    processFromDb,
    processInstanceData,
    resetState,
  }
}
