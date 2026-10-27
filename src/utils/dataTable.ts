/**
 * Pure helpers of the data tables: turning the schema headers of a table into columns, showing
 * and parsing cell values, sorting, and the column filters (which editor each type uses,
 * whether a row passes, and how an active filter reads on its chip).
 */
import type {
  DataColumn,
  DataColumnType,
  DataFilter,
  DataFilterOperator,
  DataSort,
} from '@cornflow-ui/core/components/core/data-table/types'

type Translate = (key: string, named?: Record<string, unknown>) => string

// ── Values ──────────────────────────────────────────────────────────────────

export function isEmptyValue(value: unknown): boolean {
  return value === null || value === undefined || value === ''
}

/** Any cell value as plain text: objects as JSON, empty values as ''. */
export function cellText(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value as string | number | boolean)
}

export function isTruthy(value: unknown): boolean {
  return value === true || value === 'true' || value === 1 || value === '1'
}

/** A `YYYY-MM-DD…` text as a local date, so a day does not shift with the time zone. */
function parseDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  const text = cellText(value)
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
  const date = day
    ? new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3]))
    : new Date(text)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatNumber(value: unknown, decimals: number | undefined, locale: string): string {
  const number = typeof value === 'number' ? value : Number(value)
  if (Number.isNaN(number)) return cellText(value)
  return new Intl.NumberFormat(locale, {
    useGrouping: 'always' as unknown as boolean,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals ?? 20,
  }).format(number)
}

function formatDate(value: unknown, locale: string, withTime: boolean): string {
  const date = parseDate(value)
  if (!date) return cellText(value)
  return withTime
    ? date.toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' })
    : date.toLocaleDateString(locale)
}

/**
 * A cell value as the table shows it, in the user's language: numbers with thousands
 * separators (and the column's decimals), dates and times in the local format, yes/no in words.
 * `null` for an empty value, which the table draws as a dash.
 */
