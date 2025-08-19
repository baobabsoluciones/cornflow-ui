import { describe, test, vi, beforeEach, expect, afterEach } from 'vitest'
import { OpenIDAuthService } from '@/services/OpenIDAuthService'
import { PublicClientApplication } from '@azure/msal-browser'
import { Amplify } from 'aws-amplify'
import { signInWithRedirect, signOut, fetchAuthSession } from 'aws-amplify/auth'

// Create hoisted mock config
const mockConfig = vi.hoisted(() => ({
  auth: {
    type: 'azure',
    clientId: 'test-client-id',
    authority: 'test-authority',
    redirectUri: 'http://localhost:3000',
    region: 'test-region',
    userPoolId: 'test-pool-id',
    domain: 'test-domain.auth.us-east-1.amazoncognito.com',
  },
}))

// Mock API module with proper response format
const mockApiClient = vi.hoisted(() => ({
  post: vi.fn(),
  initializeToken: vi.fn()
}))

vi.mock('@/api/Api', () => ({
  default: mockApiClient
}))

// Mock router
const mockPush = vi.hoisted(() => vi.fn())
vi.mock('@/router', () => ({
  default: {
    push: mockPush
  }
}))

// Create mock token
const createMockToken = (payload = {}) => {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const content = btoa(JSON.stringify({ 
    ...payload, 
    exp: Math.floor(Date.now() / 1000) + 3600,
    email: 'test@example.com',
    preferred_username: 'testuser',
    name: 'Test User',
    given_name: 'Test',
    family_name: 'User'
  }))
  const signature = btoa('signature')
  return `${header}.${content}.${signature}`
}

// Mock PublicClientApplication
const mockMsalInstance = vi.hoisted(() => ({
  initialize: vi.fn().mockResolvedValue(undefined),
  handleRedirectPromise: vi.fn().mockResolvedValue(null),
  loginRedirect: vi.fn().mockResolvedValue(undefined),
  logoutRedirect: vi.fn().mockResolvedValue(undefined),
  getAllAccounts: vi.fn().mockReturnValue([{ username: 'test@example.com' }]),
  acquireTokenSilent: vi.fn()
}))

vi.mock('@azure/msal-browser', () => ({
  PublicClientApplication: vi.fn(() => mockMsalInstance)
}))

vi.mock('aws-amplify', () => ({
  Amplify: {
    configure: vi.fn()
  }
}))

vi.mock('aws-amplify/auth', () => ({
  signInWithRedirect: vi.fn().mockResolvedValue(undefined),
  signOut: vi.fn().mockImplementation(() => Promise.resolve()),
  fetchAuthSession: vi.fn()
}))

vi.mock('@/config', () => ({
  default: {
    ...mockConfig,
    initConfig: vi.fn().mockResolvedValue(undefined)
  }
}))

// Mock storage
const createStorageMock = () => {
  const storage: { [key: string]: string } = {}
  return {
    getItem: vi.fn((key: string) => storage[key] || null),
    setItem: vi.fn((key: string, value: string) => { storage[key] = value }),
    removeItem: vi.fn((key: string) => delete storage[key]),
    clear: vi.fn(() => Object.keys(storage).forEach(key => delete storage[key])),
    length: 0, // Make length a regular property instead of getter
    key: vi.fn((index: number) => Object.keys(storage)[index] || null)
  }
}

