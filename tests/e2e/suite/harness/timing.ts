/**
 * How long the suite waits for what the backend runs. A test's own timeout is for its steps; a
 * wait for the backend adds what it may take on top (`allowFor`).
 */
import { test } from '@playwright/test'

/**
 * Gives the running test `ms` more on top of its timeout, for a wait that may take that long: the
 * test's own timeout is for its steps, not for what the backend runs.
 */
export function allowFor(ms: number): void {
  test.info().setTimeout(test.info().timeout + ms)
}

/**
 * How long to wait for an execution run with `config` to end: its `timeLimit` (seconds, as
 * Cornflow's solvers take it), plus what Airflow needs to start and save it. Three minutes at
 * least.
 */
export function executionTimeout(config: Record<string, unknown>): number {
  const limit = Number(config.timeLimit)
  return Math.max(
    180_000,
    (Number.isFinite(limit) ? limit * 1000 : 0) + 120_000,
  )
}
