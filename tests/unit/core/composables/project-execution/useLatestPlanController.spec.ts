import { describe, test, expect, vi, beforeEach } from 'vitest'
import type { LatestPlanController } from '@cornflow-ui/core/types/latestPlan'

const { mockGetPremiumLatestPlan } = vi.hoisted(() => ({
  mockGetPremiumLatestPlan: vi.fn(),
}))
vi.mock('@cornflow-ui/core/plugins/extensions', () => ({
  getPremiumLatestPlan: mockGetPremiumLatestPlan,
}))

import { useLatestPlanController } from '@cornflow-ui/core/composables/project-execution/useLatestPlanController'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useLatestPlanController', () => {
  test('falls back to an inert controller when no premium module provides latest-plan', () => {
    mockGetPremiumLatestPlan.mockReturnValue(null)
    const ctrl = useLatestPlanController()

    expect(ctrl.isSetLatestPlanAvailable()).toBe(false)
    expect(ctrl.isLatestPlan('exec-1')).toBe(false)
    expect(ctrl.canSetAsLatestPlan(1)).toBe(false)
    expect(ctrl.setLatestPlanModalComponent).toBeNull()
  })

  test('returns the premium controller when one is registered', () => {
    const premium = { id: 'premium-lp' } as unknown as LatestPlanController
    mockGetPremiumLatestPlan.mockReturnValue(premium)
    expect(useLatestPlanController()).toBe(premium)
  })
})
