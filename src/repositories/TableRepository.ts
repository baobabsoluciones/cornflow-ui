import client from '@cornflow-ui/core/api/Api'
import { TableOperation } from '@cornflow-ui/core/types/table'
import { buildApiUrl } from '@cornflow-ui/core/utils/urlUtils'
import {
  getOperationConfig,
  isOperationSupported,
} from '@cornflow-ui/core/services/FrontendAutomationService'
import { getMessageFromResponseContent } from '@cornflow-ui/core/utils/i18nUtils'
import {
  isAsyncUploadTerminal,
  type AsyncUploadInitResponse,
  type AsyncUploadStatusResponse,
} from '@cornflow-ui/core/types/frontendAutomation'

/**
 * Error thrown when the backend responds with offer_force_retry: true (e.g. overwrite
 * or delete blocked by dependent items). The UI should show the message and offer
 * Accept/Reject; on Accept, retry the same operation with force=true.
 */
export class ForceRetryOfferError extends Error {
  constructor(
    message: string,
    public readonly offerForceRetry: boolean,
    public readonly rawMessage: string | Record<string, string>,
    public readonly context?: unknown,
    /** Table keys the backend allows forcing (edit-all-tables overwrite). */
    public readonly forceTableKeys?: string[],
    /** Table keys to retry (edit-all-tables overwrite). */
    public readonly retryTableKeys?: string[],
  ) {
    super(message)
    this.name = 'ForceRetryOfferError'
    Object.setPrototypeOf(this, ForceRetryOfferError.prototype)
  }
}

/** True when API body asks the client to offer force retry (not only strict JSON boolean). */
function flagMeansOfferRetry(value: unknown): boolean {
  if (value === true || value === 1) return true
  if (typeof value === 'string') {
    const s = value.trim().toLowerCase()
    return s === 'true' || s === '1' || s === 'yes'
  }
  return false
}

/**
 * Detects offer_force_retry on typical response bodies (flat, camelCase, or nested detail).
 */
export function responseBodyOffersForceRetry(content: unknown): boolean {
  if (
    content == null ||
    typeof content !== 'object' ||
    Array.isArray(content)
  ) {
    return false
  }
  const c = content as Record<string, unknown>
  if (Array.isArray(c.offer_force_retry) && c.offer_force_retry.length > 0) {
    return true
  }
  if (
    flagMeansOfferRetry(c.offer_force_retry) ||
    flagMeansOfferRetry(c.offerForceRetry)
  ) {
    return true
  }
  const detail = c.detail
  if (detail != null && typeof detail === 'object' && !Array.isArray(detail)) {
    const d = detail as Record<string, unknown>
    if (Array.isArray(d.offer_force_retry) && d.offer_force_retry.length > 0) {
      return true
    }
    if (
      flagMeansOfferRetry(d.offer_force_retry) ||
      flagMeansOfferRetry(d.offerForceRetry)
    ) {
      return true
    }
  }
  return false
}

/** Reliable check when instanceof may fail across duplicate module boundaries. */
export function isForceRetryOfferError(
  err: unknown,
): err is ForceRetryOfferError {
  return (
    err instanceof ForceRetryOfferError ||
    (typeof err === 'object' &&
      err !== null &&
      (err as Error).name === 'ForceRetryOfferError')
  )
}

type QueryParamValue = string | number | boolean | undefined

function flattenQueryParams(
  queryParams: Record<string, QueryParamValue> | undefined,
): Record<string, QueryParamValue> {
  const flat: Record<string, QueryParamValue> = {}
  if (!queryParams) return flat
  for (const [k, v] of Object.entries(queryParams)) {
    if (v !== undefined && v !== null) flat[k] = v
  }
  return flat
}

async function parseErrorFromBlob(
  blob: Blob,
  defaultMsg: string,
): Promise<string> {
  if (!blob.type?.includes?.('json')) return defaultMsg
  try {
    const text = await blob.text()
    const j = JSON.parse(text) as { message?: string }
    if (typeof j.message === 'string' && j.message) return j.message
  } catch {
    /* keep default */
  }
  return defaultMsg
}

