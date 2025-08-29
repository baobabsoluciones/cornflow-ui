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
 * Parses CSV content and returns headers and table data
 * @param csvText - The CSV text content
 * @param delimiter - The delimiter to use for parsing
 * @returns Object containing headers and parsed table data
 */
export const parseCsvContent = (csvText: string, delimiter: string): ParsedCsvData => {
  const lines = csvText.toString().split('\n')
  const headers = lines[0].split(delimiter).map(header => header.trim())
  const tableData = extractTableData(lines, headers, delimiter)
  
  return { headers, tableData }
}

/**
 * Extracts table data from CSV lines
 * @param lines - Array of CSV lines
 * @param headers - Array of column headers
 * @param delimiter - The delimiter character
 * @returns Array of row objects
 */
const extractTableData = (lines: string[], headers: string[], delimiter: string): any[] => {
  const tableData = []
  
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '') continue // Skip empty lines
    
    const values = lines[i].split(delimiter).map(value => value.trim())
    const row = createRowObject(headers, values)
    tableData.push(row)
  }
  
  return tableData
}

/**
 * Creates a row object from headers and values
 * @param headers - Array of column headers
 * @param values - Array of row values
 * @returns Row object with mapped key-value pairs
 */
const createRowObject = (headers: string[], values: string[]): Record<string, any> => {
  const row = {}
  
  for (let j = 0; j < Math.min(headers.length, values.length); j++) {
    const processedValue = processValue(values[j])
    row[headers[j]] = processedValue
  }
  
  return row
}

/**
 * Processes a single value by removing quotes and converting to number if applicable
 * @param value - The raw value string
 * @returns Processed value (string or number)
 */
const processValue = (value: string): string | number => {
  const processedValue = removeQuotes(value)
  return convertToNumber(processedValue)
}

/**
 * Removes surrounding quotes from a string value
 * @param value - The value string
 * @returns String with quotes removed
 */
const removeQuotes = (value: string): string => {
  if ((value.startsWith('"') && value.endsWith('"')) || 
      (value.startsWith("'") && value.endsWith("'"))) {
    return value.substring(1, value.length - 1)
  }
  return value
}

/**
 * Converts a string to number if it represents a valid number
 * @param processedValue - The processed string value
 * @returns Number if conversion is possible, otherwise the original string
 */
const convertToNumber = (processedValue: string): string | number => {
  if (!isNaN(processedValue as any) && processedValue !== '') {
    return Number(processedValue)
  }
  return processedValue
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
