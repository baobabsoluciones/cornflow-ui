/**
 * Module Web Worker: offloads heavy Excel parse + build operations off the main thread.
 *
 * Protocol: each request has `{ id, type, payload }`; each response is
 * `{ id, ok: true, result }` or `{ id, ok: false, error }`. Binary payloads
 * (`ArrayBuffer`) are sent as transferables to avoid copies.
 */

import * as ExcelJS from 'exceljs'
import { formatDateForExcel } from '@cornflow-ui/core/utils/date'
import {
  applyCellBorder,
  getAlternatingFill,
  isFieldVisible,
  prepareSheetData,
  estimateSheetCellCount,
  processObjectTypeWorksheet,
} from '@cornflow-ui/core/utils/excelStyling'

// SheetJS is lazy-loaded only when ExcelJS chokes on a file. Keeps the
// hot-path worker bundle small for the 99% case where ExcelJS succeeds.
type XLSXModule = typeof import('xlsx')
let xlsxLibPromise: Promise<XLSXModule> | null = null
function loadSheetJS(): Promise<XLSXModule> {
  xlsxLibPromise ??= import('xlsx')
  return xlsxLibPromise
}

// ---------- PARSE ----------

function processRowValue(value: any, fieldFormat: string | undefined): any {
  if (value instanceof Date) return formatDateForExcel(value, fieldFormat as any, true)
  if (typeof value === 'number' && Number.isNaN(value)) return null
  if (typeof value === 'number' && value % 1 !== 0) return Number.parseFloat(value.toFixed(4))
  return value
}

/**
 * Returns the `format` declared in the table schema for a given field, or
 * undefined when the schema doesn't carry that info. Shared by ExcelJS and
 * SheetJS parse paths.
 */
function makeFieldFormatResolver(
  isInSchema: boolean,
  tabSchema: any,
): (fieldKey: string) => 'date' | 'date-time' | 'hour' | undefined {
  return (fieldKey: string) => {
    if (!isInSchema || !tabSchema) return undefined
    const objectProp =
      tabSchema.type === 'object' && tabSchema.properties
        ? tabSchema.properties[fieldKey]
        : null
    const prop =
      tabSchema.type === 'array' && tabSchema.items?.properties
        ? tabSchema.items.properties[fieldKey]
        : objectProp
    if (prop?.format === 'date' || prop?.format === 'date-time' || prop?.format === 'hour') {
      return prop.format
    }
    return undefined
  }
}

/**
 * Per-sheet schema context shared by both parse paths.
 */
interface SheetParseContext {
  useFirstColumnAsKeys: boolean
  getFieldFormat: (fieldKey: string) => 'date' | 'date-time' | 'hour' | undefined
}

function resolveSheetParseContext(
  tab: string,
  schemaTableNames: string[],
  schema: { properties: Record<string, any>; required?: string[] },
): SheetParseContext {
  const isInSchema = schemaTableNames.includes(tab)
  const tabSchema = isInSchema ? schema.properties[tab] : null
  return {
    useFirstColumnAsKeys: isInSchema && tabSchema?.type === 'object',
    getFieldFormat: makeFieldFormatResolver(isInSchema, tabSchema),
  }
}

/**
 * Builds the key→value object for an object-type sheet (first column = keys).
 */
function parseSheetAsKeyValue(
  rows: any[][],
  getFieldFormat: SheetParseContext['getFieldFormat'],
): Record<string, any> {
  const merged: Record<string, any> = {}
  for (const row of rows) {
    const k = String(row[0] ?? '')
    merged[k] = processRowValue(row[1] ?? null, getFieldFormat(k))
  }
  return merged
}

/**
 * Builds the array-of-records for an array-type sheet (first row = headers).
 * Returns `[]` when there is no header row.
 */
function parseSheetAsRecords(
  rows: any[][],
  getFieldFormat: SheetParseContext['getFieldFormat'],
): Record<string, any>[] {
  const cols = rows.shift()
  if (!cols) return []
  const formattedCols = cols.map((c: any) => (c instanceof Date ? formatDateForExcel(c) : c))

  const result: Record<string, any>[] = new Array(rows.length)
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const obj: Record<string, any> = {}
    for (let j = 0; j < formattedCols.length; j++) {
      const colKey = formattedCols[j] as string
      obj[colKey] = processRowValue(row[j] ?? null, getFieldFormat(colKey))
    }
    result[i] = obj
  }
  return result
}

