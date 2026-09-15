/**
 * Minimal ExcelJS stand-in for Vitest. The real `exceljs` package pulls in `uuid`,
 * which is ESM-only under this project's npm overrides, so loading exceljs breaks CJS
 * interop during test collection. Tests that need Excel behaviour use explicit mocks.
 */

class StubWorksheet {
  name = 'Sheet1'
  columns: unknown[] = []

  eachRow(_options?: unknown, callback?: (row: StubRow) => void) {
    const cb = typeof _options === 'function' ? (_options as (row: StubRow) => void) : callback
    if (cb) cb(new StubRow())
  }

  getColumn() {
    return { eachCell: () => {} }
  }

  getRow() {
    return { eachCell: () => {} }
  }

  addRow() {
    return {}
  }

  mergeCells() {}
}

class StubRow {
  values: unknown[] = [undefined]
}

export class Workbook {
  xlsx = {
    load: async (_buffer?: ArrayBuffer | ArrayBufferView) => {},
    writeBuffer: async () => new ArrayBuffer(8),
  }

  worksheets: StubWorksheet[] = []

  getWorksheet(name?: string | number) {
    if (name === undefined || name === null) return undefined as unknown
    const key = String(name)
    return this.worksheets.find((ws) => ws.name === key) as unknown
  }

  addWorksheet(name?: string) {
    const ws = new StubWorksheet()
    if (name) ws.name = name
    this.worksheets.push(ws)
    return ws as unknown
  }

  removeWorksheet() {}
}

export default { Workbook }
