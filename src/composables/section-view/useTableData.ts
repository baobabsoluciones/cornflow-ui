import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { showSnackbar } from '@/services/SnackbarService'
import { useExecutionTableData } from './useExecutionTableData'
import { getSectionType } from '@/services/FrontendAutomationService'
import { useGeneralStore } from '@/stores/general'
import { useTableChanges } from '@/composables/useTableChanges'
import type { Ref, ComputedRef } from 'vue'
import {
  getOperatorsForFieldType,
  getOperatorText as getOperatorTextUtil,
  operatorNeedsValue,
  operatorNeedsSecondValue,
  generateFilterId,
  applyFiltersAndSearch as applyFiltersAndSearchUtil,
  type FilterCondition,
} from '@/utils/tableFilterUtils'
import { useFormFields } from '@/composables/core-table/useFormFields'
import { exportTableToExcel } from '@/utils/data_io'
import readXlsxFile from 'read-excel-file'
import { parseJoinFrom, getForeignKeyFieldName, resolveDisplayValuesToFkIds } from '@/utils/schemaUtils'

// Shared table data cache so all SectionViews and selectors see the same data.
// Invalidated when a table is saved so new rows appear in other sections' selectors.
const sharedTableDataCache = ref<Record<string, any[]>>({})

/**
 * Invalidate cached list for a table (and keys that normalize to the same or match by suffix).
 * Call after saving creates/edits so other sections' selectors refetch and show the new row.
 */
export function invalidateTableDataCache(tableKey: string): void {
  if (!tableKey) return
  const normalized = String(tableKey).toLowerCase().replace(/-/g, '_')
  const cache = sharedTableDataCache.value
  const toDelete: string[] = []
  for (const key of Object.keys(cache)) {
    const n = String(key).toLowerCase().replace(/-/g, '_')
    if (
      n === normalized ||
      key === tableKey ||
      tableKey.endsWith('_' + key) ||
      key.endsWith('_' + tableKey) ||
      normalized.endsWith('_' + n) ||
      n.endsWith('_' + normalized)
    ) {
      toDelete.push(key)
    }
  }
  toDelete.forEach((k) => delete cache[k])
}

