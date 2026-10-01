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

/**
 * Resolves the file extensions a deployment accepts for an upload.
 *
 * `configured` comes straight from `src/app/config.ts`, so it is whatever the deployment
 * happened to write. Entries are normalised (trimmed, lowercased, a leading dot dropped) and
 * anything the core cannot actually read is discarded: letting it through would only move the
 * rejection to the parser, after the user has already picked the file and been told it was
 * fine.
 *
 * An absent, empty or entirely unusable list falls back to `fallback`, so a deployment that
 * configures nothing keeps the behaviour it had before the setting existed.
 */
export const resolveAllowedExtensions = (
  configured: unknown,
  fallback: readonly string[],
): readonly string[] => {
  if (!Array.isArray(configured) || configured.length === 0) return fallback

  const normalized = configured
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim().toLowerCase().replace(/^\./, ''))

  const allowed = [
    ...new Set(
      normalized.filter((value) =>
        (ALL_SUPPORTED_EXTENSIONS as readonly string[]).includes(value),
      ),
    ),
  ]

  const rejected = normalized.filter((value) => !allowed.includes(value))
  if (rejected.length > 0) {
    // A typo here is otherwise invisible: the setting would appear to do nothing.
    console.warn(
      `Ignoring unreadable file extensions in config: ${rejected.join(', ')}. ` +
        `Supported: ${ALL_SUPPORTED_EXTENSIONS.join(', ')}.`,
    )
  }

  return allowed.length > 0 ? allowed : fallback
}
