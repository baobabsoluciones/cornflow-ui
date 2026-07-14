/**
 * recalculation.ts — CORE contract for the recalculation controller.
 *
 * The CORE defines the interface of what it needs from the premium recalculation feature
 * (replanning after editing master-data / solution). The IMPLEMENTATION lives in
 * `@/modules/recalculation` and is injected by the registry (§3.7 capability). Keeping the contract
 * in core prevents `useTableData`/`SectionView` from importing the premium module.
 */

/** Payload to launch a solution recalculation (edited instance + solution data). */
export interface SolutionRecalculationPayload {
  instanceData: Record<string, any>
  solutionData: Record<string, any>
  executionName: string
  executionDescription: string
  executionConfig: any
  /** Pre-edit snapshot of the instance for `initial_data` of `POST /etl/update/` (recalc + ETL review). */
  etlInstanceDataBeforeEdits?: Record<string, any>
  /** Top-level keys of `instance.data` that the user edited (for `additional_metadata.tables`). */
  etlEditedInstanceTableDataKeys?: string[]
  /** Canonical keys of `__metadata__.parameters_from_db` for the edited parameters. */
  etlEditedParametersFromDbKeys?: string[]
}

/**
 * Recalculation controller: contributed by the premium module and consumed by the core (via
 * `useRecalculationController`, which falls back to an inert implementation if there is no module).
 */
export interface RecalculationController {
  /**
   * After editing master-data: notifies the recalculation flow (may show the
   * "pending replanning" banner). Gated internally by `enableRecalculationOnMasterEdit`.
   */
  checkPlanDataAfterMasterDataChange: () => Promise<void>
  /** Launches a full solution recalculation with the edited instance/solution data. */
  runSolutionRecalculation: (payload: SolutionRecalculationPayload) => Promise<void>
  /** Builds the name (with timestamp) of the recalculation execution. */
  buildRecalculationExecutionName: (baseName: string | null | undefined) => string
}
