import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'

const mockConfigService = vi.hoisted(() => ({ getConfig: vi.fn() }))

vi.mock('@cornflow-ui/core/services/ConfigService', () => ({
  default: mockConfigService,
}))

vi.mock('@/app/config', () => ({
  default: { getCore: () => ({ parameters: { valuesJsonPath: '/values.json' } }) },
}))

describe('config: DAGs of the deployment', () => {
  let config: any

  beforeEach(async () => {
    vi.clearAllMocks()
    config = (await import('@cornflow-ui/core/config')).default
    config.schema = ''
    config.schemas = []
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe('from values.json', () => {
    beforeEach(() => {
      vi.stubEnv('VITE_APP_SCHEMA', '')
      vi.stubEnv('VITE_APP_BACKEND_URL', '')
    })

    test('a schema with a single name is a single-DAG deployment', async () => {
      mockConfigService.getConfig.mockResolvedValue({
        backend_url: 'https://backend',
        schema: 'planning_dag',
      })

      await config.initConfig()

      expect(config.schema).toBe('planning_dag')
      expect(config.schemas).toEqual([])
    })

    test('a comma-separated schema lists the DAGs, and the first is the default', async () => {
      mockConfigService.getConfig.mockResolvedValue({
        backend_url: 'https://backend',
        schema: 'stock_dag, planning_dag,,stock_dag',
      })

      await config.initConfig()

      expect(config.schema).toBe('stock_dag')
      expect(config.schemas).toEqual(['stock_dag', 'planning_dag'])
    })

    test('the DAGs may also come as an array', async () => {
      mockConfigService.getConfig.mockResolvedValue({
        backend_url: 'https://backend',
        schema: ['planning_dag', 'stock_dag'],
      })

      await config.initConfig()

      expect(config.schema).toBe('planning_dag')
      expect(config.schemas).toEqual(['planning_dag', 'stock_dag'])
    })
  })

  describe('from environment variables', () => {
    test('VITE_APP_SCHEMA with a single name is a single-DAG deployment', async () => {
      vi.stubEnv('VITE_APP_BACKEND_URL', 'https://backend')
      vi.stubEnv('VITE_APP_SCHEMA', 'planning_dag')

      await config.initConfig()

      expect(config.schema).toBe('planning_dag')
      expect(config.schemas).toEqual([])
    })

    test('VITE_APP_SCHEMA may list several DAGs separated by commas', async () => {
      vi.stubEnv('VITE_APP_BACKEND_URL', 'https://backend')
      vi.stubEnv('VITE_APP_SCHEMA', 'planning_dag, stock_dag')

      await config.initConfig()

      expect(config.schema).toBe('planning_dag')
      expect(config.schemas).toEqual(['planning_dag', 'stock_dag'])
    })
  })
})
