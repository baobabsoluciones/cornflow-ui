import { describe, test, expect } from 'vitest'
import { isEntryVisibleFor } from '@cornflow-ui/core/utils/navigationGating'

const planner = { roleNames: ['planner'], schema: 'planning_dag' }

describe('isEntryVisibleFor', () => {
  test('an entry without roles or schemas is visible to everyone', () => {
    expect(isEntryVisibleFor({}, planner)).toBe(true)
    expect(isEntryVisibleFor(undefined, planner)).toBe(true)
  })

  test('roles: visible only to users with one of them', () => {
    expect(isEntryVisibleFor({ roles: ['admin'] }, planner)).toBe(false)
    expect(isEntryVisibleFor({ roles: ['admin', 'planner'] }, planner)).toBe(true)
    expect(
      isEntryVisibleFor({ roles: ['admin'] }, { roleNames: [], schema: 'planning_dag' }),
    ).toBe(false)
  })

  test('schemas: visible only on one of those DAGs', () => {
    expect(isEntryVisibleFor({ schemas: ['stock_dag'] }, planner)).toBe(false)
    expect(isEntryVisibleFor({ schemas: ['planning_dag'] }, planner)).toBe(true)
  })

  test('both must hold', () => {
    expect(
      isEntryVisibleFor({ roles: ['planner'], schemas: ['stock_dag'] }, planner),
    ).toBe(false)
    expect(
      isEntryVisibleFor({ roles: ['planner'], schemas: ['planning_dag'] }, planner),
    ).toBe(true)
  })
})
