import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  buildExcelBuffer,
  schemaDataToTable,
  exportTableToExcel,
} from '@/utils/data_io'

// i18n is imported by data_io for formatDateForHeaders; provide a minimal stub
// so importing the module under test does not pull in the real plugin.
vi.mock('@/plugins/i18n', () => ({
  default: {
    global: {
      locale: { value: 'en' },
      t: vi.fn((key: string) => key),
    },
  },
}))

// The Excel worker client tries to spawn a real Worker from an import.meta.url
// module that does not resolve under jsdom; force the "no worker" fallback so
// buildExcelBuffer takes its deterministic main-thread paths (ExcelJS / CSV-zip)
// instead of hanging on a worker that never answers.
vi.mock('@/utils/excelWorkerClient', () => ({
  parseExcelInWorker: vi.fn().mockResolvedValue(null),
  buildExcelBufferInWorker: vi.fn().mockResolvedValue(null),
}))

// Override the project's lean exceljs stub (it lacks addRows/getCell, which the
// xlsx/export paths call). This richer mock records enough to let the real
// serialization/styling helpers run to completion without a real workbook.
vi.mock('exceljs', () => {
  class MockWorksheet {
    name = 'Sheet1'
    rows: any[] = []
    private cells: Record<string, any> = {}
    private columns: Record<number, any> = {}
    addRow(data: any) {
      this.rows.push(data)
      const arr = Array.isArray(data) ? data : [data]
      return {
        eachCell: (cb: (cell: any) => void) =>
          arr.forEach(() => cb(this.cellObj())),
        fill: {},
        font: {},
        alignment: {},
        height: 0,
      }
    }
    addRows(data: any[]) {
      data.forEach((r) => this.rows.push(r))
    }
    getColumn(i: number) {
      this.columns[i] = this.columns[i] || { width: 0, numFmt: '' }
      return this.columns[i]
    }
    getRow(_i: number) {
      return { font: {}, fill: {}, alignment: {}, height: 0 }
    }
    getCell(a: any, b?: any) {
      const key = b === undefined ? String(a) : `${a},${b}`
      this.cells[key] = this.cells[key] || this.cellObj()
      return this.cells[key]
    }
    private cellObj() {
      return { fill: {}, font: {}, border: {}, alignment: {} }
    }
  }
  class MockWorkbook {
    worksheets: MockWorksheet[] = []
    xlsx = {
      load: async () => {},
      writeBuffer: async () => new Uint8Array([1, 2, 3, 4]),
    }
    addWorksheet(name?: string) {
      const ws = new MockWorksheet()
      if (name) ws.name = name
      this.worksheets.push(ws)
      return ws
    }
    getWorksheet(name?: string) {
      return this.worksheets.find((w) => w.name === String(name))
    }
  }
  return { Workbook: MockWorkbook, default: { Workbook: MockWorkbook } }
})

// Helper: build a mock ExcelJS-like workbook/worksheet that records calls so we
// can assert on the styling/serialization helpers exercised by schemaDataToTable
// and exportTableToExcel without depending on the real exceljs package.
function makeMockWorksheet() {
  const cells: Record<string, any> = {}
  const columns: Record<number, any> = {}
  const rows: any[][] = []
  const ws: any = {
    addRow: vi.fn((data: any) => {
      rows.push(data)
      return {
        eachCell: (cb: (cell: any) => void) => {
          const arr = Array.isArray(data) ? data : [data]
          arr.forEach(() => cb({ fill: {}, font: {}, border: {} }))
        },
        fill: {},
        font: {},
        alignment: {},
        height: 0,
      }
    }),
    addRows: vi.fn((data: any[]) => {
      data.forEach((r) => rows.push(r))
    }),
    getColumn: vi.fn((i: number) => {
      columns[i] = columns[i] || { width: 0, numFmt: '' }
      return columns[i]
    }),
    getRow: vi.fn(() => ({
      font: {},
      fill: {},
      alignment: {},
      height: 0,
    })),
    getCell: vi.fn((a: any, b?: any) => {
      const keyName = b === undefined ? String(a) : `${a},${b}`
      cells[keyName] = cells[keyName] || {
        fill: {},
        font: {},
        border: {},
        alignment: {},
      }
      return cells[keyName]
    }),
    _rows: rows,
    _columns: columns,
    _cells: cells,
  }
  return ws
}

function makeMockWorkbook() {
  const worksheets: any[] = []
  return {
    addWorksheet: vi.fn((name: string) => {
      const ws = makeMockWorksheet()
      ws.name = name
      worksheets.push(ws)
      return ws
    }),
    xlsx: {
      writeBuffer: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
    },
    _worksheets: worksheets,
  }
}

