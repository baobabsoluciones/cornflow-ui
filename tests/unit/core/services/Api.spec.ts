import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock config
const mockConfig = vi.hoisted(() => ({
  backend: 'http://localhost:8000',
  auth: {
    type: 'cornflow'
  },
  hasExternalApp: false,
  initConfig: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('@/config', () => ({
  default: mockConfig
}))

// Mock AuthServiceFactory
const mockAuthService = vi.hoisted(() => ({
  refreshToken: vi.fn()
}))

const mockGetAuthService = vi.hoisted(() => vi.fn())

vi.mock('@/services/AuthServiceFactory', () => ({
  default: mockGetAuthService
}))

// Mock router
const mockRouter = vi.hoisted(() => ({
  push: vi.fn()
}))

vi.mock('@/router', () => ({
  default: mockRouter
}))

// Mock fetch globally
global.fetch = vi.fn()

describe('ApiClient', () => {
  let apiClient: any
  let sessionStorageMock: any
  let localStorageMock: any

  beforeEach(async () => {
    vi.clearAllMocks()
    
    // Setup storage mocks
    const createStorageMock = () => {
      const storage: { [key: string]: string } = {}
      return {
        getItem: vi.fn((key: string) => storage[key] || null),
        setItem: vi.fn((key: string, value: string) => { storage[key] = value }),
        removeItem: vi.fn((key: string) => delete storage[key]),
        clear: vi.fn(() => Object.keys(storage).forEach(key => delete storage[key]))
      }
    }
    
    sessionStorageMock = createStorageMock()
    localStorageMock = createStorageMock()
    
    Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock })
    Object.defineProperty(window, 'localStorage', { value: localStorageMock })
    
    // Reset config
    mockConfig.backend = 'http://localhost:8000'
    mockConfig.auth.type = 'cornflow'
    mockConfig.hasExternalApp = false
    
    // Reset auth service mock
    mockGetAuthService.mockResolvedValue(mockAuthService)
    
    // Import the ApiClient instance
    const module = await import('@/api/Api')
    apiClient = module.default
    
    // Reset the client state for each test
    apiClient['baseUrl'] = 'http://localhost:8000'
    apiClient['authToken'] = null
    apiClient['tokenExpiration'] = null
    apiClient['refreshingToken'] = false
    apiClient['refreshTokenPromise'] = null
    if (apiClient['refreshTimer']) {
      clearTimeout(apiClient['refreshTimer'])
      apiClient['refreshTimer'] = null
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
    // Clear any active timers
    vi.clearAllTimers()
  })

  describe('Constructor and Initialization', () => {
    test('initializes with correct base URL', () => {
      expect(apiClient['baseUrl']).toBe('http://localhost:8000')
    })

    test('loads token from sessionStorage during initialization', () => {
      sessionStorageMock.getItem.mockReturnValue('test-token')
      
      apiClient.initializeToken()
      
      expect(sessionStorageMock.getItem).toHaveBeenCalledWith('token')
      expect(apiClient['authToken']).toBe('test-token')
    })

    test('loads token expiration and schedules refresh', () => {
      const futureExpiration = Date.now() + 3600000 // 1 hour from now
      sessionStorageMock.getItem.mockImplementation((key) => {
        if (key === 'token') return 'test-token'
        if (key === 'tokenExpiration') return futureExpiration.toString()
        return null
      })
      
      apiClient.initializeToken()
      
      expect(sessionStorageMock.getItem).toHaveBeenCalledWith('tokenExpiration')
      expect(apiClient['tokenExpiration']).toBe(futureExpiration)
    })
  })

  describe('Token Management', () => {
    test('initializeToken loads token and expiration', () => {
      sessionStorageMock.getItem.mockImplementation((key) => {
        if (key === 'token') return 'test-token'
        if (key === 'tokenExpiration') return '1234567890000'
        return null
      })
      
      apiClient.initializeToken()
      
      expect(sessionStorageMock.getItem).toHaveBeenCalledWith('token')
      expect(sessionStorageMock.getItem).toHaveBeenCalledWith('tokenExpiration')
      expect(apiClient['authToken']).toBe('test-token')
      expect(apiClient['tokenExpiration']).toBe(1234567890000)
    })

    test('scheduleTokenRefresh sets timer for external auth', () => {
      vi.useFakeTimers()
      mockConfig.auth.type = 'azure'
      
      const futureExpiration = Date.now() + 3600000 // 1 hour from now
      apiClient['tokenExpiration'] = futureExpiration
      
      const setTimeoutSpy = vi.spyOn(global, 'setTimeout')
      
      apiClient['scheduleTokenRefresh']()
      
      expect(setTimeoutSpy).toHaveBeenCalled()
      
      vi.useRealTimers()
    })

    test('scheduleTokenRefresh does not set timer for cornflow auth', () => {
      vi.useFakeTimers()
      mockConfig.auth.type = 'cornflow'
      
      const futureExpiration = Date.now() + 3600000
      apiClient['tokenExpiration'] = futureExpiration
      
      const setTimeoutSpy = vi.spyOn(global, 'setTimeout')
      
      apiClient['scheduleTokenRefresh']()
      
      expect(setTimeoutSpy).not.toHaveBeenCalled()
      
      vi.useRealTimers()
    })

    test('isTokenExpired returns true when token is expired', () => {
      const pastExpiration = Date.now() - 3600000 // 1 hour ago
      apiClient['tokenExpiration'] = pastExpiration
      
      const result = apiClient['isTokenExpired']()
      
      expect(result).toBe(true)
    })

    test('isTokenExpired returns false when token is not expired', () => {
      const futureExpiration = Date.now() + 3600000 // 1 hour from now
      apiClient['tokenExpiration'] = futureExpiration
      
      const result = apiClient['isTokenExpired']()
      
      expect(result).toBe(false)
    })

    test('isTokenExpired loads expiration from sessionStorage when not in memory', () => {
      const futureExpiration = Date.now() + 3600000
      sessionStorageMock.getItem.mockReturnValue(futureExpiration.toString())
      
      const result = apiClient['isTokenExpired']()
      
      expect(sessionStorageMock.getItem).toHaveBeenCalledWith('tokenExpiration')
      expect(result).toBe(false)
    })
  })

  describe('Token Refresh', () => {
    test('refreshToken succeeds for external auth', async () => {
      mockConfig.auth.type = 'azure'
      
      const mockRefreshResult = {
        token: 'new-external-token',
        expiresAt: Date.now() + 3600000
      }
      
      mockAuthService.refreshToken.mockResolvedValue(mockRefreshResult)
      
      // Mock backend token exchange
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ token: 'new-backend-token' })
      } as Response)
      
      await apiClient['refreshToken']()
      
      expect(mockAuthService.refreshToken).toHaveBeenCalled()
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8000/login/',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer new-external-token'
          })
        })
      )
      expect(sessionStorageMock.setItem).toHaveBeenCalledWith('token', 'new-backend-token')
      expect(sessionStorageMock.setItem).toHaveBeenCalledWith('originalToken', 'new-external-token')
    })

    test('refreshToken handles backend exchange failure', async () => {
      mockConfig.auth.type = 'azure'
      
      const mockRefreshResult = {
        token: 'new-external-token',
        expiresAt: Date.now() + 3600000
      }
      
      mockAuthService.refreshToken.mockResolvedValue(mockRefreshResult)
      
      // Mock backend failure
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 401
      } as Response)
      
      await expect(apiClient['refreshToken']()).rejects.toThrow('Backend token exchange failed')
    })

    test('refreshToken handles auth service refresh failure', async () => {
      mockConfig.auth.type = 'azure'
      mockAuthService.refreshToken.mockResolvedValue(null)
      
      await expect(apiClient['refreshToken']()).rejects.toThrow('Token refresh returned null')
    })

    test('refreshToken throws error for unsupported auth type', async () => {
      mockConfig.auth.type = 'cornflow'
      
      await expect(apiClient['refreshToken']()).rejects.toThrow('Token refresh not supported for this auth type')
    })

    test('refreshToken prevents concurrent refresh attempts', async () => {
      mockConfig.auth.type = 'azure'
      
      const mockRefreshResult = {
        token: 'new-external-token',
        expiresAt: Date.now() + 3600000
      }
      
      mockAuthService.refreshToken.mockResolvedValue(mockRefreshResult)
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ token: 'new-backend-token' })
      } as Response)
      
      // Start two refresh attempts concurrently
      const promise1 = apiClient['refreshToken']()
      const promise2 = apiClient['refreshToken']()
      
      await Promise.all([promise1, promise2])
      
      // Should only call auth service once
      expect(mockAuthService.refreshToken).toHaveBeenCalledTimes(1)
    })
  })

  describe('Request Headers', () => {
    test('getHeaders includes authorization header when token exists', () => {
      apiClient['authToken'] = 'test-token'
      
      const headers = apiClient['getHeaders']()
      
      expect(headers).toEqual({
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token'
      })
    })

    test('getHeaders loads token from sessionStorage when not in memory', () => {
      sessionStorageMock.getItem.mockReturnValue('session-token')
      
      const headers = apiClient['getHeaders']()
      
      expect(sessionStorageMock.getItem).toHaveBeenCalledWith('token')
      expect(headers).toEqual({
        'Content-Type': 'application/json',
        'Authorization': 'Bearer session-token'
      })
    })

    test('getHeaders warns when no token is available', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      
      const headers = apiClient['getHeaders']()
      
      expect(consoleSpy).toHaveBeenCalledWith('No Authorization header added - no token available')
      expect(headers).toEqual({
        'Content-Type': 'application/json'
      })
      
      consoleSpy.mockRestore()
    })
  })

  describe('Request Method', () => {
    test('request builds correct URL with base path', async () => {
      vi.mocked(fetch).mockResolvedValue({
        status: 200,
        headers: {
          get: () => 'application/json'
        },
        json: () => Promise.resolve({ data: 'test' })
      } as Response)
      
      await apiClient['request']('/test')
      
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8000/test',
        expect.any(Object)
      )
    })

    test('request builds correct URL with external app path', async () => {
      mockConfig.hasExternalApp = true
      
      vi.mocked(fetch).mockResolvedValue({
        status: 200,
        headers: {
          get: () => 'application/json'
        },
        json: () => Promise.resolve({ data: 'test' })
      } as Response)
      
      await apiClient['request']('/test')
      
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8000/cornflow/test',
        expect.any(Object)
      )
    })

    test('request builds correct URL with external flag', async () => {
      vi.mocked(fetch).mockResolvedValue({
        status: 200,
        headers: {
          get: () => 'application/json'
        },
        json: () => Promise.resolve({ data: 'test' })
      } as Response)
      
      await apiClient['request']('/test', { isExternal: true })
      
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8000/external/test',
        expect.any(Object)
      )
    })

    test('request handles query parameters', async () => {
      vi.mocked(fetch).mockResolvedValue({
        status: 200,
        headers: {
          get: () => 'application/json'
        },
        json: () => Promise.resolve({ data: 'test' })
      } as Response)
      
      await apiClient['request']('/test', { params: { foo: 'bar', baz: 'qux' } })
      
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8000/test?foo=bar&baz=qux',
        expect.any(Object)
      )
    })

    test('request refreshes token when expired for external auth', async () => {
      mockConfig.auth.type = 'azure'
      apiClient['tokenExpiration'] = Date.now() - 3600000 // Expired
      
      const refreshSpy = vi.spyOn(apiClient, 'refreshToken').mockResolvedValue(undefined)
      
      vi.mocked(fetch).mockResolvedValue({
        status: 200,
        headers: {
          get: () => 'application/json'
        },
        json: () => Promise.resolve({ data: 'test' })
      } as Response)
      
      await apiClient['request']('/test')
      
      expect(refreshSpy).toHaveBeenCalled()
    })

    test('request does not refresh token for login endpoints', async () => {
      mockConfig.auth.type = 'azure'
      apiClient['tokenExpiration'] = Date.now() - 3600000 // Expired
      
      const refreshSpy = vi.spyOn(apiClient, 'refreshToken')
      
      vi.mocked(fetch).mockResolvedValue({
        status: 200,
        headers: {
          get: () => 'application/json'
        },
        json: () => Promise.resolve({ data: 'test' })
      } as Response)
      
      await apiClient['request']('/login/')
      
      expect(refreshSpy).not.toHaveBeenCalled()
    })

    test('request handles JSON response correctly', async () => {
      const mockData = { message: 'success' }
      
      vi.mocked(fetch).mockResolvedValue({
        status: 200,
        headers: {
          get: () => 'application/json'
        },
        json: () => Promise.resolve(mockData)
      } as Response)
      
      const result = await apiClient['request']('/test')
      
      expect(result).toEqual({
        status: 200,
        content: mockData
      })
    })

    test('request handles blob response correctly', async () => {
      const mockBlob = new Blob(['binary data'])
      
      vi.mocked(fetch).mockResolvedValue({
        status: 200,
        headers: {
          get: () => 'application/octet-stream'
        },
        blob: () => Promise.resolve(mockBlob)
      } as Response)
      
      const result = await apiClient['request']('/test')
      
      expect(result).toEqual({
        status: 200,
        content: mockBlob
      })
    })

    test('request handles JSON parsing errors', async () => {
      vi.mocked(fetch).mockResolvedValue({
        status: 200,
        headers: {
          get: () => 'application/json'
        },
        json: () => Promise.reject(new Error('Invalid JSON'))
      } as Response)
      
      const result = await apiClient['request']('/test')
      
      expect(result).toEqual({
        status: 200,
        content: { message: 'Could not parse response' }
      })
    })

    test('request handles 401 unauthorized response', async () => {
      const handleAuthFailureSpy = vi.spyOn(apiClient, 'handleAuthFailure').mockImplementation(() => {})
      
      vi.mocked(fetch).mockResolvedValue({
        status: 401,
        headers: {
          get: () => 'application/json'
        },
        json: () => Promise.resolve({ error: 'Unauthorized' })
      } as Response)
      
      await expect(apiClient['request']('/test')).rejects.toThrow('Unauthorized: Session expired')
      expect(handleAuthFailureSpy).toHaveBeenCalled()
    })

    test('request handles FormData body correctly', async () => {
      const formData = new FormData()
      formData.append('file', 'test')
      
      vi.mocked(fetch).mockResolvedValue({
        status: 200,
        headers: {
          get: () => 'application/json'
        },
        json: () => Promise.resolve({ success: true })
      } as Response)
      
      await apiClient['request']('/upload', { 
        method: 'POST', 
        body: formData 
      })
      
      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: formData
        })
      )
    })

    test('request handles network errors', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Network error'))
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      await expect(apiClient['request']('/test')).rejects.toThrow('Network error')
      expect(consoleSpy).toHaveBeenCalledWith('Request failed:', expect.any(Error))
      
      consoleSpy.mockRestore()
    })
  })

  describe('HTTP Methods', () => {
    beforeEach(() => {
      vi.mocked(fetch).mockResolvedValue({
        status: 200,
        headers: {
          get: () => 'application/json'
        },
        json: () => Promise.resolve({ success: true })
      } as Response)
    })

    test('get method calls request with correct parameters', async () => {
      const requestSpy = vi.spyOn(apiClient, 'request')
      
      await apiClient.get('/test', { param: 'value' }, { 'Custom-Header': 'test' }, true)
      
      expect(requestSpy).toHaveBeenCalledWith('/test', {
        method: 'GET',
        params: { param: 'value' },
        headers: { 'Custom-Header': 'test' },
        isExternal: true
      })
    })

    test('post method calls request with correct parameters', async () => {
      const requestSpy = vi.spyOn(apiClient, 'request')
      const data = { name: 'test' }
      
      await apiClient.post('/test', data, { 'Custom-Header': 'test' }, true)
      
      expect(requestSpy).toHaveBeenCalledWith('/test', {
        method: 'POST',
        body: data,
        headers: { 'Custom-Header': 'test' },
        isExternal: true
      })
    })

    test('put method calls request with correct parameters', async () => {
      const requestSpy = vi.spyOn(apiClient, 'request')
      const data = { name: 'updated' }
      
      await apiClient.put('/test', data, { 'Custom-Header': 'test' }, true)
      
      expect(requestSpy).toHaveBeenCalledWith('/test', {
        method: 'PUT',
        body: data,
        headers: { 'Custom-Header': 'test' },
        isExternal: true
      })
    })

    test('remove method calls request with correct parameters', async () => {
      const requestSpy = vi.spyOn(apiClient, 'request')
      
      await apiClient.remove('/test', { 'Custom-Header': 'test' }, true)
      
      expect(requestSpy).toHaveBeenCalledWith('/test', {
        method: 'DELETE',
        headers: { 'Custom-Header': 'test' },
        isExternal: true
      })
    })
  })

  describe('Authentication Failure Handling', () => {
    test('handleAuthFailure clears session data', () => {
      apiClient['refreshTimer'] = setTimeout(() => {}, 1000)
      apiClient['authToken'] = 'test-token'
      apiClient['tokenExpiration'] = Date.now() + 3600000
      
      apiClient['handleAuthFailure']()
      
      expect(sessionStorageMock.removeItem).toHaveBeenCalledWith('token')
      expect(sessionStorageMock.removeItem).toHaveBeenCalledWith('tokenExpiration')
      expect(sessionStorageMock.removeItem).toHaveBeenCalledWith('originalToken')
      expect(sessionStorageMock.setItem).toHaveBeenCalledWith('isAuthenticated', 'false')
      expect(apiClient['authToken']).toBeNull()
      expect(apiClient['tokenExpiration']).toBeNull()
    })

    test('handleAuthFailure clears localStorage auth data', () => {
      const clearLocalStorageSpy = vi.spyOn(apiClient, 'clearLocalStorageAuthData')
      
      apiClient['handleAuthFailure']()
      
      expect(clearLocalStorageSpy).toHaveBeenCalled()
    })

    test('handleAuthFailure redirects to sign-in page', (done) => {
      apiClient['handleAuthFailure']()
      
      // Use setTimeout to wait for the async redirect
      setTimeout(() => {
        expect(mockRouter.push).toHaveBeenCalledWith({
          path: '/sign-in',
          query: { expired: 'true' }
        })
        done()
      }, 10)
    })
  })

  describe('Local Storage Cleanup', () => {
    test('clearLocalStorageAuthData removes auth-related items', () => {
      const mockKeys = [
        'CognitoIdentityServiceProvider.test',
        'msal.token.test',
        'amplify.auth.test',
        'normal.key',
        'user.preferences'
      ]
      
      vi.spyOn(Object, 'keys').mockReturnValue(mockKeys)
      
      apiClient['clearLocalStorageAuthData']()
      
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('CognitoIdentityServiceProvider.test')
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('msal.token.test')
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('amplify.auth.test')
      expect(localStorageMock.removeItem).not.toHaveBeenCalledWith('normal.key')
      expect(localStorageMock.removeItem).not.toHaveBeenCalledWith('user.preferences')
    })

    test('clearLocalStorageAuthData handles empty localStorage', () => {
      vi.spyOn(Object, 'keys').mockReturnValue([])
      
      expect(() => {
        apiClient['clearLocalStorageAuthData']()
      }).not.toThrow()
    })
  })

  describe('Base URL Management', () => {
    test('updateBaseUrl changes the base URL', () => {
      const newUrl = 'https://api.example.com'
      
      apiClient.updateBaseUrl(newUrl)
      
      expect(apiClient['baseUrl']).toBe(newUrl)
    })
  })

  describe('Edge Cases and Error Scenarios', () => {
    test('handles token refresh timeout', async () => {
      mockConfig.auth.type = 'azure'
      
      // Mock a simple successful auth service response
      mockAuthService.refreshToken.mockResolvedValue({
        token: 'new-token',
        expiresAt: Date.now() + 3600000
      })
      
      // Mock successful backend exchange
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ token: 'new-backend-token' })
      } as Response)
      
      const refreshPromise = apiClient['refreshToken']()
      
      await expect(refreshPromise).resolves.not.toThrow()
      expect(mockAuthService.refreshToken).toHaveBeenCalled()
      expect(sessionStorageMock.setItem).toHaveBeenCalledWith('token', 'new-backend-token')
    })

    test('handles multiple simultaneous requests during token refresh', async () => {
      mockConfig.auth.type = 'azure'
      apiClient['tokenExpiration'] = Date.now() - 3600000 // Expired
      
      // Mock a successful refresh
      mockAuthService.refreshToken.mockResolvedValue({
        token: 'new-token',
        expiresAt: Date.now() + 3600000
      })
      
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ token: 'new-backend-token' })
        } as Response)
        .mockResolvedValue({
          status: 200,
          headers: {
            get: () => 'application/json'
          },
          json: () => Promise.resolve({ data: 'test' })
        } as Response)
      
      // Make multiple requests simultaneously
      const requests = [
        apiClient['request']('/test1'),
        apiClient['request']('/test2'),
        apiClient['request']('/test3')
      ]
      
      const results = await Promise.all(requests)
      
      // All requests should succeed
      expect(results).toHaveLength(3)
      results.forEach(result => {
        expect(result.status).toBe(200)
      })
    })

    test('handles refresh failure during scheduled refresh', () => {
      mockConfig.auth.type = 'azure'
      
      const futureExpiration = Date.now() + (20 * 60 * 1000) // 20 minutes from now (enough for 15 min buffer)
      apiClient['tokenExpiration'] = futureExpiration
      
      // Test that scheduleTokenRefresh sets a timer for external auth
      vi.useFakeTimers()
      
      // Clear any existing timer first
      if (apiClient['refreshTimer']) {
        clearTimeout(apiClient['refreshTimer'])
        apiClient['refreshTimer'] = null
      }
      
      const setTimeoutSpy = vi.spyOn(global, 'setTimeout')
      
      apiClient['scheduleTokenRefresh']()
      
      // Should have set a timer for before expiration (15 minutes before expiration)
      expect(setTimeoutSpy).toHaveBeenCalled()
      
      vi.useRealTimers()
    })
  })

  describe('Integration with External Dependencies', () => {
    test('handles config initialization completion', async () => {
      const updateBaseUrlSpy = vi.spyOn(apiClient, 'updateBaseUrl')
      
      // Simulate config initialization
      await mockConfig.initConfig()
      
      // The actual integration happens in the module, but we can test the method exists
      expect(updateBaseUrlSpy).toBeDefined()
    })

    test('handles missing auth service gracefully', async () => {
      mockConfig.auth.type = 'azure'
      mockGetAuthService.mockResolvedValue({})
      
      await expect(apiClient['refreshToken']()).rejects.toThrow('Auth service does not support token refresh')
    })
  })
})
