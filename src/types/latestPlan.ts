/**
 * latestPlan.ts — Contrato (CORE) del controlador de "plan actual" (latest-plan).
 *
 * El CORE define lo que necesita de la feature premium latest-plan en la tabla de ejecuciones:
 * unas queries (¿es el plan actual?, ¿se puede fijar?) y el componente de modal para confirmar
 * "fijar como plan actual". La IMPLEMENTACIÓN vive en `@/modules/latest-plan` y se inyecta por el
 * registro (§3.7 capability). Mantener el contrato en core evita que `ProjectExecutionsTable`
 * importe del módulo premium (ni el store ni el componente del modal).
 */
import type { Component } from 'vue'

export interface LatestPlanController {
  /** ¿Está disponible la acción "fijar como plan actual" (feature + permisos)? */
  isSetLatestPlanAvailable: () => boolean
  /** ¿Es la ejecución dada el plan actual? (false si la feature no está disponible). */
  isLatestPlan: (executionId: string) => boolean
  /** ¿Una ejecución en este estado puede fijarse como plan actual? */
  canSetAsLatestPlan: (state: number) => boolean
  /** Componente premium del modal para confirmar "fijar como plan actual" (null sin módulo). */
  setLatestPlanModalComponent: Component | null
}
