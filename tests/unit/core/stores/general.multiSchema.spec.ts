import { describe, test, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useGeneralStore } from '@cornflow-ui/core/stores/general'

// External config: a test sets `schemas` to turn the deployment into a multi-DAG one.
const mockConfig = vi.hoisted(() => ({
  backend: 'https://test-backend.com',
  schema: 'planning_dag',
  schemas: [] as string[],
  name: 'Test App',
  hasExternalApp: false,
  auth: { type: 'cornflow' },
  initConfig: vi.fn(),
}))
vi.mock('@cornflow-ui/core/config', () => ({ default: mockConfig }))

// App config: the solver settings a DAG switch puts back.
const mockParameters = vi.hoisted(() => ({
  executionSolvers: ['solver_a'],
  solverConfig: { defaultSolver: 'solver_a' },
  configFields: [] as unknown[],
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

const mockHooks = vi.hoisted(() => ({
  activeSchemaChanged: vi.fn(),
}))
vi.mock('@cornflow-ui/core/plugins/extensions', async (orig) => ({
  ...((await orig()) as object),
  loadPremiumMasterDataConfig: vi.fn(async () => ({
    config: { covers: { title: 'Covers' } },
    sections: [],
    groups: [],
  })),
  runPremiumInitialDataHooks: vi.fn(),
  runPremiumActiveSchemaChangedHooks: mockHooks.activeSchemaChanged,
}))

const mockSchemaRepository = vi.hoisted(() => ({
  getSchema: vi.fn(),
  getAvailableSchemaNames: vi.fn(),
  getInstanceTables: vi.fn(),
  getSolutionTables: vi.fn(),
}))
const mockUserRepository = vi.hoisted(() => ({ getUserById: vi.fn() }))
const mockRoleRepository = vi.hoisted(() => ({
  getAllUserRoleAssignments: vi.fn(),
}))
const mockExecutionRepository = vi.hoisted(() => ({
  getExecutions: vi.fn(),
  createExecution: vi.fn(),
}))

vi.mock('@cornflow-ui/core/repositories/SchemaRepository', () => ({
  default: vi.fn(function () {
    return mockSchemaRepository
  }),
}))
vi.mock('@cornflow-ui/core/repositories/UserRepository', () => ({
  default: vi.fn(function () {
    return mockUserRepository
  }),
}))
vi.mock('@cornflow-ui/core/repositories/RoleRepository', () => ({
  default: vi.fn(function () {
    return mockRoleRepository
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

function loadedExecution(executionId: string, config: Record<string, unknown>) {
  return { executionId, name: executionId, state: 1, config } as any
}

describe('General store — several DAGs', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    sessionStorage.clear()
    mockConfig.schema = 'planning_dag'
    mockConfig.schemas = []
    mockParameters.executionSolvers = ['solver_a']
    mockParameters.solverConfig = { defaultSolver: 'solver_a' }
    mockUserRepository.getUserById.mockResolvedValue({
      id: '7',
      username: 'ana',
    })
    mockRoleRepository.getAllUserRoleAssignments.mockResolvedValue([])
    mockSchemaRepository.getSchema.mockResolvedValue({ name: 'schema' })
    mockSchemaRepository.getInstanceTables.mockResolvedValue({ t_in: {} })
    mockSchemaRepository.getSolutionTables.mockResolvedValue({ t_out: {} })
  })

  describe('active schema', () => {
    test('a single-DAG deployment stays on config.schema and asks Cornflow nothing', async () => {
      const store = useGeneralStore()

      await store.initializeData()

      expect(
        mockSchemaRepository.getAvailableSchemaNames,
      ).not.toHaveBeenCalled()
      expect(store.getSchemaName).toBe('planning_dag')
      expect(store.availableSchemas).toEqual([])
      expect(store.canSwitchSchema).toBe(false)
      expect(mockSchemaRepository.getSchema).toHaveBeenCalledWith(
        'planning_dag',
      )
    })

    test('getSchemaName prefers the schema of the session over config.schema', () => {
      const store = useGeneralStore()
      expect(store.getSchemaName).toBe('planning_dag')

      store.schema = 'stock_dag'

      expect(store.getSchemaName).toBe('stock_dag')
    })

    test('a user granted one DAG enters it, without a switcher', async () => {
      mockConfig.schemas = ['planning_dag', 'stock_dag']
      mockSchemaRepository.getAvailableSchemaNames.mockResolvedValue([
        'stock_dag',
        'update_db_dag',
      ])
      const store = useGeneralStore()

      await store.initializeData()

      expect(store.availableSchemas).toEqual(['stock_dag'])
      expect(store.getSchemaName).toBe('stock_dag')
      expect(mockConfig.schema).toBe('stock_dag')
      expect(store.canSwitchSchema).toBe(false)
      expect((store.user as { schemas?: string[] }).schemas).toEqual([
        'stock_dag',
        'update_db_dag',
      ])
      expect(mockSchemaRepository.getSchema).toHaveBeenCalledWith('stock_dag')
    })

    test('a user granted several DAGs enters the one kept in the session', async () => {
      mockConfig.schemas = ['planning_dag', 'stock_dag']
      mockSchemaRepository.getAvailableSchemaNames.mockResolvedValue([
        'planning_dag',
        'stock_dag',
      ])
      sessionStorage.setItem('activeSchema', 'stock_dag')
      const store = useGeneralStore()

      await store.initializeData()

      expect(store.getSchemaName).toBe('stock_dag')
      expect(store.canSwitchSchema).toBe(true)
    })

    test('without a kept choice, a user granted several DAGs enters config.schema', async () => {
      mockConfig.schemas = ['stock_dag', 'planning_dag']
      mockSchemaRepository.getAvailableSchemaNames.mockResolvedValue([
        'stock_dag',
        'planning_dag',
      ])
      const store = useGeneralStore()

      await store.initializeData()

      expect(store.getSchemaName).toBe('planning_dag')
    })

    test('a user granted none of the DAGs gets no schema loaded', async () => {
      mockConfig.schemas = ['planning_dag', 'stock_dag']
      mockSchemaRepository.getAvailableSchemaNames.mockResolvedValue([])
      const store = useGeneralStore()

      await store.initializeData()

      expect(store.noSchemaAccess).toBe(true)
      expect(mockSchemaRepository.getSchema).not.toHaveBeenCalled()
    })

    test('when Cornflow cannot say, the session stays on config.schema without a switcher', async () => {
      mockConfig.schemas = ['planning_dag', 'stock_dag']
      mockSchemaRepository.getAvailableSchemaNames.mockRejectedValue(
        new Error('down'),
      )
      const store = useGeneralStore()

      await store.initializeData()

      expect(store.getSchemaName).toBe('planning_dag')
      expect(store.availableSchemas).toEqual(['planning_dag'])
      expect(store.noSchemaAccess).toBe(false)
    })
  })

  describe('setActiveSchema', () => {
    async function storeOnTrimWithBothDags() {
      mockConfig.schemas = ['planning_dag', 'stock_dag']
      mockSchemaRepository.getAvailableSchemaNames.mockResolvedValue([
        'planning_dag',
        'stock_dag',
      ])
      const store = useGeneralStore()
      await store.initializeData()
      vi.clearAllMocks()
      return store
    }

    test('switches without reloading: closes the session and reloads schema and tables', async () => {
      const store = await storeOnTrimWithBothDags()
      store.loadedExecutions = [loadedExecution('e1', {})]
      store.setSelectedExecution('e1')
      store.lastExecutions = [{ id: 'e1' }] as any
      const masterData = store.rawConfigurations?.masterData
      const uploadKey = store.uploadComponentKey
      mockSchemaRepository.getInstanceTables.mockResolvedValue({ jit_in: {} })

      const switched = await store.setActiveSchema('stock_dag')

      expect(switched).toBe(true)
      expect(store.getSchemaName).toBe('stock_dag')
      expect(mockConfig.schema).toBe('stock_dag')
      expect(sessionStorage.getItem('activeSchema')).toBe('stock_dag')
      expect(store.loadedExecutions).toEqual([])
      expect(store.selectedExecution).toBeNull()
      expect(store.lastExecutions).toEqual([])
      expect(mockSchemaRepository.getSchema).toHaveBeenCalledWith('stock_dag')
      expect(store.rawConfigurations?.inputData).toEqual({ jit_in: {} })
      expect(store.rawConfigurations?.masterData).toEqual(masterData)
      expect(store.uploadComponentKey).toBe(uploadKey + 1)
      expect(mockHooks.activeSchemaChanged).toHaveBeenCalledWith('stock_dag')
    })

    test('puts back the app solver settings before applying the new schema', async () => {
      const store = await storeOnTrimWithBothDags()
      store.appConfig.parameters.executionSolvers = ['from_trim_schema']
      store.appConfig.parameters.solverConfig = {
        defaultSolver: 'from_trim_schema',
      }

      await store.setActiveSchema('stock_dag')

      expect(store.appConfig.parameters.executionSolvers).toEqual(['solver_a'])
      expect(store.appConfig.parameters.solverConfig.defaultSolver).toBe(
        'solver_a',
      )
    })

    test('refuses a DAG the user may not switch to, and the active one', async () => {
      const store = await storeOnTrimWithBothDags()

      expect(await store.setActiveSchema('other_dag')).toBe(false)
      expect(await store.setActiveSchema('planning_dag')).toBe(false)
      expect(mockSchemaRepository.getSchema).not.toHaveBeenCalled()
    })
  })

  describe('resetSessionState', () => {
    test('empties the session so the next login starts from scratch', async () => {
      mockConfig.schemas = ['planning_dag', 'stock_dag']
      mockSchemaRepository.getAvailableSchemaNames.mockResolvedValue([
        'planning_dag',
        'stock_dag',
      ])
      const store = useGeneralStore()
      await store.initializeData()
      await store.setActiveSchema('stock_dag')
      store.loadedExecutions = [loadedExecution('e1', {})]

      store.resetSessionState()

      expect(store.user).toEqual({})
      expect(store.dataInitialized).toBe(false)
      expect(store.schema).toBe('')
      expect(mockConfig.schema).toBe('planning_dag')
      expect(store.availableSchemas).toEqual([])
      expect(store.configurations).toBeNull()
      expect(store.loadedExecutions).toEqual([])
      expect(sessionStorage.getItem('activeSchema')).toBeNull()
    })

    test('lets initializeData load the next user', async () => {
      const store = useGeneralStore()
      await store.initializeData()
      store.resetSessionState()
      mockUserRepository.getUserById.mockResolvedValue({
        id: '8',
        username: 'luis',
      })

      await store.initializeData()

      expect(mockUserRepository.getUserById).toHaveBeenCalledTimes(2)
      expect((store.user as { username: string }).username).toBe('luis')
    })
  })
})
