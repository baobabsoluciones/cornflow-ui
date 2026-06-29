import { inject, ref, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGeneralStore } from '@/stores/general'
import { Instance } from '@/app/models/Instance'
import { Solution } from '@/app/models/Solution'
import { Experiment } from '@/app/models/Experiment'
import { formatErrorDetails } from '@/utils/errorFormatting'

/**
 * Interface for new execution object (used during creation)
 */
export interface NewExecution {
  name?: string | null
  description?: string | null
  config?: object
  instance?: Instance | null
}

/**
 * Composable for handling Excel operations (download/upload) for executions
 */
export function useExecutionExcel(
  execution: Ref<NewExecution>,
  onInstanceUpdate?: (instance: Instance) => void,
) {
  const { t } = useI18n()
  const generalStore = useGeneralStore()
  const showSnackbar =
    inject<(message: string, type?: string) => void>('showSnackbar')
  const isUploading = ref(false)

  /**
   * Download execution instance data as Excel file
   */
  const downloadExcel = async () => {
    try {
      if (!execution.value?.instance?.data) {
        showSnackbar?.(
          t('projectExecution.downloadExcelMessages.noDataError'),
          'error',
        )
        return
      }

      // Create Experiment instance with instance and empty solution
      const instance = execution.value.instance
      if (!instance) {
        showSnackbar?.(
          t('projectExecution.downloadExcelMessages.noDataError'),
          'error',
        )
        return
      }

      const schemas = generalStore.getSchemaConfig
      const emptySolution = new Solution(
        '',
        [],
        schemas.solutionSchema,
        schemas.solutionChecksSchema,
        generalStore.getSchemaName,
      )

      const experiment = new Experiment(instance, emptySolution)
      const filename = (execution.value.name || 'execution').replaceAll('.', '-')

      // Download only instance (saveSolution = false)
      await experiment.downloadExcel(filename, true, false)

      showSnackbar?.(
        t('projectExecution.downloadExcelMessages.success'),
        'success',
      )
    } catch (error) {
      console.error('Error downloading Excel:', error)
      showSnackbar?.(t('projectExecution.downloadExcelMessages.error'), 'error')
    }
  }

  /**
   * Handle Excel file upload
   */
  const handleFileUpload = async (event: Event) => {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return

    // Prevent duplicate processing
    if (isUploading.value) {
      input.value = ''
      return
    }
    isUploading.value = true

    // Reset file input immediately to prevent duplicate triggers
    input.value = ''

    try {
      const schemas = generalStore.getSchemaConfig
      const { Instance: InstanceClass } = generalStore.appConfig

      // Create instance from Excel file
      const instance = await InstanceClass.fromExcel(
        file,
        schemas.instanceSchema,
        generalStore.getSchemaName,
      )

      // Validate the instance against the schema
      const validationErrors = await instance.checkSchema()
      if (validationErrors && validationErrors.length > 0) {
        const errorMessage = formatErrorDetails(
          t('projectExecution.uploadExcelMessages.validationErrorTitle'),
          validationErrors,
          t('projectExecution.uploadExcelMessages.validationFailed'),
        )

        showSnackbar?.(
          t('projectExecution.uploadExcelMessages.validationFailed'),
          'error',
        )

        console.error('Instance validation failed:', errorMessage)
        return
      }

      // If validation passes, update the instance data
      if (onInstanceUpdate) {
        onInstanceUpdate(instance)
      }

      showSnackbar?.(
        t('projectExecution.uploadExcelMessages.success'),
        'success',
      )
    } catch (error) {
      console.error('Error uploading Excel:', error)
      showSnackbar?.(
        t('projectExecution.uploadExcelMessages.error') +
          ': ' +
          (error instanceof Error ? error.message : String(error)),
        'error',
      )
    } finally {
      isUploading.value = false
    }
  }

  return {
    downloadExcel,
    handleFileUpload,
    isUploading,
  }
}
