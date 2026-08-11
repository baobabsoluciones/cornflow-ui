/**
 * dataChecks.ts — Generic predicates over an execution's `dataChecks` payload.
 *
 * CORE util (not premium): used by the historic-KPI flow in `general.ts` and also by the
 * premium recalculation module. It lives in core so `general.ts` does not import from a premium module.
 */

/**
 * Returns true if execution `checks` payload has any non-empty table data.
 */
export function hasAnyChecksData(checks: unknown): boolean {
  if (checks == null || typeof checks !== 'object') return false
  const o = checks as Record<string, unknown>
  for (const key of Object.keys(o)) {
    const val = o[key]
    if (Array.isArray(val) && val.length > 0) return true
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      if (Object.keys(val).length > 0) return true
    }
  }
  return false
}
