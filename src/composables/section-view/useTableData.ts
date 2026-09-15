import { ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { showSnackbar } from '@cornflow-ui/core/services/SnackbarService'
import { useExecutionTableData } from './useExecutionTableData'
import {
  getSectionType,
  getDateRangeFilterConfigs,
  getDefaultListQueryParams,
  getGetListQueryParameters,
  getDefaultListLimit,
  getListDeclaresLimitParam,
  getListDeclaresOffsetParam,
  getGlobalSearchQueryParameterName,
  filterTypeMatchesUiOperator,
  isOperationSupported,
  isValidationLikeGroup,
} from '@cornflow-ui/core/services/FrontendAutomationService'
import { TableOperation } from '@cornflow-ui/core/types/table'
import { useGeneralStore } from '@cornflow-ui/core/stores/general'
import { useRecalculationController } from '@cornflow-ui/core/composables/section-view/useRecalculationController'
import { useTableChanges } from '@cornflow-ui/core/composables/useTableChanges'
import type { Ref, ComputedRef } from 'vue'
import {
  getOperatorsForFieldType,
  getOperatorText as getOperatorTextUtil,
  operatorNeedsValue,
  operatorNeedsSecondValue,
  generateFilterId,
  applyFiltersAndSearch as applyFiltersAndSearchUtil,
  type FilterCondition,
} from '@cornflow-ui/core/utils/tableFilterUtils'
import { useFormFields } from '@cornflow-ui/core/composables/core-table/useFormFields'
import { exportTableToExcel } from '@cornflow-ui/core/utils/data_io'
import * as ExcelJS from 'exceljs'
import {
  parseJoinFrom,
  displayValueMatchesValueNone,
  getListResponseRowProperties,
  normalizeGetListResponseToRows,
  isMasterDataParameterObjectTable,
  isParameterPropertySchemaVisible,
  normalizeJsonSchemaPropertyTypeForUi,
} from '@cornflow-ui/core/utils/schemaUtils'
import { isForceRetryOfferError } from '@cornflow-ui/core/repositories/TableRepository'
import type { AsyncUploadStatusResponse } from '@cornflow-ui/core/types/frontendAutomation'
import {
  detectDelimiter,
  parseCsvContent as parseCsvWithDelimiter,
} from '@cornflow-ui/core/utils/csvUtils'
import appConfig from '@/app/config'

/** Plain (non-object) cell value produced when flattening spreadsheet cells. */
type PlainCellValue = string | number | boolean

/** Shared cache for table data (referenced tables loaded via loadTableData). Used so cache can be invalidated across composable instances. */
const sharedTableDataCache: Record<string, any[]> = {}

/**
 * Invalidates the cached data for a table so the next loadTableData for that table will refetch.
 * Call after saving/changing a table so selectors and joined data elsewhere see fresh data.
 */
export function invalidateTableDataCache(tableKey: string): void {
  if (tableKey) {
    delete sharedTableDataCache[tableKey]
  }
}

/** Clears all cached table rows (e.g. after a global master-data upload). */
export function invalidateAllTableDataCaches(): void {
  for (const key of Object.keys(sharedTableDataCache)) {
    delete sharedTableDataCache[key]
  }
}

/**
 * Maps a JSON-schema property entry to the common field descriptor shared by
 * form-field and header builders (title, type, required, foreign-key info, choices).
 * Callers spread the result and add their own extra keys (e.g. valueNone, value/sortable).
 */
function buildFieldDescriptorFromProperty(
  key: string,
  prop: any,
  requiredList: string[],
) {
  return {
    key,
    title: prop.title || key,
    type: normalizeJsonSchemaPropertyTypeForUi(prop),
    required: requiredList.includes(key) || false,
    isForeignKey: prop.isForeignKey || false,
    isDependentField: prop.isDependentField || false,
    isMainSelector: prop.isMainSelector || false,
    joinFrom: prop.joinFrom || undefined,
    columnsToJoin: prop.columnsToJoin || undefined,
    foreignKeyField: prop.foreignKeyField || undefined,
    hidden: prop.hidden || false,
    frontendReadOnly: prop.frontendReadOnly || false,
    choices: prop.choices || undefined,
  }
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
    return String(key).toLowerCase().replaceAll('-', '_')
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
  // Recalculation controller injected by the premium module (§3.7); inert if no module is present.
  const recalculation = useRecalculationController()

  /** After master-data bulk/overwrite: POST `/update-plan-data/` then pending replan only if plan is outdated. */
  const maybeRequestMasterRecalculationPending = async () => {
    if (sectionType.value !== 'configuration') return
    if (appConfig.getCore().parameters.enableRecalculationOnMasterEdit !== true)
      return
    await recalculation.checkPlanDataAfterMasterDataChange()
  }

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
      return !!dataSource.dataChecks?.[tableKey.value]
    }

    if (executionType.value === 'solution') {
      const tc = tableConfig.value as {
        _isFromRawKpis?: boolean
        _rawKpisSourceKey?: string
      }
      if (tc?._isFromRawKpis) {
        const rk = dataSource.rawKpis
        const sk = tc._rawKpisSourceKey ?? tableKey.value
        return !!(rk && typeof rk === 'object' && sk in rk && rk[sk] != null)
      }
    }

    return !!dataSource.data?.[tableKey.value]
  })

  // Debug log to understand the decision
  const shouldUseExecutionData = computed(
    () =>
      isExecutionData.value &&
      executionType.value &&
      hasTableExecutionData.value,
  )

  /**
   * When enableSolutionRecalculation is on, execution data tables become editable in Excel mode
   * so changes are staged via useTableChanges. Validation groups and (in separate KPI mode) raw KPI
   * tables are never editable — only instance/solution data tables.
   */
  const isRecalculationEditMode = computed(() => {
    const coreParams = appConfig.getCore().parameters
    if (coreParams?.enableSolutionRecalculation !== true) return false
    if (!shouldUseExecutionData.value) return false

    if (isValidationLikeGroup(tableConfig.value?.group)) {
      return false
    }

    if (executionType.value === 'solution') {
      const tc = tableConfig.value as { _isFromRawKpis?: boolean } | undefined
      if (tc?._isFromRawKpis) return false
    }

    return true
  })

  // Master table logic
  const items = ref<any[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const searchValue = ref('')
  // Mirror of `searchValue` that lags by ~250ms — used by the client-side
  // search/filter computeds (`filteredItems`, `filteredExecutionItems`) so a
  // user typing a query doesn't re-scan a 500k-row table on every keystroke.
  // Server-side search keeps its own debounce inside `handleSearch`.
  const debouncedSearchValue = ref('')
  let clientSearchDebounceTimer: ReturnType<typeof setTimeout> | null = null
  const activeFilters = ref<any[]>([])
  /** Date range filter configs from get_list.parameters (datetime_gte + datetime_lte with symmetric). */
  const apiDateRangeFilterConfigs = computed(() => {
    if (!tableConfig.value?.get_list) return []
    return getDateRangeFilterConfigs(tableConfig.value.get_list) ?? []
  })
  const dateRangeValues = ref<Record<string, { from: string; to: string }>>({})
  const selectedItems = ref<any[]>([])
  /**
   * Per-table UI state so search and filters are isolated by table and restored
   * when the user navigates back.
   */
  const tableUiState = ref<
    Record<
      string,
      {
        searchValue: string
        activeFilters: any[]
        dateRangeValues: Record<string, { from: string; to: string }>
      }
    >
  >({})
  const showAddEditModal = ref(false)
  const showDeleteDialog = ref(false)
  const showBulkDeleteDialog = ref(false)
  const showBulkUploadModal = ref(false)
  /** When overwrite_all or delete returns offer_force_retry, show this message and offer Accept/Reject. */
  const forceRetryOffer = ref<{
    message: string
    operation?: 'overwrite_all' | 'delete_item' | 'delete_bulk' | 'delete_all'
    id?: string | number
    ids?: (string | number)[]
  } | null>(null)
  /** Pending overwrite data for retry with force=true (used when operation is overwrite_all). */
  const pendingOverwriteData = ref<any[] | null>(null)
  const forceRetryLoading = ref(false)
  const formData = ref({})
  const isEditing = ref(false)
  const saving = ref(false)
  const deleting = ref(false)
  const bulkDeleting = ref(false)
  const uploading = ref(false)
  const downloading = ref(false)
  // Progress text shown in the bulk upload modal during an async upload (status + rows loaded).
  const uploadProgressMessage = ref('')
  const editingRowId = ref<string | number | null>(null)
  const editingData = ref({})
  const originalData = ref({})
  const tableDataCache = ref<Record<string, any[]>>(sharedTableDataCache)
  // Cancel in-flight loadData when view is deactivated so we don't update state after navigate-away
  const loadIdRef = ref(0)
  // Token to cancel in-flight async-upload polling when the view is deactivated.
  const pollIdRef = ref(0)
  let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null

  // Function to load data from related tables (for foreign key selectors)
  const loadTableData = async (tableName: string): Promise<any[]> => {
    // Check if data is already cached
    if (tableDataCache.value[tableName]) {
      return tableDataCache.value[tableName]
    }

    try {
      const { default: TableRepository } = await import(
        '@cornflow-ui/core/repositories/TableRepository'
      )

      // Get configurations from the general store
      const configurations = generalStore.getConfigurations
      if (!configurations) {
        console.warn('Table configurations not available')
        return []
      }

      // Search for the table configuration in all sections
      let tableConfigFound = null

      // Check in masterData
      if (configurations.masterData?.[tableName]) {
        tableConfigFound = configurations.masterData[tableName]
      }

      // Check in inputData if not found
      if (!tableConfigFound && configurations.inputData?.[tableName]) {
        tableConfigFound = configurations.inputData[tableName]
      }

      // Check in resultsData if not found
      if (!tableConfigFound && configurations.resultsData?.[tableName]) {
        tableConfigFound = configurations.resultsData[tableName]
      }

      if (!tableConfigFound?.get_list) {
        console.warn(`Table configuration not found for: ${tableName}`)
        return []
      }

      // Create repository and load data
      const repository = new TableRepository(tableConfigFound, t)
      const data = await repository.getList()
      const resultData = normalizeGetListResponseToRows(data, tableConfigFound)

      // Cache the data
      tableDataCache.value[tableName] = resultData

      return resultData
    } catch (error) {
      console.error(`Error loading data for table ${tableName}:`, error)
      return []
    }
  }

  // Use form fields composable for data preparation
  const formFieldsComposable = useFormFields({
    fields: computed(() => {
      const rowSchema = getListResponseRowProperties(tableConfig.value)
      if (!rowSchema) return []

      const properties = rowSchema.properties
      const requiredList = rowSchema.required
      return Object.entries(properties)
        .filter(([, prop]) => isParameterPropertySchemaVisible(prop))
        .map(([key, prop]: [string, any]) =>
          buildFieldDescriptorFromProperty(key, prop, requiredList),
        )
    }),
    formData: computed(() => (isEditing.value ? formData.value : {})),
    mode: computed(() => (isEditing.value ? 'edit' : 'add')),
    loadTableData,
    tableData: tableDataCache as any, // Type assertion needed due to Ref vs ComputedRef distinction
  })

  /** Set of column names that are filtered by the API (get_list.parameters with is_filter + filters_on). */
  const serverFilteredFields = computed(() => {
    const getList = tableConfig.value?.get_list
    if (!getList) return new Set<string>()
    const params = getGetListQueryParameters(getList)
    return new Set(
      params
        .filter(
          (p) =>
            p.is_filter &&
            (p.filter_info as { filters_on?: string } | undefined)?.filters_on,
        )
        .map((p) => (p.filter_info as { filters_on: string }).filters_on),
    )
  })

  /** When set, search text is sent as a get_list query param (not applied client-side). */
  const globalSearchParamName = computed(() => {
    const getList = tableConfig.value?.get_list
    if (!getList) return null
    return getGlobalSearchQueryParameterName(getList)
  })

  // Filtered items: apply only client-side search and filters for fields not sent to the API
  const filteredItems = computed(() => {
    const clientFilters = (activeFilters.value as FilterCondition[]).filter(
      (f) => !serverFilteredFields.value.has(f.field),
    )
    // Read the debounced search value so each keystroke doesn't re-filter
    // the whole `items` array (O(n*m) over filters per keystroke).
    const clientSearch = globalSearchParamName.value
      ? ''
      : debouncedSearchValue.value
    return applyFiltersAndSearchUtil(
      items.value,
      clientSearch,
      clientFilters,
    )
  })

  /**
   * Headers that are visible in the table (same filter as CoreTable safeHeaders).
   * Used for Excel export so the file has the same columns as the UI, including
   * joined columns (columns to join).
   */
  const visibleHeadersForExport = computed(() => {
    const list = headers.value.filter((h) => h.value !== 'selection')
    return list.filter(
      (h) =>
        !('hidden' in h && h.hidden) &&
        !('isForeignKey' in h && h.isForeignKey) &&
        !(
          'columnsToJoin' in h &&
          h.columnsToJoin &&
          Array.isArray(h.columnsToJoin)
        ),
    )
  })

  // Generate headers from table config for master tables
  const headers = computed(() => {
    const rowSchema = getListResponseRowProperties(tableConfig.value)
    if (!rowSchema) return []

    const properties = rowSchema.properties
    const requiredList = rowSchema.required
    const dataHeaders = Object.entries(properties)
      .filter(([key]) => key !== 'id') // Exclude id column from display
      .filter(([, prop]) => isParameterPropertySchemaVisible(prop))
      .map(([key, prop]: [string, any]) => ({
        ...buildFieldDescriptorFromProperty(key, prop, requiredList),
        value: key,
        sortable: true,
        filterable: true,
        valueNone: prop.valueNone || undefined,
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

  // Filter fields must match table-visible columns (same rules as CoreTable safeHeaders).
  // Filters for fields with get_list.parameters (is_filter + filters_on) are sent to the backend;
  // the rest are applied client-side on loaded data.
  const availableFilterFields = computed(() => {
    return headers.value
      .filter(
        (header) =>
          header.value !== 'selection' &&
          header.filterable &&
          !('hidden' in header && header.hidden) &&
          !('isForeignKey' in header && header.isForeignKey) &&
          !(
            'columnsToJoin' in header &&
            header.columnsToJoin &&
            Array.isArray(header.columnsToJoin)
          ),
      )
      .map((header) => ({
        key: header.key || header.value,
        title: header.title,
        type: header.type,
        filterable: header.filterable,
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
        frontendReadOnly:
          'frontendReadOnly' in header ? header.frontendReadOnly : undefined,
      }))
  })

  /**
   * Helper: Compare values for matching (handles string case-insensitivity)
   */
  const fieldValuesMatch = (fieldValue: any, rowValue: any): boolean => {
    if (
      fieldValue === undefined ||
      fieldValue === null ||
      rowValue === undefined ||
      rowValue === null
    ) {
      return false
    }
    if (typeof fieldValue === 'string' && typeof rowValue === 'string') {
      return fieldValue.trim().toLowerCase() === rowValue.trim().toLowerCase()
    }
    return String(fieldValue) === String(rowValue)
  }

  /**
   * Normalize a value for use as map key (consistent for matching).
   */
  const normalizeMatchKey = (value: any): string => {
    if (value === undefined || value === null) return ''
    if (typeof value === 'string') return value.trim().toLowerCase()
    return String(value)
  }

  /** Build possible header names for a schema key (key + title variants) for Excel column matching. */
  const buildPossibleHeaderKeysFor = (
    schemaKey: string,
    properties: Record<string, any>,
  ): string[] => {
    const prop = (properties as any)[schemaKey]
    if (!prop) return [schemaKey]
    const keys = [schemaKey]
    const title = prop.title
    if (typeof title === 'string' && title.trim()) keys.push(title.trim())
    if (title && typeof title === 'object')
      Object.values(title).forEach((v) => {
        if (typeof v === 'string' && v.trim()) keys.push(v.trim())
      })
    return keys
  }

  interface FkConfig {
    fkField: string
    columnsToJoin: string[]
    refTable: string
    refField: string
    refTableData: any[]
    refByDisplayValue: Map<string, any>
    possibleDisplayHeaderKeys: string[]
  }

  /** Build FK config entries for each field that declares columns_to_join. */
  const buildFkConfigsForProperties = async (
    properties: Record<string, any>,
  ): Promise<FkConfig[]> => {
    const fkConfigs: FkConfig[] = []
    for (const [fkField, fkProp] of Object.entries(properties)) {
      const prop = fkProp
      const columnsToJoin = prop.columnsToJoin ?? prop.columns_to_join
      if (!Array.isArray(columnsToJoin) || columnsToJoin.length === 0) continue

      const firstDepKey = columnsToJoin[0]
      const firstDepProp = (properties as any)[firstDepKey]
      const joinFrom = firstDepProp?.joinFrom ?? firstDepProp?.join_from
      if (!joinFrom) continue

      const joinInfo = parseJoinFrom(joinFrom)
      if (!joinInfo) continue

      const refTableData = await loadTableData(joinInfo.table)
      const refByDisplayValue = new Map<string, any>()
      for (const refRow of refTableData) {
        const key = normalizeMatchKey(refRow[joinInfo.field])
        if (key !== '' && !refByDisplayValue.has(key)) {
          refByDisplayValue.set(key, refRow)
        }
      }

      fkConfigs.push({
        fkField,
        columnsToJoin,
        refTable: joinInfo.table,
        refField: joinInfo.field,
        refTableData,
        refByDisplayValue,
        possibleDisplayHeaderKeys: buildPossibleHeaderKeysFor(firstDepKey, properties),
      })
    }
    return fkConfigs
  }

  /** Get the cell value for a join column, checking all possible header key variants. */
  const getJoinCellValue = (
    mappedRow: Record<string, any>,
    depKey: string,
    properties: Record<string, any>,
  ): any => {
    for (const k of buildPossibleHeaderKeysFor(depKey, properties)) {
      const v = mappedRow[k]
      if (v !== undefined && v !== null && String(v).trim() !== '') return v
    }
    const v = mappedRow[depKey]
    if (v !== undefined && v !== null && String(v).trim() !== '') return v
    return undefined
  }

  /** Find a matching reference row for a FK config within a mapped row. */
  const findFkMatchInRow = (
    mappedRow: Record<string, any>,
    config: FkConfig,
    properties: Record<string, any>,
    isValueNone: boolean,
    hasFirstCol: boolean,
    firstColValue: any,
  ): any => {
    const { refByDisplayValue } = config

    if (isValueNone) return null

    if (hasFirstCol) {
      const byDisplay = refByDisplayValue.get(normalizeMatchKey(firstColValue))
      if (byDisplay) return byDisplay
    }

    return findFkMatchByJoinColumns(mappedRow, config, properties)
  }

  /** Find a reference row by trying each join column value against the ref field. */
  const findFkMatchByJoinColumns = (
    mappedRow: Record<string, any>,
    config: FkConfig,
    properties: Record<string, any>,
  ): any => {
    const { columnsToJoin, refField, refTableData } = config
    if (refTableData.length === 0) return null

    for (const depKey of columnsToJoin) {
      const rowVal = getJoinCellValue(mappedRow, depKey, properties)
      if (rowVal === undefined) continue
      const found = refTableData.find((refRow) =>
        fieldValuesMatch(refRow[refField], rowVal),
      )
      if (found) return found
    }
    return null
  }

  /** True when any join column of the row resolves to the configured "value none" display. */
  const rowMatchesValueNone = (
    mappedRow: Record<string, any>,
    columnsToJoin: string[],
    properties: Record<string, any>,
  ): boolean => {
    for (const depKey of columnsToJoin) {
      const v = getJoinCellValue(mappedRow, depKey, properties)
      if (v === undefined) continue
      const depProp = (properties as any)[depKey]
      if (displayValueMatchesValueNone(v, depProp)) return true
    }
    return false
  }

  /** Resolve the display value for the first join column, checking header variants then the raw key. */
  const resolveFirstColValue = (
    mappedRow: Record<string, any>,
    config: FkConfig,
  ): any => {
    for (const headerKey of config.possibleDisplayHeaderKeys) {
      const v = mappedRow[headerKey]
      if (v !== undefined && v !== null && String(v).trim() !== '') return v
    }
    return mappedRow[config.columnsToJoin[0]]
  }

  /** Throw the standard "reference not found" error for an unresolvable FK row. */
  const throwFkReferenceNotFound = (
    mappedRow: Record<string, any>,
    config: FkConfig,
    properties: Record<string, any>,
    excelRowNumber: number,
    hasFirstCol: boolean,
    firstColValue: any,
  ): void => {
    let fieldValue = ''
    if (hasFirstCol) {
      fieldValue = String(firstColValue)
    } else {
      for (const depKey of config.columnsToJoin) {
        const v = getJoinCellValue(mappedRow, depKey, properties)
        if (v !== undefined) {
          fieldValue = String(v)
          break
        }
      }
    }
    throw new Error(
      t('table.messages.bulkUploadReferenceNotFound', {
        row: excelRowNumber,
        fieldKey: config.columnsToJoin[0],
        fieldValue,
        tableName: config.refTable,
      }),
    )
  }

  /** Apply a single FK config to a mapped row: resolve FK id or throw if unresolvable. */
  const applyFkConfigToRow = (
    mappedRow: Record<string, any>,
    config: FkConfig,
    properties: Record<string, any>,
    excelRowNumber: number,
  ): void => {
    const { fkField, columnsToJoin } = config

    const isValueNone = rowMatchesValueNone(mappedRow, columnsToJoin, properties)

    const firstColValue = resolveFirstColValue(mappedRow, config)
    const hasFirstCol =
      firstColValue !== undefined &&
      firstColValue !== null &&
      String(firstColValue).trim() !== ''

    const match = findFkMatchInRow(mappedRow, config, properties, isValueNone, hasFirstCol, firstColValue)

    if (isValueNone) {
      mappedRow[fkField] = null
    } else if (match?.id === undefined) {
      const hadAnyJoinInput = columnsToJoin.some(
        (depKey) => getJoinCellValue(mappedRow, depKey, properties) !== undefined,
      )
      if (hadAnyJoinInput) {
        throwFkReferenceNotFound(
          mappedRow,
          config,
          properties,
          excelRowNumber,
          hasFirstCol,
          firstColValue,
        )
      }
    } else {
      mappedRow[fkField] = match.id
    }

    for (const depKey of columnsToJoin) {
      const keysToRemove = buildPossibleHeaderKeysFor(depKey, properties)
      keysToRemove.forEach((k) => delete mappedRow[k])
    }
  }

  /**
   * Map dependent fields to foreign key IDs. Works for any table and columns_to_join.
   * - Loads each referenced table once per batch (not per row).
   * - Prefers matching by the first column in columns_to_join (usually the unique code, e.g. codigo_puerto)
   *   so that tables where the same display name exists for different codes (e.g. puerto "BARCELONA" for
   *   codigo_puerto H086 and I080DOS) resolve correctly.
   * - When the row has no value for the first column, falls back to matching by display field(s).
   */
  const mapDependentFieldsToIds = async (parsedData: any[]): Promise<any[]> => {
    const properties = getListResponseRowProperties(tableConfig.value)?.properties
    if (!properties) return parsedData

    const fkConfigs = await buildFkConfigsForProperties(properties)

    const mappedRows: any[] = []
    for (let rowIndex = 0; rowIndex < parsedData.length; rowIndex++) {
      const mappedRow: Record<string, any> = { ...parsedData[rowIndex] }
      const excelRowNumber = rowIndex + 2

      for (const config of fkConfigs) {
        applyFkConfigToRow(mappedRow, config, properties, excelRowNumber)
      }

      // Remove any remaining dependent fields not handled above (e.g. frontendReadOnly joined columns)
      for (const [fieldKey, fieldProp] of Object.entries(properties)) {
        if (fieldProp.isDependentField) {
          delete mappedRow[fieldKey]
        }
      }

      mappedRows.push(mappedRow)
    }
    return mappedRows
  }

  /** Normalize cell value from ExcelJS (handles formula result, rich text / inline string). */
  const cellToPlainValue = (v: any): PlainCellValue => {
    if (v === null || v === undefined) return ''
    if (typeof v === 'object' && v !== null) {
      // Formula cell: use the calculated result, not the formula object
      if ('result' in v && v.result !== undefined) {
        return cellToPlainValue(v.result)
      }
      if (Array.isArray(v.richText))
        return v.richText.map((t: any) => t?.text ?? '').join('')
      if (typeof v.text === 'string') return v.text
    }
    return v
  }

  // Helper function to parse Excel files (uses ExcelJS to support inline string cells)
  const parseExcelFile = async (file: File): Promise<any[]> => {
    try {
      const buffer = await file.arrayBuffer()
      const workbook = new ExcelJS.Workbook()
      await workbook.xlsx.load(buffer)
      const sheet = workbook.worksheets[0]
      if (!sheet || sheet.rowCount < 2) {
        throw new Error(
          'Excel file must have at least a header row and one data row',
        )
      }

      const rawRows: any[][] = []
      sheet.eachRow((row, _rowNumber) => {
        const values = (row.values as any[]) || []
        const rowData = []
        for (let c = 1; c < values.length; c++) {
          rowData.push(cellToPlainValue(values[c]))
        }
        rawRows.push(rowData)
      })

      const maxCols = Math.max(...rawRows.map((r) => r.length), 0)
      const padded = rawRows.map((r) => {
        const arr = [...r]
        while (arr.length < maxCols) arr.push('')
        return arr
      })

      const headers = padded[0].map((h) => String(h).trim())

      return padded.slice(1).map((row) => {
        const obj: any = {}
        headers.forEach((header, index) => {
          const value = row[index]
          obj[header] =
            value === null || value === undefined || value === '' ? null : value
        })
        return obj
      })
    } catch (error) {
      console.error('Excel parsing error:', error)
      throw new Error(t('table.fileProcessingError'))
    }
  }

  // Helper function to parse JSON content
  const parseJsonContent = (content: string): any[] => {
    const jsonData = JSON.parse(content)
    return Array.isArray(jsonData) ? jsonData : [jsonData]
  }

  // Helper function to parse CSV content (supports comma, semicolon, and tab delimiters)
  const parseCsvContent = (content: string): any[] => {
    const trimmed = content.trim()
    if (!trimmed) {
      throw new Error('Invalid CSV format')
    }
    const delimiter = detectDelimiter(trimmed)
    const { tableData } = parseCsvWithDelimiter(trimmed, delimiter)
    if (!tableData || tableData.length === 0) {
      throw new Error('Invalid CSV format')
    }
    return tableData
  }

  // Helper function to read file as text and parse based on extension
  const parseTextFile = async (file: File, extension: string): Promise<any[]> => {
    let content: string
    try {
      content = await file.text()
    } catch (error) {
      console.error('File reading error:', error)
      throw new Error(t('table.messages.fileProcessingError'))
    }

    try {
      if (extension === 'json') {
        return parseJsonContent(content)
      } else if (extension === 'csv') {
        return parseCsvContent(content)
      }
      throw new Error(t('table.messages.invalidFileFormat'))
    } catch (error) {
      console.error('File parsing error:', error)
      const errorMessage =
        error instanceof Error
          ? error.message
          : t('table.messages.fileProcessingError')
      throw new Error(errorMessage)
    }
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

  /** Page size for infinite scroll when get_list declares `limit`; unused when the API has no limit param. */
  const listPageSize = computed(() => {
    const getList = tableConfig.value?.get_list
    if (!getList || !getListDeclaresLimitParam(getList)) return 100
    const limit = getDefaultListLimit(getList)
    return limit != null && limit > 0 ? limit : 100
  })

  /** Infinite scroll only when both limit and offset are declared on get_list. */
  const supportsServerPagination = computed(() => {
    const getList = tableConfig.value?.get_list
    if (!getList) return false
    return (
      getListDeclaresLimitParam(getList) &&
      getListDeclaresOffsetParam(getList)
    )
  })

  /** Whether there are more rows to load (infinite scroll). */
  const hasMore = ref(true)
  /** True while loading the next page. */
  const loadingMore = ref(false)

  /**
   * Client-side windowing for any table whose full dataset lives in memory:
   *   1. Execution data (instance/solution in `selectedExecution`).
   *   2. Master tables whose `get_list` does **not** declare `limit`/`offset`
   *      — the backend dumps the whole table in one response.
   * In both cases we slice the array so Vuetify only processes a small window
   * on mount; the window grows on `loadMore`, reusing the same `@load-more`
   * infra that drives true server-paginated infinite scroll. Without this,
   * handing 500k rows to `v-data-table-virtual` at once froze the UI even
   * though row rendering itself is virtualized, because Vuetify's internal
   * sort/filter pipeline iterates the full array.
   */
  const IN_MEMORY_WINDOW_PAGE_SIZE = 200
  const inMemoryWindowSize = ref(IN_MEMORY_WINDOW_PAGE_SIZE)

  /**
   * True when the active table's dataset lives entirely in memory and must
   * be windowed client-side. Covers execution-data AND master tables whose
   * `get_list` lacks `limit`/`offset` (server returns everything in one shot).
   */
  const usesInMemoryWindow = computed(
    () =>
      shouldUseExecutionData.value ||
      (!!tableConfig.value?.get_list && !supportsServerPagination.value),
  )

  /**
   * Build GET list query params from get_list.parameters: defaults, date range, search, and filters.
   * When offsetOverride is provided, use it as the offset param (for load-more).
   * - forExcelExport: omit limit/offset so the backend returns the full filtered set.
   */
  /** Apply a single get_list filter param to the query object, if it matches an active filter. */
  const applyFilterParamToQuery = (
    query: Record<string, PlainCellValue>,
    p: any,
  ): void => {
    const filterInfo = p.filter_info as
      | { filters_on?: string; filter_type?: string; symmetric?: string | null }
      | undefined
    const filtersOn = filterInfo?.filters_on
    if (!p.is_filter || filtersOn == null) return

    const filter = activeFilters.value.find(
      (f: FilterCondition) => f.field === filtersOn,
    )
    if (!filter) return

    const filterType = filterInfo?.filter_type ?? ''
    const ft = filterType.toLowerCase()

    // Determine the role of this param: range_gte, range_lte, or single
    let paramRole: 'single' | 'range_gte' | 'range_lte' = 'single'
    if (ft.endsWith('_gte')) paramRole = 'range_gte'
    else if (ft.endsWith('_lte')) paramRole = 'range_lte'

    // Only apply this param if the filter type matches the active operator
    if (!filterTypeMatchesUiOperator(filterType, filter.operator, paramRole))
      return

    // Boolean null-check params (value_is_not_none) always send true
    if (ft === 'value_is_not_none') {
      query[p.name] = true
      return
    }

    // For range pairs, use value (gte) or value2 (lte)
    const rawValue =
      paramRole === 'range_lte' ? (filter.value2 ?? filter.value) : filter.value

    if (rawValue !== undefined && String(rawValue).trim() !== '') {
      query[p.name] = String(rawValue).trim()
    }
  }

  /** Apply active column filters to a query object via get_list.parameters (filters_on). */
  const applyActiveFiltersToQuery = (
    query: Record<string, PlainCellValue>,
    getList: any,
  ): void => {
    const queryParams = getGetListQueryParameters(getList)
    for (const p of queryParams) {
      applyFilterParamToQuery(query, p)
    }
  }

  const buildGetListQueryParams = (
    offsetOverride?: number,
    options?: { forExcelExport?: boolean },
  ): Record<string, PlainCellValue> => {
    const forExcel = options?.forExcelExport === true

    // Always use get_list as the source of filter param definitions.
    // download_excel_table shares the same filter params as get_list (per design).
    const getList = tableConfig.value?.get_list
    if (!getList) return {}

    const query: Record<string, PlainCellValue> = {
      ...getDefaultListQueryParams(getList),
    }

    const hasLimit = getListDeclaresLimitParam(getList)
    const hasOffset = getListDeclaresOffsetParam(getList)
    if (hasLimit && !forExcel) {
      query.limit = listPageSize.value
    }
    if (hasOffset && !forExcel) {
      query.offset = offsetOverride ?? ((query.offset as number) ?? 0)
    }

    if (forExcel) {
      delete query.limit
      delete query.offset
    }

    // Date range: paramGte/paramLte from dateRangeValues
    const dateConfigs = apiDateRangeFilterConfigs.value
    for (const config of dateConfigs) {
      const range = dateRangeValues.value[config.paramGte]
      if (range?.from) query[config.paramGte] = range.from
      if (range?.to) query[config.paramLte] = range.to
    }

    // Column filters: map activeFilters (field) to param name via get_list.parameters (filters_on)
    applyActiveFiltersToQuery(query, getList)

    return query
  }

  /**
   * Fetch list from repository and enrich with joined columns (frontend join).
   * Optionally passes queryParams to getList for server-side filtering (limit, offset, date range, etc.).
   */
  const fetchListEnriched = async (
    repository: {
      getList: (queryParams?: Record<string, any>) => Promise<any[]>
    },
    config: any,
    queryParams?: Record<string, PlainCellValue>,
  ): Promise<any[]> => {
    const data = await repository.getList(queryParams ?? {})
    const rawItems = normalizeGetListResponseToRows(data, config)
    const properties = getListResponseRowProperties(config)?.properties
    if (!properties || rawItems.length === 0) return rawItems
    return enrichItemsWithJoinedColumns(rawItems, properties)
  }

  /**
   * Enrich list items with joined column values from referenced tables.
   * For each FK field (columns_to_join), loads the referenced table and sets
   * each dependent field (e.g. factoria) from the joined row so the table
   * displays the correct label (e.g. factory name) instead of the code or id.
   */
  /** Apply dependent field values from a matched ref row to a single result item. */
  const applyJoinedFieldsToItem = (
    item: Record<string, any>,
    columnsToJoin: string[],
    properties: Record<string, any>,
    refRow: Record<string, any>,
  ): void => {
    for (const depKey of columnsToJoin) {
      const depProp = properties[depKey]
      const joinFrom = depProp?.joinFrom ?? depProp?.join_from
      if (!joinFrom) continue
      const depJoinInfo = parseJoinFrom(joinFrom)
      if (!depJoinInfo || !(depJoinInfo.field in refRow)) continue
      item[depKey] = refRow[depJoinInfo.field]
    }
  }

  /** Enrich all result items for a single FK field using the prebuilt ref-by-id map. */
  const enrichItemsForFkField = (
    result: Record<string, any>[],
    fkKey: string,
    columnsToJoin: string[],
    properties: Record<string, any>,
    refById: Map<string, any>,
  ): void => {
    for (const item of result) {
      const fkId = item[fkKey]
      if (fkId === undefined || fkId === null) continue
      const refRow = refById.get(String(fkId))
      if (!refRow) continue
      applyJoinedFieldsToItem(item, columnsToJoin, properties, refRow)
    }
  }

  const enrichItemsWithJoinedColumns = async (
    data: any[],
    properties: Record<string, any>,
  ): Promise<any[]> => {
    if (!Array.isArray(data) || data.length === 0 || !properties) return data

    // Fast path: if no FK field declares `columnsToJoin`, there is nothing to
    // enrich. Returning `data` directly avoids the O(n) shallow clone — which
    // for solution/output tables with 500k rows and no joined columns was the
    // biggest cost on tab switch.
    const fkFieldsWithJoins: [string, any][] = []
    for (const [fkKey, fkProp] of Object.entries(properties)) {
      const columnsToJoin = fkProp.columnsToJoin ?? fkProp.columns_to_join
      if (Array.isArray(columnsToJoin) && columnsToJoin.length > 0) {
        fkFieldsWithJoins.push([fkKey, fkProp])
      }
    }
    if (fkFieldsWithJoins.length === 0) return data

    const result = data.map((item) => ({ ...item }))

    for (const [fkKey, fkProp] of fkFieldsWithJoins) {
      const columnsToJoin = fkProp.columnsToJoin ?? fkProp.columns_to_join
      if (!Array.isArray(columnsToJoin) || columnsToJoin.length === 0) continue

      const firstDepKey = columnsToJoin[0]
      const firstDepProp = properties[firstDepKey]
      const firstJoinFrom = firstDepProp?.joinFrom ?? firstDepProp?.join_from
      if (!firstJoinFrom) continue

      const joinInfo = parseJoinFrom(firstJoinFrom)
      if (!joinInfo) continue

      let refRows: any[] = []
      try {
        refRows = await loadTableData(joinInfo.table)
      } catch (e) {
        console.warn(
          `[useTableData] Could not load join table ${joinInfo.table} for ${fkKey}:`,
          e,
        )
        continue
      }

      const refById = new Map(refRows.map((r) => [String(r?.id ?? ''), r]))
      enrichItemsForFkField(result, fkKey, columnsToJoin, properties, refById)
    }

    return result
  }

  // Load data function for master tables (first page; resets infinite scroll)
  const loadData = async () => {
    if (shouldUseExecutionData.value) return

    if (!tableConfig.value?.get_list) {
      items.value = []
      hasMore.value = true
      return
    }

    const myLoadId = ++loadIdRef.value
    loading.value = true
    error.value = null
    hasMore.value = true

    const pageSize = listPageSize.value
    const queryParams = buildGetListQueryParams(0)

    try {
      const TableRepository = (await import('@cornflow-ui/core/repositories/TableRepository'))
        .default
      const repository = new TableRepository(tableConfig.value, t)
      const enriched = await fetchListEnriched(
        repository,
        tableConfig.value,
        Object.keys(queryParams).length > 0 ? queryParams : undefined,
      )
      if (myLoadId !== loadIdRef.value) return
      items.value = enriched
      hasMore.value =
        supportsServerPagination.value && enriched.length >= pageSize
    } catch (err) {
      if (myLoadId !== loadIdRef.value) return
      console.error('Error in loadData:', err)
      error.value = 'Failed to load data'
      items.value = []
      hasMore.value = true
    } finally {
      if (myLoadId === loadIdRef.value) loading.value = false
    }
  }

  /** Load next page and append (infinite scroll). Called when user scrolls to bottom. */
  const loadMore = async () => {
    if (!tableConfig.value?.get_list || loadingMore.value || !hasMore.value)
      return

    const pageSize = listPageSize.value
    const offset = items.value.length
    loadingMore.value = true

    try {
      const TableRepository = (await import('@cornflow-ui/core/repositories/TableRepository'))
        .default
      const repository = new TableRepository(tableConfig.value, t)
      const queryParams = buildGetListQueryParams(offset)
      const enriched = await fetchListEnriched(
        repository,
        tableConfig.value,
        queryParams,
      )
      items.value = [...items.value, ...enriched]
      hasMore.value =
        supportsServerPagination.value && enriched.length >= pageSize
    } catch (err) {
      console.error('Error in loadMore:', err)
    } finally {
      loadingMore.value = false
    }
  }

  /** Call when the view is deactivated/unmounted so in-flight loadData does not update state. */
  const cancelLoadData = () => {
    loadIdRef.value++
    // Stop any async-upload polling loop that is still waiting on the backend.
    pollIdRef.value++
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer)
      searchDebounceTimer = null
    }
    if (clientSearchDebounceTimer) {
      clearTimeout(clientSearchDebounceTimer)
      clientSearchDebounceTimer = null
    }
  }

  /**
   * Build the bulk upload modal progress text from an async upload status.
   * Mirrors the status→message mapping in the frontend-automation docs.
   */
  const buildAsyncUploadProgressMessage = (
    status: AsyncUploadStatusResponse,
  ): string => {
    const rows = status.total_rows_loaded ?? 0
    switch (status.status) {
      case 'processing':
        return t('table.messages.asyncUploadProcessing', { count: rows })
      case 'completed':
        return t('table.messages.asyncUploadCompleted', { count: rows })
      case 'failed':
        return status.error_message || t('table.messages.asyncUploadFailed')
      case 'queued':
      case 'downloading':
      default:
        return t('table.messages.asyncUploadQueued')
    }
  }

  /**
   * Async bulk upload flow. When the table declares the async counterpart of the chosen
   * operation, POST the raw (unprocessed) file, poll its status until terminal while updating
   * the modal progress text, then reload on success or surface the error on failure.
   * Returns false when the table has no async op for this operation (caller falls back to the
   * synchronous, client-parsed path).
   */
  const tryRunAsyncBulkUpload = async (
    uiOperation: string,
    file: File,
  ): Promise<boolean> => {
    const { default: TableRepository } = await import(
      '@cornflow-ui/core/repositories/TableRepository'
    )
    const repository = new TableRepository(tableConfig.value, t)
    if (!repository.supportsAsyncBulkOperation(uiOperation)) return false

    const asyncOperation =
      TableRepository.ASYNC_OPERATION_BY_BULK_UI[uiOperation]
    if (!asyncOperation) return false

    // Token so polling stops if the user navigates away mid-upload.
    const myPollId = ++pollIdRef.value
    uploadProgressMessage.value = t('table.messages.asyncUploadQueued')

    const init = await repository.startAsyncBulkUpload(asyncOperation, file)

    const finalStatus = await repository.pollAsyncUploadUntilTerminal(
      init.upload_id,
      {
        onProgress: (status) => {
          if (pollIdRef.value !== myPollId) return
          uploadProgressMessage.value = buildAsyncUploadProgressMessage(status)
        },
        shouldContinue: () => pollIdRef.value === myPollId,
      },
    )

    // Aborted (view deactivated): leave state untouched.
    if (pollIdRef.value !== myPollId) return true

    if (finalStatus.status === 'failed') {
      const message =
        finalStatus.error_message || t('table.messages.asyncUploadFailed')
      error.value = message
      showSnackbar(message, 'error')
      return true
    }

    if (finalStatus.status === 'completed') {
      items.value = await fetchListEnriched(repository, tableConfig.value)
      showBulkUploadModal.value = false
      showSnackbar(
        t('table.messages.asyncUploadCompleted', {
          count: finalStatus.total_rows_loaded ?? 0,
        }),
        'success',
      )
      await maybeRequestMasterRecalculationPending()
      return true
    }

    // Non-terminal (e.g. cancelled before completion): just close the modal.
    showBulkUploadModal.value = false
    return true
  }

  const handleSearch = (value: string) => {
    searchValue.value = value
    const usesServerSearch =
      !shouldUseExecutionData.value &&
      globalSearchParamName.value &&
      tableConfig.value?.get_list
    if (usesServerSearch) {
      if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
      searchDebounceTimer = setTimeout(() => {
        searchDebounceTimer = null
        void loadData()
      }, 350)
      return
    }
    // Client-side search: debounce the value that drives the filter
    // computeds so typing in a 500k-row execution table doesn't re-scan on
    // every keystroke. ~250ms feels instant to users but coalesces bursts.
    if (clientSearchDebounceTimer) clearTimeout(clientSearchDebounceTimer)
    clientSearchDebounceTimer = setTimeout(() => {
      clientSearchDebounceTimer = null
      debouncedSearchValue.value = value
    }, 250)
  }

  // Keep search/filters/date range independent per table and restore on return.
  watch(
    tableKey,
    (newKey, oldKey) => {
      const normalizeKey = (key?: string | null) =>
        key ? normalizeTableKeyForStorage(key) : ''
      const previousKey = normalizeKey(oldKey)
      const currentKey = normalizeKey(newKey)

      if (previousKey) {
        tableUiState.value[previousKey] = {
          searchValue: searchValue.value,
          activeFilters: [...activeFilters.value],
          dateRangeValues: { ...dateRangeValues.value },
        }
      }

      const nextState = currentKey ? tableUiState.value[currentKey] : undefined
      // Cancel any pending debounce so the restored value isn't overwritten.
      if (clientSearchDebounceTimer) {
        clearTimeout(clientSearchDebounceTimer)
        clientSearchDebounceTimer = null
      }
      if (nextState) {
        searchValue.value = nextState.searchValue ?? ''
        debouncedSearchValue.value = nextState.searchValue ?? ''
        activeFilters.value = [...(nextState.activeFilters ?? [])]
        dateRangeValues.value = { ...nextState.dateRangeValues }
      } else {
        searchValue.value = ''
        debouncedSearchValue.value = ''
        activeFilters.value = []
        dateRangeValues.value = {}
      }

      // Selection never carries between tables.
      selectedItems.value = []
    },
    { immediate: true },
  )

  // Watch for table key changes (only for master tables)
  watch(
    tableKey,
    () => {
      forceRetryOffer.value = null
      pendingOverwriteData.value = null
    },
    { immediate: true },
  )

  watch(
    tableConfig,
    (newConfig) => {
      // Don't load data if we're using execution data
      if (shouldUseExecutionData.value) {
        return
      }

      if (newConfig?.get_list) {
        loadData()
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
        .sort((a, b) => String(a).localeCompare(String(b)))
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
      return [...deletes].sort((a, b) => String(a).localeCompare(String(b))).join(',')
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

  /** True when the table schema uses frontend join (columns_to_join + referenced master table). */
  const schemaHasColumnsToJoin = computed(() => {
    const properties = getListResponseRowProperties(tableConfig.value)?.properties
    if (!properties) return false
    for (const fkProp of Object.values(properties)) {
      const p = fkProp as { columnsToJoin?: string[]; columns_to_join?: string[] }
      const columnsToJoin = p?.columnsToJoin ?? p?.columns_to_join
      if (Array.isArray(columnsToJoin) && columnsToJoin.length > 0) return true
    }
    return false
  })

  /** Enriched execution rows (same as API path) so joined columns are filled before the table renders. */
  const executionEnrichedItems = ref<any[] | null>(null)
  const executionEnrichmentLoading = ref(false)
  let executionEnrichmentLoadId = 0

  watch(
    [
      () => tableKey.value,
      () => shouldUseExecutionData.value,
      schemaHasColumnsToJoin,
      () => executionTableData.loading.value,
      () => executionTableData.items.value,
    ],
    async () => {
      if (!shouldUseExecutionData.value || !schemaHasColumnsToJoin.value) {
        executionEnrichmentLoadId++
        executionEnrichedItems.value = null
        executionEnrichmentLoading.value = false
        return
      }
      const myId = ++executionEnrichmentLoadId
      if (executionTableData.loading.value) {
        executionEnrichmentLoading.value = true
        return
      }
      const properties = getListResponseRowProperties(tableConfig.value)?.properties
      const raw = executionTableData.items.value
      if (!properties || !Array.isArray(raw)) {
        executionEnrichedItems.value = null
        executionEnrichmentLoading.value = false
        return
      }
      if (raw.length === 0) {
        executionEnrichedItems.value = []
        executionEnrichmentLoading.value = false
        return
      }
      executionEnrichmentLoading.value = true
      try {
        // `enrichItemsWithJoinedColumns` already shallow-clones every row
        // internally (it writes joined fields onto fresh copies). Spreading
        // here before passing in produced a second full-array clone — at
        // 500k rows that's two pointless O(n) allocations on every items
        // replacement, plus the GC pressure that follows.
        const enriched = await enrichItemsWithJoinedColumns(raw, properties)
        if (myId !== executionEnrichmentLoadId) return
        executionEnrichedItems.value = enriched
      } finally {
        if (myId === executionEnrichmentLoadId) {
          executionEnrichmentLoading.value = false
        }
      }
    },
    // No `deep: true`: this flow replaces `executionTableData.items.value`
    // wholesale when the execution changes (see `useExecutionTableData`),
    // and row-level edits go through `useTableChanges` (a separate reactive
    // map). Deep-tracking 500k rows here used to freeze the UI on every
    // section change.
  )

  // Full filtered set for execution data (search + filters applied, no windowing).
  // Kept separate from the windowed slice so `hasMore` can compare against the
  // real length without re-running the filter pass.
  const fullFilteredExecutionItems = computed(() => {
    if (!shouldUseExecutionData.value) return []

    const baseItems =
      schemaHasColumnsToJoin.value &&
      executionEnrichedItems.value != null
        ? executionEnrichedItems.value
        : executionTableData.items.value

    if (
      schemaHasColumnsToJoin.value &&
      executionEnrichmentLoading.value &&
      executionEnrichedItems.value == null
    ) {
      return []
    }

    return applyFiltersAndSearchUtil(
      baseItems,
      debouncedSearchValue.value,
      activeFilters.value as FilterCondition[],
    )
  })

  // Sliced window handed to the table. See `inMemoryWindowSize` for the why.
  const filteredExecutionItems = computed(() => {
    if (!shouldUseExecutionData.value) return []
    return fullFilteredExecutionItems.value.slice(0, inMemoryWindowSize.value)
  })

  /**
   * Full filtered set for master-data tables whose `get_list` lacks
   * `limit`/`offset` (the backend returns everything at once). Same role as
   * `fullFilteredExecutionItems` but on the master-data branch. When server
   * pagination IS supported, we don't window — the server already chunks.
   */
  const isUnwindowedMasterData = computed(
    () => !shouldUseExecutionData.value && usesInMemoryWindow.value,
  )

  // Reset the window to the first page whenever the underlying dataset or the
  // filter/search criteria change, so the user always starts at the top of the
  // new result set. We watch the *result reference* of the currently-active
  // full filtered set — it re-evaluates on every relevant change (table
  // switch, execution swap, search, filter add/remove/edit) without forcing a
  // deep traversal of the 500k-row source array.
  watch(
    () => {
      if (shouldUseExecutionData.value) {
        return fullFilteredExecutionItems.value
      }
      return isUnwindowedMasterData.value ? filteredItems.value : null
    },
    () => {
      inMemoryWindowSize.value = IN_MEMORY_WINDOW_PAGE_SIZE
    },
  )

  // Dynamic computed properties that switch between execution and master data
  const dynamicItems = computed(() => {
    if (shouldUseExecutionData.value) {
      return filteredExecutionItems.value
    }
    if (isUnwindowedMasterData.value) {
      return filteredItems.value.slice(0, inMemoryWindowSize.value)
    }
    return filteredItems.value
  })

  const dynamicHeaders = computed(() => {
    if (shouldUseExecutionData.value) {
      const base = executionTableData.headers.value
      if (isRecalculationEditMode.value) {
        const hasSelection = base.some((h: any) => h.key === 'selection')
        if (!hasSelection) {
          return [
            {
              title: '',
              value: 'selection',
              key: 'selection',
              sortable: false,
              filterable: false,
              type: 'selection',
              required: false,
            },
            ...base,
          ]
        }
      }
      return base
    } else {
      return headers.value
    }
  })

  const dynamicLoading = computed(() => {
    if (shouldUseExecutionData.value) {
      return (
        executionTableData.loading.value ||
        (schemaHasColumnsToJoin.value && executionEnrichmentLoading.value)
      )
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

  // Keep active filters valid for the current table columns.
  // No `deep`: `dynamicAvailableFilterFields` is a computed that returns a new
  // array reference whenever the underlying schema/table changes, which is
  // the only time we need to re-sanitise filters.
  watch(
    dynamicAvailableFilterFields,
    (fields) => {
      const allowed = new Set((fields || []).map((f: any) => String(f?.key)))
      if (allowed.size === 0) {
        if (activeFilters.value.length > 0) activeFilters.value = []
        return
      }
      const sanitized = (activeFilters.value || []).filter((f: any) =>
        allowed.has(String(f?.field)),
      )
      if (sanitized.length !== activeFilters.value.length) {
        activeFilters.value = sanitized
      }
    },
    { immediate: true },
  )

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
    if (!tableConfig.value) {
      showSnackbar(t('table.messages.errorDownloadExcelTable'), 'error')
      return
    }

    if (
      isOperationSupported(tableConfig.value, TableOperation.DOWNLOAD_EXCEL)
    ) {
      downloading.value = true
      try {
        const { default: TableRepository } = await import(
          '@cornflow-ui/core/repositories/TableRepository'
        )
        const repository = new TableRepository(tableConfig.value, t)
        const queryParams = buildGetListQueryParams(undefined, {
          forExcelExport: true,
        })
        await repository.downloadExcel(queryParams)
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
      return
    }

    if (!tableConfig.value.get_list) {
      showSnackbar(t('table.messages.errorDownloadExcelTable'), 'error')
      return
    }

    downloading.value = true
    try {
      const tableName = tableKey.value
      const tableTitle = tableConfig.value.title || tableName
      const dataToExport = filteredItems.value
      const displayHeaders = visibleHeadersForExport.value.map((h) => ({
        key: h.key,
        title: h.title,
        type: h.type,
      }))

      await exportTableToExcel(
        dataToExport,
        tableConfig.value,
        tableName,
        tableTitle,
        t,
        displayHeaders.length > 0 ? displayHeaders : undefined,
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
    () =>
      (!shouldUseExecutionData.value && !!tableConfig.value?.put_item) ||
      isRecalculationEditMode.value,
  )
  const isParameterObjectTable = computed(() =>
    isMasterDataParameterObjectTable(
      tableKey.value,
      tableConfig.value,
      generalStore.schemaConfig?.instanceSchema,
    ),
  )
  /**
   * Some backend schemas expose parameter-object tables as edit-only endpoints
   * without explicit parameter flags. Treat those as non-deletable too.
   */
  const isParameterLikeNonDeletableTable = computed(() => {
    const config = tableConfig.value
    if (!config) return false
    if (isParameterObjectTable.value) return true
    if (config.isParameterTable === true) return true
    if (config?.get_list?.response_schema?.type === 'object') return true
    const isEditOnly =
      !!config.put_item &&
      !config.post_item &&
      !config.post_bulk &&
      !config.post_update_bulk &&
      !config.overwrite_all
    return isEditOnly
  })

  const performApiSave = async (wasEditing: boolean, preparedData: any) => {
    const { default: TableRepository } = await import(
      '@cornflow-ui/core/repositories/TableRepository'
    )
    const repository = new TableRepository(tableConfig.value, t)
    if (wasEditing) {
      const id = (formData.value as any).id
      await repository.putItem(id, preparedData)
    } else {
      await repository.createItem(preparedData)
    }
    items.value = await fetchListEnriched(repository, tableConfig.value)
    showAddEditModal.value = false
    formData.value = {}
    isEditing.value = false
    showSnackbar(
      wasEditing
        ? t('table.messages.itemUpdated')
        : t('table.messages.itemCreated'),
      'success',
    )
  }

  /** Execute pending deletes for a table (bulk or individual). */
  const executePendingDeletes = async (
    repository: any,
    config: any,
    storageKey: string,
  ): Promise<void> => {
    const deletes = tableChanges.getPendingDeletes(storageKey)
    if (deletes.length === 0) return
    if (config?.delete_bulk) {
      await repository.deleteBulk(deletes)
    } else if (config?.delete_item) {
      for (const rowId of deletes) {
        await repository.deleteItem(rowId)
      }
    }
    tableChanges.clearDeletesForTable(storageKey)
  }

  /** Execute pending creates for a table (bulk or individual). */
  const executePendingCreates = async (
    repository: any,
    config: any,
    storageKey: string,
  ): Promise<void> => {
    const creates = tableChanges.getPendingCreates(storageKey)
    if (creates.length === 0) return
    if (config?.post_bulk) {
      const payloads = creates.map(({ data }: { data: any }) => {
        const { id: _id, ...rest } = data
        return formFieldsComposable.prepareFormDataForSubmit(rest, 'add')
      })
      await repository.createBulk(payloads)
    } else if (config?.post_item) {
      for (const { data } of creates) {
        const { id: _id, ...rest } = data
        const payload = formFieldsComposable.prepareFormDataForSubmit(rest as any, 'add')
        await repository.createItem(payload)
      }
    }
    tableChanges.clearCreatesForTable(storageKey)
  }

  /** Execute pending cell edits for a table in concurrent batches. */
  const executePendingEdits = async (
    repository: any,
    config: any,
    storageKey: string,
  ): Promise<void> => {
    const changes = tableChanges.getChangesForTable(storageKey)
    if (!config?.put_item || !changes || Object.keys(changes).length === 0) return
    const currentItems = normalizeGetListResponseToRows(
      await repository.getList(),
      tableConfig.value,
    )
    const CONCURRENT_PUTS = 10
    const putTasks: Array<{ rowId: string; preparedData: any }> = []
    for (const [rowId, rowChanges] of Object.entries(changes)) {
      const row = currentItems.find((i: any) => String(i.id) === rowId)
      if (!row) continue
      const merged = { ...row }
      Object.entries(rowChanges as Record<string, any>).forEach(
        ([fieldKey, change]: [string, any]) => {
          merged[fieldKey] = change.newValue
        },
      )
      const preparedData = formFieldsComposable.prepareFormDataForSubmit(merged, 'edit')
      putTasks.push({ rowId, preparedData })
    }
    for (let i = 0; i < putTasks.length; i += CONCURRENT_PUTS) {
      const batch = putTasks.slice(i, i + CONCURRENT_PUTS)
      await Promise.all(
        batch.map(({ rowId, preparedData }) =>
          repository.putItem(rowId, preparedData),
        ),
      )
    }
    tableChanges.revertTableChanges(storageKey)
  }

  /** Stage post_update_bulk rows for recalculation edit mode: edit matched rows, create unmatched. */
  const stageRecalculationUpdateBulk = (
    parsedData: any[],
    storageKey: string,
    tableTitle: string,
  ): void => {
    for (const row of parsedData) {
      const rowId = row.id
      const existing =
        rowId == null
          ? null
          : dynamicItems.value.find((i: any) => String(i.id) === String(rowId))
      if (!existing) {
        tableChanges.recordCreate(storageKey, row, tableTitle)
        continue
      }
      for (const [fieldKey, newValue] of Object.entries(row)) {
        if (fieldKey === 'id') continue
        const oldValue = existing[fieldKey]
        tableChanges.recordChange(
          storageKey,
          existing.id,
          fieldKey,
          oldValue,
          newValue,
          fieldKey,
          tableTitle,
        )
      }
    }
  }

  /** Stage a bulk upload as pending changes (recalculation edit mode, no API). */
  const stageRecalculationBulkUpload = (
    parsedData: any[],
    operation: string,
  ): void => {
    const storageKey = normalizeTableKeyForStorage(tableKey.value)
    const tableTitle = tableConfig.value?.title || tableKey.value
    tableChanges.setTableTitle(storageKey, tableTitle)

    if (operation === 'overwrite_all') {
      // Stage delete for every existing row, then create for each uploaded row
      for (const item of dynamicItems.value) {
        tableChanges.recordDelete(storageKey, item.id, item)
      }
      for (const row of parsedData) {
        tableChanges.recordCreate(storageKey, row, tableTitle)
      }
    } else if (operation === 'post_update_bulk') {
      stageRecalculationUpdateBulk(parsedData, storageKey, tableTitle)
    } else {
      // post_bulk: create all uploaded rows
      for (const row of parsedData) {
        tableChanges.recordCreate(storageKey, row, tableTitle)
      }
    }
  }

  /** Normalize empty strings / undefined to null so the backend stores nulls. */
  const normalizeBulkRowsForBackend = (rows: any[]): any[] =>
    rows.map((row) =>
      Object.fromEntries(
        Object.entries(row).map(([k, v]) => [
          k,
          v === '' || v === undefined ? null : v,
        ]),
      ),
    )

  /** Run the repository call matching the bulk upload operation. */
  const persistBulkUpload = async (
    repository: any,
    operation: string,
    mappedData: any[],
  ): Promise<void> => {
    if (operation === 'overwrite_all') {
      await repository.overwriteAll(mappedData)
    } else if (operation === 'post_update_bulk') {
      await repository.updateBulk(mappedData)
    } else {
      await repository.createBulk(mappedData)
    }
  }

  /**
   * Handle a bulk upload error. Returns true when the error was converted into a
   * force-retry offer (caller should stop); false when it was reported as a normal error.
   */
  const handleBulkUploadError = (
    err: unknown,
    operation: string,
    mappedData: any[] | null,
  ): boolean => {
    if (
      isForceRetryOfferError(err) &&
      operation === 'overwrite_all' &&
      mappedData
    ) {
      forceRetryOffer.value = {
        message: err.message,
        operation: 'overwrite_all',
      }
      pendingOverwriteData.value = mappedData
      showBulkUploadModal.value = false
      return true
    }
    console.error('Error in bulk upload:', err)
    error.value =
      err instanceof Error ? err.message : t('table.messages.errorBulkUpload')
    showSnackbar(
      err instanceof Error ? err.message : t('table.messages.errorBulkUpload'),
      'error',
    )
    return false
  }

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
      if (isRecalculationEditMode.value) return true
      return (
        !shouldUseExecutionData.value &&
        (!!tableConfig.value?.put_item ||
          (!isParameterLikeNonDeletableTable.value &&
            (!!tableConfig.value?.delete_item ||
              !!tableConfig.value?.delete_bulk)))
      )
    }),
    enableActions: computed(
      () => !shouldUseExecutionData.value || isRecalculationEditMode.value,
    ),
    enableBulkActions: computed(
      () =>
        isRecalculationEditMode.value ||
        (!shouldUseExecutionData.value &&
          (!!tableConfig.value?.put_item ||
            (!isParameterLikeNonDeletableTable.value &&
              (!!tableConfig.value?.delete_item ||
                !!tableConfig.value?.delete_bulk)))),
    ),
    canAdd: computed(
      () =>
        isRecalculationEditMode.value ||
        (!shouldUseExecutionData.value &&
          !!tableConfig.value?.post_item &&
          !isParameterObjectTable.value),
    ),
    canEdit: computed(
      () =>
        isRecalculationEditMode.value ||
        (!shouldUseExecutionData.value && !!tableConfig.value?.put_item),
    ),
    canDelete: computed(
      () =>
        isRecalculationEditMode.value ||
        (!shouldUseExecutionData.value &&
          !isParameterLikeNonDeletableTable.value &&
          (!!tableConfig.value?.delete_item ||
            !!tableConfig.value?.delete_bulk)),
    ),
    canBulkUpload: computed(() => {
      if (isRecalculationEditMode.value) return true
      if (shouldUseExecutionData.value) return false
      const c = tableConfig.value
      if (!c) return false
      return (
        isOperationSupported(c, TableOperation.POST_BULK) ||
        isOperationSupported(c, TableOperation.POST_UPDATE_BULK) ||
        isOperationSupported(c, TableOperation.OVERWRITE_ALL) ||
        isOperationSupported(c, TableOperation.ASYNC_POST_BULK) ||
        isOperationSupported(c, TableOperation.ASYNC_POST_UPDATE_BULK) ||
        isOperationSupported(c, TableOperation.ASYNC_OVERWRITE_ALL)
      )
    }),
    /**
     * Order matters: first entry is the default selection in the bulk upload modal. Only
     * includes ops with a defined URL in automation (same as TableRepository). A UI option is
     * offered when either its sync op OR its async counterpart (`async_*`) is declared; a table
     * normally declares one set or the other, not both.
     */
    bulkUploadAvailableOperations: computed(() => {
      if (isRecalculationEditMode.value) {
        return ['overwrite_all', 'post_update_bulk', 'post_bulk'] as string[]
      }
      const c = tableConfig.value
      if (!c) return [] as string[]
      const ops: string[] = []
      if (
        isOperationSupported(c, TableOperation.POST_UPDATE_BULK) ||
        isOperationSupported(c, TableOperation.ASYNC_POST_UPDATE_BULK)
      ) {
        ops.push('post_update_bulk')
      }
      if (
        isOperationSupported(c, TableOperation.POST_BULK) ||
        isOperationSupported(c, TableOperation.ASYNC_POST_BULK)
      ) {
        ops.push('post_bulk')
      }
      if (
        isOperationSupported(c, TableOperation.OVERWRITE_ALL) ||
        isOperationSupported(c, TableOperation.ASYNC_OVERWRITE_ALL)
      ) {
        ops.push('overwrite_all')
      }
      return ops
    }),
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
      return {
        [storageKey]: Object.fromEntries(
          dynamicItems.value.map((item: any) => [String(item.id), item]),
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
    forceRetryOffer,
    forceRetryLoading,
    formFields: computed(() => {
      const rowSchema = getListResponseRowProperties(tableConfig.value)
      if (!rowSchema) return []

      const properties = rowSchema.properties
      const requiredList = rowSchema.required
      return Object.entries(properties)
        .filter(([key]) => key !== 'id') // Exclude id from form fields
        .filter(([, prop]) => isParameterPropertySchemaVisible(prop))
        .map(([key, prop]: [string, any]) => ({
          ...buildFieldDescriptorFromProperty(key, prop, requiredList),
          valueNone: prop.valueNone || undefined,
        }))
    }),
    formData,
    isEditing,
    saving,
    deleting,
    bulkDeleting,
    uploading,
    uploadProgressMessage,
    downloading,
    editingRowId,
    editingData,
    originalData,
    isEditingAnyRow: computed(() => editingRowId.value !== null),

    // Foreign key data loading
    loadTableData,
    tableData: tableDataCache,

    // Filter functions
    getOperatorsForFieldType,
    getOperatorText,
    operatorNeedsValue,
    operatorNeedsSecondValue,
    generateFilterId,
    apiDateRangeFilterConfigs,
    dateRangeValues,
    // `hasMore` / `loadMore` cover three modes:
    //   1. Execution data: in-memory window over the full filtered set.
    //   2. Master with server pagination: backend-driven `hasMore` and a
    //      real HTTP request on `loadMore`.
    //   3. Master WITHOUT `limit`/`offset` (server dumps everything): same
    //      in-memory window as execution data.
    hasMore: computed(() => {
      if (shouldUseExecutionData.value) {
        return inMemoryWindowSize.value < fullFilteredExecutionItems.value.length
      }
      if (isUnwindowedMasterData.value) {
        return inMemoryWindowSize.value < filteredItems.value.length
      }
      return hasMore.value
    }),
    loadingMore: computed(() =>
      usesInMemoryWindow.value ? false : loadingMore.value,
    ),
    loadMore: () => {
      if (usesInMemoryWindow.value) {
        inMemoryWindowSize.value += IN_MEMORY_WINDOW_PAGE_SIZE
      } else {
        loadMore()
      }
    },

    // Event handlers (simplified)
    handleSearch,
    handleAddFilter: (filter: any) => {
      if (!filter?.field || !filter.operator) return

      // Add unique ID if not present
      if (!filter.id) {
        filter.id = generateFilterId()
      }

      activeFilters.value.push(filter)
      // Reload when an API-backed filter is added so the backend receives the new param
      if (serverFilteredFields.value.has(filter.field)) {
        loadData()
      }
    },
    handleRemoveFilter: (filterId: string) => {
      const index = activeFilters.value.findIndex((f) => f.id === filterId)
      if (index >= 0) {
        const removed = activeFilters.value[index]
        activeFilters.value.splice(index, 1)
        if (removed && serverFilteredFields.value.has(removed.field)) {
          loadData()
        }
      }
    },
    handleClearAllFilters: () => {
      const hadApiFilters = (activeFilters.value as FilterCondition[]).some(
        (f) => serverFilteredFields.value.has(f.field),
      )
      activeFilters.value = []
      if (hadApiFilters) loadData()
    },
    handleApplyDateRange: (
      key: string,
      range: { from: string; to: string },
    ) => {
      if (!key || !range) return
      dateRangeValues.value = {
        ...dateRangeValues.value,
        [key]: { from: range.from ?? '', to: range.to ?? '' },
      }
      loadData()
    },
    handleResetDateRange: (key: string) => {
      if (!key) return
      const next = { ...dateRangeValues.value }
      delete next[key]
      dateRangeValues.value = next
      loadData()
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
        selectedItems.value = [...dynamicItems.value]
      } else {
        selectedItems.value = []
      }
    },
    handleClearSelection: () => {
      selectedItems.value = []
    },
    handleAddItem: () => {
      if (isParameterObjectTable.value) {
        return
      }
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
      if (isParameterLikeNonDeletableTable.value) return
      formData.value = { ...item }
      showDeleteDialog.value = true
    },
    handleBulkDelete: () => {
      if (isParameterLikeNonDeletableTable.value) return
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
        const keepDependentFields = enableExcelMode.value && !wasEditing
        const preparedData = formFieldsComposable.prepareFormDataForSubmit(
          formData.value as any,
          mode,
          keepDependentFields ? { keepDependentFields: true } : undefined,
        )

        // Excel mode (master tables or recalculation): stage add (no API call)
        if (keepDependentFields) {
          const storageKey = normalizeTableKeyForStorage(tableKey.value)
          const tableTitle = tableConfig.value?.title || tableKey.value
          const tempId = tableChanges.recordCreate(
            storageKey,
            preparedData,
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

        // Recalculation edit mode: block API calls for edits — changes are staged via cell edits
        if (isRecalculationEditMode.value && wasEditing) {
          showAddEditModal.value = false
          formData.value = {}
          isEditing.value = false
          saving.value = false
          return
        }

        await performApiSave(wasEditing, preparedData)
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
    handleBulkEdit: (fieldValues: Record<string, any>) => {
      const storageKey = normalizeTableKeyForStorage(tableKey.value)
      const tableTitle = tableConfig.value?.title || tableKey.value
      tableChanges.setTableTitle(storageKey, tableTitle)
      for (const item of selectedItems.value) {
        for (const [fieldKey, newValue] of Object.entries(fieldValues)) {
          const oldValue = tableChanges.getCurrentValue(storageKey, item.id, fieldKey, item[fieldKey])
          tableChanges.recordChange(storageKey, item.id, fieldKey, oldValue, newValue, fieldKey, tableTitle)
        }
      }
      showSnackbar(t('table.bulkEditApplied', { count: selectedItems.value.length }), 'success')
    },
    handleBulkUpload: async (uploadData: {
      files: File[]
      operation: string
    }) => {
      if (!uploadData?.files || uploadData.files.length === 0) {
        showSnackbar(t('table.messages.errorBulkUpload'), 'error')
        return
      }

      uploading.value = true
      let mappedData: any[] | null = null
      try {
        // Get the first file (modal is set to multiple=false)
        const file = uploadData.files[0]

        // Async path: when the table declares the async counterpart of the chosen operation,
        // send the raw (unprocessed) file and poll for status — no client-side parsing.
        if (
          !isRecalculationEditMode.value &&
          (await tryRunAsyncBulkUpload(uploadData.operation, file))
        ) {
          return
        }

        // Parse the file
        const parsedData = await parseUploadFile(file)

        // Client-side path for recalculation edit mode (no API)
        if (isRecalculationEditMode.value) {
          if (!Array.isArray(parsedData) || parsedData.length === 0) {
            throw new Error(t('table.messages.noValidDataFound'))
          }
          stageRecalculationBulkUpload(parsedData, uploadData.operation)
          showBulkUploadModal.value = false
          showSnackbar(t('table.messages.bulkUploadSuccess'), 'success')
          uploading.value = false
          return
        }

        if (!Array.isArray(parsedData) || parsedData.length === 0) {
          throw new Error(t('table.messages.noValidDataFound'))
        }

        // Map dependent fields to foreign key IDs (similar to edit operation)
        mappedData = await mapDependentFieldsToIds(parsedData)

        if (!Array.isArray(mappedData) || mappedData.length === 0) {
          throw new Error(t('table.messages.noValidDataFound'))
        }

        // Normalize empty strings to null for backend
        mappedData = normalizeBulkRowsForBackend(mappedData)

        // Get repository
        const { default: TableRepository } = await import(
          '@cornflow-ui/core/repositories/TableRepository'
        )
        const repository = new TableRepository(tableConfig.value, t)

        await persistBulkUpload(repository, uploadData.operation, mappedData)

        // Reload data and close modal (enrich so joined columns show correctly)
        items.value = await fetchListEnriched(repository, tableConfig.value)
        showBulkUploadModal.value = false

        // Show success message
        showSnackbar(t('table.messages.bulkUploadSuccess'), 'success')
        await maybeRequestMasterRecalculationPending()
      } catch (err) {
        if (handleBulkUploadError(err, uploadData.operation, mappedData)) {
          return
        }
      } finally {
        uploading.value = false
        uploadProgressMessage.value = ''
      }
    },
    acceptForceRetry: async () => {
      const offer = forceRetryOffer.value
      if (!offer) return

      const data = pendingOverwriteData.value
      const isOverwrite =
        offer.operation === 'overwrite_all' && data && data.length > 0

      if (
        !isOverwrite &&
        offer.operation !== 'delete_item' &&
        offer.operation !== 'delete_bulk' &&
        offer.operation !== 'delete_all'
      ) {
        forceRetryOffer.value = null
        pendingOverwriteData.value = null
        return
      }

      forceRetryLoading.value = true
      try {
        const { default: TableRepository } = await import(
          '@cornflow-ui/core/repositories/TableRepository'
        )
        const repository = new TableRepository(tableConfig.value, t)

        if (isOverwrite) {
          await repository.overwriteAll(data, { force: true })
          showBulkUploadModal.value = false
          showSnackbar(t('table.messages.bulkUploadSuccess'), 'success')
        } else if (offer.operation === 'delete_item' && offer.id != null) {
          await repository.deleteItem(offer.id, { force: true })
          showDeleteDialog.value = false
          formData.value = {}
          showSnackbar(t('table.messages.itemDeleted'), 'success')
        } else if (
          offer.operation === 'delete_bulk' &&
          offer.ids &&
          offer.ids.length > 0
        ) {
          await repository.deleteBulk(offer.ids, { force: true })
          selectedItems.value = []
          showBulkDeleteDialog.value = false
          showSnackbar(t('table.messages.itemsDeleted'), 'success')
        } else if (offer.operation === 'delete_all') {
          await repository.deleteAll({ force: true })
          selectedItems.value = []
          showBulkDeleteDialog.value = false
          showSnackbar(t('table.messages.itemsDeleted'), 'success')
        }

        items.value = await fetchListEnriched(repository, tableConfig.value)
        forceRetryOffer.value = null
        pendingOverwriteData.value = null
        if (isOverwrite) {
          await maybeRequestMasterRecalculationPending()
        }
      } catch (err) {
        console.error('Error on force retry:', err)
        const msg =
          err instanceof Error ? err.message : t('table.messages.errorDeleting')
        showSnackbar(msg, 'error')
        forceRetryOffer.value = null
        pendingOverwriteData.value = null
      } finally {
        forceRetryLoading.value = false
      }
    },
    rejectForceRetry: () => {
      forceRetryOffer.value = null
      pendingOverwriteData.value = null
    },
    handleDownloadExcel: async () => {
      if (shouldUseExecutionData.value) {
        await downloadExecutionDataExcel()
      } else {
        await downloadMasterTableExcel()
      }
    },
    handleConfirmDelete: async () => {
      if (isParameterLikeNonDeletableTable.value) return
      if (!tableConfig.value || !(formData.value as any)?.id) return

      const id = (formData.value as any).id

      // Master tables in Excel mode: stage delete (row stays visible in red until Save all)
      if (enableExcelMode.value) {
        const storageKey = normalizeTableKeyForStorage(tableKey.value)
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
          '@cornflow-ui/core/repositories/TableRepository'
        )
        const repository = new TableRepository(tableConfig.value, t)

        await repository.deleteItem(id)

        items.value = await fetchListEnriched(repository, tableConfig.value)
        showDeleteDialog.value = false
        formData.value = {}

        showSnackbar(t('table.messages.itemDeleted'), 'success')
      } catch (err) {
        if (isForceRetryOfferError(err)) {
          forceRetryOffer.value = {
            message: err.message,
            operation: 'delete_item',
            id,
          }
          return
        }
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
      if (isParameterLikeNonDeletableTable.value) return
      if (!tableConfig.value || selectedItems.value.length === 0) return

      // Master tables in Excel mode: stage deletes (rows stay visible in red until Save all)
      if (enableExcelMode.value) {
        const storageKey = normalizeTableKeyForStorage(tableKey.value)
        selectedItems.value.forEach((item: any) =>
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
          '@cornflow-ui/core/repositories/TableRepository'
        )
        const repository = new TableRepository(tableConfig.value, t)

        const idsToDelete = selectedItems.value.map((item) => item.id)
        await repository.deleteBulk(idsToDelete)

        items.value = await fetchListEnriched(repository, tableConfig.value)
        selectedItems.value = []
        showBulkDeleteDialog.value = false

        showSnackbar(t('table.messages.itemsDeleted'), 'success')
      } catch (err) {
        if (isForceRetryOfferError(err)) {
          forceRetryOffer.value = {
            message: err.message,
            operation: 'delete_bulk',
            ids: selectedItems.value.map((item) => item.id),
          }
          return
        }
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
          '@cornflow-ui/core/repositories/TableRepository'
        )
        const repository = new TableRepository(tableConfig.value, t)

        // Use composable to prepare data (filters dependent fields and excludes id)
        const preparedData = formFieldsComposable.prepareFormDataForSubmit(
          editingData.value as any,
          'edit',
        )

        await repository.putItem(editingRowId.value, preparedData)

        // Reload list so joined columns are resolved
        items.value = await fetchListEnriched(repository, tableConfig.value)

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
          '@cornflow-ui/core/repositories/TableRepository'
        )
        const repository = new TableRepository(config, t)

        // 1. Pending deletes (use bulk when supported to avoid N calls)
        await executePendingDeletes(repository, config, storageKey)

        // 2. Pending creates (use bulk when supported to avoid N calls)
        await executePendingCreates(repository, config, storageKey)

        // 3. Cell edits (run putItem in parallel batches for speed)
        await executePendingEdits(repository, config, storageKey)

        await loadData()
        showSnackbar(t('table.messages.itemUpdated'), 'success')
      } catch (err) {
        console.error('Error saving all changes:', err)
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

      const normalizedData = data.map((row) =>
        Object.fromEntries(
          Object.entries(row).map(([k, v]) => [
            k,
            v === '' || v === undefined ? null : v,
          ]),
        ),
      )

      uploading.value = true
      try {
        const { default: TableRepository } = await import(
          '@cornflow-ui/core/repositories/TableRepository'
        )
        const repository = new TableRepository(tableConfig.value, t)

        if (tableConfig.value.post_update_bulk) {
          await repository.updateBulk(normalizedData)
        } else {
          await repository.createBulk(normalizedData)
        }

        // Reload data and close modal (enrich so joined columns show correctly)
        items.value = await fetchListEnriched(repository, tableConfig.value)
        showBulkUploadModal.value = false

        // Show success message
        showSnackbar(t('table.messages.bulkUploadSuccess'), 'success')
        await maybeRequestMasterRecalculationPending()
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
