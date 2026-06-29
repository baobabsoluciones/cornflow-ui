/**
 * Pure helpers that map pending table edits to canonical
 * `parameters_from_db` keys for the ETL update metadata. Extracted from
 * SectionView.vue; the pending-changes source is injected via `deps`.
 */

import { normalizeTableNameForEtlLookup } from '@cornflow-ui/core/utils/schemaUtils'

/** Synthetic row id for single-row (horizontal/object) tables. */
export const ETL_OBJECT_ROW_ID = '__object__'

/** Finds the actual instance-data key matching a (possibly differently-cased) modified key. */
export function resolveInstanceDataKeyForChangeKey(
  instanceData: Record<string, any>,
  modifiedKey: string,
): string | null {
  const target = normalizeTableNameForEtlLookup(modifiedKey)
  for (const dk of Object.keys(instanceData)) {
    if (dk.startsWith('__')) continue
    if (normalizeTableNameForEtlLookup(dk) === target) return dk
  }
  return null
}

/**
 * Adds the canonical parameter keys produced by a single modified table's changes
 * into `out`, using the normalized `dataKey.<field|rowId>` lookup map.
 */
export function collectEtlParameterKeysForTable(
  changes: Record<string, any>,
  dataKey: string,
  metaByNorm: Map<string, string>,
  out: Set<string>,
): void {
  const norm = normalizeTableNameForEtlLookup

  const horizontal = changes[ETL_OBJECT_ROW_ID]
  if (horizontal && typeof horizontal === 'object') {
    for (const fieldKey of Object.keys(horizontal)) {
      const canonical = metaByNorm.get(norm(`${dataKey}.${fieldKey}`))
      if (canonical) out.add(canonical)
    }
    return
  }

  for (const rowId of Object.keys(changes)) {
    if (rowId === ETL_OBJECT_ROW_ID) continue
    const canonical = metaByNorm.get(norm(`${dataKey}.${rowId}`))
    if (canonical) out.add(canonical)
  }
}

export interface CollectEditedEtlDeps {
  /** Keys of tables with pending changes (e.g. tableChanges.modifiedTableKeys.value). */
  modifiedTableKeys: readonly string[]
  /** Returns the pending changes for a table key. */
  getChangesForTable: (key: string) => Record<string, any> | null | undefined
}

/**
 * Maps pending cell edits to canonical `parameters_from_db` keys for
 * POST /etl/update/ `additional_metadata`.
 */
export function collectEditedEtlParameterKeysFromPendingChanges(
  instanceData: Record<string, any>,
  parametersFromDb: readonly string[],
  deps: CollectEditedEtlDeps,
): string[] {
  if (!parametersFromDb.length) return []
  const norm = normalizeTableNameForEtlLookup
  const metaByNorm = new Map<string, string>()
  for (const pk of parametersFromDb) {
    metaByNorm.set(norm(pk), pk)
  }
  const out = new Set<string>()

  for (const mk of deps.modifiedTableKeys) {
    const dataKey = resolveInstanceDataKeyForChangeKey(instanceData, mk)
    if (dataKey == null) continue
    const changes = deps.getChangesForTable(mk)
    if (!changes) continue
    collectEtlParameterKeysForTable(changes, dataKey, metaByNorm, out)
  }
  return [...out]
}