export default class TableRepository {
  private readonly tableConfig: any
  private readonly t?: (key: string, params?: Record<string, any>) => string

  constructor(
    tableConfig: any,
    t?: (key: string, params?: Record<string, any>) => string,
  ) {
    this.tableConfig = tableConfig
    this.t = t
  }

  // Generic method to perform any table operation
  private async performOperation(
    operation: TableOperation,
    params: Record<string, any> = {},
    data: any = null,
    operationOptions?: { force?: boolean },
  ): Promise<any> {
    if (!isOperationSupported(this.tableConfig, operation)) {
      const message = this.t
        ? this.t('table.repository.operationNotSupported')
        : 'This action is not available for this table'
      throw new Error(message)
    }

    const operationConfig = getOperationConfig(this.tableConfig, operation)
    // Separate query params (for GET query string; keys match path.parameters) from path params (for URL substitution, e.g. {id})
    const { queryParams: getQueryParams, ...pathParams } = params
    let url = buildApiUrl(operationConfig.url, pathParams)

    // For overwrite_all and delete operations, backend may require ?force=true to confirm when there are dependent items
    url = this.appendForceParam(url, operation, operationOptions)

    const method = operationConfig.http_method.toLowerCase()

    const queryParams =
      method === 'get' &&
      getQueryParams != null &&
      typeof getQueryParams === 'object'
        ? (getQueryParams as Record<string, any>)
        : {}

    let response
    try {
      response = await this.dispatchHttpMethod(method, url, queryParams, data)

      const content = response.content as
        | Record<string, unknown>
        | null
        | undefined

      this.handleForceRetryOffer(operation, content)

      if (response.status >= 200 && response.status < 300) {
        return response.content
      }

      const apiCallFailedMessage = getMessageFromResponseContent(
        content ?? {},
        'An error occurred while saving your data. Please try again',
      )
      throw new Error(apiCallFailedMessage)
    } catch (error) {
      if (isForceRetryOfferError(error)) throw error
      console.error(`Error performing ${operation}:`, error)
      throw error
    }
  }

  private appendForceParam(
    url: string,
    operation: TableOperation,
    operationOptions?: { force?: boolean },
  ): string {
    const forceOperations = [
      TableOperation.OVERWRITE_ALL,
      TableOperation.DELETE_ITEM,
      TableOperation.DELETE_BULK,
      TableOperation.DELETE_ALL,
    ]
    if (forceOperations.includes(operation) && operationOptions?.force === true) {
      return url + (url.includes('?') ? '&force=true' : '?force=true')
    }
    return url
  }

  private async dispatchHttpMethod(
    method: string,
    url: string,
    queryParams: Record<string, any>,
    data: any,
  ): Promise<any> {
    switch (method) {
      case 'get':
        return client.get(url, queryParams, {}, true)
      case 'post':
        return client.post(url, data, {}, true)
      case 'put':
        return client.put(url, data, {}, true)
      case 'patch':
        // Use put for patch operations since API client doesn't have patch method
        return client.put(url, data, {}, true)
      case 'delete':
        return client.remove(url, {}, true, data)
      default: {
        const unsupportedMethodMessage = this.t
          ? this.t('table.repository.unsupportedHttpMethod')
          : 'An error occurred while processing your request'
        throw new Error(unsupportedMethodMessage)
      }
    }
  }

  private handleForceRetryOffer(
    operation: TableOperation,
    content: Record<string, unknown> | null | undefined,
  ): void {
    const forceRetryOperations = [
      TableOperation.OVERWRITE_ALL,
      TableOperation.DELETE_ITEM,
      TableOperation.DELETE_BULK,
      TableOperation.DELETE_ALL,
    ]
    const offerForceRetry =
      forceRetryOperations.includes(operation) &&
      content?.offer_force_retry === true

    if (offerForceRetry) {
      const displayMessage = getMessageFromResponseContent(
        content,
        'An error occurred while saving your data. Please try again',
      )
      const rawMessage = content.message as
        | string
        | Record<string, string>
        | undefined
      throw new ForceRetryOfferError(
        displayMessage,
        true,
        typeof rawMessage === 'object' && rawMessage != null
          ? rawMessage
          : displayMessage,
      )
    }
  }

