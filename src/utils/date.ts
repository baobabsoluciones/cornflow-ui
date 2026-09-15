export function formatDateForFilename(dateString: string): string {
  const date = new Date(dateString)
  const pad = (n: number) => n.toString().padStart(2, '0')
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
