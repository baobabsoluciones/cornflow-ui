/**
 * The column order every table and every export must follow — the single rule, so the
 * interface, the Excel download and the frontend-automation tables cannot disagree.
 *
 * This module is deliberately dependency-free: `excelStyling` and the Excel Web Worker
 * import it, and anything they pull in has to run without the DOM, `vue-i18n` or any
 * other main-thread global.
 */
/**
 * Two halves:
 *
 *  - **With rows, the data decides.** The keys of the first row, in the order the backend
 *    sent them. A schema's `properties` order is incidental — nothing in JSON Schema makes
 *    it meaningful, and backends often emit it alphabetically — so it must not reorder
 *    anything that the data already orders.
 *  - **Without rows, `required` decides.** There is no data to read, and `required` is the
 *    only list in the schema whose order was written deliberately.
 *
 * Columns declared in `properties` but missing from `required` keep their relative order and
 * follow after it, so an empty table still shows every column it would show once it has data.
 * Dropping them would make a table lose columns precisely when it is empty.
 *
 * Visibility is not applied here: each caller filters with its own rule (`isFieldVisible` for
 * exports, `isParameterPropertySchemaVisible` for tables) after choosing the order.
 */
export function resolveTableColumnOrder(
  rows: any[] | null | undefined,
  itemProperties: Record<string, any> | null | undefined,
  requiredList: string[] | null | undefined,
): string[] {
  const firstRow = Array.isArray(rows)
    ? rows.find((row) => row && typeof row === 'object' && !Array.isArray(row))
    : null
  if (firstRow) return Object.keys(firstRow)

  const required = Array.isArray(requiredList)
    ? requiredList.filter((key) => typeof key === 'string')
    : []
  const propertyKeys =
    itemProperties && typeof itemProperties === 'object'
      ? Object.keys(itemProperties)
      : []

  // A schema with `required` but no declared properties still names its columns.
  if (propertyKeys.length === 0) return [...new Set(required)]

  const ordered = [...new Set(required)].filter((key) =>
    propertyKeys.includes(key),
  )
  return [...ordered, ...propertyKeys.filter((key) => !ordered.includes(key))]
}
