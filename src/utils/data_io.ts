import readXlsxFile, { readSheetNames } from 'read-excel-file'
import i18n from '@cornflow-ui/core/plugins/i18n'
import { formatDateForExcel } from '@cornflow-ui/core/utils/date'
import { getListResponseRowProperties } from '@cornflow-ui/core/utils/schemaUtils'
import * as ExcelJS from 'exceljs'
import {
  parseExcelInWorker,
  buildExcelBufferInWorker,
} from '@cornflow-ui/core/utils/excelWorkerClient'
import {
  applyCellBorder,
  getAlternatingFill,
  isFieldVisible,
  prepareSheetData,
  estimateSheetCellCount,
  processObjectTypeWorksheet,
} from '@cornflow-ui/core/utils/excelStyling'

// read-excel-file fails on xlsx files above ~8MB; use ExcelJS for those
const LARGE_FILE_THRESHOLD_BYTES = 8 * 1024 * 1024

type FileInput = File | Blob | ArrayBuffer

function isLargeFile(file: FileInput): boolean {
  if (file instanceof ArrayBuffer)
    return file.byteLength > LARGE_FILE_THRESHOLD_BYTES
  return file.size > LARGE_FILE_THRESHOLD_BYTES
}

async function fileToArrayBuffer(
  file: FileInput,
): Promise<ArrayBuffer> {
  if (file instanceof ArrayBuffer) return file
  return file.arrayBuffer()
}

async function readTableWithExcelJS(
  file: FileInput,
  key: string,
  useFirstColumnAsKeys = false,
  req = null,
): Promise<any[]> {
  const buffer = await fileToArrayBuffer(file)
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)
  const worksheet = workbook.getWorksheet(key)
  if (!worksheet) {
    if (!req) return []
    throw new Error(`Sheet "${key}" not found`)
  }

  const allRows: any[][] = []
  worksheet.eachRow((row) => {
    allRows.push(row.values as any[])
  })

  // ExcelJS row.values is 1-indexed (index 0 is undefined)
  const normalizedRows = allRows.map((row) => row.slice(1))

  if (useFirstColumnAsKeys) {
    return normalizedRows.map((row) => ({
      [String(row[0] ?? '')]: row[1] ?? null,
    }))
  }

  const cols = normalizedRows.shift()
  if (!cols) return []

  const formattedCols = cols.map((col) => {
    if (col instanceof Date) return formatDateForExcel(col)
    return col
  })

  return normalizedRows.map((row) =>
    Object.fromEntries(formattedCols.map((col, i) => [col, row[i] ?? null])),
  )
}

const readTable = function (
  file,
  key,
  useFirstColumnAsKeys = false,
  req = null,
) {
  if (isLargeFile(file)) {
    return readTableWithExcelJS(file, key, useFirstColumnAsKeys, req)
  }

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
      const regex = /Sheet ".+" not found/
      if (regex.test(error.message) && !req) {
        return []
      }
      throw error
    })
}

/**
 * Processes a single cell value based on type
 */
