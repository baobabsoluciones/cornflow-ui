/**
 * useLatestPlanController.ts — Punto de consumo (CORE) del controlador de "plan actual".
 *
 * `ProjectExecutionsTable` obtiene AQUÍ el controlador de latest-plan sin conocer el módulo
 * premium: lo pide al registro (§3.7 `capabilities.latestPlan`). Si ningún módulo lo aporta
 * (build sin latest-plan), devuelve una implementación INERTE (acción no disponible, sin modal).
 * El contrato vive en `@/types/latestPlan`.
 */
import { getPremiumLatestPlan } from '@/plugins/extensions'
import type { LatestPlanController } from '@/types/latestPlan'

/** Controlador inerte: la acción "fijar como plan actual" no está disponible y no hay modal. */
function createInertLatestPlanController(): LatestPlanController {
  return {
    isSetLatestPlanAvailable: () => false,
    isLatestPlan: () => false,
    canSetAsLatestPlan: () => false,
    setLatestPlanModalComponent: null,
  }
}

/**
 * Devuelve el controlador de latest-plan: la implementación premium si el módulo `latest-plan`
 * está registrado, o una inerte en caso contrario. Llamar en contexto de setup / Pinia activo.
 */
export function useLatestPlanController(): LatestPlanController {
  return getPremiumLatestPlan() ?? createInertLatestPlanController()
}
