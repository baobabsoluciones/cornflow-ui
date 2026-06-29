/**
 * Composable for detecting and managing matches between instance tables and master tables
 * Provides functionality to compare, diff, and synchronize data between uploaded instance
 * data and master (frontend-automation) tables
 */

import { ref, computed } from 'vue'
import { useGeneralStore } from '@/stores/general'
import TableRepository, {
  isForceRetryOfferError,
} from '@/repositories/TableRepository'
import { useI18n } from 'vue-i18n'
import appConfig from '@/app/config'
import {
  parseJoinFrom,
  getForeignKeyFieldName,
  getExcludedKeysForMasterTableCompare,
  resolveMatchKeyFields,
  buildRowMatchKey,
  applyMasterTableDisplayNormalization,
  getListResponseRowProperties,
  normalizeGetListResponseToRows,
  isParameterTableAutomationConfig,
  isParameterTableSchema,
  getInstanceSchemaRootForTables,
  filterParameterObjectByVisibleProperties,
  normalizeMasterListToParameterRows,
  parameterRowsToParameterObject,
  getInstanceTableSchemaColumns,
  buildLowercasedKeyMap,
  resolveComparableLowercasedKeys,
  getMasterJoinedDisplayColumns,
} from '@/utils/schemaUtils'

export interface TableMatch {
  tableKey: string
  tableName: string
  /** Master table key (e.g. e_tabla_maestra) used in joinFrom and for selector options */
  masterKey: string
  masterTableTitle: string
  instanceData: any[]
  masterData: any[]
  masterTableConfig: any
  /** Full instance payload (all tables); used for dictionary-based display normalization in compare */
  fullInstanceData?: Record<string, any>
  hasDifferences: boolean
  diffSummary: DiffSummary
  userChoice: 'keep_uploaded' | 'use_master' | 'replace_master' | null
  /** Array tables vs parameter object (dictionary) matched to the same master key */
  storageShape?: 'array_table' | 'parameter_object'
  /**
   * Column names defined for this table in the instance JSON schema. When
   * present, the diff restricts comparison to these columns (case-insensitive)
   * so extra columns that exist only on the instance or only on the master
   * payload do not produce false-positive differences. Undefined when no
   * schema is available (e.g. synthesized parameter-object rows).
   */
  instanceSchemaColumns?: string[]
}

export interface DiffSummary {
  onlyInInstance: number
  onlyInMaster: number
  different: number
  identical: number
  totalInstance: number
  totalMaster: number
}

export interface RowDiff {
  type: 'added' | 'removed' | 'modified' | 'identical'
  instanceRow?: any
  masterRow?: any
  changes?: { field: string; instanceValue: any; masterValue: any }[]
}

/** Optional context from the external ETL metadata review flow (POST /external/etl/). */
export interface DetectMasterTableMatchesOptions {
  /**
   * Table names reported as loaded from DB in `__metadata__.tables_from_db`.
   * When `enableEtlMetadataAndReview` is true, those tables are often a backend-prefiltered
   * subset; we compare against a snapshot of that payload instead of full `get_list` master data.
   */
  etlTablesFromDb?: string[]
}

/**
 * Snapshot the rows used as the ETL master baseline. We freeze the array and
 * its rows so any accidental mutation from the compare UI fails loudly in dev
 * instead of silently corrupting the baseline. We deliberately do **not**
 * `structuredClone` the rows: at 500k+ rows a deep clone blocked the main
 * thread for seconds on every detection cycle. Consumers must treat the
 * returned rows as read-only.
 */
function snapshotRowsForEtlMasterBaseline(rows: any[]): any[] {
  const snapshot = Array.isArray(rows) ? rows.slice() : []
  if (typeof Object.freeze === 'function') {
    for (const row of snapshot) {
      if (row && typeof row === 'object' && !Object.isFrozen(row)) {
        Object.freeze(row)
      }
    }
    Object.freeze(snapshot)
  }
  return snapshot
}

/**
 * Normalize table name for master/instance key matching (snake_case, camelCase, kebab-case).
 */
function normalizeTableName(tableName: string): string {
  if (!tableName) return ''

  if (tableName.includes('_') || tableName.includes('-')) {
    return tableName.replaceAll('-', '_').toLowerCase()
  }

  if (
    tableName !== tableName.toLowerCase() &&
    tableName !== tableName.toUpperCase()
  ) {
    return tableName.replaceAll(/([a-z])([A-Z])/g, '$1_$2').toLowerCase()
  }

  return tableName.toLowerCase()
}

/**
 * Compare table identifiers when instance keys are ALL_CAPS concatenations (e.g. ENOLECTIVOSC)
 * while automation uses snake_case or camelCase (e.g. e_no_lectivos_c vs eNoLectivosC).
 * After normalizeTableName, strip separators so both sides align.
 */
function collapseTableNameForMatch(name: string): string {
  return normalizeTableName(name).replaceAll(/[_-]/g, '')
}

/**
 * True when the master config's `model_table_name` (Django model name) matches the
 * instance key, comparing both the normalized and separator-collapsed forms.
 */