export function formatCellValue(
  value: unknown,
  column: Pick<DataColumn, 'type' | 'decimals' | 'options'>,
  locale: string,
  t: Translate,
): string | null {
  if (isEmptyValue(value)) return null
  switch (column.type) {
    case 'number':
      return formatNumber(value, column.decimals, locale)
    case 'boolean':
    case 'switch':
      return isTruthy(value) ? t('table.yes') : t('table.no')
    case 'date':
      return formatDate(value, locale, false)
    case 'datetime':
      return formatDate(value, locale, true)
    case 'time': {
      const text = cellText(value)
      return /^\d{1,2}:\d{2}/.test(text) ? text.slice(0, 5) : text
    }
    case 'list':
      return column.options?.find((o) => o.value === value)?.label ?? cellText(value)
    default:
      return formatTextValue(value, locale)
  }
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/

/** A text value that is a day or a moment in ISO form ("2026-10-13T18:00:00") reads as one. */
function formatTextValue(value: unknown, locale: string): string {
  const text = cellText(value)
  if (ISO_DAY.test(text)) return formatDate(text, locale, false)
  if (ISO_DATE_TIME.test(text)) return formatDate(text, locale, true)
  return text
}

/** The decimal separator of a language: "," in Spanish, "." in English. */
export function decimalSeparator(locale: string): string {
  const parts = new Intl.NumberFormat(locale).formatToParts(1.5)
  return parts.find((p) => p.type === 'decimal')?.value ?? '.'
}

/** A value as its edit field starts: numbers with the language's decimal separator. */
export function toEditText(
  value: unknown,
  column: Pick<DataColumn, 'type'>,
  locale: string,
): string {
  const text = cellText(value)
  if (column.type === 'number') return text.replace('.', decimalSeparator(locale))
  if (column.type === 'datetime') return text.slice(0, 16)
  return text
}

export type ParsedCell = { value: unknown } | { error: string }

/**
 * What the user typed in a cell, as the value to store: a number (accepting the language's
 * separators), a boolean, `null` when emptied. Errors are i18n keys under `dataTable.errors`.
 */
export function parseCellInput(
  raw: unknown,
  column: Pick<DataColumn, 'type' | 'required'>,
  locale: string,
): ParsedCell {
  const text = cellText(raw).trim()
  if (text === '') {
    return column.required ? { error: 'dataTable.errors.required' } : { value: null }
  }
  if (column.type === 'switch' || column.type === 'boolean') return { value: isTruthy(raw) }
  if (column.type === 'number') {
    const separator = decimalSeparator(locale)
    const group = separator === ',' ? '.' : ','
    const normalized = text.replaceAll(/\s/g, '').replaceAll(group, '').replace(separator, '.')
    const number = Number(normalized)
    return Number.isNaN(number) ? { error: 'dataTable.errors.number' } : { value: number }
  }
  return { value: raw }
}

// ── Columns ─────────────────────────────────────────────────────────────────

/**
 * A header of the table schema, as the screens build it (`useTableData`,
 * `executionTableBuilders`): its key, title, JSON type and the metadata of references,
 * choices and switches.
 */
export interface SchemaHeader {
  key?: string
  value?: string
  title?: string
  type?: string
  required?: boolean
  choices?: unknown[]
  frontendReadOnly?: boolean
  hidden?: boolean
  isForeignKey?: boolean
  columnsToJoin?: string[]
  joinFrom?: string
  isDependentField?: boolean
  isMainSelector?: boolean
  renderAsSwitch?: boolean
  description?: string
  unit?: string
  [key: string]: unknown
}

/** A header that is never a column: the selection checkbox, ids and the foreign keys. */
export function isHiddenHeader(header: SchemaHeader): boolean {
  const key = header.key ?? header.value
  return (
    !key ||
    key === 'selection' ||
    key === 'actions' ||
    !!header.hidden ||
    !!header.isForeignKey ||
    (Array.isArray(header.columnsToJoin) && header.columnsToJoin.length > 0)
  )
}

const SCHEMA_TYPES: Record<string, DataColumnType> = {
  number: 'number',
  integer: 'number',
  boolean: 'boolean',
  date: 'date',
  datetime: 'datetime',
  'date-time': 'datetime',
  time: 'time',
}

function columnTypeOf(header: SchemaHeader): DataColumnType {
  if (header.renderAsSwitch || cellText(header.key).toLowerCase() === 'fijar') return 'switch'
  if (header.joinFrom || header.isDependentField || header.isMainSelector) return 'reference'
  if (Array.isArray(header.choices) && header.choices.length > 0) return 'list'
  return SCHEMA_TYPES[header.type ?? ''] ?? 'text'
}

/** "start_date" → "Start date". */
export function formatColumnKey(key: string): string {
  const words = key.replaceAll(/[_-]+/g, ' ').trim()
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : key
}

/**
 * The columns of a table from its schema headers. A `reference` column that is not the main
 * selector of its reference is read-only: picking the main one fills it.
 */
export function columnsFromHeaders(headers: SchemaHeader[]): DataColumn[] {
  return headers
    .filter((header) => !isHiddenHeader(header))
    .map((header) => {
      const key = cellText(header.key ?? header.value)
      const type = columnTypeOf(header)
      return {
        key,
        title: header.title ? cellText(header.title) : formatColumnKey(key),
        type,
        unit: header.unit,
        description: header.description,
        required: !!header.required,
        readOnly:
          !!header.frontendReadOnly ||
          (type === 'reference' && !!header.isDependentField && !header.isMainSelector),
        options:
          type === 'list'
            ? (header.choices ?? []).map((choice) => ({ value: choice, label: cellText(choice) }))
            : undefined,
        meta: header,
      }
    })
}

// ── Sorting ─────────────────────────────────────────────────────────────────

function sortableValue(value: unknown, type: DataColumnType): number | string {
  if (type === 'number') return Number(value)
  if (type === 'boolean' || type === 'switch') return isTruthy(value) ? 1 : 0
  return cellText(value).toLocaleLowerCase()
}

function compareValues(x: unknown, y: unknown, type: DataColumnType): number {
  const vx = sortableValue(x, type)
  const vy = sortableValue(y, type)
  if (typeof vx === 'number' && typeof vy === 'number') return vx - vy
  return String(vx).localeCompare(String(vy), undefined, { numeric: true })
}

/**
 * The rows in the order of `sort`, empty values last whatever the direction. Returns the same
 * array when there is no sort.
 */
export function sortRows<T>(
  rows: T[],
  sort: DataSort | null,
  column: Pick<DataColumn, 'type'> | undefined,
  valueOf: (row: T, key: string) => unknown,
): T[] {
  if (!sort || !column) return rows
  const factor = sort.direction === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    const x = valueOf(a, sort.key)
    const y = valueOf(b, sort.key)
    if (isEmptyValue(x) || isEmptyValue(y)) {
      return Number(isEmptyValue(x)) - Number(isEmptyValue(y))
    }
    return compareValues(x, y, column.type) * factor
  })
}

// ── Filters ─────────────────────────────────────────────────────────────────

/** The kind of editor a column's filter uses. */
export type FilterKind = 'text' | 'range' | 'list' | 'boolean' | 'dates'

const FILTER_KINDS: Partial<Record<DataColumnType, FilterKind>> = {
  number: 'range',
  boolean: 'boolean',
  switch: 'boolean',
  list: 'list',
  reference: 'list',
  date: 'dates',
  datetime: 'dates',
}

export function filterKindOf(type: DataColumnType): FilterKind {
  return FILTER_KINDS[type] ?? 'text'
}

/** The operators the text editor offers. */
export const TEXT_FILTER_OPERATORS: DataFilterOperator[] = [
  'contains',
  'is',
  'is_not',
  'starts_with',
  'is_empty',
  'has_any_value',
]

export function operatorNeedsValue(operator: DataFilterOperator): boolean {
  return operator !== 'is_empty' && operator !== 'has_any_value'
}

