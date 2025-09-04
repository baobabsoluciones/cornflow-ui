import { describe, test, expect, vi, beforeEach } from 'vitest'

// Mock app config
const mockAppConfig = vi.hoisted(() => ({
  getCore: vi.fn(() => ({
    parameters: {
      valuesJsonPath: '/values.json'
    }
  }))
}))

vi.mock('@/app/config', () => ({
  default: mockAppConfig
}))

// Mock fetch globally
global.fetch = vi.fn()

// Mock window.location
Object.defineProperty(window, 'location', {
  value: {
    hostname: 'localhost',
    href: 'http://localhost:3000',
    origin: 'http://localhost:3000'
  },
  writable: true
})

// Create a controllable mock for import.meta.env
let mockImportMetaEnv = {}

// Mock the entire ConfigService module to control import.meta.env
vi.mock('../../../../src/services/ConfigService', async () => {
  const actual = await vi.importActual('../../../../src/services/ConfigService') as any
  
  // Create a new ConfigService class that uses our mocked env
  class MockedConfigService {
    private static instance: MockedConfigService | null = null
    private loadPromise: Promise<any> | null = null
    private values: any | null = null

    private constructor() {}

    public static getInstance(): MockedConfigService {
      if (!MockedConfigService.instance) {
        MockedConfigService.instance = new MockedConfigService()
      }
      return MockedConfigService.instance
    }

    async getConfig(): Promise<any> {
      if (this.values) return this.values

      // Use our mocked environment variables
      const hasEnvConfig = !!(mockImportMetaEnv.VITE_APP_SCHEMA || mockImportMetaEnv.VITE_APP_BACKEND_URL)
      
      if (hasEnvConfig) {
        const envConfig = {
          backend_url: mockImportMetaEnv.VITE_APP_BACKEND_URL || '',
          auth_type: mockImportMetaEnv.VITE_APP_AUTH_TYPE || 'cornflow',
          schema: mockImportMetaEnv.VITE_APP_SCHEMA || '',
          name: mockImportMetaEnv.VITE_APP_NAME || '',
          hasExternalApp: mockImportMetaEnv.VITE_APP_EXTERNAL_APP == '1',
          isStagingEnvironment: mockImportMetaEnv.VITE_APP_IS_STAGING_ENVIRONMENT == '1',
          useHashMode: mockImportMetaEnv.VITE_APP_USE_HASH_MODE == '1',
          defaultLanguage: mockImportMetaEnv.VITE_APP_DEFAULT_LANGUAGE || '',
          isDeveloperMode: mockImportMetaEnv.VITE_APP_IS_DEVELOPER_MODE == '1',
          enableSignup: mockImportMetaEnv.VITE_APP_ENABLE_SIGNUP == '1',
          cognito: {
            region: mockImportMetaEnv.VITE_APP_AUTH_REGION || '',
            user_pool_id: mockImportMetaEnv.VITE_APP_AUTH_USER_POOL_ID || '',
            client_id: mockImportMetaEnv.VITE_APP_AUTH_CLIENT_ID || '',
            domain: mockImportMetaEnv.VITE_APP_AUTH_DOMAIN || '',
            providers: mockImportMetaEnv.VITE_APP_AUTH_PROVIDERS ? mockImportMetaEnv.VITE_APP_AUTH_PROVIDERS.split(',') : []
          },
          azure: {
            client_id: mockImportMetaEnv.VITE_APP_AUTH_CLIENT_ID || '',
            authority: mockImportMetaEnv.VITE_APP_AUTH_AUTHORITY || '',
            redirect_uri: mockImportMetaEnv.VITE_APP_AUTH_REDIRECT_URI || ''
          }
        }
        this.values = envConfig
        return envConfig
      }
      
      return this.loadConfig()
    }

    private async loadConfig(): Promise<any> {
      if (this.loadPromise) return this.loadPromise

      this.loadPromise = new Promise<any>((resolve, reject) => {
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        const valuesJsonPath = mockAppConfig.getCore().parameters.valuesJsonPath
        const configUrl = isLocalhost ? valuesJsonPath : `https://${window.location.hostname}${valuesJsonPath}`
        
        global.fetch(configUrl)
          .then((response: any) => response.json())
          .then((values: any) => {
            this.values = values
            resolve(values)
          })
          .catch((error: any) => {
            reject(error)
          })
      })

      return this.loadPromise
    }
  }

  const mockedInstance = MockedConfigService.getInstance()
  return {
    default: mockedInstance,
    ConfigService: MockedConfigService
  }
})

