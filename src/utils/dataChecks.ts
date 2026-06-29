/**
 * dataChecks.ts — Predicados genéricos sobre el payload de `dataChecks` de una ejecución.
 *
 * Util de CORE (no premium): la usa el flujo histórico-KPI de `general.ts` y también el módulo
 * premium de recalculación. Vive en core para que `general.ts` no importe de un módulo premium.
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
