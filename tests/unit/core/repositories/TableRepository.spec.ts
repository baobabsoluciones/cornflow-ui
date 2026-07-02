import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import TableRepository, {
  ForceRetryOfferError,
  isForceRetryOfferError,
  responseBodyOffersForceRetry,
} from '@cornflow-ui/core/repositories/TableRepository'
import { TableOperation } from '@cornflow-ui/core/types/table'

// ─── Mocks ───────────────────────────────────────────────────────────────────

// HTTP client (the only network boundary). All repo methods bottom out here.
const mockClient = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  remove: vi.fn(),
  getBlob: vi.fn(),
}))

vi.mock('@cornflow-ui/core/api/Api', () => ({
  default: mockClient,
}))

// i18nUtils.getMessageFromResponseContent is pure but imports the i18n plugin
// transitively; mock it to deterministic, identifiable strings.
vi.mock('@cornflow-ui/core/utils/i18nUtils', () => ({
  getMessageFromResponseContent: (content: any, fallback: string) => {
    if (content && typeof content.message === 'string') return content.message
    return fallback
  },
}))

// buildApiUrl: substitute {key} placeholders so we can assert on URLs.
vi.mock('@cornflow-ui/core/utils/urlUtils', () => ({
  buildApiUrl: (baseUrl: string, params: Record<string, any> = {}) => {
    let url = baseUrl
    for (const [k, v] of Object.entries(params)) {
      url = url.replace(`{${k}}`, String(v))
    }
    return url
  },
}))

// FrontendAutomationService helpers mirror the real (trivial) implementations.
vi.mock('@cornflow-ui/core/services/FrontendAutomationService', () => ({
  getOperationConfig: (tableConfig: any, operation: string) =>
    tableConfig?.[operation] || null,
  isOperationSupported: (tableConfig: any, operation: string) =>
    !!tableConfig?.[operation]?.url,
}))

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** A table config supporting every operation used in the tests. */
function fullConfig() {
  return {
    title: 'My Table',
    [TableOperation.GET_LIST]: { url: '/items/', http_method: 'GET' },
    [TableOperation.GET_ITEM]: { url: '/items/{idx}/', http_method: 'GET' },
    [TableOperation.POST_ITEM]: { url: '/items/', http_method: 'POST' },
    [TableOperation.PATCH_ITEM]: { url: '/items/{idx}/', http_method: 'PATCH' },
    [TableOperation.PUT_ITEM]: { url: '/items/{idx}/', http_method: 'PUT' },
    [TableOperation.POST_BULK]: { url: '/items/bulk/', http_method: 'POST' },
    [TableOperation.POST_UPDATE_BULK]: {
      url: '/items/bulk-update/',
      http_method: 'POST',
    },
    [TableOperation.DELETE_ITEM]: { url: '/items/{idx}/', http_method: 'DELETE' },
    [TableOperation.DELETE_BULK]: { url: '/items/bulk/', http_method: 'DELETE' },
    [TableOperation.DELETE_ALL]: { url: '/items/all/', http_method: 'DELETE' },
    [TableOperation.OVERWRITE_ALL]: {
      url: '/items/overwrite/',
      http_method: 'POST',
    },
    [TableOperation.RESTORE_ALL]: { url: '/items/restore/', http_method: 'POST' },
    [TableOperation.DOWNLOAD_EXCEL]: {
      url: '/items/excel/',
      http_method: 'GET',
    },
    [TableOperation.ASYNC_POST_BULK]: {
      url: '/items/async-bulk/',
      http_method: 'POST',
    },
    [TableOperation.ASYNC_UPLOAD_STATUS]: {
      url: '/items/upload/{upload_id}/',
      http_method: 'GET',
    },
  }
}

