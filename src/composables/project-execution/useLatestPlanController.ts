/**
 * useLatestPlanController.ts — CORE consumption point for the "current plan" controller.
 *
 * `ProjectExecutionsTable` obtains the latest-plan controller HERE without knowing about the
 * premium module: it requests it from the registry (§3.7 `capabilities.latestPlan`). If no module
 * provides it (build without latest-plan), it returns an INERT implementation (action unavailable, no modal).
 * The contract lives in `@/types/latestPlan`.
 */
import { getPremiumLatestPlan } from '@cornflow-ui/core/plugins/extensions'
import type { LatestPlanController } from '@cornflow-ui/core/types/latestPlan'

/** Inert controller: the "set as current plan" action is unavailable and there is no modal. */
function createInertLatestPlanController(): LatestPlanController {
  return {
    isSetLatestPlanAvailable: () => false,
    isLatestPlan: () => false,
    canSetAsLatestPlan: () => false,
    setLatestPlanModalComponent: null,
  }
}

/**
 * Returns the latest-plan controller: the premium implementation if the `latest-plan` module
 * is registered, or an inert one otherwise. Call within a setup context / active Pinia.
 */
export function useLatestPlanController(): LatestPlanController {
  return getPremiumLatestPlan() ?? createInertLatestPlanController()
}
