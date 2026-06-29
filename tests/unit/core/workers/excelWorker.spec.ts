import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Tests for src/workers/excelWorker.ts
 *
 * The module is a module Web Worker: it registers `self.addEventListener('message', ...)`
 * and uses `export {}`. None of its functions are exported, so we exercise it the way the
 * runtime does: capture the registered `message` handler, then dispatch synthetic
 * MessageEvents with `{ id, type, payload }` and assert on the captured `self.postMessage`
 * calls.
 *
 * `exceljs` is aliased to a stub in vitest.config.ts; here we override it per-test with
 * vi.mock so we can drive both the success and the failure (SheetJS fallback) paths.
 * `xlsx` is lazy-loaded via dynamic import, so we mock the 'xlsx' module too.
 */

// ---- Mock state shared with the factories below (must be hoisted-safe) ----
const mockState = vi.hoisted(() => {
  return {
    // ExcelJS
    excelLoadImpl: vi.fn(),
    excelWriteBufferImpl: vi.fn(),
    excelWorksheets: [] as any[],
    addedWorksheets: [] as any[],
    // XLSX
    xlsxReadImpl: vi.fn(),
    xlsxWriteImpl: vi.fn(),
    sheetToJsonImpl: vi.fn(),
  }
})

vi.mock('exceljs', () => {
  class Workbook {
    xlsx = {
      load: (buf: ArrayBuffer) => mockState.excelLoadImpl(buf),
      writeBuffer: () => mockState.excelWriteBufferImpl(),
    }
    get worksheets() {
      return mockState.excelWorksheets
    }
    addWorksheet(name: string) {
      const ws = makeStubWorksheet(name)
      mockState.addedWorksheets.push(ws)
      return ws
    }
  }
  return { Workbook }
})

vi.mock('xlsx', () => {
  return {
    read: (...args: any[]) => mockState.xlsxReadImpl(...args),
    write: (...args: any[]) => mockState.xlsxWriteImpl(...args),
    utils: {
      book_new: () => ({ SheetNames: [], Sheets: {} }),
      book_append_sheet: (wb: any, ws: any, name: string) => {
        wb.SheetNames.push(name)
        wb.Sheets[name] = ws
      },
      aoa_to_sheet: (aoa: any[][]) => ({ __aoa: aoa }),
      sheet_to_json: (...args: any[]) => mockState.sheetToJsonImpl(...args),
    },
  }
})

function makeStubWorksheet(name: string) {
  const rows: any[] = []
  const cells: Record<string, any> = {}
  const columns: Record<number, any> = {}
  return {
    name,
    _rows: rows,
    _cells: cells,
    addRow(values: any[]) {
      const row = {
        values,
        eachCell: (cb: (cell: any) => void) => {
          values.forEach(() => cb({}))
        },
      }
      rows.push(row)
      return row
    },
    addRows(arr: any[]) {
      arr.forEach((v) => rows.push({ values: v, eachCell: () => {} }))
    },
    getColumn(i: number) {
      columns[i] = columns[i] ?? { width: 0 }
      return columns[i]
    },
    getRow(_i: number) {
      return { eachCell: (cb: (cell: any) => void) => cb({}) }
    },
    getCell(_a: any, _b?: any) {
      const key = String(_a) + String(_b ?? '')
      cells[key] = cells[key] ?? {}
      return cells[key]
    },
    eachRow(cb: (row: any) => void) {
      rows.forEach((r) => cb(r))
    },
  }
}

// ---- self stub: capture handler + posted messages ----
let messageHandler: ((e: MessageEvent) => void) | null = null
let posted: any[] = []

async function loadWorker() {
  vi.resetModules()
  await import('@/workers/excelWorker')
}

function dispatch(data: any, origin = '') {
  if (!messageHandler) throw new Error('no message handler registered')
  // synthetic MessageEvent-like object
  return messageHandler({ data, origin } as MessageEvent)
}