function processRowValue(value: any, fieldFormat: string | undefined): any {
  if (value instanceof Date) {
    return formatDateForExcel(value, fieldFormat as 'date' | 'date-time' | 'hour', true)
  }
  if (Number.isNaN(value)) {
    return null
  }
  if (typeof value === 'number' && value % 1 !== 0) {
    return Number.parseFloat(value.toFixed(4))
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

async function getSheetNames(
  file: FileInput,
): Promise<string[]> {
  if (isLargeFile(file)) {
    const buffer = await fileToArrayBuffer(file)
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer)
    return workbook.worksheets.map((ws) => ws.name)
  }
  return readSheetNames(file)
}

const loadExcel = async function (
  file: FileInput,
  schema: { properties: Record<string, any>; required?: string[] },
) {
  // Fast path for large files: offload parsing to a Web Worker so the UI
  // doesn't freeze for tens of seconds on 500k-row sheets. The worker already
  // contains its own ExcelJS → SheetJS fallback chain, so any error it raises
  // is final (no point retrying the same parsers on the main thread). Only
  // when no worker is available (jsdom/SSR) do we fall through to the legacy
  // main-thread path below.
  if (isLargeFile(file)) {
    const buffer = await fileToArrayBuffer(file)
    const fromWorker = await parseExcelInWorker(buffer, schema)
    if (fromWorker) return fromWorker
  }
  const sheetNames = await getSheetNames(file)
  const schemaTableNames = Object.keys(schema.properties)
  const required = schema.required || []

  const readTab = async function (tab: string): Promise<[string, any]> {
    const isInSchema = schemaTableNames.includes(tab)
    const tabSchema = isInSchema ? schema.properties[tab] : null
    const isRequired = required.includes(tab)
    const useFirstColumnAsKeys = isInSchema && tabSchema?.type === 'object'

    const getFieldFormat = (
      fieldKey: string,
    ): 'date' | 'date-time' | 'hour' | undefined => {
      if (!isInSchema || !tabSchema) return undefined
      const objectProp =
        tabSchema.type === 'object' && tabSchema.properties
          ? tabSchema.properties[fieldKey]
          : null
      const prop =
        tabSchema.type === 'array' && tabSchema.items?.properties
          ? tabSchema.items.properties[fieldKey]
          : objectProp
      if (prop?.format) {
        return prop.format === 'date' ||
          prop.format === 'date-time' ||
          prop.format === 'hour'
          ? prop.format
          : undefined
      }
      return undefined
    }

    const table = await readTable(file, tab, useFirstColumnAsKeys, isRequired)

    if (!Array.isArray(table)) {
      return [tab, table]
    }

    const processedTable = table.map((row) =>
      processTableRow(row, getFieldFormat),
    )

    // Parameter (object-type) tables: Excel has key-value rows; merge into a single object for instance/API.
    if (useFirstColumnAsKeys && processedTable.length > 0) {
      const merged = processedTable.reduce(
        (acc: Record<string, any>, row) => ({ ...acc, ...row }),
        {},
      )
      return [tab, merged]
    }

    return [tab, processedTable]
  }

  const results = await Promise.all(sheetNames.map((tab) => readTab(tab)))
  return Object.fromEntries(results)
}

/** Column order for array-type sheets: schema property order when defined, else row keys. */
function getArrayTypeExportHeaders(
  sheetName: string,
  schema: Record<string, any> | null,
  firstRow: Record<string, any>,
): string[] {
  const itemProperties = schema?.properties?.[sheetName]?.items?.properties
  if (itemProperties && typeof itemProperties === 'object') {
    const fromSchema = Object.keys(itemProperties).filter((key) =>
      isFieldVisible(key, schema, sheetName, false),
    )
    if (fromSchema.length > 0) return fromSchema
  }
  return Object.keys(firstRow).filter((key) =>
    isFieldVisible(key, schema, sheetName, false),
  )
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
  const headers = getArrayTypeExportHeaders(
    sheetName,
    schema,
    sheetData[0] as Record<string, any>,
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

// This function writes all sheets according to the schema
async function schemaDataToTable(
  wb: any,
  data: Record<string, any>,
  schema: Record<string, any> | null = null,
  options: { includeTablesWithoutSchema?: boolean } = {},
) {
  const includeTablesWithoutSchema = options.includeTablesWithoutSchema ?? true
  const dataArray: Array<[string, any[]]> = Object.entries(data).map(
    ([sheetName, sheetData]) => {
      const normalizedData = Array.isArray(sheetData) ? sheetData : [sheetData]
      return [sheetName, normalizedData] as [string, any[]]
    },
  )

  for (const [sheetName, rawSheetData] of dataArray) {
    if (
      !includeTablesWithoutSchema &&
      schema != null &&
      schema.properties?.[sheetName] == null
    ) {
      continue
    }
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

/**
 * Outcome of a build: bytes plus the actual on-disk format. For very large
 * datasets we degrade gracefully from styled XLSX (ExcelJS) → plain XLSX
 * (SheetJS) → ZIP of CSV files (one per sheet) so the download survives
 * datasets that would otherwise crash the tab with OOM. Callers use `format`
 * to pick the right filename extension.
 */
export interface ExcelBuildResult {
  bytes: Uint8Array
  format: 'xlsx' | 'zip'
}

/**
 * Above this cell count we skip the worker entirely and write CSV-in-zip on
 * the main thread. Reason: `postMessage` runs a structured-clone of the
 * input payload, which *duplicates* every row in memory. At >2M cells a
 * solution table is already several GB; doubling that to send it to the
 * worker is what crashed the tab with "Out of Memory" even after the
 * SheetJS worker fix landed.
 *
 * The CSV-zip path streams rows directly from the source `data` reference
 * (no clone) and yields back to the event loop between chunks so the
 * loading overlay keeps painting.
 */
const HUGE_BUILD_CELL_THRESHOLD = 2_000_000

/**
 * Below this cell count, single-table export keeps the original styled ExcelJS
 * path (headers, borders, column formats, Yes/No booleans). Above it, export
 * uses `buildExcelBuffer` so large result tables do not freeze the tab.
 */
const TABLE_EXPORT_STYLED_CELL_THRESHOLD = 25_000

const EXPORT_FORMAT_ROW_CHUNK = 5_000

function csvEscape(v: any): string {
  if (v === null || v === undefined) return ''
  const s = typeof v === 'string' ? v : String(v)
  if (
    s.includes(',') ||
    s.includes('"') ||
    s.includes('\n') ||
    s.includes('\r')
  ) {
    return '"' + s.replaceAll('"', '""') + '"'
  }
  return s
}

/** Yield to the event loop so the UI can paint between heavy chunks. */
function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

const CSV_ZIP_ROW_CHUNK = 1000

/** Build a function that strips path-unsafe characters and keeps names unique. */
function makeSheetNameSanitizer(): (name: string) => string {
  const usedSheetNames = new Set<string>()
  return (name: string): string => {
    // Strip path-unsafe characters and keep names unique within the zip.
    const safe = name.replaceAll(/[\\/:*?"<>|]/g, '_').slice(0, 80) || 'sheet'
    let candidate = safe
    let n = 1
    while (usedSheetNames.has(candidate)) {
      candidate = `${safe}_${n++}`
    }
    usedSheetNames.add(candidate)
    return candidate
  }
}

/** Decide whether a sheet should be skipped based on schema visibility. */
function shouldSkipCsvSheet(
  sheetName: string,
  schema: Record<string, any> | null,
  includeTablesWithoutSchema: boolean,
): boolean {
  if (
    !includeTablesWithoutSchema &&
    schema != null &&
    schema.properties?.[sheetName] == null
  ) {
    return true
  }
  return schema?.properties?.[sheetName]?.visible === false
}

/** Serialize an object-type sheet (parameter dict) as a name,value CSV. */
function objectSheetToCsv(sheet: Record<string, any>): string {
  const lines = ['name,value']
  for (const [k, v] of Object.entries(sheet)) {
    lines.push(`${csvEscape(k)},${csvEscape(v)}`)
  }
  return lines.join('\n')
}

/**
 * Build CSV in chunks; each chunk becomes a Blob part. Blobs can be gigabytes
 * without sitting in the JS heap. Yields once per chunk so the browser can
 * repaint the loading overlay and won't show the "page unresponsive" prompt.
 */
async function arraySheetToCsvBlob(
  rows: any[],
  headers: string[],
): Promise<Blob> {
  const chunks: BlobPart[] = []
  chunks.push(headers.map(csvEscape).join(',') + '\n')

  let buffer = ''
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    let line = ''
    for (let j = 0; j < headers.length; j++) {
      if (j > 0) line += ','
      line += csvEscape(row[headers[j]])
    }
    buffer += line + '\n'

    if ((i + 1) % CSV_ZIP_ROW_CHUNK === 0) {
      chunks.push(buffer)
      buffer = ''
      await yieldToEventLoop()
    }
  }
  if (buffer.length > 0) chunks.push(buffer)

  return new Blob(chunks, { type: 'text/csv' })
}

/**
 * Streams the data to a ZIP-of-CSVs on the main thread. Memory profile is
 * essentially the source `data` plus the zip's intermediate Blobs (which
 * Chrome can spill to disk — they don't sit in the JS heap). 1k-row chunks
 * keep individual string allocations small; an event-loop yield after each
 * chunk lets the loading overlay tick.
 */
async function buildAsCsvZip(
  data: Record<string, any>,
  schema: Record<string, any> | null,
  options: { includeTablesWithoutSchema?: boolean } = {},
): Promise<Uint8Array> {
  const includeTablesWithoutSchema = options.includeTablesWithoutSchema ?? true
  // Dynamic import keeps JSZip out of the main bundle when it's not needed.
  const JSZip = (await import('jszip')).default
  const zip = new JSZip()

  const sanitizeSheetName = makeSheetNameSanitizer()

  for (const [sheetName, rawSheetData] of Object.entries(data)) {
    if (shouldSkipCsvSheet(sheetName, schema, includeTablesWithoutSchema)) {
      continue
    }

    const normalizedData = Array.isArray(rawSheetData)
      ? rawSheetData
      : [rawSheetData]
    if (normalizedData.length === 0) continue
    if (!normalizedData[0] || typeof normalizedData[0] !== 'object') continue

    const filename = `${sanitizeSheetName(sheetName)}.csv`

    if (schema?.properties?.[sheetName]?.type === 'object') {
      // Object-type sheets are tiny (parameter dicts) — one-shot is fine.
      zip.file(filename, objectSheetToCsv(normalizedData[0]))
      continue
    }

    // Honour schema visibility and column order for array-type sheets.
    const headers = getArrayTypeExportHeaders(
      sheetName,
      schema,
      normalizedData[0] as Record<string, any>,
    )
    if (headers.length === 0) {
      zip.file(filename, '')
      continue
    }

    zip.file(filename, await arraySheetToCsvBlob(normalizedData, headers))
  }

  const blob = await zip.generateAsync({
    type: 'blob',
    streamFiles: true,
    compression: 'DEFLATE',
    compressionOptions: { level: 3 },
  })
  // The final blob can be huge; converting to Uint8Array doubles peak briefly
  // but our caller wraps it in a Blob URL immediately and drops the array.
  const arrayBuffer = await blob.arrayBuffer()
  return new Uint8Array(arrayBuffer)
}

/**
 * Build an xlsx (or zip-of-csv for huge datasets) file as raw bytes from an
 * instance/solution `data` dict.
 *
 * Routing rules:
 *  - ≤ `HUGE_BUILD_CELL_THRESHOLD` cells → Excel worker (ExcelJS/SheetJS
 *    inside). Output is real `.xlsx`.
 *  - > `HUGE_BUILD_CELL_THRESHOLD` cells → main-thread CSV-zip path, so we
 *    avoid the structured-clone duplication of multi-GB payloads.
 *  - No worker available (jsdom/SSR) → ExcelJS on main thread (legacy).
 *
 * Callers use the returned `format` to choose the file extension.
 */
async function buildExcelBuffer(
  data: Record<string, any>,
  schema: Record<string, any> | null = null,
  options: { includeTablesWithoutSchema?: boolean } = {},
): Promise<ExcelBuildResult> {
  const cellCount = estimateSheetCellCount(data, schema)

  if (cellCount > HUGE_BUILD_CELL_THRESHOLD) {
    const bytes = await buildAsCsvZip(data, schema, options)
    return { bytes, format: 'zip' }
  }

  const fromWorker = await buildExcelBufferInWorker(data, schema, options)
  if (fromWorker) return { bytes: fromWorker, format: 'xlsx' }

  const workbook = new ExcelJS.Workbook()
  await schemaDataToTable(workbook, data, schema, options)
  const buf = await workbook.xlsx.writeBuffer()
  let bytes: Uint8Array
  if (buf instanceof Uint8Array) bytes = buf
  else if (buf instanceof ArrayBuffer) bytes = new Uint8Array(buf)
  else {
    const view = buf as ArrayBufferView
    bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength)
  }
  return { bytes, format: 'xlsx' }
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
  const itemDate = new Date(date)
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }

  const formattedDate = new Intl.DateTimeFormat(locale.value, options).format(
    itemDate,
  )

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
    number = number * 26 + (letter.codePointAt(i) - 'A'.codePointAt(0) + 1)
  }
  return number
}

function getLetterFromNumber(number) {
  let result = ''
  while (number > 0) {
    const remainder = (number - 1) % 26
    result = String.fromCodePoint(65 + remainder) + result
    number = Math.floor((number - 1) / 26)
  }
  return result
}

/**
 * Checks if a field should be excluded from export
 */
function shouldExcludeField(key: string, fieldSchema: any): boolean {
  if (key === 'id') return true
  if (fieldSchema?.visible === false) return true
  if (fieldSchema?.frontendReadOnly) return true
  if (fieldSchema?.hidden) return true
  if (fieldSchema?.isForeignKey) return true
  if (fieldSchema?.columnsToJoin && Array.isArray(fieldSchema.columnsToJoin))
    return true
  return false
}

/**
 * Extracts schema fields from table config
 */
function extractSchemaFields(
  tableConfig: any,
  items: any[],
): {
  schemaFields: Array<{ key: string; type: string; required: boolean }>
  backendKeys: string[]
} {
  const schemaFields: Array<{ key: string; type: string; required: boolean }> =
    []
  const backendKeys: string[] = []

  const rowSchema = getListResponseRowProperties(tableConfig)
  const properties = rowSchema?.properties
  if (properties) {
    const requiredFields = rowSchema.required
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
  t?: any,
): void {
  items.forEach((item, index) => {
    const rowData = schemaFields.map((field) =>
      formatValueByType(item[field.key], field.type, t),
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

const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const ZIP_MIME = 'application/zip'

/**
 * Single-table export routing:
 * - Small (≤ `TABLE_EXPORT_STYLED_CELL_THRESHOLD` cells): styled ExcelJS on main thread.
 * - Medium/large: `buildExcelBuffer` (worker / compressed xlsx, or CSV-zip).
 * - Empty (headers only): styled ExcelJS template workbook.
 */
function buildTableExportSchema(
  sheetName: string,
  schemaFields: Array<{ key: string; type: string }>,
  items?: any[],
): Record<string, any> {
  const properties: Record<string, any> = {}
  for (const field of schemaFields) {
    properties[field.key] = { type: field.type || 'string' }
  }

  const firstRow = items?.[0]
  if (firstRow && typeof firstRow === 'object') {
    for (const key of Object.keys(firstRow)) {
      if (key === 'id' || key in properties) continue
      properties[key] = { type: 'string', visible: false }
    }
  }

  return {
    properties: {
      [sheetName]: {
        type: 'array',
        items: { properties },
      },
    },
  }
}

function triggerTableBuiltDownload(
  result: ExcelBuildResult,
  tableName: string,
): void {
  const mime = result.format === 'zip' ? ZIP_MIME : XLSX_MIME
  const filename = `${tableName}_${new Date().toISOString().split('T')[0]}.${result.format}`
  const blob = new Blob([result.bytes as BlobPart], { type: mime })
  const url = globalThis.window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  globalThis.window.URL.revokeObjectURL(url)
}

/**
 * Downloads workbook as Excel file
 */
async function downloadExcelFile(
  workbook: ExcelJS.Workbook,
  tableName: string,
): Promise<void> {
  const excelBuffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([excelBuffer], { type: XLSX_MIME })
  const link = document.createElement('a')
  link.href = globalThis.window.URL.createObjectURL(blob)
  link.download = `${tableName}_${new Date().toISOString().split('T')[0]}.xlsx`
  link.click()
  globalThis.window.URL.revokeObjectURL(link.href)
}

/**
 * Display column for Excel export (same as table: key = item key, title = header text).
 */
export interface ExportDisplayHeader {
  key: string
  title?: string
  type?: string
}

/** Coerce an arbitrary value into a boolean using the same truthy rules as the table. */
function coerceToBoolean(value: any): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase()
    const truthy = ['true', '1', 'yes', 'y', 'sí', 'si', 'oui']
    return truthy.includes(v)
  }
  return Boolean(value)
}

/**
 * Format value according to its schema type for Excel export
 */
function formatValueByType(value, type, t?: any) {
  if (value === null || value === undefined) {
    return ''
  }

  switch (type) {
    case 'boolean': {
      const bool = coerceToBoolean(value)
      // Write booleans as the same Yes/No text the table shows. Avoids issues
      // where ExcelJS boolean cells combined with text column format render
      // inconsistently across Excel locales.
      const yes = (typeof t === 'function' ? t('table.yes') : null) || 'Yes'
      const no = (typeof t === 'function' ? t('table.no') : null) || 'No'
      return bool ? yes : no
    }
    case 'integer':
      return typeof value === 'number'
        ? Math.floor(value)
        : Number.parseInt(value) || 0
    case 'number':
      return typeof value === 'number' ? value : Number.parseFloat(value) || 0
    case 'string':
    default:
      return String(value)
  }
}

/** Apply per-column export formatting in chunks so the UI can breathe. */
async function formatItemsForExport(
  items: any[],
  schemaFields: Array<{ key: string; type: string }>,
  t?: any,
): Promise<any[]> {
  const result = new Array(items.length)
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const row: Record<string, any> = {}
    for (const field of schemaFields) {
      row[field.key] = formatValueByType(item[field.key], field.type, t)
    }
    result[i] = row
    if ((i + 1) % EXPORT_FORMAT_ROW_CHUNK === 0) {
      await yieldToEventLoop()
    }
  }
  return result
}

/**
 * Exports table data to Excel file with proper formatting based on backend schema.
 * When displayHeaders is provided (e.g. from the table's visible headers), exports
 * exactly those columns in that order. Both the sheet name and the header row use
 * backend keys (not translated titles) so the file can be re-uploaded and matched
 * back to its table (master tables, instance/solution) without name errors.
 * `tableTitle` is kept for signature compatibility but no longer names the sheet.
 */
async function exportTableToExcel(
  items,
  tableConfig,
  tableName,
  tableTitle,
  t,
  displayHeaders?: ExportDisplayHeader[],
) {
  let schemaFields: Array<{ key: string; type: string; required?: boolean }>
  let headerRowLabels: string[]

  if (displayHeaders && displayHeaders.length > 0) {
    const properties = getListResponseRowProperties(tableConfig)?.properties
    schemaFields = displayHeaders.map((h) => ({
      key: h.key,
      type:
        h.type ||
        properties?.[h.key]?.type ||
        'string',
      required: false,
    }))
    headerRowLabels = displayHeaders.map((h) => h.key)
  } else {
    const extracted = extractSchemaFields(tableConfig, items)
    schemaFields = extracted.schemaFields
    headerRowLabels = extracted.backendKeys
  }

  if (headerRowLabels.length === 0) {
    const workbook = new ExcelJS.Workbook()
    workbook.addWorksheet(tableName || tableTitle)
    await downloadExcelFile(workbook, tableName)
    return
  }

  // Use the saved table key (not the translated title) as the sheet name so the
  // master-table matcher recognises the table on re-upload.
  const sheetKey = tableName || tableTitle
  const cellCount = (items?.length ?? 0) * headerRowLabels.length

  if (items && items.length > 0) {
    if (cellCount <= TABLE_EXPORT_STYLED_CELL_THRESHOLD) {
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet(sheetKey)

      worksheet.addRow(headerRowLabels)
      styleExportHeaderRow(worksheet)
      addExportDataRows(worksheet, items, schemaFields, t)
      setColumnFormats(worksheet, schemaFields)
      applyExportBorders(worksheet, items.length + 1, headerRowLabels.length)

      await downloadExcelFile(workbook, tableName)
      return
    }

    // Large tables: worker / zip path. Apply typed formatting when the worker
    // path is used; skip the extra copy for HUGE csv-zip to avoid doubling GB payloads.
    const exportItems =
      cellCount <= HUGE_BUILD_CELL_THRESHOLD
        ? await formatItemsForExport(items, schemaFields, t)
        : items
    const result = await buildExcelBuffer(
      { [sheetKey]: exportItems },
      buildTableExportSchema(sheetKey, schemaFields, exportItems),
    )
    triggerTableBuiltDownload(result, tableName)
    return
  }

  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet(sheetKey)

  worksheet.addRow(headerRowLabels)
  styleExportHeaderRow(worksheet)
  setColumnFormats(worksheet, schemaFields)
  applyExportBorders(worksheet, 1, headerRowLabels.length)

  await downloadExcelFile(workbook, tableName)
}

export {
  loadExcel,
  schemaDataToTable,
  buildExcelBuffer,
  exportTableToExcel,
  toISOStringLocal,
  formatDateForHeaders,
  formatDate,
  getLetterFromNumber,
  getNumberFromLetter,
}
