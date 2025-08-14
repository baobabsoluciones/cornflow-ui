import { describe, test, expect, vi, beforeEach } from 'vitest'
import AuthService from '@/services/AuthService'

// Mock API client
vi.mock('@/api/Api', () => ({
  default: {
    post: vi.fn()
  }
}))

describe('AuthService', () => {
  // Mock sessionStorage
  const mockStorage: { [key: string]: string } = {}
  const sessionStorageMock = {
    getItem: vi.fn((key: string) => mockStorage[key] || null),
    setItem: vi.fn((key: string, value: string) => { mockStorage[key] = value }),
    removeItem: vi.fn((key: string) => delete mockStorage[key]),
    clear: vi.fn(() => { Object.keys(mockStorage).forEach(key => delete mockStorage[key]) })
  }
  Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock })

  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorageMock.clear()
  })

  describe('login', () => {
    test('successful login stores authentication data', async () => {
      const mockResponse = {
        status: 200,
        content: {
          token: 'mock-token',
          id: 'user-123'
        }
      }

      const { default: client } = await import('@/api/Api')
      vi.mocked(client.post).mockResolvedValue(mockResponse)

      const result = await AuthService.login('testuser', 'password123')

      expect(client.post).toHaveBeenCalledWith(
        '/login/',
        { username: 'testuser', password: 'password123' },
        { 'Content-Type': 'application/json' }
      )
      expect(result).toBe(true)
      expect(sessionStorageMock.setItem).toHaveBeenCalledWith('isAuthenticated', 'true')
      expect(sessionStorageMock.setItem).toHaveBeenCalledWith('token', 'mock-token')
      expect(sessionStorageMock.setItem).toHaveBeenCalledWith('userId', 'user-123')
    })

    test('failed login sets authentication to false', async () => {
      const mockResponse = {
        status: 401,
        content: {}
      }

      const { default: client } = await import('@/api/Api')
      vi.mocked(client.post).mockResolvedValue(mockResponse)

      const result = await AuthService.login('testuser', 'wrongpassword')

      expect(result).toBe(false)
      expect(sessionStorageMock.setItem).toHaveBeenCalledWith('isAuthenticated', 'false')
    })

    test('handles API errors gracefully', async () => {
      const { default: client } = await import('@/api/Api')
      vi.mocked(client.post).mockRejectedValue(new Error('Network error'))

      await expect(AuthService.login('testuser', 'password123')).rejects.toThrow('Network error')
    })
  })

  describe('signup', () => {
    test('successful signup returns true', async () => {
      const mockResponse = {
        status: 201,
        content: {}
      }

      const { default: client } = await import('@/api/Api')
      vi.mocked(client.post).mockResolvedValue(mockResponse)

      const result = await AuthService.signup('test@example.com', 'testuser', 'password123')

      expect(client.post).toHaveBeenCalledWith(
        '/signup/',
        { email: 'test@example.com', username: 'testuser', password: 'password123' },
        { 'Content-Type': 'application/json' }
      )
      expect(result).toBe(true)
    })

    test('failed signup returns false', async () => {
      const mockResponse = {
        status: 400,
        content: {}
      }

      const { default: client } = await import('@/api/Api')
      vi.mocked(client.post).mockResolvedValue(mockResponse)

      const result = await AuthService.signup('test@example.com', 'testuser', 'password123')

      expect(result).toBe(false)
    })

    test('handles API errors gracefully', async () => {
      const { default: client } = await import('@/api/Api')
      vi.mocked(client.post).mockRejectedValue(new Error('Network error'))

      await expect(AuthService.signup('test@example.com', 'testuser', 'password123')).rejects.toThrow('Network error')
    })
  })

  describe('logout', () => {
    test('clears authentication data from session storage', () => {
      // Set up initial state
      mockStorage['isAuthenticated'] = 'true'
      mockStorage['token'] = 'mock-token'
      mockStorage['userId'] = 'user-123'

      AuthService.logout()

      expect(sessionStorageMock.setItem).toHaveBeenCalledWith('isAuthenticated', 'false')
      expect(sessionStorageMock.removeItem).toHaveBeenCalledWith('token')
      expect(sessionStorageMock.removeItem).toHaveBeenCalledWith('userId')
    })
  })

  describe('getToken', () => {
    test('returns token from session storage', () => {
      mockStorage['token'] = 'mock-token'

      const token = AuthService.getToken()

      expect(token).toBe('mock-token')
      expect(sessionStorageMock.getItem).toHaveBeenCalledWith('token')
    })

    test('returns null when no token exists', () => {
      const token = AuthService.getToken()

      expect(token).toBeNull()
    })
  })

  describe('getUserId', () => {
    test('returns user ID from session storage', () => {
      mockStorage['userId'] = 'user-123'

      const userId = AuthService.getUserId()

      expect(userId).toBe('user-123')
      expect(sessionStorageMock.getItem).toHaveBeenCalledWith('userId')
    })

    test('returns null when no user ID exists', () => {
      const userId = AuthService.getUserId()

      expect(userId).toBeNull()
    })
  })

  describe('isAuthenticated', () => {
    test('returns true when authenticated', () => {
      mockStorage['isAuthenticated'] = 'true'

      const result = AuthService.isAuthenticated()

      expect(result).toBe(true)
    })

    test('returns false when not authenticated', () => {
      mockStorage['isAuthenticated'] = 'false'

      const result = AuthService.isAuthenticated()

      expect(result).toBe(false)
    })

    test('returns false when authentication status is not set', () => {
      const result = AuthService.isAuthenticated()

      expect(result).toBe(false)
    })
  })

  describe('refreshToken', () => {
    test('returns null as refresh is not supported', async () => {
      const result = await AuthService.refreshToken()

      expect(result).toBeNull()
    })
  })
})
