/**
 * latestPlan.ts — CORE contract for the "latest plan" (latest-plan) controller.
 *
 * The CORE defines what it needs from the premium latest-plan feature in the executions table:
 * a few queries (is it the latest plan?, can it be pinned?) and the modal component to confirm
 * "pin as latest plan". The IMPLEMENTATION lives in `@/modules/latest-plan` and is injected by the
 * registry (§3.7 capability). Keeping the contract in core prevents `ProjectExecutionsTable`
 * from importing the premium module (neither the store nor the modal component).
 */
import type { Component } from 'vue'

export interface LatestPlanController {
  /** Is the "pin as latest plan" action available (feature + permissions)? */
  isSetLatestPlanAvailable: () => boolean
  /** Is the given execution the latest plan? (false if the feature is not available). */
  isLatestPlan: (executionId: string) => boolean
  /** Can an execution in this state be pinned as the latest plan? */
  canSetAsLatestPlan: (state: number) => boolean
  /** Premium modal component to confirm "pin as latest plan" (null without a module). */
  setLatestPlanModalComponent: Component | null
}