function ok(content: any, status = 200) {
  return { status, content }
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ─── Pure helpers ──────────────────────────────────────────────────────────────

describe('responseBodyOffersForceRetry', () => {
  test('returns false for null / non-object / array', () => {
    expect(responseBodyOffersForceRetry(null)).toBe(false)
    expect(responseBodyOffersForceRetry(undefined)).toBe(false)
    expect(responseBodyOffersForceRetry('x')).toBe(false)
    expect(responseBodyOffersForceRetry([1, 2])).toBe(false)
  })

  test('detects non-empty array flag', () => {
    expect(responseBodyOffersForceRetry({ offer_force_retry: ['a'] })).toBe(true)
    expect(responseBodyOffersForceRetry({ offer_force_retry: [] })).toBe(false)
  })

  test('detects boolean / numeric / string flags (snake & camel)', () => {
    expect(responseBodyOffersForceRetry({ offer_force_retry: true })).toBe(true)
    expect(responseBodyOffersForceRetry({ offer_force_retry: 1 })).toBe(true)
    expect(responseBodyOffersForceRetry({ offer_force_retry: 'yes' })).toBe(true)
    expect(responseBodyOffersForceRetry({ offerForceRetry: 'TRUE' })).toBe(true)
    expect(responseBodyOffersForceRetry({ offer_force_retry: 'no' })).toBe(false)
    expect(responseBodyOffersForceRetry({ offer_force_retry: false })).toBe(
      false,
    )
  })

  test('detects flag nested in detail', () => {
    expect(
      responseBodyOffersForceRetry({ detail: { offer_force_retry: ['x'] } }),
    ).toBe(true)
    expect(
      responseBodyOffersForceRetry({ detail: { offerForceRetry: true } }),
    ).toBe(true)
    expect(
      responseBodyOffersForceRetry({ detail: { offer_force_retry: false } }),
    ).toBe(false)
    // detail is an array → ignored
    expect(responseBodyOffersForceRetry({ detail: [1] })).toBe(false)
  })
})

describe('isForceRetryOfferError / ForceRetryOfferError', () => {
  test('true for real instance', () => {
    const err = new ForceRetryOfferError('msg', true, 'raw', { ctx: 1 }, ['a'], [
      'b',
    ])
    expect(isForceRetryOfferError(err)).toBe(true)
    expect(err.name).toBe('ForceRetryOfferError')
    expect(err.offerForceRetry).toBe(true)
    expect(err.rawMessage).toBe('raw')
    expect(err.forceTableKeys).toEqual(['a'])
    expect(err.retryTableKeys).toEqual(['b'])
  })

  test('true for duck-typed error by name', () => {
    expect(isForceRetryOfferError({ name: 'ForceRetryOfferError' })).toBe(true)
  })

  test('false for plain errors / non-objects', () => {
    expect(isForceRetryOfferError(new Error('x'))).toBe(false)
    expect(isForceRetryOfferError(null)).toBe(false)
    expect(isForceRetryOfferError('nope')).toBe(false)
  })
})

// ─── performOperation via public methods ─────────────────────────────────────────

describe('TableRepository - GET methods', () => {
  test('getList forwards query params and returns content', async () => {
    const repo = new TableRepository(fullConfig())
    mockClient.get.mockResolvedValue(ok([{ id: 1 }]))

    const result = await repo.getList({ limit: 10, offset: 0 })

    expect(result).toEqual([{ id: 1 }])
    expect(mockClient.get).toHaveBeenCalledWith(
      '/items/',
      { limit: 10, offset: 0 },
      {},
      true,
    )
  })

  test('getList defaults query params to {}', async () => {
    const repo = new TableRepository(fullConfig())
    mockClient.get.mockResolvedValue(ok([]))

    await repo.getList()

    expect(mockClient.get).toHaveBeenCalledWith('/items/', {}, {}, true)
  })

  test('getItem substitutes idx into URL', async () => {
    const repo = new TableRepository(fullConfig())
    mockClient.get.mockResolvedValue(ok({ id: 42 }))

    const result = await repo.getItem(42)

    expect(result).toEqual({ id: 42 })
    expect(mockClient.get).toHaveBeenCalledWith('/items/42/', {}, {}, true)
  })
})

describe('TableRepository - write methods', () => {
  test('createItem POSTs body', async () => {
    const repo = new TableRepository(fullConfig())
    mockClient.post.mockResolvedValue(ok({ id: 1 }, 201))

    const result = await repo.createItem({ name: 'a' })

    expect(result).toEqual({ id: 1 })
    expect(mockClient.post).toHaveBeenCalledWith(
      '/items/',
      { name: 'a' },
      {},
      true,
    )
  })

  test('patchItem maps to client.put (no patch method)', async () => {
    const repo = new TableRepository(fullConfig())
    mockClient.put.mockResolvedValue(ok({ id: 5, name: 'b' }))

    await repo.patchItem(5, { name: 'b' })

    expect(mockClient.put).toHaveBeenCalledWith(
      '/items/5/',
      { name: 'b' },
      {},
      true,
    )
  })

  test('updateItem / putItem alias PUT', async () => {
    const repo = new TableRepository(fullConfig())
    mockClient.put.mockResolvedValue(ok({ id: 7 }))

    await repo.updateItem(7, { x: 1 })
    await repo.putItem(7, { x: 2 })

    expect(mockClient.put).toHaveBeenNthCalledWith(
      1,
      '/items/7/',
      { x: 1 },
      {},
      true,
    )
    expect(mockClient.put).toHaveBeenNthCalledWith(
      2,
      '/items/7/',
      { x: 2 },
      {},
      true,
    )
  })

  test('createBulk / updateBulk POST arrays', async () => {
    const repo = new TableRepository(fullConfig())
    mockClient.post.mockResolvedValue(ok({ ok: true }))

    await repo.createBulk([{ a: 1 }])
    await repo.updateBulk([{ b: 2 }])

    expect(mockClient.post).toHaveBeenNthCalledWith(
      1,
      '/items/bulk/',
      [{ a: 1 }],
      {},
      true,
    )
    expect(mockClient.post).toHaveBeenNthCalledWith(
      2,
      '/items/bulk-update/',
      [{ b: 2 }],
      {},
      true,
    )
  })

  test('overwriteAll POSTs items and appends force when option set', async () => {
    const repo = new TableRepository(fullConfig())
    mockClient.post.mockResolvedValue(ok({ ok: true }))

    await repo.overwriteAll([{ a: 1 }], { force: true })

    expect(mockClient.post).toHaveBeenCalledWith(
      '/items/overwrite/?force=true',
      [{ a: 1 }],
      {},
      true,
    )
  })

  test('restoreAll POSTs to restore url', async () => {
    const repo = new TableRepository(fullConfig())
    mockClient.post.mockResolvedValue(ok({ restored: 3 }))

    const result = await repo.restoreAll()

    expect(result).toEqual({ restored: 3 })
    expect(mockClient.post).toHaveBeenCalledWith(
      '/items/restore/',
      null,
      {},
      true,
    )
  })
})

describe('TableRepository - delete methods', () => {
  test('deleteItem uses client.remove with idx URL', async () => {
    const repo = new TableRepository(fullConfig())
    mockClient.remove.mockResolvedValue(ok({ deleted: true }))

    await repo.deleteItem(9)

    expect(mockClient.remove).toHaveBeenCalledWith('/items/9/', {}, true, null)
  })

  test('deleteItem appends ?force=true when forced', async () => {
    const repo = new TableRepository(fullConfig())
    mockClient.remove.mockResolvedValue(ok({ deleted: true }))

    await repo.deleteItem(9, { force: true })

    expect(mockClient.remove).toHaveBeenCalledWith(
      '/items/9/?force=true',
      {},
      true,
      null,
    )
  })

  test('deleteBulk normalizes numeric-string ids to integers', async () => {
    const repo = new TableRepository(fullConfig())
    mockClient.remove.mockResolvedValue(ok({ deleted: 3 }))

    await repo.deleteBulk(['1', 2, 'uuid-abc', ' 4 '])

    expect(mockClient.remove).toHaveBeenCalledWith(
      '/items/bulk/',
      {},
      true,
      { ids: [1, 2, 'uuid-abc', 4] },
    )
  })

  test('deleteAll appends force when forced', async () => {
    const repo = new TableRepository(fullConfig())
    mockClient.remove.mockResolvedValue(ok({ deleted: 'all' }))

    await repo.deleteAll({ force: true })

    expect(mockClient.remove).toHaveBeenCalledWith(
      '/items/all/?force=true',
      {},
      true,
      null,
    )
  })

  test('deleteAll without force does not append param', async () => {
    const repo = new TableRepository(fullConfig())
    mockClient.remove.mockResolvedValue(ok({ deleted: 'all' }))

    await repo.deleteAll()

    expect(mockClient.remove).toHaveBeenCalledWith('/items/all/', {}, true, null)
  })
})

describe('TableRepository - error & force-retry branches', () => {
  test('throws localized error when operation not supported', async () => {
    const repo = new TableRepository({}) // empty config supports nothing
    await expect(repo.getList()).rejects.toThrow(
      'This action is not available for this table',
    )
  })

  test('uses translator for unsupported-operation message', async () => {
    const t = vi.fn(() => 'NO_SUPPORT')
    const repo = new TableRepository({}, t)
    await expect(repo.getItem(1)).rejects.toThrow('NO_SUPPORT')
    expect(t).toHaveBeenCalledWith('table.repository.operationNotSupported')
  })

  test('throws for unsupported HTTP method', async () => {
    const cfg = {
      [TableOperation.GET_LIST]: { url: '/x/', http_method: 'HEAD' },
    }
    const repo = new TableRepository(cfg)
    await expect(repo.getList()).rejects.toThrow(
      'An error occurred while processing your request',
    )
  })

  test('non-2xx status throws message from content', async () => {
    const repo = new TableRepository(fullConfig())
    mockClient.post.mockResolvedValue(
      ok({ message: 'Server said no' }, 400),
    )
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(repo.createItem({})).rejects.toThrow('Server said no')

    consoleSpy.mockRestore()
  })

  test('re-throws unexpected dispatch error and logs it', async () => {
    const repo = new TableRepository(fullConfig())
    mockClient.get.mockRejectedValue(new Error('network down'))
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(repo.getList()).rejects.toThrow('network down')
    expect(consoleSpy).toHaveBeenCalled()

    consoleSpy.mockRestore()
  })

  test('delete with offer_force_retry throws ForceRetryOfferError (string message)', async () => {
    const repo = new TableRepository(fullConfig())
    mockClient.remove.mockResolvedValue(
      ok({ offer_force_retry: true, message: 'has dependents' }, 409),
    )

    await expect(repo.deleteItem(1)).rejects.toMatchObject({
      name: 'ForceRetryOfferError',
      offerForceRetry: true,
      message: 'has dependents',
      rawMessage: 'has dependents',
    })
  })

  test('overwriteAll force-retry keeps object rawMessage', async () => {
    const repo = new TableRepository(fullConfig())
    mockClient.post.mockResolvedValue(
      ok(
        {
          offer_force_retry: true,
          message: { en: 'blocked', es: 'bloqueado' },
        },
        409,
      ),
    )

    try {
      await repo.overwriteAll([{ a: 1 }])
      throw new Error('should have thrown')
    } catch (err: any) {
      expect(isForceRetryOfferError(err)).toBe(true)
      expect(err.rawMessage).toEqual({ en: 'blocked', es: 'bloqueado' })
    }
  })

  test('force-retry is NOT raised for non force-retry operations', async () => {
    const repo = new TableRepository(fullConfig())
    // POST_ITEM is not in the force-retry list; offer flag is ignored,
    // and since status is 2xx the content is returned.
    mockClient.post.mockResolvedValue(
      ok({ offer_force_retry: true, id: 1 }, 200),
    )

    const result = await repo.createItem({})
    expect(result).toEqual({ offer_force_retry: true, id: 1 })
  })
})

// ─── getSupportedOperations / isOperationSupported ───────────────────────────────

describe('TableRepository - operation introspection', () => {
  test('getSupportedOperations lists configured ops', () => {
    const repo = new TableRepository({
      [TableOperation.GET_LIST]: { url: '/a/' },
      [TableOperation.POST_ITEM]: { url: '/a/' },
    })
    const ops = repo.getSupportedOperations()
    expect(ops).toContain(TableOperation.GET_LIST)
    expect(ops).toContain(TableOperation.POST_ITEM)
    expect(ops).not.toContain(TableOperation.DELETE_ALL)
  })

  test('isOperationSupported reflects config presence', () => {
    const repo = new TableRepository({
      [TableOperation.GET_LIST]: { url: '/a/' },
    })
    expect(repo.isOperationSupported(TableOperation.GET_LIST)).toBe(true)
    expect(repo.isOperationSupported(TableOperation.DELETE_ALL)).toBe(false)
  })

  test('supportsAsyncBulkOperation requires async op AND status endpoint', () => {
    const withBoth = new TableRepository({
      [TableOperation.ASYNC_POST_BULK]: { url: '/async/' },
      [TableOperation.ASYNC_UPLOAD_STATUS]: { url: '/status/' },
    })
    expect(withBoth.supportsAsyncBulkOperation('post_bulk')).toBe(true)

    const missingStatus = new TableRepository({
      [TableOperation.ASYNC_POST_BULK]: { url: '/async/' },
    })
    expect(missingStatus.supportsAsyncBulkOperation('post_bulk')).toBe(false)

    expect(withBoth.supportsAsyncBulkOperation('unknown_op')).toBe(false)
  })
})

// ─── downloadExcel ───────────────────────────────────────────────────────────────

describe('TableRepository - downloadExcel', () => {
  let createObjectURL: any
  let revokeObjectURL: any
  let clickSpy: any

  beforeEach(() => {
    createObjectURL = vi.fn(() => 'blob:url')
    revokeObjectURL = vi.fn()
    ;(URL as any).createObjectURL = createObjectURL
    ;(URL as any).revokeObjectURL = revokeObjectURL
    clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {})
  })

  test('throws when download op not supported', async () => {
    const repo = new TableRepository({})
    await expect(repo.downloadExcel()).rejects.toThrow(
      'This action is not available for this table',
    )
  })

  test('throws when method is not GET', async () => {
    const repo = new TableRepository({
      [TableOperation.DOWNLOAD_EXCEL]: { url: '/x/', http_method: 'POST' },
    })
    await expect(repo.downloadExcel()).rejects.toThrow(
      'An error occurred while processing your request',
    )
  })

  test('downloads blob and triggers anchor click on success', async () => {
    const repo = new TableRepository(fullConfig())
    const blob = new Blob(['data'], { type: 'application/vnd.ms-excel' })
    mockClient.getBlob.mockResolvedValue({
      status: 200,
      blob,
      filename: 'report.xlsx',
    })

    await repo.downloadExcel({ limit: 5, skip: undefined })

    // undefined query params are filtered out
    expect(mockClient.getBlob).toHaveBeenCalledWith('/items/excel/', { limit: 5 }, true)
    expect(createObjectURL).toHaveBeenCalledWith(blob)
    expect(clickSpy).toHaveBeenCalled()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:url')
  })

  test('falls back to table title when no filename header', async () => {
    const repo = new TableRepository(fullConfig())
    const blob = new Blob(['data'], { type: 'application/octet-stream' })
    mockClient.getBlob.mockResolvedValue({ status: 200, blob, filename: null })

    await repo.downloadExcel()

    expect(clickSpy).toHaveBeenCalled()
  })

  test('throws parsed JSON error message on non-2xx', async () => {
    const repo = new TableRepository(fullConfig())
    const blob = new Blob([JSON.stringify({ message: 'bad export' })], {
      type: 'application/json',
    })
    mockClient.getBlob.mockResolvedValue({ status: 500, blob, filename: null })

    await expect(repo.downloadExcel()).rejects.toThrow('bad export')
  })

  test('falls back to default message when error blob is not JSON', async () => {
    const repo = new TableRepository(fullConfig())
    const blob = new Blob(['plain text'], { type: 'text/plain' })
    mockClient.getBlob.mockResolvedValue({ status: 500, blob, filename: null })

    await expect(repo.downloadExcel()).rejects.toThrow('Download failed')
  })

  test('uses translator for download error default message', async () => {
    const t = vi.fn((k: string) =>
      k === 'table.messages.errorDownloadExcelTable' ? 'DL_FAIL' : k,
    )
    const repo = new TableRepository(fullConfig(), t)
    const blob = new Blob(['x'], { type: 'text/plain' })
    mockClient.getBlob.mockResolvedValue({ status: 500, blob, filename: null })

    await expect(repo.downloadExcel()).rejects.toThrow('DL_FAIL')
  })
})

