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
    matches.value.filter((m) => m.hasDifferences)
  )
  const allChoicesMade = computed(() =>
    matches.value.every((m) => m.userChoice !== null)
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
    const idPatterns = ['codigo_', 'codigo', 'code_', 'code', 'key_', 'key', 'nombre', 'name']
    for (const pattern of idPatterns) {
      const match = keys.find((k) => k.toLowerCase().startsWith(pattern.toLowerCase()))
      if (match) return match
    }

    // Only use 'id' if no domain-specific key was found AND it doesn't look like a generated ID
    if (keys.includes('id')) {
      const sampleId = firstItem['id']
      // If ID looks like a generated internal ID (contains underscore + long string), skip it
      if (typeof sampleId === 'string' && sampleId.includes('_') && sampleId.length > 20) {
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
    const newMatches: TableMatch[] = []

    try {
      const masterTableKeys = Object.keys(configurations.masterData)
      const instanceTableKeys = Object.keys(instanceData)

      // Find matches by comparing table names (case-insensitive)
      for (const instanceKey of instanceTableKeys) {
        const instanceTableData = instanceData[instanceKey]

        // Skip if not an array (not a table)
        if (!Array.isArray(instanceTableData)) continue

        // Find matching master table
        const matchingMasterKey = masterTableKeys.find(
          (masterKey) => masterKey.toLowerCase() === instanceKey.toLowerCase()
        )

        if (matchingMasterKey) {
          const masterTableConfig = configurations.masterData[matchingMasterKey]

          // Load master table data if not cached
          if (!masterDataCache.value[matchingMasterKey]) {
            try {
              const repository = new TableRepository(masterTableConfig, t)
              const masterData = await repository.getList()
              masterDataCache.value[matchingMasterKey] = Array.isArray(masterData)
                ? masterData
                : []
            } catch (err) {
              console.error(
                `Error loading master table ${matchingMasterKey}:`,
                err
              )
              masterDataCache.value[matchingMasterKey] = []
            }
          }

          const masterData = masterDataCache.value[matchingMasterKey]
          const diffSummary = calculateDiffSummary(instanceTableData, masterData)

          newMatches.push({
            tableKey: instanceKey,
            tableName: instanceKey,
            masterTableTitle:
              masterTableConfig.title || matchingMasterKey,
            instanceData: instanceTableData,
            masterData: masterData,
            masterTableConfig: masterTableConfig,
            hasDifferences:
              diffSummary.onlyInInstance > 0 ||
              diffSummary.onlyInMaster > 0 ||
              diffSummary.different > 0,
            diffSummary,
            userChoice: null, // Default: no choice made
          })
        }
      }

      matches.value = newMatches
    } catch (err) {
      console.error('Error detecting master table matches:', err)
      error.value = err instanceof Error ? err.message : 'Unknown error'
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
    masterData: any[]
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
   * Normalize a value for comparison
   * Handles type coercion between strings and numbers, trims strings, etc.
   */
  const normalizeValue = (value: any): any => {
    // Handle null/undefined
    if (value === null || value === undefined || value === '') {
      return null
    }

    // Handle strings
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (trimmed === '') return null

      // Try to convert to number if it looks like one
      if (/^-?\d+\.?\d*$/.test(trimmed)) {
        const num = parseFloat(trimmed)
        if (!isNaN(num)) {
          // Return as integer if it's a whole number
          return Number.isInteger(num) ? num : Math.round(num * 1000000) / 1000000
        }
      }

      // Try to convert to boolean
      if (trimmed.toLowerCase() === 'true') return true
      if (trimmed.toLowerCase() === 'false') return false

      return trimmed
    }

    // Handle numbers - normalize floating point precision
    if (typeof value === 'number') {
      if (isNaN(value)) return null
      // Round to 6 decimal places to avoid floating point precision issues
      return Number.isInteger(value) ? value : Math.round(value * 1000000) / 1000000
    }

    // Handle booleans
    if (typeof value === 'boolean') {
      return value
    }

    // Handle objects/arrays
    if (typeof value === 'object') {
      return JSON.stringify(value)
    }

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
    masterRow: any
  ): { field: string; instanceValue: any; masterValue: any }[] => {
    const ignoredFields = ['id', '_id', 'created_at', 'updated_at']
    const changes: { field: string; instanceValue: any; masterValue: any }[] = []

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
    choice: 'keep_uploaded' | 'use_master' | 'replace_master'
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
    newInstanceData?: any[]
  ) => {
    const matchIndex = matches.value.findIndex((m) => m.tableKey === tableKey)
    if (matchIndex === -1) return

    const match = matches.value[matchIndex]

    if (action === 'use_master' && newInstanceData) {
      // Instance data now equals master data
      match.instanceData = newInstanceData
      match.diffSummary = calculateDiffSummary(newInstanceData, match.masterData)
      match.hasDifferences =
        match.diffSummary.onlyInInstance > 0 ||
        match.diffSummary.onlyInMaster > 0 ||
        match.diffSummary.different > 0
    } else if (action === 'replace_master') {
      // Master data now equals instance data
      match.masterData = [...match.instanceData]
      match.diffSummary = calculateDiffSummary(match.instanceData, match.masterData)
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
      console.warn(`Related table ${tableName} not found in configurations`)
      return []
    }

    try {
      const repository = new TableRepository(configurations.masterData[tableName], t)
      const data = await repository.getList()
      return Array.isArray(data) ? data : []
    } catch (err) {
      console.error(`Error loading related table ${tableName}:`, err)
      return []
    }
  }

  /**
   * Prepare data for overwrite - handles columns_to_join by mapping dependent fields to foreign key IDs
   * This mimics the logic in useTableData.ts mapDependentFieldsToIds
   */
  const prepareDataForOverwrite = async (
    data: any[],
    tableConfig: any
  ): Promise<any[]> => {
    // Get schema properties from the table config
    const properties = tableConfig?.get_list?.response_schema?.items?.properties
    if (!properties) {
      // No schema, just remove id fields
      return data.map((row) => {
        const { id, _id, ...rest } = row
        return rest
      })
    }

    // Cache for related table data
    const relatedDataCache: Record<string, any[]> = {}

    // Process each row
    const processedData = await Promise.all(
      data.map(async (row) => {
        const processedRow: Record<string, any> = { ...row }

        // Find all dependent fields that have values in this row
        for (const [fieldKey, fieldProp] of Object.entries(properties)) {
          const prop = fieldProp as any

          // Check if this is a dependent field with a value in the row
          if (
            prop.isDependentField &&
            prop.joinFrom &&
            processedRow[fieldKey] !== undefined &&
            processedRow[fieldKey] !== null &&
            processedRow[fieldKey] !== ''
          ) {
            // Get the foreign key field name that this dependent field belongs to
            const foreignKeyField = getForeignKeyFieldName(fieldKey, { properties })
            if (!foreignKeyField) continue

            // Parse joinFrom to get table and field information
            const joinInfo = parseJoinFrom(prop.joinFrom)
            if (!joinInfo) continue

            try {
              // Load related table data if not cached
              if (!relatedDataCache[joinInfo.table]) {
                relatedDataCache[joinInfo.table] = await loadRelatedTableData(joinInfo.table)
              }

              const relatedTableData = relatedDataCache[joinInfo.table]

              // Find the item in the related table that matches the value
              const matchingItem = relatedTableData.find((item) => {
                const fieldValue = item[joinInfo.field]
                const rowValue = processedRow[fieldKey]

                // Compare values (handle different types)
                if (typeof fieldValue === 'string' && typeof rowValue === 'string') {
                  return fieldValue.toLowerCase() === rowValue.toLowerCase()
                }
                return fieldValue === rowValue
              })

              if (matchingItem && matchingItem.id !== undefined) {
                // Set the foreign key ID
                processedRow[foreignKeyField] = matchingItem.id
                // Remove the dependent field (it's only for display)
                delete processedRow[fieldKey]
              } else {
                // If no match found, log a warning but keep the row
                console.warn(
                  `No matching item found for ${fieldKey}="${processedRow[fieldKey]}" in table ${joinInfo.table}`
                )
                // Remove the dependent field even if no match (to avoid sending it)
                delete processedRow[fieldKey]
              }
            } catch (error) {
              console.error(
                `Error processing dependent field ${fieldKey}:`,
                error
              )
              // Remove the dependent field on error
              delete processedRow[fieldKey]
            }
          }
        }

        // Also remove any remaining dependent fields that weren't processed
        for (const [fieldKey, fieldProp] of Object.entries(properties)) {
          const prop = fieldProp as any
          if (prop.isDependentField && processedRow[fieldKey] !== undefined) {
            delete processedRow[fieldKey]
          }
        }

        // Remove internal id fields
        delete processedRow.id
        delete processedRow._id

        return processedRow
      })
    )

    return processedData
  }

  /**
   * Apply user choices - returns the modified instance data
   */
  const applyChoices = async (
    originalInstanceData: Record<string, any>
  ): Promise<{
    instanceData: Record<string, any>
    masterTablesUpdated: string[]
  }> => {
    const modifiedInstanceData = { ...originalInstanceData }
    const masterTablesUpdated: string[] = []

    for (const match of matches.value) {
      if (!match.userChoice) continue

      switch (match.userChoice) {
        case 'use_master':
          // Replace instance data with master data
          modifiedInstanceData[match.tableKey] = [...match.masterData]
          break

        case 'replace_master':
          // Update master table with instance data
          if (match.masterTableConfig?.overwrite_all) {
            try {
              const repository = new TableRepository(match.masterTableConfig, t)
              
              // Prepare data for overwrite:
              // - Remove 'id' and '_id' fields
              // - Map dependent fields (join_from) to foreign key IDs (columns_to_join)
              // - Remove dependent fields from the data
              const preparedData = await prepareDataForOverwrite(
                match.instanceData,
                match.masterTableConfig
              )
              
              await repository.overwriteAll(preparedData)
              masterTablesUpdated.push(match.tableName)

              // Update cache (keep the original data with IDs for local use)
              masterDataCache.value[match.tableKey] = [...match.instanceData]
            } catch (err) {
              console.error(
                `Error updating master table ${match.tableName}:`,
                err
              )
              throw new Error(
                `Failed to update master table "${match.masterTableTitle}": ${
                  err instanceof Error ? err.message : 'Unknown error'
                }`
              )
            }
          }
          break

        case 'keep_uploaded':
        default:
          // Keep instance data as-is (default behavior)
          break
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

