import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import VersionRepository from '@/repositories/VersionRepository'

// Mock the API client
vi.mock('@/api/Api', () => ({
  default: {
    get: vi.fn()
  }
}))

describe('VersionRepository', () => {
  let repository: VersionRepository
  let mockClient: any

  beforeEach(async () => {
    // Get mocked modules
    const Api = await import('@/api/Api')
    mockClient = Api.default
    
    // Reset mocks
    vi.clearAllMocks()
    
    repository = new VersionRepository()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getCornflowVersion', () => {
    test('should get cornflow version successfully', async () => {
      const mockResponse = {
        status: 200,
        content: {
          cornflow_version: '1.2.3',
          status: 'healthy',
          timestamp: '2023-01-01T00:00:00Z'
        }
      }
      mockClient.get.mockResolvedValue(mockResponse)

      const result = await repository.getCornflowVersion()

      expect(mockClient.get).toHaveBeenCalledWith('/health/')
      expect(result).toBe('1.2.3')
    })

    test('should handle version with build number', async () => {
      const mockResponse = {
        status: 200,
        content: {
          cornflow_version: '2.0.0-beta.1',
          status: 'healthy'
        }
      }
      mockClient.get.mockResolvedValue(mockResponse)

      const result = await repository.getCornflowVersion()

      expect(result).toBe('2.0.0-beta.1')
    })

    test('should handle development version', async () => {
      const mockResponse = {
        status: 200,
        content: {
          cornflow_version: '3.0.0-dev+abc123',
          status: 'healthy'
        }
      }
      mockClient.get.mockResolvedValue(mockResponse)

      const result = await repository.getCornflowVersion()

      expect(result).toBe('3.0.0-dev+abc123')
    })

    test('should reject when API returns non-200 status', async () => {
      const mockResponse = {
        status: 503,
        content: { error: 'Service unavailable' }
      }
      mockClient.get.mockResolvedValue(mockResponse)

      await expect(repository.getCornflowVersion()).rejects.toThrow('Error getting cornflow version')
    })

    test('should reject when API call fails', async () => {
      const error = new Error('Network error')
      mockClient.get.mockRejectedValue(error)

      await expect(repository.getCornflowVersion()).rejects.toThrow('Network error')
    })

    test('should handle missing cornflow_version field', async () => {
      const mockResponse = {
        status: 200,
        content: {
          status: 'healthy',
          timestamp: '2023-01-01T00:00:00Z'
        }
      }
      mockClient.get.mockResolvedValue(mockResponse)

      const result = await repository.getCornflowVersion()

      expect(result).toBeUndefined()
    })

    test('should handle null cornflow_version', async () => {
      const mockResponse = {
        status: 200,
        content: {
          cornflow_version: null,
          status: 'healthy'
        }
      }
      mockClient.get.mockResolvedValue(mockResponse)

      const result = await repository.getCornflowVersion()

      expect(result).toBeNull()
    })

    test('should handle empty cornflow_version', async () => {
      const mockResponse = {
        status: 200,
        content: {
          cornflow_version: '',
          status: 'healthy'
        }
      }
      mockClient.get.mockResolvedValue(mockResponse)

      const result = await repository.getCornflowVersion()

      expect(result).toBe('')
    })

    test('should handle 401 unauthorized error', async () => {
      const mockResponse = {
        status: 401,
        content: { error: 'Unauthorized' }
      }
      mockClient.get.mockResolvedValue(mockResponse)

      await expect(repository.getCornflowVersion()).rejects.toThrow('Error getting cornflow version')
    })

    test('should handle 403 forbidden error', async () => {
      const mockResponse = {
        status: 403,
        content: { error: 'Forbidden' }
      }
      mockClient.get.mockResolvedValue(mockResponse)

      await expect(repository.getCornflowVersion()).rejects.toThrow('Error getting cornflow version')
    })

    test('should handle 404 not found error', async () => {
      const mockResponse = {
        status: 404,
        content: { error: 'Endpoint not found' }
      }
      mockClient.get.mockResolvedValue(mockResponse)

      await expect(repository.getCornflowVersion()).rejects.toThrow('Error getting cornflow version')
    })

    test('should handle 500 internal server error', async () => {
      const mockResponse = {
        status: 500,
        content: { error: 'Internal server error' }
      }
      mockClient.get.mockResolvedValue(mockResponse)

      await expect(repository.getCornflowVersion()).rejects.toThrow('Error getting cornflow version')
    })

    test('should handle timeout error', async () => {
      const timeoutError = new Error('Request timeout')
      timeoutError.name = 'TimeoutError'
      mockClient.get.mockRejectedValue(timeoutError)

      await expect(repository.getCornflowVersion()).rejects.toThrow('Request timeout')
    })

    test('should handle connection error', async () => {
      const connectionError = new Error('ECONNREFUSED')
      connectionError.name = 'ConnectionError'
      mockClient.get.mockRejectedValue(connectionError)

      await expect(repository.getCornflowVersion()).rejects.toThrow('ECONNREFUSED')
    })

    test('should handle complex health response', async () => {
      const mockResponse = {
        status: 200,
        content: {
          cornflow_version: '1.5.2',
          status: 'healthy',
          timestamp: '2023-06-15T14:30:45Z',
          database: {
            status: 'connected',
            version: '13.7'
          },
          redis: {
            status: 'connected',
            version: '6.2.6'
          },
          services: {
            solver_service: 'running',
            notification_service: 'running'
          },
          uptime: '7 days, 14 hours, 23 minutes'
        }
      }
      mockClient.get.mockResolvedValue(mockResponse)

      const result = await repository.getCornflowVersion()

      expect(result).toBe('1.5.2')
    })

    test('should handle malformed response', async () => {
      const mockResponse = {
        status: 200,
        content: 'invalid json response'
      }
      mockClient.get.mockResolvedValue(mockResponse)

      const result = await repository.getCornflowVersion()

      expect(result).toBeUndefined()
    })

    test('should handle numeric cornflow_version', async () => {
      const mockResponse = {
        status: 200,
        content: {
          cornflow_version: 123,
          status: 'healthy'
        }
      }
      mockClient.get.mockResolvedValue(mockResponse)

      const result = await repository.getCornflowVersion()

      expect(result).toBe(123)
    })
  })
})