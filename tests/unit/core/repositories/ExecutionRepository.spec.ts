import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import ExecutionRepository from '@/repositories/ExecutionRepository'

// Mock the API client
vi.mock('@/api/Api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    remove: vi.fn()
  }
}))

// Mock the general store
vi.mock('@/stores/general', () => ({
  useGeneralStore: () => ({
    appConfig: {
      Solution: vi.fn(),
      Experiment: vi.fn()
    },
    schemaConfig: {
      solutionSchema: {},
      solutionChecksSchema: {},
      instanceSchema: {},
      instanceChecksSchema: {}
    },
    getSchemaName: 'test-schema'
  })
}))

// Mock InstanceRepository
const mockInstanceRepo = {
  getInstance: vi.fn(),
  createInstance: vi.fn()
}

vi.mock('@/repositories/InstanceRepository', () => ({
  default: vi.fn(() => mockInstanceRepo)
}))

// Mock date utility
vi.mock('@/utils/date', () => ({
  formatDateForFilename: vi.fn().mockReturnValue('2023-01-01-120000')
}))

// Mock models
vi.mock('@/models/Execution', () => ({
  Execution: vi.fn()
}))

vi.mock('@/models/LoadedExecution', () => ({
  LoadedExecution: vi.fn()
}))

describe('ExecutionRepository', () => {
  let repository: ExecutionRepository
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
    
    repository = new ExecutionRepository()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getExecutions', () => {
    const mockExecutionData = {
      message: 'Test message',
      created_at: '2023-01-01T00:00:00Z',
      config: { test: 'config' },
      state: 1,
      log: { sol_code: 1, status_code: 200, status_message: 'OK' },
      name: 'Test Execution',
      description: 'Test Description',
      indicators: {},
      data_hash: 'test-hash',
      schema: 'test-schema',
      instance_id: 'test-instance-id',
      id: 'test-id',
      user_id: 'test-user-id',
      username: 'testuser',
      first_name: 'Test',
      last_name: 'User',
      updated_at: '2023-01-01T00:00:00Z'
    }

    test('should get executions with date range', async () => {
      const mockResponse = {
        status: 200,
        content: [mockExecutionData]
      }
      mockClient.get.mockResolvedValue(mockResponse)

      const result = await repository.getExecutions('test-schema', '2023-01-01', '2023-01-31')

      expect(mockClient.get).toHaveBeenCalledWith('/execution/', {
        schema: 'test-schema',
        limit: 100,
        creation_date_gte: '2023-01-01',
        creation_date_lte: '2023-01-31'
      })
      expect(result).toBeDefined()
    })

    test('should get executions without date range with limit 15', async () => {
      const mockResponse = {
        status: 200,
        content: [mockExecutionData]
      }
      mockClient.get.mockResolvedValue(mockResponse)

      await repository.getExecutions('test-schema', '', '')

      expect(mockClient.get).toHaveBeenCalledWith('/execution/', {
        schema: 'test-schema',
        limit: 15
      })
    })

    test('should handle missing log data', async () => {
      const executionWithoutLog = { ...mockExecutionData, log: null }
      const mockResponse = {
        status: 200,
        content: [executionWithoutLog]
      }
      mockClient.get.mockResolvedValue(mockResponse)

      const result = await repository.getExecutions('test-schema', '', '')

      expect(result).toBeDefined()
    })

    test('should throw error when API returns non-200 status', async () => {
      const mockResponse = {
        status: 500,
        content: { error: 'Server error' }
      }
      mockClient.get.mockResolvedValue(mockResponse)

      await expect(repository.getExecutions('test-schema', '', '')).rejects.toThrow('Error getting executions')
    })
  })

  describe('loadExecution', () => {
    const mockExecutionResponse = {
      id: 'test-id',
      data: { test: 'solution-data' },
      instance_id: 'test-instance-id',
      name: 'Test Execution',
      description: 'Test Description',
      created_at: '2023-01-01T00:00:00Z',
      state: 1,
      message: 'Test message',
      config: { test: 'config' },
      checks: { test: 'checks' }
    }

    const mockInstance = {
      id: 'test-instance-id',
      data: { test: 'instance-data' }
    }

    test('should load execution successfully', async () => {
      const mockResponse = {
        status: 200,
        content: mockExecutionResponse
      }
      mockClient.get.mockResolvedValue(mockResponse)
      mockInstanceRepo.getInstance.mockResolvedValue(mockInstance)

      const result = await repository.loadExecution('test-id')

      expect(mockClient.get).toHaveBeenCalledWith('/execution/test-id/data/')
      expect(mockInstanceRepo.getInstance).toHaveBeenCalledWith('test-instance-id')
    })

    test('should throw error when instance loading fails', async () => {
      const mockResponse = {
        status: 200,
        content: mockExecutionResponse
      }
      mockClient.get.mockResolvedValue(mockResponse)
      mockInstanceRepo.getInstance.mockResolvedValue(null)

      await expect(repository.loadExecution('test-id')).rejects.toThrow('Error loading instance')
    })

    test('should throw error when API returns non-200 status', async () => {
      const mockResponse = {
        status: 404,
        content: { error: 'Not found' }
      }
      mockClient.get.mockResolvedValue(mockResponse)

      await expect(repository.loadExecution('test-id')).rejects.toThrow('Error loading execution')
    })
  })

  describe('createExecution', () => {
    const mockExecutionData = {
      name: 'Test Execution',
      description: 'Test Description',
      config: { test: 'config' },
      instance: {
        id: 'existing-instance-id',
        data: { test: 'data' }
      }
    }

    test('should create execution with existing instance', async () => {
      const mockResponse = {
        status: 201,
        content: { id: 'new-execution-id', name: 'Test Execution' }
      }
      mockClient.post.mockResolvedValue(mockResponse)

      const result = await repository.createExecution(mockExecutionData)

      expect(mockClient.post).toHaveBeenCalledWith('/execution/', {
        name: mockExecutionData.name,
        description: mockExecutionData.description,
        config: mockExecutionData.config,
        schema: mockGeneralStore.getSchemaName,
        instance_id: mockExecutionData.instance.id
      }, {
        'Content-Type': 'application/json'
      })
      expect(result).toEqual(mockResponse.content)
    })

    test('should create execution with new instance', async () => {
      const executionWithNewInstance = {
        ...mockExecutionData,
        instance: { data: { test: 'data' } }
      }
      const mockNewInstance = { id: 'new-instance-id' }
      const mockExecutionResponse = {
        status: 201,
        content: { id: 'new-execution-id', name: 'Test Execution' }
      }

      mockInstanceRepo.createInstance.mockResolvedValue(mockNewInstance)
      mockClient.post.mockResolvedValue(mockExecutionResponse)

      const result = await repository.createExecution(executionWithNewInstance)

      expect(mockInstanceRepo.createInstance).toHaveBeenCalledWith(executionWithNewInstance)
      expect(result).toEqual(mockExecutionResponse.content)
    })

    test('should throw error when execution creation fails', async () => {
      const mockResponse = {
        status: 400,
        content: { error: 'Bad request' }
      }
      mockClient.post.mockResolvedValue(mockResponse)

      await expect(repository.createExecution(mockExecutionData)).rejects.toThrow('Error creating execution')
    })
  })

  describe('uploadSolutionData', () => {
    const mockSolutionData = { test: 'solution-data' }

    test('should upload solution data successfully', async () => {
      const mockResponse = {
        content: { success: true }
      }
      mockClient.put.mockResolvedValue(mockResponse)

      const result = await repository.uploadSolutionData('test-id', mockSolutionData)

      expect(mockClient.put).toHaveBeenCalledWith('/execution/test-id/', {
        data: mockSolutionData
      })
      expect(result).toEqual(mockResponse.content)
    })

    test('should handle upload errors', async () => {
      const error = new Error('Upload failed')
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockClient.put.mockRejectedValue(error)

      await expect(repository.uploadSolutionData('test-id', mockSolutionData)).rejects.toThrow('Upload failed')
      expect(consoleSpy).toHaveBeenCalledWith('Error uploading solution data:', error)

      consoleSpy.mockRestore()
    })
  })

  describe('deleteExecution', () => {
    test('should delete execution successfully', async () => {
      const mockResponse = { status: 200 }
      mockClient.remove.mockResolvedValue(mockResponse)

      const result = await repository.deleteExecution('test-id')

      expect(mockClient.remove).toHaveBeenCalledWith('/execution/test-id/')
      expect(result).toBe(true)
    })

    test('should return false when deletion fails', async () => {
      const mockResponse = { status: 404 }
      mockClient.remove.mockResolvedValue(mockResponse)

      const result = await repository.deleteExecution('test-id')

      expect(result).toBe(false)
    })
  })

  describe('refreshExecution', () => {
    test('should have refreshExecution method', async () => {
      expect(typeof repository.refreshExecution).toBe('function')
      await repository.refreshExecution('test-id')
    })
  })
})