function parseSheetRows(
  rows: any[][],
  ctx: SheetParseContext,
): Record<string, any> | Record<string, any>[] {
  return ctx.useFirstColumnAsKeys
    ? parseSheetAsKeyValue(rows, ctx.getFieldFormat)
    : parseSheetAsRecords(rows, ctx.getFieldFormat)
}

async function parseWithExcelJS(
  buffer: ArrayBuffer,
  schema: { properties: Record<string, any>; required?: string[] },
): Promise<Record<string, any>> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)

  // Note: we intentionally do NOT enforce `schema.required` here. This
  // function parses one xlsx file in isolation and the upload flow can split
  // a single instance across multiple files that get merged downstream
  // (see `mergeInstances` in `useInstanceProcessing`). Required-sheet
  // validation belongs to the merged result, not to each file.
  const schemaTableNames = Object.keys(schema?.properties ?? {})
  const result: Record<string, any> = {}

  for (const worksheet of workbook.worksheets) {
    const tab = worksheet.name
    const ctx = resolveSheetParseContext(tab, schemaTableNames, schema)

    // Stream rows: ExcelJS keeps a reference to the worksheet, but `row.values` we
    // copy out immediately so we don't retain ExcelJS row objects.
    const allRows: any[][] = []
    worksheet.eachRow((row) => {
      allRows.push(row.values as any[])
    })
    const normalized = allRows.map((row) => row.slice(1))

    result[tab] = parseSheetRows(normalized, ctx)
  }

  return result
}

/**
 * SheetJS fallback. Used when ExcelJS chokes on the file structure (e.g. the
 * "Cannot set properties of undefined (setting 'sheetNo')" rels-mapping bug
 * that hits some xlsx exports). SheetJS is more permissive: it tolerates
 * unconventional rels, hidden sheets without proper mappings, and several
 * other shapes that crash ExcelJS.
 */
async function parseWithSheetJS(
  buffer: ArrayBuffer,
  schema: { properties: Record<string, any>; required?: string[] },
): Promise<Record<string, any>> {
  const XLSX = await loadSheetJS()
  const wb = XLSX.read(new Uint8Array(buffer), {
    type: 'array',
    cellDates: true,
    dense: true,
  })

  // Same rationale as in `parseWithExcelJS`: this function handles a single
  // xlsx file; required-sheet validation runs on the merged instance later.
  const schemaTableNames = Object.keys(schema?.properties ?? {})
  const result: Record<string, any> = {}

  for (const tab of wb.SheetNames) {
    const ws = wb.Sheets[tab]
    if (!ws) continue

    const ctx = resolveSheetParseContext(tab, schemaTableNames, schema)

    // header:1 → array-of-arrays; defval:null → empty cells become null.
    const rowsRaw = XLSX.utils.sheet_to_json<any[]>(ws, {
      header: 1,
      raw: true,
      defval: null,
      blankrows: false,
    })

    result[tab] = parseSheetRows(rowsRaw, ctx)
  }

  return result
}

async function parseWorkbook(
  buffer: ArrayBuffer,
  schema: { properties: Record<string, any>; required?: string[] },
): Promise<Record<string, any>> {
  try {
    return await parseWithExcelJS(buffer, schema)
  } catch (err) {
    // "Sheet not found" is a real validation failure — don't fall back, propagate.
    const message = (err as Error)?.message ?? ''
    if (/Sheet ".+" not found/.test(message)) throw err
    // ExcelJS choked on the file structure (e.g. malformed rels). Retry with
    // SheetJS, which tolerates more shapes. If SheetJS also fails, throw
    // the SheetJS error so the user sees the most informative diagnostic.
    return await parseWithSheetJS(buffer, schema)
  }
}

// ---------- BUILD ----------

/**
 * For very large array sheets we skip per-cell borders and alternating fills
 * (each is millions of style ops at 500k rows). Header still gets styled.
 */
