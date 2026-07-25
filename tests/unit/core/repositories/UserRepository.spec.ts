import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import UserRepository from '@cornflow-ui/core/repositories/UserRepository'

// Mock the API client
vi.mock('@cornflow-ui/core/api/Api', () => ({
  default: {
    get: vi.fn(),
    put: vi.fn(),
    remove: vi.fn()
  }
}))

// Mock User model
vi.mock('@cornflow-ui/core/models/User', () => ({
  User: vi.fn()
}))

describe('UserRepository', () => {
  let repository: UserRepository
  let mockClient: any

  beforeEach(async () => {
    // Get mocked modules
    const Api = await import('@cornflow-ui/core/api/Api')
    mockClient = Api.default
    
    // Reset mocks
    vi.clearAllMocks()
    
    repository = new UserRepository()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getUserById', () => {
    const mockUserData = {
      id: 'test-user-id',
      username: 'testuser',
      email: 'test@example.com',
      first_name: 'Test',
      last_name: 'User'
    }

    test('should get user by ID successfully', async () => {
      const mockResponse = {
        status: 200,
        content: mockUserData
      }
      mockClient.get.mockResolvedValue(mockResponse)

      const result = await repository.getUserById('test-user-id')

      expect(mockClient.get).toHaveBeenCalledWith('/user/test-user-id/')
    })

    test('should reject when API returns non-200 status', async () => {
      const mockResponse = {
        status: 404,
        content: { error: 'User not found' }
      }
      mockClient.get.mockResolvedValue(mockResponse)

      await expect(repository.getUserById('invalid-id')).rejects.toThrow('Error getting user')
    })

    test('should reject when API call fails', async () => {
      const error = new Error('Network error')
      mockClient.get.mockRejectedValue(error)

      await expect(repository.getUserById('test-user-id')).rejects.toThrow('Network error')
    })

    test('should handle missing user data gracefully', async () => {
      const mockResponse = {
        status: 200,
        content: null
      }
      mockClient.get.mockResolvedValue(mockResponse)

      // The repository will throw an error when trying to access null user properties
      await expect(repository.getUserById('test-user-id')).rejects.toThrow()
      expect(mockClient.get).toHaveBeenCalledWith('/user/test-user-id/')
    })
  })

  describe('changePassword', () => {
    test('should change password successfully', async () => {
      const mockResponse = {
        status: 200,
        content: { success: true }
      }
      mockClient.put.mockResolvedValue(mockResponse)

      const result = await repository.changePassword('test-user-id', 'newPassword123')

      expect(mockClient.put).toHaveBeenCalledWith('/user/test-user-id/', {
        password: 'newPassword123'
      })
      expect(result).toEqual({ success: true })
    })

    test('should send current_password when provided', async () => {
      const mockResponse = {
        status: 200,
        content: { success: true }
      }
      mockClient.put.mockResolvedValue(mockResponse)

      const result = await repository.changePassword(
        'test-user-id',
        'newPassword123',
        'oldPassword456'
      )

      expect(mockClient.put).toHaveBeenCalledWith('/user/test-user-id/', {
        password: 'newPassword123',
        current_password: 'oldPassword456'
      })
      expect(result).toEqual({ success: true })
    })

    test('should return failure with message when password change fails with non-200 status', async () => {
      const mockResponse = {
        status: 400,
        content: { error: 'Invalid password' }
      }
      mockClient.put.mockResolvedValue(mockResponse)

      const result = await repository.changePassword('test-user-id', 'weak')

      expect(result).toEqual({ success: false, message: 'Invalid password' })
    })

    test('should reject when API call fails', async () => {
      const error = new Error('Network error')
      mockClient.put.mockRejectedValue(error)

      await expect(repository.changePassword('test-user-id', 'newPassword123')).rejects.toThrow('Network error')
    })

    test('should handle empty password', async () => {
      const mockResponse = {
        status: 200,
        content: { success: true }
      }
      mockClient.put.mockResolvedValue(mockResponse)

      const result = await repository.changePassword('test-user-id', '')

      expect(mockClient.put).toHaveBeenCalledWith('/user/test-user-id/', {
        password: ''
      })
      expect(result).toEqual({ success: true })
    })

    test('should handle unauthorized access', async () => {
      const mockResponse = {
        status: 401,
        content: { error: 'Unauthorized' }
      }
      mockClient.put.mockResolvedValue(mockResponse)

      const result = await repository.changePassword('test-user-id', 'newPassword123')

      expect(result).toEqual({ success: false, message: 'Unauthorized' })
    })

    test('should handle forbidden access', async () => {
      const mockResponse = {
        status: 403,
        content: { error: 'Forbidden' }
      }
      mockClient.put.mockResolvedValue(mockResponse)

      const result = await repository.changePassword('test-user-id', 'newPassword123')

      expect(result).toEqual({ success: false, message: 'Forbidden' })
    })
  })

  describe('resetMfa', () => {
    test('should return true when the MFA reset succeeds', async () => {
      mockClient.remove.mockResolvedValue({ status: 200, content: {} })

      const result = await repository.resetMfa('test-user-id')

      expect(mockClient.remove).toHaveBeenCalledWith('/user/test-user-id/mfa/')
      expect(result).toBe(true)
    })

    test('should return false when the MFA reset fails', async () => {
      mockClient.remove.mockResolvedValue({ status: 400, content: {} })

      const result = await repository.resetMfa('test-user-id')

      expect(result).toBe(false)
    })

    test('should reject when API call fails', async () => {
      mockClient.remove.mockRejectedValue(new Error('Network error'))

      await expect(repository.resetMfa('test-user-id')).rejects.toThrow('Network error')
    })
  })
})