describe('OpenIDAuthService - Enhanced Coverage', () => {
  let azureService: OpenIDAuthService
  let cognitoService: OpenIDAuthService
  let sessionStorageMock: any
  let localStorageMock: any

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Setup storage mocks
    sessionStorageMock = createStorageMock()
    localStorageMock = createStorageMock()
    
    Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock })
    Object.defineProperty(window, 'localStorage', { value: localStorageMock })
    
    // Reset API mock
    mockApiClient.post.mockResolvedValue({
      status: 200,
      content: {
        token: 'backend-token',
        id: 'user-id'
      }
    })
    
    // Reset MSAL mock
    mockMsalInstance.handleRedirectPromise.mockResolvedValue(null)
    mockMsalInstance.acquireTokenSilent.mockResolvedValue({
      idToken: createMockToken(),
      expiresOn: new Date(Date.now() + 3600000)
    })
    
    // Reset Amplify mock
    vi.mocked(fetchAuthSession).mockResolvedValue({
      tokens: {
        idToken: {
          toString: () => createMockToken()
        }
      }
    })
    
    azureService = new OpenIDAuthService('azure')
    cognitoService = new OpenIDAuthService('cognito')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Constructor and Initialization', () => {
    test('initializes Azure service correctly', async () => {
      expect(azureService['provider']).toBe('azure')
      expect(azureService['initializationPromise']).toBeDefined()
    })

    test('initializes Cognito service correctly', async () => {
      expect(cognitoService['provider']).toBe('cognito')
      expect(cognitoService['initializationPromise']).toBeDefined()
    })

    test('handles Azure initialization error', async () => {
      mockMsalInstance.initialize.mockRejectedValueOnce(new Error('Azure init failed'))
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      await expect(async () => {
        const service = new OpenIDAuthService('azure')
        await service['initializationPromise']
      }).rejects.toThrow('Azure init failed')
      
      consoleSpy.mockRestore()
    })

    test('handles Cognito domain missing error', async () => {
      const originalDomain = mockConfig.auth.domain
      mockConfig.auth.domain = ''
      
      await expect(async () => {
        const service = new OpenIDAuthService('cognito')
        await service['initializationPromise']
      }).rejects.toThrow('Cognito domain is not configured')
      
      mockConfig.auth.domain = originalDomain
    })
  })

  describe('Token Management', () => {
    test('decodeToken successfully decodes valid token', () => {
      const mockToken = createMockToken({ sub: 'test-user' })
      const decoded = azureService['decodeToken'](mockToken)
      
      expect(decoded).toBeDefined()
      expect(decoded.sub).toBe('test-user')
      expect(decoded.email).toBe('test@example.com')
    })

    test('decodeToken handles empty token', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const decoded = azureService['decodeToken']('')
      
      expect(decoded).toBeNull()
      expect(consoleSpy).toHaveBeenCalledWith('No token provided to decode')
      consoleSpy.mockRestore()
    })

    test('decodeToken handles invalid token format', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const decoded = azureService['decodeToken']('invalid.token')
      
      expect(decoded).toBeNull()
      expect(consoleSpy).toHaveBeenCalledWith('Error decoding token:', expect.any(Error))
      consoleSpy.mockRestore()
    })

    test('decodeToken handles malformed JSON', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const invalidToken = 'header.invalid-base64.signature'
      const decoded = azureService['decodeToken'](invalidToken)
      
      expect(decoded).toBeNull()
      consoleSpy.mockRestore()
    })
  })

  describe('Authentication Flow', () => {
    test('login clears stale auth data before attempting login', async () => {
      sessionStorageMock.setItem('isAuthenticated', 'true')
      sessionStorageMock.setItem('token', 'old-token')
      
      const clearSpy = vi.spyOn(azureService as any, 'clearLocalStorageAuthData')
      
      await azureService.login()
      
      expect(clearSpy).toHaveBeenCalled()
    })

    test('login returns true if already authenticated', async () => {
      sessionStorageMock.getItem.mockReturnValue('true')
      azureService['initialized'] = true
      
      const result = await azureService.login()
      
      expect(result).toBe(true)
    })

    test('login returns false if login already attempted', async () => {
      azureService['loginAttempted'] = true
      azureService['initialized'] = true
      sessionStorageMock.getItem.mockReturnValue('false') // Not authenticated
      
      const result = await azureService.login()
      
      expect(result).toBe(false)
    })

    test('login returns false if handling redirect', async () => {
      azureService['handlingRedirect'] = true
      azureService['initialized'] = true
      
      const result = await azureService.login()
      
      expect(result).toBe(false)
    })

    test('handleAuthResponse processes successful authentication', async () => {
      const mockToken = createMockToken({ sub: 'test-user' })
      const mockResponse = {
        idToken: mockToken,
        expiresOn: new Date(Date.now() + 3600000)
      }
      
      await azureService['handleAuthResponse'](mockResponse)
      
      expect(mockApiClient.post).toHaveBeenCalledWith(
        '/login/',
        {},
        expect.objectContaining({
          'Authorization': `Bearer ${mockToken}`
        })
      )
      expect(sessionStorageMock.setItem).toHaveBeenCalledWith('isAuthenticated', 'true')
      expect(sessionStorageMock.setItem).toHaveBeenCalledWith('token', 'backend-token')
      expect(sessionStorageMock.setItem).toHaveBeenCalledWith('userId', 'user-id')
      expect(mockPush).toHaveBeenCalledWith('/project-execution')
    })
  })

  describe('Token Refresh', () => {
    test('refreshToken succeeds with Azure MSAL', async () => {
      azureService['provider'] = 'azure'
      azureService['msalInstance'] = mockMsalInstance as any
      
      // Ensure getAllAccounts returns a valid account
      mockMsalInstance.getAllAccounts.mockReturnValue([{ username: 'test@example.com' }])
      
      const newToken = createMockToken({ exp: Math.floor(Date.now() / 1000) + 7200 })
      mockMsalInstance.acquireTokenSilent.mockResolvedValue({
        idToken: newToken,
        expiresOn: new Date(Date.now() + 7200000)
      })
      
      const result = await azureService.refreshToken()
      
      expect(result).toEqual({
        token: newToken,
        expiresAt: expect.any(Number)
      })
      expect(sessionStorageMock.setItem).toHaveBeenCalledWith('tokenExpiration', expect.any(String))
    })

    test('refreshToken succeeds with Cognito', async () => {
      cognitoService['provider'] = 'cognito'
      
      const newToken = createMockToken({ exp: Math.floor(Date.now() / 1000) + 7200 })
      vi.mocked(fetchAuthSession).mockResolvedValue({
        tokens: {
          idToken: { toString: () => newToken }
        }
      } as any)
      
      const result = await cognitoService.refreshToken()
      
      expect(result).toEqual({
        token: newToken,
        expiresAt: expect.any(Number)
      })
    })
  })

  describe('Logout Functionality', () => {
    test('logout clears all session data', () => {
      azureService.logout()
      
      expect(sessionStorageMock.clear).toHaveBeenCalled()
      expect(sessionStorageMock.setItem).toHaveBeenCalledWith('isAuthenticated', 'false')
    })

    test('logout calls Azure MSAL logout', () => {
      azureService['msalInstance'] = mockMsalInstance as any
      azureService['provider'] = 'azure'
      
      azureService.logout()
      
      expect(mockMsalInstance.logoutRedirect).toHaveBeenCalledWith({
        postLogoutRedirectUri: window.location.origin + '/sign-in?from=logout'
      })
    })

    test('logout calls Cognito signOut', async () => {
      vi.mocked(signOut).mockResolvedValue()
      cognitoService['provider'] = 'cognito'
      
      cognitoService.logout()
      
      await new Promise(resolve => setTimeout(resolve, 0)) // Wait for async
      expect(signOut).toHaveBeenCalledWith({ global: true })
      expect(mockPush).toHaveBeenCalledWith({ path: '/sign-in', query: { from: 'logout' } })
    })
  })

  describe('Utility Methods', () => {
    test('clearLocalStorageAuthData removes auth-related items', () => {
      // Mock Object.keys to return auth-related keys
      const mockKeys = ['CognitoIdentityServiceProvider.test', 'msal.token', 'normal.key']
      vi.spyOn(Object, 'keys').mockReturnValue(mockKeys)
      
      azureService['clearLocalStorageAuthData']()
      
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('CognitoIdentityServiceProvider.test')
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('msal.token')
      expect(localStorageMock.removeItem).not.toHaveBeenCalledWith('normal.key')
      
      vi.restoreAllMocks()
    })

    test('clearLocalStorageAuthData removes localStorage items matching patterns', () => {
      const spyOnKeys = vi.spyOn(Object, 'keys').mockReturnValue([
        'CognitoIdentityServiceProvider.test.test.idToken',
        'amplify-signin-with-hostedUI',
        'amplifyKey',
        'msal.test',
        'MSAL.test',
        'microsoft.test',
        'azure.config',
        'auth.data',
        'refresh_token',
        'id_token',
        'access_token',
        'normalKey'
      ])
      
      azureService['clearLocalStorageAuthData']()
      
      // Check that auth-related items were removed
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('CognitoIdentityServiceProvider.test.test.idToken')
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('amplify-signin-with-hostedUI')
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('amplifyKey')
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('msal.test')
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('MSAL.test')
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('microsoft.test')
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('azure.config')
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('auth.data')
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('refresh_token')
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('id_token')
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('access_token')
      
      // Check that non-auth items were not removed
      expect(localStorageMock.removeItem).not.toHaveBeenCalledWith('normalKey')
      
      spyOnKeys.mockRestore()
    })

    test('getTokenStatus returns comprehensive token information', () => {
      const expiration = Date.now() + 3600000
      sessionStorageMock.getItem.mockImplementation((key) => {
        if (key === 'token') return 'test-token'
        if (key === 'tokenExpiration') return expiration.toString()
        if (key === 'refreshTokenExpiration') return (Date.now() + 86400000).toString()
        return null
      })
      
      const status = azureService.getTokenStatus()
      
      expect(status.hasToken).toBe(true)
      expect(status.tokenExpiration).toEqual(new Date(expiration))
      expect(status.timeUntilExpiration).toBeGreaterThan(0)
      expect(status.shouldRefreshSoon).toBe(false)
    })

    test('getTokenStatus returns correct token status when token exists', () => {
      const futureExpiration = Date.now() + (30 * 60 * 1000) // 30 minutes from now
      const futureRefreshExpiration = Date.now() + (48 * 60 * 60 * 1000) // 48 hours from now
      
      sessionStorageMock.getItem.mockImplementation((key) => {
        if (key === 'token') return 'test-token'
        if (key === 'tokenExpiration') return futureExpiration.toString()
        if (key === 'refreshTokenExpiration') return futureRefreshExpiration.toString()
        return null
      })
      
      const status = azureService.getTokenStatus()
      
      expect(status.hasToken).toBe(true)
      expect(status.tokenExpiration).toEqual(new Date(futureExpiration))
      expect(status.refreshTokenExpiration).toEqual(new Date(futureRefreshExpiration))
      expect(status.timeUntilExpiration).toBeGreaterThan(0)
      expect(status.timeUntilRefreshExpiration).toBeGreaterThan(0)
      expect(status.shouldRefreshSoon).toBe(false)
      expect(status.refreshTokenExpiresSoon).toBe(false)
    })

    test('getTokenStatus indicates when token should refresh soon', () => {
      const soonExpiration = Date.now() + (10 * 60 * 1000) // 10 minutes from now
      
      sessionStorageMock.getItem.mockImplementation((key) => {
        if (key === 'token') return 'test-token'
        if (key === 'tokenExpiration') return soonExpiration.toString()
        return null
      })
      
      const status = azureService.getTokenStatus()
      
      expect(status.shouldRefreshSoon).toBe(true)
    })

    test('getTokenStatus indicates when refresh token expires soon', () => {
      const refreshSoonExpiration = Date.now() + (12 * 60 * 60 * 1000) // 12 hours from now
      
      sessionStorageMock.getItem.mockImplementation((key) => {
        if (key === 'token') return 'test-token'
        if (key === 'refreshTokenExpiration') return refreshSoonExpiration.toString()
        return null
      })
      
      const status = azureService.getTokenStatus()
      
      expect(status.refreshTokenExpiresSoon).toBe(true)
    })

    test('getTokenStatus handles missing token data', () => {
      sessionStorageMock.getItem.mockImplementation(() => null)
      
      const status = azureService.getTokenStatus()
      
      expect(status.hasToken).toBe(false)
      expect(status.tokenExpiration).toBeNull()
      expect(status.refreshTokenExpiration).toBeNull()
      expect(status.timeUntilExpiration).toBeNull()
      expect(status.timeUntilRefreshExpiration).toBeNull()
      expect(status.shouldRefreshSoon).toBe(false)
      expect(status.refreshTokenExpiresSoon).toBe(false)
    })

    test('makeAuthenticatedRequest adds authorization header', async () => {
      sessionStorageMock.getItem.mockReturnValue('test-token')
      
      // Mock fetch
      global.fetch = vi.fn().mockResolvedValue(new Response())
      
      await azureService.makeAuthenticatedRequest('https://api.example.com/data')
      
      expect(fetch).toHaveBeenCalledWith(
        'https://api.example.com/data',
        expect.objectContaining({
          headers: expect.any(Headers)
        })
      )
      
      // Verify the Authorization header was set on the Headers object
      const callArgs = vi.mocked(fetch).mock.calls[0]
      const headers = callArgs[1]?.headers as Headers
      expect(headers.get('Authorization')).toBe('Bearer test-token')
    })
  })

  describe('Token Refresh - Additional Coverage', () => {
    test('refreshToken succeeds with Azure token successfully', async () => {
      azureService['provider'] = 'azure'
      azureService['msalInstance'] = mockMsalInstance as any
      
      const mockAccount = { homeAccountId: 'test-account' }
      const mockResponse = {
        idToken: createMockToken(),
        expiresOn: new Date(Date.now() + 3600000)
      }
      
      mockMsalInstance.getAllAccounts.mockReturnValue([mockAccount])
      mockMsalInstance.acquireTokenSilent.mockResolvedValue(mockResponse)
      
      const result = await azureService.refreshToken()
      
      expect(result).toBeDefined()
      expect(result?.token).toBe(mockResponse.idToken)
      expect(result?.expiresAt).toBeGreaterThan(Date.now())
      
      expect(mockMsalInstance.acquireTokenSilent).toHaveBeenCalledWith({
        scopes: ['openid', 'profile', 'email', 'User.Read'],
        account: mockAccount,
        forceRefresh: false
      })
    })

    test('refreshToken handles Azure token refresh with force refresh fallback', async () => {
      azureService['provider'] = 'azure'
      azureService['msalInstance'] = mockMsalInstance as any
      
      const mockAccount = { homeAccountId: 'test-account' }
      const mockResponse = {
        idToken: createMockToken(),
        expiresOn: new Date(Date.now() + 3600000)
      }
      
      mockMsalInstance.getAllAccounts.mockReturnValue([mockAccount])
      mockMsalInstance.acquireTokenSilent
        .mockRejectedValueOnce(new Error('Silent acquisition failed'))
        .mockResolvedValueOnce(mockResponse)
      
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      
      const result = await azureService.refreshToken()
      
      expect(result).toBeDefined()
      expect(result?.token).toBe(mockResponse.idToken)
      
      expect(mockMsalInstance.acquireTokenSilent).toHaveBeenCalledTimes(2)
      expect(consoleWarnSpy).toHaveBeenCalledWith('Silent token acquisition failed, trying force refresh:', expect.any(Error))
      
      consoleWarnSpy.mockRestore()
    })

    test('refreshToken returns null when no Azure accounts found', async () => {
      azureService['provider'] = 'azure'
      azureService['msalInstance'] = mockMsalInstance as any
      
      mockMsalInstance.getAllAccounts.mockReturnValue([])
      
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      
      const result = await azureService.refreshToken()
      
      expect(result).toBeNull()
      expect(consoleWarnSpy).toHaveBeenCalledWith('No MSAL accounts found for token refresh')
      
      consoleWarnSpy.mockRestore()
    })

    test('refreshToken handles Cognito token refresh', async () => {
      cognitoService['provider'] = 'cognito'
      
      const result = await cognitoService.refreshToken()
      
      // Cognito refresh is implemented, should return a token result
      expect(result).toBeDefined()
      expect(result?.token).toBeDefined()
      expect(result?.expiresAt).toBeGreaterThan(Date.now())
    })

    test('refreshToken handles refresh token errors', async () => {
      azureService['provider'] = 'azure'
      azureService['msalInstance'] = mockMsalInstance as any
      
      const mockAccount = { homeAccountId: 'test-account' }
      
      mockMsalInstance.getAllAccounts.mockReturnValue([mockAccount])
      mockMsalInstance.acquireTokenSilent.mockRejectedValue(new Error('Token refresh failed'))
      
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      const result = await azureService.refreshToken()
      
      expect(result).toBeNull()
      expect(consoleErrorSpy).toHaveBeenCalledWith('Token refresh failed for azure:', expect.any(Error))
      
      consoleWarnSpy.mockRestore()
      consoleErrorSpy.mockRestore()
    })

    test('refreshToken handles invalid token response', async () => {
      azureService['provider'] = 'azure'
      azureService['msalInstance'] = mockMsalInstance as any
      
      const mockAccount = { homeAccountId: 'test-account' }
      const mockResponse = {
        idToken: 'invalid.token.format', // This will fail decoding
        expiresOn: new Date(Date.now() + 3600000)
      }
      
      mockMsalInstance.getAllAccounts.mockReturnValue([mockAccount])
      mockMsalInstance.acquireTokenSilent.mockResolvedValue(mockResponse)
      
      const result = await azureService.refreshToken()
      
      expect(result).toBeNull()
    })
  })

  describe('Additional Refresh Token Utilities', () => {
    test('isRefreshTokenNearExpiration returns true when refresh token expires within 24 hours', () => {
      const soonExpiration = Date.now() + (12 * 60 * 60 * 1000) // 12 hours from now
      sessionStorageMock.getItem.mockImplementation((key) => {
        if (key === 'refreshTokenExpiration') return soonExpiration.toString()
        return null
      })
      
      const result = azureService.isRefreshTokenNearExpiration()
      
      expect(result).toBe(true)
    })

    test('isRefreshTokenNearExpiration returns false when refresh token expires after 24 hours', () => {
      const laterExpiration = Date.now() + (48 * 60 * 60 * 1000) // 48 hours from now
      sessionStorageMock.getItem.mockImplementation((key) => {
        if (key === 'refreshTokenExpiration') return laterExpiration.toString()
        return null
      })
      
      const result = azureService.isRefreshTokenNearExpiration()
      
      expect(result).toBe(false)
    })

    test('isRefreshTokenNearExpiration returns false when no refresh token expiration is set', () => {
      const result = azureService.isRefreshTokenNearExpiration()
      
      expect(result).toBe(false)
    })

    test('isRefreshTokenNearExpiration handles invalid expiration values', () => {
      sessionStorageMock.getItem.mockImplementation((key) => {
        if (key === 'refreshTokenExpiration') return 'invalid-date'
        return null
      })
      
      const result = azureService.isRefreshTokenNearExpiration()
      
      expect(result).toBe(false)
    })
  })

  describe('Logout - Enhanced Coverage', () => {
    test('logout clears all authentication state', () => {
      sessionStorageMock.setItem('isAuthenticated', 'true')
      sessionStorageMock.setItem('token', 'test-token')
      sessionStorageMock.setItem('userId', 'test-user')
      sessionStorageMock.setItem('username', 'testuser')
      
      azureService.logout()
      
      expect(sessionStorageMock.setItem).toHaveBeenCalledWith('isAuthenticated', 'false')
      expect(sessionStorageMock.clear).toHaveBeenCalled()
    })

    test('logout handles Azure logout correctly', async () => {
      azureService['provider'] = 'azure'
      azureService['msalInstance'] = mockMsalInstance as any
      
      azureService.logout()
      
      expect(mockMsalInstance.logoutRedirect).toHaveBeenCalledWith({
        postLogoutRedirectUri: window.location.origin + '/sign-in?from=logout'
      })
    })

    test('logout handles Cognito logout success', async () => {
      cognitoService['provider'] = 'cognito'
      vi.mocked(signOut).mockResolvedValue(undefined)
      
      cognitoService.logout()
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 10))
      
      expect(signOut).toHaveBeenCalledWith({ global: true })
      expect(mockPush).toHaveBeenCalledWith({ path: '/sign-in', query: { from: 'logout' } })
    })

    test('logout handles Cognito logout error', async () => {
      cognitoService['provider'] = 'cognito'
      
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      vi.mocked(signOut).mockRejectedValue(new Error('Logout failed'))
      
      cognitoService.logout()
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 10))
      
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error during Cognito sign out:', expect.any(Error))
      expect(mockPush).toHaveBeenCalledWith({ path: '/sign-in', query: { from: 'logout' } })
      
      consoleErrorSpy.mockRestore()
    })
  })

  describe('Authentication Retry', () => {
    test('retryAuthentication handles Cognito retry', async () => {
      cognitoService['provider'] = 'cognito'
      
      await (cognitoService as any).retryAuthentication()
      
      expect(mockPush).toHaveBeenCalledWith({ path: '/sign-in', query: { expired: 'true' } })
    })

    test('retryAuthentication handles Cognito retry authentication error', async () => {
      cognitoService['provider'] = 'cognito'
      
      // Mock initializeCognito to throw error
      const originalInit = (cognitoService as any).initializeCognito
      ;(cognitoService as any).initializeCognito = vi.fn().mockRejectedValue(new Error('Init failed'))
      
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      // Set up window.location.href mock
      const originalLocation = window.location
      delete (window as any).location
      window.location = { ...originalLocation, href: '' } as any
      
      await (cognitoService as any).retryAuthentication()
      
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to retry authentication with Cognito:', expect.any(Error))
      expect(window.location.href).toBe(window.location.origin + '/sign-in?expired=true')
      
      // Restore
      window.location = originalLocation
      ;(cognitoService as any).initializeCognito = originalInit
      consoleErrorSpy.mockRestore()
    })

    test('retryAuthentication handles Azure retry', async () => {
      azureService['provider'] = 'azure'
      azureService['msalInstance'] = mockMsalInstance as any
      
      await (azureService as any).retryAuthentication()
      
      expect(mockMsalInstance.loginRedirect).toHaveBeenCalledWith({
        scopes: ['openid', 'profile', 'email', 'User.Read'],
        prompt: 'select_account'
      })
    })
  })

  describe('Getter Methods', () => {
    test('getter methods return correct session storage values', () => {
      sessionStorageMock.getItem.mockImplementation((key) => {
        const values: Record<string, string> = {
          'token': 'test-token',
          'userId': 'test-user-id',
          'isAuthenticated': 'true',
          'username': 'testuser',
          'name': 'Test User',
          'email': 'test@example.com',
          'given_name': 'Test',
          'family_name': 'User'
        }
        return values[key] || null
      })
      
      expect(azureService.getToken()).toBe('test-token')
      expect(azureService.getUserId()).toBe('test-user-id')
      expect(azureService.isAuthenticated()).toBe(true)
      expect(azureService.getUsername()).toBe('testuser')
      expect(azureService.getName()).toBe('Test User')
      expect(azureService.getEmail()).toBe('test@example.com')
      expect(azureService.getGivenName()).toBe('Test')
      expect(azureService.getFamilyName()).toBe('User')
    })

    test('getter methods return null for missing values', () => {
      sessionStorageMock.getItem.mockReturnValue(null)
      
      expect(azureService.getToken()).toBeNull()
      expect(azureService.getUserId()).toBeNull()
      expect(azureService.getUsername()).toBeNull()
      expect(azureService.getName()).toBeNull()
      expect(azureService.getEmail()).toBeNull()
      expect(azureService.getGivenName()).toBeNull()
      expect(azureService.getFamilyName()).toBeNull()
      expect(azureService.isAuthenticated()).toBe(false)
    })

    test('isAuthenticated returns false for non-true values', () => {
      sessionStorageMock.getItem.mockImplementation((key) => {
        if (key === 'isAuthenticated') return 'false'
        return null
      })
      
      expect(azureService.isAuthenticated()).toBe(false)
    })

    test('services have correct provider configuration', () => {
      expect(azureService['provider']).toBe('azure')
      expect(cognitoService['provider']).toBe('cognito')
      
      // Verify services are properly initialized
      expect(azureService['initializationPromise']).toBeDefined()
      expect(cognitoService['initializationPromise']).toBeDefined()
    })
  })
}) 