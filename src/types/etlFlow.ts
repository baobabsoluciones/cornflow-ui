/**
 * etlFlow.ts — CORE contract for the external ETL review flow.
 *
 * The CORE defines here the SHAPE of the ETL flow controller that the wizard components
 * consume (via the nullable `externalEtlFlow` prop). The IMPLEMENTATION is premium
 * (`@/modules/etl/useExternalEtlFlow`) and is injected by the registry (§3.7 capability).
 * Keeping these types in core prevents the wizard components from importing the premium module.
 */
import type { ComputedRef } from 'vue'

/**
 * Origin/state of a table switch in the external ETL flow.
 * - from_db: table loaded from DB (switch default = off / "always refresh")
 * - from_excel: table uploaded as Excel (switch default = on / "fixed")
 * - edited_from_db: table came from DB but the user edited it in the UI
 * - reuploaded: the user re-uploaded an Excel replacing all the data
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
 * ETL flow controller: returned by the premium composable `useExternalEtlFlow` and consumed by
 * the wizard (through `useEtlFlowController`, which falls back to an inert implementation without ETL).
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
