/**
 * File extension constants
 * Used for file validation and processing throughout the application
 */

// Individual file extensions
export const FILE_EXTENSIONS = {
  JSON: 'json',
  CSV: 'csv',
  XLSX: 'xlsx',
  XLS: 'xls',
  XLSM: 'xlsm',
  XLSB: 'xlsb',
} as const

// Grouped extensions for easier usage
export const EXCEL_EXTENSIONS = [
  FILE_EXTENSIONS.XLSX,
  FILE_EXTENSIONS.XLS,
  FILE_EXTENSIONS.XLSM,
  FILE_EXTENSIONS.XLSB,
] as const

export const SUPPORTED_DATA_EXTENSIONS = [
  FILE_EXTENSIONS.JSON,
  FILE_EXTENSIONS.XLSX,
  FILE_EXTENSIONS.CSV,
] as const

export const ALL_SUPPORTED_EXTENSIONS = [
  ...SUPPORTED_DATA_EXTENSIONS,
  FILE_EXTENSIONS.XLS,
  FILE_EXTENSIONS.XLSM,
  FILE_EXTENSIONS.XLSB,
] as const

// Type definitions for better TypeScript support
export type FileExtension =
  (typeof FILE_EXTENSIONS)[keyof typeof FILE_EXTENSIONS]
export type ExcelExtension = (typeof EXCEL_EXTENSIONS)[number]
export type SupportedDataExtension = (typeof SUPPORTED_DATA_EXTENSIONS)[number]

/**
 * Utility function to check if a file extension is an Excel format
 * Case-insensitive comparison
 */
export const isExcelExtension = (
  extension: string,
): extension is ExcelExtension => {
  return EXCEL_EXTENSIONS.includes(extension.toLowerCase() as ExcelExtension)
}

/**
 * Utility function to check if a file extension is supported for data processing
 * Case-insensitive comparison
 */
export const isSupportedDataExtension = (
  extension: string,
): extension is SupportedDataExtension => {
  return SUPPORTED_DATA_EXTENSIONS.includes(
    extension.toLowerCase() as SupportedDataExtension,
  )
}

/**
 * Utility function to extract and normalize file extension from filename
 * Returns lowercase extension without the dot
 */
export const getFileExtension = (filename: string): string => {
  const extension = filename.split('.').pop()?.toLowerCase() || ''
  return extension
}
