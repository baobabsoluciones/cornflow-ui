/**
 * Temporary ids of the rows added in the browser and not saved yet, and the order the saves of
 * several tables need when the rows added in one refer to rows added in another.
 */

import { parseJoinFrom, getListResponseRowProperties } from '@cornflow-ui/core/utils/schemaUtils'

const TEMP_ID_PREFIX = 'create-'

/** The temporary id of a row added to a table, `create-<tableKey>-<index>-<time>`. */
export function newTempId(tableKey: string, index: number): string {
  return `${TEMP_ID_PREFIX}${tableKey}-${index}-${Date.now()}`
}

/** Whether an id is the temporary id of a row added and not saved yet. */
export function isTempId(id: unknown): id is string {
  return typeof id === 'string' && id.startsWith(TEMP_ID_PREFIX)
}

/** Extracts the table key embedded in a `create-<tableKey>-<...>` temp id. */
export function getTableKeyFromTempId(tempId: string): string | null {
  if (!isTempId(tempId)) return null
  const parts = tempId.split('-')
  if (parts.length < 3) return null
  return parts.slice(1, -2).join('-') || null
}

/** Topological sort: tables that are referenced (via temp ids in creates) come first. */
export function sortKeysByCreateDependency(
  keys: string[],
  getCreates: (key: string) => Array<{ data: Record<string, any> }>,
): string[] {
  const keySet = new Set(keys)
  const deps = new Map<string, Set<string>>()
  keys.forEach((k) => deps.set(k, new Set()))
  keys.forEach((storageKey) => {
    const creates = getCreates(storageKey) || []
    creates.forEach(({ data }) => {
      Object.values(data || {}).forEach((val) => {
        const ref = getTableKeyFromTempId(String(val))
        if (ref && ref !== storageKey && keySet.has(ref)) {
          deps.get(storageKey).add(ref)
        }
      })
    })
  })
  const result: string[] = []
  const added = new Set<string>()
  while (result.length < keys.length) {
    let picked: string | null = null
    for (const k of keys) {
      if (added.has(k)) continue
      const depSet = deps.get(k)
      const allDepAdded = [...depSet].every((d) => added.has(d))
      if (allDepAdded) {
        picked = k
        break
      }
    }
    if (picked == null) break
    result.push(picked)
    added.add(picked)
  }
  keys.forEach((k) => {
    if (!added.has(k)) result.push(k)
  })
  return result
}

/** Get the FK field name in this table that references the given table. */
export function getFkFieldNameForReferencedTable(
  tableConfig: any,
  referencedTableKey: string,
): string | null {
  const props = getListResponseRowProperties(tableConfig)?.properties
  if (!props) return null
  const refNorm = referencedTableKey.toLowerCase().replaceAll('-', '_')
  for (const [fkField, prop] of Object.entries(props)) {
    const p = prop
    if (!p?.columnsToJoin || !Array.isArray(p.columnsToJoin)) continue
    for (const depKey of p.columnsToJoin) {
      const dep = props[depKey]
      const joinFrom = dep?.joinFrom
      if (!joinFrom) continue
      const joinInfo = parseJoinFrom(joinFrom)
      if (!joinInfo) continue
      const tableNorm = joinInfo.table.toLowerCase().replaceAll('-', '_')
      if (tableNorm === refNorm) return fkField
    }
  }
  return null
}

/** Replace any temp id in payload with the real id; use correct FK field name. */
export function resolveTempIdsInPayload(
  payload: Record<string, any>,
  tempIdToRealId: Record<string, string | number>,
  tableConfig: any,
): Record<string, any> {
  const out = { ...payload }
  for (const key of Object.keys(out)) {
    const val = out[key]
    if (
      !isTempId(val) ||
      !(val in tempIdToRealId)
    )
      continue
    const realId = tempIdToRealId[val]
    const refTable = getTableKeyFromTempId(val)
    const fkFieldName =
      refTable && tableConfig
        ? getFkFieldNameForReferencedTable(tableConfig, refTable)
        : null
    const targetKey = fkFieldName || key
    if (targetKey !== key) {
      delete out[key]
    }
    out[targetKey] = realId
  }
  return out
}