  /**
   * Get all items (list endpoint).
   * Query params (limit, offset, date range, column filters) are sent as GET query string.
   * Keys should match the parameter names defined in the path (e.g. limit, offset, fecha_gte, fecha_lte, tipo_programa).
   */
  async getList(queryParams?: Record<string, any>): Promise<any[]> {
    return this.performOperation(TableOperation.GET_LIST, {
      queryParams: queryParams ?? {},
    })
  }

  // Get a single item by ID
  async getItem(id: string | number): Promise<any> {
    return this.performOperation(TableOperation.GET_ITEM, { idx: id })
  }

  // Create a new item
  async createItem(itemData: any): Promise<any> {
    return this.performOperation(TableOperation.POST_ITEM, {}, itemData)
  }

  // Update an existing item by ID (partial update)
  async patchItem(id: string | number, itemData: any): Promise<any> {
    return this.performOperation(
      TableOperation.PATCH_ITEM,
      { idx: id },
      itemData,
    )
  }

  // Replace an existing item by ID (full update)
  async updateItem(id: string | number, itemData: any): Promise<any> {
    return this.performOperation(TableOperation.PUT_ITEM, { idx: id }, itemData)
  }

  // Alias for updateItem to match component usage
  async putItem(id: string | number, itemData: any): Promise<any> {
    return this.updateItem(id, itemData)
  }

  // Create multiple new items
  async createBulk(items: any[]): Promise<any> {
    return this.performOperation(TableOperation.POST_BULK, {}, items)
  }

  // Update multiple existing items
  async updateBulk(items: any[]): Promise<any> {
    return this.performOperation(TableOperation.POST_UPDATE_BULK, {}, items)
  }

  // Delete an item by ID. When the backend returns offer_force_retry, the UI should show the message and on user confirmation call again with options: { force: true }.
  async deleteItem(
    id: string | number,
    options?: { force?: boolean },
  ): Promise<any> {
    return this.performOperation(
      TableOperation.DELETE_ITEM,
      { idx: id },
      null,
      options,
    )
  }

  /**
   * Normalize IDs so numeric strings are sent as integers (e.g. from getPendingDeletes).
   * Keeps non-numeric strings (e.g. UUIDs) and existing numbers as-is.
   */
  private static normalizeIdsForBulk(
    ids: (string | number)[],
  ): (string | number)[] {
    return ids.map((id) => {
      if (typeof id === 'number' && Number.isInteger(id)) return id
      if (typeof id === 'string') {
        const n = Number(id)
        if (Number.isInteger(n) && String(n) === id.trim()) return n
      }
      return id
    })
  }

  // Delete multiple items by IDs. When the backend returns offer_force_retry, the UI should show the message and on user confirmation call again with options: { force: true }.
  async deleteBulk(
    ids: (string | number)[],
    options?: { force?: boolean },
  ): Promise<any> {
    const normalizedIds = TableRepository.normalizeIdsForBulk(ids)
    return this.performOperation(
      TableOperation.DELETE_BULK,
      {},
      { ids: normalizedIds },
      options,
    )
  }

  // Delete all items. When the backend returns offer_force_retry, the UI should show the message and on user confirmation call again with options: { force: true }.
  async deleteAll(options?: { force?: boolean }): Promise<any> {
    return this.performOperation(TableOperation.DELETE_ALL, {}, null, options)
  }

  // Overwrite all items. When the backend returns offer_force_retry (e.g. dependent items),
  // the UI should show the message and on user confirmation call again with options: { force: true }.
  async overwriteAll(
    items: any[],
    options?: { force?: boolean },
  ): Promise<any> {
    return this.performOperation(
      TableOperation.OVERWRITE_ALL,
      {},
      items,
      options,
    )
  }

