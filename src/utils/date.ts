// Matches a trailing timezone designator: `Z`, `+02:00`, `-0530`, `+02`.
const TIMEZONE_SUFFIX = /(?:[zZ]|[+-]\d{2}(?::?\d{2})?)$/
// `YYYY-MM-DDTHH:mm…` or `YYYY-MM-DD HH:mm…` (date plus time of day).
const DATE_TIME_PREFIX = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/
// A bare calendar day, `YYYY-MM-DD`.
const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/

const pad = (n: number) => n.toString().padStart(2, '0')

/**
 * Cornflow stores timestamps in UTC but serialises them without a timezone
 * designator (e.g. `2026-09-28T08:30:12.123456`). `new Date()` reads such a
 * string as *local* time, shifting every timestamp by the user's UTC offset.
 * This appends `Z` so the value is unambiguously UTC, and trims fractional
 * seconds to milliseconds (the only precision ECMAScript guarantees to parse).
 * Strings that already carry a timezone, date-only strings and empty values
 * are returned as is.
 */
export function normalizeBackendDate<T extends string | null | undefined>(
  value: T,
): T {
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  if (!DATE_TIME_PREFIX.test(trimmed) || TIMEZONE_SUFFIX.test(trimmed)) {
    return value
  }
  const iso = trimmed.replace(' ', 'T').replace(/(\.\d{3})\d+$/, '$1')
  return `${iso}Z` as T
}

/**
 * Parses a bare calendar day (`YYYY-MM-DD`, e.g. from `<input type="date">`)
 * as local midnight. `new Date('YYYY-MM-DD')` would read it as UTC midnight,
 * which is the previous day for users west of UTC. Other values fall back to
 * `new Date(value)`.
 */
export function parseLocalDateKey(value: string): Date {
  const match = DATE_KEY.exec(value)
  if (!match) return new Date(value)
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}

/**
 * Local calendar day (`YYYY-MM-DD`) of a timestamp, in the user's timezone.
 * Returns an empty string for unparseable values.
 */
export function formatLocalDateKey(dateString: string): string {
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/**
 * Local time (`HH:mm`, 24h) of a timestamp, in the user's timezone.
 * Returns an empty string for unparseable values.
 */
export function formatLocalTimeHHmm(dateString: string): string {
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return ''
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/**
 * Start (00:00:00.000) or end (23:59:59.999) of the local day of `date`, as a
 * UTC ISO string, for the backend's `creation_date_gte/lte` filters. Does not
 * mutate `date`.
 */
export function toUTCDayBoundary(date: Date, isEndDate = false): string {
  const boundary = new Date(date.getTime())
  if (isEndDate) {
    boundary.setHours(23, 59, 59, 999)
  } else {
    boundary.setHours(0, 0, 0, 0)
  }
  return boundary.toISOString()
}

export function formatDateForFilename(dateString: string): string {
  const date = new Date(dateString)
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    pad(date.getHours()),
    pad(date.getMinutes()),
  ].join('-')
}

/**
 * Format date for Excel export based on schema format annotation
 * @param date - Date object to format
 * @param format - Schema format: 'date', 'date-time', 'hour', or undefined (defaults to 'date-time')
 * @param useISOForDateOnly - Legacy parameter: if true and format not specified, use ISO date format for headers
 */
export function formatDateForExcel(
  date: Date,
  format?: 'date' | 'date-time' | 'hour',
  useISOForDateOnly = false,
): string {
  const hours = date.getUTCHours()
  const minutes = date.getUTCMinutes()
  const seconds = date.getUTCSeconds()

  // If format is explicitly 'date', return only date part
  if (format === 'date') {
    return date.toISOString().split('T')[0]
  }

  // If format is explicitly 'hour', return only time part
  if (format === 'hour') {
    const pad = (n: number) => n.toString().padStart(2, '0')
    return `${pad(hours)}:${pad(minutes)}`
  }

  // For 'date-time' or undefined (default behavior), always preserve time even if 00:00
  if (format === undefined || format === 'date-time') {
    // Format as ISO string with space instead of T for dates with time
    return date.toISOString().slice(0, 16).replace('T', ' ')
  }

  // Legacy fallback: if somehow we get here with useISOForDateOnly flag
  if (useISOForDateOnly && hours === 0 && minutes === 0 && seconds === 0) {
    return date.toISOString().split('T')[0]
  }

  // Default: include time (should never reach here with proper format parameter)
  return date.toISOString().slice(0, 16).replace('T', ' ')
}
