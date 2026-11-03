/**
 * The review of the pending changes (PendingChangesPanel and its large dialog): what a change is,
 * how each kind looks, and how a value reads.
 */
import type { DataColumn } from '@cornflow-ui/core/components/core/data-table/types'
import type { CoreTone } from '@cornflow-ui/core/types/ui'
import { formatCellValue } from '@cornflow-ui/core/utils/dataTable'

export type PendingChangeKind = 'modified' | 'new' | 'deleted'

export interface PendingChangeItem {
  tableKey: string
  rowId: string | number
  kind: PendingChangeKind
  /** How the row reads: the first column's title and value, "Line L2". */
  label: string
  /** Current values of the row. */
  row: Record<string, unknown>
  /** Values before the edits (modified rows). */
  original?: Record<string, unknown>
  /** Edited columns (modified rows). */
  changedKeys: string[]
}

export interface PendingChangeGroup {
  tableKey: string
  title: string
  columns: DataColumn[]
  items: PendingChangeItem[]
}

/** How each kind of change looks: its badge in the panel, in the dialog, and its revert link. */
export const PENDING_KINDS: Record<
  PendingChangeKind,
  { label: string; rowLabel: string; revert: string; tone: CoreTone; icon: string }
> = {
  modified: {
    label: 'dataTable.pending.kind.modified',
    rowLabel: 'dataTable.pending.rowKind.modified',
    revert: 'dataTable.pending.revert',
    tone: 'warning',
    icon: 'mdi-pencil-outline',
  },
  new: {
    label: 'dataTable.pending.kind.new',
    rowLabel: 'dataTable.pending.rowKind.new',
    revert: 'dataTable.pending.remove',
    tone: 'success',
    icon: 'mdi-plus-circle-outline',
  },
  deleted: {
    label: 'dataTable.pending.kind.deleted',
    rowLabel: 'dataTable.pending.rowKind.deleted',
    revert: 'dataTable.pending.restore',
    tone: 'danger',
    icon: 'mdi-delete-outline',
  },
}

/** An edited row counts each changed cell; a new or deleted row counts one. */
export function countPendingChanges(groups: PendingChangeGroup[]): number {
  return groups.reduce(
    (total, group) =>
      total +
      group.items.reduce(
        (sum, item) => sum + (item.kind === 'modified' ? Math.max(item.changedKeys.length, 1) : 1),
        0,
      ),
    0,
  )
}

/** A value of the review as the table shows it; an empty one reads "empty". */
export function showPendingValue(
  value: unknown,
  column: DataColumn,
  locale: string,
  t: (key: string) => string,
): string {
  return formatCellValue(value, column, locale, t) ?? t('dataTable.pending.emptyValue')
}
