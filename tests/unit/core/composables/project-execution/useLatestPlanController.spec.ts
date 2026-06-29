import { describe, test, expect, vi, beforeEach } from 'vitest'
import type { LatestPlanController } from '@/types/latestPlan'

const { mockGetPremiumLatestPlan } = vi.hoisted(() => ({
  mockGetPremiumLatestPlan: vi.fn(),
}))
vi.mock('@/plugins/extensions', () => ({
  getPremiumLatestPlan: mockGetPremiumLatestPlan,
}))

import { useLatestPlanController } from '@/composables/project-execution/useLatestPlanController'

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
