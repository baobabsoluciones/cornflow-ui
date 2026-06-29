import { ref, computed } from 'vue'
import TableRepository from '@cornflow-ui/core/repositories/TableRepository'
import { TableOperation } from '@cornflow-ui/core/types/table'
import {
  resolveTableConfigTitles,
  getListResponseRowProperties,
  normalizeGetListResponseToRows,
} from '@cornflow-ui/core/utils/schemaUtils'
import { exportTableToExcel } from '@cornflow-ui/core/utils/data_io'
import readXlsxFile from 'read-excel-file'
import {
  detectDelimiter,
  parseCsvContent as parseCsvWithDelimiter,
} from '@cornflow-ui/core/utils/csvUtils'

export function useTableOperations(
  tableConfig: any,
  tableKey: string,
  showSnackbar: any,
  $t: any,
  $i18n: any,
) {
  const loading = ref(false)
  const allItems = ref<any[]>([])
  const tableRepository = ref<TableRepository | null>(null)

  // Modal states
  const showModal = ref(false)
  const showDeleteDialog = ref(false)
  const showBulkUploadDialog = ref(false)
  const showBulkDeleteDialog = ref(false)
  const isEditing = ref(false)
  const formData = ref({})
  const formFields = ref({})
  const currentItem = ref(null)
  const itemToDelete = ref(null)

  // Loading states
  const saving = ref(false)
  const deleting = ref(false)
  const uploading = ref(false)
  const downloading = ref(false)
  const bulkDeleting = ref(false)

  const localizedTableConfig = computed(() => {
    if (!tableConfig.value) return null
    const currentLocale = $i18n?.locale || 'en'
    return resolveTableConfigTitles(
      { [tableKey]: tableConfig.value },
      currentLocale,
    )[tableKey]
  })

  const title = computed(() => {
    return (
      localizedTableConfig.value?.title || tableConfig.value?.title || tableKey
    )
  })

  const canAddItems = computed(() => {
    return tableRepository.value?.isOperationSupported(TableOperation.POST_ITEM)
  })

  const canEditItems = computed(() => {
    return tableRepository.value?.isOperationSupported(TableOperation.PUT_ITEM)
  })

  const canDeleteItems = computed(() => {
    return (
      tableRepository.value &&
      (tableRepository.value.isOperationSupported(TableOperation.DELETE_ITEM) ||
        tableRepository.value.isOperationSupported(TableOperation.DELETE_BULK))
    )
  })

  const canBulkUpload = computed(() => {
    return (
      tableRepository.value &&
      (tableRepository.value.isOperationSupported(TableOperation.POST_BULK) ||
        tableRepository.value.isOperationSupported(
          TableOperation.OVERWRITE_ALL,
        ))
    )
  })

  const availableBulkOperations = computed(() => {
    const operations: string[] = []
    if (tableRepository.value) {
      if (
        tableRepository.value.isOperationSupported(TableOperation.POST_BULK)
      ) {
        operations.push('post_bulk')
      }
      if (
        tableRepository.value.isOperationSupported(TableOperation.OVERWRITE_ALL)
      ) {
        operations.push('overwrite_all')
      }
    }
    return operations
  })

  const canDownloadExcel = computed(() => {
    // Always allow Excel download to show structure, even without data
    return tableRepository.value && tableConfig.value
  })

  const hasWriteOperations = computed(() => {
    return canAddItems.value || canBulkUpload.value
  })

  const hasReadOperations = computed(() => {
    return canDownloadExcel.value
  })

  const showActionsColumn = computed(() => {
    return canEditItems.value || canDeleteItems.value
  })

  const initializeRepository = () => {
    if (tableConfig.value) {
      tableRepository.value = new TableRepository(tableConfig.value, $t)
    }
  }

  const loadData = async () => {
    loading.value = true
    try {
      if (
        tableRepository.value?.isOperationSupported(TableOperation.GET_LIST)
      ) {
        const raw = await tableRepository.value.getList()
        allItems.value = normalizeGetListResponseToRows(
          raw,
          tableConfig.value,
        )
      } else {
        allItems.value = []
      }
    } catch (error) {
      console.error($t('table.loadingError'), error)
      allItems.value = []
      showSnackbar($t('table.loadingError'), 'error')
    } finally {
      loading.value = false
    }
  }

  const openAddModal = () => {
    isEditing.value = false
    currentItem.value = null
    initializeFormFields()
    formData.value = getDefaultFormData()
    showModal.value = true
  }

  const openEditModal = (item: any) => {
    isEditing.value = true
    currentItem.value = item
    initializeFormFields()
    // Copy item data but exclude 'id' from form data (keep it in currentItem for API calls)
    const formDataWithoutId = { ...item }
    delete formDataWithoutId.id
    formData.value = formDataWithoutId
    showModal.value = true
  }

  const closeModal = () => {
    showModal.value = false
    formData.value = {}
    currentItem.value = null
    saving.value = false
  }

  const initializeFormFields = () => {
    const rowSchema = getListResponseRowProperties(tableConfig.value)
    if (rowSchema?.properties) {
      const properties = rowSchema.properties
      // Filter out 'id' field and frontendReadOnly fields from form fields
      const filteredProperties: any = {}
      Object.entries(properties).forEach(([key, field]: [string, any]) => {
        if (key !== 'id' && !field.frontendReadOnly) {
          filteredProperties[key] = field
        }
      })
      formFields.value = filteredProperties
    } else {
      formFields.value = {
        name: { title: 'Name', type: 'string', required: true },
      }
    }
  }

  const getDefaultFormData = () => {
    const defaultData: any = {}
    Object.entries(formFields.value).forEach(([key, field]: [string, any]) => {
      // Since we already filtered out 'id' from formFields, no need to check here
      switch (field.type) {
        case 'boolean':
          defaultData[key] = false
          break
        case 'integer':
        case 'number':
          defaultData[key] = 0
          break
        default:
          defaultData[key] = ''
      }
    })
    return defaultData
  }

  const saveItem = async (formDataToSave: any) => {
    saving.value = true
    try {
      if (isEditing.value) {
        await tableRepository.value.putItem(
          currentItem.value.id,
          formDataToSave,
        )
        showSnackbar($t('table.itemUpdated'), 'success')
      } else {
        await tableRepository.value.createItem(formDataToSave)
        showSnackbar($t('table.itemAdded'), 'success')
      }
      await loadData()
      closeModal()
    } catch (error) {
      console.error('Error saving item:', error)
      const errorMessage = isEditing.value
        ? $t('table.errorUpdating')
        : $t('table.errorAdding')
      showSnackbar(errorMessage, 'error')
    } finally {
      saving.value = false
    }
  }

  const openDeleteConfirmation = (item: any) => {
    itemToDelete.value = item
    showDeleteDialog.value = true
  }

  const confirmDelete = async () => {
    deleting.value = true
    try {
      await tableRepository.value.deleteItem(itemToDelete.value.id)
      showSnackbar($t('table.itemDeleted'), 'success')
      await loadData()
      showDeleteDialog.value = false
      itemToDelete.value = null
    } catch (error) {
      console.error('Error deleting item:', error)
      showSnackbar($t('table.errorDeleting'), 'error')
    } finally {
      deleting.value = false
    }
  }

  const openBulkUploadModal = () => {
    showBulkUploadDialog.value = true
  }

  const closeBulkUploadModal = () => {
    showBulkUploadDialog.value = false
    uploading.value = false
  }

  const processBulkUpload = async (uploadData: any) => {
    if (!uploadData?.files || uploadData.files.length === 0)
      return

    uploading.value = true
    try {
      const file = uploadData.files[0]
      const parsed = await parseUploadFile(file)

      if (Array.isArray(parsed) && parsed.length > 0) {
        const data = parsed.map((row) =>
          Object.fromEntries(
            Object.entries(row).map(([k, v]) => [
              k,
              v === '' || v === undefined ? null : v,
            ]),
          ),
        )
        if (uploadData.operation === 'overwrite_all') {
          await tableRepository.value.overwriteAll(data)
        } else {
          await tableRepository.value.createBulk(data)
        }

        showSnackbar($t('table.bulkUploadSuccess'), 'success')
        await loadData()
        closeBulkUploadModal()
      } else {
        throw new Error('No valid data found in file')
      }
    } catch (error) {
      console.error('Error during bulk upload:', error)
      showSnackbar($t('table.errorBulkUpload'), 'error')
    } finally {
      uploading.value = false
    }
  }

  /**
   * Helper: Convert rows to objects using headers
   */
  const rowsToObjects = (headers: string[], rows: any[][]): any[] => {
    return rows.map((row) => {
      const obj: any = {}
      headers.forEach((header, index) => {
        const value = row[index]
        obj[header] =
          value === null || value === undefined || value === '' ? null : value
      })
      return obj
    })
  }

  /**
   * Helper: Parse CSV content to objects (supports comma, semicolon, and tab delimiters)
   */
  const parseCsvContent = (content: string): any[] => {
    const trimmed = content.trim()
    if (!trimmed) throw new Error('Invalid CSV format')
    const delimiter = detectDelimiter(trimmed)
    const { tableData } = parseCsvWithDelimiter(trimmed, delimiter)
    if (!tableData || tableData.length === 0) throw new Error('Invalid CSV format')
    return tableData
  }

  /**
   * Helper: Parse Excel file to objects
   */
  const parseExcelFile = async (file: File): Promise<any[]> => {
    const rows = await readXlsxFile(file)
    if (rows.length < 2) {
      throw new Error('Excel file must have at least a header row and one data row')
    }
    const headers = rows[0].map((header) => String(header).trim())
    return rowsToObjects(headers, rows.slice(1) as any[][])
  }

  const parseUploadFile = async (file: File): Promise<any[]> => {
    const extension = file.name.split('.').pop()?.toLowerCase()

    // Handle Excel files separately (no FileReader needed)
    if (extension === 'xlsx' || extension === 'xls') {
      try {
        return await parseExcelFile(file)
      } catch (error) {
        console.error('Excel parsing error:', error)
        throw new Error($t('table.fileProcessingError'))
      }
    }

    // Handle text-based files (JSON, CSV)
    if (extension !== 'json' && extension !== 'csv') {
      throw new Error($t('table.invalidFileFormat'))
    }
    try {
      const content = await file.text()

      if (extension === 'json') {
        const jsonData = JSON.parse(content)
        return Array.isArray(jsonData) ? jsonData : [jsonData]
      }
      return parseCsvContent(content)
    } catch (error) {
      console.error('File parsing error:', error)
      throw new Error($t('table.fileProcessingError'))
    }
  }

  const downloadExcel = async () => {
    downloading.value = true
    try {
      const configToUse = localizedTableConfig.value || tableConfig.value
      await exportTableToExcel(
        allItems.value,
        configToUse,
        tableKey,
        title.value,
        $t,
      )
      showSnackbar($t('table.downloadExcelSuccess'), 'success')
    } catch (error) {
      console.error('Error downloading Excel:', error)
      showSnackbar($t('table.errorDownloadExcelTable'), 'error')
    } finally {
      downloading.value = false
    }
  }

  const openBulkDeleteConfirmation = () => {
    showBulkDeleteDialog.value = true
  }

  /**
   * Helper: Delete items one by one and track results
   */
  const deleteItemsIndividually = async (items: any[]): Promise<{ success: any[]; failed: any[] }> => {
    const success: any[] = []
    const failed: any[] = []

    for (const item of items) {
      try {
        await tableRepository.value.deleteItem(item.id)
        success.push(item.id)
      } catch (error) {
        console.error(`Failed to delete item ${item.id}:`, error)
        failed.push(item.id)
      }
    }

    return { success, failed }
  }

  /**
   * Helper: Show deletion result message
   */
  const showDeletionResultMessage = (successCount: number, failedIds: any[]): void => {
    if (failedIds.length === 0) {
      showSnackbar($t('table.bulkDeleteSuccess', { count: successCount }), 'success')
    } else if (successCount === 0) {
      showSnackbar($t('table.bulkDeleteAllFailed'), 'error')
    } else {
      showSnackbar($t('table.bulkDeletePartialFailed', { ids: failedIds.join(', ') }), 'warning')
    }
  }

  const confirmBulkDelete = async (selectedItems: any[]) => {
    bulkDeleting.value = true
    const repo = tableRepository.value
    const supportsDeleteItem = repo.isOperationSupported(TableOperation.DELETE_ITEM)
    const supportsDeleteBulk = repo.isOperationSupported(TableOperation.DELETE_BULK)

    try {
      if (selectedItems.length === 1) {
        if (!supportsDeleteItem) throw new Error('Delete operation not supported')
        await repo.deleteItem(selectedItems[0].id)
      } else if (supportsDeleteBulk) {
        await repo.deleteBulk(selectedItems.map((item) => item.id))
      } else if (supportsDeleteItem) {
        const { success, failed } = await deleteItemsIndividually(selectedItems)
        showDeletionResultMessage(success.length, failed)
        await loadData()
        showBulkDeleteDialog.value = false
        return
      } else {
        throw new Error('Delete operations not supported')
      }

      showSnackbar($t('table.bulkDeleteSuccess', { count: selectedItems.length }), 'success')
      await loadData()
      showBulkDeleteDialog.value = false
    } catch (error) {
      console.error('Error during bulk delete:', error)
      showSnackbar($t('table.errorBulkDelete'), 'error')
    } finally {
      bulkDeleting.value = false
    }
  }

  return {
    // State
    loading,
    allItems,
    tableRepository,
    showModal,
    showDeleteDialog,
    showBulkUploadDialog,
    showBulkDeleteDialog,
    isEditing,
    formData,
    formFields,
    currentItem,
    itemToDelete,
    saving,
    deleting,
    uploading,
    downloading,
    bulkDeleting,

    // Computed
    localizedTableConfig,
    title,
    canAddItems,
    canEditItems,
    canDeleteItems,
    canBulkUpload,
    availableBulkOperations,
    canDownloadExcel,
    hasWriteOperations,
    hasReadOperations,
    showActionsColumn,

    // Methods
    initializeRepository,
    loadData,
    openAddModal,
    openEditModal,
    closeModal,
    saveItem,
    openDeleteConfirmation,
    confirmDelete,
    openBulkUploadModal,
    closeBulkUploadModal,
    processBulkUpload,
    downloadExcel,
    openBulkDeleteConfirmation,
    confirmBulkDelete,
  }
}