// Business logic composable for SectionView
export function useTableData(
  tableKey: Ref<string>,
  tableConfig: ComputedRef<any>,
  executionTypeParam?: ComputedRef<string | null>,
) {
  const { t } = useI18n()
  const route = useRoute()

  const getOperatorText = (operator: string): string => {
    return getOperatorTextUtil(operator, t)
  }

  // Table changes for Excel-like editing (master tables only)
  const tableChanges = useTableChanges()

  /**
   * Normalize table key for storage/read so it's consistent when the same tab
   * is identified by different formats.
   */
  const normalizeTableKeyForStorage = (key: string): string => {
    if (!key) return ''
    return String(key).toLowerCase().replace(/-/g, '_')
  }

  // Check if we're dealing with execution data (input-data or results)
  const sectionType = computed(() => getSectionType(route.path))

  // Determine execution type (use parameter if provided, otherwise derive from route)
  const executionType = computed(() => {
    if (executionTypeParam) {
      return executionTypeParam.value
    }
    if (sectionType.value === 'input-data') return 'instance'
    if (sectionType.value === 'results') return 'solution'
    return null
  })

  // Check if we're dealing with execution data
  // Consider execution data if route matches OR if executionTypeParam is provided
  const isExecutionData = computed(() => {
    // If executionTypeParam is provided and has a value, we're in execution mode
    if (executionTypeParam && executionType.value) {
      return true
    }
    // Otherwise, check route
    return sectionType.value === 'input-data' || sectionType.value === 'results'
  })

  // Use execution table data if we're dealing with execution data
  const executionTableData = useExecutionTableData(
    tableKey,
    tableConfig,
    executionType,
  )

  // Check if we actually have execution data available
  const generalStore = useGeneralStore()
  const hasExecutionData = computed(() => {
    return !!generalStore.selectedExecution
  })

  // Check if this specific table has execution data available
  const hasTableExecutionData = computed(() => {
    if (!hasExecutionData.value || !executionType.value) return false

    const executionData = generalStore.selectedExecution
    if (!executionData) return false

    let dataSource
    if (executionType.value === 'instance') {
      dataSource = executionData.experiment?.instance || executionData.instance
    } else if (executionType.value === 'solution') {
      dataSource = executionData.experiment?.solution || executionData.solution
    }

    if (!dataSource) return false

    // Check if this specific table exists in the execution data
    // For validation tables, check dataChecks; for regular tables, check data
    const isValidationTable =
      tableConfig.value?.group &&
      (tableConfig.value.group.toLowerCase().includes('validation') ||
        tableConfig.value.group.toLowerCase().includes('validacion'))

    if (isValidationTable) {
      return !!(dataSource.dataChecks && dataSource.dataChecks[tableKey.value])
    } else {
      return !!(dataSource.data && dataSource.data[tableKey.value])
    }
  })

  // Debug log to understand the decision
  const shouldUseExecutionData = computed(
    () =>
      isExecutionData.value &&
      executionType.value &&
      hasTableExecutionData.value,
  )

  // Master table logic
  const items = ref<any[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const searchValue = ref('')
  const activeFilters = ref<any[]>([])
  const selectedItems = ref<any[]>([])
  const showAddEditModal = ref(false)
  const showDeleteDialog = ref(false)
  const showBulkDeleteDialog = ref(false)
  const showBulkUploadModal = ref(false)
  const formData = ref({})
  const isEditing = ref(false)
  const saving = ref(false)
  const deleting = ref(false)
  const bulkDeleting = ref(false)
  const uploading = ref(false)
  const downloading = ref(false)
  const editingRowId = ref<string | number | null>(null)
  const editingData = ref({})
  const originalData = ref({})
  const tableDataCache = sharedTableDataCache
  // Cancel in-flight loadData when view is deactivated so we don't update state after navigate-away
  const loadIdRef = ref(0)

  /** Return API list for a table plus any pending creates so dropdowns show new rows. */
  const mergePendingCreatesIntoTableList = (
    tableName: string,
    baseList: any[],
  ): any[] => {
    const normalizedName = normalizeTableKeyForStorage(tableName)
    const allKeysWithCreates = tableChanges.modifiedTableKeys.value
    const pendingCreatesFromAllMatchingKeys: Array<{ tempId: string; data: any }> = []
    const seenTempIds = new Set<string>()
    for (const storageKey of allKeysWithCreates) {
      const normalizedKey = normalizeTableKeyForStorage(storageKey)
      const isSameTable =
        normalizedKey === normalizedName ||
        storageKey === tableName ||
        storageKey.endsWith('_' + tableName) ||
        normalizedKey.endsWith('_' + normalizedName) ||
        normalizedName.endsWith('_' + normalizedKey)
      if (!isSameTable) continue
      const pending = tableChanges.getPendingCreates(storageKey) ?? []
      for (const create of pending) {
        if (seenTempIds.has(create.tempId)) continue
        seenTempIds.add(create.tempId)
        pendingCreatesFromAllMatchingKeys.push(create)
      }
    }
    const createdRows = pendingCreatesFromAllMatchingKeys.map(
      ({ tempId, data: rowData }) => ({
        ...rowData,
        id: tempId,
      }),
    )
    return [...baseList, ...createdRows]
  }

  /**
   * Find table config by table name.
   * Tries exact key first, then match by normalized key or key ending with _tableName,
   */
  const findTableConfigByTableName = (
    configurations: {
      masterData?: Record<string, any>
      inputData?: Record<string, any>
      resultsData?: Record<string, any>
    },
    tableName: string,
  ): any => {
    if (!configurations || !tableName) return null
    const normalizedName = normalizeTableKeyForStorage(tableName)
    const sections = [
      configurations.masterData,
      configurations.inputData,
      configurations.resultsData,
    ] as (Record<string, any> | undefined)[]
    for (const section of sections) {
      if (!section) continue
      if (section[tableName]) return section[tableName]
      for (const [key] of Object.entries(section)) {
        const normalizedKey = normalizeTableKeyForStorage(key)
        if (normalizedKey === normalizedName) return section[key]
        if (key.endsWith('_' + tableName) || key.endsWith('_' + normalizedName))
          return section[key]
        if (normalizedName.endsWith('_' + normalizedKey)) return section[key]
      }
    }
    return null
  }

  // Function to load data from related tables (for foreign key selectors)
  const loadTableData = async (tableName: string): Promise<any[]> => {
    // Check if data is already cached (API data only)
    let baseData = tableDataCache.value[tableName]
    if (baseData === undefined) {
      try {
        const { default: TableRepository } = await import(
          '@/repositories/TableRepository'
        )

        // Get configurations from the general store
        const configurations = generalStore.getConfigurations
        if (!configurations) {
          console.warn('Table configurations not available')
          return []
        }

        // Find table config by exact key or normalized name
        const tableConfigFound = findTableConfigByTableName(
          configurations,
          tableName,
        )

        if (!tableConfigFound || !tableConfigFound.get_list) {
          console.warn(`Table configuration not found for: ${tableName}`)
          return []
        }

        // Create repository and load data
        const repository = new TableRepository(tableConfigFound, t)
        const data = await repository.getList()
        baseData = Array.isArray(data) ? data : []
        tableDataCache.value[tableName] = baseData
      } catch (error) {
        console.error(`Error loading data for table ${tableName}:`, error)
        return []
      }
    }
    return mergePendingCreatesIntoTableList(tableName, baseData)
  }

  /** Table data for forms: cache plus pending creates per table so dropdowns show new rows. */
  const tableDataWithPendingCreates = computed(() => {
    const cache = tableDataCache.value
    const merged: Record<string, any[]> = {}
    for (const tableName of Object.keys(cache)) {
      merged[tableName] = mergePendingCreatesIntoTableList(
        tableName,
        cache[tableName] || [],
      )
    }
    return merged
  })

  // Use form fields composable for data preparation
  const formFieldsComposable = useFormFields({
    fields: computed(() => {
      if (!tableConfig.value?.get_list?.response_schema?.items?.properties)
        return []

      const properties =
        tableConfig.value.get_list.response_schema.items.properties
      return Object.entries(properties).map(([key, prop]: [string, any]) => ({
        key,
        title: prop.title || key,
        type: prop.type === 'integer' ? 'number' : prop.type,
        required:
          prop.required ??
          tableConfig.value.get_list.response_schema.items.required?.includes(
            key,
          ) ??
          false,
        isForeignKey: prop.isForeignKey || false,
        isDependentField: prop.isDependentField || false,
        isMainSelector: prop.isMainSelector || false,
        joinFrom: prop.joinFrom || undefined,
        columnsToJoin: prop.columnsToJoin || undefined,
        foreignKeyField: prop.foreignKeyField || undefined,
        hidden: prop.hidden || false,
        readOnly: prop.readOnly || false,
        choices: prop.choices || undefined,
        format: prop.format || undefined,
      }))
    }),
    formData: computed(() => (isEditing.value ? formData.value : {})),
    mode: computed(() => (isEditing.value ? 'edit' : 'add')),
    loadTableData,
    tableData: tableDataWithPendingCreates,
  })

  // Filtered items based on active filters and search
  const filteredItems = computed(() => {
    const result = applyFiltersAndSearchUtil(
      items.value,
      searchValue.value,
      activeFilters.value as FilterCondition[],
    )

    return result
  })

  // Generate headers from table config for master tables
  const headers = computed(() => {
    if (!tableConfig.value?.get_list?.response_schema?.items?.properties)
      return []

    const properties =
      tableConfig.value.get_list.response_schema.items.properties
    const dataHeaders = Object.entries(properties)
      .filter(([key]) => key !== 'id') // Exclude id column from display
      .map(([key, prop]: [string, any]) => ({
        title: prop.title || key,
        value: key,
        key: key, // Add key property for CoreTable compatibility
        sortable: true,
        filterable: true,
        type: prop.type === 'integer' ? 'number' : prop.type,
        required:
          prop.required ??
          tableConfig.value.get_list.response_schema.items.required?.includes(
            key,
          ) ??
          false,
        // Foreign key properties
        isForeignKey: prop.isForeignKey || false,
        isDependentField: prop.isDependentField || false,
        isMainSelector: prop.isMainSelector || false,
        joinFrom: prop.joinFrom || undefined,
        columnsToJoin: prop.columnsToJoin || undefined,
        foreignKeyField: prop.foreignKeyField || undefined,
        hidden: prop.hidden || false,
        readOnly: prop.readOnly || false,
        // Choices property
        choices: prop.choices || undefined,
        format: prop.format || undefined,
      }))

    // Add selection column if selection is enabled
    const enableSelection =
      !shouldUseExecutionData.value &&
      (!!tableConfig.value?.delete_item || !!tableConfig.value?.delete_bulk)

    if (enableSelection) {
      const selectionHeader = {
        title: '',
        value: 'selection',
        key: 'selection',
        sortable: false,
        filterable: false,
        type: 'selection',
        required: false,
        width: '48px',
      }

      return [selectionHeader, ...dataHeaders]
    }

    return dataHeaders
  })

  // Get available filter fields from headers for master tables
  const availableFilterFields = computed(() => {
    return headers.value
      .filter((header) => header.value !== 'selection' && header.filterable)
      .map((header) => ({
        key: header.key || header.value,
        title: header.title,
        type: header.type,
        filterable: header.filterable,
        // Include foreign key properties for selector fields (with defaults for selection header)
        isForeignKey:
          'isForeignKey' in header ? header.isForeignKey : undefined,
        isDependentField:
          'isDependentField' in header ? header.isDependentField : undefined,
        isMainSelector:
          'isMainSelector' in header ? header.isMainSelector : undefined,
        joinFrom: 'joinFrom' in header ? header.joinFrom : undefined,
        columnsToJoin:
          'columnsToJoin' in header ? header.columnsToJoin : undefined,
        foreignKeyField:
          'foreignKeyField' in header ? header.foreignKeyField : undefined,
        hidden: 'hidden' in header ? header.hidden : undefined,
        readOnly: 'readOnly' in header ? header.readOnly : undefined,
      }))
  })

  /**
   * Helper: Check if field has a valid dependent value
   */
  const hasValidDependentValue = (prop: any, value: any): boolean => {
    return (
      prop.isDependentField &&
      prop.joinFrom &&
      value !== undefined &&
      value !== null &&
      value !== ''
    )
  }

  /**
   * Helper: Compare values for matching (handles string case-insensitivity)
   */
  const fieldValuesMatch = (fieldValue: any, rowValue: any): boolean => {
    if (typeof fieldValue === 'string' && typeof rowValue === 'string') {
      return fieldValue.toLowerCase() === rowValue.toLowerCase()
    }
    return fieldValue === rowValue
  }

  /**
   * Helper: Process a single dependent field in a row
   */
  const processRowDependentField = async (
    mappedRow: Record<string, any>,
    fieldKey: string,
    prop: any,
    properties: any,
  ): Promise<void> => {
    const foreignKeyField = getForeignKeyFieldName(fieldKey, { properties })
    if (!foreignKeyField) {
      delete mappedRow[fieldKey]
      return
    }

    const joinInfo = parseJoinFrom(prop.joinFrom)
    if (!joinInfo) {
      delete mappedRow[fieldKey]
      return
    }

    try {
      const relatedTableData = await loadTableData(joinInfo.table)
      const matchingItem = relatedTableData.find((item) =>
        fieldValuesMatch(item[joinInfo.field], mappedRow[fieldKey]),
      )

      if (matchingItem?.id !== undefined) {
        mappedRow[foreignKeyField] = matchingItem.id
      } else {
        console.warn(
          `No matching item found for ${fieldKey}="${mappedRow[fieldKey]}" in table ${joinInfo.table}`,
        )
      }
    } catch (error) {
      console.error(
        `Error loading related table ${joinInfo.table} for field ${fieldKey}:`,
        error,
      )
    }
    delete mappedRow[fieldKey]
  }

  // Map dependent fields to foreign key IDs
  const mapDependentFieldsToIds = async (parsedData: any[]): Promise<any[]> => {
    const properties =
      tableConfig.value?.get_list?.response_schema?.items?.properties
    if (!properties) return parsedData

    return Promise.all(
      parsedData.map(async (row) => {
        const mappedRow: Record<string, any> = { ...row }

        // Process dependent fields with values
        for (const [fieldKey, fieldProp] of Object.entries(properties)) {
          const prop = fieldProp as any
          if (hasValidDependentValue(prop, mappedRow[fieldKey])) {
            await processRowDependentField(
              mappedRow,
              fieldKey,
              prop,
              properties,
            )
          }
        }

        // Remove remaining dependent fields
        for (const [fieldKey, fieldProp] of Object.entries(properties)) {
          if ((fieldProp as any).isDependentField) {
            delete mappedRow[fieldKey]
          }
        }

        return mappedRow
      }),
    )
  }

  // Helper function to parse Excel files
  const parseExcelFile = async (file: File): Promise<any[]> => {
    try {
      const rows = await readXlsxFile(file)
      if (rows.length < 2) {
        throw new Error(
          'Excel file must have at least a header row and one data row',
        )
      }

      const headers = rows[0].map((header) => String(header).trim())

      return rows.slice(1).map((row) => {
        const obj: any = {}
        headers.forEach((header, index) => {
          const value = row[index]
          obj[header] = value === null || value === undefined ? '' : value
        })
        return obj
      })
    } catch (error) {
      console.error('Excel parsing error:', error)
      throw new Error(t('table.messages.fileProcessingError'))
    }
  }

  // Helper function to parse JSON content
  const parseJsonContent = (content: string): any[] => {
    const jsonData = JSON.parse(content)
    return Array.isArray(jsonData) ? jsonData : [jsonData]
  }

  // Helper function to parse CSV content
  const parseCsvContent = (content: string): any[] => {
    const lines = content.split('\n').filter((line) => line.trim())
    if (lines.length < 2) {
      throw new Error('Invalid CSV format')
    }

    const headers = lines[0].split(',').map((h) => h.trim())
    return lines.slice(1).map((line) => {
      const values = line.split(',').map((v) => v.trim())
      const obj: any = {}
      headers.forEach((header, index) => {
        const value = values[index]
        obj[header] = value === undefined ? '' : value
      })
      return obj
    })
  }

  // Helper function to read file as text and parse based on extension
  const parseTextFile = (file: File, extension: string): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()

      reader.onload = (e) => {
        try {
          const content = e.target!.result as string
          if (extension === 'json') {
            resolve(parseJsonContent(content))
          } else if (extension === 'csv') {
            resolve(parseCsvContent(content))
          } else {
            reject(new Error(t('table.messages.invalidFileFormat')))
          }
        } catch (error) {
          console.error('File parsing error:', error)
          const errorMessage =
            error instanceof Error
              ? error.message
              : t('table.messages.fileProcessingError')
          reject(new Error(errorMessage))
        }
      }

      reader.onerror = (error) => {
        console.error('File reading error:', error)
        reject(new Error(t('table.messages.fileProcessingError')))
      }

      reader.readAsText(file)
    })
  }

  // Parse upload file function
  const parseUploadFile = async (file: File): Promise<any[]> => {
    const extension = file.name.split('.').pop()?.toLowerCase()

    if (extension === 'xlsx' || extension === 'xls') {
      return parseExcelFile(file)
    }

    if (extension === 'json' || extension === 'csv') {
      return parseTextFile(file, extension)
    }

    throw new Error(t('table.messages.invalidFileFormat'))
  }

  // Load data function for master tables
  const loadData = async () => {
    if (!tableConfig.value || !tableConfig.value.get_list) {
      items.value = []
      return
    }

    const myLoadId = ++loadIdRef.value
    loading.value = true
    error.value = null

    try {
      const TableRepository = (await import('@/repositories/TableRepository'))
        .default
      const repository = new TableRepository(tableConfig.value, t)
      const data = await repository.getList()
      // Don't update state if this load was superseded or cancelled (e.g. user navigated away)
      if (myLoadId !== loadIdRef.value) return
      const baseItems = Array.isArray(data) ? data : []
      // Merge pending creates so they still appear after navigating away and back
      const storageKey = normalizeTableKeyForStorage(tableKey.value)
      const pending = tableChanges.getPendingCreates(storageKey) ?? []
      const createdRows = pending.map(({ tempId, data: rowData }) => ({
        ...rowData,
        id: tempId,
      }))
      items.value = [...baseItems, ...createdRows]
    } catch (err) {
      if (myLoadId !== loadIdRef.value) return
      console.error('Error in loadData:', err)
      error.value = 'Failed to load data'
      items.value = []
    } finally {
      if (myLoadId === loadIdRef.value) loading.value = false
    }
  }

  /** Call when the view is deactivated/unmounted so in-flight loadData does not update state. */
  const cancelLoadData = () => {
    loadIdRef.value++
  }

  // Watch for config changes (only for master tables)
  watch(
    tableConfig,
    (newConfig) => {
      // Don't load data if we're using execution data
      if (shouldUseExecutionData.value) {
        return
      }

      if (newConfig && newConfig.get_list) {
        loadData()
        // Preload joinFrom tables so tableData has them for resolving FK display (e.g. pending creates)
        const properties =
          newConfig.get_list?.response_schema?.items?.properties
        if (properties) {
          const tablesToLoad = new Set<string>()
          for (const prop of Object.values(properties) as any[]) {
            if (prop?.joinFrom && typeof prop.joinFrom === 'string') {
              const tableName = prop.joinFrom.split('.')[0]
              if (tableName) tablesToLoad.add(tableName)
            }
          }
          tablesToLoad.forEach((tableName) => loadTableData(tableName))
        }
      }
    },
    { immediate: true },
  )

  // When a staged create is reverted from the pending-changes modal, remove that row from items.
  // Watch a stable string key so we don't re-run on every tick (getPendingCreates returns new array ref each time).
  watch(
    () => {
      const creates =
        tableChanges.getPendingCreates(
          normalizeTableKeyForStorage(tableKey.value),
        ) || []
      return creates
        .map((c) => c.tempId)
        .sort()
        .join(',')
    },
    (newKey, oldKey) => {
      if (oldKey == null || oldKey === '') return
      const newIds = newKey ? newKey.split(',').filter(Boolean) : []
      const oldIds = oldKey ? oldKey.split(',').filter(Boolean) : []
      const currentSet = new Set(newIds)
      const removed = oldIds.filter((id: string) => !currentSet.has(id))
      if (removed.length > 0) {
        const removedSet = new Set(removed)
        items.value = items.value.filter(
          (i: any) => !removedSet.has(String(i.id)),
        )
      }
    },
  )

  // When a staged delete is reverted from the modal, reload so the row reappears.
  // Watch a stable string key so we don't re-run on every tick.
  watch(
    () => {
      const deletes =
        tableChanges.getPendingDeletes(
          normalizeTableKeyForStorage(tableKey.value),
        ) || []
      return deletes.sort().join(',')
    },
    (newKey, oldKey) => {
      if (oldKey == null || oldKey === '') return
      const newIds = newKey ? newKey.split(',').filter(Boolean) : []
      const oldIds = oldKey ? oldKey.split(',').filter(Boolean) : []
      const currentSet = new Set(newIds)
      const reverted = oldIds.filter((id: string) => !currentSet.has(id))
      if (reverted.length > 0 && !shouldUseExecutionData.value) {
        loadData()
      }
    },
  )

  // Event handlers (simplified for master tables)
  const handleSearch = (value: string) => {
    searchValue.value = value
  }

  // Filtered items for execution data (applying filters and search to execution data)
  const filteredExecutionItems = computed(() => {
    if (!shouldUseExecutionData.value) return []

    return applyFiltersAndSearchUtil(
      executionTableData.items.value,
      searchValue.value,
      activeFilters.value as FilterCondition[],
    )
  })

  // Dynamic computed properties that switch between execution and master data
  const dynamicItems = computed(() => {
    if (shouldUseExecutionData.value) {
      return filteredExecutionItems.value
    } else {
      return filteredItems.value
    }
  })

  const dynamicHeaders = computed(() => {
    if (shouldUseExecutionData.value) {
      return executionTableData.headers.value
    } else {
      return headers.value
    }
  })

  const dynamicLoading = computed(() => {
    if (shouldUseExecutionData.value) {
      return executionTableData.loading.value
    } else {
      return loading.value
    }
  })

  const dynamicTableTitle = computed(() => {
    if (shouldUseExecutionData.value) {
      return executionTableData.tableTitle.value
    } else {
      return tableConfig.value?.title || tableKey.value || 'Table'
    }
  })

  const dynamicAvailableFilterFields = computed(() => {
    if (shouldUseExecutionData.value) {
      return executionTableData.availableFilterFields.value
    } else {
      return availableFilterFields.value
    }
  })

  const dynamicError = computed(() => {
    if (shouldUseExecutionData.value) {
      return null
    } else {
      return error.value
    }
  })

  const dynamicIsPrimitiveArray = computed(() => {
    if (shouldUseExecutionData.value) {
      return executionTableData.isPrimitiveArray.value
    } else {
      return false
    }
  })

  // Helper to download master table data as Excel
  const downloadMasterTableExcel = async () => {
    if (!tableConfig.value || !tableConfig.value.get_list) {
      showSnackbar(t('table.messages.errorDownloadExcelTable'), 'error')
      return
    }

    downloading.value = true
    try {
      const tableName = tableKey.value
      const tableTitle = tableConfig.value.title || tableName
      const dataToExport = filteredItems.value

      await exportTableToExcel(
        dataToExport,
        tableConfig.value,
        tableName,
        tableTitle,
        t,
      )

      showSnackbar(t('table.messages.downloadExcelSuccess'), 'success')
    } catch (err) {
      console.error('Error downloading Excel:', err)
      const errorMessage =
        err instanceof Error
          ? err.message
          : t('table.messages.errorDownloadExcelTable')
      showSnackbar(errorMessage, 'error')
    } finally {
      downloading.value = false
    }
  }

  // Helper to create mock config for primitive arrays
  const createPrimitiveArrayConfig = () => ({
    get_list: {
      response_schema: {
        items: {
          properties: {
            value: {
              type: 'string',
              title: 'Value',
            },
          },
          required: [],
        },
      },
    },
  })

  // Helper to determine field type from value
  const getFieldType = (value: any): string => {
    if (typeof value === 'number') {
      return Number.isInteger(value) ? 'integer' : 'number'
    }
    if (typeof value === 'boolean') {
      return 'boolean'
    }
    return 'string'
  }

  // Helper to create mock config from data structure
  const createMockConfigFromData = (dataToExport: any[]): any => {
    if (!dataToExport || dataToExport.length === 0) {
      return {
        get_list: {
          response_schema: {
            items: {
              properties: {},
              required: [],
            },
          },
        },
      }
    }

    const properties: Record<string, any> = {}
    Object.keys(dataToExport[0]).forEach((key) => {
      if (key !== 'id' && !key.endsWith('_id')) {
        const value = dataToExport[0][key]
        properties[key] = {
          type: getFieldType(value),
          title: key,
        }
      }
    })

    return {
      get_list: {
        response_schema: {
          items: {
            properties,
            required: [],
          },
        },
      },
    }
  }

  // Helper to download execution data as Excel
  const downloadExecutionDataExcel = async () => {
    downloading.value = true
    try {
      const tableName = tableKey.value
      const tableTitle = executionTableData.tableTitle.value || tableName
      const dataToExport = executionTableData.items.value
      const isPrimitive = executionTableData.isPrimitiveArray.value

      // Handle primitive arrays (list of strings)
      const isPrimitiveStringArray =
        isPrimitive &&
        Array.isArray(dataToExport) &&
        dataToExport.length > 0 &&
        typeof dataToExport[0] === 'string'

      if (isPrimitiveStringArray) {
        const mockConfig = createPrimitiveArrayConfig()
        const transformedData = dataToExport.map((item, index) => ({
          id: index,
          value: item,
        }))

        await exportTableToExcel(
          transformedData,
          mockConfig,
          tableName,
          tableTitle,
          t,
        )
      } else {
        // For object arrays, use existing config or create mock
        const configToUse = tableConfig.value?.get_list?.response_schema
          ? tableConfig.value
          : createMockConfigFromData(dataToExport)

        await exportTableToExcel(
          dataToExport,
          configToUse,
          tableName,
          tableTitle,
          t,
        )
      }

      showSnackbar(t('table.messages.downloadExcelSuccess'), 'success')
    } catch (err) {
      console.error('Error downloading execution Excel:', err)
      const errorMessage =
        err instanceof Error
          ? err.message
          : t('table.messages.errorDownloadExcelTable')
      showSnackbar(errorMessage, 'error')
    } finally {
      downloading.value = false
    }
  }

  // Local ref so getRowClass (and other handlers) can access it in closure
  const enableExcelMode = computed(
    () => !shouldUseExecutionData.value && !!tableConfig.value?.put_item,
  )

  return {
    // Dynamic data that switches automatically
    items: dynamicItems,
    headers: dynamicHeaders,
    loading: dynamicLoading,
    error: dynamicError,
    tableTitle: dynamicTableTitle,
    availableFilterFields: dynamicAvailableFilterFields,
    isPrimitiveArray: dynamicIsPrimitiveArray,
    isValidationMessageList: computed(
      () =>
        shouldUseExecutionData.value &&
        !!executionTableData.isValidationMessageList?.value,
    ),
    searchPlaceholder: computed(() => t('table.searchPlaceholder')),
    enableSearch: computed(() => true),
    enableFilters: computed(() => true),
    enableSelection: computed(() => {
      const result =
        !shouldUseExecutionData.value &&
        (!!tableConfig.value?.delete_item || !!tableConfig.value?.delete_bulk)

      return result
    }),
    enableActions: computed(() => !shouldUseExecutionData.value),
    enableBulkActions: computed(
      () =>
        !shouldUseExecutionData.value &&
        (!!tableConfig.value?.delete_item || !!tableConfig.value?.delete_bulk),
    ),
    canAdd: computed(
      () => !shouldUseExecutionData.value && !!tableConfig.value?.post_item,
    ),
    canEdit: computed(
      () => !shouldUseExecutionData.value && !!tableConfig.value?.put_item,
    ),
    canDelete: computed(
      () =>
        !shouldUseExecutionData.value &&
        (!!tableConfig.value?.delete_item || !!tableConfig.value?.delete_bulk),
    ),
    canBulkUpload: computed(
      () => !shouldUseExecutionData.value && !!tableConfig.value?.post_bulk,
    ),
    canDownloadExcel: computed(() => true),
    // Excel-like mode for master tables (accumulate changes, save all via TableRepository)
    enableExcelMode,
    isCellModified: (rowId: string | number, fieldKey: string) =>
      tableChanges.isCellModified(
        normalizeTableKeyForStorage(tableKey.value),
        rowId,
        fieldKey,
      ),
    getModifiedValue: (rowId: string | number, fieldKey: string) => {
      const item = dynamicItems.value.find(
        (i: any) => String(i.id) === String(rowId),
      )
      return tableChanges.getCurrentValue(
        normalizeTableKeyForStorage(tableKey.value),
        rowId,
        fieldKey,
        item?.[fieldKey],
      )
    },
    handleCellChange: (
      tableKeyArg: string,
      rowId: string | number,
      fieldKey: string,
      oldValue: any,
      newValue: any,
    ) => {
      // Use the table key from the event (the table that emitted the change), not the current
      // ref value, so changes are stored under the correct tab when switching tabs quickly.
      const rawKey = tableKeyArg ?? tableKey.value ?? ''
      if (!rawKey) return

      // Normalize so URL format and config format match
      const keyToUse = normalizeTableKeyForStorage(rawKey)

      const header = dynamicHeaders.value.find((h: any) => h.key === fieldKey)
      const fieldTitle = header?.title || fieldKey
      const tableTitle = tableConfig.value?.title || rawKey

      tableChanges.setTableTitle(keyToUse, tableTitle)
      tableChanges.recordChange(
        keyToUse,
        rowId,
        fieldKey,
        oldValue,
        newValue,
        fieldTitle,
        tableTitle,
      )
    },
    hasPendingChanges: computed(() => {
      const storageKey = normalizeTableKeyForStorage(tableKey.value)
      return (
        tableChanges.isTableModified(storageKey) ||
        tableChanges.getPendingCreates(storageKey).length > 0 ||
        tableChanges.getPendingDeletes(storageKey).length > 0
      )
    }),
    pendingChangesCount: computed(() => {
      const storageKey = normalizeTableKeyForStorage(tableKey.value)
      const changes = tableChanges.getChangesForTable(storageKey)
      let cellCount = 0
      if (changes) {
        cellCount = Object.values(changes).reduce(
          (sum, row) => sum + Object.keys(row).length,
          0,
        )
      }
      const createsCount = tableChanges.getPendingCreates(storageKey).length
      const deletesCount = tableChanges.getPendingDeletes(storageKey).length
      return cellCount + createsCount + deletesCount
    }),
    rowsDataForModal: computed(() => {
      const storageKey = normalizeTableKeyForStorage(tableKey.value)
      const headers = dynamicHeaders.value
      const refData = tableDataWithPendingCreates.value
      const enrich = (item: any) => {
        let out = item
        for (const header of headers) {
          const h = header as any
          if (
            !h?.joinFrom ||
            !h?.foreignKeyField ||
            (item[header.key] != null && item[header.key] !== '')
          )
            continue
          const fkId = item[h.foreignKeyField]
          if (fkId == null) continue
          const joinInfo = parseJoinFrom(h.joinFrom)
          if (!joinInfo) continue
          const tableRows = refData[joinInfo.table]
          if (!Array.isArray(tableRows)) continue
          const refRow = tableRows.find(
            (r: any) =>
              String(r?.id) === String(fkId) ||
              String(r?.[h.foreignKeyField]) === String(fkId),
          )
          if (refRow && joinInfo.field in refRow) {
            if (out === item) out = { ...item }
            ;(out as any)[header.key] = refRow[joinInfo.field]
          }
        }
        return out
      }
      return {
        [storageKey]: Object.fromEntries(
          dynamicItems.value.map((item: any) => [
            String(item.id),
            enrich(item),
          ]),
        ),
      }
    }),
    tableHeadersForModal: computed(() => {
      const storageKey = normalizeTableKeyForStorage(tableKey.value)
      return { [storageKey]: dynamicHeaders.value }
    }),
    /** Row class for pending changes: row-new (green), row-deleted (red). Only when Excel mode. */
    getRowClass: (item: any): string => {
      if (!enableExcelMode.value) return ''
      const storageKey = normalizeTableKeyForStorage(tableKey.value)
      return tableChanges.getRowClass(storageKey, item)
    },
    searchValue,
    activeFilters,
    selectedItems,
    showAddEditModal,
    showDeleteDialog,
    showBulkDeleteDialog,
    showBulkUploadModal,
    formFields: computed(() => {
      if (!tableConfig.value?.get_list?.response_schema?.items?.properties)
        return []

      const properties =
        tableConfig.value.get_list.response_schema.items.properties
      return Object.entries(properties)
        .filter(([key]) => key !== 'id') // Exclude id from form fields
        .map(([key, prop]: [string, any]) => ({
          key,
          title: prop.title || key,
          type: prop.type === 'integer' ? 'number' : prop.type,
          required:
            prop.required ??
            tableConfig.value.get_list.response_schema.items.required?.includes(
              key,
            ) ??
            false,
          // Foreign key properties
          isForeignKey: prop.isForeignKey || false,
          isDependentField: prop.isDependentField || false,
          isMainSelector: prop.isMainSelector || false,
          joinFrom: prop.joinFrom || undefined,
          columnsToJoin: prop.columnsToJoin || undefined,
          foreignKeyField: prop.foreignKeyField || undefined,
          hidden: prop.hidden || false,
          readOnly: prop.readOnly || false,
          // Choices property for select fields
          choices: prop.choices || undefined,
          format: prop.format || undefined,
        }))
    }),
    formData,
    isEditing,
    saving,
    deleting,
    bulkDeleting,
    uploading,
    downloading,
    editingRowId,
    editingData,
    originalData,
    isEditingAnyRow: computed(() => editingRowId.value !== null),

    // Foreign key data loading
    loadTableData,
    tableData: tableDataWithPendingCreates,
    invalidateTableDataCache,

    // Filter functions
    getOperatorsForFieldType,
    getOperatorText,
    operatorNeedsValue,
    operatorNeedsSecondValue,
    generateFilterId,

    // Event handlers (simplified)
    handleSearch,
    handleAddFilter: (filter: any) => {
      if (!filter || !filter.field || !filter.operator) return

      // Add unique ID if not present
      if (!filter.id) {
        filter.id = generateFilterId()
      }

      // Add filter to active filters
      activeFilters.value.push(filter)
    },
    handleRemoveFilter: (filterId: string) => {
      const index = activeFilters.value.findIndex((f) => f.id === filterId)
      if (index >= 0) {
        activeFilters.value.splice(index, 1)
      }
    },
    handleClearAllFilters: () => {
      activeFilters.value = []
    },
    handleToggleFiltersPanel: (show: boolean) => {
      // This is handled by CoreTable internally
    },
    handleSelectItem: (item: any) => {
      const index = selectedItems.value.findIndex(
        (selected) => selected.id === item.id,
      )
      if (index >= 0) {
        selectedItems.value.splice(index, 1)
      } else {
        selectedItems.value.push(item)
      }
    },
    handleSelectAll: (selectAll: boolean) => {
      if (selectAll) {
        selectedItems.value = [...items.value]
      } else {
        selectedItems.value = []
      }
    },
    handleClearSelection: () => {
      selectedItems.value = []
    },
    handleAddItem: () => {
      showAddEditModal.value = true
      isEditing.value = false
      formData.value = {}
    },
    handleEditItem: (item: any) => {
      showAddEditModal.value = true
      isEditing.value = true
      formData.value = { ...item }
    },
    handleDeleteItem: (item: any) => {
      formData.value = { ...item } as any
      showDeleteDialog.value = true
    },
    handleBulkDelete: () => {
      if (selectedItems.value.length > 0) {
        showBulkDeleteDialog.value = true
      }
    },
    handleSaveItem: async () => {
      if (!tableConfig.value) return

      saving.value = true
      try {
        const wasEditing = isEditing.value
        const mode = wasEditing ? 'edit' : 'add'

        // Resolve display values (join_from) to foreign key IDs before preparing payload
        const rawData = { ...(formData.value as Record<string, any>) }
        const resolvedData = await resolveDisplayValuesToFkIds(
          rawData,
          tableConfig.value,
          loadTableData,
        )

        // Use composable to prepare data (filters dependent fields and handles id)
        const preparedData = formFieldsComposable.prepareFormDataForSubmit(
          resolvedData as any,
          mode,
        )

        // Master tables in Excel mode: stage add (no API until "Save all" in pending changes modal)
        if (enableExcelMode.value && !wasEditing) {
          const storageKey = normalizeTableKeyForStorage(tableKey.value)
          const tableTitle = tableConfig.value?.title || tableKey.value
          const tempId = tableChanges.recordCreate(
            storageKey,
            preparedData as Record<string, any>,
            tableTitle,
          )
          items.value = [...items.value, { ...preparedData, id: tempId } as any]
          showAddEditModal.value = false
          formData.value = {}
          isEditing.value = false
          showSnackbar(t('pendingChanges.changeStaged'), 'success')
          saving.value = false
          return
        }

        const { default: TableRepository } = await import(
          '@/repositories/TableRepository'
        )
        const repository = new TableRepository(tableConfig.value, t)

        if (wasEditing) {
          const id = (formData.value as any).id
          await repository.putItem(id, preparedData)
        } else {
          await repository.createItem(preparedData)
        }

        const reloadedData = await repository.getList()
        items.value = Array.isArray(reloadedData) ? reloadedData : []
        showAddEditModal.value = false
        formData.value = {}
        isEditing.value = false

        showSnackbar(
          wasEditing
            ? t('table.messages.itemUpdated')
            : t('table.messages.itemCreated'),
          'success',
        )
      } catch (err) {
        console.error('Error saving item:', err)
        error.value = err instanceof Error ? err.message : 'Error saving item'
        showSnackbar(
          err instanceof Error ? err.message : t('table.messages.errorSaving'),
          'error',
        )
      } finally {
        saving.value = false
      }
    },
    handleBulkUpload: async (uploadData: {
      files: File[]
      operation: string
    }) => {
      if (!uploadData || !uploadData.files || uploadData.files.length === 0) {
        showSnackbar(t('table.messages.errorBulkUpload'), 'error')
        return
      }

      uploading.value = true
      try {
        // Get the first file (modal is set to multiple=false)
        const file = uploadData.files[0]

        // Parse the file
        const parsedData = await parseUploadFile(file)

        if (!Array.isArray(parsedData) || parsedData.length === 0) {
          throw new Error(t('table.messages.noValidDataFound'))
        }

        // Map dependent fields to foreign key IDs (similar to edit operation)
        const mappedData = await mapDependentFieldsToIds(parsedData)

        if (!Array.isArray(mappedData) || mappedData.length === 0) {
          throw new Error(t('table.messages.noValidDataFound'))
        }

        // Get repository
        const { default: TableRepository } = await import(
          '@/repositories/TableRepository'
        )
        const repository = new TableRepository(tableConfig.value, t)

        // Call the appropriate method based on the operation
        if (uploadData.operation === 'overwrite_all') {
          await repository.overwriteAll(mappedData)
        } else {
          // Default to post_bulk
          await repository.createBulk(mappedData)
        }

        // Reload data and close modal
        const reloadedData = await repository.getList()
        items.value = Array.isArray(reloadedData) ? reloadedData : []
        showBulkUploadModal.value = false

        // Show success message
        showSnackbar(t('table.messages.bulkUploadSuccess'), 'success')
      } catch (err) {
        console.error('Error in bulk upload:', err)
        error.value =
          err instanceof Error
            ? err.message
            : t('table.messages.errorBulkUpload')
        showSnackbar(
          err instanceof Error
            ? err.message
            : t('table.messages.errorBulkUpload'),
          'error',
        )
      } finally {
        uploading.value = false
      }
    },
    handleDownloadExcel: async () => {
      if (!shouldUseExecutionData.value) {
        await downloadMasterTableExcel()
      } else {
        await downloadExecutionDataExcel()
      }
    },
    handleConfirmDelete: async () => {
      if (!tableConfig.value || !(formData.value as any)?.id) return

      const id = (formData.value as any).id

      // Master tables in Excel mode: stage delete (row stays visible in red until Save all)
      if (enableExcelMode.value) {
        const storageKey = normalizeTableKeyForStorage(tableKey.value)
        const isPendingCreate =
          typeof id === 'string' && String(id).startsWith('create-')

        if (isPendingCreate) {
          // Row was only a pending create (not saved): revert the create and remove from list; no delete to stage
          tableChanges.revertCreate(storageKey, id)
          items.value = items.value.filter((i: any) => String(i?.id) !== String(id))
          showDeleteDialog.value = false
          formData.value = {}
          showSnackbar(t('pendingChanges.createReverted'), 'success')
          return
        }

        const rowData = formData.value as Record<string, any>
        tableChanges.recordDelete(storageKey, id, rowData)
        showDeleteDialog.value = false
        formData.value = {}
        showSnackbar(t('pendingChanges.changeStaged'), 'success')
        return
      }

      deleting.value = true
      try {
        const { default: TableRepository } = await import(
          '@/repositories/TableRepository'
        )
        const repository = new TableRepository(tableConfig.value, t)

        await repository.deleteItem(id)

        const reloadedData = await repository.getList()
        items.value = Array.isArray(reloadedData) ? reloadedData : []
        showDeleteDialog.value = false
        formData.value = {}

        showSnackbar(t('table.messages.itemDeleted'), 'success')
      } catch (err) {
        console.error('Error deleting item:', err)
        error.value = err instanceof Error ? err.message : 'Error deleting item'
        showSnackbar(
          err instanceof Error
            ? err.message
            : t('table.messages.errorDeleting'),
          'error',
        )
      } finally {
        deleting.value = false
      }
    },
    handleConfirmBulkDelete: async () => {
      if (!tableConfig.value || selectedItems.value.length === 0) return

      // Master tables in Excel mode: stage deletes (rows stay visible in red until Save all)
      if (enableExcelMode.value) {
        const storageKey = normalizeTableKeyForStorage(tableKey.value)
        const pendingCreateIds = new Set(
          selectedItems.value
            .filter(
              (item: any) =>
                typeof item?.id === 'string' &&
                String(item.id).startsWith('create-'),
            )
            .map((item: any) => String(item.id)),
        )
        const realRows = selectedItems.value.filter(
          (item: any) => !pendingCreateIds.has(String(item?.id)),
        )

        // Revert pending creates: remove from creates list and from items
        pendingCreateIds.forEach((tempId) => {
          tableChanges.revertCreate(storageKey, tempId)
        })
        if (pendingCreateIds.size > 0) {
          items.value = items.value.filter(
            (i: any) => !pendingCreateIds.has(String(i?.id)),
          )
        }

        // Stage deletes only for rows that exist on the server
        realRows.forEach((item: any) =>
          tableChanges.recordDelete(storageKey, item.id, item),
        )

        selectedItems.value = []
        showBulkDeleteDialog.value = false
        showSnackbar(t('pendingChanges.changeStaged'), 'success')
        return
      }

      bulkDeleting.value = true
      try {
        const { default: TableRepository } = await import(
          '@/repositories/TableRepository'
        )
        const repository = new TableRepository(tableConfig.value, t)

        const idsToDelete = selectedItems.value.map((item) => item.id)
        await repository.deleteBulk(idsToDelete)

        const reloadedData = await repository.getList()
        items.value = Array.isArray(reloadedData) ? reloadedData : []
        selectedItems.value = []
        showBulkDeleteDialog.value = false

        showSnackbar(t('table.messages.itemsDeleted'), 'success')
      } catch (err) {
        console.error('Error deleting items:', err)
        error.value =
          err instanceof Error ? err.message : 'Error deleting items'
        showSnackbar(
          err instanceof Error
            ? err.message
            : t('table.messages.errorDeletingItems'),
          'error',
        )
      } finally {
        bulkDeleting.value = false
      }
    },
    handleCancelDelete: () => {
      showDeleteDialog.value = false
    },
    handleCancelBulkDelete: () => {
      showBulkDeleteDialog.value = false
    },
    handleCancelBulkUpload: () => {
      showBulkUploadModal.value = false
    },
    startInlineEdit: (item: any) => {
      editingRowId.value = item.id
      editingData.value = { ...item }
      originalData.value = { ...item }
    },
    saveInlineEdit: async () => {
      if (!tableConfig.value || !editingRowId.value) return

      saving.value = true
      try {
        const { default: TableRepository } = await import(
          '@/repositories/TableRepository'
        )
        const repository = new TableRepository(tableConfig.value, t)

        // Resolve display values (join_from) to foreign key IDs before preparing payload
        const rawData = { ...(editingData.value as Record<string, any>) }
        const resolvedData = await resolveDisplayValuesToFkIds(
          rawData,
          tableConfig.value,
          loadTableData,
        )

        // Use composable to prepare data (filters dependent fields and excludes id)
        const preparedData = formFieldsComposable.prepareFormDataForSubmit(
          resolvedData as any,
          'edit',
        )

        await repository.putItem(editingRowId.value, preparedData)

        // Update local data and reset editing state
        const itemIndex = items.value.findIndex(
          (item) => item.id === editingRowId.value,
        )
        if (itemIndex >= 0) {
          items.value[itemIndex] = { ...editingData.value }
        }

        editingRowId.value = null
        editingData.value = {}
        originalData.value = {}

        // Show success message
        showSnackbar(t('table.messages.itemUpdated'), 'success')
      } catch (err) {
        console.error('Error saving inline edit:', err)
        error.value =
          err instanceof Error ? err.message : 'Error saving changes'
        showSnackbar(
          err instanceof Error ? err.message : t('table.messages.errorSaving'),
          'error',
        )
      } finally {
        saving.value = false
      }
    },
    cancelInlineEdit: () => {
      editingRowId.value = null
      editingData.value = {}
      originalData.value = {}
    },
    saveAllChanges: async () => {
      if (shouldUseExecutionData.value) return
      const config = tableConfig.value
      const storageKey = normalizeTableKeyForStorage(tableKey.value)
      const edits = tableChanges.getChangesForTable(storageKey)
      const hasEdits = edits && Object.keys(edits).length > 0
      const hasCreates = tableChanges.getPendingCreates(storageKey).length > 0
      const hasDeletes = tableChanges.getPendingDeletes(storageKey).length > 0
      if (!hasEdits && !hasCreates && !hasDeletes) return

      saving.value = true
      try {
        const { default: TableRepository } = await import(
          '@/repositories/TableRepository'
        )
        const repository = new TableRepository(config, t)

        // 1. Pending deletes
        const deletes = tableChanges.getPendingDeletes(storageKey)
        if (config?.delete_item && deletes.length > 0) {
          for (const rowId of deletes) {
            await repository.deleteItem(rowId)
          }
          tableChanges.clearDeletesForTable(storageKey)
        }

        // 2. Pending creates
        const creates = tableChanges.getPendingCreates(storageKey)
        if (config?.post_item && creates.length > 0) {
          for (const { data } of creates) {
            const { id: _id, ...rawPayload } = data
            const payloadWithIds = await resolveDisplayValuesToFkIds(
              rawPayload,
              config,
              loadTableData,
            )
            await repository.createItem(payloadWithIds)
          }
          tableChanges.clearCreatesForTable(storageKey)
        }

        // 3. Cell edits
        const changes = tableChanges.getChangesForTable(storageKey)
        if (config?.put_item && changes && Object.keys(changes).length > 0) {
          const currentItems = await repository.getList()
          for (const [rowId, rowChanges] of Object.entries(changes)) {
            const row = currentItems.find((i: any) => String(i.id) === rowId)
            if (!row) continue
            const merged = { ...row }
            Object.entries(rowChanges).forEach(
              ([fieldKey, change]: [string, any]) => {
                merged[fieldKey] = change.newValue
              },
            )
            const mergedWithFkIds = await resolveDisplayValuesToFkIds(
              merged as Record<string, any>,
              config,
              loadTableData,
            )
            const preparedData = formFieldsComposable.prepareFormDataForSubmit(
              mergedWithFkIds as any,
              'edit',
            )
            await repository.putItem(rowId, preparedData)
          }
          tableChanges.revertTableChanges(storageKey)
        }

        await loadData()
        showSnackbar(t('table.messages.itemUpdated'), 'success')
        invalidateTableDataCache(storageKey)
      } catch (err) {
        console.error('Error saving all changes:', err)
        error.value =
          err instanceof Error ? err.message : 'Error saving changes'
        showSnackbar(
          err instanceof Error ? err.message : t('table.messages.errorSaving'),
          'error',
        )
        throw err
      } finally {
        saving.value = false
      }
    },
    clearPendingChanges: () => {
      tableChanges.revertTableChanges(
        normalizeTableKeyForStorage(tableKey.value),
      )
    },
    updateInlineField: (field: string, value: any) => {
      // Update the field and handle dependent fields (foreign keys)
      const updatedData = { ...editingData.value, [field]: value }

      // Use composable to update dependent fields if this is a selector field
      const finalData = formFieldsComposable.updateDependentFields(
        field,
        value,
        updatedData,
      )

      editingData.value = finalData
    },
    handleConfirmBulkUpload: async (data: any[]) => {
      if (!tableConfig.value || !data?.length) return

      uploading.value = true
      try {
        const { default: TableRepository } = await import(
          '@/repositories/TableRepository'
        )
        const repository = new TableRepository(tableConfig.value, t)

        await repository.createBulk(data)

        // Reload data and close modal
        const reloadedData = await repository.getList()
        items.value = Array.isArray(reloadedData) ? reloadedData : []
        showBulkUploadModal.value = false

        // Show success message
        showSnackbar(t('table.messages.bulkUploadSuccess'), 'success')
      } catch (err) {
        console.error('Error in bulk upload:', err)
        error.value =
          err instanceof Error ? err.message : 'Error uploading data'
        showSnackbar(
          err instanceof Error
            ? err.message
            : t('table.messages.errorBulkUpload'),
          'error',
        )
      } finally {
        uploading.value = false
      }
    },
    loadData: async () => {
      if (shouldUseExecutionData.value) return

      if (!tableConfig.value?.get_list) return

      await loadData()
    },
    cancelLoadData,
  }
}
