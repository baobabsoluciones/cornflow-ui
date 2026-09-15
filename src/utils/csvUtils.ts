/**
 * CSV parsing utilities for processing CSV data
 */

export interface ParsedCsvData {
  headers: string[]
  tableData: any[]
}

/**
 * Detects the delimiter used in a CSV text by analyzing the first line
 * @param csvText - The CSV text content
 * @returns The detected delimiter character
 */
export const detectDelimiter = (csvText: string): string => {
  const firstLine = csvText.toString().split('\n')[0]
  
  const delimiterCounts = {
    ',': (firstLine.match(/,/g) || []).length,
    ';': (firstLine.match(/;/g) || []).length,
    '\t': (firstLine.match(/\t/g) || []).length,
  }
  
  return findMostFrequentDelimiter(delimiterCounts)
}

/**
 * Finds the delimiter with the highest occurrence count
 * @param delimiterCounts - Object with delimiter counts
 * @returns The most frequent delimiter
 */
const findMostFrequentDelimiter = (delimiterCounts: Record<string, number>): string => {
  let delimiter = ',' // Default
  let maxCount = 0
  
  for (const [del, count] of Object.entries(delimiterCounts)) {
    if (count > maxCount) {
      maxCount = count
      delimiter = del
    }
  }
  
  return delimiter
}

/**
 * Parses CSV content and returns headers and table data.
 * Uses an RFC 4180 state machine: handles quoted fields with embedded
 * delimiters, embedded newlines, and escaped quotes (""). Empty cells
 * become null; values are not coerced to numbers (the consuming schema
 * is responsible for type coercion).
 */
export const parseCsvContent = (csvText: string, delimiter: string): ParsedCsvData => {
  const rows = parseCsvRows(csvText, delimiter)
  if (rows.length === 0) return { headers: [], tableData: [] }

  const headers = rows[0].map(h => h.trim())
  const tableData = rows
    .slice(1)
    .filter(values => values.some(v => v !== ''))
    .map(values => createRowObject(headers, values))

  return { headers, tableData }
}

/**
 * RFC 4180 row parser. Returns raw field strings (no trimming, no coercion)
 * so callers can decide how to interpret empty/quoted values.
 */
const parseCsvRows = (csvText: string, delimiter: string): string[][] => {
  const text = csvText.toString().replaceAll('\r\n', '\n').replaceAll('\r', '\n')
  const rows: string[][] = []
  const state = {
    row: [] as string[],
    field: '',
    inQuotes: false,
    fieldStarted: false,
  }

  let i = 0
  while (i < text.length) {
    if (state.inQuotes) {
      i = handleQuotedChar(text, i, state)
    } else {
      handleUnquotedChar(text, i, delimiter, state, rows)
    }
    i++
  }

  if (state.fieldStarted || state.row.length > 0) {
    state.row.push(state.field)
    rows.push(state.row)
  }

  return rows
}

type ParseState = {
  row: string[]
  field: string
  inQuotes: boolean
  fieldStarted: boolean
}

/** Inside a quoted field: only `"` is special (`""` escapes a literal quote). */
const handleQuotedChar = (text: string, i: number, state: ParseState): number => {
  const c = text[i]
  if (c !== '"') {
    state.field += c
    return i
  }
  if (text[i + 1] === '"') {
    state.field += '"'
    return i + 1
  }
  state.inQuotes = false
  return i
}

/** Outside quotes: opening quote, delimiter, newline, or regular char. */
const handleUnquotedChar = (
  text: string,
  i: number,
  delimiter: string,
  state: ParseState,
  rows: string[][],
): void => {
  const c = text[i]

  if (c === '"' && !state.fieldStarted) {
    state.inQuotes = true
    state.fieldStarted = true
    return
  }
  if (c === delimiter) {
    finishField(state)
    return
  }
  if (c === '\n') {
    finishField(state)
    rows.push(state.row)
    state.row = []
    return
  }
  state.field += c
  state.fieldStarted = true
}

const finishField = (state: ParseState): void => {
  state.row.push(state.field)
  state.field = ''
  state.fieldStarted = false
}

/**
 * Creates a row object from headers and values. Empty values are mapped
 * to null so they validate against nullable schema fields.
 */
const createRowObject = (headers: string[], values: string[]): Record<string, any> => {
  const row: Record<string, any> = {}
  const len = Math.min(headers.length, values.length)
  for (let j = 0; j < len; j++) {
    const trimmed = values[j].trim()
    row[headers[j]] = trimmed === '' ? null : trimmed
  }
  return row
}

/**
 * Extracts table name from file name (removes extension)
 * @param fileName - The file name with extension
 * @returns Table name without extension
 */
export const extractTableName = (fileName: string): string => {
  return fileName.split('.')[0]
}

/**
 * Complete CSV parsing function that combines all steps
 * @param csvText - The CSV text content
 * @param fileName - The source file name
 * @returns Object containing table name and parsed data
 */
export const parseCsvToData = (csvText: string, fileName: string): { tableName: string, data: Record<string, any> } => {
  const delimiter = detectDelimiter(csvText)
  const { tableData } = parseCsvContent(csvText, delimiter)
  const tableName = extractTableName(fileName)
  
  return {
    tableName,
    data: { [tableName]: tableData }
  }
}