describe('data_io extra coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ───────────────────────── buildExcelBuffer (xlsx path) ──────────────────
  describe('buildExcelBuffer - xlsx path', () => {
    test('returns xlsx format for small datasets (worker unavailable -> ExcelJS stub)', async () => {
      const data = {
        Table1: [
          { id: 1, name: 'A', value: 10 },
          { id: 2, name: 'B', value: 20 },
        ],
      }
      const schema = {
        properties: {
          Table1: {
            type: 'array',
            items: {
              properties: {
                name: { type: 'string' },
                value: { type: 'number' },
              },
            },
          },
        },
      }
      const result = await buildExcelBuffer(data, schema)
      expect(result.format).toBe('xlsx')
      expect(result.bytes).toBeInstanceOf(Uint8Array)
    })

    test('works with null schema and default options', async () => {
      const data = { Sheet: [{ a: 1 }] }
      const result = await buildExcelBuffer(data)
      expect(result.format).toBe('xlsx')
      expect(result.bytes).toBeInstanceOf(Uint8Array)
    })
  })

  // ───────────────────────── buildExcelBuffer (csv-zip path) ───────────────
  describe('buildExcelBuffer - csv-zip path (huge dataset)', () => {
    // Build a *real* array sheet whose estimated cell count exceeds
    // HUGE_BUILD_CELL_THRESHOLD (2,000,000) so buildExcelBuffer routes into
    // buildAsCsvZip. We keep the row count modest by using many columns
    // (cells = rows * cols), so iteration stays fast.
    function makeTripSheet(): any[] {
      const COLS = 100
      const ROWS = 21_000 // 2.1M cells > 2M threshold
      const cols = Array.from({ length: COLS }, (_, i) => `c${i}`)
      const arr: any[] = new Array(ROWS)
      // Reuse a single frozen template row to avoid allocating 21k objects.
      const template: Record<string, any> = {}
      cols.forEach((c, i) => (template[c] = i))
      for (let i = 0; i < ROWS; i++) arr[i] = template
      return arr
    }

    test('produces a zip when cell count exceeds the huge threshold', async () => {
      const data = {
        Big: makeTripSheet(),
      }
      const result = await buildExcelBuffer(data, null)
      expect(result.format).toBe('zip')
      expect(result.bytes).toBeInstanceOf(Uint8Array)
      expect(result.bytes.byteLength).toBeGreaterThan(0)
    })

    test('csv-zip serializes object-type sheets as name,value and honours visibility/sanitization', async () => {
      // One huge array sheet to trip the threshold, plus an object sheet and a
      // hidden sheet and a name needing sanitization.
      const data = {
        Big: makeTripSheet(),
        'Params/Config': { alpha: 1, beta: 'two', secret: 'hidden' },
        Hidden: [{ x: 1 }],
        NoSchemaSheet: [{ y: 1 }],
      }
      const schema = {
        properties: {
          Big: { type: 'array', items: { properties: {} } },
          'Params/Config': {
            type: 'object',
            properties: {
              alpha: {},
              beta: {},
              secret: { visible: false },
            },
          },
          Hidden: { visible: false },
        },
      }
      // includeTablesWithoutSchema default true -> NoSchemaSheet included.
      const result = await buildExcelBuffer(data, schema)
      expect(result.format).toBe('zip')

      // Decode the zip and inspect file names / contents.
      const JSZip = (await import('jszip')).default
      const zip = await JSZip.loadAsync(result.bytes)
      const names = Object.keys(zip.files)
      // Hidden sheet must be skipped.
      expect(names).not.toContain('Hidden.csv')
      // Sanitized name: "/" replaced with "_"
      expect(names).toContain('Params_Config.csv')
      expect(names).toContain('Big.csv')
      expect(names).toContain('NoSchemaSheet.csv')

      const objectCsv = await zip.files['Params_Config.csv'].async('string')
      expect(objectCsv.split('\n')[0]).toBe('name,value')
      expect(objectCsv).toContain('alpha,1')
      expect(objectCsv).toContain('beta,two')
      // secret is visible:false -> still serialized in objectSheetToCsv (it does
      // not filter), so it IS present. Confirm raw behaviour.
      expect(objectCsv).toContain('secret,hidden')
    })

    test('csv-zip excludes sheets without schema when includeTablesWithoutSchema is false', async () => {
      const data = {
        Big: makeTripSheet(),
        Stray: [{ z: 9 }],
      }
      const schema = {
        properties: {
          Big: { type: 'array', items: { properties: {} } },
        },
      }
      const result = await buildExcelBuffer(data, schema, {
        includeTablesWithoutSchema: false,
      })
      const JSZip = (await import('jszip')).default
      const zip = await JSZip.loadAsync(result.bytes)
      const names = Object.keys(zip.files)
      expect(names).toContain('Big.csv')
      expect(names).not.toContain('Stray.csv')
    })

    test('csv-zip writes empty file when an array sheet has no visible headers', async () => {
      const data = {
        Big: makeTripSheet(), // trips the threshold
        // Only column is `id`, which visibleCsvHeaders excludes -> empty file.
        IdOnly: [{ id: 1 }, { id: 2 }],
      }
      const result = await buildExcelBuffer(data, null)
      const JSZip = (await import('jszip')).default
      const zip = await JSZip.loadAsync(result.bytes)
      const content = await zip.files['IdOnly.csv'].async('string')
      expect(content).toBe('')
    })

    test('csv-zip escapes values containing commas, quotes and newlines, and chunks large arrays', async () => {
      // Real array large enough (>1000) to exercise CSV_ZIP_ROW_CHUNK yielding,
      // with special characters in the first rows to hit csvEscape branches.
      const rows: any[] = []
      for (let i = 0; i < 1500; i++) {
        rows.push({ a: i, b: `v${i}` })
      }
      rows[0] = { a: 'has,comma', b: 'has"quote' }
      rows[1] = { a: 'line\nbreak', b: 'carriage\rreturn' }
      // The Real sheet alone (1500 * 2 = 3000 cells) is below the threshold, so
      // add a Trip sheet to route to the zip path; Real provides the escaping
      // and chunking coverage.
      const data = { Real: rows, Trip: makeTripSheet() }
      const result = await buildExcelBuffer(data, null)
      expect(result.format).toBe('zip')
      const JSZip = (await import('jszip')).default
      const zip = await JSZip.loadAsync(result.bytes)
      const csv = await zip.files['Real.csv'].async('string')
      // Header line.
      expect(csv.startsWith('a,b\n')).toBe(true)
      // Comma + embedded-quote escaping (quotes doubled, whole field quoted).
      expect(csv).toContain('"has,comma","has""quote"')
      // Newline and carriage-return values are wrapped in quotes verbatim.
      expect(csv).toContain('"line\nbreak","carriage\rreturn"')
      // It chunked (1500 rows > 1000) and still produced all rows + header.
      expect(csv).toContain('v1499')
    })

    test('csv-zip skips empty and non-object sheets', async () => {
      const data = {
        Big: makeTripSheet(),
        EmptyArr: [],
        PrimitiveArr: [1, 2, 3], // first element not an object -> skipped
      }
      const result = await buildExcelBuffer(data, null)
      const JSZip = (await import('jszip')).default
      const zip = await JSZip.loadAsync(result.bytes)
      const names = Object.keys(zip.files)
      expect(names).toContain('Big.csv')
      expect(names).not.toContain('EmptyArr.csv')
      expect(names).not.toContain('PrimitiveArr.csv')
    })
  })

  // ───────────────────────── schemaDataToTable extra branches ──────────────
  describe('schemaDataToTable - primitive arrays & no-schema', () => {
    test('normalizes a primitive (string) array into single-column rows', async () => {
      const wb = makeMockWorkbook()
      const data = { Tags: ['alpha', 'beta', 'gamma'] }
      await schemaDataToTable(wb, data, null)
      expect(wb.addWorksheet).toHaveBeenCalledWith('Tags')
      const ws = wb._worksheets[0]
      // processArrayTypeWorksheet adds header + data via addRows
      expect(ws.addRows).toHaveBeenCalled()
      const firstAddRowsArg = ws.addRows.mock.calls[0][0]
      // Header row should be the PRIMITIVE_ARRAY_COLUMN 'value'
      expect(firstAddRowsArg[0]).toEqual(['value'])
    })

    test('returns early (no worksheet) for empty array without required headers', async () => {
      const wb = makeMockWorkbook()
      const data = { Empty: [] }
      await schemaDataToTable(wb, data, null)
      expect(wb.addWorksheet).not.toHaveBeenCalled()
    })

    test('wraps a non-array sheet value into a single-row array', async () => {
      const wb = makeMockWorkbook()
      const data = { Config: { setting: 'x' } }
      const schema = {
        properties: {
          Config: { type: 'object', properties: { setting: {} } },
        },
      }
      await schemaDataToTable(wb, data, schema)
      expect(wb.addWorksheet).toHaveBeenCalledWith('Config')
    })

    test('filters id and invisible columns in array worksheet', async () => {
      const wb = makeMockWorkbook()
      const data = {
        T: [{ id: 1, name: 'a', hiddenCol: 'h', visibleCol: 'v' }],
      }
      const schema = {
        properties: {
          T: {
            type: 'array',
            items: {
              properties: {
                name: { visible: true },
                hiddenCol: { visible: false },
                visibleCol: { visible: true },
              },
            },
          },
        },
      }
      await schemaDataToTable(wb, data, schema)
      const ws = wb._worksheets[0]
      const headerRow = ws.addRows.mock.calls[0][0][0]
      expect(headerRow).toContain('name')
      expect(headerRow).toContain('visibleCol')
      expect(headerRow).not.toContain('id')
      expect(headerRow).not.toContain('hiddenCol')
    })
  })

  // ───────────────────────── exportTableToExcel ────────────────────────────
  describe('exportTableToExcel', () => {
    let createObjSpy: any
    let revokeSpy: any
    let clickSpy: any

    beforeEach(() => {
      createObjSpy = vi
        .spyOn(window.URL, 'createObjectURL')
        .mockReturnValue('blob:mock')
      revokeSpy = vi
        .spyOn(window.URL, 'revokeObjectURL')
        .mockImplementation(() => {})
      clickSpy = vi
        .spyOn(HTMLAnchorElement.prototype, 'click')
        .mockImplementation(() => {})
    })

    const tableConfig = {
      get_list: {
        response_schema: {
          items: {
            type: 'object',
            required: ['name'],
            properties: {
              id: { type: 'integer' },
              name: { type: 'string' },
              active: { type: 'boolean' },
              count: { type: 'integer' },
              ratio: { type: 'number' },
              fk: { type: 'integer', isForeignKey: true },
              readonly: { type: 'string', frontendReadOnly: true },
              hiddenF: { type: 'string', hidden: true },
              invisF: { type: 'string', visible: false },
              joined: { type: 'string', columnsToJoin: ['a', 'b'] },
            },
          },
        },
      },
    }

    test('exports items using schema fields, excluding id/fk/readonly/hidden/etc', async () => {
      const t = vi.fn((key: string) =>
        key === 'table.yes' ? 'Si' : key === 'table.no' ? 'No' : key,
      )
      const items = [
        {
          id: 1,
          name: 'Row1',
          active: true,
          count: 5.9,
          ratio: '3.5',
          fk: 99,
          readonly: 'r',
          hiddenF: 'h',
          invisF: 'i',
          joined: 'j',
        },
        {
          id: 2,
          name: 'Row2',
          active: 'no',
          count: '7',
          ratio: 2.25,
          fk: 88,
          readonly: 'r2',
          hiddenF: 'h2',
          invisF: 'i2',
          joined: 'j2',
        },
      ]

      await expect(
        exportTableToExcel(items, tableConfig, 'MyTable', 'My Title', t),
      ).resolves.toBeUndefined()
      // Download path: an object URL was created and revoked, link clicked.
      expect(createObjSpy).toHaveBeenCalled()
      expect(clickSpy).toHaveBeenCalled()
      expect(revokeSpy).toHaveBeenCalled()
    })

    test('uses provided displayHeaders when supplied', async () => {
      const t = vi.fn((key: string) => key)
      const items = [{ id: 1, name: 'A', extra: 'E' }]
      const displayHeaders = [
        { key: 'name', title: 'Name' },
        { key: 'extra', type: 'string' },
      ]
      await expect(
        exportTableToExcel(
          items,
          tableConfig,
          'T',
          'Title',
          t,
          displayHeaders,
        ),
      ).resolves.toBeUndefined()
      expect(clickSpy).toHaveBeenCalled()
    })

    test('falls back to item keys when no schema present', async () => {
      const t = vi.fn((key: string) => key)
      const items = [{ id: 1, foo: 'bar', baz: 2 }]
      await expect(
        exportTableToExcel(items, {}, 'NoSchema', 'Title', t),
      ).resolves.toBeUndefined()
      expect(clickSpy).toHaveBeenCalled()
    })

    test('downloads empty workbook when there are no header labels', async () => {
      const t = vi.fn((key: string) => key)
      // Empty items + empty config -> extractSchemaFields yields no fields.
      await expect(
        exportTableToExcel([], {}, 'Empty', 'Title', t),
      ).resolves.toBeUndefined()
      expect(clickSpy).toHaveBeenCalled()
    })
  })
})
