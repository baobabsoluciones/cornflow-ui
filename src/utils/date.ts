export function formatDateForFilename(dateString: string): string {
  const date = new Date(dateString)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    pad(date.getHours()),
    pad(date.getMinutes())
  ].join('-')
}

export function formatDateForExcel(date: Date, useISOForDateOnly = false): string {
  const hours = date.getUTCHours()
  const minutes = date.getUTCMinutes()
  
  if (hours === 0 && minutes === 0) {
    if (useISOForDateOnly) {
      // Format as YYYY-MM-DD for data values
      return date.toISOString().split('T')[0]
    } else {
      // Format as DD/MM/YYYY for column headers
      const day = String(date.getDate()).padStart(2, '0')
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const year = date.getFullYear()
      return `${day}/${month}/${year}`
    }
  } else {
    // Format as ISO string with space instead of T for dates with time
    return date.toISOString().slice(0, 16).replace('T', ' ')
  }
} 