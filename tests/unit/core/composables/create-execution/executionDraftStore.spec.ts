import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  draftKey,
  readExecutionDraft,
  writeExecutionDraft,
  deleteExecutionDraft,
  type ExecutionDraft,
} from '@cornflow-ui/core/composables/create-execution/executionDraftStore'

/**
 * Just enough of IndexedDB for the store: one database with object stores of key → value,
 * requests and transactions that settle on a later tick, and switches to make each step fail.
 */
function fakeIndexedDb() {
  const stores = new Map<string, Map<string, unknown>>()
  const fail = { open: false, openThrows: false, transaction: false, write: '' as '' | 'error' | 'abort' }
  const createObjectStore = vi.fn((name: string) => stores.set(name, new Map()))
  const later = (fn: () => void) => setTimeout(fn, 0)

  const request = (settle: (req: any) => void) => {
    const req: any = { result: undefined, onsuccess: null, onerror: null }
    later(() => settle(req))
    return req
  }

  const db = {
    objectStoreNames: { contains: (name: string) => stores.has(name) },
    createObjectStore,
    transaction(name: string) {
      if (fail.transaction || !stores.has(name)) throw new Error('NotFoundError')
      const data = stores.get(name)!
      const tx: any = { oncomplete: null, onerror: null, onabort: null }
      tx.objectStore = () => ({
        get: (key: string) =>
          request((req) => {
            req.result = structuredClone(data.get(key))
            req.onsuccess?.()
          }),
        delete: (key: string) =>
          request((req) => {
            data.delete(key)
            req.onsuccess?.()
          }),
        put: (value: unknown, key: string) =>
          later(() => {
            if (fail.write === 'error') return tx.onerror?.()
            if (fail.write === 'abort') return tx.onabort?.()
            data.set(key, structuredClone(value))
            tx.oncomplete?.()
          }),
      })
      return tx
    },
  }

  const indexedDB = {
    open: vi.fn(() => {
      if (fail.openThrows) throw new Error('SecurityError')
      return request((req) => {
        if (fail.open) return req.onerror?.()
        req.result = db
        req.onupgradeneeded?.()
        req.onsuccess?.()
      })
    }),
  }

  return { indexedDB, stores, fail, createObjectStore }
}

const draft = (name: string): ExecutionDraft => ({
  savedAt: '2026-10-30T09:15:00.000Z',
  name,
  description: 'Plan',
  config: { timeLimit: 60 },
  instanceData: { lines: [{ id: 'a', qty: 3 }] },
  files: [],
  loadedFileNames: ['lines.xlsx'],
  loadedFilters: { plant: 7 },
  fromExecution: null,
  pendingChanges: { edits: { lines: { a: { qty: 4 } } } },
  pendingChangesCount: 1,
  etlReview: null,
})

describe('executionDraftStore', () => {
  let fake: ReturnType<typeof fakeIndexedDb>

  beforeEach(() => {
    fake = fakeIndexedDb()
    vi.stubGlobal('indexedDB', fake.indexedDB)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('a draft is kept per DAG and user', () => {
    expect(draftKey('planning', 'u1')).toBe('planning:u1')
    expect(draftKey('planning', null)).toBe('planning:')
    expect(draftKey('planning', undefined)).toBe('planning:')
  })

  test('a saved draft reads back as it was saved, under its own key only', async () => {
    expect(await writeExecutionDraft('planning:u1', draft('Week 44'))).toBe(true)

    expect(await readExecutionDraft('planning:u1')).toEqual(draft('Week 44'))
    expect(await readExecutionDraft('planning:u2')).toBeNull()
  })

  test('saving again replaces the draft', async () => {
    await writeExecutionDraft('planning:u1', draft('Week 44'))
    await writeExecutionDraft('planning:u1', draft('Week 45'))

    expect((await readExecutionDraft('planning:u1'))?.name).toBe('Week 45')
  })

  test('a deleted draft is gone', async () => {
    await writeExecutionDraft('planning:u1', draft('Week 44'))
    await deleteExecutionDraft('planning:u1')

    expect(await readExecutionDraft('planning:u1')).toBeNull()
  })

  test('the drafts store is created once, the first time the database opens', async () => {
    await readExecutionDraft('planning:u1')
    await readExecutionDraft('planning:u1')

    expect(fake.createObjectStore).toHaveBeenCalledTimes(1)
    expect(fake.indexedDB.open).toHaveBeenCalledWith('cornflow-ui', 1)
  })

  describe('without a usable IndexedDB there is no draft', () => {
    test('when the browser has none', async () => {
      vi.stubGlobal('indexedDB', undefined)

      expect(await readExecutionDraft('planning:u1')).toBeNull()
      expect(await writeExecutionDraft('planning:u1', draft('Week 44'))).toBe(false)
      expect(await deleteExecutionDraft('planning:u1')).toBeNull()
    })

    test('when the database does not open', async () => {
      fake.fail.open = true

      expect(await readExecutionDraft('planning:u1')).toBeNull()
      expect(await writeExecutionDraft('planning:u1', draft('Week 44'))).toBe(false)
    })

    test('when opening it throws (blocked site data)', async () => {
      fake.fail.openThrows = true

      expect(await readExecutionDraft('planning:u1')).toBeNull()
      expect(await writeExecutionDraft('planning:u1', draft('Week 44'))).toBe(false)
    })

    test('when a transaction cannot start', async () => {
      await writeExecutionDraft('planning:u1', draft('Week 44'))
      fake.fail.transaction = true

      expect(await readExecutionDraft('planning:u1')).toBeNull()
      expect(await writeExecutionDraft('planning:u1', draft('Week 45'))).toBe(false)
    })
  })

  test.each(['error', 'abort'] as const)('a save that ends in %s says it was not stored', async (outcome) => {
    fake.fail.write = outcome

    expect(await writeExecutionDraft('planning:u1', draft('Week 44'))).toBe(false)
    fake.fail.write = ''
    expect(await readExecutionDraft('planning:u1')).toBeNull()
  })
})
