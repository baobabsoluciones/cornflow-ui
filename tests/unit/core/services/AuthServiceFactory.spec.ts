import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { AuthServiceFactory } from '@/services/AuthServiceFactory'
import getAuthService, { getAllAuthServices, getSpecificAuthService, isAuthServiceAvailable } from '@/services/AuthServiceFactory'

// Mock dependencies
const mockConfig = vi.hoisted(() => ({
  auth: {
    type: 'cornflow',
    clientId: 'test-client-id',
    authority: 'https://login.microsoftonline.com/test',
    redirectUri: 'http://localhost:3000/callback',
    userPoolId: 'us-east-1_test',
    region: 'us-east-1',
    domain: 'test-domain.auth.us-east-1.amazoncognito.com'
  },
  initConfig: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('@/config', () => ({
  default: mockConfig
}))

// Mock CornflowAuthService
const mockCornflowAuthService = vi.hoisted(() => ({
  login: vi.fn(),
  logout: vi.fn(),
  isAuthenticated: vi.fn(),
  getToken: vi.fn(),
  getUserId: vi.fn(),
  signup: vi.fn(),
  refreshToken: vi.fn()
}))

vi.mock('@/services/AuthService', () => ({
  default: mockCornflowAuthService
}))

// Mock OpenIDAuthService
const mockOpenIDAuthService = vi.hoisted(() => {
  const mockInstance = {
    initialize: vi.fn().mockResolvedValue(undefined),
    login: vi.fn(),
    logout: vi.fn(),
    isAuthenticated: vi.fn(),
    getToken: vi.fn(),
    getUserId: vi.fn(),
    refreshToken: vi.fn()
  }
  return vi.fn().mockImplementation(() => mockInstance)
})

vi.mock('@/services/OpenIDAuthService', () => ({
  OpenIDAuthService: mockOpenIDAuthService
}))

describe('AuthServiceFactory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset static properties
    AuthServiceFactory['instances'] = {}
    AuthServiceFactory['initialized'] = false
    // Reset config
    mockConfig.auth.type = 'cornflow'
    mockConfig.auth.clientId = 'test-client-id'
    mockConfig.auth.authority = 'https://login.microsoftonline.com/test'
    mockConfig.auth.redirectUri = 'http://localhost:3000/callback'
    mockConfig.auth.userPoolId = 'us-east-1_test'
    mockConfig.auth.region = 'us-east-1'
    mockConfig.auth.domain = 'test-domain.auth.us-east-1.amazoncognito.com'
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getAllAuthServices', () => {
    test('initializes config if not already set', async () => {
      mockConfig.auth.type = ''
      
      const services = await AuthServiceFactory.getAllAuthServices()
      
      expect(mockConfig.initConfig).toHaveBeenCalled()
      expect(services).toBeDefined()
      expect(services.cornflow).toBe(mockCornflowAuthService)
    })

    test('returns all configured services for cornflow only', async () => {
      mockConfig.auth.type = 'cornflow'
      // Remove Azure/Cognito config
      mockConfig.auth.authority = ''
      mockConfig.auth.userPoolId = ''
      
      const services = await AuthServiceFactory.getAllAuthServices()
      
      expect(services.cornflow).toBe(mockCornflowAuthService)
      expect(services.azure).toBeNull()
      expect(services.cognito).toBeNull()
    })

    test('initializes Azure service when configured', async () => {
      mockConfig.auth.type = 'azure'
      // Remove Cognito config to ensure only Azure is initialized
      mockConfig.auth.userPoolId = ''
      mockConfig.auth.region = ''
      mockConfig.auth.domain = ''
      
      const mockAzureInstance = { 
        provider: 'azure',
        initialize: vi.fn().mockResolvedValue(undefined)
      }
      mockOpenIDAuthService.mockReturnValue(mockAzureInstance)
      
      const services = await AuthServiceFactory.getAllAuthServices()
      
      expect(mockOpenIDAuthService).toHaveBeenCalledWith('azure')
      expect(services.cornflow).toBe(mockCornflowAuthService)
      expect(services.azure).toBe(mockAzureInstance)
      expect(services.cognito).toBeNull()
    })

    test('initializes Cognito service when configured', async () => {
      mockConfig.auth.type = 'cognito'
      // Remove Azure config to ensure only Cognito is initialized
      mockConfig.auth.authority = ''
      mockConfig.auth.redirectUri = ''
      
      const mockCognitoInstance = { 
        provider: 'cognito',
        initialize: vi.fn().mockResolvedValue(undefined)
      }
      mockOpenIDAuthService.mockReturnValue(mockCognitoInstance)
      
      const services = await AuthServiceFactory.getAllAuthServices()
      
      expect(mockOpenIDAuthService).toHaveBeenCalledWith('cognito')
      expect(services.cornflow).toBe(mockCornflowAuthService)
      expect(services.azure).toBeNull()
      expect(services.cognito).toBe(mockCognitoInstance)
    })

    test('initializes both Azure and Cognito when both are configured', async () => {
      mockConfig.auth.type = 'azure'
      const mockAzureInstance = { 
        provider: 'azure',
        initialize: vi.fn().mockResolvedValue(undefined)
      }
      const mockCognitoInstance = { 
        provider: 'cognito',
        initialize: vi.fn().mockResolvedValue(undefined)
      }
      mockOpenIDAuthService
        .mockReturnValueOnce(mockAzureInstance)
        .mockReturnValueOnce(mockCognitoInstance)
      
      const services = await AuthServiceFactory.getAllAuthServices()
      
      expect(mockOpenIDAuthService).toHaveBeenCalledWith('azure')
      expect(mockOpenIDAuthService).toHaveBeenCalledWith('cognito')
      expect(services.cornflow).toBe(mockCornflowAuthService)
      expect(services.azure).toBe(mockAzureInstance)
      expect(services.cognito).toBe(mockCognitoInstance)
    })

    test('handles Azure initialization error gracefully', async () => {
      mockConfig.auth.type = 'azure'
      mockOpenIDAuthService.mockImplementation((provider) => {
        if (provider === 'azure') {
          throw new Error('Azure initialization failed')
        }
        return { provider }
      })

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      
      const services = await AuthServiceFactory.getAllAuthServices()
      
      expect(consoleSpy).toHaveBeenCalledWith('Failed to initialize Azure auth service:', expect.any(Error))
      expect(services.cornflow).toBe(mockCornflowAuthService)
      expect(services.azure).toBeNull()
      
      consoleSpy.mockRestore()
    })

    test('handles Cognito initialization error gracefully', async () => {
      mockConfig.auth.type = 'cognito'
      mockOpenIDAuthService.mockImplementation((provider) => {
        if (provider === 'cognito') {
          throw new Error('Cognito initialization failed')
        }
        return { provider }
      })

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      
      const services = await AuthServiceFactory.getAllAuthServices()
      
      expect(consoleSpy).toHaveBeenCalledWith('Failed to initialize Cognito auth service:', expect.any(Error))
      expect(services.cornflow).toBe(mockCornflowAuthService)
      expect(services.cognito).toBeNull()
      
      consoleSpy.mockRestore()
    })

    test('returns cached services on subsequent calls', async () => {
      mockConfig.auth.type = 'azure'
      // Remove Cognito config to ensure only Azure is initialized
      mockConfig.auth.userPoolId = ''
      mockConfig.auth.region = ''
      mockConfig.auth.domain = ''
      
      const mockAzureInstance = { 
        provider: 'azure',
        initialize: vi.fn().mockResolvedValue(undefined)
      }
      mockOpenIDAuthService.mockReturnValue(mockAzureInstance)
      
      const services1 = await AuthServiceFactory.getAllAuthServices()
      const services2 = await AuthServiceFactory.getAllAuthServices()
      
      expect(mockOpenIDAuthService).toHaveBeenCalledTimes(1)
      expect(services1).toStrictEqual(services2)
    })
  })

  describe('getAuthService', () => {
    test('returns cornflow service', async () => {
      const service = await AuthServiceFactory.getAuthService('cornflow')
      
      expect(service).toBe(mockCornflowAuthService)
    })

    test('returns azure service when configured', async () => {
      mockConfig.auth.type = 'azure'
      const mockAzureInstance = { 
        provider: 'azure',
        initialize: vi.fn().mockResolvedValue(undefined)
      }
      mockOpenIDAuthService.mockReturnValue(mockAzureInstance)
      
      const service = await AuthServiceFactory.getAuthService('azure')
      
      expect(service).toBe(mockAzureInstance)
    })

    test('returns cognito service when configured', async () => {
      mockConfig.auth.type = 'cognito'
      const mockCognitoInstance = { 
        provider: 'cognito',
        initialize: vi.fn().mockResolvedValue(undefined)
      }
      mockOpenIDAuthService.mockReturnValue(mockCognitoInstance)
      
      const service = await AuthServiceFactory.getAuthService('cognito')
      
      expect(service).toBe(mockCognitoInstance)
    })

    test('returns null for unconfigured azure service', async () => {
      mockConfig.auth.authority = ''
      
      const service = await AuthServiceFactory.getAuthService('azure')
      
      expect(service).toBeNull()
    })

    test('returns null for unconfigured cognito service', async () => {
      mockConfig.auth.userPoolId = ''
      
      const service = await AuthServiceFactory.getAuthService('cognito')
      
      expect(service).toBeNull()
    })
  })

  describe('getDefaultAuthService', () => {
    test('returns cornflow service by default', async () => {
      mockConfig.auth.type = 'cornflow'
      
      const service = await AuthServiceFactory.getDefaultAuthService()
      
      expect(service).toBe(mockCornflowAuthService)
    })

    test('returns azure service when configured as default', async () => {
      mockConfig.auth.type = 'azure'
      const mockAzureInstance = { 
        provider: 'azure',
        initialize: vi.fn().mockResolvedValue(undefined)
      }
      mockOpenIDAuthService.mockReturnValue(mockAzureInstance)
      
      const service = await AuthServiceFactory.getDefaultAuthService()
      
      expect(service).toBe(mockAzureInstance)
    })

    test('returns cognito service when configured as default', async () => {
      mockConfig.auth.type = 'cognito'
      const mockCognitoInstance = { 
        provider: 'cognito',
        initialize: vi.fn().mockResolvedValue(undefined)
      }
      mockOpenIDAuthService.mockReturnValue(mockCognitoInstance)
      
      const service = await AuthServiceFactory.getDefaultAuthService()
      
      expect(service).toBe(mockCognitoInstance)
    })

    test('falls back to cornflow when azure is default but not available', async () => {
      mockConfig.auth.type = 'azure'
      mockConfig.auth.authority = '' // Make Azure unavailable
      
      const service = await AuthServiceFactory.getDefaultAuthService()
      
      expect(service).toBe(mockCornflowAuthService)
    })

    test('falls back to cornflow when cognito is default but not available', async () => {
      mockConfig.auth.type = 'cognito'
      mockConfig.auth.userPoolId = '' // Make Cognito unavailable
      
      const service = await AuthServiceFactory.getDefaultAuthService()
      
      expect(service).toBe(mockCornflowAuthService)
    })

    test('returns cornflow for unknown auth type', async () => {
      mockConfig.auth.type = 'unknown'
      
      const service = await AuthServiceFactory.getDefaultAuthService()
      
      expect(service).toBe(mockCornflowAuthService)
    })
  })

  describe('isAzureConfigured', () => {
    test('returns true when all Azure config is present', () => {
      mockConfig.auth.clientId = 'test-client'
      mockConfig.auth.authority = 'https://login.microsoftonline.com/test'
      mockConfig.auth.redirectUri = 'http://localhost:3000/callback'
      
      const result = AuthServiceFactory.isAzureConfigured()
      
      expect(result).toBe(true)
    })

    test('returns false when clientId is missing', () => {
      mockConfig.auth.clientId = ''
      mockConfig.auth.authority = 'https://login.microsoftonline.com/test'
      mockConfig.auth.redirectUri = 'http://localhost:3000/callback'
      
      const result = AuthServiceFactory.isAzureConfigured()
      
      expect(result).toBe(false)
    })

    test('returns false when authority is missing', () => {
      mockConfig.auth.clientId = 'test-client'
      mockConfig.auth.authority = ''
      mockConfig.auth.redirectUri = 'http://localhost:3000/callback'
      
      const result = AuthServiceFactory.isAzureConfigured()
      
      expect(result).toBe(false)
    })

    test('returns false when redirectUri is missing', () => {
      mockConfig.auth.clientId = 'test-client'
      mockConfig.auth.authority = 'https://login.microsoftonline.com/test'
      mockConfig.auth.redirectUri = ''
      
      const result = AuthServiceFactory.isAzureConfigured()
      
      expect(result).toBe(false)
    })
  })

  describe('isCognitoConfigured', () => {
    test('returns true when all Cognito config is present', () => {
      mockConfig.auth.clientId = 'test-client'
      mockConfig.auth.userPoolId = 'us-east-1_test'
      mockConfig.auth.region = 'us-east-1'
      mockConfig.auth.domain = 'test-domain.auth.us-east-1.amazoncognito.com'
      
      const result = AuthServiceFactory.isCognitoConfigured()
      
      expect(result).toBe(true)
    })

    test('returns false when clientId is missing', () => {
      mockConfig.auth.clientId = ''
      mockConfig.auth.userPoolId = 'us-east-1_test'
      mockConfig.auth.region = 'us-east-1'
      mockConfig.auth.domain = 'test-domain.auth.us-east-1.amazoncognito.com'
      
      const result = AuthServiceFactory.isCognitoConfigured()
      
      expect(result).toBe(false)
    })

    test('returns false when userPoolId is missing', () => {
      mockConfig.auth.clientId = 'test-client'
      mockConfig.auth.userPoolId = ''
      mockConfig.auth.region = 'us-east-1'
      mockConfig.auth.domain = 'test-domain.auth.us-east-1.amazoncognito.com'
      
      const result = AuthServiceFactory.isCognitoConfigured()
      
      expect(result).toBe(false)
    })

    test('returns false when region is missing', () => {
      mockConfig.auth.clientId = 'test-client'
      mockConfig.auth.userPoolId = 'us-east-1_test'
      mockConfig.auth.region = ''
      mockConfig.auth.domain = 'test-domain.auth.us-east-1.amazoncognito.com'
      
      const result = AuthServiceFactory.isCognitoConfigured()
      
      expect(result).toBe(false)
    })

    test('returns false when domain is missing', () => {
      mockConfig.auth.clientId = 'test-client'
      mockConfig.auth.userPoolId = 'us-east-1_test'
      mockConfig.auth.region = 'us-east-1'
      mockConfig.auth.domain = ''
      
      const result = AuthServiceFactory.isCognitoConfigured()
      
      expect(result).toBe(false)
    })
  })

  describe('isServiceAvailable', () => {
    test('returns true for azure when configured', () => {
      mockConfig.auth.clientId = 'test-client'
      mockConfig.auth.authority = 'https://login.microsoftonline.com/test'
      mockConfig.auth.redirectUri = 'http://localhost:3000/callback'
      
      const result = AuthServiceFactory.isServiceAvailable('azure')
      
      expect(result).toBe(true)
    })

    test('returns false for azure when not configured', () => {
      mockConfig.auth.authority = ''
      
      const result = AuthServiceFactory.isServiceAvailable('azure')
      
      expect(result).toBe(false)
    })

    test('returns true for cognito when configured', () => {
      mockConfig.auth.clientId = 'test-client'
      mockConfig.auth.userPoolId = 'us-east-1_test'
      mockConfig.auth.region = 'us-east-1'
      mockConfig.auth.domain = 'test-domain.auth.us-east-1.amazoncognito.com'
      
      const result = AuthServiceFactory.isServiceAvailable('cognito')
      
      expect(result).toBe(true)
    })

    test('returns false for cognito when not configured', () => {
      mockConfig.auth.userPoolId = ''
      
      const result = AuthServiceFactory.isServiceAvailable('cognito')
      
      expect(result).toBe(false)
    })

    test('returns false for unknown service type', () => {
      const result = AuthServiceFactory.isServiceAvailable('unknown' as any)
      
      expect(result).toBe(false)
    })
  })

  describe('exported functions', () => {
    test('getAuthService returns default auth service', async () => {
      mockConfig.auth.type = 'cornflow'
      
      const service = await getAuthService()
      
      expect(service).toBe(mockCornflowAuthService)
    })

    test('getAuthService caches promise for subsequent calls', async () => {
      mockConfig.auth.type = 'cornflow'
      
      const service1 = await getAuthService()
      const service2 = await getAuthService()
      
      expect(service1).toBe(service2)
    })

    test('getAllAuthServices returns all services', async () => {
      mockConfig.auth.type = 'azure'
      const mockAzureInstance = { 
        provider: 'azure',
        initialize: vi.fn().mockResolvedValue(undefined)
      }
      mockOpenIDAuthService.mockReturnValue(mockAzureInstance)
      
      const services = await getAllAuthServices()
      
      expect(services.cornflow).toBe(mockCornflowAuthService)
      expect(services.azure).toBe(mockAzureInstance)
    })

    test('getSpecificAuthService returns specific service', async () => {
      mockConfig.auth.type = 'azure'
      const mockAzureInstance = { 
        provider: 'azure',
        initialize: vi.fn().mockResolvedValue(undefined)
      }
      mockOpenIDAuthService.mockReturnValue(mockAzureInstance)
      
      const service = await getSpecificAuthService('azure')
      
      expect(service).toBe(mockAzureInstance)
    })

    test('isAuthServiceAvailable checks service availability', () => {
      mockConfig.auth.clientId = 'test-client'
      mockConfig.auth.authority = 'https://login.microsoftonline.com/test'
      mockConfig.auth.redirectUri = 'http://localhost:3000/callback'
      
      const result = isAuthServiceAvailable('azure')
      
      expect(result).toBe(true)
    })
  })

  describe('error handling', () => {
    test('handles config initialization error', async () => {
      mockConfig.auth.type = ''
      mockConfig.initConfig.mockRejectedValue(new Error('Config init failed'))
      
      await expect(AuthServiceFactory.getAllAuthServices()).rejects.toThrow('Config init failed')
    })

    test('continues initialization even if one service fails', async () => {
      mockConfig.auth.type = 'azure'
      mockOpenIDAuthService.mockImplementation((provider) => {
        if (provider === 'azure') {
          throw new Error('Azure failed')
        }
        return { provider: 'cognito' }
      })

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      
      const services = await AuthServiceFactory.getAllAuthServices()
      
      expect(services.cornflow).toBe(mockCornflowAuthService)
      expect(services.azure).toBeNull()
      expect(services.cognito).toBeDefined()
      
      consoleSpy.mockRestore()
    })
  })

  describe('state management', () => {
    test('initializes services only once', async () => {
      mockConfig.auth.type = 'azure'
      // Remove Cognito config to ensure only Azure is initialized
      mockConfig.auth.userPoolId = ''
      mockConfig.auth.region = ''
      mockConfig.auth.domain = ''
      
      const mockAzureInstance = { 
        provider: 'azure',
        initialize: vi.fn().mockResolvedValue(undefined)
      }
      mockOpenIDAuthService.mockReturnValue(mockAzureInstance)
      
      await AuthServiceFactory.getAllAuthServices()
      await AuthServiceFactory.getAllAuthServices()
      
      expect(mockOpenIDAuthService).toHaveBeenCalledTimes(1)
    })

    test('resets state correctly between tests', async () => {
      // This test verifies our beforeEach cleanup works
      expect(AuthServiceFactory['initialized']).toBe(false)
      expect(Object.keys(AuthServiceFactory['instances'])).toHaveLength(0)
    })
  })
})