/** A new, empty filter on a field, with the operator its editor starts with. */
export function emptyFilter(id: string, field: string, kind: FilterKind): DataFilter {
  const operators: Record<FilterKind, DataFilterOperator> = {
    text: 'contains',
    range: 'is_between',
    dates: 'is_between',
    list: 'is_any_of',
    boolean: 'is',
  }
  return { id, field, operator: operators[kind], value: '', value2: '', values: [] }
}

function toNumber(value: unknown): number | null {
  if (isEmptyValue(value)) return null
  const number = Number(value)
  return Number.isNaN(number) ? null : number
}

function inNumberRange(value: unknown, low: number | null, high: number | null): boolean {
  const number = toNumber(value)
  if (number === null) return false
  return (low === null || number >= low) && (high === null || number <= high)
}

/** Dates and times compare as text: "2026-10-01" ≤ "2026-10-15T08:00" ≤ "2026-10-15". */
function inTextRange(value: unknown, from = '', to = ''): boolean {
  const text = cellText(value)
  if (!text) return !from && !to
  return (!from || text >= from) && (!to || text.slice(0, to.length) <= to)
}

function inRange(value: unknown, from?: string, to?: string): boolean {
  const low = toNumber(from)
  const high = toNumber(to)
  if (low !== null || high !== null) return inNumberRange(value, low, high)
  return inTextRange(value, from, to)
}

/** Whether a value passes a filter. */
export function valuePassesFilter(value: unknown, filter: DataFilter): boolean {
  const text = cellText(value)
  const target = filter.value ?? ''
  switch (filter.operator) {
    case 'is':
      return text === target
    case 'is_not':
      return text !== target
    case 'contains':
      return text.toLowerCase().includes(target.toLowerCase())
    case 'starts_with':
      return text.toLowerCase().startsWith(target.toLowerCase())
    case 'is_empty':
      return text === ''
    case 'has_any_value':
      return text !== ''
    case 'is_between':
      return inRange(value, filter.value, filter.value2)
    case 'is_any_of':
      return (filter.values ?? []).some((option) => option === value || cellText(option) === text)
    default:
      return true
  }
}

function checkRange(filter: DataFilter): { ok: boolean; error?: string } {
  const low = filter.value?.trim() ?? ''
  const high = filter.value2?.trim() ?? ''
  if ((low && toNumber(low) === null) || (high && toNumber(high) === null)) {
    return { ok: false, error: 'dataTable.filters.errors.number' }
  }
  if (low && high && Number(low) > Number(high)) {
    return { ok: false, error: 'dataTable.filters.errors.range' }
  }
  return { ok: !!(low || high) }
}

function checkDates(filter: DataFilter): { ok: boolean; error?: string } {
  if (filter.value && filter.value2 && filter.value > filter.value2) {
    return { ok: false, error: 'dataTable.filters.errors.dates' }
  }
  return { ok: !!(filter.value || filter.value2) }
}

/** Whether a filter is complete enough to apply, or the i18n key of what is wrong with it. */
export function checkFilter(filter: DataFilter, kind: FilterKind): { ok: boolean; error?: string } {
  switch (kind) {
    case 'list':
      return { ok: (filter.values ?? []).length > 0 }
    case 'boolean':
      return { ok: filter.value === 'true' || filter.value === 'false' }
    case 'range':
      return checkRange(filter)
    case 'dates':
      return checkDates(filter)
    default:
      return {
        ok: !operatorNeedsValue(filter.operator) || (filter.value ?? '').trim() !== '',
      }
  }
}

function rangeChipValue(from: string, to: string, kind: FilterKind, t: Translate): string {
  if (from && to) return `${from} – ${to}`
  if (kind === 'dates') {
    return from
      ? t('dataTable.filters.since', { value: from })
      : t('dataTable.filters.until', { value: to })
  }
  return from ? `≥ ${from}` : `≤ ${to}`
}

/** The value part of a filter chip: "≥ 10", "10 – 50", "Envasado +2", "contains «norte»". */
export function filterChipValue(
  filter: DataFilter,
  column: Pick<DataColumn, 'type' | 'decimals' | 'options'>,
  locale: string,
  t: Translate,
): string {
  const kind = filterKindOf(column.type)
  const show = (value: unknown, asColumn = column) =>
    formatCellValue(value, asColumn, locale, t) ?? cellText(value)
  if (kind === 'list') {
    const values = filter.values ?? []
    if (values.length === 0) return ''
    return values.length > 1 ? `${show(values[0])} +${values.length - 1}` : show(values[0])
  }
  if (kind === 'boolean') return filter.value === 'true' ? t('table.yes') : t('table.no')
  if (kind === 'range' || kind === 'dates') {
    const asColumn = kind === 'dates' ? { ...column, type: 'date' as const } : column
    const from = filter.value ? show(filter.value, asColumn) : ''
    const to = filter.value2 ? show(filter.value2, asColumn) : ''
    return rangeChipValue(from, to, kind, t)
  }
  const operator = t(`dataTable.filters.operators.${filter.operator}`)
  return operatorNeedsValue(filter.operator) ? `${operator} «${filter.value}»` : operator
}
