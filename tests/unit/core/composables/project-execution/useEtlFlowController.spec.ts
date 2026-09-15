import { describe, test, expect, vi, beforeEach } from 'vitest'
import type { ExternalEtlFlowController } from '@cornflow-ui/core/types/etlFlow'

const { mockGetPremiumExternalEtlFlow } = vi.hoisted(() => ({
  mockGetPremiumExternalEtlFlow: vi.fn(),
}))
vi.mock('@cornflow-ui/core/plugins/extensions', () => ({
  getPremiumExternalEtlFlow: mockGetPremiumExternalEtlFlow,
}))

import { useEtlFlowController } from '@cornflow-ui/core/composables/project-execution/useEtlFlowController'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useEtlFlowController', () => {
  test('falls back to an inert controller when no premium module provides the flow', async () => {
    mockGetPremiumExternalEtlFlow.mockReturnValue(null)
    const ctrl = useEtlFlowController()

    expect(ctrl.isActive.value).toBe(false)
    expect(ctrl.buildAdditionalMetadata()).toEqual({ tables: {}, parameters: {} })
    expect(ctrl.state.metadata).toBeNull()
    // Mutators are no-ops (must not throw).
    expect(() => ctrl.initializeFromEtlResponse({ a: 1 })).not.toThrow()
    expect(() => ctrl.markAllReuploaded()).not.toThrow()
    expect(() => ctrl.reset()).not.toThrow()
    // submitUpdate rejects since there is no ETL backend.
    await expect(ctrl.submitUpdate({})).rejects.toThrow(/not available/)
  })

  test('returns the premium controller when one is registered', () => {
    const premium = { id: 'premium-ctrl' } as unknown as ExternalEtlFlowController
    mockGetPremiumExternalEtlFlow.mockReturnValue(premium)
    expect(useEtlFlowController()).toBe(premium)
  })
})
