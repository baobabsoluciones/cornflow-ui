/**
 * The model the data-table components share: what a column is, the states of a row and of a
 * cell, and the column filters. The screens build it from the table schema (see
 * `utils/dataTable.ts`); the components only read it.
 */

/** How a column shows and edits its values. */
export type DataColumnType =
  | 'text'
  | 'number'
  | 'boolean'
  /** One value of a fixed list (`choices` / `enum`). */
  | 'list'
  /** A value of another table: its options come from that table. */
  | 'reference'
  | 'date'
  | 'datetime'
  | 'time'
  /** A yes/no shown as a switch, usable without entering edit mode. */
  | 'switch'

export interface DataColumnOption {
  value: unknown
  label: string
}

export interface DataColumn {
  key: string
  title: string
  type: DataColumnType
  /** Unit shown after the title, "(kg)". */
  unit?: string
  /** Decimals a number shows; without it, the ones it has. */
  decimals?: number
  /** Longer explanation, shown as the header tooltip. */
  description?: string
  /** Cannot be edited even when the table can. */
  readOnly?: boolean
  required?: boolean
  /** A `switch` that pins its row: the rows where it is on are highlighted. */
  pinsRow?: boolean
  /** Values of a `list` column, or the loaded values of a `reference` one. */
  options?: DataColumnOption[]
  /** Where the column's data comes from, shown as an icon by the title. */
  source?: { kind: 'database' | 'file'; tooltip?: string }
  /** Starting width in px; the user can resize it. */
  width?: number
  /** The rest of the schema metadata, for the screen that built the column. */
  meta?: Record<string, any>
}

export interface DataRow {
  id: string | number
  [key: string]: unknown
}

/** A row with pending changes: added, deleted, or with some cell edited. */
export type DataRowState = 'new' | 'deleted' | 'modified'

/** A row flagged by a check table: its level. */
export type DataRowLevel = 'error' | 'warning'

export interface DataSort {
  key: string
  direction: 'asc' | 'desc'
}

export type DataDensity = 'compact' | 'default' | 'comfortable'

/**
 * A column filter. `operator` keeps the names the backends understand (`is`, `contains`,
 * `is_between`…); `values` holds the picked values of a list filter.
 */
export interface DataFilter {
  id: string
  field: string
  operator: DataFilterOperator
  value: string
  value2?: string
  values?: unknown[]
}

export type DataFilterOperator =
  | 'is'
  | 'is_not'
  | 'contains'
  | 'starts_with'
  | 'is_empty'
  | 'has_any_value'
  | 'is_between'
  | 'is_any_of'

/** What the table shows instead of rows. */
export type DataTableStatus = 'ready' | 'loading' | 'error'
