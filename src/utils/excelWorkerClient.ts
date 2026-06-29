/**
 * Singleton client for `src/workers/excelWorker.ts`.
 *
 * - Lazily spawns one shared Worker on first use.
 * - Multiplexes requests by numeric `id` (one worker handles all concurrent calls).
 * - Falls back to running the same operation on the main thread when `Worker` is
 *   unavailable (SSR, jsdom in unit tests, very old browsers). Callers keep the
 *   same async API in both cases.
 */

type WorkerResponse =
  | { id: number; ok: true; result: any }
  | { id: number; ok: false; error: string }

let workerInstance: Worker | null = null
let workerUnavailable = false
let nextRequestId = 1
const pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>()

function isWorkerEnvironment(): boolean {
  return typeof Worker !== 'undefined' && globalThis.window !== undefined
}

function getWorker(): Worker | null {
  if (workerUnavailable) return null
  if (workerInstance) return workerInstance
  if (!isWorkerEnvironment()) {
    workerUnavailable = true
    return null
  }
  try {
    // Vite resolves this URL at build time and emits a dedicated worker chunk.
    workerInstance = new Worker(
      new URL('../workers/excelWorker.ts', import.meta.url),
      { type: 'module' },
    )
    workerInstance.addEventListener('message', (event: MessageEvent<WorkerResponse>) => {
      const { id } = event.data
      const slot = pending.get(id)
      if (!slot) return
      pending.delete(id)
      if (event.data.ok) slot.resolve(event.data.result)
      else slot.reject(new Error(event.data.error))
    })
    workerInstance.addEventListener('error', (e) => {
      // Reject all pending requests; the next call will try to respawn.
      const err = new Error(e.message || 'Excel worker error')
      for (const [id, slot] of pending) {
        pending.delete(id)
        slot.reject(err)
      }
      workerInstance?.terminate()
      workerInstance = null
    })
    return workerInstance
  } catch {
    workerUnavailable = true
    return null
  }
}

function callWorker<T>(
  worker: Worker,
  message: { id: number; type: string; payload: any },
  transfer: Transferable[] = [],
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    pending.set(message.id, { resolve, reject })
    try {
      worker.postMessage(message, transfer)
    } catch (err) {
      // postMessage throws synchronously on DataCloneError — drop the pending
      // slot so the caller can retry with a sanitised payload under a new id.
      pending.delete(message.id)
      reject(err as Error)
    }
  })
}

async function toArrayBuffer(input: File | Blob | ArrayBuffer): Promise<ArrayBuffer> {
  if (input instanceof ArrayBuffer) return input
  return await input.arrayBuffer()
}

/**
 * Strip Vue/Pinia reactive Proxies, Symbols, functions and class instances by
 * round-tripping through JSON. Required for `postMessage` payloads — the
 * structured-clone algorithm rejects those with `DataCloneError: # could not
 * be cloned`. Safe for JSON-schema documents (always plain data) and for
 * instance/solution `data` payloads that came from API responses.
 */
function toCloneable<T>(value: T): T {
  if (value === null || value === undefined) return value
  return JSON.parse(JSON.stringify(value))
}

/** Cheap check used to decide whether to retry with a JSON-cloned payload. */
function isStructuredCloneError(err: unknown): boolean {
  const e = err as { name?: string; message?: string } | null
  if (!e) return false
  if (e.name === 'DataCloneError') return true
  return /could not be cloned|DataCloneError/.test(e.message ?? '')
}

/**
 * Parse an Excel file into a `{ sheetName: rows[] | object }` dict using the
 * configured worker. Returns `null` when the worker is unavailable so callers
 * can fall back to their existing main-thread path.
 */
export async function parseExcelInWorker(
  file: File | Blob | ArrayBuffer,
  schema: { properties: Record<string, any>; required?: string[] },
): Promise<Record<string, any> | null> {
  const worker = getWorker()
  if (!worker) return null
  const buffer = await toArrayBuffer(file)
  // Schemas are usually small (a few KB) but routinely come from Pinia state,
  // i.e. Vue reactive Proxies. Round-trip through JSON so `postMessage` can
  // structured-clone them.
  const cloneableSchema = toCloneable(schema)
  const id = nextRequestId++
  return callWorker<Record<string, any>>(
    worker,
    { id, type: 'parse', payload: { buffer, schema: cloneableSchema } },
    [buffer],
  )
}

/**
 * Build an xlsx file (raw bytes) from an instance/solution `data` dict using
 * the configured worker. Returns `null` when the worker is unavailable.
 */
export async function buildExcelBufferInWorker(
  data: Record<string, any>,
  schema: Record<string, any> | null,
  options: { includeTablesWithoutSchema?: boolean } = {},
): Promise<Uint8Array | null> {
  const worker = getWorker()
  if (!worker) return null
  const id = nextRequestId++
  const cloneableSchema = schema ? toCloneable(schema) : null
  const message = {
    id,
    type: 'build',
    payload: { data, schema: cloneableSchema, options },
  }
  try {
    return await callWorker<Uint8Array>(worker, message)
  } catch (err) {
    if (!isStructuredCloneError(err)) throw err
    // Fallback: `data` itself is non-cloneable (e.g. Vue reactive Proxy with
    // class instances inside). Round-trip the whole payload through JSON. This
    // doubles peak memory but is the only way to recover for callers that
    // pass reactive state directly.
    const retryId = nextRequestId++
    const safe = {
      id: retryId,
      type: 'build',
      payload: toCloneable(message.payload),
    }
    return await callWorker<Uint8Array>(worker, safe)
  }
}
