import { describe, test, expect, vi, beforeEach } from 'vitest'
import ExecutionRepository, {
  ExecutionFilesRegenerationError,
} from '@/repositories/ExecutionRepository'

// Mock the API client
vi.mock('@/api/Api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    remove: vi.fn(),
    getBlob: vi.fn(),
  },
}))

// Shared store state so tests can flip flags between cases.
const storeState = {
  appConfig: {
    Solution: vi.fn(),
    Experiment: vi.fn(),
    parameters: {
      useBackendExecutionFilesDownload: false as boolean,
    } as Record<string, any>,
  },
  schemaConfig: {
    solutionSchema: {},
    solutionChecksSchema: {},
    instanceSchema: {},
    instanceChecksSchema: {},
  },
  getSchemaName: 'test-schema',
}

vi.mock('@/stores/general', () => ({
  useGeneralStore: () => storeState,
}))

// Mock InstanceRepository
const mockInstanceRepo = vi.hoisted(() => ({
  getInstance: vi.fn(),
  createInstance: vi.fn(),
}))

vi.mock('@/repositories/InstanceRepository', () => ({
  default: vi.fn(function () {
    return mockInstanceRepo
  }),
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

    test('should propagate errors when put rejects', async () => {
      const error = new Error('Upload failed')
      mockClient.put.mockRejectedValue(error)

      await expect(repository.uploadSolutionData('test-id', mockSolutionData)).rejects.toThrow('Upload failed')
    })

    test('should throw when API returns non-success status', async () => {
      mockClient.put.mockResolvedValue({
        status: 500,
        content: { error: 'Server error' },
      })

      await expect(
        repository.uploadSolutionData('test-id', mockSolutionData),
      ).rejects.toThrow()
      expect(mockClient.put).toHaveBeenCalledWith('/execution/test-id/', {
        data: mockSolutionData,
      })
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

  describe('getDataToDownload — backend execution files', () => {
    // jsdom's Blob.text() is unreliable across versions — provide a stub that mimics
    // the only surface the repository code touches.
    const blobOf = (json: object): Blob =>
      ({
        type: 'application/json',
        text: () => Promise.resolve(JSON.stringify(json)),
      }) as unknown as Blob

    let createObjectURL: any
    let revokeObjectURL: any
    let anchorClick: any

    beforeEach(() => {
      storeState.appConfig.parameters.useBackendExecutionFilesDownload = true

      createObjectURL = vi.fn().mockReturnValue('blob:mock')
      revokeObjectURL = vi.fn()
      anchorClick = vi.fn()
      // @ts-expect-error jsdom does not implement these on URL
      global.URL.createObjectURL = createObjectURL
      // @ts-expect-error jsdom does not implement these on URL
      global.URL.revokeObjectURL = revokeObjectURL

      const realCreateElement = Document.prototype.createElement
      vi.spyOn(document, 'createElement').mockImplementation(function (tag: string) {
        const el = realCreateElement.call(document, tag) as any
        if (tag === 'a') el.click = anchorClick
        return el
      })
    })

    afterEach(() => {
      storeState.appConfig.parameters.useBackendExecutionFilesDownload = false
    })

    test('HTTP 200 → downloads zip and skips /data/ fetch', async () => {
      mockClient.getBlob.mockResolvedValueOnce({
        status: 200,
        blob: new Blob(['zip-bytes'], { type: 'application/zip' }),
        filename: 'exec_42.zip',
      })

      const result = await repository.getDataToDownload('42', true, true)

      expect(result).toBeNull()
      expect(mockClient.getBlob).toHaveBeenCalledWith('/execution/files/42/')
      expect(mockClient.get).not.toHaveBeenCalled()
      expect(anchorClick).toHaveBeenCalledTimes(1)
      expect(createObjectURL).toHaveBeenCalledTimes(1)
      expect(revokeObjectURL).toHaveBeenCalledTimes(1)
    })

    test('HTTP 501 → falls back to local Excel build', async () => {
      mockClient.getBlob.mockResolvedValueOnce({
        status: 501,
        blob: blobOf({ error: 'deactivated' }),
        filename: null,
      })
      // local-flow path needs /data/ to fail so we don't go further
      mockClient.get.mockResolvedValue({ status: 500, content: {} })

      await expect(repository.getDataToDownload('42')).rejects.toThrow(
        'Error loading execution',
      )
      expect(mockClient.get).toHaveBeenCalledWith('/execution/42/data/')
    })

    test.each([
      ['status: 0', 0],
      ['status: -1', -1],
    ])('HTTP 400 with %s → falls back to local Excel build', async (_, s) => {
      mockClient.getBlob.mockResolvedValueOnce({
        status: 400,
        blob: blobOf({ status: s, error: 'no files' }),
        filename: null,
      })
      mockClient.get.mockResolvedValue({ status: 500, content: {} })

      await expect(repository.getDataToDownload('42')).rejects.toThrow(
        'Error loading execution',
      )
      expect(mockClient.get).toHaveBeenCalledWith('/execution/42/data/')
    })

    test('HTTP 400 status:-2 → triggers regeneration, polls, downloads on 200', async () => {
      mockClient.getBlob
        .mockResolvedValueOnce({
          status: 400,
          blob: blobOf({ status: -2, error: 'deleted' }),
          filename: null,
        })
        .mockResolvedValueOnce({
          status: 400,
          blob: blobOf({ status: -3, error: 'still working' }),
          filename: null,
        })
        .mockResolvedValueOnce({
          status: 200,
          blob: new Blob(['zip'], { type: 'application/zip' }),
          filename: 'exec.zip',
        })
      mockClient.post.mockResolvedValue({ status: 201, content: {} })

      vi.useFakeTimers()
      try {
        const promise = repository.getDataToDownload('42', true, true)
        // Drain two poll intervals (5s default).
        await vi.advanceTimersByTimeAsync(5_000)
        await vi.advanceTimersByTimeAsync(5_000)
        await expect(promise).resolves.toBeNull()
      } finally {
        vi.useRealTimers()
      }

      expect(mockClient.post).toHaveBeenCalledWith(
        '/data-check-kpis/execution/42/',
        {},
        {},
        false,
      )
      expect(mockClient.getBlob).toHaveBeenCalledTimes(3)
      expect(anchorClick).toHaveBeenCalledTimes(1)
      expect(mockClient.get).not.toHaveBeenCalled()
    })

    test('HTTP 400 status:-3 → throws ExecutionFilesRegenerationError on timeout', async () => {
      mockClient.getBlob.mockResolvedValue({
        status: 400,
        blob: blobOf({ status: -3, error: 'stale' }),
        filename: null,
      })
      mockClient.post.mockResolvedValue({ status: 201, content: {} })

      vi.useFakeTimers()
      try {
        const promise = repository.getDataToDownload('42', true, true)
        // Attach handler before advancing timers so the rejection is not "unhandled".
        const expectation = expect(promise).rejects.toMatchObject({
          name: 'ExecutionFilesRegenerationError',
          i18nKey: 'executionTable.filesRegenerationTimeout',
        })
        await vi.advanceTimersByTimeAsync(130_000)
        await expectation
      } finally {
        vi.useRealTimers()
      }
      expect(mockClient.post).toHaveBeenCalledTimes(1)
    })

    test('HTTP 404 → throws with backend error message', async () => {
      mockClient.getBlob.mockResolvedValueOnce({
        status: 404,
        blob: blobOf({ error: 'not found' }),
        filename: null,
      })

      await expect(repository.getDataToDownload('42')).rejects.toThrow(
        'not found',
      )
      expect(mockClient.get).not.toHaveBeenCalled()
    })

    test('flag off → backend endpoint is not called', async () => {
      storeState.appConfig.parameters.useBackendExecutionFilesDownload = false
      mockClient.get.mockResolvedValue({ status: 500, content: {} })

      await expect(repository.getDataToDownload('42')).rejects.toThrow(
        'Error loading execution',
      )
      expect(mockClient.getBlob).not.toHaveBeenCalled()
    })

    test('exposes ExecutionFilesRegenerationError class', () => {
      const err = new ExecutionFilesRegenerationError('some.key')
      expect(err).toBeInstanceOf(Error)
      expect(err.i18nKey).toBe('some.key')
      expect(err.name).toBe('ExecutionFilesRegenerationError')
    })
  })
})