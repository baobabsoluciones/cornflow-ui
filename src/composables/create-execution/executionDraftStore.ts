/**
 * Where an unfinished new execution is kept when the user leaves with "Save draft and leave",
 * so it can be picked up again on coming back. It lives in the browser (IndexedDB): instances can
 * be far larger than what localStorage holds, and files and data clone into it as they are.
 *
 * One draft per DAG and user. Every call fails soft: without IndexedDB (private windows, blocked
 * site data) there is simply no draft.
 */

const DB_NAME = 'cornflow-ui'
const STORE = 'execution-drafts'
const VERSION = 1

export interface ExecutionDraft {
  savedAt: string
  name: string
  description: string
  config: Record<string, any>
  /** Instance data as it was on screen (with the row ids the edits refer to), or null. */
  instanceData: Record<string, any> | null
  /** Files picked and not loaded yet. */
  files: File[]
  loadedFileNames: string[]
  loadedFilters: Record<string, unknown> | null
  fromExecution: string | null
  /** Unapplied table edits (`useTableChanges().snapshotState()`). */
  pendingChanges: unknown
  pendingChangesCount: number
  /**
   * The ETL review not yet sent to the backend: the data the ETL returned (with its
   * `__metadata__`) and the origin switches as the user left them. Null without one.
   */
  etlReview?: {
    initialData: Record<string, any>
    tableSwitches: Record<string, any>
    parameterSwitches: Record<string, any>
  } | null
}

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null)
      const request = indexedDB.open(DB_NAME, VERSION)
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE)) {
          request.result.createObjectStore(STORE)
        }
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

function run<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest,
): Promise<T | null> {
  return openDb().then(
    (db) =>
      new Promise((resolve) => {
        if (!db) return resolve(null)
        try {
          const request = action(db.transaction(STORE, mode).objectStore(STORE))
          request.onsuccess = () => resolve((request.result as T) ?? null)
          request.onerror = () => resolve(null)
        } catch {
          resolve(null)
        }
      }),
  )
}

export function draftKey(schema: string, userId: string | null | undefined) {
  return `${schema}:${userId ?? ''}`
}

export function readExecutionDraft(key: string): Promise<ExecutionDraft | null> {
  return run<ExecutionDraft>('readonly', (store) => store.get(key))
}

/** Resolves false when the draft could not be stored. */
export async function writeExecutionDraft(
  key: string,
  draft: ExecutionDraft,
): Promise<boolean> {
  const db = await openDb()
  if (!db) return false
  return new Promise((resolve) => {
    try {
      const transaction = db.transaction(STORE, 'readwrite')
      transaction.objectStore(STORE).put(draft, key)
      transaction.oncomplete = () => resolve(true)
      transaction.onerror = () => resolve(false)
      transaction.onabort = () => resolve(false)
    } catch {
      resolve(false)
    }
  })
}

export function deleteExecutionDraft(key: string): Promise<unknown> {
  return run('readwrite', (store) => store.delete(key))
}
