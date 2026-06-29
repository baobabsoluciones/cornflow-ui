/**
 * useRecalculationController.ts — Punto de consumo (CORE) del controlador de recalculación.
 *
 * `useTableData` y `SectionView` obtienen AQUÍ el controlador de recalculación sin conocer el
 * módulo premium: lo piden al registro (§3.7 `capabilities.recalculation`). Si ningún módulo lo
 * aporta (build sin recalculación), devuelve una implementación INERTE para que el core funcione
 * igual. El contrato vive en `@/types/recalculation`.
 */
import { getPremiumRecalculation } from '@/plugins/extensions'
import type { RecalculationController } from '@/types/recalculation'

/** Controlador inerte: notificaciones no-op, recalculación de solución rechaza, nombre = baseName. */
function createInertRecalculationController(): RecalculationController {
  return {
    checkPlanDataAfterMasterDataChange: () => Promise.resolve(),
    runSolutionRecalculation: () =>
      Promise.reject(
        new Error('Recalculation is not available (premium module not enabled)'),
      ),
    buildRecalculationExecutionName: (baseName) =>
      String(baseName ?? '').trim() || 'Recalculated',
  }
}

/**
 * Devuelve el controlador de recalculación: la implementación premium si el módulo
 * `recalculation` está registrado, o una inerte en caso contrario. Llamar en contexto de
 * setup / Pinia activo.
 */
export function useRecalculationController(): RecalculationController {
  return getPremiumRecalculation() ?? createInertRecalculationController()
}
