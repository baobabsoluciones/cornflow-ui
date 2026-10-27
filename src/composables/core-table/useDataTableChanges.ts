/**
 * useDataTableChanges — a data table over the pending changes (`useTableChanges`): what each cell
 * shows, the state of each row, and turning the table's edits, additions and deletions into
 * pending changes of `tableKey`.
 *
 * The rows it returns are the table's rows with the added ones first (ids `create-…`); edits on
 * an added row change that row, so they are saved with it.
 *
 *   const changes = useDataTableChanges(tableKey, title, rows, columns)
 *   <CoreDataTable :rows="changes.rows.value" :value-of="changes.valueOf"
 *     :row-state="changes.rowState" :cell-modified="changes.cellModified"
 *     @cell-change="changes.setCell" @add-row="changes.addRow" … />
 */
import { computed, type Ref } from 'vue'
import { useTableChanges } from '@cornflow-ui/core/composables/useTableChanges'
import type {
  DataColumn,
  DataRow,
  DataRowState,
} from '@cornflow-ui/core/components/core/data-table/types'
import type {
  PendingChangeGroup,
  PendingChangeItem,
} from '@cornflow-ui/core/components/core/data-table/PendingChangesPanel.vue'
import { cellText } from '@cornflow-ui/core/utils/dataTable'

/** A table whose changes the review shows: its key, title, columns and current rows. */
export interface ReviewTable {
  key: string
  title: string
  columns: DataColumn[]
  rows: DataRow[]
}

export function useDataTableChanges(
  tableKey: Ref<string>,
  tableTitle: Ref<string>,
  baseRows: Ref<DataRow[]>,
  columns: Ref<DataColumn[]>,
) {
  const changes = useTableChanges()

  const createdRows = computed<DataRow[]>(() =>
    changes.getPendingCreates(tableKey.value).map((create) => ({ ...create.data, id: create.tempId })),
  )

  const rows = computed<DataRow[]>(() =>
    createdRows.value.length ? [...createdRows.value, ...baseRows.value] : baseRows.value,
  )

  const isCreated = (row: DataRow) => cellText(row.id).startsWith('create-')

  const deletedIds = computed(() => new Set(changes.getPendingDeletes(tableKey.value)))

  function valueOf(row: DataRow, key: string): unknown {
    return changes.getCurrentValue(tableKey.value, row.id, key, row[key])
  }

  function rowState(row: DataRow): DataRowState | undefined {
    if (deletedIds.value.has(cellText(row.id))) return 'deleted'
    if (isCreated(row)) return 'new'
    return changes.isRowModified(tableKey.value, row.id) ? 'modified' : undefined
  }

  const cellModified = (row: DataRow, key: string) =>
    changes.isCellModified(tableKey.value, row.id, key)

  const titleOf = (key: string) => columns.value.find((column) => column.key === key)?.title ?? key

  function setCell(row: DataRow, key: string, value: unknown) {
    if (isCreated(row)) {
      changes.updateCreateField(tableKey.value, cellText(row.id), key, value)
      return
    }
    changes.recordChange(tableKey.value, row.id, key, row[key], value, titleOf(key), tableTitle.value)
  }

  function addRow(values: Record<string, unknown>) {
    return changes.recordCreate(tableKey.value, values, tableTitle.value)
  }

  function deleteRows(ids: Array<string | number>) {
    for (const id of ids) {
      const row = rows.value.find((candidate) => candidate.id === id)
      changes.recordDelete(tableKey.value, id, row ? { ...row } : undefined)
    }
  }

  function restoreRows(ids: Array<string | number>) {
    ids.forEach((id) => changes.revertDelete(tableKey.value, id))
  }

  function bulkEdit(ids: Array<string | number>, values: Record<string, unknown>) {
    for (const id of ids) {
      const row = rows.value.find((candidate) => candidate.id === id)
      if (!row || rowState(row) === 'deleted') continue
      Object.entries(values).forEach(([key, value]) => setCell(row, key, value))
    }
  }

  return {
    rows,
    valueOf,
    rowState,
    cellModified,
    setCell,
    addRow,
    deleteRows,
    restoreRows,
    bulkEdit,
  }
}

function labelOf(table: ReviewTable, row: Record<string, unknown>): string {
  const first = table.columns[0]
  if (!first) return ''
  return `${first.title} ${cellText(row[first.key]) || '—'}`
}

function itemsOf(table: ReviewTable, group: ReturnType<ReturnType<typeof useTableChanges>['getFullGroupedChanges']>[number]): PendingChangeItem[] {
  const byId = new Map(table.rows.map((row) => [cellText(row.id), row]))
  const modified = group.changes
    .filter((change) => !group.deletes.some((deleted) => deleted.rowId === change.rowId))
    .map((change): PendingChangeItem => {
      const original = byId.get(change.rowId) ?? {}
      const row = { ...original }
      change.fields.forEach((field) => (row[field.fieldKey] = field.newValue))
      return {
        tableKey: table.key,
        rowId: change.rowId,
        kind: 'modified',
        label: labelOf(table, row),
        row,
        original: Object.fromEntries(change.fields.map((field) => [field.fieldKey, field.oldValue])),
        changedKeys: change.fields.map((field) => field.fieldKey),
      }
    })
  const created = group.creates.map((create): PendingChangeItem => ({
    tableKey: table.key,
    rowId: create.tempId,
    kind: 'new',
    label: labelOf(table, create.data),
    row: create.data,
    changedKeys: [],
  }))
  const deleted = group.deletes.map((entry): PendingChangeItem => {
    const row = entry.data ?? byId.get(entry.rowId) ?? {}
    return {
      tableKey: table.key,
      rowId: entry.rowId,
      kind: 'deleted',
      label: labelOf(table, row),
      row,
      changedKeys: [],
    }
  })
  return [...modified, ...created, ...deleted]
}

/**
 * The pending changes of every table, grouped for the review. A table the screen does not know
 * (`tables` has no entry for it) shows with the columns of its changes.
 */
export function pendingChangeGroups(tables: ReviewTable[]): PendingChangeGroup[] {
  const changes = useTableChanges()
  return changes
    .getFullGroupedChanges()
    .map((group) => {
      const table =
        tables.find((candidate) => candidate.key === group.tableKey) ??
        fallbackTable(group.tableKey, group.tableTitle, group)
      return {
        tableKey: group.tableKey,
        title: group.tableTitle || table.title,
        columns: table.columns,
        items: itemsOf(table, group),
      }
    })
    .filter((group) => group.items.length > 0)
}

function fallbackTable(
  key: string,
  title: string,
  group: ReturnType<ReturnType<typeof useTableChanges>['getFullGroupedChanges']>[number],
): ReviewTable {
  const keys = new Set<string>()
  group.changes.forEach((change) => change.fields.forEach((field) => keys.add(field.fieldKey)))
  group.creates.forEach((create) => Object.keys(create.data).forEach((k) => keys.add(k)))
  return {
    key,
    title: title || key,
    columns: [...keys].map((k) => ({ key: k, title: k, type: 'text' })),
    rows: [],
  }
}