const STYLING_ROW_LIMIT = 50_000

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

  // Single pass: header + body via addRows
  worksheet.addRow(headers)
  const bodyChunkSize = 5000
  for (let i = 0; i < sheetData.length; i += bodyChunkSize) {
    const chunk = sheetData.slice(i, i + bodyChunkSize).map((row) => headers.map((h) => row[h]))
    worksheet.addRows(chunk)
  }

  headers.forEach((header, index) => {
    worksheet.getColumn(index + 1).width = header.length + 5
  })

  // Header styling: always.
  const headerRow = worksheet.getRow(1)
  headerRow.eachCell((cell: any) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } }
    cell.font = { bold: true }
    applyCellBorder(cell)
  })

  // Body styling: only for small tables; at 500k rows this is multi-second work
  // for no functional gain on round-trip exports (ETL doesn't care about fills).
  if (sheetData.length <= STYLING_ROW_LIMIT) {
    for (let rowIndex = 1; rowIndex < sheetData.length + 1; rowIndex++) {
      for (let colIndex = 0; colIndex < headers.length; colIndex++) {
        const cell = worksheet.getCell(rowIndex + 1, colIndex + 1)
        cell.fill = getAlternatingFill(rowIndex)
        applyCellBorder(cell)
      }
    }
  }
}

/**
 * Threshold above which we switch from ExcelJS to SheetJS for serialisation.
 * ExcelJS keeps every cell as a JS object with styling/format metadata, so
 * memory blows up linearly with cell count (≈ 50–100 bytes per cell). A
 * 500k×20 solution table needs ~1 GB before writeBuffer even starts and
 * crashes the tab with OOM. SheetJS stores cells more compactly and writes
 * in larger zipped chunks, surviving the same datasets in ~200–300 MB.
 * Threshold picked conservatively so styled (ExcelJS) builds stay common for
 * normal reports.
 */
const LARGE_BUILD_CELL_THRESHOLD = 200_000

/**
 * Whether a sheet should be skipped during a build, based on schema presence
 * and visibility. Shared decision so both build paths stay consistent.
 */
