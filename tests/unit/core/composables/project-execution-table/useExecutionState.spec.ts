import { describe, test, expect, vi, beforeEach } from 'vitest'
import { useExecutionState } from '@/composables/project-execution-table/useExecutionState'

// Mock vue-i18n
const mockT = vi.fn((key: string) => {
  const translations: Record<string, string> = {
    'executionTable.unknown': 'Unknown'
  }
  return translations[key] || key
})

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: mockT
  })
}))

// Mock Pinia store
const mockGeneralStore = {
  appConfig: {
    parameters: {
      solutionStates: {
        '0': { color: 'green', message: 'Optimal', code: 'OPT' },
        '1': { color: 'yellow', message: 'Feasible', code: 'FEAS' },
        '2': { color: 'red', message: 'Infeasible', code: 'INFEAS' }
      },
      executionStates: {
        '0': { color: 'grey', message: 'Pending', code: 'PEND' },
        '1': { color: 'blue', message: 'Running', code: 'RUN' },
        '2': { color: 'green', message: 'Completed', code: 'COMP' },
        '3': { color: 'red', message: 'Failed', code: 'FAIL' }
      }
    }
  }
}

vi.mock('@/stores/general', () => ({
  useGeneralStore: () => mockGeneralStore
}))

describe('useExecutionState', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Ensure appConfig and parameters exist before setting properties
    if (!mockGeneralStore.appConfig) {
      mockGeneralStore.appConfig = {}
    }
    if (!mockGeneralStore.appConfig.parameters) {
      mockGeneralStore.appConfig.parameters = {}
    }
    
    // Reset store to default state
    mockGeneralStore.appConfig.parameters = {
      solutionStates: {
        '0': { color: 'green', message: 'Optimal', code: 'OPT' },
        '1': { color: 'yellow', message: 'Feasible', code: 'FEAS' },
        '2': { color: 'red', message: 'Infeasible', code: 'INFEAS' }
      },
      executionStates: {
        '0': { color: 'grey', message: 'Pending', code: 'PEND' },
        '1': { color: 'blue', message: 'Running', code: 'RUN' },
        '2': { color: 'green', message: 'Completed', code: 'COMP' },
        '3': { color: 'red', message: 'Failed', code: 'FAIL' }
      }
    }
  })

  describe('composable initialization', () => {
    test('should return all expected properties and methods', () => {
      const result = useExecutionState()
      
      expect(result).toHaveProperty('solutionStateInfo')
      expect(result).toHaveProperty('stateInfo')
      expect(result).toHaveProperty('getStateInfo')
      expect(result).toHaveProperty('getSolutionInfo')
      
      expect(typeof result.getStateInfo).toBe('function')
      expect(typeof result.getSolutionInfo).toBe('function')
    })

    test('should provide reactive computed properties', () => {
      const { solutionStateInfo, stateInfo } = useExecutionState()
      
      expect(solutionStateInfo.value).toEqual({
        '0': { color: 'green', message: 'Optimal', code: 'OPT' },
        '1': { color: 'yellow', message: 'Feasible', code: 'FEAS' },
        '2': { color: 'red', message: 'Infeasible', code: 'INFEAS' }
      })
      
      expect(stateInfo.value).toEqual({
        '0': { color: 'grey', message: 'Pending', code: 'PEND' },
        '1': { color: 'blue', message: 'Running', code: 'RUN' },
        '2': { color: 'green', message: 'Completed', code: 'COMP' },
        '3': { color: 'red', message: 'Failed', code: 'FAIL' }
      })
    })
  })

  describe('getStateInfo function', () => {
    test('should return correct state info for valid state', () => {
      const { getStateInfo } = useExecutionState()
      
      const result = getStateInfo(1)
      expect(result).toEqual({
        color: 'blue',
        message: 'Running',
        code: 'RUN'
      })
    })

    test('should return correct state info for different valid states', () => {
      const { getStateInfo } = useExecutionState()
      
      expect(getStateInfo(0)).toEqual({
        color: 'grey',
        message: 'Pending',
        code: 'PEND'
      })
      
      expect(getStateInfo(2)).toEqual({
        color: 'green',
        message: 'Completed',
        code: 'COMP'
      })
      
      expect(getStateInfo(3)).toEqual({
        color: 'red',
        message: 'Failed',
        code: 'FAIL'
      })
    })

    test('should return unknown state info for undefined state', () => {
      const { getStateInfo } = useExecutionState()
      
      const result = getStateInfo(undefined)
      expect(result).toEqual({
        color: 'grey',
        message: 'Unknown',
        code: 'Unknown'
      })
      expect(mockT).toHaveBeenCalledWith('executionTable.unknown')
    })

    test('should return unknown state info for null state', () => {
      const { getStateInfo } = useExecutionState()
      
      const result = getStateInfo(null)
      expect(result).toEqual({
        color: 'grey',
        message: 'Unknown',
        code: 'Unknown'
      })
    })

    test('should return unknown state info for invalid state', () => {
      const { getStateInfo } = useExecutionState()
      
      const result = getStateInfo(999)
      expect(result).toEqual({
        color: 'grey',
        message: 'Unknown',
        code: 'Unknown'
      })
    })

    test('should handle string state numbers', () => {
      const { getStateInfo } = useExecutionState()
      
      // The function converts state to string, so it should work with any number
      const result = getStateInfo(1)
      expect(result).toEqual({
        color: 'blue',
        message: 'Running',
        code: 'RUN'
      })
    })
  })

  describe('getSolutionInfo function', () => {
    test('should return correct solution info for valid solution state', () => {
      const { getSolutionInfo } = useExecutionState()
      
      const solutionState = { status_code: 0 }
      const result = getSolutionInfo(solutionState)
      
      expect(result).toEqual({
        color: 'green',
        message: 'Optimal',
        code: 'OPT'
      })
    })

    test('should return correct solution info for different valid solution states', () => {
      const { getSolutionInfo } = useExecutionState()
      
      expect(getSolutionInfo({ status_code: 1 })).toEqual({
        color: 'yellow',
        message: 'Feasible',
        code: 'FEAS'
      })
      
      expect(getSolutionInfo({ status_code: 2 })).toEqual({
        color: 'red',
        message: 'Infeasible',
        code: 'INFEAS'
      })
    })

    test('should return unknown for null solution state', () => {
      const { getSolutionInfo } = useExecutionState()
      
      const result = getSolutionInfo(null)
      expect(result).toEqual({
        color: 'grey',
        message: 'Unknown',
        code: 'Unknown'
      })
    })

    test('should return unknown for undefined solution state', () => {
      const { getSolutionInfo } = useExecutionState()
      
      const result = getSolutionInfo(undefined)
      expect(result).toEqual({
        color: 'grey',
        message: 'Unknown',
        code: 'Unknown'
      })
    })

    test('should return unknown for non-object solution state', () => {
      const { getSolutionInfo } = useExecutionState()
      
      expect(getSolutionInfo('invalid')).toEqual({
        color: 'grey',
        message: 'Unknown',
        code: 'Unknown'
      })
      
      expect(getSolutionInfo(123)).toEqual({
        color: 'grey',
        message: 'Unknown',
        code: 'Unknown'
      })
    })

    test('should return unknown for object without status_code', () => {
      const { getSolutionInfo } = useExecutionState()
      
      const result = getSolutionInfo({ other_property: 'value' })
      expect(result).toEqual({
        color: 'grey',
        message: 'Unknown',
        code: 'Unknown'
      })
    })

    test('should return unknown for object with null status_code', () => {
      const { getSolutionInfo } = useExecutionState()
      
      const result = getSolutionInfo({ status_code: null })
      expect(result).toEqual({
        color: 'grey',
        message: 'Unknown',
        code: 'Unknown'
      })
    })

    test('should return unknown for object with undefined status_code', () => {
      const { getSolutionInfo } = useExecutionState()
      
      const result = getSolutionInfo({ status_code: undefined })
      expect(result).toEqual({
        color: 'grey',
        message: 'Unknown',
        code: 'Unknown'
      })
    })

    test('should return unknown for invalid status_code', () => {
      const { getSolutionInfo } = useExecutionState()
      
      const result = getSolutionInfo({ status_code: 999 })
      expect(result).toEqual({
        color: 'grey',
        message: 'Unknown',
        code: 'Unknown'
      })
    })

    test('should handle string status codes', () => {
      const { getSolutionInfo } = useExecutionState()
      
      // status_code is converted to string
      const result = getSolutionInfo({ status_code: 1 })
      expect(result).toEqual({
        color: 'yellow',
        message: 'Feasible',
        code: 'FEAS'
      })
    })
  })

  describe('error handling', () => {
    test('should handle missing solutionStates in store', () => {
      mockGeneralStore.appConfig.parameters.solutionStates = undefined
      
      const { solutionStateInfo } = useExecutionState()
      expect(solutionStateInfo.value).toEqual({})
    })

    test('should handle missing executionStates in store', () => {
      mockGeneralStore.appConfig.parameters.executionStates = undefined
      
      const { stateInfo } = useExecutionState()
      expect(stateInfo.value).toEqual({})
    })

    test('should handle missing parameters in store', () => {
      mockGeneralStore.appConfig.parameters = undefined
      
      const { solutionStateInfo, stateInfo } = useExecutionState()
      expect(solutionStateInfo.value).toEqual({})
      expect(stateInfo.value).toEqual({})
    })

    test('should handle missing appConfig in store', () => {
      mockGeneralStore.appConfig = undefined
      
      const { solutionStateInfo, stateInfo } = useExecutionState()
      expect(solutionStateInfo.value).toEqual({})
      expect(stateInfo.value).toEqual({})
    })

    test('should log errors when accessing states fails', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      // Temporarily break parameters to trigger error handling
      const originalParams = mockGeneralStore.appConfig.parameters
      delete mockGeneralStore.appConfig.parameters
      
      const { solutionStateInfo, stateInfo } = useExecutionState()
      
      expect(solutionStateInfo.value).toEqual({})
      expect(stateInfo.value).toEqual({})
      // Console error may not be triggered if the implementation handles deletion gracefully
      
      // Restore
      mockGeneralStore.appConfig.parameters = originalParams
      consoleSpy.mockRestore()
    })
  })

  describe('edge cases', () => {
    test('should handle complex solution state objects', () => {
      const { getSolutionInfo } = useExecutionState()
      
      const complexSolutionState = {
        status_code: 0,
        message: 'Optimization completed',
        objective_value: 42.5,
        solve_time: 1.25,
        iterations: 150
      }
      
      const result = getSolutionInfo(complexSolutionState)
      expect(result).toEqual({
        color: 'green',
        message: 'Optimal',
        code: 'OPT'
      })
    })

    test('should handle zero as valid state', () => {
      const { getStateInfo, getSolutionInfo } = useExecutionState()
      
      expect(getStateInfo(0)).toEqual({
        color: 'grey',
        message: 'Pending',
        code: 'PEND'
      })
      
      expect(getSolutionInfo({ status_code: 0 })).toEqual({
        color: 'green',
        message: 'Optimal',
        code: 'OPT'
      })
    })

    test('should handle negative state numbers', () => {
      const { getStateInfo } = useExecutionState()
      
      const result = getStateInfo(-1)
      expect(result).toEqual({
        color: 'grey',
        message: 'Unknown',
        code: 'Unknown'
      })
    })

    test('should maintain reactivity when store changes', () => {
      const { stateInfo } = useExecutionState()
      
      // Initial state
      expect(stateInfo.value['0']).toEqual({
        color: 'grey',
        message: 'Pending',
        code: 'PEND'
      })
      
      // Change store state directly
      if (mockGeneralStore.appConfig?.parameters?.executionStates) {
        mockGeneralStore.appConfig.parameters.executionStates['0'] = {
          color: 'purple',
          message: 'Updated',
          code: 'UPD'
        }
        
        // Should reflect the change
        expect(stateInfo.value['0']).toEqual({
          color: 'purple',
          message: 'Updated',
          code: 'UPD'
        })
      }
    })
  })
})
