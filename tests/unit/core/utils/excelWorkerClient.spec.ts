import { describe, test, expect, vi, afterEach } from 'vitest'

class FakeWorker {
  static instances: FakeWorker[] = []
  listeners: Record<string, ((ev: any) => void)[]> = {}
  postMessage = vi.fn()
  terminate = vi.fn()
  constructor(_url: unknown, _opts?: unknown) {
    FakeWorker.instances.push(this)
  }
  addEventListener(type: string, cb: (ev: any) => void) {
    ;(this.listeners[type] ||= []).push(cb)
  }
  emit(type: string, ev: any) {
    ;(this.listeners[type] || []).forEach((cb) => cb(ev))
  }
}

const flush = () => new Promise((r) => setTimeout(r, 0))
const lastWorker = () => FakeWorker.instances[FakeWorker.instances.length - 1]
const lastSent = (w: FakeWorker) => w.postMessage.mock.calls[w.postMessage.mock.calls.length - 1][0]

async function freshModule() {
  vi.resetModules()
  return await import('@/utils/excelWorkerClient')
}

afterEach(() => {
  FakeWorker.instances = []
  vi.unstubAllGlobals()
})

describe('excelWorkerClient - no Worker environment', () => {
  test('parse/build return null so callers fall back to the main thread', async () => {
    vi.stubGlobal('Worker', undefined)
    const m = await freshModule()
    expect(await m.parseExcelInWorker(new ArrayBuffer(8), { properties: {} })).toBeNull()
    expect(await m.buildExcelBufferInWorker({}, null)).toBeNull()
  })
})

describe('excelWorkerClient - with a worker', () => {
  test('parseExcelInWorker posts a parse message and resolves the result', async () => {
    vi.stubGlobal('Worker', FakeWorker as any)
    const m = await freshModule()

    const p = m.parseExcelInWorker(new ArrayBuffer(8), { properties: { a: {} } })
    await flush()
    const w = lastWorker()
    const sent = lastSent(w)
    expect(sent.type).toBe('parse')
    w.emit('message', { data: { id: sent.id, ok: true, result: { Sheet1: [] } } })
    await expect(p).resolves.toEqual({ Sheet1: [] })
  })

  test('rejects when the worker reports an error', async () => {
    vi.stubGlobal('Worker', FakeWorker as any)
    const m = await freshModule()

    const p = m.buildExcelBufferInWorker({ t: [] }, { properties: {} })
    await flush()
    const w = lastWorker()
    const sent = lastSent(w)
    expect(sent.type).toBe('build')
    w.emit('message', { data: { id: sent.id, ok: false, error: 'build failed' } })
    await expect(p).rejects.toThrow('build failed')
  })

  test('build retries with a JSON-cloned payload on DataCloneError', async () => {
    // Worker whose first postMessage throws a structured-clone error, then succeeds.
    class RetryWorker extends FakeWorker {
      constructor(url: unknown, opts?: unknown) {
        super(url, opts)
        let first = true
        this.postMessage = vi.fn(() => {
          if (first) {
            first = false
            const e: any = new Error('# could not be cloned')
            e.name = 'DataCloneError'
            throw e
          }
        })
      }
    }
    vi.stubGlobal('Worker', RetryWorker as any)
    const m = await freshModule()

    const p = m.buildExcelBufferInWorker({ t: [] }, { properties: {} })
    await flush()
    const w = lastWorker()
    // two posts: the first threw, the second (retry, JSON-cloned) is pending
    expect(w.postMessage).toHaveBeenCalledTimes(2)
    const retrySent = lastSent(w)
    w.emit('message', { data: { id: retrySent.id, ok: true, result: new Uint8Array([1, 2]) } })
    await expect(p).resolves.toEqual(new Uint8Array([1, 2]))
  })

  test('terminates and rejects pending requests on worker error event', async () => {
    vi.stubGlobal('Worker', FakeWorker as any)
    const m = await freshModule()

    const p = m.parseExcelInWorker(new ArrayBuffer(8), { properties: {} })
    await flush()
    const w = lastWorker()
    w.emit('error', { message: 'worker crashed' })
    await expect(p).rejects.toThrow('worker crashed')
    expect(w.terminate).toHaveBeenCalled()
  })
})
