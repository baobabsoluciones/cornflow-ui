import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import InstanceRepository from '@/repositories/InstanceRepository'

// Mock the API client
vi.mock('@/api/Api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn()
  }
}))

// Mock the general store
vi.mock('@/stores/general', () => ({
  useGeneralStore: () => ({
    appConfig: {
      Instance: vi.fn()
    },
    schemaConfig: {
      instanceSchema: {},
      instanceChecksSchema: {}
    },
    getSchemaName: 'test-schema'
  })
}))

// Mock Instance model
vi.mock('@/models/Instance', () => ({
  InstanceCore: vi.fn()
}))

describe('InstanceRepository', () => {
  let repository: InstanceRepository
  let mockClient: any
  let mockGeneralStore: any

  beforeEach(async () => {
    // Get mocked modules
    const Api = await import('@/api/Api')
    const { useGeneralStore } = await import('@/stores/general')
    
    mockClient = Api.default
    mockGeneralStore = useGeneralStore()
    
    // Reset mocks
    vi.clearAllMocks()
    
    repository = new InstanceRepository()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getInstance', () => {
    const mockInstanceData = {
      id: 'test-instance-id',
      data: {
        tables: {
          table1: [{ id: 1, name: 'Item 1' }],
          table2: [{ id: 2, name: 'Item 2' }]
        }
      },
      checks: {
        validation1: { status: 'passed' }
      }
    }

    const mockInstance = {
      id: 'test-instance-id',
      data: mockInstanceData.data,
      checks: mockInstanceData.checks
    }

    test('should get instance by ID successfully', async () => {
      const mockResponse = {
        status: 200,
        content: mockInstanceData
      }
      mockClient.get.mockResolvedValue(mockResponse)
      mockGeneralStore.appConfig.Instance.mockReturnValue(mockInstance)

      const result = await repository.getInstance('test-instance-id')

      expect(mockClient.get).toHaveBeenCalledWith('/instance/test-instance-id/data/')
      // The actual implementation should call the Instance constructor
      expect(result).toBeDefined()
    })

    test('should throw error when API returns non-200 status', async () => {
      const mockResponse = {
        status: 404,
        content: { error: 'Instance not found' }
      }
      mockClient.get.mockResolvedValue(mockResponse)

      await expect(repository.getInstance('invalid-id')).rejects.toThrow('Error getting instance')
    })

    test('should handle API call failure', async () => {
      const error = new Error('Network error')
      mockClient.get.mockRejectedValue(error)

      await expect(repository.getInstance('test-instance-id')).rejects.toThrow('Network error')
    })

    test('should handle missing instance data', async () => {
      const mockResponse = {
        status: 200,
        content: {
          id: 'test-instance-id',
          data: null,
          checks: null
        }
      }
      mockClient.get.mockResolvedValue(mockResponse)
      mockGeneralStore.appConfig.Instance.mockReturnValue(mockInstance)

      const result = await repository.getInstance('test-instance-id')

      expect(mockClient.get).toHaveBeenCalledWith('/instance/test-instance-id/data/')
      expect(result).toBeDefined()
    })
  })

  describe('launchInstanceDataChecks', () => {
    test('should launch instance data checks successfully', async () => {
      const mockResponse = {
        status: 201,
        content: {
          id: 'check-task-id',
          status: 'running',
          message: 'Data checks launched'
        }
      }
      mockClient.post.mockResolvedValue(mockResponse)

      const result = await repository.launchInstanceDataChecks('test-instance-id')

      expect(mockClient.post).toHaveBeenCalledWith(
        '/data-check/instance/test-instance-id/',
        {},
        {
          'Content-Type': 'application/json'
        }
      )
      expect(result).toEqual(mockResponse.content)
    })

    test('should throw error when API returns non-201 status', async () => {
      const mockResponse = {
        status: 400,
        content: {
          message: 'Invalid instance ID'
        }
      }
      mockClient.post.mockResolvedValue(mockResponse)

      await expect(repository.launchInstanceDataChecks('invalid-id')).rejects.toThrow(
        'Error launching instance data checks: Status 400 - Invalid instance ID'
      )
    })

    test('should throw error with unknown error message for non-201 status', async () => {
      const mockResponse = {
        status: 500,
        content: {}
      }
      mockClient.post.mockResolvedValue(mockResponse)

      await expect(repository.launchInstanceDataChecks('test-instance-id')).rejects.toThrow(
        'Error launching instance data checks: Status 500 - Unknown error'
      )
    })

    test('should handle API call failure', async () => {
      const error = new Error('Network error')
      mockClient.post.mockRejectedValue(error)

      await expect(repository.launchInstanceDataChecks('test-instance-id')).rejects.toThrow('Network error')
    })
  })

  describe('createInstance', () => {
    const mockInstanceData = {
      name: 'Test Instance',
      instance: {
        data: {
          tables: {
            table1: [{ id: 1, name: 'Item 1' }]
          }
        }
      }
    }

    test('should create instance successfully', async () => {
      const mockResponse = {
        status: 201,
        content: {
          id: 'new-instance-id',
          name: 'Test Instance',
          data: mockInstanceData.instance.data
        }
      }
      mockClient.post.mockResolvedValue(mockResponse)

      const result = await repository.createInstance(mockInstanceData)

      expect(mockClient.post).toHaveBeenCalledWith('/instance/', {
        data: mockInstanceData.instance.data,
        name: mockInstanceData.name,
        schema: mockGeneralStore.getSchemaName
      }, {
        'Content-Type': 'application/json'
      })
      expect(result).toEqual(mockResponse.content)
    })

    test('should throw error when API returns non-201 status', async () => {
      const mockResponse = {
        status: 400,
        content: { error: 'Invalid data' }
      }
      mockClient.post.mockResolvedValue(mockResponse)

      await expect(repository.createInstance(mockInstanceData)).rejects.toThrow('Error creating instance')
    })

    test('should handle API call failure', async () => {
      const error = new Error('Network error')
      mockClient.post.mockRejectedValue(error)

      await expect(repository.createInstance(mockInstanceData)).rejects.toThrow('Network error')
    })

    test('should handle missing instance data', async () => {
      const mockDataWithoutInstance = {
        name: 'Test Instance',
        instance: {}
      }
      const mockResponse = {
        status: 201,
        content: { id: 'new-instance-id' }
      }
      mockClient.post.mockResolvedValue(mockResponse)

      const result = await repository.createInstance(mockDataWithoutInstance)

      expect(mockClient.post).toHaveBeenCalledWith('/instance/', {
        data: undefined,
        name: 'Test Instance',
        schema: mockGeneralStore.getSchemaName
      }, {
        'Content-Type': 'application/json'
      })
    })

    test('should handle empty instance name', async () => {
      const mockDataWithoutName = {
        name: '',
        instance: {
          data: mockInstanceData.instance.data
        }
      }
      const mockResponse = {
        status: 201,
        content: { id: 'new-instance-id' }
      }
      mockClient.post.mockResolvedValue(mockResponse)

      const result = await repository.createInstance(mockDataWithoutName)

      expect(mockClient.post).toHaveBeenCalledWith('/instance/', {
        data: mockInstanceData.instance.data,
        name: '',
        schema: mockGeneralStore.getSchemaName
      }, {
        'Content-Type': 'application/json'
      })
    })
  })
})