/**
 * Composable for tracking changes across multiple tables
 * Used for Excel-like editing where users can make multiple changes
 * across different tables before reviewing and saving them all at once.
 */
import { ref, computed, readonly } from 'vue'

// Type definitions
export interface FieldChange {
  oldValue: any
  newValue: any
  fieldKey: string
  fieldTitle?: string
  timestamp: number
}

export interface RowChanges {
  [fieldKey: string]: FieldChange
}

export interface TableChanges {
  [rowId: string]: RowChanges
}

export interface AllChanges {
  [tableKey: string]: TableChanges
}

export interface ChangesSummary {
  tableKey: string
  tableTitle: string
  rowId: string
  rowIdentifier?: string // Human-readable identifier for the row
  fieldKey: string
  fieldTitle: string
  oldValue: any
  newValue: any
  timestamp: number
}

// Singleton state to share across components
const pendingChanges = ref<AllChanges>({})
const tableTitles = ref<Record<string, string>>({})

/**
 * Composable for managing table changes
 */
export function useTableChanges() {
  /**
   * Record a change for a specific cell
   */
  const recordChange = (
    tableKey: string,
    rowId: string | number,
    fieldKey: string,
    oldValue: any,
    newValue: any,
    fieldTitle?: string,
    tableTitle?: string
  ) => {
    const rowIdStr = String(rowId)

    // Initialize table if not exists
    if (!pendingChanges.value[tableKey]) {
      pendingChanges.value[tableKey] = {}
    }

    // Initialize row if not exists
    if (!pendingChanges.value[tableKey][rowIdStr]) {
      pendingChanges.value[tableKey][rowIdStr] = {}
    }

    // Check if value is actually different from original
    const existingChange = pendingChanges.value[tableKey][rowIdStr][fieldKey]
    const originalValue = existingChange ? existingChange.oldValue : oldValue

    // If new value equals original value, remove the change
    if (areValuesEqual(newValue, originalValue)) {
      delete pendingChanges.value[tableKey][rowIdStr][fieldKey]

      // Clean up empty row
      if (Object.keys(pendingChanges.value[tableKey][rowIdStr]).length === 0) {
        delete pendingChanges.value[tableKey][rowIdStr]
      }

      // Clean up empty table
      if (Object.keys(pendingChanges.value[tableKey]).length === 0) {
        delete pendingChanges.value[tableKey]
      }

      return false // No change recorded
    }

    // Record the change
    pendingChanges.value[tableKey][rowIdStr][fieldKey] = {
      oldValue: originalValue,
      newValue,
      fieldKey,
      fieldTitle: fieldTitle || fieldKey,
      timestamp: Date.now(),
    }

    // Store table title if provided
    if (tableTitle) {
      tableTitles.value[tableKey] = tableTitle
    }

    return true // Change recorded
  }

  /**
   * Check if two values are equal (handles different types)
   */
  const areValuesEqual = (val1: any, val2: any): boolean => {
    // Handle null/undefined
    if (val1 === null || val1 === undefined) {
      return val2 === null || val2 === undefined
    }

    // Handle booleans
    if (typeof val1 === 'boolean' || typeof val2 === 'boolean') {
      return Boolean(val1) === Boolean(val2)
    }

    // Handle numbers
    if (typeof val1 === 'number' || typeof val2 === 'number') {
      return Number(val1) === Number(val2)
    }

    // Handle strings
    return String(val1) === String(val2)
  }

  /**
   * Revert a specific change
   */
  const revertChange = (
    tableKey: string,
    rowId: string | number,
    fieldKey: string
  ): FieldChange | null => {
    const rowIdStr = String(rowId)

    if (!pendingChanges.value[tableKey]?.[rowIdStr]?.[fieldKey]) {
      return null
    }

    const change = pendingChanges.value[tableKey][rowIdStr][fieldKey]
    delete pendingChanges.value[tableKey][rowIdStr][fieldKey]

    // Clean up empty row
    if (Object.keys(pendingChanges.value[tableKey][rowIdStr]).length === 0) {
      delete pendingChanges.value[tableKey][rowIdStr]
    }

    // Clean up empty table
    if (Object.keys(pendingChanges.value[tableKey]).length === 0) {
      delete pendingChanges.value[tableKey]
    }

    return change
  }

  /**
   * Revert all changes for a specific row
   */
  const revertRowChanges = (tableKey: string, rowId: string | number): RowChanges | null => {
    const rowIdStr = String(rowId)

    if (!pendingChanges.value[tableKey]?.[rowIdStr]) {
      return null
    }

    const changes = { ...pendingChanges.value[tableKey][rowIdStr] }
    delete pendingChanges.value[tableKey][rowIdStr]

    // Clean up empty table
    if (Object.keys(pendingChanges.value[tableKey]).length === 0) {
      delete pendingChanges.value[tableKey]
    }

    return changes
  }

  /**
   * Revert all changes for a specific table
   */
  const revertTableChanges = (tableKey: string): TableChanges | null => {
    if (!pendingChanges.value[tableKey]) {
      return null
    }

    const changes = { ...pendingChanges.value[tableKey] }
    delete pendingChanges.value[tableKey]
    delete tableTitles.value[tableKey]

    return changes
  }

  /**
   * Clear all pending changes
   */
  const clearAllChanges = () => {
    pendingChanges.value = {}
    tableTitles.value = {}
  }

  /**
   * Get changes for a specific table
   */
  const getChangesForTable = (tableKey: string): TableChanges | null => {
    return pendingChanges.value[tableKey] || null
  }

  /**
   * Get all pending changes
   */
  const getAllChanges = (): AllChanges => {
    return pendingChanges.value
  }

  /**
   * Check if a specific cell has been modified
   */
  const isCellModified = (
    tableKey: string,
    rowId: string | number,
    fieldKey: string
  ): boolean => {
    const rowIdStr = String(rowId)
    return !!pendingChanges.value[tableKey]?.[rowIdStr]?.[fieldKey]
  }

  /**
   * Check if a specific row has any modifications
   */
  const isRowModified = (tableKey: string, rowId: string | number): boolean => {
    const rowIdStr = String(rowId)
    const rowChanges = pendingChanges.value[tableKey]?.[rowIdStr]
    return rowChanges ? Object.keys(rowChanges).length > 0 : false
  }

  /**
   * Check if a specific table has any modifications
   */
  const isTableModified = (tableKey: string): boolean => {
    const tableChanges = pendingChanges.value[tableKey]
    return tableChanges ? Object.keys(tableChanges).length > 0 : false
  }

  /**
   * Get the current value for a cell (considering pending changes)
   */
  const getCurrentValue = (
    tableKey: string,
    rowId: string | number,
    fieldKey: string,
    originalValue: any
  ): any => {
    const rowIdStr = String(rowId)
    const change = pendingChanges.value[tableKey]?.[rowIdStr]?.[fieldKey]
    return change ? change.newValue : originalValue
  }

  /**
   * Get a flat list of all changes for review
   */
  const getChangesSummary = (
    getRowIdentifier?: (tableKey: string, rowId: string, rowData?: any) => string
  ): ChangesSummary[] => {
    const summary: ChangesSummary[] = []

    Object.entries(pendingChanges.value).forEach(([tableKey, tableChanges]) => {
      Object.entries(tableChanges).forEach(([rowId, rowChanges]) => {
        Object.entries(rowChanges).forEach(([fieldKey, change]) => {
          summary.push({
            tableKey,
            tableTitle: tableTitles.value[tableKey] || tableKey,
            rowId,
            rowIdentifier: getRowIdentifier ? getRowIdentifier(tableKey, rowId) : rowId,
            fieldKey,
            fieldTitle: change.fieldTitle || fieldKey,
            oldValue: change.oldValue,
            newValue: change.newValue,
            timestamp: change.timestamp,
          })
        })
      })
    })

    // Sort by timestamp (most recent first)
    return summary.sort((a, b) => b.timestamp - a.timestamp)
  }

  /**
   * Check if there are any pending changes
   */
  const hasChanges = computed(() => {
    return Object.keys(pendingChanges.value).length > 0
  })

  /**
   * Get total count of changes
   */
  const totalChangesCount = computed(() => {
    let count = 0
    Object.values(pendingChanges.value).forEach((tableChanges) => {
      Object.values(tableChanges).forEach((rowChanges) => {
        count += Object.keys(rowChanges).length
      })
    })
    return count
  })

  /**
   * Get count of modified tables
   */
  const modifiedTablesCount = computed(() => {
    return Object.keys(pendingChanges.value).length
  })

  /**
   * Get list of modified table keys
   */
  const modifiedTableKeys = computed(() => {
    return Object.keys(pendingChanges.value)
  })

  /**
   * Apply all pending changes to the data
   * Returns the updated data object
   */
  const applyChangesToData = (data: Record<string, any[]>): Record<string, any[]> => {
    const updatedData = JSON.parse(JSON.stringify(data)) // Deep clone

    Object.entries(pendingChanges.value).forEach(([tableKey, tableChanges]) => {
      if (!updatedData[tableKey]) return

      Object.entries(tableChanges).forEach(([rowId, rowChanges]) => {
        const rowIndex = updatedData[tableKey].findIndex(
          (item: any) => String(item.id) === rowId
        )

        if (rowIndex !== -1) {
          Object.entries(rowChanges).forEach(([fieldKey, change]) => {
            updatedData[tableKey][rowIndex][fieldKey] = change.newValue
          })
        }
      })
    })

    return updatedData
  }

  /**
   * Get changes grouped by table for API calls
   */
  const getChangesGroupedByTable = (): Array<{
    tableKey: string
    tableTitle: string
    changes: Array<{
      rowId: string
      fields: Array<{ fieldKey: string; oldValue: any; newValue: any }>
    }>
  }> => {
    const grouped: Array<{
      tableKey: string
      tableTitle: string
      changes: Array<{
        rowId: string
        fields: Array<{ fieldKey: string; oldValue: any; newValue: any }>
      }>
    }> = []

    Object.entries(pendingChanges.value).forEach(([tableKey, tableChanges]) => {
      const tableGroup = {
        tableKey,
        tableTitle: tableTitles.value[tableKey] || tableKey,
        changes: [] as Array<{
          rowId: string
          fields: Array<{ fieldKey: string; oldValue: any; newValue: any }>
        }>,
      }

      Object.entries(tableChanges).forEach(([rowId, rowChanges]) => {
        const rowGroup = {
          rowId,
          fields: [] as Array<{ fieldKey: string; oldValue: any; newValue: any }>,
        }

        Object.entries(rowChanges).forEach(([fieldKey, change]) => {
          rowGroup.fields.push({
            fieldKey,
            oldValue: change.oldValue,
            newValue: change.newValue,
          })
        })

        if (rowGroup.fields.length > 0) {
          tableGroup.changes.push(rowGroup)
        }
      })

      if (tableGroup.changes.length > 0) {
        grouped.push(tableGroup)
      }
    })

    return grouped
  }

  /**
   * Set table title for display purposes
   */
  const setTableTitle = (tableKey: string, title: string) => {
    tableTitles.value[tableKey] = title
  }

  return {
    // State (readonly)
    pendingChanges: readonly(pendingChanges),
    tableTitles: readonly(tableTitles),

    // Computed
    hasChanges,
    totalChangesCount,
    modifiedTablesCount,
    modifiedTableKeys,

    // Methods
    recordChange,
    revertChange,
    revertRowChanges,
    revertTableChanges,
    clearAllChanges,
    getChangesForTable,
    getAllChanges,
    isCellModified,
    isRowModified,
    isTableModified,
    getCurrentValue,
    getChangesSummary,
    applyChangesToData,
    getChangesGroupedByTable,
    setTableTitle,
    areValuesEqual,
  }
}

