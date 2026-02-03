import readXlsxFile, { readSheetNames } from 'read-excel-file'
import i18n from '@/plugins/i18n'
import { formatDateForExcel } from '@/utils/date'
import * as ExcelJS from 'exceljs'

const readTable = function (
  file,
  key,
  useFirstColumnAsKeys = false,
  req = null,
) {
  return readXlsxFile(file, { sheet: key })
    .then((rows) => {
      if (useFirstColumnAsKeys) {
        // If the first column should be used as the keys, create an object for each row
        // where the key is the value from the first column and the value is the value from the second column.
        return rows.map((row) => ({ [row[0].toString()]: row[1] }))
      } else {
        // Otherwise, treat the first row as the header row and use it to create the keys for the objects.
        const cols = rows.shift()
        // If cols is undefined (empty sheet), return empty array
        if (!cols) {
          return []
        }

        const formattedCols = cols.map((col) => {
          if (col instanceof Date) {
            return formatDateForExcel(col)
          }
          return col
        })
        return rows.map((row) =>
          Object.fromEntries(formattedCols.map((col, i) => [col, row[i]])),
        )
      }
    })
    .catch((error) => {
      const regex = new RegExp('Sheet ".+" not found')
      if (regex.test(error.message) && !req) {
        return []
      } else {
        throw error
      }
    })
}

/**
 * Processes a single cell value based on type
 */
function processRowValue(value: any, fieldFormat: string | undefined): any {
  if (value instanceof Date) {
    return formatDateForExcel(value, fieldFormat, true)
  }
  if (Number.isNaN(value)) {
    return null
  }
  if (typeof value === 'number' && value % 1 !== 0) {
    return parseFloat(value.toFixed(4))
  }
  return value
}

/**
 * Processes a row, applying value transformations
 */
function processTableRow(
  row: Record<string, any>,
  getFieldFormat: (key: string) => string | undefined,
): Record<string, any> {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key,
      processRowValue(value, getFieldFormat(key)),
    ]),
  )
}

const loadExcel = async function (file: File | Blob | ArrayBuffer, schema: { properties: Record<string, any>; required?: string[] }) {
  const sheetNames = await readSheetNames(file)
  const schemaTableNames = Object.keys(schema.properties)
  const required = schema.required || []

  const readTab = async function (tab: string): Promise<[string, any]> {
    const isInSchema = schemaTableNames.includes(tab)
    const tabSchema = isInSchema ? schema.properties[tab] : null
    const isRequired = required.includes(tab)
    const useFirstColumnAsKeys = isInSchema && tabSchema?.type === 'object'

    const getFieldFormat = (fieldKey: string): 'date' | 'date-time' | 'hour' | undefined => {
      if (!isInSchema || !tabSchema) return undefined
      if (tabSchema.type === 'array' && tabSchema.items?.properties?.[fieldKey]) {
        const format = tabSchema.items.properties[fieldKey].format
        return format === 'date' || format === 'date-time' || format === 'hour' ? format : undefined
      }
      return undefined
    }

    const table = await readTable(file, tab, useFirstColumnAsKeys, isRequired)
    
    if (!Array.isArray(table)) {
      return [tab, table]
    }

    const processedTable = table.map((row) => processTableRow(row, getFieldFormat))
    return [tab, processedTable]
  }

  const results = await Promise.all(sheetNames.map((tab) => readTab(tab)))
  return Object.fromEntries(results)
}

/**
 * Applies standard border style to a cell
 */
function applyCellBorder(cell: any): void {
  cell.border = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' },
  }
}

/**
 * Gets alternating row fill color
 */
function getAlternatingFill(index: number): any {
  return {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: index % 2 === 0 ? 'FFFFFFFF' : 'FFF2F2F2' },
  }
}

/**
 * Checks if a field should be visible in export
 */
function isFieldVisible(
  key: string,
  schema: Record<string, any> | null,
  sheetName: string,
  isObjectType: boolean,
): boolean {
  if (key === 'id') return false
  if (!schema) return true

  const propertySchema = isObjectType
    ? schema.properties?.[sheetName]?.properties?.[key]
    : schema.properties?.[sheetName]?.items?.properties?.[key]

  return propertySchema?.visible !== false
}

/**
 * Processes object type worksheet (key-value pairs)
 */
function processObjectTypeWorksheet(
  worksheet: any,
  sheetData: any[],
  schema: Record<string, any> | null,
  sheetName: string,
): void {
  const tableData = Object.entries(sheetData[0] as Record<string, any>).filter(
    ([key]) => isFieldVisible(key, schema, sheetName, true),
  )

  worksheet.addRows(tableData)
  worksheet.getColumn(1).width = 20
  worksheet.getColumn(2).width = 30

  tableData.forEach((_, index) => {
    ;['A', 'B'].forEach((col) => {
      const cell = worksheet.getCell(`${col}${index + 1}`)
      cell.fill = getAlternatingFill(index)
      applyCellBorder(cell)
    })
  })
}

/**
 * Processes array type worksheet (tabular data)
 */
