import { describe, test, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useGeneralStore } from '@cornflow-ui/core/stores/general'

const mockConfig = vi.hoisted(() => ({
  backend: 'https://test-backend.com',
  schema: 'dag_1',
  schemas: [] as string[],
  name: 'Test App',
  hasExternalApp: true,
  auth: { type: 'cornflow' },
  initConfig: vi.fn(),
}))
vi.mock('@cornflow-ui/core/config', () => ({ default: mockConfig }))

const mockParameters = vi.hoisted(() => ({}) as Record<string, any>)
vi.mock('@/app/config', () => ({
  default: {
    getCore: () => ({ parameters: mockParameters, schemaOverrides: {} }),
    getDashboardRoutes: () => [],
    getDashboardPages: () => [],
    getDashboardLayout: () => [],
    getInstanceDashboardRoutes: () => [],
    getInstanceDashboardPages: () => [],
    getInstanceDashboardLayout: () => [],
  },
}))

vi.mock('@cornflow-ui/core/services/AuthService', () => ({
  default: { getUserId: vi.fn(() => '7') },
}))
vi.mock('@cornflow-ui/core/api/Api', () => ({
  default: { initializeToken: vi.fn() },
}))
vi.mock('@cornflow-ui/core/utils/assets', () => ({
  mainLogo: 'logo.png',
  fullLogo: 'full_logo.png',
}))
vi.mock('@cornflow-ui/core/plugins/i18n', () => ({
  i18n: { global: { locale: { value: 'en' }, t: (key: string) => key } },
  locale: { value: 'en' },
}))

const etlModule = vi.hoisted(() => ({ backend: null as unknown }))
vi.mock('@cornflow-ui/core/plugins/extensions', async (orig) => ({
  ...((await orig()) as object),
  loadPremiumMasterDataConfig: vi.fn(async () => null),
  runPremiumInitialDataHooks: vi.fn(),
  runPremiumActiveSchemaChangedHooks: vi.fn(),
  getPremiumEtlBackend: () => etlModule.backend,
}))

const mockFrontendConfigRepository = vi.hoisted(() => ({
  getFrontendConfig: vi.fn(),
}))
vi.mock('@cornflow-ui/core/repositories/FrontendConfigRepository', () => ({
  default: vi.fn(function () {
    return mockFrontendConfigRepository
  }),
}))

const answer = {
  etl: {
    dag_1: {
      exists: true,
      query: {
        type: 'object',
        properties: {
          plant: {
            type: 'integer',
            join_from: 'plants.name',
            title: { en: 'Plant', es: 'Planta' },
          },
          total_weeks: {
            type: 'integer',
            minimum: 1,
            default: 3,
            title: 'Total weeks',
          },
        },
        required: ['plant'],
      },
    },
    dag_2: {
      exists: false,
      query: { type: 'object', properties: {}, required: [] },
    },
  },
}

describe('General store — what the backend tells the interface about each DAG', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    sessionStorage.clear()
    mockConfig.schema = 'dag_1'
    etlModule.backend = { useEtlBackend: vi.fn(), useEtlBackendFromDb: vi.fn() }
    mockFrontendConfigRepository.getFrontendConfig.mockResolvedValue(answer)
  })

  test('the active DAG asks the load filters the backend describes', async () => {
    const store = useGeneralStore()
    await store.fetchFrontendConfig()

    expect(
      mockFrontendConfigRepository.getFrontendConfig,
    ).toHaveBeenCalledTimes(1)
    expect(store.getLoadFilterFields.map((f) => f.key)).toEqual([
      'plant',
      'total_weeks',
    ])
    expect(store.getLoadFilterFields[0]).toMatchObject({
      type: 'select',
      joinFrom: 'plants.name',
      required: true,
      label: { en: 'Plant', es: 'Planta' },
    })
  })

  test('another DAG reads the same answer: its own load filters, or none', async () => {
    const store = useGeneralStore()
    await store.fetchFrontendConfig()

    store.schema = 'dag_2'
    expect(store.getLoadFilterFields).toEqual([])

    store.schema = 'dag_3'
    expect(store.getLoadFilterFields).toEqual([])
    expect(
      mockFrontendConfigRepository.getFrontendConfig,
    ).toHaveBeenCalledTimes(1)
  })

  test('without an answer from the backend no DAG asks load filters', async () => {
    mockFrontendConfigRepository.getFrontendConfig.mockRejectedValue(
      new Error('Failed to fetch the frontend config (404)'),
    )
    const store = useGeneralStore()
    await store.fetchFrontendConfig()

    expect(store.frontendConfig).toBeNull()
    expect(store.getLoadFilterFields).toEqual([])
  })

  test('without an ETL module the backend is not asked', async () => {
    etlModule.backend = null
    const store = useGeneralStore()
    await store.fetchFrontendConfig()

    expect(
      mockFrontendConfigRepository.getFrontendConfig,
    ).not.toHaveBeenCalled()
    expect(store.getLoadFilterFields).toEqual([])
  })

  test('the end of the session forgets the answer', async () => {
    const store = useGeneralStore()
    await store.fetchFrontendConfig()

    store.resetSessionState()

    expect(store.frontendConfig).toBeNull()
    expect(store.getLoadFilterFields).toEqual([])
  })
})