  // Restore all previously deleted items
  async restoreAll(): Promise<any> {
    return this.performOperation(TableOperation.RESTORE_ALL)
  }

  // Helper method to get supported operations
  getSupportedOperations(): TableOperation[] {
    const operations: TableOperation[] = []

    Object.values(TableOperation).forEach((operation) => {
      if (isOperationSupported(this.tableConfig, operation)) {
        operations.push(operation)
      }
    })

    return operations
  }

  // Helper method to check if an operation is supported
  isOperationSupported(operation: TableOperation): boolean {
    return isOperationSupported(this.tableConfig, operation)
  }

  /**
   * Download Excel from backend when `download_excel_table` is defined in automation.
   * Query params should match get_list filter params (same names as path.parameters).
   */
  async downloadExcel(
    queryParams?: Record<string, string | number | boolean | undefined>,
  ): Promise<void> {
    if (
      !isOperationSupported(this.tableConfig, TableOperation.DOWNLOAD_EXCEL)
    ) {
      const message = this.t
        ? this.t('table.repository.operationNotSupported')
        : 'This action is not available for this table'
      throw new Error(message)
    }

    const operationConfig = getOperationConfig(
      this.tableConfig,
      TableOperation.DOWNLOAD_EXCEL,
    )
    const method = (operationConfig.http_method || 'GET').toLowerCase()
    if (method !== 'get') {
      const message = this.t
        ? this.t('table.repository.unsupportedHttpMethod')
        : 'An error occurred while processing your request'
      throw new Error(message)
    }

    const url = buildApiUrl(operationConfig.url, {})
    const flat = flattenQueryParams(queryParams)

    const { status, blob, filename } = await client.getBlob(url, flat, true)
    if (status < 200 || status >= 300) {
      const defaultMsg =
        this.t?.('table.messages.errorDownloadExcelTable') ?? 'Download failed'
      const errMsg = await parseErrorFromBlob(blob, defaultMsg)
      throw new Error(errMsg)
    }

    const safeName =
      filename ||
      `${String(this.tableConfig?.title ?? 'export')}.xlsx`.replaceAll(
        /[^\w.-]+/g,
        '_',
      )
    const objectUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = objectUrl
    a.download = safeName
    a.click()
    URL.revokeObjectURL(objectUrl)
  }

  /**
   * Maps a bulk upload UI operation (post_bulk / post_update_bulk / overwrite_all) to its
   * async automation counterpart. A table declares either the sync ops or the async ops.
   */
  static readonly ASYNC_OPERATION_BY_BULK_UI: Record<string, TableOperation> = {
    post_bulk: TableOperation.ASYNC_POST_BULK,
    post_update_bulk: TableOperation.ASYNC_POST_UPDATE_BULK,
    overwrite_all: TableOperation.ASYNC_OVERWRITE_ALL,
  }

  /**
   * True when the table declares the async counterpart of the given bulk UI operation AND the
   * `async_upload_status` polling endpoint. Both are required for the async flow; when the
   * status endpoint is missing the caller should fall back to the synchronous path rather than
   * start an upload it cannot track.
   */
  supportsAsyncBulkOperation(uiOperation: string): boolean {
    const asyncOp = TableRepository.ASYNC_OPERATION_BY_BULK_UI[uiOperation]
    return (
      !!asyncOp &&
      isOperationSupported(this.tableConfig, asyncOp) &&
      isOperationSupported(this.tableConfig, TableOperation.ASYNC_UPLOAD_STATUS)
    )
  }