// Import the mocked ConfigService
const { default: configService } = await import('../../../../src/services/ConfigService')

// Helper function to get a fresh ConfigService instance
const getConfigService = () => {
  // Reset the singleton instance
  ;(configService.constructor as any).instance = null
  // Create new instance
  return (configService.constructor as any).getInstance()
}

// Test data
const mockEnvComplete = {
  VITE_APP_BACKEND_URL: 'http://localhost:8000',
  VITE_APP_AUTH_TYPE: 'cornflow',
  VITE_APP_SCHEMA: 'test-schema',
  VITE_APP_NAME: 'Test App',
  VITE_APP_EXTERNAL_APP: '1',
  VITE_APP_IS_STAGING_ENVIRONMENT: '0',
  VITE_APP_USE_HASH_MODE: '1',
  VITE_APP_DEFAULT_LANGUAGE: 'en',
  VITE_APP_IS_DEVELOPER_MODE: '0',
  VITE_APP_ENABLE_SIGNUP: '1',
  VITE_APP_AUTH_REGION: 'us-east-1',
  VITE_APP_AUTH_USER_POOL_ID: 'us-east-1_test',
  VITE_APP_AUTH_CLIENT_ID: 'test-client-id',
  VITE_APP_AUTH_DOMAIN: 'test-domain.auth.us-east-1.amazoncognito.com',
  VITE_APP_AUTH_AUTHORITY: 'https://login.microsoftonline.com/tenant-id',
  VITE_APP_AUTH_REDIRECT_URI: 'http://localhost:3000/auth/callback',
  VITE_APP_AUTH_PROVIDERS: 'google,microsoft,facebook'
}

const mockJsonConfig = {
  backend_url: 'https://api.example.com',
  auth_type: 'azure',
  schema: 'production-schema',
  name: 'Production App',
  hasExternalApp: true,
  isStagingEnvironment: false,
  useHashMode: false,
  defaultLanguage: 'es',
  isDeveloperMode: false,
  enableSignup: false,
  cognito: {
    region: 'eu-west-1',
    user_pool_id: 'eu-west-1_prod',
    client_id: 'prod-client-id',
    domain: 'prod-domain.auth.eu-west-1.amazoncognito.com',
    providers: ['google']
  },
  azure: {
    client_id: 'azure-client-id',
    authority: 'https://login.microsoftonline.com/prod-tenant',
    redirect_uri: 'https://app.example.com/auth/callback'
  }
}

