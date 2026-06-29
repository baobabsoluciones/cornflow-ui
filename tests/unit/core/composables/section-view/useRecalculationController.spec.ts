import { describe, test, expect, vi, beforeEach } from 'vitest'
import type { RecalculationController } from '@cornflow-ui/core/types/recalculation'

const { mockGetPremiumRecalculation } = vi.hoisted(() => ({
  mockGetPremiumRecalculation: vi.fn(),
}))
vi.mock('@cornflow-ui/core/plugins/extensions', () => ({
  getPremiumRecalculation: mockGetPremiumRecalculation,
}))

import { useRecalculationController } from '@cornflow-ui/core/composables/section-view/useRecalculationController'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useRecalculationController', () => {
  test('falls back to an inert controller when no premium module provides recalculation', async () => {
    mockGetPremiumRecalculation.mockReturnValue(null)
    const ctrl = useRecalculationController()

    // master-data notifier is a no-op that resolves
    await expect(ctrl.checkPlanDataAfterMasterDataChange()).resolves.toBeUndefined()
    // execution name falls back to the trimmed base name (or 'Recalculated')
    expect(ctrl.buildRecalculationExecutionName('  Plan  ')).toBe('Plan')
    expect(ctrl.buildRecalculationExecutionName('')).toBe('Recalculated')
    // running a recalculation rejects since there is no premium backend
    await expect(
      ctrl.runSolutionRecalculation({
        instanceData: {},
        solutionData: {},
        executionName: 'x',
        executionDescription: '',
        executionConfig: {},
      }),
    ).rejects.toThrow(/not available/)
  })

  test('returns the premium controller when one is registered', () => {
    const premium = { id: 'premium-recalc' } as unknown as RecalculationController
    mockGetPremiumRecalculation.mockReturnValue(premium)
    expect(useRecalculationController()).toBe(premium)
  })
})