function processArrayTypeWorksheet(
  worksheet: any,
  sheetData: any[],
  schema: Record<string, any> | null,
  sheetName: string,
): void {
  const allHeaders = Object.keys(sheetData[0])
  const headers = allHeaders.filter((header) =>
    isFieldVisible(header, schema, sheetName, false),
  )

  const tableData = [
    headers,
    ...sheetData.map((row) => headers.map((header) => row[header])),
  ]
  worksheet.addRows(tableData)

  headers.forEach((header, index) => {
    worksheet.getColumn(index + 1).width = header.length + 5
  })

  tableData.forEach((row, rowIndex) => {
    row.forEach((_, colIndex) => {
      const cell = worksheet.getCell(rowIndex + 1, colIndex + 1)
      if (rowIndex === 0) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFD3D3D3' },
        }
        cell.font = { bold: true }
      } else {
        cell.fill = getAlternatingFill(rowIndex)
      }
      applyCellBorder(cell)
    })
  })
}

/**
 * Prepares sheet data, creating empty row if needed
 */
function prepareSheetData(
  sheetData: any[],
  schema: Record<string, any> | null,
  sheetName: string,
): any[] | null {
  if (sheetData.length > 0) return sheetData

  const requiredHeaders = schema?.properties?.[sheetName]?.items?.required
  if (!requiredHeaders) return null

  return [
    requiredHeaders.reduce((acc: Record<string, any>, header: string) => {
      acc[header] = null
      return acc
    }, {}),
  ]
}

// This function writes all sheets according to the schema
async function schemaDataToTable(
  wb: any,
  data: Record<string, any>,
  schema: Record<string, any> | null = null,
) {
  const dataArray: Array<[string, any[]]> = Object.entries(data).map(([sheetName, sheetData]) => {
    const normalizedData = Array.isArray(sheetData) ? sheetData : [sheetData]
    return [sheetName, normalizedData] as [string, any[]]
  })

  for (const [sheetName, rawSheetData] of dataArray) {
    if (schema?.properties?.[sheetName]?.visible === false) continue

    const sheetData = prepareSheetData(rawSheetData, schema, sheetName)
    if (!sheetData) continue

    const worksheet = wb.addWorksheet(sheetName)
    const isObjectType = schema?.properties?.[sheetName]?.type === 'object'

    if (isObjectType) {
      processObjectTypeWorksheet(worksheet, sheetData, schema, sheetName)
    } else {
      processArrayTypeWorksheet(worksheet, sheetData, schema, sheetName)
    }
  }
}

const toISOStringLocal = function (date, isEndDate = false) {
  if (date) {
    const timezoneOffsetMin = date.getTimezoneOffset()
    const offsetHours = Math.abs(timezoneOffsetMin / 60)
    const offsetMinutes = timezoneOffsetMin % 60
    const offsetSign = timezoneOffsetMin > 0 ? '-' : '+'

    // If it's an end date, set the time to 23:59
    if (isEndDate) {
      date.setHours(23, 59, 0, 0)
    } else {
      // If it's a start date, set the time to 00:00
      date.setHours(0, 0, 0, 0)
    }

    return (
      new Date(date.getTime() - timezoneOffsetMin * 60 * 1000)
        .toISOString()
        .slice(0, -1) +
      offsetSign +
      String(offsetHours).padStart(2, '0') +
      ':' +
      String(offsetMinutes).padStart(2, '0')
    )
  }
}

const formatDateForHeaders = function (date, locale = i18n.global.locale) {
  const today = new Date()
  const itemDate = new Date(date)
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }

  let formattedDate = new Intl.DateTimeFormat(locale.value, options).format(
    itemDate,
  )
  itemDate.toDateString() ===
    new Date(today.setDate(today.getDate() - 1)).toDateString()

  return formattedDate
}

