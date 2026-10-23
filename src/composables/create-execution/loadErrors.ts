/**
 * Turns the schema validation errors of a loaded instance into what the user reads: grouped by
 * table, one line per row and column, in plain words ("Row 1 (L1): Capacity must be a number")
 * instead of Ajv paths such as `/lines/0/capacity`.
 */

export interface LoadErrorGroup {
  /** Table key in the instance, or '' for errors that are not tied to a table. */
  table: string
  title: string
  items: string[]
}

export interface LoadErrors {
  count: number
  groups: LoadErrorGroup[]
}

interface AjvLikeError {
  instancePath?: string
  keyword?: string
  message?: string
  params?: Record<string, any>
}

type Translate = (key: string, params?: Record<string, unknown>) => string

/** Lines listed per table; the rest is left to the "download all" file. */
export const LOAD_ERRORS_PER_TABLE = 5

function translateOr(t: Translate, key: string, fallback: string): string {
  const translated = t(key)
  return translated === key ? fallback : translated
}

function tableTitle(schema: any, table: string): string {
  return schema?.properties?.[table]?.title || table
}

function columnTitle(schema: any, table: string, column: string): string {
  const tableSchema = schema?.properties?.[table]
  const properties = tableSchema?.items?.properties ?? tableSchema?.properties
  return properties?.[column]?.title || column
}

/** First value of the row, which in practice is what identifies it (a code, a name). */
function rowLabel(data: any, table: string, index: number): string {
  const row = data?.[table]?.[index]
  if (!row || typeof row !== 'object') return ''
  const first = Object.values(row).find(
    (value) => value !== null && value !== undefined && value !== '',
  )
  return first === undefined ? '' : String(first)
}

function describe(error: AjvLikeError, t: Translate): string {
  const params = error.params ?? {}
  switch (error.keyword) {
    case 'type':
      return t('createExecution.loadErrors.type', {
        type: translateOr(t, `validation.types.${params.type}`, params.type),
      })
    case 'required':
      return t('createExecution.loadErrors.required')
    case 'enum':
      return t('createExecution.loadErrors.enum')
    case 'minimum':
    case 'exclusiveMinimum':
      return t('createExecution.loadErrors.minimum', { limit: params.limit })
    case 'maximum':
    case 'exclusiveMaximum':
      return t('createExecution.loadErrors.maximum', { limit: params.limit })
    case 'format':
    case 'pattern':
      return t('createExecution.loadErrors.format')
    default:
      return error.message ?? ''
  }
}

/**
 * `errors` are the Ajv errors of the instance, `schema` its JSON schema and `data` the data that
 * failed (for the row labels). A `required` error points at the row, not at the missing column,
 * so the column comes from `params.missingProperty`.
 */
export function groupLoadErrors(
  errors: AjvLikeError[],
  schema: any,
  data: any,
  t: Translate,
): LoadErrors {
  const groups = new Map<string, LoadErrorGroup & { total: number }>()

  for (const error of errors) {
    const [table = '', index, ...rest] = (error.instancePath ?? '')
      .replace(/^\//, '')
      .split('/')
      .filter((part) => part !== '')
    const column =
      error.keyword === 'required'
        ? error.params?.missingProperty
        : rest.length > 0
          ? rest.join('.')
          : /^\d+$/.test(index ?? '')
            ? ''
            : index

    let group = groups.get(table)
    if (!group) {
      group = {
        table,
        title: table
          ? tableTitle(schema, table)
          : t('createExecution.loadErrors.general'),
        items: [],
        total: 0,
      }
      groups.set(table, group)
    }
    group.total += 1
    if (group.items.length >= LOAD_ERRORS_PER_TABLE) continue

    const parts: string[] = []
    if (index !== undefined && /^\d+$/.test(index)) {
      const label = rowLabel(data, table, Number(index))
      parts.push(
        label
          ? t('createExecution.loadErrors.rowWithLabel', {
              row: Number(index) + 1,
              label,
            })
          : t('createExecution.loadErrors.row', { row: Number(index) + 1 }),
      )
    }
    const subject = column ? columnTitle(schema, table, column) : ''
    const message = describe(error, t)
    const text = subject
      ? t('createExecution.loadErrors.columnMessage', { column: subject, message })
      : message
    group.items.push(parts.length ? `${parts[0]}: ${text}` : text)
  }

  const result: LoadErrorGroup[] = []
  for (const group of groups.values()) {
    const items = [...group.items]
    if (group.total > items.length) {
      items.push(
        t('createExecution.loadErrors.more', { count: group.total - items.length }),
      )
    }
    result.push({ table: group.table, title: group.title, items })
  }
  return { count: errors.length, groups: result }
}

/** An error that did not come from the schema (the ETL, a file that cannot be read): plain text. */
export function singleLoadError(message: string, t: Translate): LoadErrors {
  const text = message
    .replace(/<li>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  return {
    count: 1,
    groups: [
      { table: '', title: t('createExecution.loadErrors.general'), items: text },
    ],
  }
}
