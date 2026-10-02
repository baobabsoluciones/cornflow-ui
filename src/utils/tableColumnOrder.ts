/**
 * The column order every table and every export must follow — the single rule, so the
 * interface, the Excel download and the frontend-automation tables cannot disagree.
 *
 * This module is deliberately dependency-free: `excelStyling` and the Excel Web Worker
 * import it, and anything they pull in has to run without the DOM, `vue-i18n` or any
 * other main-thread global.
 */

/**
 * Reads the schema's declared column order.
 *
 * The backend writes `order` as a list of column names. It sits next to `properties` in the
 * object that declares them, but "next to `properties`" and "next to `description`" are
 * different levels for an array table — `description` belongs to the table, `properties` to
 * its `items` — so both spellings are accepted:
 *
 *   { description, order?, items: { properties, required, order? } }
 *
 * The inner one wins, being the closer of the two to the columns it orders.
 */
export function readDeclaredColumnOrder(
  ...candidates: Array<Record<string, any> | null | undefined>
): string[] | null {
  for (const candidate of candidates) {
    const order = candidate?.order
    if (!Array.isArray(order)) continue
    const names = order.filter(
      (name): name is string => typeof name === 'string' && name.length > 0,
    )
    if (names.length > 0) return names
  }
  return null
}

/**
 * Two rules, in priority order.
 *
 * **The schema's `order` decides, when it is there.** It is the only list a backend writes
 * for the express purpose of ordering columns, so it outranks everything else.
 *
 * **Otherwise:**
 *
 *  - **With rows, the data decides.** The keys of the first row, in the order the backend
 *    sent them. A schema's `properties` order is incidental — nothing in JSON Schema makes
 *    it meaningful, and backends often emit it alphabetically — so it must not reorder
 *    anything that the data already orders.
 *  - **Without rows, `required` decides.** There is no data to read, and `required` is then
 *    the only list in the schema whose order was written deliberately.
 *
 * In every case, columns the leading list does not mention keep their relative order and
 * follow after it. A partial `order`, like a partial `required`, places the columns it names
 * and leaves the rest alone — it never removes a column, because the export would still
 * carry it and the two would disagree again.
 *
 * A name in `order` that no column answers to is dropped, so a stale schema cannot add a
 * phantom column.
 *
 * Visibility is not applied here: each caller filters with its own rule (`isFieldVisible` for
 * exports, `isParameterPropertySchemaVisible` for tables) after choosing the order.
 */
export function resolveTableColumnOrder(
  rows: any[] | null | undefined,
  itemProperties: Record<string, any> | null | undefined,
  requiredList: string[] | null | undefined,
  declaredOrder?: string[] | null,
): string[] {
  const base = resolveFallbackOrder(rows, itemProperties, requiredList)
  return applyLeadingOrder(base, declaredOrder)
}

/** Puts the columns `leading` names first, in its order; the rest follow unchanged. */
function applyLeadingOrder(
  columns: string[],
  leading: string[] | null | undefined,
): string[] {
  if (!Array.isArray(leading) || leading.length === 0) return columns

  const known = new Set(columns)
  const lead = [...new Set(leading)].filter((name) => known.has(name))
  if (lead.length === 0) return columns

  const leadSet = new Set(lead)
  return [...lead, ...columns.filter((name) => !leadSet.has(name))]
}

/** The order to use when the schema declares none. */
function resolveFallbackOrder(
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

  return applyLeadingOrder(propertyKeys, required)
}