function shouldSkipSheetForBuild(
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

/**
 * Builds the SheetJS array-of-arrays for an object-type (parameter) sheet.
 */
function buildObjectSheetAOA(
  sheetData: any[],
  schema: Record<string, any> | null,
  sheetName: string,
): any[][] {
  const aoa: any[][] = [['name', 'value']]
  const entries = Object.entries(sheetData[0] as Record<string, any>).filter(
    ([key]) => isFieldVisible(key, schema, sheetName, true),
  )
  for (const [k, v] of entries) aoa.push([k, v])
  return aoa
}

/**
 * SheetJS path. Plain headers (no fill/borders) — fine for round-trip and
 * data exports. The ExcelJS-styled path is preserved for small reports.
 */
// Pre-sized array-of-arrays (header row + data rows) for an array-type sheet.
function buildArraySheetAOA(
  sheetData: any[],
  schema: Record<string, any> | null,
  sheetName: string,
): any[][] {
  const headers = getArrayTypeExportHeaders(
    sheetName,
    schema,
    sheetData[0] as Record<string, any>,
  )
  const aoa: any[][] = new Array(sheetData.length + 1)
  aoa[0] = headers
  for (let i = 0; i < sheetData.length; i++) {
    const row = sheetData[i]
    const out = new Array(headers.length)
    for (let j = 0; j < headers.length; j++) out[j] = row[headers[j]]
    aoa[i + 1] = out
  }
  return aoa
}

// Build the worksheet for one sheet (object- or array-type) and append it.
function appendSheetJsSheet(
  XLSX: any,
  wb: any,
  sheetName: string,
  sheetData: any[],
  schema: Record<string, any> | null,
): void {
  const isObjectType = schema?.properties?.[sheetName]?.type === 'object'
  if (isObjectType) {
    const ws = XLSX.utils.aoa_to_sheet(buildObjectSheetAOA(sheetData, schema, sheetName))
    ws['!cols'] = [{ wch: 20 }, { wch: 30 }]
    XLSX.utils.book_append_sheet(wb, ws, sheetName)
    return
  }
  const aoa = buildArraySheetAOA(sheetData, schema, sheetName)
  const headers = aoa[0] as string[]
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = headers.map((h) => ({ wch: h.length + 5 }))
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
}

function normalizeSheetJsOutput(out: unknown): Uint8Array {
  if (out instanceof Uint8Array) return out
  if (out instanceof ArrayBuffer) return new Uint8Array(out)
  return new Uint8Array(out as ArrayBufferLike)
}

async function buildWithSheetJS(
  data: Record<string, any>,
  schema: Record<string, any> | null,
  options: { includeTablesWithoutSchema?: boolean } = {},
): Promise<Uint8Array> {
  const XLSX = await loadSheetJS()
  const includeTablesWithoutSchema = options.includeTablesWithoutSchema ?? true
  const wb = XLSX.utils.book_new()

  for (const [sheetName, rawSheetData] of Object.entries(data)) {
    if (shouldSkipSheetForBuild(sheetName, schema, includeTablesWithoutSchema)) continue

    const normalizedData = Array.isArray(rawSheetData) ? rawSheetData : [rawSheetData]
    const sheetData = prepareSheetData(normalizedData, schema, sheetName)
    if (!sheetData) continue

    appendSheetJsSheet(XLSX, wb, sheetName, sheetData, schema)
  }

  // `compression: true` runs DEFLATE on the zip entries (smaller files,
  // negligible CPU vs the OOM we're avoiding).
  const out = XLSX.write(wb, {
    type: 'array',
    bookType: 'xlsx',
    compression: true,
  })
  return normalizeSheetJsOutput(out)
}

async function buildWithExcelJS(
  data: Record<string, any>,
  schema: Record<string, any> | null,
  options: { includeTablesWithoutSchema?: boolean } = {},
): Promise<Uint8Array> {
  const includeTablesWithoutSchema = options.includeTablesWithoutSchema ?? true
  const workbook = new ExcelJS.Workbook()

  for (const [sheetName, rawSheetData] of Object.entries(data)) {
    const normalizedData = Array.isArray(rawSheetData) ? rawSheetData : [rawSheetData]
    if (
      !includeTablesWithoutSchema &&
      schema != null &&
      schema.properties?.[sheetName] == null
    ) {
      continue
    }
    if (schema?.properties?.[sheetName]?.visible === false) continue

    const sheetData = prepareSheetData(normalizedData, schema, sheetName)
    if (!sheetData) continue

    const worksheet = workbook.addWorksheet(sheetName)
    const isObjectType = schema?.properties?.[sheetName]?.type === 'object'
    if (isObjectType) {
      processObjectTypeWorksheet(
        worksheet,
        sheetData,
        schema,
        sheetName,
        STYLING_ROW_LIMIT,
      )
    } else {
      processArrayTypeWorksheet(worksheet, sheetData, schema, sheetName)
    }
  }

  const buf = await workbook.xlsx.writeBuffer()
  if (buf instanceof Uint8Array) return buf
  if (buf instanceof ArrayBuffer) return new Uint8Array(buf)
  const view = buf as ArrayBufferView
  return new Uint8Array(view.buffer, view.byteOffset, view.byteLength)
}

async function buildWorkbookBuffer(
  data: Record<string, any>,
  schema: Record<string, any> | null,
  options: { includeTablesWithoutSchema?: boolean } = {},
): Promise<Uint8Array> {
  const cellEstimate = estimateSheetCellCount(data, schema)
  if (cellEstimate > LARGE_BUILD_CELL_THRESHOLD) {
    try {
      return await buildWithSheetJS(data, schema, options)
    } catch (err) {
      // SheetJS failed for some structural reason; try ExcelJS as a last
      // resort even though it's likely to OOM at this size — the user
      // deserves the most informative error possible.
      console.error('SheetJS build failed, retrying with ExcelJS', err)
    }
  }
  return await buildWithExcelJS(data, schema, options)
}

// ---------- DISPATCH ----------

type Request =
  | { id: number; type: 'parse'; payload: { buffer: ArrayBuffer; schema: any } }
  | {
      id: number
      type: 'build'
      payload: {
        data: Record<string, any>
        schema: Record<string, any> | null
        options?: { includeTablesWithoutSchema?: boolean }
      }
    }

self.addEventListener('message', async (event: MessageEvent<Request>) => {
  // Messages from our own page (dedicated worker) carry an empty origin;
  // reject anything cross-origin as a defensive measure.
  if (event.origin !== '' && event.origin !== self.location.origin) {
    return
  }

  const { id, type, payload } = event.data
  try {
    if (type === 'parse') {
      const result = await parseWorkbook(payload.buffer, payload.schema)
      ;(self as any).postMessage({ id, ok: true, result })
      return
    }
    if (type === 'build') {
      const bytes = await buildWorkbookBuffer(
        payload.data,
        payload.schema,
        payload.options,
      )
      ;(self as any).postMessage({ id, ok: true, result: bytes }, [bytes.buffer])
      return
    }
    ;(self as any).postMessage({ id, ok: false, error: `Unknown message type: ${type}` })
  } catch (err: any) {
    ;(self as any).postMessage({ id, ok: false, error: err?.message ?? String(err) })
  }
})

