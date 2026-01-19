/**
 * Composable for detecting and managing matches between instance tables and master tables
 * Provides functionality to compare, diff, and synchronize data between uploaded instance
 * data and master (frontend-automation) tables
 */

import { ref, computed, watch } from 'vue'
import { useGeneralStore } from '@/stores/general'
import TableRepository from '@/repositories/TableRepository'
import { useI18n } from 'vue-i18n'
import { parseJoinFrom, getForeignKeyFieldName } from '@/utils/schemaUtils'

export interface TableMatch {
  tableKey: string
  tableName: string
  masterTableTitle: string
  instanceData: any[]
  masterData: any[]
  masterTableConfig: any
  hasDifferences: boolean
  diffSummary: DiffSummary
  userChoice: 'keep_uploaded' | 'use_master' | 'replace_master' | null
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

export function useMasterTableMatch() {
  const { t } = useI18n()
  const generalStore = useGeneralStore()

  // State
  const matches = ref<TableMatch[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const masterDataCache = ref<Record<string, any[]>>({})

  // Computed
  const hasMatches = computed(() => matches.value.length > 0)
  const matchesWithDifferences = computed(() =>
    matches.value.filter((m) => m.hasDifferences),
  )
  const allChoicesMade = computed(() =>
    matches.value.every((m) => m.userChoice !== null),
  )

  /**
   * Get the primary key fields for comparison
   * Priority: domain-specific identifiers (codigo_, code_, etc.) BEFORE internal 'id'
   * because instance data may have generated internal IDs that don't match master data
   */
  const getPrimaryKeyField = (data: any[], schema?: any): string => {
    if (!data || data.length === 0) return 'id'

    const firstItem = data[0]
    const keys = Object.keys(firstItem)

    // IMPORTANT: Prefer domain-specific identifier patterns BEFORE internal 'id'
    const idPatterns = [
      'codigo_',
      'codigo',
      'code_',
      'code',
      'key_',
      'key',
      'nombre',
      'name',
    ]
    for (const pattern of idPatterns) {
      const match = keys.find((k) =>
        k.toLowerCase().startsWith(pattern.toLowerCase()),
      )
      if (match) return match
    }

    // Only use 'id' if no domain-specific key was found AND it doesn't look like a generated ID
    if (keys.includes('id')) {
      const sampleId = firstItem['id']
      // If ID looks like a generated internal ID (contains underscore + long string), skip it
      if (
        typeof sampleId === 'string' &&
        sampleId.includes('_') &&
        sampleId.length > 20
      ) {
        // Generated internal ID, skip
      } else {
        return 'id'
      }
    }

    // Fallback to first non-id field
    const firstNonId = keys.find((k) => k !== 'id' && k !== '_id')
    return firstNonId || keys[0] || 'id'
  }

  /**
   * Helper: Load master table data and cache it
   */
  const loadMasterData = async (masterKey: string, masterTableConfig: any): Promise<any[]> => {
    if (masterDataCache.value[masterKey]) {
      return masterDataCache.value[masterKey]
    }

    try {
      const repository = new TableRepository(masterTableConfig, t)
      const masterData = await repository.getList()
      masterDataCache.value[masterKey] = Array.isArray(masterData) ? masterData : []
    } catch (err) {
      console.error(t('masterTableMatch.messages.errorLoadingMasterTable', { tableName: masterKey }), err)
      masterDataCache.value[masterKey] = []
    }

    return masterDataCache.value[masterKey]
  }

  /**
   * Helper: Create a table match object
   */
  const createTableMatch = (
    instanceKey: string, 
    instanceTableData: any[], 
    masterKey: string,
    masterTableConfig: any, 
    masterData: any[]
  ): TableMatch => {
    const diffSummary = calculateDiffSummary(instanceTableData, masterData)
    const hasDifferences = diffSummary.onlyInInstance > 0 || diffSummary.onlyInMaster > 0 || diffSummary.different > 0

    return {
      tableKey: instanceKey,
      tableName: instanceKey,
      masterTableTitle: masterTableConfig.title || masterKey,
      instanceData: instanceTableData,
      masterData: masterData,
      masterTableConfig: masterTableConfig,
      hasDifferences,
      diffSummary,
      userChoice: null,
    }
  }

  /**
   * Detect matches between instance tables and master tables
   */
  const detectMatches = async (instanceData: Record<string, any>) => {
    if (!instanceData || typeof instanceData !== 'object') {
      matches.value = []
      return
    }

    const configurations = generalStore.getConfigurations
    if (!configurations?.masterData) {
      matches.value = []
      return
    }

    loading.value = true
    error.value = null

    try {
      const masterTableKeys = Object.keys(configurations.masterData)
      const newMatches: TableMatch[] = []

      for (const instanceKey of Object.keys(instanceData)) {
        const instanceTableData = instanceData[instanceKey]
        if (!Array.isArray(instanceTableData)) continue

        const matchingMasterKey = masterTableKeys.find(
          (masterKey) => masterKey.toLowerCase() === instanceKey.toLowerCase(),
        )
        if (!matchingMasterKey) continue

        const masterTableConfig = configurations.masterData[matchingMasterKey]
        const masterData = await loadMasterData(matchingMasterKey, masterTableConfig)

        newMatches.push(createTableMatch(instanceKey, instanceTableData, matchingMasterKey, masterTableConfig, masterData))
      }

      matches.value = newMatches
    } catch (err) {
      console.error('Error detecting master table matches:', err)
      error.value = err instanceof Error ? err.message : t('masterTableMatch.messages.unknownError')
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
  ): DiffSummary => {
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

    const primaryKey = getPrimaryKeyField(instanceData)

    // Create maps for faster lookup
    const instanceMap = new Map<string, any>()
    const masterMap = new Map<string, any>()

    instanceData.forEach((row) => {
      const key = String(row[primaryKey] ?? JSON.stringify(row))
      instanceMap.set(key, row)
    })

    masterData.forEach((row) => {
      const key = String(row[primaryKey] ?? JSON.stringify(row))
      masterMap.set(key, row)
    })

    let onlyInInstance = 0
    let onlyInMaster = 0
    let different = 0
    let identical = 0

    // Check instance rows
    instanceMap.forEach((instanceRow, key) => {
      const masterRow = masterMap.get(key)
      if (!masterRow) {
        onlyInInstance++
      } else if (areRowsDifferent(instanceRow, masterRow)) {
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
      const num = parseFloat(trimmed)
      if (!isNaN(num)) {
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
    if (isNaN(num)) return null
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
  const areRowsDifferent = (row1: any, row2: any): boolean => {
    const ignoredFields = ['id', '_id', 'created_at', 'updated_at']

    const keys1 = Object.keys(row1).filter((k) => !ignoredFields.includes(k))
    const keys2 = Object.keys(row2).filter((k) => !ignoredFields.includes(k))

    // Get all unique keys
    const allKeys = new Set([...keys1, ...keys2])

    for (const key of allKeys) {
      const val1 = normalizeValue(row1[key])
      const val2 = normalizeValue(row2[key])

      // Both null/undefined are equal
      if (val1 === null && val2 === null) {
        continue
      }

      // One is null, the other isn't
      if (val1 === null || val2 === null) {
        return true
      }

      // Compare normalized values
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

    const { instanceData, masterData } = match
    const primaryKey = getPrimaryKeyField(instanceData)
    const diffs: RowDiff[] = []

    // Create maps
    const instanceMap = new Map<string, any>()
    const masterMap = new Map<string, any>()

    instanceData.forEach((row) => {
      const key = String(row[primaryKey] ?? JSON.stringify(row))
      instanceMap.set(key, row)
    })

    masterData.forEach((row) => {
      const key = String(row[primaryKey] ?? JSON.stringify(row))
      masterMap.set(key, row)
    })

    // Process instance rows
    instanceMap.forEach((instanceRow, key) => {
      const masterRow = masterMap.get(key)
      if (!masterRow) {
        diffs.push({
          type: 'added',
          instanceRow,
        })
      } else if (areRowsDifferent(instanceRow, masterRow)) {
        diffs.push({
          type: 'modified',
          instanceRow,
          masterRow,
          changes: getRowChanges(instanceRow, masterRow),
        })
      } else {
        diffs.push({
          type: 'identical',
          instanceRow,
          masterRow,
        })
      }
    })

    // Process master rows not in instance
    masterMap.forEach((masterRow, key) => {
      if (!instanceMap.has(key)) {
        diffs.push({
          type: 'removed',
          masterRow,
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
  ): { field: string; instanceValue: any; masterValue: any }[] => {
    const ignoredFields = ['id', '_id', 'created_at', 'updated_at']
    const changes: { field: string; instanceValue: any; masterValue: any }[] =
      []

    const allKeys = new Set([
      ...Object.keys(instanceRow),
      ...Object.keys(masterRow),
    ])

    allKeys.forEach((key) => {
      if (ignoredFields.includes(key)) return

      const instanceVal = instanceRow[key]
      const masterVal = masterRow[key]

      // Use normalized values for comparison
      const normalizedInstance = normalizeValue(instanceVal)
      const normalizedMaster = normalizeValue(masterVal)

      // Both null are equal
      if (normalizedInstance === null && normalizedMaster === null) {
        return
      }

      // Compare normalized values
      if (normalizedInstance !== normalizedMaster) {
        changes.push({
          field: key,
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
      )
      match.hasDifferences =
        match.diffSummary.onlyInInstance > 0 ||
        match.diffSummary.onlyInMaster > 0 ||
        match.diffSummary.different > 0

      // Also update the cache
      masterDataCache.value[tableKey] = [...match.instanceData]
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
    const configurations = generalStore.getConfigurations
    if (!configurations?.masterData?.[tableName]) {
      console.warn(
        t('masterTableMatch.messages.relatedTableNotFound', { tableName }),
      )
      return []
    }

    try {
      const repository = new TableRepository(
        configurations.masterData[tableName],
        t,
      )
      const data = await repository.getList()
      return Array.isArray(data) ? data : []
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
    return prop.isDependentField && prop.joinFrom && value !== undefined && value !== null && value !== ''
  }

  /**
   * Helper: Process a single dependent field in a row
   */
  const processDependentField = async (
    processedRow: Record<string, any>,
    fieldKey: string,
    prop: any,
    properties: any,
    relatedDataCache: Record<string, any[]>,
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
      if (!relatedDataCache[joinInfo.table]) {
        relatedDataCache[joinInfo.table] = await loadRelatedTableData(joinInfo.table)
      }

      const matchingItem = relatedDataCache[joinInfo.table].find(
        (item) => valuesMatch(item[joinInfo.field], processedRow[fieldKey])
      )

      if (matchingItem?.id !== undefined) {
        processedRow[foreignKeyField] = matchingItem.id
      } else {
        console.warn(t('masterTableMatch.messages.noMatchingItemFound', { fieldKey, fieldValue: processedRow[fieldKey], tableName: joinInfo.table }))
      }
    } catch (error) {
      console.error(t('masterTableMatch.messages.errorProcessingDependentField', { fieldKey }), error)
    }
    delete processedRow[fieldKey]
  }

  /**
   * Prepare data for overwrite - handles columns_to_join by mapping dependent fields to foreign key IDs
   */
  const prepareDataForOverwrite = async (data: any[], tableConfig: any): Promise<any[]> => {
    const properties = tableConfig?.get_list?.response_schema?.items?.properties
    if (!properties) {
      return data.map(({ id, _id, ...rest }) => rest)
    }

    const relatedDataCache: Record<string, any[]> = {}

    return Promise.all(
      data.map(async (row) => {
        const processedRow: Record<string, any> = { ...row }

        // Process dependent fields with values
        for (const [fieldKey, fieldProp] of Object.entries(properties)) {
          const prop = fieldProp as any
          if (hasValidDependentValue(prop, processedRow[fieldKey])) {
            await processDependentField(processedRow, fieldKey, prop, properties, relatedDataCache)
          }
        }

        // Remove any remaining dependent fields
        for (const [fieldKey, fieldProp] of Object.entries(properties)) {
          if ((fieldProp as any).isDependentField) {
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
   * Helper: Replace master table with instance data
   */
  const replaceMasterTable = async (match: TableMatch): Promise<boolean> => {
    if (!match.masterTableConfig?.overwrite_all) return false

    const repository = new TableRepository(match.masterTableConfig, t)
    const preparedData = await prepareDataForOverwrite(match.instanceData, match.masterTableConfig)
    await repository.overwriteAll(preparedData)
    masterDataCache.value[match.tableKey] = [...match.instanceData]
    return true
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
      modifiedInstanceData[match.tableKey] = [...match.masterData]
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
   */
  const applyChoices = async (
    originalInstanceData: Record<string, any>,
  ): Promise<{ instanceData: Record<string, any>; masterTablesUpdated: string[] }> => {
    const modifiedInstanceData = { ...originalInstanceData }
    const masterTablesUpdated: string[] = []

    for (const match of matches.value) {
      try {
        await processMatchChoice(match, modifiedInstanceData, masterTablesUpdated)
      } catch (err) {
        console.error(`Error updating master table ${match.tableName}:`, err)
        const errorMsg = err instanceof Error ? err.message : t('masterTableMatch.messages.unknownError')
        throw new Error(t('masterTableMatch.messages.failedToUpdateMasterTable', { tableName: match.masterTableTitle, error: errorMsg }))
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
    error.value = null
    loading.value = false
  }

  /**
   * Check if a specific master table supports the overwrite_all operation
   */
  const canReplaceMasterTable = (tableKey: string): boolean => {
    const match = matches.value.find((m) => m.tableKey === tableKey)
    return !!match?.masterTableConfig?.overwrite_all
  }

  return {
    // State
    matches,
    loading,
    error,

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
  }
}
