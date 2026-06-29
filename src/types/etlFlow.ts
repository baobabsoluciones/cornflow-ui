/**
 * etlFlow.ts — Contrato (CORE) del flujo de revisión ETL externo.
 *
 * El CORE define aquí la FORMA del controlador del flujo ETL que los componentes del wizard
 * consumen (vía la prop nullable `externalEtlFlow`). La IMPLEMENTACIÓN es premium
 * (`@/modules/etl/useExternalEtlFlow`) y se inyecta por el registro (§3.7 capability).
 * Mantener estos tipos en core evita que los componentes del wizard importen del módulo premium.
 */
import type { ComputedRef } from 'vue'

/**
 * Origen/estado de un switch de tabla en el flujo ETL externo.
 * - from_db: tabla cargada desde BD (switch por defecto = off / "siempre refrescar")
 * - from_excel: tabla subida como Excel (switch por defecto = on / "fija")
 * - edited_from_db: tabla venía de BD pero el usuario la editó en la UI
 * - reuploaded: el usuario re-subió un Excel reemplazando todos los datos
 */
export type TableSwitchVariant =
  | 'from_db'
  | 'from_excel'
  | 'edited_from_db'
  | 'reuploaded'

export interface TableSwitchState {
  variant: TableSwitchVariant
  fixed: boolean | null
}

export interface ExternalEtlFlowState {
  initialData: Record<string, any> | null
  currentData: Record<string, any> | null
  metadata: {
    tables_from_db: string[]
    parameters_from_db: string[]
  } | null
  tableSwitches: Record<string, TableSwitchState>
  parameterSwitches: Record<string, boolean | null>
  /** Table names that contain per-parameter rows (derived from parameters_from_db keys). */
  parameterTableNames: Set<string>
}

export interface EtlUpdateResult {
  /** Final instance data returned by `POST /etl/update/`. */
  data: Record<string, any>
  /** Optional non-blocking message from the ETL backend, resolved to the current locale. */
  warning: string | null
}

/**
 * Controlador del flujo ETL: lo devuelve el composable premium `useExternalEtlFlow` y lo consume
 * el wizard (a través de `useEtlFlowController`, que cae a una implementación inerte sin ETL).
 */
export interface ExternalEtlFlowController {
  state: ExternalEtlFlowState
  isActive: ComputedRef<boolean>
  initializeFromEtlResponse: (data: Record<string, any>) => void
  markTableEdited: (tableName: string) => void
  markAllReuploaded: () => void
  setTableFixed: (tableName: string, value: boolean | null) => void
  setParameterFixed: (paramKey: string, value: boolean | null) => void
  buildAdditionalMetadata: () => {
    tables: Record<string, boolean | null>
    parameters: Record<string, boolean | null>
  }
  submitUpdate: (currentData: Record<string, any>) => Promise<EtlUpdateResult>
  reset: () => void
}
