/**
 * executionDataFilter.ts — Executions whose data the backend gives in parts.
 *
 * An execution too large to send whole comes with some of its tables narrowed to one value (one
 * plant, one product…). The answers of `get_data` and `get_instance_data` say so in an optional
 * `data_filter`: the query parameter that picks the value, the value they carry, the values that
 * can be picked and the tables they narrow. The core shows a selector over those tables and reads
 * the execution again with the value picked. An answer without `data_filter` is read as it is.
 *
 * See the README, "Executions read in parts".
 */

/** A value the data of an execution can be read for. */
export interface ExecutionDataFilterOption {
  value: string
  label: string
}

/** The `data_filter` of one answer, `get_data` or `get_instance_data`. */
export interface ExecutionDataFilterAnswer {
  param: string
  title: string | Record<string, string>
  value: string
  options: ExecutionDataFilterOption[]
  tables: string[]
}

/** How a loaded execution is read in parts: both answers together. */
export interface ExecutionDataFilter {
  /** Query parameter that carries the value. */
  param: string
  /** Name of what is picked, as text or by language. */
  title: string | Record<string, string>
  /** The value the narrowed tables carry. */
  value: string
  options: ExecutionDataFilterOption[]
  /** Narrowed tables of the instance and of the solution. */
  tables: { instance: string[]; solution: string[] }
}

/** The value to read an execution for: the query parameter and its value. */
export interface ExecutionDataFilterSelection {
  param: string
  value: string
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value !== ''
}

function isTitle(value: unknown): value is string | Record<string, string> {
  if (isText(value)) return true
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.values(value).every((text) => typeof text === 'string')
  )
}

function isOption(value: unknown): value is ExecutionDataFilterOption {
  if (!value || typeof value !== 'object') return false
  const option = value as Partial<ExecutionDataFilterOption>
  return isText(option.value) && typeof option.label === 'string'
}

/**
 * The `data_filter` of an answer, or null when it has none or it is not usable (a field missing
 * or of another type). An unusable one is warned about in the console.
 */
export function parseExecutionDataFilter(raw: unknown): ExecutionDataFilterAnswer | null {
  if (raw === undefined || raw === null) return null
  const answer = raw as Partial<ExecutionDataFilterAnswer>
  const usable =
    typeof raw === 'object' &&
    isText(answer.param) &&
    isTitle(answer.title) &&
    isText(answer.value) &&
    Array.isArray(answer.options) &&
    answer.options.every(isOption) &&
    Array.isArray(answer.tables) &&
    answer.tables.every(isText)
  if (!usable) {
    console.warn('An execution answer carries an unusable "data_filter"; it is ignored.', raw)
    return null
  }
  return {
    param: answer.param as string,
    title: answer.title as string | Record<string, string>,
    value: answer.value as string,
    options: (answer.options as ExecutionDataFilterOption[]).map(({ value, label }) => ({
      value,
      label: label || value,
    })),
    tables: [...(answer.tables as string[])],
  }
}

/**
 * The `data_filter` of the solution and of the instance of an execution together, or null when
 * neither has one. The parameter, the title, the value and the options are the ones of the
 * solution when it has a `data_filter`, and of the instance otherwise.
 */
export function combineExecutionDataFilters(
  solution: ExecutionDataFilterAnswer | null,
  instance: ExecutionDataFilterAnswer | null,
): ExecutionDataFilter | null {
  const main = solution ?? instance
  if (!main) return null
  return {
    param: main.param,
    title: main.title,
    value: main.value,
    options: main.options,
    tables: {
      instance: instance?.tables ?? [],
      solution: solution?.tables ?? [],
    },
  }
}

/** The query parameters that read an execution for `selection`, or none without one. */
export function dataFilterQuery(
  selection: ExecutionDataFilterSelection | null | undefined,
): Record<string, string> {
  return selection ? { [selection.param]: selection.value } : {}
}

/** Whether `filter` narrows the table `tableKey` of the instance or the solution. */
export function narrowsTable(
  filter: ExecutionDataFilter | null | undefined,
  type: 'instance' | 'solution' | null | undefined,
  tableKey: string | null | undefined,
): boolean {
  if (!filter || !type || !tableKey) return false
  return filter.tables[type].includes(tableKey)
}