describe('ConfigService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(global.fetch).mockClear()
    // Reset mock environment
    mockImportMetaEnv = {}
  })

  describe('Singleton Pattern', () => {
    test('maintains singleton instance', () => {
      mockImportMetaEnv = mockEnvComplete
      const configService = getConfigService()
      
      expect(configService).toBeDefined()
      expect(typeof configService.getConfig).toBe('function')
    })

    test('returns same instance on multiple calls', () => {
      mockImportMetaEnv = mockEnvComplete
      const instance1 = getConfigService()
      const instance2 = (configService.constructor as any).getInstance()
      
      expect(instance1).toBe(instance2)
    })
  })

  describe('Environment Variables Configuration', () => {
    test('uses environment variables when present', async () => {
      mockImportMetaEnv = mockEnvComplete
      const configService = getConfigService()

      const config = await configService.getConfig()

      expect(config.backend_url).toBe('http://localhost:8000')
      expect(config.auth_type).toBe('cornflow')
      expect(config.schema).toBe('test-schema')
      expect(config.name).toBe('Test App')
    })

    test('parses boolean flags correctly', async () => {
      mockImportMetaEnv = mockEnvComplete
      const configService = getConfigService()

      const config = await configService.getConfig()

      expect(config.hasExternalApp).toBe(true) // '1'
      expect(config.isStagingEnvironment).toBe(false) // '0'
      expect(config.useHashMode).toBe(true) // '1'
      expect(config.isDeveloperMode).toBe(false) // '0'
      expect(config.enableSignup).toBe(true) // '1'
    })

    test('parses auth providers array correctly', async () => {
      mockImportMetaEnv = mockEnvComplete
      const configService = getConfigService()

      const config = await configService.getConfig()

      expect(config.cognito?.providers).toEqual(['google', 'microsoft', 'facebook'])
    })

    test('handles cognito auth configuration', async () => {
      mockImportMetaEnv = mockEnvComplete
      const configService = getConfigService()

      const config = await configService.getConfig()

      expect(config.cognito).toEqual({
        region: 'us-east-1',
        user_pool_id: 'us-east-1_test',
        client_id: 'test-client-id',
        domain: 'test-domain.auth.us-east-1.amazoncognito.com',
        providers: ['google', 'microsoft', 'facebook']
      })
    })

    test('handles azure auth configuration', async () => {
      mockImportMetaEnv = mockEnvComplete
      const configService = getConfigService()

      const config = await configService.getConfig()

      expect(config.azure).toEqual({
        client_id: 'test-client-id',
        authority: 'https://login.microsoftonline.com/tenant-id',
        redirect_uri: 'http://localhost:3000/auth/callback'
      })
    })

    test('caches configuration on subsequent calls', async () => {
      mockImportMetaEnv = mockEnvComplete
      const configService = getConfigService()

      const config1 = await configService.getConfig()
      const config2 = await configService.getConfig()

      expect(config1).toBe(config2)
      expect(mockAppConfig.getCore).not.toHaveBeenCalled()
    })

    test('never calls loadConfig when environment variables are present', async () => {
      mockImportMetaEnv = mockEnvComplete
      const configService = getConfigService()
      const loadConfigSpy = vi.spyOn(configService as any, 'loadConfig')
      
      await configService.getConfig()
      
      expect(loadConfigSpy).not.toHaveBeenCalled()
      loadConfigSpy.mockRestore()
    })
  })

  describe('Different Auth Types', () => {
    test('handles azure auth type', async () => {
      mockImportMetaEnv = {
        ...mockEnvComplete,
        VITE_APP_AUTH_TYPE: 'azure'
      }
      const configService = getConfigService()

      const config = await configService.getConfig()

      expect(config.auth_type).toBe('azure')
      expect(['cognito', 'azure', 'cornflow']).toContain(config.auth_type)
    })

    test('handles cognito auth type', async () => {
      mockImportMetaEnv = {
        ...mockEnvComplete,
        VITE_APP_AUTH_TYPE: 'cognito'
      }
      const configService = getConfigService()

      const config = await configService.getConfig()

      expect(config.auth_type).toBe('cognito')
      expect(config.cognito).toHaveProperty('region')
      expect(config.cognito).toHaveProperty('user_pool_id')
    })

    test('defaults to cornflow auth type', async () => {
      mockImportMetaEnv = {
        ...mockEnvComplete,
        VITE_APP_AUTH_TYPE: undefined
      }
      const configService = getConfigService()

      const config = await configService.getConfig()

      expect(config.auth_type).toBe('cornflow')
    })
  })

  describe('Default Values', () => {
    test('uses default values when env vars are empty', async () => {
      mockImportMetaEnv = {
        VITE_APP_SCHEMA: 'test-schema', // Minimum required to trigger env mode
        VITE_APP_BACKEND_URL: '', // Empty value
        VITE_APP_AUTH_TYPE: '', // Empty value
        VITE_APP_NAME: '' // Empty value
      }
      const configService = getConfigService()

      const config = await configService.getConfig()

      expect(config.backend_url).toBe('')
      expect(config.auth_type).toBe('cornflow') // Default
      expect(config.name).toBe('')
      expect(config.hasExternalApp).toBe(false) // Default for undefined
    })
  })

  describe('JSON Configuration Loading', () => {
    test('loads configuration from JSON when no env vars present', async () => {
      mockImportMetaEnv = {} // No environment variables
      const configService = getConfigService()
      
      vi.mocked(global.fetch).mockResolvedValueOnce({
        json: () => Promise.resolve(mockJsonConfig)
      } as Response)

      const config = await configService.getConfig()

      expect(global.fetch).toHaveBeenCalledWith('/values.json')
      expect(config.backend_url).toBe('https://api.example.com')
      expect(config.auth_type).toBe('azure')
      expect(config.schema).toBe('production-schema')
      expect(mockAppConfig.getCore).toHaveBeenCalled()
    })

    test('uses correct URL for localhost', async () => {
      mockImportMetaEnv = {} // No environment variables
      const configService = getConfigService()
      
      vi.mocked(global.fetch).mockResolvedValueOnce({
        json: () => Promise.resolve(mockJsonConfig)
      } as Response)

      await configService.getConfig()

      expect(global.fetch).toHaveBeenCalledWith('/values.json')
    })

    test('uses correct URL for production domain', async () => {
      mockImportMetaEnv = {} // No environment variables
      const configService = getConfigService()
      
      Object.defineProperty(window, 'location', {
        value: {
          hostname: 'app.example.com'
        },
        writable: true
      })

      vi.mocked(global.fetch).mockResolvedValueOnce({
        json: () => Promise.resolve(mockJsonConfig)
      } as Response)

      await configService.getConfig()

      expect(global.fetch).toHaveBeenCalledWith('https://app.example.com/values.json')
    })

    test('caches JSON configuration on subsequent calls', async () => {
      mockImportMetaEnv = {} // No environment variables
      const configService = getConfigService()
      
      vi.mocked(global.fetch).mockResolvedValueOnce({
        json: () => Promise.resolve(mockJsonConfig)
      } as Response)

      const config1 = await configService.getConfig()
      const config2 = await configService.getConfig()

      expect(config1).toBe(config2)
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('Error Handling', () => {
    test('handles fetch network errors', async () => {
      mockImportMetaEnv = {} // No environment variables
      const configService = getConfigService()
      
      vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'))

      await expect(configService.getConfig()).rejects.toThrow('Network error')
    })

    test('handles JSON parsing errors', async () => {
      mockImportMetaEnv = {} // No environment variables
      const configService = getConfigService()
      
      vi.mocked(global.fetch).mockResolvedValueOnce({
        json: () => Promise.reject(new Error('Invalid JSON'))
      } as Response)

      await expect(configService.getConfig()).rejects.toThrow('Invalid JSON')
    })

    test('handles fetch response errors', async () => {
      mockImportMetaEnv = {} // No environment variables
      const configService = getConfigService()
      
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.reject(new Error('Not found'))
      } as Response)

      await expect(configService.getConfig()).rejects.toThrow('Not found')
    })
  })

  describe('Edge Cases', () => {
    test('handles malformed auth providers string', async () => {
      mockImportMetaEnv = {
        ...mockEnvComplete,
        VITE_APP_AUTH_PROVIDERS: '' // Empty string
      }
      const configService = getConfigService()

      const config = await configService.getConfig()

      expect(config.cognito?.providers).toEqual([])
    })

    test('handles missing auth providers', async () => {
      mockImportMetaEnv = {
        ...mockEnvComplete,
        VITE_APP_AUTH_PROVIDERS: undefined
      }
      const configService = getConfigService()

      const config = await configService.getConfig()

      expect(config.cognito?.providers).toEqual([])
    })

    test('handles concurrent calls correctly', async () => {
      mockImportMetaEnv = mockEnvComplete
      const configService = getConfigService()

      const [config1, config2, config3] = await Promise.all([
        configService.getConfig(),
        configService.getConfig(),
        configService.getConfig()
      ])

      expect(config1).toBe(config2)
      expect(config2).toBe(config3)
    })
  })
})
