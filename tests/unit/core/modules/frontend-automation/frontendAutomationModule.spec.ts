import { describe, test, expect, vi, beforeEach } from 'vitest'

// Mock the API client used by FaRepository.
const mockGet = vi.hoisted(() => vi.fn())
vi.mock('@cornflow-ui/core/api/Api', () => ({
  default: { get: mockGet },
}))

// transformOpenApiToTableConfig now lives in the FA module; stub it to a deterministic shape.
const mockTransform = vi.hoisted(() => vi.fn())
vi.mock('@cornflow-ui/core/modules/frontend-automation/openApiTransform', () => ({
  transformOpenApiToTableConfig: mockTransform,
}))

import frontendAutomationModule from '@cornflow-ui/core/modules/frontend-automation'
import FaRepository from '@cornflow-ui/core/modules/frontend-automation/FaRepository'
import type { ExtensionContext } from '@cornflow-ui/core/types/extension'

const ctx = {
  getConfig: () => ({ getCore: () => ({ parameters: {} }), get: () => undefined }),
  getRoleNames: () => [],
  isFeatureEnabled: () => true,
} as ExtensionContext

describe('frontendAutomationModule (premium descriptor)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('id is "frontend-automation" and exposes loadMasterDataConfig', () => {
    expect(frontendAutomationModule.id).toBe('frontend-automation')
    expect(typeof frontendAutomationModule.loadMasterDataConfig).toBe('function')
  })

  test('loadMasterDataConfig returns the FA endpoint config/sections/groups', async () => {
    mockGet.mockResolvedValue({
      status: 200,
      content: {
        available_automations: { tables: { t: {} }, groups: {}, sections: {} },
        definitions: { d: {} },
        paths: {},
      },
    })
    mockTransform.mockReturnValue({
      config: { t: { title: 'T' } },
      sections: [{ key: 's', order: 1 }],
      groups: [{ key: 'g', order: 1 }],
    })

    const result = await frontendAutomationModule.loadMasterDataConfig!(ctx)

    expect(mockGet).toHaveBeenCalledWith('/frontend-automation/', {}, {}, true)
    expect(result.config).toEqual({ t: { title: 'T' } })
    expect(result.sections).toEqual([{ key: 's', order: 1 }])
    expect(result.groups).toEqual([{ key: 'g', order: 1 }])
  })
})

describe('FaRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('throws on non-200 response', async () => {
    mockGet.mockResolvedValue({ status: 500, content: {} })
    await expect(new FaRepository().getConfigurationTables()).rejects.toThrow(
      /Status: 500/,
    )
  })

  test('throws when the automation data structure is invalid', async () => {
    mockGet.mockResolvedValue({ status: 200, content: {} })
    await expect(new FaRepository().getConfigurationTables()).rejects.toThrow(
      'Invalid automation data structure',
    )
  })

  test('throws when required sections are missing', async () => {
    mockGet.mockResolvedValue({
      status: 200,
      content: { available_automations: {} },
    })
    await expect(new FaRepository().getConfigurationTables()).rejects.toThrow(
      'Missing required sections in automation data',
    )
  })
})
