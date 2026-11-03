/**
 * Execution states as Cornflow reports them (`state` of an execution). How each one reads
 * (label, message, colour) comes from `executionStates` of the app config.
 */
export const ExecutionState = {
  /** Finished with the solver's solution. */
  Solved: 1,
  /** Created with an uploaded solution instead of running the solver. */
  SolutionLoaded: 2,
  Running: 0,
  Queued: -7,
  Error: -1,
  Stopped: -2,
  NotStarted: -3,
  /** Created without running it. */
  NotRun: -4,
  UnknownError: -5,
  FailedSaving: -6,
} as const

/** Still to finish: queued or running. */
export function isExecutionActive(state: number | null | undefined): boolean {
  return state === ExecutionState.Running || state === ExecutionState.Queued
}

/** Ended without a solution. */
export const FAILED_STATES: readonly number[] = [
  ExecutionState.Error,
  ExecutionState.Stopped,
  ExecutionState.NotStarted,
  ExecutionState.UnknownError,
  ExecutionState.FailedSaving,
]
