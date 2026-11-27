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
      expect(result.mfaEnabled).toBe(false)
    })

    test('says whether the user has two-factor authentication', async () => {
      mockClient.get.mockResolvedValue({ status: 200, content: { ...mockUserData, mfa_enabled: true } })

      const result = await repository.getUserById('test-user-id')

      expect(result.mfaEnabled).toBe(true)
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

  describe('unlockUser', () => {
    test('unlocks the account', async () => {
      mockClient.put.mockResolvedValue({ status: 200, content: {} })

      expect(await repository.unlockUser('7')).toBe(true)
      expect(mockClient.put).toHaveBeenCalledWith('/user/7/unlock/', {})
    })

    test('an account left to a platform administrator rejects with its own error', async () => {
      mockClient.put.mockResolvedValue({ status: 403, content: {} })

      await expect(repository.unlockUser('7')).rejects.toThrow('platform_admin_required')
    })

    test('any other refusal resolves to false', async () => {
      mockClient.put.mockResolvedValue({ status: 400, content: {} })

      expect(await repository.unlockUser('7')).toBe(false)
    })
  })

  describe('resetMfa', () => {
    test("turns off the user's two-factor authentication", async () => {
      mockClient.remove.mockResolvedValue({ status: 200, content: {} })

      expect(await repository.resetMfa('7')).toBe(true)
      expect(mockClient.remove).toHaveBeenCalledWith('/user/7/mfa/')
    })

    test('a refusal resolves to false', async () => {
      mockClient.remove.mockResolvedValue({ status: 403, content: {} })

      expect(await repository.resetMfa('7')).toBe(false)
    })
  })

  describe('changePassword', () => {
    test('sends the new password with the current one', async () => {
      mockClient.put.mockResolvedValue({ status: 200, content: {} })

      const result = await repository.changePassword('7', 'N3w-Passphrase!x', 'Old-Passphrase!1')

      expect(mockClient.put).toHaveBeenCalledWith('/user/7/', {
        password: 'N3w-Passphrase!x',
        current_password: 'Old-Passphrase!1',
      })
      expect(result).toEqual({ success: true })
    })

    test('says why cornflow refused the new password', async () => {
      mockClient.put.mockResolvedValue({
        status: 400,
        content: { error: 'The password has been used recently' },
      })

      const result = await repository.changePassword('7', 'N3w-Passphrase!x', 'Old-Passphrase!1')

      expect(result).toEqual({ success: false, message: 'The password has been used recently' })
    })

    test('a wrong current password is refused', async () => {
      mockClient.put.mockResolvedValue({ status: 403, content: { error: 'Wrong current password' } })

      const result = await repository.changePassword('7', 'N3w-Passphrase!x', 'wrong')

      expect(result).toEqual({ success: false, message: 'Wrong current password' })
    })

    test('a network error reaches the caller', async () => {
      mockClient.put.mockRejectedValue(new Error('Network error'))

      await expect(
        repository.changePassword('7', 'N3w-Passphrase!x', 'Old-Passphrase!1'),
      ).rejects.toThrow('Network error')
    })
  })
})