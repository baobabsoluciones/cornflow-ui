import { describe, test, expect, vi } from 'vitest'
import { computed } from 'vue'

vi.mock('@cornflow-ui/core/composables/project-execution-table/useExecutionState', () => ({
  useExecutionState: () => ({
    stateInfo: computed(() => ({})),
    solutionStateInfo: computed(() => ({})),
    getStateInfo: (state: number) => ({
      code: `state ${state}`,
      message: '',
      color: state === 1 ? 'green' : 'red',
    }),
    getSolutionInfo: (solution: { status_code: number } | null) => ({
      code: `solution ${solution?.status_code}`,
      message: '',
      color: 'orange',
    }),
  }),
}))

import { useExecutionStatus } from '@cornflow-ui/core/composables/project-execution/useExecutionStatus'

describe('useExecutionStatus · displayStatus', () => {
  const { displayStatus } = useExecutionStatus()

  test('a finished execution reads as its solution', () => {
    expect(displayStatus(1, 2)).toMatchObject({ label: 'solution 2', tone: 'warning', spin: false })
  })

  test('a finished execution without a solution state reads as its own state', () => {
    expect(displayStatus(1, null)).toMatchObject({ label: 'state 1', tone: 'success' })
  })

  test('any other execution reads as its own state, whatever its solution', () => {
    expect(displayStatus(-1, 2)).toMatchObject({ label: 'state -1', tone: 'danger' })
    expect(displayStatus(0, null)).toMatchObject({ tone: 'primary', spin: true })
  })
})
