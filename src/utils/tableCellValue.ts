/**
 * Pure cell-value resolution extracted from CoreTable.vue. The joined table
 * data is injected so this can be unit-tested without the component's props.
 */

import { parseJoinFrom } from '@/utils/schemaUtils'
import { resolveTitle } from '@/utils/i18nUtils'

/**
 * Resolves the display value for a `joinFrom` cell: when the row's FK is empty
 * it uses the header's `valueNone` title; otherwise it looks up the joined row
 * in `tableData` and returns the joined field. Returns undefined when nothing
 * resolves.
 */
export function resolveJoinFromValue(
  item: any,
  header: any,
  tableData: Record<string, any[]> | undefined | null,
): any {
  const fkId = item[header.foreignKeyField]
  if (fkId == null && header?.valueNone?.title) {
    return resolveTitle(header.valueNone.title, '')
  }
  if (fkId != null && tableData) {
    const joinInfo = parseJoinFrom(header.joinFrom)
    if (joinInfo) {
      const tableRows = tableData[joinInfo.table]
      if (Array.isArray(tableRows)) {
        const fkField = header.foreignKeyField
        const row = tableRows.find(
          (r: any) =>
            String(r?.id) === String(fkId) ||
            (fkField && String(r?.[fkField]) === String(fkId)),
        )
        if (row && joinInfo.field in row) {
          return row[joinInfo.field]
        }
      }
    }
  }
  return undefined
}