// ─── async bulk upload ───────────────────────────────────────────────────────────

describe('TableRepository - startAsyncBulkUpload', () => {
  function fileFixture() {
    return new File(['contents'], 'data.xlsx', {
      type: 'application/vnd.openxmlformats',
    })
  }

  test('throws when operation not supported', async () => {
    const repo = new TableRepository({})
    await expect(
      repo.startAsyncBulkUpload(TableOperation.ASYNC_POST_BULK, fileFixture()),
    ).rejects.toThrow('This action is not available for this table')
  })

  test('returns init response with upload_id and defaults on 202', async () => {
    const repo = new TableRepository(fullConfig())
    mockClient.post.mockResolvedValue(ok({ upload_id: 'u-1' }, 202))

    const result = await repo.startAsyncBulkUpload(
      TableOperation.ASYNC_POST_BULK,
      fileFixture(),
    )

    expect(result).toEqual({
      upload_id: 'u-1',
      dag_run_id: undefined,
      status: 'queued',
    })
    // posted multipart form-data
    const [url, body] = mockClient.post.mock.calls[0]
    expect(url).toBe('/items/async-bulk/')
    expect(body).toBeInstanceOf(FormData)
  })

  test('accepts camelCase uploadId and explicit status/dag_run_id', async () => {
    const repo = new TableRepository(fullConfig())
    mockClient.post.mockResolvedValue(
      ok({ uploadId: 'u-2', status: 'processing', dag_run_id: 'd-9' }, 202),
    )

    const result = await repo.startAsyncBulkUpload(
      TableOperation.ASYNC_POST_BULK,
      fileFixture(),
    )

    expect(result).toEqual({
      upload_id: 'u-2',
      dag_run_id: 'd-9',
      status: 'processing',
    })
  })

  test('throws when 2xx response lacks upload_id', async () => {
    const repo = new TableRepository(fullConfig())
    mockClient.post.mockResolvedValue(ok({ message: 'no id here' }, 200))

    await expect(
      repo.startAsyncBulkUpload(TableOperation.ASYNC_POST_BULK, fileFixture()),
    ).rejects.toThrow('no id here')
  })

  test('throws message on non-2xx', async () => {
    const repo = new TableRepository(fullConfig())
    mockClient.post.mockResolvedValue(ok({ message: 'upload failed' }, 500))

    await expect(
      repo.startAsyncBulkUpload(TableOperation.ASYNC_POST_BULK, fileFixture()),
    ).rejects.toThrow('upload failed')
  })
})

