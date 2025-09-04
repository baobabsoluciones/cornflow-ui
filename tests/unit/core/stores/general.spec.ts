import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useGeneralStore } from '@/stores/general'
import { LoadedExecution } from '@/models/LoadedExecution'

// Mock environment variables for consistent testing
Object.defineProperty(import.meta, 'env', {
  value: {
    VITE_APP_BACKEND_URL: 'https://test-backend.com',
    VITE_APP_SCHEMA: 'test_dag',
    VITE_APP_NAME: 'Test App',
    VITE_APP_EXTERNAL_APP: 'false',
    VITE_APP_IS_STAGING_ENVIRONMENT: 'false',
    VITE_APP_USE_HASH_MODE: 'false',
    VITE_APP_DEFAULT_LANGUAGE: 'en',
    VITE_APP_IS_DEVELOPER_MODE: 'false',
    VITE_APP_ENABLE_SIGNUP: 'false',
    VITE_APP_AUTH_TYPE: 'cornflow'
  },
  writable: true
})

// Mock config with proper structure
vi.mock('@/config', () => ({
  default: {
    backend: 'https://test-backend.com',
    schema: 'test_dag',
    name: 'Test App',
    hasExternalApp: false,
    isStagingEnvironment: false,
    useHashMode: false,
    defaultLanguage: 'en',
    isDeveloperMode: false,
    enableSignup: false,
    valuesJsonPath: '/values.json',
    auth: {
      type: 'cornflow',
      clientId: '',
      authority: '',
      redirectUri: '',
      region: '',
      userPoolId: '',
      domain: '',
      providers: []
    },
    initConfig: vi.fn(),
    isMicrosoftConfigured: vi.fn(() => false),
    isGoogleConfigured: vi.fn(() => false),
    getConfiguredOAuthProvider: vi.fn(() => 'none')
  }
}))

// Mock dependencies
vi.mock('@/services/AuthService', () => ({
  default: {
    getUserId: vi.fn()
  }
}))

vi.mock('@/app/config', () => ({
  default: {
    getCore: () => ({
      parameters: {
        schema: 'test_dag',
        executionSolvers: ['solver1', 'solver2'],
        valuesJsonPath: '/values.json'
      }
    }),
    getDashboardRoutes: () => [],
    getDashboardPages: () => [],
    getDashboardLayout: () => ({})
  }
}))

vi.mock('@/utils/assets', () => ({
  mainLogo: 'logo.png',
  fullLogo: 'full_logo.png',
  baobabLogo: 'baobab_full_logo.png',
  baobabLogoSmall: 'baobab_logo.png',
  companyLogo: 'company_logo.png',
  googleLogo: 'google_logo.png',
  microsoftLogo: 'microsoft_logo.png',
  loginBackground: 'login_background.png'
}))

vi.mock('@/plugins/i18n', () => ({
  default: {
    global: {
      locale: { value: 'en' }
    }
  }
}))

vi.mock('@/utils/data_io', () => ({
  toISOStringLocal: vi.fn((date, isEnd) => isEnd ? '2023-01-01T23:59:59.999Z' : '2023-01-01T00:00:00.000Z')
}))

// Mock API client
vi.mock('@/api/Api', () => ({
  default: {
    initializeToken: vi.fn()
  }
}))

// Mock repositories with comprehensive methods
const mockSchemaRepository = {
  getSchema: vi.fn()
}

const mockExecutionRepository = {
  getExecutions: vi.fn(),
  loadExecution: vi.fn(),
  createExecution: vi.fn(),
  uploadSolutionData: vi.fn(),
  deleteExecution: vi.fn(),
  getDataToDownload: vi.fn()
}

const mockInstanceRepository = {
  getInstance: vi.fn(),
  createInstance: vi.fn(),
  launchInstanceDataChecks: vi.fn()
}

const mockUserRepository = {
  getUserById: vi.fn(),
  changePassword: vi.fn()
}

const mockLicenceRepository = {
  getLicences: vi.fn()
}

const mockVersionRepository = {
  getCornflowVersion: vi.fn()
}

vi.mock('@/repositories/SchemaRepository', () => ({
  default: vi.fn(() => mockSchemaRepository)
}))

vi.mock('@/repositories/ExecutionRepository', () => ({
  default: vi.fn(() => mockExecutionRepository)
}))

vi.mock('@/repositories/InstanceRepository', () => ({
  default: vi.fn(() => mockInstanceRepository)
}))

vi.mock('@/repositories/UserRepository', () => ({
  default: vi.fn(() => mockUserRepository)
}))

