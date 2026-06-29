/**
 * recalculation.ts — Contrato (CORE) del controlador de recalculación.
 *
 * El CORE define la interfaz de lo que necesita de la feature premium de recalculación
 * (replanificación tras editar master-data / solución). La IMPLEMENTACIÓN vive en
 * `@/modules/recalculation` y se inyecta por el registro (§3.7 capability). Mantener el contrato
 * en core evita que `useTableData`/`SectionView` importen del módulo premium.
 */

/** Payload para lanzar una recalculación de solución (datos editados de instancia + solución). */
export interface SolutionRecalculationPayload {
  instanceData: Record<string, any>
  solutionData: Record<string, any>
  executionName: string
  executionDescription: string
  executionConfig: any
  /** Snapshot pre-edición de la instancia para `initial_data` de `POST /etl/update/` (recalc + ETL review). */
  etlInstanceDataBeforeEdits?: Record<string, any>
  /** Claves top-level de `instance.data` que el usuario editó (para `additional_metadata.tables`). */
  etlEditedInstanceTableDataKeys?: string[]
  /** Claves canónicas de `__metadata__.parameters_from_db` para los parámetros editados. */
  etlEditedParametersFromDbKeys?: string[]
}

/**
 * Controlador de recalculación: lo aporta el módulo premium y lo consume el core (vía
 * `useRecalculationController`, que cae a una implementación inerte si no hay módulo).
 */
export interface RecalculationController {
  /**
   * Tras editar master-data: notifica al flujo de recalculación (puede mostrar el banner de
   * "replanificación pendiente"). Gateado internamente por `enableRecalculationOnMasterEdit`.
   */
  checkPlanDataAfterMasterDataChange: () => Promise<void>
  /** Lanza una recalculación de solución completa con los datos de instancia/solución editados. */
  runSolutionRecalculation: (payload: SolutionRecalculationPayload) => Promise<void>
  /** Construye el nombre (con timestamp) de la ejecución de recalculación. */
  buildRecalculationExecutionName: (baseName: string | null | undefined) => string
}