describe('TableRepository - getAsyncUploadStatus', () => {
  test('throws when status op not supported', async () => {
    const repo = new TableRepository({})
    await expect(repo.getAsyncUploadStatus('u-1')).rejects.toThrow(
      'This action is not available for this table',
    )
  })

  test('returns content on 2xx', async () => {
    const repo = new TableRepository(fullConfig())
    const status = { id: 'u-1', status: 'processing', total_rows_loaded: 5 }
    mockClient.get.mockResolvedValue(ok(status))

    const result = await repo.getAsyncUploadStatus('u-1')

    expect(result).toEqual(status)
    expect(mockClient.get).toHaveBeenCalledWith(
      '/items/upload/u-1/',
      {},
      {},
      true,
    )
  })

  test('throws not-found on 404', async () => {
    const repo = new TableRepository(fullConfig())
    mockClient.get.mockResolvedValue(ok(null, 404))

    await expect(repo.getAsyncUploadStatus('u-1')).rejects.toThrow(
      'Upload not found',
    )
  })

  test('throws generic message on other failure', async () => {
    const repo = new TableRepository(fullConfig())
    mockClient.get.mockResolvedValue(ok({ message: 'oops' }, 500))

    await expect(repo.getAsyncUploadStatus('u-1')).rejects.toThrow('oops')
  })
})