function masterModelNameMatchesInstance(
  masterCfg: Record<string, any> | undefined,
  normalizedInstanceKey: string,
  collapsedInstanceKey: string,
): boolean {
  const modelName = masterCfg?.model_table_name
  if (modelName == null || String(modelName).trim() === '') return false
  if (normalizeTableName(String(modelName)) === normalizedInstanceKey)
    return true
  return collapseTableNameForMatch(String(modelName)) === collapsedInstanceKey
}

/**
 * Find the master config key that matches the given instance key, comparing the
 * master key itself or its `model_table_name`, in both normalized and collapsed forms.
 */
function findMatchingMasterKey(
  masterTableKeys: string[],
  masterDataForMatching: Record<string, any>,
  normalizedInstanceKey: string,
  collapsedInstanceKey: string,
): string | undefined {
  return masterTableKeys.find((masterKey) => {
    if (
      masterModelNameMatchesInstance(
        masterDataForMatching[masterKey],
        normalizedInstanceKey,
        collapsedInstanceKey,
      )
    )
      return true
    if (normalizeTableName(masterKey) === normalizedInstanceKey) return true
    return collapseTableNameForMatch(masterKey) === collapsedInstanceKey
  })
}

/**
 * Resolve the master-data catalog used for matching. Prefer the full automation
 * catalog from `rawConfigurations.masterData` (the drawer/CRUD filter can drop every
 * table); fall back to the filtered `configurations.masterData`.
 */
function resolveMasterDataForMatching(
  rawMaster: Record<string, any> | undefined,
  filteredMaster: Record<string, any>,
): Record<string, any> {
  return rawMaster && Object.keys(rawMaster).length > 0
    ? rawMaster
    : filteredMaster
}

function shouldUseEtlPrefilteredMasterBaseline(
  instanceKey: string,
  etlTablesFromDb: string[] | undefined,
): boolean {
  if (!appConfig.getCore().parameters.etl.enableEtlMetadataAndReview) return false
  if (!etlTablesFromDb?.length) return false
  const collapsedInstance = collapseTableNameForMatch(instanceKey)
  return etlTablesFromDb.some(
    (name) => collapseTableNameForMatch(name) === collapsedInstance,
  )
}

function getCompareStrategyForTable(tableKey: string | undefined) {
  if (!tableKey) return undefined
  return appConfig.getCore().parameters.masterTableMatchingConfig
    ?.compareStrategies?.[tableKey]
}

/**
 * Resolves match key fields and per-key normalized row views for diff (when configured).
 */
export function getMasterCompareRowContext(
  instanceData: any[],
  masterData: any[],
  tableKey: string | undefined,
  fullInstanceData: Record<string, any> | undefined,
): {
  keyFields: string[]
  normInstByKey: Map<string, any>
  normMasterByKey: Map<string, any>
} {
  const strategy = getCompareStrategyForTable(tableKey)
  const hasDictNorm =
    !!strategy?.dictionaries &&
    Object.keys(strategy.dictionaries).length > 0 &&
    !!fullInstanceData

  const instNorm = hasDictNorm
    ? (applyMasterTableDisplayNormalization(
        instanceData,
        fullInstanceData,
        strategy,
      ) as any[])
    : instanceData
  const masterNorm = hasDictNorm
    ? (applyMasterTableDisplayNormalization(
        masterData,
        fullInstanceData,
        strategy,
      ) as any[])
    : masterData

  const keyFields = resolveMatchKeyFields(
    instanceData,
    masterData,
    strategy?.matchFields,
  )

  const normInstByKey = new Map<string, any>()
  instanceData.forEach((row, i) => {
    normInstByKey.set(buildRowMatchKey(row, keyFields), instNorm[i])
  })
  const normMasterByKey = new Map<string, any>()
  masterData.forEach((row, i) => {
    normMasterByKey.set(buildRowMatchKey(row, keyFields), masterNorm[i])
  })

  return { keyFields, normInstByKey, normMasterByKey }
}

