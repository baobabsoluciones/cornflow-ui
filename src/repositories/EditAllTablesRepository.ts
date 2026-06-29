import client from '@cornflow-ui/core/api/Api'
import type { EditAllTablesApiOperation } from '@cornflow-ui/core/types/frontendAutomation'
import {
  ForceRetryOfferError,
  responseBodyOffersForceRetry,
} from '@cornflow-ui/core/repositories/TableRepository'
import {
  getLocalizedMessage,
  getMessageFromResponseContent,
} from '@cornflow-ui/core/utils/i18nUtils'

const LOCALE_KEYS = ['en', 'es', 'fr', 'de', 'it', 'pt', 'ja']

function isTranslationObject(value: unknown): value is Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const obj = value as Record<string, unknown>
  return LOCALE_KEYS.some((key) => typeof obj[key] === 'string')
}

/**
 * Builds a user-visible string from edit-all-tables error bodies where `message` may be
 * a per-table map rather than a single phrase.
 */
export function buildEditAllTablesErrorMessage(
  content: unknown,
  fallback: string = 'An error occurred',
): string {
  if (
    content == null ||
    typeof content !== 'object' ||
    Array.isArray(content)
  ) {
    return getMessageFromResponseContent(content, fallback)
  }
  const c = content as Record<string, unknown>
  const msg = c.message
  if (typeof msg === 'string') return msg
  if (msg && typeof msg === 'object' && !Array.isArray(msg)) {
    const o = msg as Record<string, unknown>
    if (isTranslationObject(o)) return getLocalizedMessage(o, fallback)
    const keys = Object.keys(o)
    if (keys.length > 0) {
      return keys
        .map((k) => {
          const v = o[k]
          return `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`
        })
        .join('\n')
    }
  }
  return getMessageFromResponseContent(content, fallback)
}

function normalizeStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.filter((x): x is string => typeof x === 'string')
}

/** Append `force` as the JSON literal `true` (offer_force_retry without table lists). */
function appendForceTrue(formData: FormData): void {
  formData.append('force', JSON.stringify(true))
}

/** Append `force` as a JSON array of table keys, when non-empty. */
function appendForceList(formData: FormData, force: string[] | undefined): void {
  if (force != null && force.length > 0) {
    formData.append('force', JSON.stringify(force))
  }
}

function throwForceRetryOrGenericError(
  operation: EditAllTablesApiOperation,
  content: unknown,
  displayMessage: string,
  rawMessageForError: string | Record<string, string>,
): never {
  const forceKeys = normalizeStringArray(
    (content as Record<string, unknown>)?.offer_force_retry,
  )
  const retryKeys = normalizeStringArray(
    (content as Record<string, unknown>)?.retry,
  )
  if (operation === 'overwrite_all' && responseBodyOffersForceRetry(content)) {
    throw new ForceRetryOfferError(
      displayMessage,
      true,
      rawMessageForError,
      content,
      forceKeys.length > 0 ? forceKeys : undefined,
      retryKeys.length > 0 ? retryKeys : undefined,
    )
  }
  throw new Error(displayMessage)
}

export interface PostEditAllTablesOptions {
  /** Table keys to force (JSON-encoded in multipart). */
  force?: string[]
  /** Table keys to retry (JSON-encoded in multipart). */
  retry?: string[]
  /**
   * When the API returned `offer_force_retry: true` without table lists, send
   * `force` as the JSON literal `true` (not repeated form fields).
   */
  forceBoolean?: boolean
}

/**
 * POST `/edit-all-tables/` with multipart form-data: `files` (often a single zip like ETL),
 * `operation`, and optional `force` / `retry` as JSON strings.
 */
export async function postEditAllTables(
  files: File[],
  operation: EditAllTablesApiOperation,
  options?: PostEditAllTablesOptions,
): Promise<unknown> {
  if (!files.length) {
    throw new Error('No files selected')
  }

  const formData = new FormData()
  for (const file of files) {
    const name = file.name || 'instance.xlsx'
    formData.append('files', file, name)
  }
  formData.append('operation', operation)

  const force = options?.force
  const retry = options?.retry
  if (options?.forceBoolean === true) {
    appendForceTrue(formData)
  } else {
    appendForceList(formData, force)
  }
  if (retry != null && retry.length > 0) {
    formData.append('retry', JSON.stringify(retry))
  }

  // multipart: `files` (binary or zip) + text field `operation` (`bulk` | `bulk_upload` | `overwrite`)
  const fieldCount = [...formData.keys()].length
  if (fieldCount === 0) {
    throw new Error('postEditAllTables: FormData has no fields')
  }

  const response = await client.post('/edit-all-tables/', formData, {}, true)
  const content = response.content

  if (response.status >= 200 && response.status < 300) {
    return content
  }

  const displayMessage = buildEditAllTablesErrorMessage(content)
  const rawMsg = (content as Record<string, unknown>)?.message
  const nonStringRawMessage: string | Record<string, string> =
    isTranslationObject(rawMsg) ? rawMsg : displayMessage
  const rawMessageForError: string | Record<string, string> =
    typeof rawMsg === 'string' ? rawMsg : nonStringRawMessage

  throwForceRetryOrGenericError(operation, content, displayMessage, rawMessageForError)
}

/** Maps CoreBulkUploadModal / table bulk keys to the edit-all-tables API `operation` value. */
export function mapBulkUiOperationToEditAllApi(
  uiOperation: string,
): EditAllTablesApiOperation {
  if (
    uiOperation === 'post_bulk' ||
    uiOperation === 'overwrite_all' ||
    uiOperation === 'post_update_bulk'
  ) {
    return uiOperation as EditAllTablesApiOperation
  }
  return 'post_bulk'
}
