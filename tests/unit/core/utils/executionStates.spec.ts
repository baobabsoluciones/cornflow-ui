import { describe, test, expect } from 'vitest'
import { ExecutionState, FAILED_STATES, isExecutionActive } from '@cornflow-ui/core/utils/executionStates'

describe('executionStates', () => {
  test('an execution is active while it is queued or running', () => {
    expect(isExecutionActive(ExecutionState.Queued)).toBe(true)
    expect(isExecutionActive(ExecutionState.Running)).toBe(true)
    expect(isExecutionActive(ExecutionState.Solved)).toBe(false)
    expect(isExecutionActive(ExecutionState.Error)).toBe(false)
    expect(isExecutionActive(null)).toBe(false)
    expect(isExecutionActive(undefined)).toBe(false)
  })

  test('the failed states are the ones that end without a solution', () => {
    expect([...FAILED_STATES].sort((a, b) => a - b)).toEqual([-6, -5, -3, -2, -1])
    for (const state of [ExecutionState.Solved, ExecutionState.SolutionLoaded, ExecutionState.NotRun]) {
      expect(FAILED_STATES).not.toContain(state)
    }
  })
})