vi.mock('@/repositories/LicenceRepository', () => ({
  default: vi.fn(() => mockLicenceRepository)
}))

vi.mock('@/repositories/VersionRepository', () => ({
  default: vi.fn(() => mockVersionRepository)
}))

// Mock utility modules
vi.mock('@/utils/tableUtils', () => ({
  getTableDataNames: vi.fn(),
  getHeadersFromData: vi.fn(),
  getTableHeadersData: vi.fn(),
  getConfigTableHeadersData: vi.fn(),
  getConfigTableData: vi.fn()
}))

vi.mock('@/utils/filterUtils', () => ({
  getFilterNames: vi.fn()
}))

describe('General Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('State', () => {
    test('initial state is correct', () => {
      const store = useGeneralStore()
      
      expect(store.notifications).toEqual([])
      expect(store.user).toEqual({})
      expect(store.schema).toBe('')
      expect(store.schemaConfig).toEqual({})
      expect(store.lastExecutions).toEqual([])
      expect(store.loadedExecutions).toEqual([])
      expect(store.selectedExecution).toBeNull()
      expect(store.autoLoadInterval).toBeNull()
      expect(store.uploadComponentKey).toBe(0)
      expect(store.tabBarKey).toBe(0)
      expect(store.cornflowVersion).toBe('')
    })
  })

  describe('Actions - Core Functionality', () => {
    test('initializeData fetches required data', async () => {
      const store = useGeneralStore()
      const userId = 'test-user-id'
      const version = '1.0.0'
      const user = { id: userId, name: 'Test User' }
      
      const session = await import('@/services/AuthService')
      vi.mocked(session.default.getUserId).mockReturnValue(userId)
      mockUserRepository.getUserById.mockResolvedValue(user)
      mockVersionRepository.getCornflowVersion.mockResolvedValue(version)
      mockSchemaRepository.getSchema.mockResolvedValue({})
      mockLicenceRepository.getLicences.mockResolvedValue([])

      await store.initializeData()

      expect(session.default.getUserId).toHaveBeenCalled()
      expect(mockUserRepository.getUserById).toHaveBeenCalledWith(userId)
      expect(mockVersionRepository.getCornflowVersion).toHaveBeenCalled()
      expect(mockSchemaRepository.getSchema).toHaveBeenCalled()
      expect(mockLicenceRepository.getLicences).toHaveBeenCalled()
      expect(store.user).toEqual(user)
      expect(store.cornflowVersion).toBe(version)
    })

    test('fetchUser fetches and sets user data', async () => {
      const store = useGeneralStore()
      const userId = 'test-user-id'
      const user = { id: userId, name: 'Test User' }
      
      const session = await import('@/services/AuthService')
      vi.mocked(session.default.getUserId).mockReturnValue(userId)
      mockUserRepository.getUserById.mockResolvedValue(user)

      await store.fetchUser()

      expect(session.default.getUserId).toHaveBeenCalled()
      expect(mockUserRepository.getUserById).toHaveBeenCalledWith(userId)
      expect(store.user).toEqual(user)
    })

    test('fetchCornflowVersion from version repository', async () => {
      mockVersionRepository.getCornflowVersion.mockResolvedValue('1.0.0')
      
      const store = useGeneralStore()
      await store.fetchCornflowVersion()
      
      expect(store.cornflowVersion).toBe('1.0.0')
      expect(mockVersionRepository.getCornflowVersion).toHaveBeenCalledTimes(1)
    })

    test('fetchLicences successfully', async () => {
      const mockLicences = [{ id: 1, name: 'MIT' }, { id: 2, name: 'Apache' }]
      mockLicenceRepository.getLicences.mockResolvedValue(mockLicences)
      
      const store = useGeneralStore()
      await store.fetchLicences()
      
      expect(store.licences).toEqual(mockLicences)
      expect(mockLicenceRepository.getLicences).toHaveBeenCalledTimes(1)
    })

    test('changeUserPassword successfully', async () => {
      mockUserRepository.changePassword.mockResolvedValue(true)
      
      const store = useGeneralStore()
      const result = await store.changeUserPassword('user123', 'newpassword')
      
      expect(result).toBe(true)
      expect(mockUserRepository.changePassword).toHaveBeenCalledWith('user123', 'newpassword')
    })

    test('setSchema successfully', async () => {
      const mockSchema = { type: 'object', properties: {} }
      mockSchemaRepository.getSchema.mockResolvedValue(mockSchema)
      
      const store = useGeneralStore()
      await store.setSchema()
      
      expect(store.schemaConfig).toEqual(mockSchema)
      expect(mockSchemaRepository.getSchema).toHaveBeenCalledWith('test_dag')
    })
  })

  describe('Actions - Execution Management', () => {
    test('fetchExecutionsByDateRange with dates', async () => {
      const mockExecutions = [{ id: '1', name: 'Execution 1' }]
      mockExecutionRepository.getExecutions.mockResolvedValue(mockExecutions)
      
      const store = useGeneralStore()
      const fromDate = new Date('2023-01-01')
      const toDate = new Date('2023-01-31')
      
      const result = await store.fetchExecutionsByDateRange(fromDate, toDate)
      
      expect(result).toEqual(mockExecutions)
      expect(mockExecutionRepository.getExecutions).toHaveBeenCalledWith(
        'test_dag',
        '2023-01-01T00:00:00.000Z',
        '2023-01-01T23:59:59.999Z'
      )
    })

    test('fetchExecutionsByDateRange without dates', async () => {
      const mockExecutions = [{ id: '1', name: 'Execution 1' }]
      mockExecutionRepository.getExecutions.mockResolvedValue(mockExecutions)
      
      const store = useGeneralStore()
      const result = await store.fetchExecutionsByDateRange(null as any, null as any)
      
      expect(result).toEqual(mockExecutions)
      expect(mockExecutionRepository.getExecutions).toHaveBeenCalledWith(
        'test_dag',
        null,
        null
      )
    })

    test('fetchLoadedExecution successfully', async () => {
      const mockLoadedExecution = { executionId: '123', name: 'Test Execution' }
      mockExecutionRepository.loadExecution.mockResolvedValue(mockLoadedExecution)
      
      const store = useGeneralStore()
      vi.spyOn(store, 'addLoadedExecution').mockImplementation(() => {})
      
      const result = await store.fetchLoadedExecution('123')
      
      expect(result).toBe(true)
      expect(mockExecutionRepository.loadExecution).toHaveBeenCalledWith('123')
      expect(store.addLoadedExecution).toHaveBeenCalledWith(mockLoadedExecution)
    })

    test('fetchLoadedExecution returns false when execution is null', async () => {
      mockExecutionRepository.loadExecution.mockResolvedValue(null)
      
      const store = useGeneralStore()
      const result = await store.fetchLoadedExecution('123')
      
      expect(result).toBe(false)
    })

    test('createExecution successfully', async () => {
      const mockExecution = { id: '456', name: 'Test Execution' }
      const mockNewExecution = { id: '789', name: 'New Execution' }
      mockExecutionRepository.createExecution.mockResolvedValue(mockNewExecution)
      
      const store = useGeneralStore()
      const result = await store.createExecution(mockExecution, 'param=value')
      
      expect(result).toEqual(mockNewExecution)
      expect(mockExecutionRepository.createExecution).toHaveBeenCalledWith(mockExecution, 'param=value')
    })

    test('uploadSolutionData successfully', async () => {
      mockExecutionRepository.uploadSolutionData.mockResolvedValue(undefined)
      
      const store = useGeneralStore()
      const result = await store.uploadSolutionData('123', { solution: 'data' })
      
      expect(result).toBe(true)
      expect(mockExecutionRepository.uploadSolutionData).toHaveBeenCalledWith('123', { solution: 'data' })
    })

    test('deleteExecution and update store state', async () => {
      mockExecutionRepository.deleteExecution.mockResolvedValue(true)
      
      const store = useGeneralStore()
      store.lastExecutions = [
        { id: '123', name: 'Execution 1' },
        { id: '456', name: 'Execution 2' }
      ] as any[]
      
      store.loadedExecutions = [
        { executionId: '123', name: 'Loaded 1' },
        { executionId: '456', name: 'Loaded 2' }
      ] as LoadedExecution[]
      
      const result = await store.deleteExecution('123')
      
      expect(result).toBe(true)
      expect(store.lastExecutions).toHaveLength(1)
      expect(store.lastExecutions[0].id).toBe('456')
      expect(store.loadedExecutions).toHaveLength(1)
      expect(store.loadedExecutions[0].executionId).toBe('456')
    })

    test('deleteExecution does not update store state when deletion fails', async () => {
      mockExecutionRepository.deleteExecution.mockResolvedValue(false)
      
      const store = useGeneralStore()
      store.lastExecutions = [{ id: '123', name: 'Execution 1' }] as any[]
      store.loadedExecutions = [{ executionId: '123', name: 'Loaded 1' }] as LoadedExecution[]
      
      await store.deleteExecution('123')
      
      expect(store.lastExecutions).toHaveLength(1)
      expect(store.loadedExecutions).toHaveLength(1)
    })

    test('addLoadedExecution adds new execution', () => {
      const store = useGeneralStore()
      const loadedExecution = { executionId: '123', name: 'Test Execution' } as LoadedExecution
      
      store.addLoadedExecution(loadedExecution)
      
      expect(store.loadedExecutions).toHaveLength(1)
      expect(store.loadedExecutions[0]).toEqual(loadedExecution)
    })

    test('addLoadedExecution replaces existing execution', () => {
      const store = useGeneralStore()
      const existingExecution = { executionId: '123', name: 'Old Execution' } as LoadedExecution
      const newExecution = { executionId: '123', name: 'New Execution' } as LoadedExecution
      
      store.loadedExecutions = [existingExecution]
      store.addLoadedExecution(newExecution)
      
      expect(store.loadedExecutions).toHaveLength(1)
      expect(store.loadedExecutions[0].name).toBe('New Execution')
    })

    test('setSelectedExecution updates selected execution', () => {
      const store = useGeneralStore()
      const execution = { executionId: '1', name: 'Test' }
      store.loadedExecutions = [execution]

      store.setSelectedExecution(execution.executionId)
      expect(store.selectedExecution).toEqual(execution)

      store.setSelectedExecution(null)
      expect(store.selectedExecution).toBeNull()
    })
  })

  describe('Actions - Instance Management', () => {
    test('createInstance successfully', async () => {
      const mockResponse = { id: '123', data: {} }
      mockInstanceRepository.createInstance.mockResolvedValue(mockResponse)
      
      const store = useGeneralStore()
      const result = await store.createInstance({ name: 'Test Instance' })
      
      expect(result).toEqual(mockResponse)
      expect(mockInstanceRepository.createInstance).toHaveBeenCalledWith({ name: 'Test Instance' })
    })

    test('getInstanceById successfully', async () => {
      const mockInstance = { id: '123', data: {} }
      mockInstanceRepository.getInstance.mockResolvedValue(mockInstance)
      
      const store = useGeneralStore()
      const result = await store.getInstanceById('123')
      
      expect(result).toEqual(mockInstance)
      expect(mockInstanceRepository.getInstance).toHaveBeenCalledWith('123')
    })

    test('getInstanceDataChecksById successfully with success state', async () => {
      const mockDataChecks = { id: 'exec123' }
      const mockExecution = { state: 1 }
      const mockInstance = { id: '123', data: {} }
      
      mockInstanceRepository.launchInstanceDataChecks.mockResolvedValue(mockDataChecks)
      mockExecutionRepository.loadExecution.mockResolvedValue(mockExecution)
      mockInstanceRepository.getInstance.mockResolvedValue(mockInstance)
      
      const store = useGeneralStore()
      const result = await store.getInstanceDataChecksById('123')
      
      expect(result).toEqual(mockInstance)
      expect(mockInstanceRepository.launchInstanceDataChecks).toHaveBeenCalledWith('123')
      expect(mockExecutionRepository.loadExecution).toHaveBeenCalledWith('exec123')
      expect(mockInstanceRepository.getInstance).toHaveBeenCalledWith('123')
    })

    test('getInstanceDataChecksById with running execution waits and succeeds', async () => {
      const mockDataChecks = { id: 'exec123' }
      const runningExecution = { state: 0 }
      const completedExecution = { state: 1 }
      const mockInstance = { id: '123', data: {} }
      
      mockInstanceRepository.launchInstanceDataChecks.mockResolvedValue(mockDataChecks)
      mockExecutionRepository.loadExecution
        .mockResolvedValueOnce(runningExecution)
        .mockResolvedValueOnce(completedExecution)
      mockInstanceRepository.getInstance.mockResolvedValue(mockInstance)
      
      const store = useGeneralStore()
      
      // Use fake timers to control setTimeout
      vi.useFakeTimers()
      
      const resultPromise = store.getInstanceDataChecksById('123')
      
      // Advance timers to trigger the timeout
      await vi.advanceTimersByTimeAsync(3000)
      
      const result = await resultPromise
      
      expect(result).toEqual(mockInstance)
      expect(mockExecutionRepository.loadExecution).toHaveBeenCalledTimes(2)
      
      vi.useRealTimers()
    })

    test('getInstanceDataChecksById with failed execution returns null', async () => {
      const mockDataChecks = { id: 'exec123' }
      const failedExecution = { state: -1 }
      
      mockInstanceRepository.launchInstanceDataChecks.mockResolvedValue(mockDataChecks)
      mockExecutionRepository.loadExecution.mockResolvedValue(failedExecution)
      
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      
      const store = useGeneralStore()
      const result = await store.getInstanceDataChecksById('123')
      
      expect(result).toBeNull()
      expect(consoleSpy).toHaveBeenCalledWith('Data checks failed with execution state: -1')
      
      consoleSpy.mockRestore()
    })

    test('getInstanceDataChecksById handles error', async () => {
      mockInstanceRepository.launchInstanceDataChecks.mockRejectedValue(new Error('Data checks error'))
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      const store = useGeneralStore()
      const result = await store.getInstanceDataChecksById('123')
      
      expect(result).toBeNull()
      expect(consoleSpy).toHaveBeenCalledWith('Error getting instance data checks', expect.any(Error))
      
      consoleSpy.mockRestore()
    })
  })

  describe('Actions - Notification Management', () => {
    test('addNotification adds notification to store', () => {
      const store = useGeneralStore()
      const notification = { message: 'Test message', type: 'success' as const }
      
      store.addNotification(notification)
      
      expect(store.notifications).toHaveLength(1)
      expect(store.notifications[0]).toEqual(notification)
    })

    test('removeNotification removes notification by index', () => {
      const store = useGeneralStore()
      const notification1 = { message: 'Message 1', type: 'success' as const }
      const notification2 = { message: 'Message 2', type: 'error' as const }
      
      store.notifications = [notification1, notification2]
      store.removeNotification(0)
      
      expect(store.notifications).toHaveLength(1)
      expect(store.notifications[0]).toEqual(notification2)
    })

    test('resetNotifications clears all notifications', () => {
      const store = useGeneralStore()
      store.notifications = [
        { message: 'Message 1', type: 'success' as const },
        { message: 'Message 2', type: 'error' as const }
      ]
      
      store.resetNotifications()
      
      expect(store.notifications).toHaveLength(0)
    })
  })

  describe('Actions - Component Key Management', () => {
    test('incrementUploadComponentKey increments key', () => {
      const store = useGeneralStore()
      const initialKey = store.uploadComponentKey
      
      store.incrementUploadComponentKey()
      
      expect(store.uploadComponentKey).toBe(initialKey + 1)
    })

    test('incrementTabBarKey increments and returns key', () => {
      const store = useGeneralStore()
      const initialKey = store.tabBarKey
      
      const returnedKey = store.incrementTabBarKey()
      
      expect(returnedKey).toBe(initialKey)
      expect(store.tabBarKey).toBe(initialKey + 1)
    })
  })

  describe('Actions - Loaded Execution Management', () => {
    test('removeLoadedExecution removes execution by index', () => {
      const store = useGeneralStore()
      const execution1 = { executionId: '1', name: 'Execution 1' } as LoadedExecution
      const execution2 = { executionId: '2', name: 'Execution 2' } as LoadedExecution
      
      store.loadedExecutions = [execution1, execution2]
      store.removeLoadedExecution(0)
      
      expect(store.loadedExecutions).toHaveLength(1)
      expect(store.loadedExecutions[0]).toEqual(execution2)
    })

    test('resetLoadedExecutions clears all loaded executions', () => {
      const store = useGeneralStore()
      store.loadedExecutions = [
        { executionId: '1', name: 'Execution 1' } as LoadedExecution,
        { executionId: '2', name: 'Execution 2' } as LoadedExecution
      ]
      
      store.resetLoadedExecutions()
      
      expect(store.loadedExecutions).toHaveLength(0)
    })
  })

  describe('Actions - Table and Filter Utilities', () => {
    test('getTableDataNames delegates to tableUtils', async () => {
      const store = useGeneralStore()
      const mockTableUtils = await import('@/utils/tableUtils')
      const mockResult = ['table1', 'table2']
      vi.mocked(mockTableUtils.getTableDataNames).mockReturnValue(mockResult)
      
      const result = store.getTableDataNames('collection', {}, 'en')
      
      expect(mockTableUtils.getTableDataNames).toHaveBeenCalledWith(store.schemaConfig, 'collection', {}, 'en')
      expect(result).toEqual(mockResult)
    })

    test('getHeadersFromData delegates to tableUtils', async () => {
      const store = useGeneralStore()
      const mockTableUtils = await import('@/utils/tableUtils')
      const mockData = { headers: ['col1', 'col2'] }
      const mockResult = [{ text: 'col1' }, { text: 'col2' }]
      vi.mocked(mockTableUtils.getHeadersFromData).mockReturnValue(mockResult)
      
      const result = store.getHeadersFromData(mockData)
      
      expect(mockTableUtils.getHeadersFromData).toHaveBeenCalledWith(mockData)
      expect(result).toEqual(mockResult)
    })

    test('getTableHeadersData delegates to tableUtils', async () => {
      const store = useGeneralStore()
      const mockTableUtils = await import('@/utils/tableUtils')
      const mockResult = [{ header: 'col1' }]
      vi.mocked(mockTableUtils.getTableHeadersData).mockReturnValue(mockResult)
      
      const result = store.getTableHeadersData('collection', 'table', 'en')
      
      expect(mockTableUtils.getTableHeadersData).toHaveBeenCalledWith(store.schemaConfig, 'collection', 'table', 'en')
      expect(result).toEqual(mockResult)
    })

    test('getConfigTableHeadersData delegates to tableUtils', async () => {
      const store = useGeneralStore()
      const mockTableUtils = await import('@/utils/tableUtils')
      const mockResult = [{ header: 'config' }]
      vi.mocked(mockTableUtils.getConfigTableHeadersData).mockReturnValue(mockResult)
      
      const result = store.getConfigTableHeadersData()
      
      expect(mockTableUtils.getConfigTableHeadersData).toHaveBeenCalled()
      expect(result).toEqual(mockResult)
    })

    test('getConfigTableData delegates to tableUtils', async () => {
      const store = useGeneralStore()
      const mockTableUtils = await import('@/utils/tableUtils')
      const mockResult = [{ data: 'value' }]
      const mockData = { config: 'test' }
      vi.mocked(mockTableUtils.getConfigTableData).mockReturnValue(mockResult)
      
      const result = store.getConfigTableData(mockData, 'collection', 'table', 'en')
      
      expect(mockTableUtils.getConfigTableData).toHaveBeenCalledWith(store.schemaConfig, mockData, 'collection', 'table', 'en')
      expect(result).toEqual(mockResult)
    })

    test('getFilterNames delegates to filterUtils', async () => {
      const store = useGeneralStore()
      const mockFilterUtils = await import('@/utils/filterUtils')
      const mockResult = { filter1: 'value1' }
      vi.mocked(mockFilterUtils.getFilterNames).mockReturnValue(mockResult)
      
      const result = store.getFilterNames('collection', 'table', 'type', 'en')
      
      expect(mockFilterUtils.getFilterNames).toHaveBeenCalledWith(
        store.schemaConfig, 
        store.selectedExecution, 
        'collection', 
        'table', 
        'type', 
        'en'
      )
      expect(result).toEqual(mockResult)
    })
  })

  describe('Getters', () => {
    test('getSchemaName returns correct schema name', () => {
      const store = useGeneralStore()
      expect(store.getSchemaName).toBe('test_dag')
    })

    test('getExecutionSolvers returns solvers from schema config', () => {
      const store = useGeneralStore()
      store.schemaConfig = {
        config: {
          properties: {
            solver: {
              enum: ['custom-solver1', 'custom-solver2']
            }
          }
        }
      } as any
      
      const solvers = store.getExecutionSolvers
      expect(solvers).toEqual(['custom-solver1', 'custom-solver2'])
    })

    test('getExecutionSolvers falls back to app config solvers when schema has no solvers', () => {
      const store = useGeneralStore()
      store.schemaConfig = { 
        config: {
          properties: {}
        }
      } as any
      
      const solvers = store.getExecutionSolvers
      expect(solvers).toEqual(['solver1', 'solver2'])
    })

    test('getLoadedExecutionTabs returns formatted execution tabs with correct icons and loading states', () => {
      const store = useGeneralStore()
      store.loadedExecutions = [
        { executionId: '1', name: 'Completed', state: 1 },
        { executionId: '2', name: 'Running', state: 0 },
        { executionId: '3', name: 'Failed', state: -1 },
        { executionId: '4', name: 'Not Run', state: -4 },
        { executionId: '5', name: 'Queued', state: -7 }
      ] as LoadedExecution[]
      
      const tabs = store.getLoadedExecutionTabs
      
      expect(tabs).toHaveLength(5)
      expect(tabs[0]).toEqual({
        value: '1',
        text: 'Completed',
        icon: 'mdi-checkbox-marked',
        loading: false,
        selected: false
      })
      expect(tabs[1]).toEqual({
        value: '2',
        text: 'Running',
        icon: 'mdi-loading',
        loading: true,
        selected: false
      })
      expect(tabs[2]).toEqual({
        value: '3',
        text: 'Failed',
        icon: 'mdi-close-box',
        loading: false,
        selected: false
      })
      expect(tabs[3]).toEqual({
        value: '4',
        text: 'Not Run',
        icon: 'mdi-checkbox-marked',
        loading: false,
        selected: false
      })
      expect(tabs[4]).toEqual({
        value: '5',
        text: 'Queued',
        icon: 'mdi-loading',
        loading: true,
        selected: false
      })
    })

    test('getNotifications returns notifications array', () => {
      const store = useGeneralStore()
      const notifications = [
        { message: 'Test 1', type: 'success' as const },
        { message: 'Test 2', type: 'error' as const }
      ]
      store.notifications = notifications
      
      expect(store.getNotifications).toEqual(notifications)
    })

    test('getLogo returns logo asset', () => {
      const store = useGeneralStore()
      expect(store.getLogo).toBe('logo.png')
    })

    test('getUser returns user object', () => {
      const store = useGeneralStore()
      const user = { id: '123', name: 'Test User' }
      store.user = user
      
      expect(store.getUser).toEqual(user)
    })

    test('getLicences returns licences array', () => {
      const store = useGeneralStore()
      const licences = [{ id: 1, name: 'MIT' }]
      store.licences = licences
      
      expect(store.getLicences).toEqual(licences)
    })

    test('getSchemaConfig returns schema config object', () => {
      const store = useGeneralStore()
      const schemaConfig = { type: 'object', properties: {} }
      store.schemaConfig = schemaConfig as any
      
      expect(store.getSchemaConfig).toEqual(schemaConfig)
    })
  })

  describe('Error Handling', () => {
    test('fetchUser handles error gracefully', async () => {
      const store = useGeneralStore()
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      const session = await import('@/services/AuthService')
      vi.mocked(session.default.getUserId).mockReturnValue('test-user-id')
      mockUserRepository.getUserById.mockRejectedValue(new Error('Failed to get user'))

      await store.fetchUser()

      expect(consoleError).toHaveBeenCalledWith('Error getting user', expect.any(Error))
      expect(store.user).toEqual({})

      consoleError.mockRestore()
    })

    test('fetchCornflowVersion handles error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockVersionRepository.getCornflowVersion.mockRejectedValue(new Error('Version error'))
      
      const store = useGeneralStore()
      await store.fetchCornflowVersion()
      
      expect(consoleSpy).toHaveBeenCalledWith('Error getting cornflow version', expect.any(Error))
      consoleSpy.mockRestore()
    })

    test('fetchLicences handles error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockLicenceRepository.getLicences.mockRejectedValue(new Error('Licences error'))
      
      const store = useGeneralStore()
      await store.fetchLicences()
      
      expect(consoleSpy).toHaveBeenCalledWith('Error getting licences', expect.any(Error))
      consoleSpy.mockRestore()
    })

    test('changeUserPassword handles error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockUserRepository.changePassword.mockRejectedValue(new Error('Password error'))
      
      const store = useGeneralStore()
      const result = await store.changeUserPassword('user123', 'newpassword')
      
      expect(result).toBe(false)
      expect(consoleSpy).toHaveBeenCalledWith('Error changing password', expect.any(Error))
      consoleSpy.mockRestore()
    })

    test('setSchema handles error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockSchemaRepository.getSchema.mockRejectedValue(new Error('Schema error'))
      
      const store = useGeneralStore()
      await store.setSchema()
      
      expect(consoleSpy).toHaveBeenCalledWith('Error getting schema', expect.any(Error))
      consoleSpy.mockRestore()
    })

    test('fetchExecutionsByDateRange handles error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockExecutionRepository.getExecutions.mockRejectedValue(new Error('Executions error'))
      
      const store = useGeneralStore()
      const result = await store.fetchExecutionsByDateRange(new Date(), new Date())
      
      expect(result).toBeUndefined()
      expect(consoleSpy).toHaveBeenCalledWith('Error getting executions by date range', expect.any(Error))
      consoleSpy.mockRestore()
    })

    test('fetchLoadedExecution handles error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockExecutionRepository.loadExecution.mockRejectedValue(new Error('Load execution error'))
      
      const store = useGeneralStore()
      const result = await store.fetchLoadedExecution('123')
      
      expect(result).toBeUndefined()
      expect(consoleSpy).toHaveBeenCalledWith('Error getting loaded execution', expect.any(Error))
      consoleSpy.mockRestore()
    })

    test('createInstance handles error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockInstanceRepository.createInstance.mockRejectedValue(new Error('Create instance error'))
      
      const store = useGeneralStore()
      const result = await store.createInstance({ name: 'Test Instance' })
      
      expect(result).toBe(false)
      expect(consoleSpy).toHaveBeenCalledWith('Error creating instance', expect.any(Error))
      consoleSpy.mockRestore()
    })

    test('getInstanceById handles error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockInstanceRepository.getInstance.mockRejectedValue(new Error('Get instance error'))
      
      const store = useGeneralStore()
      const result = await store.getInstanceById('123')
      
      expect(result).toBeUndefined()
      expect(consoleSpy).toHaveBeenCalledWith('Error getting instance', expect.any(Error))
      consoleSpy.mockRestore()
    })

    test('createExecution handles error and returns false', async () => {
      const store = useGeneralStore()
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      const execution = { id: '1', name: 'Test Execution' }

      mockExecutionRepository.createExecution.mockRejectedValue(new Error('Failed to create'))

      const result = await store.createExecution(execution)

      expect(result).toBe(false)
      expect(consoleError).toHaveBeenCalledWith('Error creating execution', expect.any(Error))

      consoleError.mockRestore()
    })

    test('uploadSolutionData handles error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockExecutionRepository.uploadSolutionData.mockRejectedValue(new Error('Upload error'))
      
      const store = useGeneralStore()
      const result = await store.uploadSolutionData('123', { solution: 'data' })
      
      expect(result).toBe(false)
      expect(consoleSpy).toHaveBeenCalledWith('Error uploading solution data:', expect.any(Error))
      consoleSpy.mockRestore()
    })

    test('deleteExecution handles error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockExecutionRepository.deleteExecution.mockRejectedValue(new Error('Delete error'))
      
      const store = useGeneralStore()
      const result = await store.deleteExecution('123')
      
      expect(result).toBeUndefined()
      expect(consoleSpy).toHaveBeenCalledWith('Error deleting execution', expect.any(Error))
      consoleSpy.mockRestore()
    })

    test('getDataToDownload calls repository method correctly', async () => {
      const store = useGeneralStore()
      mockExecutionRepository.getDataToDownload.mockResolvedValue(undefined)
      
      await store.getDataToDownload('123', false, false)
      
      expect(mockExecutionRepository.getDataToDownload).toHaveBeenCalledWith('123', false, false)
    })

    test('getDataToDownload with only solution', async () => {
      const store = useGeneralStore()
      mockExecutionRepository.getDataToDownload.mockResolvedValue(undefined)
      
      await store.getDataToDownload('123', true, false)
      
      expect(mockExecutionRepository.getDataToDownload).toHaveBeenCalledWith('123', true, false)
    })

    test('getDataToDownload with only instance', async () => {
      const store = useGeneralStore()
      mockExecutionRepository.getDataToDownload.mockResolvedValue(undefined)
      
      await store.getDataToDownload('123', false, true)
      
      expect(mockExecutionRepository.getDataToDownload).toHaveBeenCalledWith('123', false, true)
    })

    test('getDataToDownload handles error', async () => {
      const store = useGeneralStore()
      const error = new Error('Download error')
      mockExecutionRepository.getDataToDownload.mockRejectedValue(error)
      
      await expect(store.getDataToDownload('123')).rejects.toThrow('Download error')
    })
  })

  describe('Auto-loading functionality', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    test('autoLoadExecutions updates running executions periodically', async () => {
      const store = useGeneralStore()
      const execution = { executionId: '1', name: 'Test', state: 0 }
      const updatedExecution = { ...execution, state: 1 }

      store.loadedExecutions = [execution]
      mockExecutionRepository.loadExecution.mockResolvedValue(updatedExecution)

      store.autoLoadExecutions()
      
      await vi.advanceTimersByTimeAsync(4000)

      expect(mockExecutionRepository.loadExecution).toHaveBeenCalledWith(execution.executionId)
      expect(store.loadedExecutions[0]).toEqual(updatedExecution)
    })

    test('autoLoadExecutions clears previous interval', () => {
      const store = useGeneralStore()
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval')

      store.autoLoadInterval = 123 as any
      store.autoLoadExecutions()

      expect(clearIntervalSpy).toHaveBeenCalledWith(123)
    })
  })
})
