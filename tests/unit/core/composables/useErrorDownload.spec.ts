import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'

// Richer ExcelJS fake than the global stub: rows expose getCell, columns are settable.
vi.mock('exceljs', () => {
  class FakeWorksheet {
    name = 'Sheet1'
    rows: any[] = []
    columns: Record<number, any> = {}
    addRow(values: any) {
      const row: any = { values, getCell: vi.fn(() => ({})) }
      this.rows.push(row)
      return row
    }
    getColumn(i: number) {
      this.columns[i] = this.columns[i] || {}
      return this.columns[i]
    }
  }
  class FakeWorkbook {
    worksheets: FakeWorksheet[] = []
    xlsx = { writeBuffer: vi.fn(async () => new ArrayBuffer(8)) }
    addWorksheet(name?: string) {
      const ws = new FakeWorksheet()
      if (name) ws.name = name
      this.worksheets.push(ws)
      return ws
    }
  }
  return { Workbook: FakeWorkbook, default: { Workbook: FakeWorkbook } }
})

import { useErrorDownload } from '@/composables/useErrorDownload'

const mkError = (i: number): any => ({
  instancePath: `/row/${i}`,
  message: `msg ${i}`,
  keyword: 'required',
  params: { missingProperty: `p${i}` },
  schemaPath: '#/required',
})

beforeEach(() => {
  window.URL.createObjectURL = vi.fn(() => 'blob:fake')
  window.URL.revokeObjectURL = vi.fn()
  // jsdom anchors navigate on click; neutralize it.
  HTMLAnchorElement.prototype.click = vi.fn()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('useErrorDownload - configuration', () => {
  test('exposes defaults and honors overrides', () => {
    const def = useErrorDownload()
    expect(def.DISPLAY_ERROR_LIMIT).toBe(150)
    expect(def.MAX_DOWNLOAD_ERRORS).toBe(50000)
    expect(def.DOWNLOAD_BUTTON_ID).toBe('download-errors-btn')

    const custom = useErrorDownload({ maxErrors: 5, displayLimit: 2, buttonId: 'x' })
    expect(custom.MAX_DOWNLOAD_ERRORS).toBe(5)
    expect(custom.DISPLAY_ERROR_LIMIT).toBe(2)
    expect(custom.DOWNLOAD_BUTTON_ID).toBe('x')
  })
})

describe('useErrorDownload - createErrorWorkbook', () => {
  test('builds a workbook with header, summary, error rows', () => {
    const { createErrorWorkbook } = useErrorDownload()
    const wb: any = createErrorWorkbook([mkError(1), mkError(2)])
    const ws = wb.worksheets[0]
    // header + summary + spacer + 2 error rows = 5
    expect(ws.rows.length).toBe(5)
    expect(ws.name).toBe('Validation Errors')
    // column widths configured for 6 columns
    expect(ws.getColumn(1).width).toBe(10)
  })

  test('adds the truncation note when errors exceed maxErrors', () => {
    const { createErrorWorkbook } = useErrorDownload({ maxErrors: 1 })
    const wb: any = createErrorWorkbook([mkError(1), mkError(2), mkError(3)])
    const ws = wb.worksheets[0]
    // header + summary + spacer + 1 error row + remaining-note = 5
    expect(ws.rows.length).toBe(5)
    const note = ws.rows[ws.rows.length - 1]
    expect(note.values[0]).toContain('and 2 more errors')
  })

  test('formats empty params as an empty string', () => {
    const { createErrorWorkbook } = useErrorDownload()
    const wb: any = createErrorWorkbook([{ message: 'm', params: {} } as any])
    const ws = wb.worksheets[0]
    const errorRow = ws.rows[ws.rows.length - 1]
    expect(errorRow.values[4]).toBe('') // params column
  })
})

describe('useErrorDownload - downloadErrorsFile', () => {
  test('throws and calls onError when there are no errors', async () => {
    const { downloadErrorsFile } = useErrorDownload()
    const onError = vi.fn()
    await expect(downloadErrorsFile([], undefined, onError)).rejects.toThrow('No errors to download')
    expect(onError).toHaveBeenCalled()
  })

  test('writes a blob and calls onSuccess on the happy path', async () => {
    vi.useFakeTimers()
    const { downloadErrorsFile } = useErrorDownload()
    const onSuccess = vi.fn()
    await downloadErrorsFile([mkError(1)], onSuccess)
    expect(onSuccess).toHaveBeenCalled()
    expect(window.URL.createObjectURL).toHaveBeenCalled()
    // run the cleanup timeout (revokeObjectURL + DOM removal)
    vi.runAllTimers()
    expect(window.URL.revokeObjectURL).toHaveBeenCalled()
  })

  test('propagates and reports workbook write failures', async () => {
    const { downloadErrorsFile } = useErrorDownload()
    const onError = vi.fn()
    // make Blob construction explode to trigger the catch branch
    const orig = global.Blob
    // @ts-expect-error override for test
    global.Blob = vi.fn(() => { throw new Error('blob-boom') })
    await expect(downloadErrorsFile([mkError(1)], undefined, onError)).rejects.toThrow('blob-boom')
    expect(onError).toHaveBeenCalled()
    global.Blob = orig
  })
})

describe('useErrorDownload - download button wiring & handler', () => {
  test('setup/cleanup attach and detach the click listener', async () => {
    const { setupDownloadButton, cleanupDownloadButton } = useErrorDownload({ buttonId: 'btn-1' })
    const btn = document.createElement('button')
    btn.id = 'btn-1'
    document.body.appendChild(btn)

    const handler = vi.fn()
    setupDownloadButton(handler)
    await Promise.resolve() // flush nextTick
    btn.click()
    expect(handler).toHaveBeenCalledTimes(1)

    cleanupDownloadButton(handler)
    btn.click()
    expect(handler).toHaveBeenCalledTimes(1) // not called again

    document.body.removeChild(btn)
  })

  test('createDownloadHandler short-circuits on empty errors', async () => {
    const { createDownloadHandler } = useErrorDownload()
    const onError = vi.fn()
    const handler = createDownloadHandler(() => null, undefined, onError)
    const evt = { preventDefault: vi.fn(), stopPropagation: vi.fn() } as any
    await handler(evt)
    expect(evt.preventDefault).toHaveBeenCalled()
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'No errors to download' }))
  })

  test('createDownloadHandler downloads when errors are present', async () => {
    vi.useFakeTimers()
    const { createDownloadHandler } = useErrorDownload()
    const onSuccess = vi.fn()
    const handler = createDownloadHandler(() => [mkError(1)], onSuccess)
    await handler()
    expect(onSuccess).toHaveBeenCalled()
  })
})
