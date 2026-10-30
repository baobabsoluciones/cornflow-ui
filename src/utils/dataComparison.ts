/**
 * The comparison of a loaded table with its master table, as lines the comparison dialog shows:
 * one per row key, with the loaded row, the master row, which of them is missing, which columns
 * differ, and whether a pending change (a delete, a restored row) already touches it.
 *
 * Rows are matched and normalized with the same rules as the master-table detection
 * (`getMasterCompareRowContext`: key fields, dictionaries), and compared on the columns of the
 * instance schema, leaving out the master's join and display columns.
 */
import { getMasterCompareRowContext } from '@cornflow-ui/core/composables/project-execution/useMasterTableMatch'
import { normalizeValue } from '@cornflow-ui/core/utils/rowComparison'
import {
  buildRowMatchKey,
  getExcludedKeysForMasterTableCompare,
  resolveComparableLowercasedKeys,
} from '@cornflow-ui/core/utils/schemaUtils'

export type ComparisonStatus =
  | 'added'
  | 'removed'
  | 'modified'
  | 'identical'
  | 'pendingDelete'
  | 'pendingCreate'
  | 'pendingRestore'

export interface ComparisonLine {
  /** The row key (its match fields). */
  key: string
  status: ComparisonStatus
  /** The loaded row as compared (normalized), when there is one. */
  loaded?: Record<string, unknown>
  /** The master row as compared (normalized), when there is one. */
  master?: Record<string, unknown>
  /** The columns whose value differs between both. */
  changedKeys: string[]
  /** The loaded row as the review holds it, to give back on "remove". */
  loadedRow?: Record<string, unknown>
  /** The master row as it was received, to give back on "restore". */
  masterRow?: Record<string, unknown>
}

export interface ComparisonSource {
  tableKey: string
  /**
   * The loaded rows with their pending changes applied, as the review builds them: pending
   * deletes tagged `__pendingDelete`, edited rows `__pendingEdit`, created rows appended and
   * tagged `__pendingCreate`.
   */
  instanceRows: Record<string, any>[]
  masterRows: Record<string, any>[]
  masterTableConfig?: unknown
  /** Every loaded table, for the dictionaries of the compare strategy. */
  fullInstanceData?: Record<string, any>
  /** Columns of this table in the instance schema; the comparison is limited to them. */
  instanceSchemaColumns?: string[]
  /** Keys of the columns the dialog shows, so `changedKeys` use the same casing. */
  columnKeys?: string[]
}

/** The row with its keys lower-cased, ignoring the internal `__` markers. */
function lowerCased(row: Record<string, unknown> | undefined): Map<string, unknown> {
  const map = new Map<string, unknown>()
  if (!row) return map
  for (const [key, value] of Object.entries(row)) {
    if (!key.startsWith('__')) map.set(key.toLowerCase(), value)
  }
  return map
}

function labelResolver(source: ComparisonSource): (lower: string, rows: unknown[]) => string {
  const declared = new Map<string, string>()
  for (const key of [...(source.instanceSchemaColumns ?? []), ...(source.columnKeys ?? [])]) {
    declared.set(key.toLowerCase(), key)
  }
  return (lower, rows) => {
    const known = declared.get(lower)
    if (known) return known
    for (const row of rows) {
      const original = row ? Object.keys(row).find((k) => k.toLowerCase() === lower) : undefined
      if (original) return original
    }
    return lower
  }
}

function changedKeysOf(
  loaded: Record<string, unknown>,
  master: Record<string, unknown>,
  source: ComparisonSource,
  excluded: Set<string>,
  label: (lower: string, rows: unknown[]) => string,
): string[] {
  const loadedValues = lowerCased(loaded)
  const masterValues = lowerCased(master)
  return resolveComparableLowercasedKeys({
    row1: loaded,
    row2: master,
    allowedColumns: source.instanceSchemaColumns,
    excludedKeys: excluded,
  })
    .filter((lower) => {
      const a = normalizeValue(loadedValues.get(lower))
      const b = normalizeValue(masterValues.get(lower))
      return a !== b
    })
    .map((lower) => label(lower, [loaded, master]))
}

function statusOf(
  row: Record<string, any> | undefined,
  master: Record<string, unknown> | undefined,
  changed: string[],
): ComparisonStatus {
  if (!row) return 'removed'
  if (row.__pendingDelete) return 'pendingDelete'
  if (!master) return 'added'
  if (changed.length > 0) return 'modified'
  if (row.__pendingCreate) return 'pendingCreate'
  if (row.__pendingEdit) return 'pendingRestore'
  return 'identical'
}

/**
 * The lines of a comparison: first the master rows in their order, each with its loaded row
 * when there is one, then the loaded rows the master does not have.
 */
export function comparisonLinesFrom(source: ComparisonSource): ComparisonLine[] {
  const { keyFields, normInstByKey, normMasterByKey } = getMasterCompareRowContext(
    source.instanceRows,
    source.masterRows,
    source.tableKey,
    source.fullInstanceData,
  )
  const excluded = getExcludedKeysForMasterTableCompare(source.masterTableConfig)
  const label = labelResolver(source)

  const loadedByKey = new Map<string, Record<string, any>>()
  for (const row of source.instanceRows) loadedByKey.set(buildRowMatchKey(row, keyFields), row)

  const lineFor = (
    key: string,
    loadedRow: Record<string, any> | undefined,
    masterRow: Record<string, any> | undefined,
  ): ComparisonLine => {
    const loaded = loadedRow ? (normInstByKey.get(key) ?? loadedRow) : undefined
    const master = masterRow ? (normMasterByKey.get(key) ?? masterRow) : undefined
    const changed = loaded && master ? changedKeysOf(loaded, master, source, excluded, label) : []
    return {
      key,
      status: statusOf(loadedRow, master, changed),
      loaded,
      master,
      changedKeys: changed,
      loadedRow,
      masterRow,
    }
  }

  const lines: ComparisonLine[] = []
  const seen = new Set<string>()
  for (const masterRow of source.masterRows) {
    const key = buildRowMatchKey(masterRow, keyFields)
    if (seen.has(key)) continue
    seen.add(key)
    lines.push(lineFor(key, loadedByKey.get(key), masterRow))
  }
  for (const [key, loadedRow] of loadedByKey) {
    if (!seen.has(key)) lines.push(lineFor(key, loadedRow, undefined))
  }
  return lines
}

/** Which card of the summary a line counts in. */
export function comparisonBucket(
  status: ComparisonStatus,
): 'added' | 'removed' | 'modified' | 'identical' {
  if (status === 'added' || status === 'modified') return status
  if (status === 'removed' || status === 'pendingDelete') return 'removed'
  return 'identical'
}
