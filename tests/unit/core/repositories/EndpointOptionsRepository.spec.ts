import { describe, test, expect, vi, beforeEach } from 'vitest'
import EndpointOptionsRepository from '@cornflow-ui/core/repositories/EndpointOptionsRepository'

const mockClient = vi.hoisted(() => ({ get: vi.fn() }))

vi.mock('@cornflow-ui/core/api/Api', () => ({ default: mockClient }))

const PLANTS = {
  optionsEndpoint: '/user/plants/',
  isExternal: true,
  valueField: 'plant_id',
  labelField: 'name',
}

describe('EndpointOptionsRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('requests the options endpoint with the given parameters', async () => {
    mockClient.get.mockResolvedValue({ status: 200, content: [] })

    await new EndpointOptionsRepository().getOptions(PLANTS, {
      schema: 'planning_dag',
    })

    expect(mockClient.get).toHaveBeenCalledWith(
      '/user/plants/',
      { schema: 'planning_dag' },
      {},
      true,
    )
  })

  test('maps each row to its value and label, dropping rows without value', async () => {
    mockClient.get.mockResolvedValue({
      status: 200,
      content: [
        { plant_id: '101', name: 'East' },
        { plant_id: '102', name: '' },
        { name: 'no value' },
      ],
    })

    const options = await new EndpointOptionsRepository().getOptions(PLANTS, {})

    expect(options).toEqual([
      { value: '101', title: 'East' },
      { value: '102', title: '102' },
    ])
  })

  test('uses the value as label when the source declares no label field', async () => {
    mockClient.get.mockResolvedValue({
      status: 200,
      content: [{ plant_id: 101 }],
    })

    const options = await new EndpointOptionsRepository().getOptions(
      { ...PLANTS, labelField: undefined },
      {},
    )

    expect(options).toEqual([{ value: 101, title: '101' }])
  })

  test('throws when the endpoint does not answer with a list', async () => {
    mockClient.get.mockResolvedValue({ status: 403, content: { error: 'no' } })

    await expect(
      new EndpointOptionsRepository().getOptions(PLANTS, {}),
    ).rejects.toThrow('Error getting the options of /user/plants/')
  })
})
