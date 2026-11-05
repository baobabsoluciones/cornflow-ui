import type { CoreTone } from '@cornflow-ui/core/types/ui'
import type { LoadedExecution } from '@cornflow-ui/core/models/LoadedExecution'

/** A badge of the execution summary: a short state or tag in a tone; `title` is its tooltip. */
export interface ExecutionSummaryBadge {
  label: string
  tone: CoreTone
  title?: string
  /** Something in progress: a spinner instead of the dot. */
  spin?: boolean
}

/** What the summary says of the loaded execution: a line under its name, and badges beside it. */
export interface ExecutionSummaryContent {
  meta: string
  badges: ExecutionSummaryBadge[]
}

/**
 * An app's own summary (`parameters.executionSummary` of the app config). It gets the loaded
 * execution and what the core shows, and returns what it changes: a field it leaves out keeps
 * the core's.
 */
export type ExecutionSummaryResolver = (
  execution: LoadedExecution,
  defaults: ExecutionSummaryContent,
) => Partial<ExecutionSummaryContent>
