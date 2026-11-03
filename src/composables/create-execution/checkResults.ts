/**
 * What the data checks of an instance found, as the create-execution page lists them: one result
 * per check table with rows, its columns titled as the checks schema says, errors first.
 */

export interface CheckColumn {
  key: string
  title: string
}

export interface CheckResult {
  key: string
  /** The check table's `title` in the checks schema, or its key in words. */
  title: string
  description: string
  kind: 'error' | 'warning'
  /** The columns of the check table, titled as the checks schema says. */
  columns: CheckColumn[]
  /** What the check found, one record per row of the check table. */
  records: Record<string, unknown>[]
}

/** `capacity_by_line` → "Capacity by line": the name of a check table or column without a title. */
function keyInWords(key: string): string {
  const words = key.replaceAll('_', ' ').trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** The rows of a check table as records, and its columns: the schema's, then any others found. */
function checkTable(rows: unknown[], itemProperties: Record<string, any>) {
  const records = rows.map((row) =>
    row && typeof row === 'object' ? (row as Record<string, unknown>) : { value: row },
  )
  const keys = [...Object.keys(itemProperties)]
  for (const record of records) {
    for (const key of Object.keys(record)) if (!keys.includes(key)) keys.push(key)
  }
  const columns = keys
    .filter((key) => records.some((r) => key in r))
    .map((key) => ({ key, title: itemProperties[key]?.title || keyInWords(key) }))
  return { columns, records }
}

/**
 * The checks that found something in `dataChecks` (the instance's), per the checks schema's
 * properties: a check is an error with `is_warning: false`, a warning otherwise. Errors first,
 * then the checks that found the most.
 */
export function checkResultsOf(
  checksProperties: Record<string, any>,
  dataChecks: Record<string, unknown>,
): CheckResult[] {
  return Object.entries<any>(checksProperties)
    .map(([key, prop]): CheckResult => {
      const rows = Array.isArray(dataChecks[key]) ? (dataChecks[key] as unknown[]) : []
      return {
        key,
        title: prop?.title || keyInWords(key),
        description: prop?.description ?? '',
        kind: prop?.is_warning === false ? 'error' : 'warning',
        ...checkTable(rows, prop?.items?.properties ?? {}),
      }
    })
    .filter((result) => result.records.length > 0)
    .sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'error' ? -1 : 1
      return b.records.length - a.records.length
    })
}