export function useMasterTableMatch() {
  const { t } = useI18n()
  const generalStore = useGeneralStore()

  // State
  const matches = ref<TableMatch[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  /** When overwrite returns offer_force_retry, show dialog and allow retry with force=true. */
  const forceRetryOffer = ref<{ message: string; match: TableMatch } | null>(
    null,
  )
  const forceRetryLoading = ref(false)
  const masterDataCache = ref<Record<string, any[]>>({})
  /**
   * First ETL payload snapshot per instance table key when using prefiltered DB baseline.
   * Without this, `detectMatches` would run again after save (new `instance.data` ref) and
   * re-clone current rows as `masterData`, hiding edits vs the real baseline.
   */
  const etlPrefilteredMasterBaselineByTableKey = ref<Record<string, any[]>>({})

  // Computed
  const hasMatches = computed(() => matches.value.length > 0)
  const matchesWithDifferences = computed(() =>
    matches.value.filter((m) => m.hasDifferences),
  )
  const allChoicesMade = computed(() =>
    matches.value.every((m) => m.userChoice !== null),
  )

  /**
   * Helper: Load master table data and cache it
   */
  const loadMasterData = async (
    masterKey: string,
    masterTableConfig: any,
  ): Promise<any[]> => {
    if (masterDataCache.value[masterKey]) {
      return masterDataCache.value[masterKey]
    }

    try {
      const repository = new TableRepository(masterTableConfig, t)
      const masterData = await repository.getList()
      masterDataCache.value[masterKey] = normalizeGetListResponseToRows(
        masterData,
        masterTableConfig,
      )
    } catch (err) {
      console.error(
        t('masterTableMatch.messages.errorLoadingMasterTable', {
          tableName: masterKey,
        }),
        err,
      )
      masterDataCache.value[masterKey] = []
    }

    return masterDataCache.value[masterKey]
  }

  /**
   * Returns the frozen ETL baseline for compare UI, building it from
   * `currentRows` only on first use for that `instanceKey`. The returned
   * array (and its rows) is frozen — callers must not mutate it.
   */
  const getEtlPrefilteredMasterDataFromBaseline = (
    instanceKey: string,
    currentRows: any[],
  ): any[] => {
    const cache = etlPrefilteredMasterBaselineByTableKey.value
    let stored = cache[instanceKey]
    if (!stored) {
      stored = snapshotRowsForEtlMasterBaseline(currentRows)
      etlPrefilteredMasterBaselineByTableKey.value = {
        ...cache,
        [instanceKey]: stored,
      }
    }
    return stored
  }

  /**
   * Helper: Create a table match object
   */
  const createTableMatch = (
    instanceKey: string,
    instanceTableData: any[],
    masterKey: string,
    masterTableConfig: any,
    masterData: any[],
    fullInstanceData: Record<string, any>,
    options?: {
      storageShape?: TableMatch['storageShape']
      instanceSchemaColumns?: string[]
    },
  ): TableMatch => {
    const diffSummary = calculateDiffSummary(
      instanceTableData,
      masterData,
      masterTableConfig,
      instanceKey,
      fullInstanceData,
      options?.instanceSchemaColumns,
    )
    const hasDifferences =
      diffSummary.onlyInInstance > 0 ||
      diffSummary.onlyInMaster > 0 ||
      diffSummary.different > 0

    return {
      tableKey: instanceKey,
      tableName: instanceKey,
      masterKey,
      masterTableTitle: masterTableConfig.title || masterKey,
      instanceData: instanceTableData,
      masterData: masterData,
      masterTableConfig: masterTableConfig,
      fullInstanceData,
      hasDifferences,
      diffSummary,
      userChoice: null,
      storageShape: options?.storageShape ?? 'array_table',
      instanceSchemaColumns: options?.instanceSchemaColumns,
    }
  }

  /**
   * Process an array-shaped instance table and push a match into newMatches.
   */
  const processArrayTableMatch = async (
    instanceKey: string,
    instanceTableData: any[],
    matchingMasterKey: string,
    masterTableConfig: any,
    instanceData: Record<string, any>,
    context: {
      options?: DetectMasterTableMatchesOptions
      newMatches?: TableMatch[]
      instanceSchemaColumns?: string[]
    } = {},
  ): Promise<void> => {
    const { options, newMatches, instanceSchemaColumns } = context
    const useEtlPrefilteredBaseline = shouldUseEtlPrefilteredMasterBaseline(
      instanceKey,
      options?.etlTablesFromDb,
    )
    const masterData = useEtlPrefilteredBaseline
      ? getEtlPrefilteredMasterDataFromBaseline(instanceKey, instanceTableData)
      : await loadMasterData(matchingMasterKey, masterTableConfig)

    newMatches?.push(
      createTableMatch(
        instanceKey,
        instanceTableData,
        matchingMasterKey,
        masterTableConfig,
        masterData,
        instanceData,
        { instanceSchemaColumns },
      ),
    )
  }

  /**
   * Process a parameter/object-shaped instance table and push a match into newMatches.
   */
  const processParameterTableMatch = async (
    instanceKey: string,
    instanceTableData: Record<string, any>,
    matchingMasterKey: string,
    masterTableConfig: any,
    instanceData: Record<string, any>,
    instanceSchema: any,
    context: {
      options?: DetectMasterTableMatchesOptions
      newMatches?: TableMatch[]
    } = {},
  ): Promise<void> => {
    const { options, newMatches } = context
    const filteredObj = filterParameterObjectByVisibleProperties(
      instanceTableData,
      instanceKey,
      instanceSchema,
    )
    const instanceRows = Object.keys(filteredObj)
      .filter((k) => !k.startsWith('__'))
      .map((k) => ({
        id: k,
        parameter: k,
        value: filteredObj[k],
      }))

    const useEtlPrefilteredBaseline = shouldUseEtlPrefilteredMasterBaseline(
      instanceKey,
      options?.etlTablesFromDb,
    )
    const masterRows = useEtlPrefilteredBaseline
      ? getEtlPrefilteredMasterDataFromBaseline(instanceKey, instanceRows)
      : normalizeMasterListToParameterRows(
          await loadMasterData(matchingMasterKey, masterTableConfig),
          masterTableConfig,
        )

    newMatches?.push(
      createTableMatch(
        instanceKey,
        instanceRows,
        matchingMasterKey,
        masterTableConfig,
        masterRows,
        instanceData,
        { storageShape: 'parameter_object' },
      ),
    )
  }

  /**
   * Build the instance schema columns for a matched table, augmenting the schema's
   * own columns with the display columns brought in by the master `columns_to_join`
   * (those replace the FK id and would otherwise be dropped as "extra" columns).
   */
  const getInstanceSchemaColumnsForMatch = (
    instanceTableJsonSchema: any,
    masterTableConfig: any,
  ): string[] | undefined => {
    const schemaColumns = getInstanceTableSchemaColumns(instanceTableJsonSchema)
    if (!schemaColumns) return undefined
    const joinedDisplayColumns = getMasterJoinedDisplayColumns(masterTableConfig)
    return Array.from(new Set([...schemaColumns, ...joinedDisplayColumns]))
  }

  /**
   * Match a single instance table to its master config and dispatch to the
   * array- or parameter-table processor. No-op when there is no matching master.
   */
  const processInstanceTableMatch = async (
    instanceKey: string,
    instanceData: Record<string, any>,
    masterTableKeys: string[],
    masterDataForMatching: Record<string, any>,
    instanceSchema: any,
    options: DetectMasterTableMatchesOptions | undefined,
    newMatches: TableMatch[],
  ): Promise<void> => {
    const instanceTableData = instanceData[instanceKey]

    // Normalize instance key; also collapse _/- so ENOLECTIVOSC matches eNoLectivosC / e_no_lectivos_c
    const normalizedInstanceKey = normalizeTableName(instanceKey)
    const collapsedInstanceKey = collapseTableNameForMatch(instanceKey)

    // Match instance key to master config key, or to model_table_name when set (Django model name).
    const matchingMasterKey = findMatchingMasterKey(
      masterTableKeys,
      masterDataForMatching,
      normalizedInstanceKey,
      collapsedInstanceKey,
    )
    if (!matchingMasterKey) return

    const masterTableConfig = masterDataForMatching[matchingMasterKey]
    const instanceTableJsonSchema =
      getInstanceSchemaRootForTables(instanceSchema)?.properties?.[instanceKey]
    const instanceIsParameterObjectTable = isParameterTableSchema(
      instanceTableJsonSchema,
    )
    const instanceSchemaColumns = getInstanceSchemaColumnsForMatch(
      instanceTableJsonSchema,
      masterTableConfig,
    )

    if (Array.isArray(instanceTableData)) {
      await processArrayTableMatch(
        instanceKey,
        instanceTableData,
        matchingMasterKey,
        masterTableConfig,
        instanceData,
        { options, newMatches, instanceSchemaColumns },
      )
      return
    }

    // Parameter / object dictionary: master is object-shaped in automation, OR instance schema
    // defines an object parameter table (master may still be a normal get_list array in config).
    if (
      instanceTableData != null &&
      typeof instanceTableData === 'object' &&
      !Array.isArray(instanceTableData) &&
      (isParameterTableAutomationConfig(masterTableConfig) ||
        instanceIsParameterObjectTable)
    ) {
      await processParameterTableMatch(
        instanceKey,
        instanceTableData as Record<string, any>,
        matchingMasterKey,
        masterTableConfig,
        instanceData,
        instanceSchema,
        { options, newMatches },
      )
    }
  }

  /**
   * Detect matches between instance tables and master tables
   */
  const detectMatches = async (
    instanceData: Record<string, any>,
    options?: DetectMasterTableMatchesOptions,
  ) => {
    if (!instanceData || typeof instanceData !== 'object') {
      matches.value = []
      return
    }

    const configurations = generalStore.getConfigurations
    /**
     * Drawer / CRUD uses `configurations.masterData` filtered by current schema + user schemas.
     * That filter can drop every table (e.g. schema name mismatch) while the instance still
     * contains rows for those tables — matching must use the full automation catalog from
     * `rawConfigurations.masterData` when present.
     */
    const rawMaster = generalStore.rawConfigurations?.masterData
    const filteredMaster = configurations?.masterData ?? {}
    const masterDataForMatching = resolveMasterDataForMatching(
      rawMaster,
      filteredMaster,
    )

    if (
      !masterDataForMatching ||
      Object.keys(masterDataForMatching).length === 0
    ) {
      matches.value = []
      return
    }

    loading.value = true
    error.value = null

    try {
      if (!options?.etlTablesFromDb?.length) {
        etlPrefilteredMasterBaselineByTableKey.value = {}
      }

      const masterTableKeys = Object.keys(masterDataForMatching)
      const newMatches: TableMatch[] = []
      const instanceSchema = generalStore.schemaConfig?.instanceSchema

      for (const instanceKey of Object.keys(instanceData)) {
        if (instanceKey.startsWith('__')) continue

        await processInstanceTableMatch(
          instanceKey,
          instanceData,
          masterTableKeys,
          masterDataForMatching,
          instanceSchema,
          options,
          newMatches,
        )
      }

      matches.value = newMatches
    } catch (err) {
      console.error('Error detecting master table matches:', err)
      error.value =
        err instanceof Error
          ? err.message
          : t('masterTableMatch.messages.unknownError')
      matches.value = []
    } finally {
      loading.value = false
    }
  }

  /**
   * Calculate summary of differences between two datasets
   */
  const calculateDiffSummary = (
    instanceData: any[],
    masterData: any[],
    masterTableConfig?: any,
    tableKey?: string,
    fullInstanceData?: Record<string, any>,
    instanceSchemaColumns?: string[],
  ): DiffSummary => {
    const excludedCompareKeys =
      getExcludedKeysForMasterTableCompare(masterTableConfig)

    if (!instanceData || instanceData.length === 0) {
      return {
        onlyInInstance: 0,
        onlyInMaster: masterData?.length || 0,
        different: 0,
        identical: 0,
        totalInstance: 0,
        totalMaster: masterData?.length || 0,
      }
    }

    if (!masterData || masterData.length === 0) {
      return {
        onlyInInstance: instanceData.length,
        onlyInMaster: 0,
        different: 0,
        identical: 0,
        totalInstance: instanceData.length,
        totalMaster: 0,
      }
    }

    const { keyFields, normInstByKey, normMasterByKey } =
      getMasterCompareRowContext(
        instanceData,
        masterData,
        tableKey,
        fullInstanceData,
      )

    // Create maps for faster lookup
    const instanceMap = new Map<string, any>()
    const masterMap = new Map<string, any>()

    instanceData.forEach((row) => {
      const key = buildRowMatchKey(row, keyFields)
      instanceMap.set(key, row)
    })

    masterData.forEach((row) => {
      const key = buildRowMatchKey(row, keyFields)
      masterMap.set(key, row)
    })

    let onlyInInstance = 0
    let onlyInMaster = 0
    let different = 0
    let identical = 0

    // Check instance rows
    instanceMap.forEach((_instanceRow, key) => {
      const masterRow = masterMap.get(key)
      const instanceCompare = normInstByKey.get(key) ?? _instanceRow
      const masterCompare = masterRow
        ? (normMasterByKey.get(key) ?? masterRow)
        : undefined
      if (!masterCompare) {
        onlyInInstance++
      } else if (
        areRowsDifferent(
          instanceCompare,
          masterCompare,
          excludedCompareKeys,
          instanceSchemaColumns,
        )
      ) {
        different++
      } else {
        identical++
      }
    })

    // Check master rows not in instance
    masterMap.forEach((_, key) => {
      if (!instanceMap.has(key)) {
        onlyInMaster++
      }
    })

    return {
      onlyInInstance,
      onlyInMaster,
      different,
      identical,
      totalInstance: instanceData.length,
      totalMaster: masterData.length,
    }
  }

  /**
   * Helper: Normalize string value for comparison
   */
  const normalizeString = (str: string): any => {
    const trimmed = str.trim()
    if (trimmed === '') return null

    // Try number conversion
    // Using non-capturing group to avoid ReDoS vulnerability
    if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) {
      const num = Number.parseFloat(trimmed)
      if (!Number.isNaN(num)) {
        return Number.isInteger(num) ? num : Math.round(num * 1000000) / 1000000
      }
    }

    // Try boolean conversion
    const lower = trimmed.toLowerCase()
    if (lower === 'true') return true
    if (lower === 'false') return false

    return trimmed
  }

  /**
   * Helper: Normalize number value for comparison
   */
  const normalizeNumber = (num: number): number | null => {
    if (Number.isNaN(num)) return null
    return Number.isInteger(num) ? num : Math.round(num * 1000000) / 1000000
  }

  /**
   * Normalize a value for comparison
   * Handles type coercion between strings and numbers, trims strings, etc.
   */
  const normalizeValue = (value: any): any => {
    if (value === null || value === undefined || value === '') return null
    if (typeof value === 'string') return normalizeString(value)
    if (typeof value === 'number') return normalizeNumber(value)
    if (typeof value === 'boolean') return value
    if (typeof value === 'object') return JSON.stringify(value)
    return value
  }

  /**
   * Check if two rows are different (ignoring internal fields like 'id')
   */
  const areRowsDifferent = (
    row1: any,
    row2: any,
    excludedKeys: Set<string> = new Set(),
    allowedColumns?: string[],
  ): boolean => {
    const map1 = buildLowercasedKeyMap(row1)
    const map2 = buildLowercasedKeyMap(row2)
    const keysLower = resolveComparableLowercasedKeys({
      row1,
      row2,
      allowedColumns,
      excludedKeys,
    })

    for (const key of keysLower) {
      const val1 = normalizeValue(map1.get(key))
      const val2 = normalizeValue(map2.get(key))

      if (val1 === null && val2 === null) {
        continue
      }

      if (val1 === null || val2 === null) {
        return true
      }

      if (val1 !== val2) {
        return true
      }
    }

    return false
  }

  /**
   * Get detailed row-by-row differences
   */
  const getDetailedDiff = (tableKey: string): RowDiff[] => {
    const match = matches.value.find((m) => m.tableKey === tableKey)
    if (!match) return []

    const excludedCompareKeys = getExcludedKeysForMasterTableCompare(
      match.masterTableConfig,
    )
    const { instanceData, masterData } = match
    const { keyFields, normInstByKey, normMasterByKey } =
      getMasterCompareRowContext(
        instanceData,
        masterData,
        match.tableKey,
        match.fullInstanceData,
      )
    const diffs: RowDiff[] = []

    // Create maps
    const instanceMap = new Map<string, any>()
    const masterMap = new Map<string, any>()

    instanceData.forEach((row) => {
      const key = buildRowMatchKey(row, keyFields)
      instanceMap.set(key, row)
    })

    masterData.forEach((row) => {
      const key = buildRowMatchKey(row, keyFields)
      masterMap.set(key, row)
    })

    // Process instance rows
    instanceMap.forEach((instanceRow, key) => {
      const masterRow = masterMap.get(key)
      const instanceCompare = normInstByKey.get(key) ?? instanceRow
      const masterCompare = masterRow
        ? (normMasterByKey.get(key) ?? masterRow)
        : undefined
      if (!masterCompare) {
        diffs.push({
          type: 'added',
          instanceRow: instanceCompare,
        })
      } else if (
        areRowsDifferent(
          instanceCompare,
          masterCompare,
          excludedCompareKeys,
          match.instanceSchemaColumns,
        )
      ) {
        diffs.push({
          type: 'modified',
          instanceRow: instanceCompare,
          masterRow: masterCompare,
          changes: getRowChanges(
            instanceCompare,
            masterCompare,
            excludedCompareKeys,
            match.instanceSchemaColumns,
          ),
        })
      } else {
        diffs.push({
          type: 'identical',
          instanceRow: instanceCompare,
          masterRow: masterCompare,
        })
      }
    })

    // Process master rows not in instance
    masterMap.forEach((masterRow, key) => {
      if (!instanceMap.has(key)) {
        diffs.push({
          type: 'removed',
          masterRow: normMasterByKey.get(key) ?? masterRow,
        })
      }
    })

    return diffs
  }

  /**
   * Get specific field changes between two rows
   */
  const getRowChanges = (
    instanceRow: any,
    masterRow: any,
    excludedKeys: Set<string> = new Set(),
    allowedColumns?: string[],
  ): { field: string; instanceValue: any; masterValue: any }[] => {
    const changes: { field: string; instanceValue: any; masterValue: any }[] =
      []

    // Resolve the original-case label for each compared (lowercased) key, preferring
    // the instance row's casing so the UI matches the schema-defined name.
    const labelFor = new Map<string, string>()
    const map1 = new Map<string, any>()
    const map2 = new Map<string, any>()
    if (instanceRow && typeof instanceRow === 'object') {
      for (const k of Object.keys(instanceRow)) {
        const lower = k.toLowerCase()
        map1.set(lower, instanceRow[k])
        if (!labelFor.has(lower)) labelFor.set(lower, k)
      }
    }
    if (masterRow && typeof masterRow === 'object') {
      for (const k of Object.keys(masterRow)) {
        const lower = k.toLowerCase()
        map2.set(lower, masterRow[k])
        if (!labelFor.has(lower)) labelFor.set(lower, k)
      }
    }

    const keysLower = resolveComparableLowercasedKeys({
      row1: instanceRow,
      row2: masterRow,
      allowedColumns,
      excludedKeys,
    })

    keysLower.forEach((lower) => {
      const instanceVal = map1.get(lower)
      const masterVal = map2.get(lower)

      const normalizedInstance = normalizeValue(instanceVal)
      const normalizedMaster = normalizeValue(masterVal)

      if (normalizedInstance === null && normalizedMaster === null) return

      if (normalizedInstance !== normalizedMaster) {
        changes.push({
          field: labelFor.get(lower) ?? lower,
          instanceValue: instanceVal,
          masterValue: masterVal,
        })
      }
    })

    return changes
  }

  /**
   * Set user choice for a specific table match
   */
  const setUserChoice = (
    tableKey: string,
    choice: 'keep_uploaded' | 'use_master' | 'replace_master',
  ) => {
    const match = matches.value.find((m) => m.tableKey === tableKey)
    if (match) {
      match.userChoice = choice
    }
  }

  /**
   * Update a specific match after an action has been performed
   * This refreshes the diff summary and hasDifferences flag to reflect the new state
   */
  const updateMatchAfterAction = (
    tableKey: string,
    action: 'use_master' | 'replace_master',
    newInstanceData?: any[],
  ) => {
    const matchIndex = matches.value.findIndex((m) => m.tableKey === tableKey)
    if (matchIndex === -1) return

    const match = matches.value[matchIndex]

    if (action === 'use_master' && newInstanceData) {
      // Instance data now equals master data
      match.instanceData = newInstanceData
      match.diffSummary = calculateDiffSummary(
        newInstanceData,
        match.masterData,
        match.masterTableConfig,
        match.tableKey,
        match.fullInstanceData,
        match.instanceSchemaColumns,
      )
      match.hasDifferences =
        match.diffSummary.onlyInInstance > 0 ||
        match.diffSummary.onlyInMaster > 0 ||
        match.diffSummary.different > 0
    } else if (action === 'replace_master') {
      // Master data now equals instance data
      match.masterData = [...match.instanceData]
      match.diffSummary = calculateDiffSummary(
        match.instanceData,
        match.masterData,
        match.masterTableConfig,
        match.tableKey,
        match.fullInstanceData,
        match.instanceSchemaColumns,
      )
      match.hasDifferences =
        match.diffSummary.onlyInInstance > 0 ||
        match.diffSummary.onlyInMaster > 0 ||
        match.diffSummary.different > 0

      // Also update the cache
      masterDataCache.value[tableKey] = [...match.instanceData]
      if (etlPrefilteredMasterBaselineByTableKey.value[tableKey]) {
        etlPrefilteredMasterBaselineByTableKey.value = {
          ...etlPrefilteredMasterBaselineByTableKey.value,
          [tableKey]: snapshotRowsForEtlMasterBaseline(match.instanceData),
        }
      }
    }

    // Trigger reactivity by replacing the match in the array
    matches.value = [
      ...matches.value.slice(0, matchIndex),
      { ...match },
      ...matches.value.slice(matchIndex + 1),
    ]
  }

  /**
   * Load data from a related table (for foreign key resolution)
   */
  const loadRelatedTableData = async (tableName: string): Promise<any[]> => {
    const raw = generalStore.rawConfigurations?.masterData?.[tableName]
    const filtered = generalStore.getConfigurations?.masterData?.[tableName]
    const tableCfg = raw ?? filtered
    if (!tableCfg) {
      console.warn(
        t('masterTableMatch.messages.relatedTableNotFound', { tableName }),
      )
      return []
    }

    try {
      const repository = new TableRepository(tableCfg, t)
      const data = await repository.getList()
      return normalizeGetListResponseToRows(data, tableCfg)
    } catch (err) {
      console.error(`Error loading related table ${tableName}:`, err)
      return []
    }
  }

  /**
   * Helper: Compare values for matching (handles string case-insensitivity)
   */
  const valuesMatch = (fieldValue: any, rowValue: any): boolean => {
    if (typeof fieldValue === 'string' && typeof rowValue === 'string') {
      return fieldValue.toLowerCase() === rowValue.toLowerCase()
    }
    return fieldValue === rowValue
  }

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
   * Returns a shared promise per related table so concurrent row processing does not
   * trigger one GET per row (race on an empty in-memory cache).
   */
  const getOrLoadRelatedTableRows = (
    tableName: string,
    inflight: Map<string, Promise<any[]>>,
  ): Promise<any[]> => {
    let p = inflight.get(tableName)
    if (p === undefined) {
      p = loadRelatedTableData(tableName)
      inflight.set(tableName, p)
    }
    return p
  }

  /**
   * Helper: Process a single dependent field in a row
   */
  const processDependentField = async (
    processedRow: Record<string, any>,
    fieldKey: string,
    prop: any,
    properties: any,
    relatedTableInflight: Map<string, Promise<any[]>>,
  ): Promise<void> => {
    const foreignKeyField = getForeignKeyFieldName(fieldKey, { properties })
    if (!foreignKeyField) {
      delete processedRow[fieldKey]
      return
    }

    const joinInfo = parseJoinFrom(prop.joinFrom)
    if (!joinInfo) {
      delete processedRow[fieldKey]
      return
    }

    try {
      const relatedRows = await getOrLoadRelatedTableRows(
        joinInfo.table,
        relatedTableInflight,
      )

      const matchingItem = relatedRows.find((item) =>
        valuesMatch(item[joinInfo.field], processedRow[fieldKey]),
      )

      if (matchingItem?.id === undefined) {
        console.warn(
          t('masterTableMatch.messages.noMatchingItemFound', {
            fieldKey,
            fieldValue: processedRow[fieldKey],
            tableName: joinInfo.table,
          }),
        )
      } else {
        processedRow[foreignKeyField] = matchingItem.id
      }
    } catch (error) {
      console.error(
        t('masterTableMatch.messages.errorProcessingDependentField', {
          fieldKey,
        }),
        error,
      )
    }
    delete processedRow[fieldKey]
  }

  /**
   * Prepare data for overwrite - handles columns_to_join by mapping dependent fields to foreign key IDs
   */
  const prepareDataForOverwrite = async (
    data: any[],
    tableConfig: any,
  ): Promise<any[]> => {
    const properties = getListResponseRowProperties(tableConfig)?.properties
    if (!properties) {
      return data.map(({ id, _id, ...rest }) => rest)
    }

    const relatedTableInflight = new Map<string, Promise<any[]>>()

    return Promise.all(
      data.map(async (row) => {
        const processedRow: Record<string, any> = { ...row }

        // Process dependent fields with values
        for (const [fieldKey, fieldProp] of Object.entries(properties)) {
          const prop = fieldProp
          if (hasValidDependentValue(prop, processedRow[fieldKey])) {
            await processDependentField(
              processedRow,
              fieldKey,
              prop,
              properties,
              relatedTableInflight,
            )
          }
        }

        // Remove any remaining dependent fields
        for (const [fieldKey, fieldProp] of Object.entries(properties)) {
          if (fieldProp.isDependentField) {
            delete processedRow[fieldKey]
          }
        }

        delete processedRow.id
        delete processedRow._id
        return processedRow
      }),
    )
  }

  /**
   * Helper: Replace master table with instance data.
   * When backend returns offer_force_retry, sets forceRetryOffer and throws.
   */
  const replaceMasterTable = async (
    match: TableMatch,
    options?: { force?: boolean },
  ): Promise<boolean> => {
    if (!match.masterTableConfig?.overwrite_all) return false
    if (match.storageShape === 'parameter_object') return false

    const repository = new TableRepository(match.masterTableConfig, t)
    const preparedData = await prepareDataForOverwrite(
      match.instanceData,
      match.masterTableConfig,
    )
    try {
      await repository.overwriteAll(preparedData, options)
      masterDataCache.value[match.tableKey] = [...match.instanceData]
      return true
    } catch (err) {
      if (isForceRetryOfferError(err)) {
        forceRetryOffer.value = { message: err.message, match }
        throw err
      }
      throw err
    }
  }

  /**
   * Process a single match choice and update data accordingly
   */
  const processMatchChoice = async (
    match: TableMatch,
    modifiedInstanceData: Record<string, any>,
    masterTablesUpdated: string[],
  ): Promise<void> => {
    if (!match.userChoice) return

    if (match.userChoice === 'use_master') {
      if (match.storageShape === 'parameter_object') {
        modifiedInstanceData[match.tableKey] = parameterRowsToParameterObject(
          match.masterData,
        )
      } else {
        modifiedInstanceData[match.tableKey] = [...match.masterData]
      }
      return
    }

    if (match.userChoice === 'replace_master') {
      const replaced = await replaceMasterTable(match)
      if (replaced) masterTablesUpdated.push(match.tableName)
    }
    // 'keep_uploaded' or default: do nothing
  }

  /**
   * Apply user choices - returns the modified instance data
   * @param options.onlyTableKey When set (e.g. "Guardar en maestro" for one table), only that match
   *   is processed. Otherwise a failed replace on table A would still leave `replace_master` set and
   *   the next save on table B would run both overwrites.
   */
  const applyChoices = async (
    originalInstanceData: Record<string, any>,
    options?: { onlyTableKey?: string },
  ): Promise<{
    instanceData: Record<string, any>
    masterTablesUpdated: string[]
  }> => {
    const modifiedInstanceData = { ...originalInstanceData }
    const masterTablesUpdated: string[] = []
    const onlyTableKey = options?.onlyTableKey

    for (const match of matches.value) {
      if (onlyTableKey !== undefined && match.tableKey !== onlyTableKey) {
        continue
      }
      try {
        await processMatchChoice(
          match,
          modifiedInstanceData,
          masterTablesUpdated,
        )
      } catch (err) {
        if (isForceRetryOfferError(err)) {
          // forceRetryOffer already set in replaceMasterTable; rethrow so caller shows dialog
          throw err
        }
        console.error(`Error updating master table ${match.tableName}:`, err)
        const errorMsg =
          err instanceof Error
            ? err.message
            : t('masterTableMatch.messages.unknownError')
        throw new Error(
          t('masterTableMatch.messages.failedToUpdateMasterTable', {
            tableName: match.masterTableTitle,
            error: errorMsg,
          }),
        )
      }
    }

    return { instanceData: modifiedInstanceData, masterTablesUpdated }
  }

  /**
   * Reset all matches and choices
   */
  const reset = () => {
    matches.value = []
    masterDataCache.value = {}
    etlPrefilteredMasterBaselineByTableKey.value = {}
    error.value = null
    loading.value = false
    forceRetryOffer.value = null
  }

  const acceptForceRetry = async (): Promise<boolean> => {
    const offer = forceRetryOffer.value
    if (!offer) return false
    forceRetryLoading.value = true
    try {
      const replaced = await replaceMasterTable(offer.match, { force: true })
      forceRetryOffer.value = null
      return replaced
    } catch (err) {
      console.error('Error on force overwrite:', err)
      forceRetryOffer.value = null
      throw err
    } finally {
      forceRetryLoading.value = false
    }
  }

  const rejectForceRetry = () => {
    forceRetryOffer.value = null
  }

  /**
   * Check if a specific master table supports the overwrite_all operation
   */
  const canReplaceMasterTable = (tableKey: string): boolean => {
    const match = matches.value.find((m) => m.tableKey === tableKey)
    if (match?.storageShape === 'parameter_object') return false
    return !!match?.masterTableConfig?.overwrite_all
  }

  return {
    // State
    matches,
    loading,
    error,
    forceRetryOffer,
    forceRetryLoading,

    // Computed
    hasMatches,
    matchesWithDifferences,
    allChoicesMade,

    // Methods
    detectMatches,
    getDetailedDiff,
    setUserChoice,
    updateMatchAfterAction,
    applyChoices,
    reset,
    canReplaceMasterTable,
    calculateDiffSummary,
    acceptForceRetry,
    rejectForceRetry,
  }
}
