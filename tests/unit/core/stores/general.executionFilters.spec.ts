import { describe, test, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useGeneralStore } from '@cornflow-ui/core/stores/general'

const mockConfig = vi.hoisted(() => ({
  backend: 'https://test-backend.com',
  schema: 'planning_dag',
  name: 'Test App',
  hasExternalApp: true,
  auth: { type: 'cornflow' },
  initConfig: vi.fn(),
}))
vi.mock('@cornflow-ui/core/config', () => ({ default: mockConfig }))

// App config: a test fills `executionFilters`.
const mockParameters = vi.hoisted(() => ({
  configFields: [] as unknown[],
  executionFilters: [] as unknown[],
}))
vi.mock('@/app/config', () => ({
  default: {
    getCore: () => ({ parameters: mockParameters }),
    getDashboardRoutes: () => [],
    getDashboardPages: () => [],
    getDashboardLayout: () => ({}),
    getInstanceDashboardRoutes: () => [],
    getInstanceDashboardPages: () => [],
    getInstanceDashboardLayout: () => ({}),
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

// Frontend automation of the app: a `plants` and a `programs` master table.
const plantsTable = {
  title: 'Plants',
  get_list: { url: '/plants/', http_method: 'GET' },
}
const programsTable = {
  title: 'Programs',
  get_list: { url: '/programs/', http_method: 'GET' },
}
const mockMasterData = vi.hoisted(() => ({
  config: {} as Record<string, unknown>,
}))
vi.mock('@cornflow-ui/core/plugins/extensions', async (orig) => ({
  ...((await orig()) as object),
  loadPremiumMasterDataConfig: vi.fn(async () => ({
    config: mockMasterData.config,
    sections: [],
    groups: [],
  })),
  runPremiumInitialDataHooks: vi.fn(),
}))

// Rows each frontend-automation table lists, by its get_list URL.
const mockRows = vi.hoisted(() => ({ byUrl: {} as Record<string, unknown> }))
vi.mock('@cornflow-ui/core/repositories/TableRepository', () => ({
  default: vi.fn(function (tableConfig: { get_list: { url: string } }) {
    return {
      getList: vi.fn(async () => {
        const rows = mockRows.byUrl[tableConfig.get_list.url]
        if (rows instanceof Error) throw rows
        return rows
      }),
    }
  }),
}))

const mockSchemaRepository = vi.hoisted(() => ({
  getSchema: vi.fn(),
  getInstanceTables: vi.fn(),
  getSolutionTables: vi.fn(),
}))
const mockExecutionRepository = vi.hoisted(() => ({ getExecutions: vi.fn() }))

vi.mock('@cornflow-ui/core/repositories/SchemaRepository', () => ({
  default: vi.fn(function () {
    return mockSchemaRepository
  }),
}))
vi.mock('@cornflow-ui/core/repositories/UserRepository', () => ({
  default: vi.fn(function () {
    return { getUserById: vi.fn(async () => ({ id: '7', username: 'ana' })) }
  }),
}))
vi.mock('@cornflow-ui/core/repositories/RoleRepository', () => ({
  default: vi.fn(function () {
    return { getAllUserRoleAssignments: vi.fn(async () => []) }
  }),
}))
vi.mock('@cornflow-ui/core/repositories/ExecutionRepository', () => ({
  default: vi.fn(function () {
    return mockExecutionRepository
  }),
}))
vi.mock('@cornflow-ui/core/repositories/VersionRepository', () => ({
  default: vi.fn(function () {
    return { getCornflowVersion: vi.fn(async () => '1.3.8') }
  }),
}))
vi.mock('@cornflow-ui/core/repositories/LicenceRepository', () => ({
  default: vi.fn(function () {
    return { getLicences: vi.fn(async () => []) }
  }),
}))

const PLANT = { key: 'plant_id', labelKey: 'Plant', joinFrom: 'plants.name' }
const PROGRAM = {
  key: 'program_id',
  labelKey: 'Program',
  joinFrom: 'programs.name',
}

const plantRows = [
  { id: 1, code: '101', name: 'North' },
  { id: 2, code: '102', name: 'South' },
]

describe('General store — executions history filters', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockParameters.executionFilters = []
    mockMasterData.config = { plants: plantsTable, programs: programsTable }
    mockRows.byUrl = {
      '/plants/': plantRows,
      '/programs/': [{ id: 7, name: 'Program A' }],
    }
    mockSchemaRepository.getSchema.mockResolvedValue({ name: 'schema' })
    mockSchemaRepository.getInstanceTables.mockResolvedValue({})
    mockSchemaRepository.getSolutionTables.mockResolvedValue({})
  })

  /** A store with the frontend-automation tables loaded, as after the login. */
  async function loadedStore() {
    const store = useGeneralStore()
    await store.initializeData()
    return store
  }

  describe('fetchTableOptions', () => {
    test('gives one option per row: the id as value and the join_from column as text', async () => {
      const store = await loadedStore()

      expect(await store.fetchTableOptions('plants.name')).toEqual([
        { value: 1, title: 'North' },
        { value: 2, title: 'South' },
      ])
    })

    test('shows the id when the row has no value in the column', async () => {
      mockRows.byUrl['/plants/'] = [{ id: 3 }]
      const store = await loadedStore()

      expect(await store.fetchTableOptions('plants.name')).toEqual([
        { value: 3, title: '3' },
      ])
    })

    test('gives no options, with a warning, for a table the app has no frontend automation for', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      mockMasterData.config = {}
      const store = await loadedStore()

      expect(await store.fetchTableOptions('plants.name')).toEqual([])
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('plants.name'))
      warn.mockRestore()
    })

    test('gives no options when the table list fails', async () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockRows.byUrl['/plants/'] = new Error('down')
      const store = await loadedStore()

      expect(await store.fetchTableOptions('plants.name')).toEqual([])
      error.mockRestore()
    })
  })

  describe('filters', () => {
    test('without filters it lists no table and sends no parameters', async () => {
      const store = await loadedStore()

      expect(store.executionFilterOptions).toEqual({})
      expect(store.getExecutionFilterParams).toEqual({})
    })

    test('after the login, each filter has its table options and starts on "All"', async () => {
      mockParameters.executionFilters = [PLANT, PROGRAM]

      const store = await loadedStore()

      expect(store.executionFilterOptions).toEqual({
        plant_id: [
          { value: 1, title: 'North' },
          { value: 2, title: 'South' },
        ],
        program_id: [{ value: 7, title: 'Program A' }],
      })
      expect(store.executionFilterValues).toEqual({
        plant_id: null,
        program_id: null,
      })
      expect(store.getExecutionFilterParams).toEqual({})
    })

    test('picking a value sends it to the executions list', async () => {
      mockParameters.executionFilters = [PLANT]
      mockExecutionRepository.getExecutions.mockResolvedValue([])
      const store = await loadedStore()

      expect(store.setExecutionFilterValue('plant_id', 2)).toBe(true)
      await store.fetchExecutionsByDateRange(null as any, null as any)

      expect(store.getExecutionFilterParams).toEqual({ plant_id: '2' })
      expect(mockExecutionRepository.getExecutions).toHaveBeenCalledWith(
        'planning_dag',
        null,
        null,
        { plant_id: '2' },
      )
    })

    test('going back to "All" sends no parameter', async () => {
      mockParameters.executionFilters = [PLANT]
      const store = await loadedStore()
      store.setExecutionFilterValue('plant_id', 2)

      expect(store.setExecutionFilterValue('plant_id', null)).toBe(true)
      expect(store.getExecutionFilterParams).toEqual({})
    })

    test('refuses a value that is not an option, the one already picked and an unknown filter', async () => {
      mockParameters.executionFilters = [PLANT]
      const store = await loadedStore()

      expect(store.setExecutionFilterValue('plant_id', 99)).toBe(false)
      expect(store.setExecutionFilterValue('plant_id', null)).toBe(false)
      expect(store.setExecutionFilterValue('other', 1)).toBe(false)
      expect(store.executionFilterValues).toEqual({ plant_id: null })
    })

    test('keeps a picked value while it is still an option', async () => {
      mockParameters.executionFilters = [PLANT]
      const store = await loadedStore()
      store.setExecutionFilterValue('plant_id', 2)

      await store.loadExecutionFilters()
      expect(store.executionFilterValues).toEqual({ plant_id: 2 })

      mockRows.byUrl['/plants/'] = [plantRows[0]]
      await store.loadExecutionFilters()
      expect(store.executionFilterValues).toEqual({ plant_id: null })
    })
  })
})
