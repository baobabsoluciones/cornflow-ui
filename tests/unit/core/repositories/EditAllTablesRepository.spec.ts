import { describe, test, expect, vi, beforeEach } from 'vitest'

const { postMock, offersMock } = vi.hoisted(() => ({
  postMock: vi.fn(),
  offersMock: vi.fn(),
}))

vi.mock('@/api/Api', () => ({ default: { post: postMock } }))
vi.mock('@/stores/general', () => ({ useGeneralStore: () => ({}) }))
vi.mock('@/repositories/TableRepository', () => {
  class ForceRetryOfferError extends Error {
    constructor(
      public displayMessage: string,
      public offered: boolean,
      public rawMessage: unknown,
      public content: unknown,
      public forceKeys?: string[],
      public retryKeys?: string[],
    ) {
      super(displayMessage)
      this.name = 'ForceRetryOfferError'
    }
  }
  return { ForceRetryOfferError, responseBodyOffersForceRetry: offersMock }
})

import {
  buildEditAllTablesErrorMessage,
  postEditAllTables,
  mapBulkUiOperationToEditAllApi,
} from '@/repositories/EditAllTablesRepository'
import { ForceRetryOfferError } from '@/repositories/TableRepository'

beforeEach(() => {
  postMock.mockReset()
  offersMock.mockReset()
})

describe('mapBulkUiOperationToEditAllApi', () => {
  test('passes through known operations, defaults the rest to post_bulk', () => {
    expect(mapBulkUiOperationToEditAllApi('post_bulk')).toBe('post_bulk')
    expect(mapBulkUiOperationToEditAllApi('overwrite_all')).toBe('overwrite_all')
    expect(mapBulkUiOperationToEditAllApi('post_update_bulk')).toBe('post_update_bulk')
    expect(mapBulkUiOperationToEditAllApi('whatever')).toBe('post_bulk')
  })
})

describe('buildEditAllTablesErrorMessage', () => {
  test('delegates plain string / nullish / array content', () => {
    expect(buildEditAllTablesErrorMessage('boom')).toBe('boom')
    expect(buildEditAllTablesErrorMessage(null, 'fb')).toBe('fb')
    // arrays delegate to getMessageFromResponseContent: non-empty joins, empty -> fallback
    expect(buildEditAllTablesErrorMessage(['x'])).toBe('x')
    expect(buildEditAllTablesErrorMessage([], 'fb')).toBe('fb')
  })

  test('uses a plain string message field', () => {
    expect(buildEditAllTablesErrorMessage({ message: 'just text' })).toBe('just text')
  })

  test('resolves a translation-object message via locale', () => {
    expect(buildEditAllTablesErrorMessage({ message: { en: 'English', es: 'Spanish' } })).toBe('English')
  })

  test('renders a per-table message map as key: value lines', () => {
    const out = buildEditAllTablesErrorMessage({
      message: { tableA: 'bad', tableB: { detail: 1 } },
    })
    expect(out).toBe('tableA: bad\ntableB: {"detail":1}')
  })

  test('falls back when there is no usable message', () => {
    expect(buildEditAllTablesErrorMessage({ foo: 1 }, 'fb')).toBe('fb')
  })
})

describe('postEditAllTables', () => {
  const file = () => new File(['data'], 'instance.xlsx')

  test('throws when no files are provided', async () => {
    await expect(postEditAllTables([], 'post_bulk')).rejects.toThrow('No files selected')
  })

  test('returns content on a 2xx response', async () => {
    postMock.mockResolvedValueOnce({ status: 200, content: { ok: true } })
    const res = await postEditAllTables([file()], 'post_bulk')
    expect(res).toEqual({ ok: true })
    expect(postMock).toHaveBeenCalledWith('/edit-all-tables/', expect.any(FormData), {}, true)
  })

  test('encodes force (boolean) and retry fields', async () => {
    postMock.mockResolvedValueOnce({ status: 201, content: {} })
    await postEditAllTables([file()], 'post_bulk', { forceBoolean: true, retry: ['t1'] })
    const fd: FormData = postMock.mock.calls[0][1]
    expect(fd.get('force')).toBe('true')
    expect(fd.get('retry')).toBe('["t1"]')
    expect(fd.get('operation')).toBe('post_bulk')
  })

  test('encodes force as a key list when no boolean flag', async () => {
    postMock.mockResolvedValueOnce({ status: 200, content: {} })
    await postEditAllTables([file()], 'post_bulk', { force: ['a', 'b'] })
    const fd: FormData = postMock.mock.calls[0][1]
    expect(fd.get('force')).toBe('["a","b"]')
  })

  test('throws a generic error on failure for non-overwrite operations', async () => {
    offersMock.mockReturnValue(false)
    postMock.mockResolvedValueOnce({ status: 400, content: { message: 'kaboom' } })
    await expect(postEditAllTables([file()], 'post_bulk')).rejects.toThrow('kaboom')
  })

  test('throws ForceRetryOfferError when overwrite_all offers a retry', async () => {
    offersMock.mockReturnValue(true)
    postMock.mockResolvedValueOnce({
      status: 409,
      content: { message: 'conflict', offer_force_retry: ['t1'], retry: ['t2'] },
    })
    await expect(postEditAllTables([file()], 'overwrite_all')).rejects.toBeInstanceOf(
      ForceRetryOfferError,
    )
  })
})
