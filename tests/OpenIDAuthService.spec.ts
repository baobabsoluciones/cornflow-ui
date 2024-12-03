import { describe, test, vi, beforeEach, expect } from 'vitest'
import { OpenIDAuthService } from '@/services/OpenIDAuthService'
import { PublicClientApplication } from '@azure/msal-browser'
import { Amplify } from 'aws-amplify'
import { signIn, signOut, fetchAuthSession } from 'aws-amplify/auth'

// Create hoisted mock config
const mockConfig = vi.hoisted(() => ({
  auth: {
    type: 'azure',
    clientId: 'test-client-id',
    authority: 'test-authority',
    redirectUri: 'http://localhost:3000',
    region: 'test-region',
    userPoolId: 'test-pool-id',
  },
}))

// Mock API module with proper response format
vi.mock('@/api/Api', () => ({
  default: {
    post: vi.fn().mockImplementation(() => Promise.resolve({
      status: 200,
      content: {
        token: 'backend-token',
        id: 'user-id'
      }
    }))
  }
}))

// Create mock token
const createMockToken = (payload = {}) => {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const content = btoa(JSON.stringify({ ...payload, exp: Date.now() / 1000 + 3600 }))
  const signature = btoa('signature')
  return `${header}.${content}.${signature}`
}

// Mock dependencies
vi.mock('@azure/msal-browser', () => ({
  PublicClientApplication: vi.fn(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    loginPopup: vi.fn(),
    logout: vi.fn(),
  }))
}))

vi.mock('aws-amplify', () => ({
  Amplify: {
    configure: vi.fn()
  }
}))

vi.mock('aws-amplify/auth', () => ({
  signIn: vi.fn(),
  signOut: vi.fn(),
  fetchAuthSession: vi.fn()
}))

vi.mock('@/config', () => ({
  default: mockConfig
}))

// Mock window.sessionStorage
const mockStorage: { [key: string]: string } = {}
const sessionStorageMock = {
  getItem: vi.fn((key: string) => mockStorage[key] || null),
  setItem: vi.fn((key: string, value: string) => { mockStorage[key] = value }),
  removeItem: vi.fn((key: string) => delete mockStorage[key]),
  clear: vi.fn(() => { Object.keys(mockStorage).forEach(key => delete mockStorage[key]) })
}
Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock })

describe('OpenIDAuthService', () => {
  let service: OpenIDAuthService

  beforeEach(() => {
    vi.clearAllMocks()
    mockConfig.auth.type = 'azure'
    sessionStorageMock.clear()
    service = new OpenIDAuthService(mockConfig.auth.type)
  })

  describe('Azure Authentication', () => {
    test('initializes MSAL correctly', async () => {
      const mockToken = createMockToken({ sub: 'user123' })
      const msalInstance = {
        initialize: vi.fn().mockResolvedValue(undefined),
        loginPopup: vi.fn(),
        logout: vi.fn(),
      }
      vi.mocked(PublicClientApplication).mockImplementation(() => msalInstance as any)

      await service.login()

      expect(PublicClientApplication).toHaveBeenCalledWith({
        auth: {
          clientId: mockConfig.auth.clientId,
          authority: mockConfig.auth.authority,
          redirectUri: mockConfig.auth.redirectUri,
          navigateToLoginRequestUrl: false,
        },
        cache: {
          cacheLocation: 'sessionStorage',
          storeAuthStateInCookie: false,
        },
      })
    })

    test('login success with Azure', async () => {
      const mockToken = createMockToken({ sub: 'user123' })
      const msalInstance = {
        initialize: vi.fn().mockResolvedValue(undefined),
        loginPopup: vi.fn().mockResolvedValue({ 
          idToken: mockToken,
          account: {
            username: 'test@example.com'
          }
        }),
        logout: vi.fn(),
      }
      vi.mocked(PublicClientApplication).mockImplementation(() => msalInstance as any)
      service['msalInstance'] = msalInstance as any

      const result = await service.login()
      
      expect(result).toBe(true)
      expect(sessionStorageMock.setItem).toHaveBeenCalledWith('isAuthenticated', 'true')
      expect(sessionStorageMock.setItem).toHaveBeenCalledWith('token', 'backend-token')
    })

    test('logout clears session storage for Azure', async () => {
      const msalInstance = {
        initialize: vi.fn().mockResolvedValue(undefined),
        loginPopup: vi.fn(),
        logout: vi.fn().mockResolvedValue(undefined),
      }
      vi.mocked(PublicClientApplication).mockImplementation(() => msalInstance as any)
      service['msalInstance'] = msalInstance as any

      await service.logout()

      expect(msalInstance.logout).toHaveBeenCalled()
      expect(sessionStorageMock.removeItem).toHaveBeenCalledWith('token')
      expect(sessionStorageMock.removeItem).toHaveBeenCalledWith('userId')
      expect(sessionStorageMock.setItem).toHaveBeenCalledWith('isAuthenticated', 'false')
    })
  })

  describe('Cognito Authentication', () => {
    beforeEach(() => {
      mockConfig.auth.type = 'cognito'
      service = new OpenIDAuthService('cognito')
    })

    test('initializes Cognito correctly', async () => {
      const mockToken = createMockToken({ sub: 'user123' })
      
      vi.mocked(signIn).mockResolvedValue({
        isSignedIn: true,
        nextStep: { signInStep: 'DONE' }
      })
      
      vi.mocked(fetchAuthSession).mockResolvedValue({
        tokens: {
          idToken: {
            toString: () => mockToken,
            payload: { sub: 'user123' }
          }
        }
      } as any)

      await service.login()
      
      expect(Amplify.configure).toHaveBeenCalledWith({
        Auth: {
          Cognito: {
            region: mockConfig.auth.region,
            userPoolId: mockConfig.auth.userPoolId,
            userPoolClientId: mockConfig.auth.clientId,
            oauth: {
              redirectSignIn: mockConfig.auth.redirectUri,
              redirectSignOut: expect.any(String),
            },
          },
        },
      })
    })

    test('login success with Cognito', async () => {
      const mockToken = createMockToken({ sub: 'user123', email: 'test@example.com' })
      
      vi.mocked(signIn).mockImplementation(() => Promise.resolve({
        isSignedIn: true,
        nextStep: {
          signInStep: 'DONE'
        }
      }))
      
      vi.mocked(fetchAuthSession).mockImplementation(() => Promise.resolve({
        tokens: {
          idToken: {
            toString: () => mockToken,
            payload: { 
              sub: 'user123',
              email: 'test@example.com'
            }
          }
        }
      } as any))

      const result = await service.login()
      
      expect(result).toBe(true)
      expect(sessionStorageMock.setItem).toHaveBeenCalledWith('isAuthenticated', 'true')
      expect(sessionStorageMock.setItem).toHaveBeenCalledWith('token', 'backend-token')
    })

    test('logout clears session storage for Cognito', async () => {
      await service.logout()

      expect(signOut).toHaveBeenCalled()
      expect(sessionStorageMock.removeItem).toHaveBeenCalledWith('token')
      expect(sessionStorageMock.removeItem).toHaveBeenCalledWith('userId')
      expect(sessionStorageMock.setItem).toHaveBeenCalledWith('isAuthenticated', 'false')
    })
  })

  test('isAuthenticated returns correct value', () => {
    sessionStorageMock.getItem.mockReturnValueOnce('true')
    expect(service.isAuthenticated()).toBe(true)

    sessionStorageMock.getItem.mockReturnValueOnce('false')
    expect(service.isAuthenticated()).toBe(false)
  })
}) 