function formatDate(dateString) {
  const date = new Date(dateString)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}`
}

function getNumberFromLetter(letter) {
  let number = 0
  for (let i = 0; i < letter.length; i++) {
    number = number * 26 + (letter.charCodeAt(i) - 'A'.charCodeAt(0) + 1)
  }
  return number
}

function getLetterFromNumber(number) {
  let result = ''
  while (number > 0) {
    const remainder = (number - 1) % 26
    result = String.fromCharCode(65 + remainder) + result
    number = Math.floor((number - 1) / 26)
  }
  return result
}

/**
 * Checks if a field should be excluded from export
 */
function shouldExcludeField(key: string, fieldSchema: any): boolean {
  if (key === 'id') return true
  if (fieldSchema?.readOnly) return true
  if (fieldSchema?.hidden) return true
  if (fieldSchema?.isForeignKey) return true
  if (fieldSchema?.columnsToJoin && Array.isArray(fieldSchema.columnsToJoin)) return true
  return false
}

/**
 * Extracts schema fields from table config
 */
function extractSchemaFields(tableConfig: any, items: any[]): {
  schemaFields: Array<{ key: string; type: string; required: boolean }>
  backendKeys: string[]
} {
  const schemaFields: Array<{ key: string; type: string; required: boolean }> = []
  const backendKeys: string[] = []

  const properties = tableConfig?.get_list?.response_schema?.items?.properties
  if (properties) {
    const requiredFields = tableConfig.get_list?.response_schema?.items?.required || []
    Object.entries(properties).forEach(([key, fieldSchema]: [string, any]) => {
      if (!shouldExcludeField(key, fieldSchema)) {
        schemaFields.push({
          key,
          type: fieldSchema?.type || 'string',
          required: requiredFields.includes(key),
        })
        backendKeys.push(key)
      }
    })
  } else if (items && items.length > 0) {
    Object.keys(items[0])
      .filter((key) => key !== 'id')
      .forEach((key) => {
        schemaFields.push({ key, type: 'string', required: false })
        backendKeys.push(key)
      })
  }

  return { schemaFields, backendKeys }
}

/**
 * Styles the header row of the worksheet
 */
function styleExportHeaderRow(worksheet: any): void {
  const headerRow = worksheet.getRow(1)
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4A90E2' },
  }
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' }
  headerRow.height = 25
}

/**
 * Adds data rows to worksheet with alternating colors
 */
function addExportDataRows(
  worksheet: any,
  items: any[],
  schemaFields: Array<{ key: string; type: string }>,
): void {
  items.forEach((item, index) => {
    const rowData = schemaFields.map((field) =>
      formatValueByType(item[field.key], field.type),
    )
    const row = worksheet.addRow(rowData)

    if (index % 2 === 1) {
      row.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF8F9FA' },
      }
    }
  })
}

/**
 * Gets Excel number format for a field type
 */
function getExcelNumberFormat(type: string): string {
  switch (type) {
    case 'integer':
      return '#,##0'
    case 'number':
      return '#,##0.00'
    default:
      return '@'
  }
}

/**
 * Sets column widths and formats
 */
function setColumnFormats(
  worksheet: any,
  schemaFields: Array<{ key: string; type: string }>,
): void {
  schemaFields.forEach((field, index) => {
    const column = worksheet.getColumn(index + 1)
    const minWidth = Math.max(field.key.length + 4, 12)
    column.width = Math.min(minWidth, 25)
    column.numFmt = getExcelNumberFormat(field.type)
  })
}

/**
 * Applies borders to worksheet cells
 */
function applyExportBorders(
  worksheet: any,
  lastRow: number,
  lastColumn: number,
): void {
  const borderStyle = {
    top: { style: 'thin', color: { argb: 'FFE1E5E9' } },
    left: { style: 'thin', color: { argb: 'FFE1E5E9' } },
    bottom: { style: 'thin', color: { argb: 'FFE1E5E9' } },
    right: { style: 'thin', color: { argb: 'FFE1E5E9' } },
  }

  for (let row = 1; row <= lastRow; row++) {
    for (let col = 1; col <= lastColumn; col++) {
      const cell = worksheet.getCell(row, col)
      cell.border = borderStyle
      if (row > 1) {
        cell.alignment = { vertical: 'middle' }
      }
    }
  }
}

/**
 * Downloads workbook as Excel file
 */
async function downloadExcelFile(workbook: ExcelJS.Workbook, tableName: string): Promise<void> {
  const excelBuffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const link = document.createElement('a')
  link.href = window.URL.createObjectURL(blob)
  link.download = `${tableName}_${new Date().toISOString().split('T')[0]}.xlsx`
  link.click()
  window.URL.revokeObjectURL(link.href)
}

/**
 * Exports table data to Excel file with proper formatting based on backend schema
 */
async function exportTableToExcel(
  items,
  tableConfig,
  tableName,
  tableTitle,
  t,
) {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet(tableTitle || tableName)

  const { schemaFields, backendKeys } = extractSchemaFields(tableConfig, items)

  if (backendKeys.length === 0) {
    await downloadExcelFile(workbook, tableName)
    return
  }

  worksheet.addRow(backendKeys)
  styleExportHeaderRow(worksheet)

  if (items && items.length > 0) {
    addExportDataRows(worksheet, items, schemaFields)
  }

  setColumnFormats(worksheet, schemaFields)

  const lastRow = items && items.length > 0 ? items.length + 1 : 1
  applyExportBorders(worksheet, lastRow, backendKeys.length)

  await downloadExcelFile(workbook, tableName)
}

/**
 * Format value according to its schema type for Excel export
 */
function formatValueByType(value, type) {
  if (value === null || value === undefined) {
    return ''
  }

  switch (type) {
    case 'boolean':
      return typeof value === 'boolean'
        ? value
        : value === 'true' || value === '1'
    case 'integer':
      return typeof value === 'number'
        ? Math.floor(value)
        : parseInt(value) || 0
    case 'number':
      return typeof value === 'number' ? value : parseFloat(value) || 0
    case 'string':
    default:
      return String(value)
  }
}

export {
  loadExcel,
  schemaDataToTable,
  exportTableToExcel,
  toISOStringLocal,
  formatDateForHeaders,
  formatDate,
  getLetterFromNumber,
  getNumberFromLetter,
}