describe('TableRepository - pollAsyncUploadUntilTerminal', () => {
  test('resolves immediately when first poll is terminal', async () => {
    const repo = new TableRepository(fullConfig())
    const onProgress = vi.fn()
    mockClient.get.mockResolvedValue(ok({ id: 'u-1', status: 'completed' }))

    const result = await repo.pollAsyncUploadUntilTerminal('u-1', {
      onProgress,
    })

    expect(result.status).toBe('completed')
    expect(onProgress).toHaveBeenCalledTimes(1)
  })

  test('polls repeatedly until terminal status', async () => {
    const repo = new TableRepository(fullConfig())
    mockClient.get
      .mockResolvedValueOnce(ok({ id: 'u-1', status: 'processing' }))
      .mockResolvedValueOnce(ok({ id: 'u-1', status: 'failed' }))

    vi.useFakeTimers()
    const promise = repo.pollAsyncUploadUntilTerminal('u-1', { intervalMs: 100 })
    await vi.advanceTimersByTimeAsync(100)
    const result = await promise
    vi.useRealTimers()

    expect(result.status).toBe('failed')
    expect(mockClient.get).toHaveBeenCalledTimes(2)
  })

  test('returns last status when shouldContinue turns false', async () => {
    const repo = new TableRepository(fullConfig())
    mockClient.get.mockResolvedValue(ok({ id: 'u-1', status: 'processing' }))
    let calls = 0
    const shouldContinue = () => {
      calls += 1
      return calls <= 1 // allow one iteration, then cancel
    }

    const result = await repo.pollAsyncUploadUntilTerminal('u-1', {
      intervalMs: 0,
      shouldContinue,
    })

    expect(result.status).toBe('processing')
  })

  test('fetches once when cancelled before first poll', async () => {
    const repo = new TableRepository(fullConfig())
    mockClient.get.mockResolvedValue(ok({ id: 'u-1', status: 'processing' }))
    const shouldContinue = () => false

    const result = await repo.pollAsyncUploadUntilTerminal('u-1', {
      shouldContinue,
    })

    expect(result.status).toBe('processing')
    expect(mockClient.get).toHaveBeenCalledTimes(1)
  })
})
