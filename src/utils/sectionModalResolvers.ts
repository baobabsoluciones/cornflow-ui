/**
 * Pure helpers for resolving the review-modal's current key, rows data and
 * table headers across single / group / recalculation modes. Extracted from
 * SectionView.vue; all state is passed in as arguments.
 */

/** Lowercases a table key and turns hyphens into underscores (canonical form). */
export function normalizeTableKey(key: string): string {
  if (!key) return ''
  return String(key).toLowerCase().replaceAll('-', '_')
}

/** Resolves the canonical key of the table currently shown in the modal. */
export function resolveCurrentModalKey(
  isGroup: boolean,
  selectedTable: string | null | undefined,
  effectiveKey: string | null | undefined,
): string {
  if (isGroup && selectedTable) return normalizeTableKey(selectedTable)
  return effectiveKey ? normalizeTableKey(effectiveKey) : ''
}

/** Resolves the rows data for a key, preferring live vs cached per mode. */
export function resolveRowsDataForKey(
  key: string,
  currentKey: string,
  isRecalculation: boolean,
  isGroup: boolean,
  liveRowsData: Record<string, Record<string, any>>,
  recalcCache: Record<string, any>,
  groupCache: Record<string, any>,
): Record<string, any> {
  if (isRecalculation) {
    const live = liveRowsData[key]
    const cached = recalcCache[key]?.rowsData
    return key === currentKey ? (live ?? cached ?? {}) : (cached ?? live ?? {})
  }
  if (isGroup) {
    const cached = groupCache[key]?.rowsData?.[key]
    const current = key === currentKey ? liveRowsData[key] : undefined
    return cached ?? current ?? {}
  }
  return key === currentKey ? (liveRowsData[key] ?? {}) : {}
}

/** Resolves the table headers for a key, preferring live vs cached per mode. */
export function resolveTableHeadersForKey(
  key: string,
  currentKey: string,
  isRecalculation: boolean,
  isGroup: boolean,
  liveHeaders: Record<string, Array<{ key: string; title: string; type?: string }>>,
  recalcCache: Record<string, any>,
  groupCache: Record<string, any>,
): Array<{ key: string; title: string; type?: string }> {
  if (isRecalculation) {
    const live = liveHeaders[key]
    const cached = recalcCache[key]?.tableHeaders
    const preferLive = Array.isArray(live) && live.length > 0 ? live : cached ?? []
    const preferCached = Array.isArray(cached) && cached.length > 0 ? cached : live ?? []
    return key === currentKey ? preferLive : preferCached
  }
  if (isGroup) {
    const cached = groupCache[key]?.tableHeaders?.[key]
    const current = key === currentKey ? liveHeaders[key] : undefined
    return cached ?? current ?? []
  }
  return key === currentKey ? (liveHeaders[key] ?? []) : []
}
