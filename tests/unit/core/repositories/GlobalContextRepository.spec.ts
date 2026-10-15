import { describe, test, expect, vi, beforeEach } from 'vitest'
import GlobalContextRepository from '@cornflow-ui/core/repositories/GlobalContextRepository'

const mockClient = vi.hoisted(() => ({ get: vi.fn() }))

vi.mock('@cornflow-ui/core/api/Api', () => ({ default: mockClient }))

const PLANT = {
  key: 'plant_id',
  labelKey: 'plant',
  optionsEndpoint: '/user/plants/',
  isExternal: true,
  valueField: 'plant_id',
  labelField: 'name',
}

describe('GlobalContextRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('requests the options endpoint with the given parameters', async () => {
    mockClient.get.mockResolvedValue({ status: 200, content: [] })

    await new GlobalContextRepository().getOptions(PLANT, { schema: 'planning_dag' })

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

    const options = await new GlobalContextRepository().getOptions(PLANT, {})

    expect(options).toEqual([
      { value: '101', title: 'East' },
      { value: '102', title: '102' },
    ])
  })

  test('uses the value as label when the dimension declares no label field', async () => {
    mockClient.get.mockResolvedValue({ status: 200, content: [{ plant_id: 101 }] })

    const options = await new GlobalContextRepository().getOptions(
      { ...PLANT, labelField: undefined },
      {},
    )

    expect(options).toEqual([{ value: 101, title: '101' }])
  })

  test('throws when the endpoint does not answer with a list', async () => {
    mockClient.get.mockResolvedValue({ status: 403, content: { error: 'no' } })

    await expect(
      new GlobalContextRepository().getOptions(PLANT, {}),
    ).rejects.toThrow('Error getting the options of plant_id')
  })
})
