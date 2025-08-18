import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import LicenceRepository from '@/repositories/LicenceRepository'

// Mock the API client
vi.mock('@/api/Api', () => ({
  default: {
    get: vi.fn()
  }
}))

// Mock Licence model
vi.mock('@/models/Licence', () => ({
  default: vi.fn()
}))

describe('LicenceRepository', () => {
  let repository: LicenceRepository
  let mockClient: any

  beforeEach(async () => {
    // Get mocked modules
    const Api = await import('@/api/Api')
    mockClient = Api.default
    
    // Reset mocks
    vi.clearAllMocks()
    
    repository = new LicenceRepository()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getLicences', () => {
    const mockLicenceData = [
      {
        library: 'vue',
        license: 'MIT',
        version: '3.0.0',
        author: 'Evan You',
        description: 'The Progressive JavaScript Framework',
        'home page': 'https://vuejs.org'
      },
      {
        library: 'typescript',
        license: 'Apache-2.0',
        version: '4.9.0',
        author: 'Microsoft',
        description: 'TypeScript is a superset of JavaScript',
        'home page': 'https://www.typescriptlang.org'
      }
    ]

    test('should get licences successfully', async () => {
      const mockResponse = {
        status: 200,
        content: mockLicenceData
      }
      mockClient.get.mockResolvedValue(mockResponse)

      const result = await repository.getLicences()

      expect(mockClient.get).toHaveBeenCalledWith('/licences/')
    })

    test('should handle empty licences array', async () => {
      const mockResponse = {
        status: 200,
        content: []
      }
      mockClient.get.mockResolvedValue(mockResponse)

      const result = await repository.getLicences()

      expect(mockClient.get).toHaveBeenCalledWith('/licences/')
    })

    test('should handle single licence', async () => {
      const singleLicence = [mockLicenceData[0]]
      const mockResponse = {
        status: 200,
        content: singleLicence
      }
      mockClient.get.mockResolvedValue(mockResponse)

      const result = await repository.getLicences()

      expect(mockClient.get).toHaveBeenCalledWith('/licences/')
    })

    test('should reject when API returns non-200 status', async () => {
      const mockResponse = {
        status: 500,
        content: { error: 'Internal server error' }
      }
      mockClient.get.mockResolvedValue(mockResponse)

      await expect(repository.getLicences()).rejects.toThrow('Error getting licences')
    })

    test('should reject when API call fails', async () => {
      const error = new Error('Network error')
      mockClient.get.mockRejectedValue(error)

      await expect(repository.getLicences()).rejects.toThrow('Network error')
    })

    test('should handle licence with missing fields', async () => {
      const incompleteData = [
        {
          library: 'incomplete-lib',
          license: 'MIT',
          version: undefined,
          author: null,
          description: '',
          'home page': undefined
        }
      ]
      const mockResponse = {
        status: 200,
        content: incompleteData
      }
      mockClient.get.mockResolvedValue(mockResponse)

      const result = await repository.getLicences()

      expect(mockClient.get).toHaveBeenCalledWith('/licences/')
    })

    test('should handle licence with all fields null', async () => {
      const nullData = [
        {
          library: null,
          license: null,
          version: null,
          author: null,
          description: null,
          'home page': null
        }
      ]
      const mockResponse = {
        status: 200,
        content: nullData
      }
      mockClient.get.mockResolvedValue(mockResponse)

      const result = await repository.getLicences()

      expect(mockClient.get).toHaveBeenCalledWith('/licences/')
    })

    test('should handle 404 not found error', async () => {
      const mockResponse = {
        status: 404,
        content: { error: 'Licences not found' }
      }
      mockClient.get.mockResolvedValue(mockResponse)

      await expect(repository.getLicences()).rejects.toThrow('Error getting licences')
    })

    test('should handle 401 unauthorized error', async () => {
      const mockResponse = {
        status: 401,
        content: { error: 'Unauthorized' }
      }
      mockClient.get.mockResolvedValue(mockResponse)

      await expect(repository.getLicences()).rejects.toThrow('Error getting licences')
    })

    test('should handle 403 forbidden error', async () => {
      const mockResponse = {
        status: 403,
        content: { error: 'Forbidden' }
      }
      mockClient.get.mockResolvedValue(mockResponse)

      await expect(repository.getLicences()).rejects.toThrow('Error getting licences')
    })

    test('should handle timeout error', async () => {
      const timeoutError = new Error('Request timeout')
      timeoutError.name = 'TimeoutError'
      mockClient.get.mockRejectedValue(timeoutError)

      await expect(repository.getLicences()).rejects.toThrow('Request timeout')
    })

    test('should handle large number of licences', async () => {
      const largeLicenceData = Array.from({ length: 100 }, (_, i) => ({
        library: `library-${i}`,
        license: i % 2 === 0 ? 'MIT' : 'Apache-2.0',
        version: `${i}.0.0`,
        author: `Author ${i}`,
        description: `Description for library ${i}`,
        'home page': `https://library-${i}.com`
      }))
      
      const mockResponse = {
        status: 200,
        content: largeLicenceData
      }
      mockClient.get.mockResolvedValue(mockResponse)

      const result = await repository.getLicences()

      expect(mockClient.get).toHaveBeenCalledWith('/licences/')
    })
  })
})