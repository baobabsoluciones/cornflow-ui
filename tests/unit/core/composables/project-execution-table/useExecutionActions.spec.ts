import { describe, test, expect, vi, beforeEach } from 'vitest'
import { nextTick } from 'vue'
import { useExecutionActions } from '@/composables/project-execution-table/useExecutionActions'
import type { Execution } from '@/composables/project-execution-table/types'

// Mock Pinia store
const mockGeneralStore = {
  getDataToDownload: vi.fn()
}

vi.mock('@/stores/general', () => ({
  useGeneralStore: () => mockGeneralStore
}))

describe('useExecutionActions', () => {
  let mockExecution: Execution

  beforeEach(() => {
    vi.clearAllMocks()
    
    mockExecution = {
      id: 'test-execution-id',
      createdAt: '2024-01-01T10:00:00Z',
      finishedAt: '2024-01-01T11:00:00Z',
      state: 1,
      solution_state: { status_code: 0 },
      name: 'Test Execution',
      description: 'Test Description',
      userName: 'testuser',
      config: {
        solver: 'GUROBI',
        timeLimit: 300
      },
      time: '01:00:00'
    }
  })

  describe('composable initialization', () => {
    test('should return all expected properties and methods', () => {
      const result = useExecutionActions()
      
      expect(result).toHaveProperty('openConfirmationDeleteModal')
      expect(result).toHaveProperty('deletedItem')
      expect(result).toHaveProperty('loadExecution')
      expect(result).toHaveProperty('deleteExecution')
      expect(result).toHaveProperty('confirmDelete')
      expect(result).toHaveProperty('cancelDelete')
      expect(result).toHaveProperty('handleDownload')
      expect(result).toHaveProperty('getSolverName')
      expect(result).toHaveProperty('getTimeLimit')
      
      expect(typeof result.loadExecution).toBe('function')
      expect(typeof result.deleteExecution).toBe('function')
      expect(typeof result.confirmDelete).toBe('function')
      expect(typeof result.cancelDelete).toBe('function')
      expect(typeof result.handleDownload).toBe('function')
      expect(typeof result.getSolverName).toBe('function')
      expect(typeof result.getTimeLimit).toBe('function')
    })

    test('should initialize with correct default state', () => {
      const { openConfirmationDeleteModal, deletedItem } = useExecutionActions()
      
      expect(openConfirmationDeleteModal.value).toBe(false)
      expect(deletedItem.value).toBe(null)
    })
  })

  describe('loadExecution function', () => {
    test('should return correct action object', () => {
      const { loadExecution } = useExecutionActions()
      
      const result = loadExecution(mockExecution)
      
      expect(result).toEqual({
        action: 'loadExecution',
        execution: mockExecution
      })
    })

    test('should handle different execution objects', () => {
      const { loadExecution } = useExecutionActions()
      
      const anotherExecution: Execution = {
        id: 'another-id',
        createdAt: '2024-01-02T10:00:00Z',
        finishedAt: null,
        state: 2,
        solution_state: null,
        name: 'Another Execution',
        description: 'Another Description',
        userName: null,
        config: {}
      }
      
      const result = loadExecution(anotherExecution)
      
      expect(result).toEqual({
        action: 'loadExecution',
        execution: anotherExecution
      })
    })
  })

  describe('deleteExecution function', () => {
    test('should set deletedItem and open modal', async () => {
      const { deleteExecution, openConfirmationDeleteModal, deletedItem } = useExecutionActions()
      
      deleteExecution(mockExecution)
      await nextTick()
      
      expect(deletedItem.value).toStrictEqual(mockExecution)
      expect(openConfirmationDeleteModal.value).toBe(true)
    })

    test('should handle different execution objects', async () => {
      const { deleteExecution, deletedItem } = useExecutionActions()
      
      const anotherExecution: Execution = {
        id: 'delete-test',
        createdAt: '2024-01-01T10:00:00Z',
        finishedAt: null,
        state: 0,
        solution_state: null,
        name: 'To Delete',
        description: 'Will be deleted',
        userName: null,
        config: {}
      }
      
      deleteExecution(anotherExecution)
      await nextTick()
      
      expect(deletedItem.value).toStrictEqual(anotherExecution)
    })

    test('should overwrite previous deletedItem', async () => {
      const { deleteExecution, deletedItem } = useExecutionActions()
      
      const firstExecution = { ...mockExecution, id: 'first' }
      const secondExecution = { ...mockExecution, id: 'second' }
      
      deleteExecution(firstExecution)
      await nextTick()
      expect(deletedItem.value).toStrictEqual(firstExecution)
      
      deleteExecution(secondExecution)
      await nextTick()
      expect(deletedItem.value).toStrictEqual(secondExecution)
    })
  })

  describe('confirmDelete function', () => {
    test('should return correct action object and close modal', async () => {
      const { deleteExecution, confirmDelete, openConfirmationDeleteModal } = useExecutionActions()
      
      // First set up a deletion
      deleteExecution(mockExecution)
      await nextTick()
      
      const result = confirmDelete()
      
      expect(result).toEqual({
        action: 'deleteExecution',
        execution: mockExecution
      })
      expect(openConfirmationDeleteModal.value).toBe(false)
    })

    test('should handle null deletedItem', () => {
      const { confirmDelete } = useExecutionActions()
      
      const result = confirmDelete()
      
      expect(result).toEqual({
        action: 'deleteExecution',
        execution: null
      })
    })

    test('should close modal even with null deletedItem', async () => {
      const { confirmDelete, openConfirmationDeleteModal } = useExecutionActions()
      
      // Manually open modal without setting deletedItem
      openConfirmationDeleteModal.value = true
      
      confirmDelete()
      
      expect(openConfirmationDeleteModal.value).toBe(false)
    })
  })

  describe('cancelDelete function', () => {
    test('should close modal and reset deletedItem', async () => {
      const { deleteExecution, cancelDelete, openConfirmationDeleteModal, deletedItem } = useExecutionActions()
      
      // First set up a deletion
      deleteExecution(mockExecution)
      await nextTick()
      
      expect(openConfirmationDeleteModal.value).toBe(true)
      expect(deletedItem.value).toStrictEqual(mockExecution)
      
      cancelDelete()
      
      expect(openConfirmationDeleteModal.value).toBe(false)
      expect(deletedItem.value).toBe(null)
    })

    test('should work when called without prior deleteExecution', () => {
      const { cancelDelete, openConfirmationDeleteModal, deletedItem } = useExecutionActions()
      
      cancelDelete()
      
      expect(openConfirmationDeleteModal.value).toBe(false)
      expect(deletedItem.value).toBe(null)
    })
  })

  describe('handleDownload function', () => {
    test('should call store method and return true on success', async () => {
      mockGeneralStore.getDataToDownload.mockResolvedValue(undefined)
      
      const { handleDownload } = useExecutionActions()
      
      const result = await handleDownload(mockExecution)
      
      expect(mockGeneralStore.getDataToDownload).toHaveBeenCalledWith(
        mockExecution.id,
        true,
        true
      )
      expect(result).toBe(true)
    })

    test('should return error object on failure', async () => {
      mockGeneralStore.getDataToDownload.mockRejectedValue(new Error('Download failed'))
      
      const { handleDownload } = useExecutionActions()
      
      const result = await handleDownload(mockExecution)
      
      expect(result).toEqual({ error: 'errorDownloadingExcel' })
    })

    test('should handle different execution IDs', async () => {
      mockGeneralStore.getDataToDownload.mockResolvedValue(undefined)
      
      const { handleDownload } = useExecutionActions()
      
      const differentExecution = { ...mockExecution, id: 'different-id' }
      await handleDownload(differentExecution)
      
      expect(mockGeneralStore.getDataToDownload).toHaveBeenCalledWith(
        'different-id',
        true,
        true
      )
    })

    test('should handle store method throwing synchronously', async () => {
      mockGeneralStore.getDataToDownload.mockImplementation(() => {
        throw new Error('Synchronous error')
      })
      
      const { handleDownload } = useExecutionActions()
      
      const result = await handleDownload(mockExecution)
      
      expect(result).toEqual({ error: 'errorDownloadingExcel' })
    })
  })

  describe('getSolverName function', () => {
    test('should return solver name from config', () => {
      const { getSolverName } = useExecutionActions()
      
      const result = getSolverName(mockExecution)
      
      expect(result).toBe('GUROBI')
    })

    test('should return dash when solver is not set', () => {
      const { getSolverName } = useExecutionActions()
      
      const executionWithoutSolver = {
        ...mockExecution,
        config: {}
      }
      
      const result = getSolverName(executionWithoutSolver)
      
      expect(result).toBe('-')
    })

    test('should return dash when config is missing', () => {
      const { getSolverName } = useExecutionActions()
      
      const executionWithoutConfig = {
        ...mockExecution,
        config: undefined
      } as any
      
      const result = getSolverName(executionWithoutConfig)
      
      expect(result).toBe('-')
    })

    test('should return dash when execution is null', () => {
      const { getSolverName } = useExecutionActions()
      
      const result = getSolverName(null as any)
      
      expect(result).toBe('-')
    })

    test('should handle different solver names', () => {
      const { getSolverName } = useExecutionActions()
      
      const solvers = ['CPLEX', 'SCIP', 'COIN-OR', 'XPRESS']
      
      solvers.forEach(solver => {
        const execution = {
          ...mockExecution,
          config: { solver }
        }
        
        expect(getSolverName(execution)).toBe(solver)
      })
    })
  })

  describe('getTimeLimit function', () => {
    test('should return time limit from config', () => {
      const { getTimeLimit } = useExecutionActions()
      
      const result = getTimeLimit(mockExecution)
      
      expect(result).toBe(300)
    })

    test('should return dash when timeLimit is not set', () => {
      const { getTimeLimit } = useExecutionActions()
      
      const executionWithoutTimeLimit = {
        ...mockExecution,
        config: { solver: 'GUROBI' }
      }
      
      const result = getTimeLimit(executionWithoutTimeLimit)
      
      expect(result).toBe('-')
    })

    test('should return dash when config is missing', () => {
      const { getTimeLimit } = useExecutionActions()
      
      const executionWithoutConfig = {
        ...mockExecution,
        config: undefined
      } as any
      
      const result = getTimeLimit(executionWithoutConfig)
      
      expect(result).toBe('-')
    })

    test('should return dash when execution is null', () => {
      const { getTimeLimit } = useExecutionActions()
      
      const result = getTimeLimit(null as any)
      
      expect(result).toBe('-')
    })

    test('should handle string time limits', () => {
      const { getTimeLimit } = useExecutionActions()
      
      const executionWithStringTimeLimit = {
        ...mockExecution,
        config: { timeLimit: '600' }
      }
      
      const result = getTimeLimit(executionWithStringTimeLimit)
      
      expect(result).toBe('600')
    })

    test('should handle zero time limit', () => {
      const { getTimeLimit } = useExecutionActions()
      
      const executionWithZeroTimeLimit = {
        ...mockExecution,
        config: { timeLimit: 0 }
      }
      
      const result = getTimeLimit(executionWithZeroTimeLimit)
      
      // Zero is falsy, so it should return '-'
      expect(result).toBe('-')
    })

    test('should handle negative time limit', () => {
      const { getTimeLimit } = useExecutionActions()
      
      const executionWithNegativeTimeLimit = {
        ...mockExecution,
        config: { timeLimit: -1 }
      }
      
      const result = getTimeLimit(executionWithNegativeTimeLimit)
      
      expect(result).toBe(-1)
    })
  })

  describe('integration scenarios', () => {
    test('should handle complete delete workflow', async () => {
      const { 
        deleteExecution, 
        confirmDelete, 
        openConfirmationDeleteModal, 
        deletedItem 
      } = useExecutionActions()
      
      // Initial state
      expect(openConfirmationDeleteModal.value).toBe(false)
      expect(deletedItem.value).toBe(null)
      
      // Start delete
      deleteExecution(mockExecution)
      await nextTick()
      
      expect(openConfirmationDeleteModal.value).toBe(true)
      expect(deletedItem.value).toStrictEqual(mockExecution)
      
      // Confirm delete
      const result = confirmDelete()
      
      expect(result).toEqual({
        action: 'deleteExecution',
        execution: mockExecution
      })
      expect(openConfirmationDeleteModal.value).toBe(false)
    })

    test('should handle complete cancel workflow', async () => {
      const { 
        deleteExecution, 
        cancelDelete, 
        openConfirmationDeleteModal, 
        deletedItem 
      } = useExecutionActions()
      
      // Start delete
      deleteExecution(mockExecution)
      await nextTick()
      
      expect(openConfirmationDeleteModal.value).toBe(true)
      expect(deletedItem.value).toStrictEqual(mockExecution)
      
      // Cancel delete
      cancelDelete()
      
      expect(openConfirmationDeleteModal.value).toBe(false)
      expect(deletedItem.value).toBe(null)
    })

    test('should handle multiple executions in sequence', async () => {
      const { 
        deleteExecution, 
        confirmDelete, 
        cancelDelete,
        deletedItem 
      } = useExecutionActions()
      
      const execution1 = { ...mockExecution, id: 'exec1' }
      const execution2 = { ...mockExecution, id: 'exec2' }
      
      // First execution
      deleteExecution(execution1)
      await nextTick()
      expect(deletedItem.value).toStrictEqual(execution1)
      
      // Cancel first
      cancelDelete()
      expect(deletedItem.value).toBe(null)
      
      // Second execution
      deleteExecution(execution2)
      await nextTick()
      expect(deletedItem.value).toStrictEqual(execution2)
      
      // Confirm second
      const result = confirmDelete()
      expect(result.execution).toStrictEqual(execution2)
    })

    test('should maintain independence between multiple instances', () => {
      const instance1 = useExecutionActions()
      const instance2 = useExecutionActions()
      
      const execution1 = { ...mockExecution, id: 'instance1' }
      const execution2 = { ...mockExecution, id: 'instance2' }
      
      instance1.deleteExecution(execution1)
      instance2.deleteExecution(execution2)
      
      expect(instance1.deletedItem.value).toStrictEqual(execution1)
      expect(instance2.deletedItem.value).toStrictEqual(execution2)
      
      instance1.cancelDelete()
      
      expect(instance1.deletedItem.value).toBe(null)
      expect(instance2.deletedItem.value).toStrictEqual(execution2)
    })
  })
})