  /**
   * Start an async bulk upload: POST a raw (unprocessed) file as multipart form-data
   * (field `file`) to one of the async operations. The backend launches an Airflow job and
   * responds 202 with an `upload_id`; use `pollAsyncUploadUntilTerminal` to track progress.
   */
  async startAsyncBulkUpload(
    operation: TableOperation,
    file: File,
  ): Promise<AsyncUploadInitResponse> {
    if (!isOperationSupported(this.tableConfig, operation)) {
      const message = this.t
        ? this.t('table.repository.operationNotSupported')
        : 'This action is not available for this table'
      throw new Error(message)
    }

    const operationConfig = getOperationConfig(this.tableConfig, operation)
    const url = buildApiUrl(operationConfig.url, {})

    const formData = new FormData()
    formData.append('file', file, file.name || 'upload.xlsx')

    const response = await client.post(url, formData, {}, true)
    const content = response.content as Record<string, unknown> | null | undefined

    if (response.status >= 200 && response.status < 300) {
      const uploadId =
        (content?.upload_id as string | undefined) ??
        (content?.uploadId as string | undefined)
      if (typeof uploadId !== 'string' || !uploadId) {
        throw new Error(
          getMessageFromResponseContent(
            content ?? {},
            'Upload did not return an upload_id',
          ),
        )
      }
      return {
        upload_id: uploadId,
        dag_run_id:
          typeof content?.dag_run_id === 'string'
            ? content.dag_run_id
            : undefined,
        status:
          typeof content?.status === 'string'
            ? content.status
            : 'queued',
      }
    }

    const message = getMessageFromResponseContent(
      content ?? {},
      'An error occurred while uploading your file. Please try again',
    )
    throw new Error(message)
  }

  /**
   * Fetch the status of an async upload by `upload_id` (GET). The status URL declares an
   * `{upload_id}` placeholder in the automation schema.
   */
  async getAsyncUploadStatus(
    uploadId: string,
  ): Promise<AsyncUploadStatusResponse> {
    if (
      !isOperationSupported(this.tableConfig, TableOperation.ASYNC_UPLOAD_STATUS)
    ) {
      const message = this.t
        ? this.t('table.repository.operationNotSupported')
        : 'This action is not available for this table'
      throw new Error(message)
    }

    const operationConfig = getOperationConfig(
      this.tableConfig,
      TableOperation.ASYNC_UPLOAD_STATUS,
    )
    const url = buildApiUrl(operationConfig.url, { upload_id: uploadId })

    const response = await client.get(url, {}, {}, true)
    const content = response.content as
      | (AsyncUploadStatusResponse & Record<string, unknown>)
      | null
      | undefined

    if (
      response.status >= 200 &&
      response.status < 300 &&
      content &&
      typeof content === 'object'
    ) {
      return content as AsyncUploadStatusResponse
    }

    if (response.status === 404) {
      throw new Error(
        this.t?.('table.messages.asyncUploadNotFound') ?? 'Upload not found',
      )
    }

    const message = getMessageFromResponseContent(
      (content as Record<string, unknown>) ?? {},
      'Could not retrieve upload status',
    )
    throw new Error(message)
  }

  /**
   * Poll async upload status until a terminal state (completed/failed) is reached.
   * `onProgress` is called after each poll so the UI can show `total_rows_loaded`.
   * `shouldContinue` lets the caller cancel polling (e.g. when the view is deactivated);
   * when it returns false, polling stops and the latest known status is returned.
   */
  async pollAsyncUploadUntilTerminal(
    uploadId: string,
    options?: {
      onProgress?: (status: AsyncUploadStatusResponse) => void
      intervalMs?: number
      shouldContinue?: () => boolean
    },
  ): Promise<AsyncUploadStatusResponse> {
    const intervalMs = options?.intervalMs ?? 2000
    const shouldContinue = options?.shouldContinue ?? (() => true)

    let lastStatus: AsyncUploadStatusResponse | null = null
    while (shouldContinue()) {
      lastStatus = await this.getAsyncUploadStatus(uploadId)
      options?.onProgress?.(lastStatus)
      if (isAsyncUploadTerminal(lastStatus.status)) {
        return lastStatus
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs))
    }

    // Cancelled before reaching a terminal state: return the latest known status
    // (or fetch once if polling was cancelled before the first poll).
    return lastStatus ?? (await this.getAsyncUploadStatus(uploadId))
  }
}
