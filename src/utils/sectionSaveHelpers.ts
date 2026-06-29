/**
 * Pure helpers used by SectionView's save flows. Extracted so the
 * error-message derivation and storage-key config lookup can be unit-tested
 * without the view. i18n `t` is injected as a `fallback` string and the
 * configuration object is passed in explicitly.
 */

import {
  getMessageFromResponseContent,
  getLocalizedMessage,
} from '@/utils/i18nUtils'
import { normalizeTableKey } from '@/utils/sectionModalResolvers'

/**
 * Derives a user-facing message from an error: prefers `err.message`, then a
 * localized response body message, then `fallback`.
 */
export function getErrorMessage(err: any, fallback: string): string {
  const fromContent =
    err?.response?.content == null
      ? ''
      : getMessageFromResponseContent(err.response.content, '')
  const raw =
    (err?.message ?? fromContent) ||
    (err?.response?.content?.message ?? err?.response?.data?.message)
  if (typeof raw === 'string') return raw
  if (raw && typeof raw === 'object') return getLocalizedMessage(raw)
  return fallback
}

/** Finds a configuration entry by its normalized storage key. */
export function getConfigByStorageKey(config: any, storageKey: string): any {
  if (!config || typeof config !== 'object') return null
  const key = Object.keys(config).find((k) => normalizeTableKey(k) === storageKey)
  return key ? config[key] : null
}
