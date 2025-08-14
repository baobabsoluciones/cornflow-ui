import { describe, test, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useGeneralStore } from '@/stores/general'
import session from '@/services/AuthService'
import config from '@/app/config'
import SchemaRepository from '@/repositories/SchemaRepository'
import UserRepository from '@/repositories/UserRepository'
import ExecutionRepository from '@/repositories/ExecutionRepository'
import InstanceRepository from '@/repositories/InstanceRepository'
import LicenceRepository from '@/repositories/LicenceRepository'
import VersionRepository from '@/repositories/VersionRepository'

// Mock all repositories
vi.mock('@/repositories/SchemaRepository')
vi.mock('@/repositories/UserRepository')
vi.mock('@/repositories/ExecutionRepository')
vi.mock('@/repositories/InstanceRepository')
vi.mock('@/repositories/LicenceRepository')
vi.mock('@/repositories/VersionRepository')

// Mock auth service
vi.mock('@/services/AuthService', () => ({
  default: {
    getUserId: vi.fn()
  }
}))

// Mock config
vi.mock('@/app/config', () => ({
  default: {
    getCore: vi.fn(() => ({
      parameters: {
        schema: 'test-schema',
        executionSolvers: ['solver1', 'solver2']
      }
    })),
    getDashboardRoutes: vi.fn(() => []),
    getDashboardPages: vi.fn(() => []),
    getDashboardLayout: vi.fn(() => ({}))
  }
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

  describe('Actions', () => {
    test('initializeData fetches required data', async () => {
      const store = useGeneralStore()
      const userId = 'test-user-id'
      const version = '1.0.0'
      const user = { id: userId, name: 'Test User' }
      
      vi.mocked(session.getUserId).mockResolvedValue(userId)
      vi.mocked(UserRepository.prototype.getUserById).mockResolvedValue(user)
      vi.mocked(VersionRepository.prototype.getCornflowVersion).mockResolvedValue(version)
      vi.mocked(SchemaRepository.prototype.getSchema).mockResolvedValue({})
      vi.mocked(LicenceRepository.prototype.getLicences).mockResolvedValue([])

      await store.initializeData()

      expect(session.getUserId).toHaveBeenCalled()
      expect(UserRepository.prototype.getUserById).toHaveBeenCalledWith(userId)
      expect(VersionRepository.prototype.getCornflowVersion).toHaveBeenCalled()
      expect(SchemaRepository.prototype.getSchema).toHaveBeenCalled()
      expect(LicenceRepository.prototype.getLicences).toHaveBeenCalled()
      expect(store.user).toEqual(user)
      expect(store.cornflowVersion).toBe(version)
    })

    test('fetchExecutionsByDateRange returns executions for date range', async () => {
      const store = useGeneralStore()
      const fromDate = new Date('2024-01-01')
      const toDate = new Date('2024-01-31')
      const executions = [
        { id: '1', name: 'Execution 1' },
        { id: '2', name: 'Execution 2' }
      ]

      vi.mocked(ExecutionRepository.prototype.getExecutions).mockResolvedValue(executions)

      const result = await store.fetchExecutionsByDateRange(fromDate, toDate)

      expect(ExecutionRepository.prototype.getExecutions).toHaveBeenCalledWith(
        'test-schema',
        expect.any(String),
        expect.any(String)
      )
      expect(result).toEqual(executions)
    })

    test('createExecution creates new execution', async () => {
      const store = useGeneralStore()
      const execution = { id: '1', name: 'Test Execution' }
      const params = 'test-params'
      const newExecution = { ...execution, status: 'created' }

      vi.mocked(ExecutionRepository.prototype.createExecution).mockResolvedValue(newExecution)

      const result = await store.createExecution(execution, params)

      expect(ExecutionRepository.prototype.createExecution).toHaveBeenCalledWith(execution, params)
      expect(result).toEqual(newExecution)
    })

    test('deleteExecution removes execution from lists', async () => {
      const store = useGeneralStore()
      const executionId = 'test-id'
      store.lastExecutions = [{ id: executionId, name: 'Test' }]
      store.loadedExecutions = [{ executionId, name: 'Test' }]

      vi.mocked(ExecutionRepository.prototype.deleteExecution).mockResolvedValue(true)

      await store.deleteExecution(executionId)

      expect(ExecutionRepository.prototype.deleteExecution).toHaveBeenCalledWith(executionId)
      expect(store.lastExecutions).toEqual([])
      expect(store.loadedExecutions).toEqual([])
    })

    test('addLoadedExecution updates existing execution', () => {
      const store = useGeneralStore()
      const execution = { executionId: '1', name: 'Test', state: 0 }
      const updatedExecution = { ...execution, state: 1 }

      store.loadedExecutions = [execution]
      store.addLoadedExecution(updatedExecution)

      expect(store.loadedExecutions).toHaveLength(1)
      expect(store.loadedExecutions[0]).toEqual(updatedExecution)
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

  describe('Getters', () => {
    test('getSchemaName returns correct schema name', () => {
      const store = useGeneralStore()
      expect(store.getSchemaName).toBe('test-schema')
    })

    test('getExecutionSolvers returns solvers from schema config', () => {
      const store = useGeneralStore()
      const schemaConfigSolvers = ['solver3', 'solver4']
      store.schemaConfig = {
        config: {
          properties: {
            solver: {
              enum: schemaConfigSolvers
            }
          }
        }
      }

      expect(store.getExecutionSolvers).toEqual(schemaConfigSolvers)
    })

    test('getExecutionSolvers falls back to config solvers when schema config is empty', () => {
      const store = useGeneralStore()
      store.schemaConfig = {}

      expect(store.getExecutionSolvers).toEqual(['solver1', 'solver2'])
    })

    test('getLoadedExecutionTabs returns formatted execution tabs', () => {
      const store = useGeneralStore()
      const executions = [
        { executionId: '1', name: 'Success', state: 1 },
        { executionId: '2', name: 'Running', state: 0 },
        { executionId: '3', name: 'Failed', state: -1 }
      ]
      store.loadedExecutions = executions

      const tabs = store.getLoadedExecutionTabs
      expect(tabs).toHaveLength(3)
      expect(tabs[0].icon).toBe('mdi-checkbox-marked')
      expect(tabs[1].loading).toBe(true)
      expect(tabs[2].icon).toBe('mdi-close-box')
    })
  })

  describe('Error Handling', () => {
    test('fetchUser handles error gracefully', async () => {
      const store = useGeneralStore()
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      vi.mocked(session.getUserId).mockRejectedValue(new Error('Failed to get user'))

      await store.fetchUser()

      expect(consoleError).toHaveBeenCalledWith('Error getting user', expect.any(Error))
      expect(store.user).toEqual({})

      consoleError.mockRestore()
    })

    test('createExecution handles error and returns false', async () => {
      const store = useGeneralStore()
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      const execution = { id: '1', name: 'Test Execution' }

      vi.mocked(ExecutionRepository.prototype.createExecution).mockRejectedValue(new Error('Failed to create'))

      const result = await store.createExecution(execution)

      expect(result).toBe(false)
      expect(consoleError).toHaveBeenCalledWith('Error creating execution', expect.any(Error))

      consoleError.mockRestore()
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
      vi.mocked(ExecutionRepository.prototype.loadExecution).mockResolvedValue(updatedExecution)

      store.autoLoadExecutions()
      
      await vi.advanceTimersByTimeAsync(4000)

      expect(ExecutionRepository.prototype.loadExecution).toHaveBeenCalledWith(execution.executionId)
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
