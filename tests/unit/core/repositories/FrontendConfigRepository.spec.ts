import { describe, test, expect, vi, beforeEach } from 'vitest'

const mockClient = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('@cornflow-ui/core/api/Api', () => ({ default: mockClient }))

import FrontendConfigRepository from '@cornflow-ui/core/repositories/FrontendConfigRepository'

describe('FrontendConfigRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('asks GET /external/frontend-config/ and returns its body', async () => {
    const body = { etl: { dag_1: { exists: true, query: { properties: {} } } } }
    mockClient.get.mockResolvedValue({ status: 200, content: body })

    await expect(
      new FrontendConfigRepository().getFrontendConfig(),
    ).resolves.toEqual(body)
    expect(mockClient.get).toHaveBeenCalledWith(
      '/frontend-config/',
      {},
      {},
      true,
    )
  })

  test('fails on any other answer, a backend without the endpoint included', async () => {
    mockClient.get.mockResolvedValue({
      status: 404,
      content: { error: 'Not found' },
    })

    await expect(
      new FrontendConfigRepository().getFrontendConfig(),
    ).rejects.toThrow('404')
  })
})
