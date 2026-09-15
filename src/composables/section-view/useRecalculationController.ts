/**
 * useRecalculationController.ts — CORE consumption point for the recalculation controller.
 *
 * `useTableData` and `SectionView` obtain the recalculation controller HERE without knowing about
 * the premium module: they request it from the registry (§3.7 `capabilities.recalculation`). If no
 * module provides it (build without recalculation), it returns an INERT implementation so the core
 * keeps working the same. The contract lives in `@/types/recalculation`.
 */
import { getPremiumRecalculation } from '@cornflow-ui/core/plugins/extensions'
import type { RecalculationController } from '@cornflow-ui/core/types/recalculation'

/** Inert controller: no-op notifications, solution recalculation rejects, name = baseName. */
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
 * Returns the recalculation controller: the premium implementation if the
 * `recalculation` module is registered, or an inert one otherwise. Call within a
 * setup context / active Pinia.
 */
export function useRecalculationController(): RecalculationController {
  return getPremiumRecalculation() ?? createInertRecalculationController()
}
