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
    get length() { return Object.keys(storage).length },
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
  })
}) 