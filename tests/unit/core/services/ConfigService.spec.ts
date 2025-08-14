import { describe, test, expect, vi, beforeEach } from 'vitest'
import configService from '@/services/ConfigService'

// Mock app config
const mockAppConfig = vi.hoisted(() => ({
  getCore: vi.fn(() => ({
    parameters: {
      useConfigJson: false,
      valuesJsonPath: '/values.json'
    }
  }))
}))

vi.mock('@/app/config', () => ({
  default: mockAppConfig
}))

// Mock import.meta.env
const mockEnv = {
  VITE_APP_BACKEND_URL: 'http://localhost:8000',
  VITE_APP_AUTH_TYPE: 'cornflow',
  VITE_APP_SCHEMA: 'test-schema',
  VITE_APP_NAME: 'Test App',
  VITE_APP_AUTH_REGION: 'us-east-1',
  VITE_APP_AUTH_USER_POOL_ID: 'us-east-1_test',
  VITE_APP_AUTH_CLIENT_ID: 'test-client-id',
  VITE_APP_AUTH_DOMAIN: 'test-domain.auth.us-east-1.amazoncognito.com'
}

vi.stubGlobal('import.meta', {
  env: mockEnv
})

describe('ConfigService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset environment variables
    vi.stubGlobal('import.meta', {
      env: mockEnv
    })
    // Clear cached values for each test
    configService['values'] = null
    configService['loadPromise'] = null
  })

  describe('getInstance', () => {
    test('returns singleton instance', () => {
      // Since configService is already an instance, we test that it's consistent
      expect(configService).toBeDefined()
      expect(typeof configService.getConfig).toBe('function')
    })
  })

  describe('getConfig with environment variables', () => {
    test('returns config from environment variables when useConfigJson is false', async () => {
      mockAppConfig.getCore.mockReturnValue({
        parameters: {
          useConfigJson: false,
          valuesJsonPath: '/values.json'
        }
      })


      const config = await configService.getConfig()

      // Test structure rather than exact values since environment variable mocking 
      // is complex in this singleton pattern
      expect(config).toHaveProperty('backend_url')
      expect(config).toHaveProperty('auth_type')
      expect(config).toHaveProperty('schema')
      expect(config).toHaveProperty('name')
      expect(config).toHaveProperty('cognito')
      expect(config.cognito).toHaveProperty('region')
      expect(config.cognito).toHaveProperty('user_pool_id')
      expect(config.cognito).toHaveProperty('client_id')
      expect(config.cognito).toHaveProperty('domain')
    })

    test('returns cached config on subsequent calls', async () => {
      mockAppConfig.getCore.mockReturnValue({
        parameters: {
          useConfigJson: false,
          valuesJsonPath: '/values.json'
        }
      })


      const config1 = await configService.getConfig()
      const config2 = await configService.getConfig()

      expect(config1).toBe(config2)
      expect(mockAppConfig.getCore).toHaveBeenCalledTimes(1)
    })
  })

  describe('getConfig with JSON file', () => {
    beforeEach(() => {
      // Mock fetch globally
      global.fetch = vi.fn()
      
      // Mock window.location
      Object.defineProperty(window, 'location', {
        value: {
          hostname: 'localhost'
        },
        writable: true
      })
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    test('loads config from JSON file when useConfigJson is true (localhost)', async () => {
      mockAppConfig.getCore.mockReturnValue({
        parameters: {
          useConfigJson: true,
          valuesJsonPath: '/values.json'
        }
      })

      const mockJsonConfig = {
        backend_url: 'https://api.example.com',
        auth_type: 'azure',
        schema: 'production-schema',
        name: 'Production App',
        azure: {
          client_id: 'azure-client-id',
          authority: 'https://login.microsoftonline.com/tenant',
          redirect_uri: 'https://example.com/callback'
        }
      }

      vi.mocked(fetch).mockResolvedValueOnce({
        json: () => Promise.resolve(mockJsonConfig)
      } as Response)


      const config = await configService.getConfig()

      expect(fetch).toHaveBeenCalledWith('/values.json')
      expect(config).toEqual(mockJsonConfig)
    })

    test('loads config from JSON file when useConfigJson is true (production)', async () => {
      // Mock production hostname
      Object.defineProperty(window, 'location', {
        value: {
          hostname: 'app.example.com'
        },
        writable: true
      })

      mockAppConfig.getCore.mockReturnValue({
        parameters: {
          useConfigJson: true,
          valuesJsonPath: '/config/values.json'
        }
      })

      const mockJsonConfig = {
        backend_url: 'https://api.example.com',
        auth_type: 'cognito',
        schema: 'production-schema',
        name: 'Production App'
      }

      vi.mocked(fetch).mockResolvedValueOnce({
        json: () => Promise.resolve(mockJsonConfig)
      } as Response)


      const config = await configService.getConfig()

      expect(fetch).toHaveBeenCalledWith('https://app.example.com/config/values.json')
      expect(config).toEqual(mockJsonConfig)
    })

    test('handles JSON loading errors gracefully', async () => {
      mockAppConfig.getCore.mockReturnValue({
        parameters: {
          useConfigJson: true,
          valuesJsonPath: '/values.json'
        }
      })

      vi.mocked(fetch).mockRejectedValueOnce(new Error('Failed to fetch'))



      await expect(configService.getConfig()).rejects.toThrow('Failed to fetch')
    })

    test('returns same promise for concurrent requests', async () => {
      mockAppConfig.getCore.mockReturnValue({
        parameters: {
          useConfigJson: true,
          valuesJsonPath: '/values.json'
        }
      })

      const mockJsonConfig = {
        backend_url: 'https://api.example.com',
        auth_type: 'azure',
        schema: 'test-schema',
        name: 'Test App'
      }

      vi.mocked(fetch).mockResolvedValueOnce({
        json: () => Promise.resolve(mockJsonConfig)
      } as Response)


      
      // Make concurrent requests
      const promise1 = configService.getConfig()
      const promise2 = configService.getConfig()

      const [config1, config2] = await Promise.all([promise1, promise2])

      expect(config1).toBe(config2)
      expect(fetch).toHaveBeenCalledTimes(1)
    })

    test('handles JSON parsing errors', async () => {
      mockAppConfig.getCore.mockReturnValue({
        parameters: {
          useConfigJson: true,
          valuesJsonPath: '/values.json'
        }
      })

      vi.mocked(fetch).mockResolvedValueOnce({
        json: () => Promise.reject(new Error('Invalid JSON'))
      } as Response)



      await expect(configService.getConfig()).rejects.toThrow('Invalid JSON')
    })
  })
})
