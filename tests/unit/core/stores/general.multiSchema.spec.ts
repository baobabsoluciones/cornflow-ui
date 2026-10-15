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

// App config: a test fills `globalContext`.
const mockParameters = vi.hoisted(() => ({
  executionSolvers: ['solver_a'],
  solverConfig: { defaultSolver: 'solver_a' },
  configFields: [] as unknown[],
  globalContext: [] as unknown[],
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
  globalContextChanged: vi.fn(),
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
  runPremiumGlobalContextChangedHooks: mockHooks.globalContextChanged,
}))

const mockSchemaRepository = vi.hoisted(() => ({
  getSchema: vi.fn(),
  getAvailableSchemaNames: vi.fn(),
  getInstanceTables: vi.fn(),
  getSolutionTables: vi.fn(),
}))
const mockGlobalContextRepository = vi.hoisted(() => ({ getOptions: vi.fn() }))
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
vi.mock('@cornflow-ui/core/repositories/GlobalContextRepository', () => ({
  default: vi.fn(function () {
    return mockGlobalContextRepository
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

const PLANT = {
  key: 'plant_id',
  labelKey: 'plant',
  optionsEndpoint: '/user/plants/',
  isExternal: true,
  valueField: 'plant_id',
  labelField: 'name',
}
const PROGRAM = {
  key: 'program_id',
  labelKey: 'program',
  optionsEndpoint: '/user/programs/',
  isExternal: true,
  valueField: 'program_id',
  dependsOn: 'plant_id',
}

const plantOptions = [
  { value: '102', title: 'North' },
  { value: '103', title: 'South' },
]

function loadedExecution(executionId: string, config: Record<string, unknown>) {
  return { executionId, name: executionId, state: 1, config } as any
}

describe('General store — several DAGs and global context', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    sessionStorage.clear()
    mockConfig.schema = 'planning_dag'
    mockConfig.schemas = []
    mockParameters.globalContext = []
    mockParameters.executionSolvers = ['solver_a']
    mockParameters.solverConfig = { defaultSolver: 'solver_a' }
    mockUserRepository.getUserById.mockResolvedValue({ id: '7', username: 'ana' })
    mockRoleRepository.getAllUserRoleAssignments.mockResolvedValue([])
    mockSchemaRepository.getSchema.mockResolvedValue({ name: 'schema' })
    mockSchemaRepository.getInstanceTables.mockResolvedValue({ t_in: {} })
    mockSchemaRepository.getSolutionTables.mockResolvedValue({ t_out: {} })
  })

  describe('active schema', () => {
    test('a single-DAG deployment stays on config.schema and asks Cornflow nothing', async () => {
      const store = useGeneralStore()

      await store.initializeData()

      expect(mockSchemaRepository.getAvailableSchemaNames).not.toHaveBeenCalled()
      expect(store.getSchemaName).toBe('planning_dag')
      expect(store.availableSchemas).toEqual([])
      expect(store.canSwitchSchema).toBe(false)
      expect(mockSchemaRepository.getSchema).toHaveBeenCalledWith('planning_dag')
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
      store.appConfig.parameters.solverConfig = { defaultSolver: 'from_trim_schema' }

      await store.setActiveSchema('stock_dag')

      expect(store.appConfig.parameters.executionSolvers).toEqual(['solver_a'])
      expect(store.appConfig.parameters.solverConfig.defaultSolver).toBe('solver_a')
    })

    test('refuses a DAG the user may not switch to, and the active one', async () => {
      const store = await storeOnTrimWithBothDags()

      expect(await store.setActiveSchema('other_dag')).toBe(false)
      expect(await store.setActiveSchema('planning_dag')).toBe(false)
      expect(mockSchemaRepository.getSchema).not.toHaveBeenCalled()
    })
  })

  describe('global context', () => {
    test('without dimensions it requests no options and applies no parameters', async () => {
      const store = useGeneralStore()

      await store.initializeData()

      expect(mockGlobalContextRepository.getOptions).not.toHaveBeenCalled()
      expect(store.getGlobalContextParams).toEqual({})
      expect(store.isGlobalContextComplete).toBe(true)
      expect(store.isContextBarVisible).toBe(false)
    })

    test('loads the options for the active DAG and picks the first one', async () => {
      mockParameters.globalContext = [PLANT]
      mockGlobalContextRepository.getOptions.mockResolvedValue(plantOptions)
      const store = useGeneralStore()

      await store.initializeData()

      expect(mockGlobalContextRepository.getOptions).toHaveBeenCalledWith(
        PLANT,
        { schema: 'planning_dag' },
      )
      expect(store.globalContext).toEqual({ plant_id: '102' })
      expect(store.getGlobalContextParams).toEqual({ plant_id: '102' })
      expect(store.getGlobalContextConfig).toEqual({ plant_id: '102' })
      expect(store.isContextBarVisible).toBe(true)
    })

    test('keeps the value picked earlier in the session while it is still offered', async () => {
      mockParameters.globalContext = [PLANT]
      mockGlobalContextRepository.getOptions.mockResolvedValue(plantOptions)
      sessionStorage.setItem(
        'globalContext:planning_dag',
        JSON.stringify({ plant_id: '103' }),
      )
      const store = useGeneralStore()

      await store.loadGlobalContext()

      expect(store.globalContext).toEqual({ plant_id: '103' })
    })

    test('a dimension with allowEmpty starts on "All" and sends no parameter', async () => {
      mockParameters.globalContext = [{ ...PLANT, allowEmpty: true }]
      mockGlobalContextRepository.getOptions.mockResolvedValue(plantOptions)
      const store = useGeneralStore()

      await store.loadGlobalContext()

      expect(store.globalContext).toEqual({ plant_id: null })
      expect(store.getGlobalContextParams).toEqual({})
      expect(store.isGlobalContextComplete).toBe(false)
    })

    test('a dependent dimension receives the value of its parent', async () => {
      mockParameters.globalContext = [PLANT, PROGRAM]
      mockGlobalContextRepository.getOptions.mockImplementation(
        async (dimension: { key: string }) =>
          dimension.key === 'plant_id'
            ? plantOptions
            : [{ value: 1, title: 'Program A' }],
      )
      const store = useGeneralStore()

      await store.loadGlobalContext()

      expect(mockGlobalContextRepository.getOptions).toHaveBeenCalledWith(
        PROGRAM,
        { schema: 'planning_dag', plant_id: '102' },
      )
      expect(store.globalContext).toEqual({ plant_id: '102', program_id: 1 })
    })

    test('picking another value reloads the dependent dimension, the views and the hooks', async () => {
      mockParameters.globalContext = [PLANT, PROGRAM]
      mockGlobalContextRepository.getOptions.mockImplementation(
        async (dimension: { key: string }, params: Record<string, string>) =>
          dimension.key === 'plant_id'
            ? plantOptions
            : [{ value: params.plant_id === '103' ? 2 : 1, title: 'Program' }],
      )
      const store = useGeneralStore()
      await store.loadGlobalContext()
      const uploadKey = store.uploadComponentKey

      const changed = await store.setGlobalContextValue('plant_id', '103')

      expect(changed).toBe(true)
      expect(store.globalContext).toEqual({ plant_id: '103', program_id: 2 })
      expect(JSON.parse(sessionStorage.getItem('globalContext:planning_dag')!)).toEqual({
        plant_id: '103',
        program_id: 2,
      })
      expect(store.uploadComponentKey).toBe(uploadKey + 1)
      expect(mockHooks.globalContextChanged).toHaveBeenCalledWith({
        plant_id: '103',
        program_id: 2,
      })
    })

    test('picking another value closes the loaded executions of another value', async () => {
      mockParameters.globalContext = [PLANT]
      mockGlobalContextRepository.getOptions.mockResolvedValue(plantOptions)
      const store = useGeneralStore()
      await store.loadGlobalContext()
      store.loadedExecutions = [
        loadedExecution('north', { plant_id: '102' }),
        loadedExecution('south', { plant_id: '103' }),
        loadedExecution('no-plant', {}),
      ]
      store.setSelectedExecution('north')

      await store.setGlobalContextValue('plant_id', '103')

      expect(store.loadedExecutions.map((e) => e.executionId)).toEqual([
        'south',
        'no-plant',
      ])
      expect(store.selectedExecution).toBeNull()
    })

    test('refuses a value that is not offered', async () => {
      mockParameters.globalContext = [PLANT]
      mockGlobalContextRepository.getOptions.mockResolvedValue(plantOptions)
      const store = useGeneralStore()
      await store.loadGlobalContext()

      expect(await store.setGlobalContextValue('plant_id', '9999')).toBe(false)
      expect(await store.setGlobalContextValue('plant_id', null)).toBe(false)
      expect(store.globalContext).toEqual({ plant_id: '102' })
    })

    test('the executions list receives the picked values', async () => {
      mockParameters.globalContext = [PLANT]
      mockGlobalContextRepository.getOptions.mockResolvedValue(plantOptions)
      mockExecutionRepository.getExecutions.mockResolvedValue([])
      const store = useGeneralStore()
      await store.loadGlobalContext()

      await store.fetchExecutionsByDateRange(null as any, null as any)

      expect(mockExecutionRepository.getExecutions).toHaveBeenCalledWith(
        'planning_dag',
        null,
        null,
        { plant_id: '102' },
      )
    })

    test('no execution is created while a dimension has no value', async () => {
      mockParameters.globalContext = [{ ...PLANT, allowEmpty: true }]
      mockGlobalContextRepository.getOptions.mockResolvedValue(plantOptions)
      const store = useGeneralStore()
      await store.loadGlobalContext()

      const result = await store.createExecution({} as any)

      expect(result).toBe(false)
      expect(mockExecutionRepository.createExecution).not.toHaveBeenCalled()
    })
  })

  describe('resetSessionState', () => {
    test('empties the session so the next login starts from scratch', async () => {
      mockConfig.schemas = ['planning_dag', 'stock_dag']
      mockParameters.globalContext = [PLANT]
      mockSchemaRepository.getAvailableSchemaNames.mockResolvedValue([
        'planning_dag',
        'stock_dag',
      ])
      mockGlobalContextRepository.getOptions.mockResolvedValue(plantOptions)
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
      expect(store.globalContext).toEqual({})
      expect(store.configurations).toBeNull()
      expect(store.loadedExecutions).toEqual([])
      expect(sessionStorage.getItem('activeSchema')).toBeNull()
      expect(sessionStorage.getItem('globalContext:stock_dag')).toBeNull()
    })

    test('lets initializeData load the next user', async () => {
      const store = useGeneralStore()
      await store.initializeData()
      store.resetSessionState()
      mockUserRepository.getUserById.mockResolvedValue({ id: '8', username: 'luis' })

      await store.initializeData()

      expect(mockUserRepository.getUserById).toHaveBeenCalledTimes(2)
      expect((store.user as { username: string }).username).toBe('luis')
    })
  })
})
