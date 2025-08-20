import { describe, test, expect, vi } from 'vitest'
import type { AuthProvider } from '@/interfaces/AuthProvider'

describe('AuthProvider Interface', () => {
  test('should define correct method signatures', () => {
    // Create a mock implementation of AuthProvider
    const mockAuthProvider: AuthProvider = {
      login: vi.fn().mockResolvedValue(true),
      logout: vi.fn(),
      getToken: vi.fn().mockReturnValue('mock-token'),
      getUserId: vi.fn().mockReturnValue('user-123'),
      isAuthenticated: vi.fn().mockReturnValue(true),
      refreshToken: vi.fn().mockResolvedValue({ token: 'new-token', expiresAt: 1234567890 }),
      getUsername: vi.fn().mockReturnValue('john.doe'),
      getName: vi.fn().mockReturnValue('John Doe'),
      getEmail: vi.fn().mockReturnValue('john.doe@example.com'),
      getGivenName: vi.fn().mockReturnValue('John'),
      getFamilyName: vi.fn().mockReturnValue('Doe')
    }

    // Test required methods
    expect(typeof mockAuthProvider.login).toBe('function')
    expect(typeof mockAuthProvider.logout).toBe('function')
    expect(typeof mockAuthProvider.getToken).toBe('function')
    expect(typeof mockAuthProvider.getUserId).toBe('function')
    expect(typeof mockAuthProvider.isAuthenticated).toBe('function')

    // Test optional methods
    expect(typeof mockAuthProvider.refreshToken).toBe('function')
    expect(typeof mockAuthProvider.getUsername).toBe('function')
    expect(typeof mockAuthProvider.getName).toBe('function')
    expect(typeof mockAuthProvider.getEmail).toBe('function')
    expect(typeof mockAuthProvider.getGivenName).toBe('function')
    expect(typeof mockAuthProvider.getFamilyName).toBe('function')
  })

  test('should allow login with credentials', async () => {
    const mockAuthProvider: AuthProvider = {
      login: vi.fn().mockResolvedValue(true),
      logout: vi.fn(),
      getToken: vi.fn().mockReturnValue(null),
      getUserId: vi.fn().mockReturnValue(null),
      isAuthenticated: vi.fn().mockReturnValue(false)
    }

    const result = await mockAuthProvider.login('username', 'password')
    expect(result).toBe(true)
    expect(mockAuthProvider.login).toHaveBeenCalledWith('username', 'password')
  })

  test('should allow login without credentials', async () => {
    const mockAuthProvider: AuthProvider = {
      login: vi.fn().mockResolvedValue(true),
      logout: vi.fn(),
      getToken: vi.fn().mockReturnValue(null),
      getUserId: vi.fn().mockReturnValue(null),
      isAuthenticated: vi.fn().mockReturnValue(false)
    }

    const result = await mockAuthProvider.login()
    expect(result).toBe(true)
    expect(mockAuthProvider.login).toHaveBeenCalledWith()
  })

  test('should handle logout', () => {
    const mockAuthProvider: AuthProvider = {
      login: vi.fn().mockResolvedValue(false),
      logout: vi.fn(),
      getToken: vi.fn().mockReturnValue(null),
      getUserId: vi.fn().mockReturnValue(null),
      isAuthenticated: vi.fn().mockReturnValue(false)
    }

    mockAuthProvider.logout()
    expect(mockAuthProvider.logout).toHaveBeenCalledTimes(1)
  })

  test('should return token or null', () => {
    const mockAuthProvider: AuthProvider = {
      login: vi.fn().mockResolvedValue(false),
      logout: vi.fn(),
      getToken: vi.fn().mockReturnValue('auth-token-123'),
      getUserId: vi.fn().mockReturnValue(null),
      isAuthenticated: vi.fn().mockReturnValue(false)
    }

    const token = mockAuthProvider.getToken()
    expect(token).toBe('auth-token-123')
    expect(typeof token).toBe('string')
  })

  test('should return null when no token', () => {
    const mockAuthProvider: AuthProvider = {
      login: vi.fn().mockResolvedValue(false),
      logout: vi.fn(),
      getToken: vi.fn().mockReturnValue(null),
      getUserId: vi.fn().mockReturnValue(null),
      isAuthenticated: vi.fn().mockReturnValue(false)
    }

    const token = mockAuthProvider.getToken()
    expect(token).toBeNull()
  })

  test('should return user ID or null', () => {
    const mockAuthProvider: AuthProvider = {
      login: vi.fn().mockResolvedValue(false),
      logout: vi.fn(),
      getToken: vi.fn().mockReturnValue(null),
      getUserId: vi.fn().mockReturnValue('user-456'),
      isAuthenticated: vi.fn().mockReturnValue(false)
    }

    const userId = mockAuthProvider.getUserId()
    expect(userId).toBe('user-456')
    expect(typeof userId).toBe('string')
  })

  test('should return authentication status', () => {
    const authenticatedProvider: AuthProvider = {
      login: vi.fn().mockResolvedValue(false),
      logout: vi.fn(),
      getToken: vi.fn().mockReturnValue('token'),
      getUserId: vi.fn().mockReturnValue('user-123'),
      isAuthenticated: vi.fn().mockReturnValue(true)
    }

    const unauthenticatedProvider: AuthProvider = {
      login: vi.fn().mockResolvedValue(false),
      logout: vi.fn(),
      getToken: vi.fn().mockReturnValue(null),
      getUserId: vi.fn().mockReturnValue(null),
      isAuthenticated: vi.fn().mockReturnValue(false)
    }

    expect(authenticatedProvider.isAuthenticated()).toBe(true)
    expect(unauthenticatedProvider.isAuthenticated()).toBe(false)
  })

  test('should handle optional refreshToken method', async () => {
    const mockAuthProvider: AuthProvider = {
      login: vi.fn().mockResolvedValue(false),
      logout: vi.fn(),
      getToken: vi.fn().mockReturnValue(null),
      getUserId: vi.fn().mockReturnValue(null),
      isAuthenticated: vi.fn().mockReturnValue(false),
      refreshToken: vi.fn().mockResolvedValue({ token: 'refreshed-token', expiresAt: 9876543210 })
    }

    const result = await mockAuthProvider.refreshToken!()
    expect(result).toEqual({ token: 'refreshed-token', expiresAt: 9876543210 })
    expect(mockAuthProvider.refreshToken).toHaveBeenCalledTimes(1)
  })

  test('should handle refreshToken returning null', async () => {
    const mockAuthProvider: AuthProvider = {
      login: vi.fn().mockResolvedValue(false),
      logout: vi.fn(),
      getToken: vi.fn().mockReturnValue(null),
      getUserId: vi.fn().mockReturnValue(null),
      isAuthenticated: vi.fn().mockReturnValue(false),
      refreshToken: vi.fn().mockResolvedValue(null)
    }

    const result = await mockAuthProvider.refreshToken!()
    expect(result).toBeNull()
  })

  test('should handle all optional user info methods', () => {
    const mockAuthProvider: AuthProvider = {
      login: vi.fn().mockResolvedValue(false),
      logout: vi.fn(),
      getToken: vi.fn().mockReturnValue(null),
      getUserId: vi.fn().mockReturnValue(null),
      isAuthenticated: vi.fn().mockReturnValue(false),
      getUsername: vi.fn().mockReturnValue('jane.smith'),
      getName: vi.fn().mockReturnValue('Jane Smith'),
      getEmail: vi.fn().mockReturnValue('jane.smith@company.com'),
      getGivenName: vi.fn().mockReturnValue('Jane'),
      getFamilyName: vi.fn().mockReturnValue('Smith')
    }

    expect(mockAuthProvider.getUsername!()).toBe('jane.smith')
    expect(mockAuthProvider.getName!()).toBe('Jane Smith')
    expect(mockAuthProvider.getEmail!()).toBe('jane.smith@company.com')
    expect(mockAuthProvider.getGivenName!()).toBe('Jane')
    expect(mockAuthProvider.getFamilyName!()).toBe('Smith')
  })

  test('should allow minimal implementation with only required methods', () => {
    const minimalProvider: AuthProvider = {
      login: vi.fn().mockResolvedValue(true),
      logout: vi.fn(),
      getToken: vi.fn().mockReturnValue('token'),
      getUserId: vi.fn().mockReturnValue('user-id'),
      isAuthenticated: vi.fn().mockReturnValue(true)
    }

    // Verify all required methods exist
    expect(minimalProvider.login).toBeDefined()
    expect(minimalProvider.logout).toBeDefined()
    expect(minimalProvider.getToken).toBeDefined()
    expect(minimalProvider.getUserId).toBeDefined()
    expect(minimalProvider.isAuthenticated).toBeDefined()

    // Verify optional methods are not required
    expect(minimalProvider.refreshToken).toBeUndefined()
    expect(minimalProvider.getUsername).toBeUndefined()
    expect(minimalProvider.getName).toBeUndefined()
    expect(minimalProvider.getEmail).toBeUndefined()
    expect(minimalProvider.getGivenName).toBeUndefined()
    expect(minimalProvider.getFamilyName).toBeUndefined()
  })
})
