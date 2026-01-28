/**
 * Composable for handling error file downloads
 * Manages Excel workbook creation, formatting, and download functionality
 */

import { nextTick } from 'vue'
import type { ErrorObject } from 'ajv'
import * as ExcelJS from 'exceljs'

// Constants
const DISPLAY_ERROR_LIMIT = 150
const MAX_DOWNLOAD_ERRORS = 50000
const DOWNLOAD_BUTTON_ID = 'download-errors-btn'

export interface ErrorDownloadOptions {
  maxErrors?: number
  displayLimit?: number
  buttonId?: string
}

/**
 * Composable for managing error downloads
 */
export function useErrorDownload(options: ErrorDownloadOptions = {}) {
  const maxErrors = options.maxErrors ?? MAX_DOWNLOAD_ERRORS
  const displayLimit = options.displayLimit ?? DISPLAY_ERROR_LIMIT
  const buttonId = options.buttonId ?? DOWNLOAD_BUTTON_ID

  /**
   * Create Excel workbook from validation errors
   */
  const createErrorWorkbook = (errors: ErrorObject[]): ExcelJS.Workbook => {
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Validation Errors')

    const errorsToFormat = errors.slice(0, maxErrors)

    addWorkbookHeader(worksheet)
    addWorkbookSummary(worksheet, errors.length, maxErrors)
    addErrorRows(worksheet, errorsToFormat)
    addRemainingErrorsNote(worksheet, errors.length, maxErrors)
    configureColumnWidths(worksheet)

    return workbook
  }

  /**
   * Add header row to worksheet
   */
  const addWorkbookHeader = (worksheet: ExcelJS.Worksheet) => {
    const headerRow = worksheet.addRow([
      'Error #',
      'Path',
      'Message',
      'Keyword',
      'Parameters',
      'Schema Path',
    ])

    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1976D2' },
    }
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' }
  }

  /**
   * Add summary row to worksheet
   */
  const addWorkbookSummary = (
    worksheet: ExcelJS.Worksheet,
    totalErrors: number,
    maxErrors: number,
  ) => {
    const summaryRow = worksheet.addRow([
      `Total errors: ${totalErrors}`,
      totalErrors > maxErrors
        ? `Note: This file contains the first ${maxErrors} errors.`
        : '',
      '',
      '',
      '',
      '',
    ])
    summaryRow.font = { bold: true }
    summaryRow.getCell(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFF9C4' },
    }

    worksheet.addRow([]) // Empty row for spacing
  }

  /**
   * Add error rows to worksheet
   */
  const addErrorRows = (
    worksheet: ExcelJS.Worksheet,
    errors: ErrorObject[],
  ) => {
    errors.forEach((error, index) => {
      const paramsStr = formatErrorParams(error.params || {})
      worksheet.addRow([
        index + 1,
        error.instancePath || '',
        error.message || '',
        error.keyword || '',
        paramsStr,
        error.schemaPath || '',
      ])
    })
  }

  /**
   * Format error parameters as string
   */
  const formatErrorParams = (params: Record<string, any>): string => {
    if (Object.keys(params).length === 0) return ''
    return Object.entries(params)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ')
  }

  /**
   * Add note about remaining errors if applicable
   */
  const addRemainingErrorsNote = (
    worksheet: ExcelJS.Worksheet,
    totalErrors: number,
    maxErrors: number,
  ) => {
    if (totalErrors > maxErrors) {
      const remainingCount = totalErrors - maxErrors
      const noteRow = worksheet.addRow([
        `... and ${remainingCount} more errors.`,
        '',
        '',
        '',
        '',
        '',
      ])
      noteRow.font = { italic: true, color: { argb: 'FF666666' } }
    }
  }

  /**
   * Configure column widths and text wrapping
   */
  const configureColumnWidths = (worksheet: ExcelJS.Worksheet) => {
    const columnWidths = [10, 30, 50, 20, 40, 30]
    columnWidths.forEach((width, index) => {
      worksheet.getColumn(index + 1).width = width
    })

    // Enable text wrapping for message and parameters columns
    worksheet.getColumn(3).alignment = { wrapText: true, vertical: 'top' }
    worksheet.getColumn(5).alignment = { wrapText: true, vertical: 'top' }
  }

  /**
   * Download blob as file
   */
  const downloadBlob = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.style.position = 'absolute'
    link.style.left = '-9999px'

    document.body.appendChild(link)
    link.click()

    // Clean up
    setTimeout(() => {
      if (document.body.contains(link)) {
        document.body.removeChild(link)
      }
      window.URL.revokeObjectURL(url)
    }, 200)
  }

  /**
   * Get formatted date string for filename
   */
  const getDateString = (): string => {
    return new Date().toISOString().split('T')[0]
  }

  /**
   * Download errors as Excel file
   */
  const downloadErrorsFile = async (
    errors: ErrorObject[],
    onSuccess?: () => void,
    onError?: (error: Error) => void,
  ) => {
    if (!errors || errors.length === 0) {
      const error = new Error('No errors to download')
      onError?.(error)
      throw error
    }

    try {
      const workbook = createErrorWorkbook(errors)
      const excelBuffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([excelBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })

      downloadBlob(blob, `validation-errors-${getDateString()}.xlsx`)
      onSuccess?.()
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      console.error('Error downloading errors file:', err)
      onError?.(err)
      throw err
    }
  }

  /**
   * Setup download button event listener
   */
  const setupDownloadButton = (handler: (event?: Event) => void) => {
    nextTick(() => {
      const downloadBtn = document.getElementById(buttonId)
      if (downloadBtn) {
        downloadBtn.addEventListener('click', handler)
      }
    })
  }

  /**
   * Cleanup download button event listener
   */
  const cleanupDownloadButton = (handler: (event?: Event) => void) => {
    const downloadBtn = document.getElementById(buttonId)
    if (downloadBtn) {
      downloadBtn.removeEventListener('click', handler)
    }
  }

  /**
   * Create a download handler that can be used with watchDownloadButton
   */
  const createDownloadHandler = (
    getErrors: () => ErrorObject[] | null,
    onSuccess?: () => void,
    onError?: (error: Error) => void,
  ) => {
    return async (event?: Event) => {
      event?.preventDefault()
      event?.stopPropagation()

      const errors = getErrors()
      if (!errors || errors.length === 0) {
        const error = new Error('No errors to download')
        onError?.(error)
        return
      }

      await downloadErrorsFile(errors, onSuccess, onError)
    }
  }

  return {
    // Constants
    DISPLAY_ERROR_LIMIT: displayLimit,
    MAX_DOWNLOAD_ERRORS: maxErrors,
    DOWNLOAD_BUTTON_ID: buttonId,

    // Methods
    downloadErrorsFile,
    setupDownloadButton,
    cleanupDownloadButton,
    createDownloadHandler,
    createErrorWorkbook,
  }
}