// Resolve once all microtasks settle so async handler completes.
async function flush() {
  await new Promise((r) => setTimeout(r, 0))
}

describe('excelWorker', () => {
  beforeEach(() => {
    messageHandler = null
    posted = []
    mockState.excelWorksheets = []
    mockState.addedWorksheets = []
    mockState.excelLoadImpl.mockReset()
    mockState.excelWriteBufferImpl.mockReset()
    mockState.xlsxReadImpl.mockReset()
    mockState.xlsxWriteImpl.mockReset()
    mockState.sheetToJsonImpl.mockReset()

    // Stub self.addEventListener / postMessage / location before importing the worker.
    vi.stubGlobal('self', {
      addEventListener: (type: string, cb: any) => {
        if (type === 'message') messageHandler = cb
      },
      postMessage: (msg: any, _transfer?: any[]) => {
        posted.push(msg)
      },
      location: { origin: 'https://app.test' },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('registers a message listener on import', async () => {
    await loadWorker()
    expect(messageHandler).toBeTypeOf('function')
  })

  describe('origin guard', () => {
    it('ignores cross-origin messages', async () => {
      await loadWorker()
      mockState.excelLoadImpl.mockResolvedValue(undefined)
      dispatch(
        { id: 1, type: 'parse', payload: { buffer: new ArrayBuffer(8), schema: {} } },
        'https://evil.example.com',
      )
      await flush()
      expect(posted).toHaveLength(0)
    })

    it('accepts same-origin messages', async () => {
      await loadWorker()
      mockState.excelLoadImpl.mockResolvedValue(undefined)
      mockState.excelWorksheets = []
      dispatch(
        { id: 2, type: 'parse', payload: { buffer: new ArrayBuffer(8), schema: {} } },
        'https://app.test',
      )
      await flush()
      expect(posted).toHaveLength(1)
      expect(posted[0]).toMatchObject({ id: 2, ok: true })
    })

    it('accepts empty-origin (dedicated worker) messages', async () => {
      await loadWorker()
      mockState.excelLoadImpl.mockResolvedValue(undefined)
      dispatch(
        { id: 3, type: 'parse', payload: { buffer: new ArrayBuffer(8), schema: {} } },
        '',
      )
      await flush()
      expect(posted).toHaveLength(1)
      expect(posted[0]).toMatchObject({ id: 3, ok: true })
    })
  })

  describe('parse via ExcelJS', () => {
    it('parses array-type sheet into records and formats values', async () => {
      await loadWorker()
      mockState.excelLoadImpl.mockResolvedValue(undefined)
      // ExcelJS row.values is 1-indexed (index 0 is undefined); worker slices(1).
      const ws = {
        name: 'Trades',
        eachRow(cb: (row: any) => void) {
          cb({ values: [undefined, 'col1', 'col2'] }) // header
          cb({ values: [undefined, 1.23456, new Date(Date.UTC(2020, 0, 15))] })
          cb({ values: [undefined, NaN, 'plain'] })
        },
      }
      mockState.excelWorksheets = [ws]

      const schema = {
        properties: {
          Trades: {
            type: 'array',
            items: { properties: { col2: { format: 'date' } } },
          },
        },
      }
      dispatch({ id: 10, type: 'parse', payload: { buffer: new ArrayBuffer(8), schema } })
      await flush()

      expect(posted).toHaveLength(1)
      expect(posted[0].ok).toBe(true)
      const trades = posted[0].result.Trades
      expect(trades).toHaveLength(2)
      // 1.23456 rounded to 4 decimals
      expect(trades[0].col1).toBe(1.2346)
      // Date formatted as date (col2 declared format: 'date')
      expect(trades[0].col2).toBe('2020-01-15')
      // NaN -> null
      expect(trades[1].col1).toBeNull()
      expect(trades[1].col2).toBe('plain')
    })

    it('parses object-type sheet as key/value map', async () => {
      await loadWorker()
      mockState.excelLoadImpl.mockResolvedValue(undefined)
      const ws = {
        name: 'Params',
        eachRow(cb: (row: any) => void) {
          cb({ values: [undefined, 'horizon', 12] })
          cb({ values: [undefined, 'rate', 0.5] })
        },
      }
      mockState.excelWorksheets = [ws]
      const schema = { properties: { Params: { type: 'object', properties: {} } } }
      dispatch({ id: 11, type: 'parse', payload: { buffer: new ArrayBuffer(8), schema } })
      await flush()

      expect(posted[0].ok).toBe(true)
      expect(posted[0].result.Params).toEqual({ horizon: 12, rate: 0.5 })
    })
  })

  describe('parse fallback to SheetJS', () => {
    it('falls back to SheetJS when ExcelJS throws a structural error', async () => {
      await loadWorker()
      mockState.excelLoadImpl.mockRejectedValue(new Error('Cannot set sheetNo'))
      mockState.xlsxReadImpl.mockReturnValue({
        SheetNames: ['Data'],
        Sheets: { Data: {} },
      })
      mockState.sheetToJsonImpl.mockReturnValue([
        ['a', 'b'],
        [1, 2],
      ])
      const schema = { properties: { Data: { type: 'array', items: { properties: {} } } } }
      dispatch({ id: 20, type: 'parse', payload: { buffer: new ArrayBuffer(8), schema } })
      await flush()

      expect(mockState.xlsxReadImpl).toHaveBeenCalled()
      expect(posted[0].ok).toBe(true)
      expect(posted[0].result.Data).toEqual([{ a: 1, b: 2 }])
    })

    it('does NOT fall back when ExcelJS reports a missing sheet (propagates error)', async () => {
      await loadWorker()
      mockState.excelLoadImpl.mockRejectedValue(new Error('Sheet "Trades" not found'))
      dispatch({ id: 21, type: 'parse', payload: { buffer: new ArrayBuffer(8), schema: {} } })
      await flush()

      expect(mockState.xlsxReadImpl).not.toHaveBeenCalled()
      expect(posted[0]).toMatchObject({ id: 21, ok: false })
      expect(posted[0].error).toMatch(/not found/)
    })

    it('reports an error when both ExcelJS and SheetJS fail', async () => {
      await loadWorker()
      mockState.excelLoadImpl.mockRejectedValue(new Error('structural'))
      mockState.xlsxReadImpl.mockImplementation(() => {
        throw new Error('sheetjs boom')
      })
      dispatch({ id: 22, type: 'parse', payload: { buffer: new ArrayBuffer(8), schema: {} } })
      await flush()

      expect(posted[0]).toMatchObject({ id: 22, ok: false })
      expect(posted[0].error).toBe('sheetjs boom')
    })
  })

  describe('build via ExcelJS (small dataset)', () => {
    it('builds an array-type worksheet and posts a Uint8Array result', async () => {
      await loadWorker()
      mockState.excelWriteBufferImpl.mockResolvedValue(new Uint8Array([1, 2, 3]).buffer)

      const data = { Trades: [{ id: 1, a: 10, b: 20 }] }
      const schema = {
        properties: {
          Trades: { type: 'array', items: { properties: { a: {}, b: {} } } },
        },
      }
      dispatch({ id: 30, type: 'build', payload: { data, schema } })
      await flush()

      expect(posted[0].ok).toBe(true)
      expect(posted[0].result).toBeInstanceOf(Uint8Array)
      expect(mockState.addedWorksheets).toHaveLength(1)
      expect(mockState.addedWorksheets[0].name).toBe('Trades')
    })

    it('builds an object-type worksheet (name/value layout)', async () => {
      await loadWorker()
      mockState.excelWriteBufferImpl.mockResolvedValue(new Uint8Array([9]).buffer)

      const data = { Params: { horizon: 12, rate: 0.5 } }
      const schema = { properties: { Params: { type: 'object', properties: {} } } }
      dispatch({ id: 31, type: 'build', payload: { data, schema } })
      await flush()

      expect(posted[0].ok).toBe(true)
      expect(posted[0].result).toBeInstanceOf(Uint8Array)
      expect(mockState.addedWorksheets[0].name).toBe('Params')
    })

    it('skips a sheet with visible:false', async () => {
      await loadWorker()
      mockState.excelWriteBufferImpl.mockResolvedValue(new Uint8Array([0]).buffer)
      const data = { Hidden: [{ id: 1, x: 1 }], Shown: [{ id: 2, y: 2 }] }
      const schema = {
        properties: {
          Hidden: { type: 'array', visible: false, items: { properties: {} } },
          Shown: { type: 'array', items: { properties: {} } },
        },
      }
      dispatch({ id: 32, type: 'build', payload: { data, schema } })
      await flush()

      expect(posted[0].ok).toBe(true)
      const names = mockState.addedWorksheets.map((w) => w.name)
      expect(names).toEqual(['Shown'])
    })
  })

  describe('build via SheetJS (large dataset over threshold)', () => {
    it('uses SheetJS when estimated cell count exceeds the threshold', async () => {
      await loadWorker()
      mockState.xlsxWriteImpl.mockReturnValue(new Uint8Array([5, 6, 7]))

      // 200_001 cells: one column, > LARGE_BUILD_CELL_THRESHOLD (200_000).
      const rows = new Array(200_001).fill(0).map((_, i) => ({ v: i }))
      const data = { Big: rows }
      const schema = {
        properties: { Big: { type: 'array', items: { properties: { v: {} } } } },
      }
      dispatch({ id: 40, type: 'build', payload: { data, schema } })
      await flush()

      expect(mockState.xlsxWriteImpl).toHaveBeenCalled()
      expect(posted[0].ok).toBe(true)
      expect(posted[0].result).toBeInstanceOf(Uint8Array)
      // ExcelJS path must NOT have been used.
      expect(mockState.addedWorksheets).toHaveLength(0)
    })

    it('falls back to ExcelJS when SheetJS build throws', async () => {
      await loadWorker()
      mockState.xlsxWriteImpl.mockImplementation(() => {
        throw new Error('sheetjs write boom')
      })
      mockState.excelWriteBufferImpl.mockResolvedValue(new Uint8Array([1]).buffer)
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const rows = new Array(200_001).fill(0).map((_, i) => ({ v: i }))
      const data = { Big: rows }
      const schema = {
        properties: { Big: { type: 'array', items: { properties: { v: {} } } } },
      }
      dispatch({ id: 41, type: 'build', payload: { data, schema } })
      await flush()

      expect(posted[0].ok).toBe(true)
      expect(mockState.addedWorksheets.length).toBeGreaterThan(0)
      errSpy.mockRestore()
    })
  })

  describe('dispatch errors / unknown types', () => {
    it('responds with ok:false for unknown message types', async () => {
      await loadWorker()
      dispatch({ id: 50, type: 'frobnicate', payload: {} })
      await flush()
      expect(posted[0]).toMatchObject({ id: 50, ok: false })
      expect(posted[0].error).toMatch(/Unknown message type: frobnicate/)
    })

    it('responds with ok:false when parse throws a generic error', async () => {
      await loadWorker()
      mockState.excelLoadImpl.mockRejectedValue(new Error('structural'))
      mockState.xlsxReadImpl.mockImplementation(() => {
        throw 'string-error'
      })
      dispatch({ id: 51, type: 'parse', payload: { buffer: new ArrayBuffer(8), schema: {} } })
      await flush()
      expect(posted[0]).toMatchObject({ id: 51, ok: false })
      expect(posted[0].error).toBe('string-error')
    })
  })
})
