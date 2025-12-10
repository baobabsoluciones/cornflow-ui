import { ref, computed } from 'vue'
import TableRepository from '@/repositories/TableRepository'
import { TableOperation } from '@/types/table'
import { resolveTableConfigTitles } from '@/utils/schemaUtils'
import { exportTableToExcel } from '@/utils/data_io'
import readXlsxFile from 'read-excel-file'

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
    return (
      tableRepository.value &&
      tableRepository.value.isOperationSupported(TableOperation.POST_ITEM)
    )
  })

  const canEditItems = computed(() => {
    return (
      tableRepository.value &&
      tableRepository.value.isOperationSupported(TableOperation.PUT_ITEM)
    )
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
        tableRepository.value &&
        tableRepository.value.isOperationSupported(TableOperation.GET_LIST)
      ) {
        allItems.value = await tableRepository.value.getList()
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
    if (tableConfig.value?.get_list?.response_schema?.items?.properties) {
      const properties =
        tableConfig.value.get_list.response_schema.items.properties
      // Filter out 'id' field and readOnly fields from form fields
      const filteredProperties: any = {}
      Object.entries(properties).forEach(([key, field]: [string, any]) => {
        if (key !== 'id' && !field.readOnly) {
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
        await tableRepository.value!.putItem(
          currentItem.value.id,
          formDataToSave,
        )
        showSnackbar($t('table.itemUpdated'), 'success')
      } else {
        await tableRepository.value!.createItem(formDataToSave)
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
      await tableRepository.value!.deleteItem(itemToDelete.value.id)
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
    if (!uploadData || !uploadData.files || uploadData.files.length === 0)
      return

    uploading.value = true
    try {
      const file = uploadData.files[0]
      const data = await parseUploadFile(file)

      if (Array.isArray(data) && data.length > 0) {
        // Call the appropriate method based on the selected operation
        if (uploadData.operation === 'overwrite_all') {
          await tableRepository.value!.overwriteAll(data)
        } else {
          await tableRepository.value!.createBulk(data)
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

  const parseUploadFile = async (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()

      reader.onload = (e) => {
        try {
          const content = e.target!.result as string
          const extension = file.name.split('.').pop()?.toLowerCase()

          switch (extension) {
            case 'json':
              const jsonData = JSON.parse(content)
              resolve(Array.isArray(jsonData) ? jsonData : [jsonData])
              break
            case 'csv':
              // Simple CSV parsing - you might want to use a proper CSV library
              const lines = content.split('\n').filter((line) => line.trim())
              if (lines.length < 2) throw new Error('Invalid CSV format')

              const headers = lines[0].split(',').map((h) => h.trim())
              const data = lines.slice(1).map((line) => {
                const values = line.split(',').map((v) => v.trim())
                const obj: any = {}
                headers.forEach((header, index) => {
                  // Only convert undefined to empty string
                  const value = values[index]
                  obj[header] = value === undefined ? '' : value
                })
                return obj
              })
              resolve(data)
              break
            case 'xlsx':
            case 'xls':
              // Handle Excel files using read-excel-file
              readXlsxFile(file)
                .then((rows) => {
                  if (rows.length < 2) {
                    throw new Error(
                      'Excel file must have at least a header row and one data row',
                    )
                  }

                  // First row is headers
                  const headers = rows[0].map((header) => String(header).trim())

                  // Convert remaining rows to objects
                  const data = rows.slice(1).map((row) => {
                    const obj: any = {}
                    headers.forEach((header, index) => {
                      // Only convert null/undefined to empty string
                      const value = row[index]
                      obj[header] =
                        value === null || value === undefined ? '' : value
                    })
                    return obj
                  })

                  resolve(data)
                })
                .catch((error) => {
                  console.error('Excel parsing error:', error)
                  reject(new Error($t('table.fileProcessingError')))
                })
              return // Don't execute reader.readAsText for Excel files
            default:
              reject(new Error($t('table.invalidFileFormat')))
          }
        } catch (error) {
          console.error('File parsing error:', error)
          reject(new Error($t('table.fileProcessingError')))
        }
      }

      reader.onerror = (error) => {
        console.error('File reading error:', error)
        reject(new Error($t('table.fileProcessingError')))
      }
      reader.readAsText(file)
    })
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

  const confirmBulkDelete = async (selectedItems: any[]) => {
    bulkDeleting.value = true

    try {
      if (selectedItems.length === 1) {
        // Single item deletion - use DELETE_ITEM if available
        if (
          tableRepository.value!.isOperationSupported(
            TableOperation.DELETE_ITEM,
          )
        ) {
          await tableRepository.value!.deleteItem(selectedItems[0].id)
        } else {
          throw new Error('Delete operation not supported')
        }
      } else {
        // Multiple items deletion - use DELETE_BULK if available, otherwise individual deletes
        if (
          tableRepository.value!.isOperationSupported(
            TableOperation.DELETE_BULK,
          )
        ) {
          const ids = selectedItems.map((item) => item.id)
          await tableRepository.value!.deleteBulk(ids)
        } else if (
          tableRepository.value!.isOperationSupported(
            TableOperation.DELETE_ITEM,
          )
        ) {
          // Fall back to individual deletes
          const failedDeletions: any[] = []
          const successfulDeletions: any[] = []

          for (const item of selectedItems) {
            try {
              await tableRepository.value!.deleteItem(item.id)
              successfulDeletions.push(item.id)
            } catch (error) {
              console.error(`Failed to delete item ${item.id}:`, error)
              failedDeletions.push(item.id)
            }
          }

          // Show appropriate message based on results for individual deletes
          if (failedDeletions.length === 0) {
            // All deletions successful
            showSnackbar(
              $t('table.bulkDeleteSuccess', {
                count: successfulDeletions.length,
              }),
              'success',
            )
          } else if (successfulDeletions.length === 0) {
            // All deletions failed
            showSnackbar($t('table.bulkDeleteAllFailed'), 'error')
          } else {
            // Some deletions failed
            const failedIds = failedDeletions.join(', ')
            showSnackbar(
              $t('table.bulkDeletePartialFailed', { ids: failedIds }),
              'warning',
            )
          }

          // Reload data and close dialog
          await loadData()
          showBulkDeleteDialog.value = false
          return
        } else {
          throw new Error('Delete operations not supported')
        }
      }

      // Success message for single delete or bulk delete endpoint
      showSnackbar(
        $t('table.bulkDeleteSuccess', { count: selectedItems.length }),
        'success',
      )

      // Reload data
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
