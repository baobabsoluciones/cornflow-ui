/**
 * Pure, framework-agnostic helpers shared by the main-thread Excel builder
 * (`@/utils/data_io`) and the Excel Web Worker (`@/workers/excelWorker`).
 *
 * IMPORTANT: everything here must stay pure — no DOM, no `self`/worker globals,
 * no `document`. These run on the main thread AND inside a Web Worker.
 */

/**
 * Applies the standard thin border style to a cell (ExcelJS cell).
 */
export function applyCellBorder(cell: any): void {
  cell.border = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' },
  }
}

/**
 * Gets the alternating row fill (white / light grey) for the given row index.
 */
export function getAlternatingFill(index: number): any {
  return {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: index % 2 === 0 ? 'FFFFFFFF' : 'FFF2F2F2' },
  }
}

/**
 * Checks if a field should be visible in export based on schema visibility.
 */
export function isFieldVisible(
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
 * Returns true if the value is a primitive (string, number, boolean, null).
 * Used to detect arrays of strings etc. so we export one column instead of spreading.
 */
export function isPrimitive(value: any): boolean {
  return value === null || typeof value !== 'object'
}

/**
 * Returns true if the array is a primitive array (all elements are string, number, boolean, or null).
 */
export function isPrimitiveArray(arr: any[]): boolean {
  if (arr.length === 0) return false
  return arr.every((item) => isPrimitive(item))
}

/** Column key used when exporting primitive arrays (e.g. array of strings) as a single column. */
export const PRIMITIVE_ARRAY_COLUMN = 'value'

/**
 * Prepares sheet data, creating empty row if needed.
 * Normalizes primitive arrays (e.g. string[]) to [{ value: item }, ...] so they export as one column.
 */
export function prepareSheetData(
  sheetData: any[],
  schema: Record<string, any> | null,
  sheetName: string,
): any[] | null {
  if (sheetData.length === 0) {
    const requiredHeaders = schema?.properties?.[sheetName]?.items?.required
    if (!requiredHeaders) return null
    return [
      requiredHeaders.reduce((acc: Record<string, any>, header: string) => {
        acc[header] = null
        return acc
      }, {}),
    ]
  }

  // Array of primitives (e.g. array of strings): export as single column to avoid
  // Object.keys(string) turning each character into a column and Excel warnings
  if (isPrimitiveArray(sheetData)) {
    return sheetData.map((item) => ({ [PRIMITIVE_ARRAY_COLUMN]: item }))
  }

  return sheetData
}

/**
 * Rough cell-count estimate without iterating every row: rows × first-row
 * column count, summed across sheets. Skips object-type (parameter) sheets
 * since they're tiny, and skips schema-invisible sheets.
 */
export function estimateSheetCellCount(
  data: Record<string, any>,
  schema: Record<string, any> | null,
): number {
  let total = 0
  for (const [sheetName, rawSheetData] of Object.entries(data)) {
    if (schema?.properties?.[sheetName]?.visible === false) continue
    const isObjectType = schema?.properties?.[sheetName]?.type === 'object'
    if (isObjectType) continue
    if (!Array.isArray(rawSheetData) || rawSheetData.length === 0) continue
    const firstRow = rawSheetData[0]
    if (!firstRow || typeof firstRow !== 'object') continue
    const cols = Object.keys(firstRow).length
    total += rawSheetData.length * cols
  }
  return total
}

/**
 * Processes an object-type worksheet (key-value pairs) into an ExcelJS sheet.
 *
 * `maxStyledRows` caps per-cell border/fill styling: rows are only styled when
 * the visible-row count is `<= maxStyledRows`. The main-thread builder always
 * styles (default `Infinity`); the worker passes a finite limit to skip
 * expensive per-cell styling on very large sheets.
 */
export function processObjectTypeWorksheet(
  worksheet: any,
  sheetData: any[],
  schema: Record<string, any> | null,
  sheetName: string,
  maxStyledRows = Number.POSITIVE_INFINITY,
): void {
  const tableData = Object.entries(sheetData[0] as Record<string, any>).filter(
    ([key]) => isFieldVisible(key, schema, sheetName, true),
  )

  const headerRow = worksheet.addRow(['name', 'value'])
  headerRow.eachCell((cell: any) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD3D3D3' },
    }
    cell.font = { bold: true }
    applyCellBorder(cell)
  })

  worksheet.addRows(tableData)
  worksheet.getColumn(1).width = 20
  worksheet.getColumn(2).width = 30

  if (tableData.length <= maxStyledRows) {
    tableData.forEach((_, index) => {
      ;['A', 'B'].forEach((col) => {
        const cell = worksheet.getCell(`${col}${index + 2}`)
        cell.fill = getAlternatingFill(index)
        applyCellBorder(cell)
      })
    })
  }
}
