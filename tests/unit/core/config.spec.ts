import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock dependencies
const mockConfigService = {
  getConfig: vi.fn()
}

const mockAppConfig = {
  getCore: vi.fn()
}

vi.mock('@/services/ConfigService', () => ({
  default: mockConfigService
}))

vi.mock('@/app/config', () => ({
  default: mockAppConfig
}))

// Function to reset config to initial state
const resetConfig = (config: any) => {
  config.backend = ''
  config.schema = ''
  config.name = ''
  config.hasExternalApp = false
  config.isStagingEnvironment = false
  config.auth = {
    type: 'cornflow',
    clientId: '',
    authority: '',
    redirectUri: '',
    region: '',
    userPoolId: '',
    domain: ''
  }
}

describe('Config Module Integration', () => {
  let mockConsoleError: any
  let config: any

  beforeEach(async () => {
    vi.clearAllMocks()
    
    // Setup console.error mock
    mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    
    // Import config fresh
    const configModule = await import('@/config')
    config = configModule.default
    
    // Reset config to initial state
    resetConfig(config)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    mockConsoleError?.mockRestore()
  })

  describe('JSON Configuration', () => {
    test('should initialize config from JSON with Cognito auth', async () => {
      const mockJsonConfig = {
        backend_url: 'https://api.example.com',
        schema: 'production-schema',
        name: 'Production App',
        hasExternalApp: true,
        isStagingEnvironment: false,
        auth_type: 'cognito',
        cognito: {
          client_id: 'cognito-client-id',
          region: 'us-west-2',
          user_pool_id: 'us-west-2_pool',
          domain: 'cognito.auth.com'
        }
      }

      mockAppConfig.getCore.mockReturnValue({
        parameters: {
          useConfigJson: true
        }
      })

      mockConfigService.getConfig.mockResolvedValue(mockJsonConfig)

      await config.initConfig()

      expect(config.backend).toBe('https://api.example.com')
      expect(config.schema).toBe('production-schema')
      expect(config.name).toBe('Production App')
      expect(config.hasExternalApp).toBe(true)
      expect(config.isStagingEnvironment).toBe(false)
      expect(config.auth.type).toBe('cognito')
      expect(config.auth.clientId).toBe('cognito-client-id')
      expect(config.auth.region).toBe('us-west-2')
      expect(config.auth.userPoolId).toBe('us-west-2_pool')
      expect(config.auth.domain).toBe('cognito.auth.com')
    })

    test('should initialize config from JSON with Azure auth', async () => {
      const mockJsonConfig = {
        backend_url: 'https://api.example.com',
        schema: 'production-schema',
        name: 'Production App',
        auth_type: 'azure',
        azure: {
          client_id: 'azure-client-id',
          authority: 'https://login.microsoftonline.com/tenant',
          redirect_uri: 'https://app.example.com/callback'
        }
      }

      mockAppConfig.getCore.mockReturnValue({
        parameters: {
          useConfigJson: true
        }
      })

      mockConfigService.getConfig.mockResolvedValue(mockJsonConfig)

      await config.initConfig()

      expect(config.auth.type).toBe('azure')
      expect(config.auth.clientId).toBe('azure-client-id')
      expect(config.auth.authority).toBe('https://login.microsoftonline.com/tenant')
      expect(config.auth.redirectUri).toBe('https://app.example.com/callback')
    })

    test('should fallback to cornflow auth when auth_type is not recognized', async () => {
      const mockJsonConfig = {
        backend_url: 'https://api.example.com',
        schema: 'production-schema',
        name: 'Production App',
        auth_type: 'unknown'
      }

      mockAppConfig.getCore.mockReturnValue({
        parameters: {
          useConfigJson: true
        }
      })

      mockConfigService.getConfig.mockResolvedValue(mockJsonConfig)

      await config.initConfig()

      expect(config.auth.type).toBe('cornflow')
    })

    test('should handle missing optional properties in JSON config', async () => {
      const mockJsonConfig = {
        backend_url: 'https://api.example.com',
        schema: 'production-schema',
        name: 'Production App'
        // hasExternalApp and isStagingEnvironment are missing
      }

      mockAppConfig.getCore.mockReturnValue({
        parameters: {
          useConfigJson: true
        }
      })

      mockConfigService.getConfig.mockResolvedValue(mockJsonConfig)

      await config.initConfig()

      expect(config.backend).toBe('https://api.example.com')
      expect(config.schema).toBe('production-schema')
      expect(config.name).toBe('Production App')
      // Should use the fallback values from the original config object
      expect(config.hasExternalApp).toBe(false) // Uses config.hasExternalApp as fallback
      expect(config.isStagingEnvironment).toBe(false) // Uses config.isStagingEnvironment as fallback
    })

    test('should handle auth_type cognito without cognito config object', async () => {
      const mockJsonConfig = {
        backend_url: 'https://api.example.com',
        auth_type: 'cognito'
        // No cognito object
      }

      mockAppConfig.getCore.mockReturnValue({
        parameters: {
          useConfigJson: true
        }
      })

      mockConfigService.getConfig.mockResolvedValue(mockJsonConfig)

      await config.initConfig()

      expect(config.auth.type).toBe('cornflow')
    })

    test('should handle auth_type azure without azure config object', async () => {
      const mockJsonConfig = {
        backend_url: 'https://api.example.com',
        auth_type: 'azure'
        // No azure object
      }

      mockAppConfig.getCore.mockReturnValue({
        parameters: {
          useConfigJson: true
        }
      })

      mockConfigService.getConfig.mockResolvedValue(mockJsonConfig)

      await config.initConfig()

      expect(config.auth.type).toBe('cornflow')
    })
  })

  describe('Environment Variables Configuration', () => {
    test('should execute environment variable branch when useConfigJson is false', async () => {
      mockAppConfig.getCore.mockReturnValue({
        parameters: {
          useConfigJson: false
        }
      })

      await config.initConfig()

      // Just verify that the environment branch was executed
      // The actual values will depend on the current environment
      expect(config.backend).toBeDefined()
      expect(config.schema).toBeDefined()
      expect(config.name).toBeDefined()
      expect(config.auth.type).toBeDefined()
    })
  })

  describe('Error Handling', () => {
    test('should fallback to environment variables when JSON config fails', async () => {
      mockAppConfig.getCore.mockReturnValue({
        parameters: {
          useConfigJson: true
        }
      })

      mockConfigService.getConfig.mockRejectedValue(new Error('Failed to load config'))

      await config.initConfig()

      expect(mockConsoleError).toHaveBeenCalledWith('Error initializing config:', expect.any(Error))
      // Verify that fallback values are set (actual values depend on environment)
      expect(config.backend).toBeDefined()
      expect(config.schema).toBeDefined()
      expect(config.name).toBeDefined()
    })

    test('should handle error when appConfig.getCore throws', async () => {
      mockAppConfig.getCore.mockImplementation(() => {
        throw new Error('AppConfig error')
      })

      await config.initConfig()

      expect(mockConsoleError).toHaveBeenCalledWith('Error initializing config:', expect.any(Error))
      // Verify that fallback values are set (actual values depend on environment)
      expect(config.backend).toBeDefined()
      expect(config.schema).toBeDefined()
      expect(config.name).toBeDefined()
    })
  })

  describe('Config Object Structure', () => {
    test('should have correct initial structure', () => {
      expect(config).toHaveProperty('backend')
      expect(config).toHaveProperty('schema')
      expect(config).toHaveProperty('name')
      expect(config).toHaveProperty('hasExternalApp')
      expect(config).toHaveProperty('isStagingEnvironment')
      expect(config).toHaveProperty('auth')
      expect(config).toHaveProperty('initConfig')
      
      expect(config.auth).toHaveProperty('type')
      expect(config.auth).toHaveProperty('clientId')
      expect(config.auth).toHaveProperty('authority')
      expect(config.auth).toHaveProperty('redirectUri')
      expect(config.auth).toHaveProperty('region')
      expect(config.auth).toHaveProperty('userPoolId')
      expect(config.auth).toHaveProperty('domain')
    })

    test('should have initConfig as a function', () => {
      expect(typeof config.initConfig).toBe('function')
    })

    test('should have correct initial types', () => {
      expect(typeof config.backend).toBe('string')
      expect(typeof config.schema).toBe('string')
      expect(typeof config.name).toBe('string')
      expect(typeof config.hasExternalApp).toBe('boolean')
      expect(typeof config.isStagingEnvironment).toBe('boolean')
      expect(typeof config.auth.type).toBe('string')
    })

    test('should maintain object identity after initialization', async () => {
      const originalConfig = config
      
      mockAppConfig.getCore.mockReturnValue({
        parameters: {
          useConfigJson: true
        }
      })

      mockConfigService.getConfig.mockResolvedValue({
        backend_url: 'https://test.com',
        schema: 'test',
        name: 'test'
      })

      await config.initConfig()
      
      // Object reference should be the same
      expect(config).toBe(originalConfig)
    })
  })

  describe('Auth Configuration Branches', () => {
    test('should handle Cognito config with missing fields', async () => {
      const mockJsonConfig = {
        backend_url: 'https://api.example.com',
        auth_type: 'cognito',
        cognito: {
          client_id: 'cognito-client-id'
          // Missing other fields
        }
      }

      mockAppConfig.getCore.mockReturnValue({
        parameters: {
          useConfigJson: true
        }
      })

      mockConfigService.getConfig.mockResolvedValue(mockJsonConfig)

      await config.initConfig()

      expect(config.auth.type).toBe('cognito')
      expect(config.auth.clientId).toBe('cognito-client-id')
      expect(config.auth.region).toBeUndefined()
    })

    test('should handle Azure config with missing fields', async () => {
      const mockJsonConfig = {
        backend_url: 'https://api.example.com',
        auth_type: 'azure',
        azure: {
          client_id: 'azure-client-id'
          // Missing other fields
        }
      }

      mockAppConfig.getCore.mockReturnValue({
        parameters: {
          useConfigJson: true
        }
      })

      mockConfigService.getConfig.mockResolvedValue(mockJsonConfig)

      await config.initConfig()

      expect(config.auth.type).toBe('azure')
      expect(config.auth.clientId).toBe('azure-client-id')
      expect(config.auth.authority).toBeUndefined()
    })

    test('should execute else branch for cornflow auth in JSON config', async () => {
      const mockJsonConfig = {
        backend_url: 'https://api.example.com',
        auth_type: 'cornflow'
      }

      mockAppConfig.getCore.mockReturnValue({
        parameters: {
          useConfigJson: true
        }
      })

      mockConfigService.getConfig.mockResolvedValue(mockJsonConfig)

      await config.initConfig()

      expect(config.auth.type).toBe('cornflow')
    })
  })
})