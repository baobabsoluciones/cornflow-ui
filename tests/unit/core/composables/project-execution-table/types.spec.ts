import { describe, test, expect } from 'vitest'
import type { Execution, HeaderItem, StateInfo, ExecutionTableProps } from '@/composables/project-execution-table/types'

describe('project-execution-table types', () => {
  describe('Execution interface', () => {
    test('should have all required properties', () => {
      const execution: Execution = {
        id: 'test-id',
        createdAt: '2024-01-01T10:00:00Z',
        finishedAt: '2024-01-01T11:00:00Z',
        state: 1,
        solution_state: { status_code: 0 },
        name: 'Test Execution',
        description: 'Test Description',
        userName: 'testuser',
        config: {
          solver: 'test-solver',
          timeLimit: 300
        },
        time: '01:00:00'
      }

      expect(execution.id).toBe('test-id')
      expect(execution.createdAt).toBe('2024-01-01T10:00:00Z')
      expect(execution.finishedAt).toBe('2024-01-01T11:00:00Z')
      expect(execution.state).toBe(1)
      expect(execution.solution_state).toEqual({ status_code: 0 })
      expect(execution.name).toBe('Test Execution')
      expect(execution.description).toBe('Test Description')
      expect(execution.userName).toBe('testuser')
      expect(execution.config.solver).toBe('test-solver')
      expect(execution.config.timeLimit).toBe(300)
      expect(execution.time).toBe('01:00:00')
    })

    test('should allow null values for optional properties', () => {
      const execution: Execution = {
        id: 'test-id',
        createdAt: '2024-01-01T10:00:00Z',
        finishedAt: null,
        state: 1,
        solution_state: null,
        name: 'Test Execution',
        description: 'Test Description',
        userName: null,
        config: {}
      }

      expect(execution.finishedAt).toBe(null)
      expect(execution.userName).toBe(null)
      expect(execution.solution_state).toBe(null)
      expect(execution.config).toEqual({})
    })

    test('should allow string timeLimit in config', () => {
      const execution: Execution = {
        id: 'test-id',
        createdAt: '2024-01-01T10:00:00Z',
        finishedAt: null,
        state: 1,
        solution_state: null,
        name: 'Test Execution',
        description: 'Test Description',
        userName: null,
        config: {
          solver: 'test-solver',
          timeLimit: '300'
        }
      }

      expect(execution.config.timeLimit).toBe('300')
    })

    test('should allow any type for solution_state', () => {
      const executions: Execution[] = [
        {
          id: 'test-1',
          createdAt: '2024-01-01T10:00:00Z',
          finishedAt: null,
          state: 1,
          solution_state: { status_code: 0, message: 'success' },
          name: 'Test 1',
          description: 'Test Description',
          userName: null,
          config: {}
        },
        {
          id: 'test-2',
          createdAt: '2024-01-01T10:00:00Z',
          finishedAt: null,
          state: 1,
          solution_state: 'string-state',
          name: 'Test 2',
          description: 'Test Description',
          userName: null,
          config: {}
        },
        {
          id: 'test-3',
          createdAt: '2024-01-01T10:00:00Z',
          finishedAt: null,
          state: 1,
          solution_state: 123,
          name: 'Test 3',
          description: 'Test Description',
          userName: null,
          config: {}
        }
      ]

      expect(executions[0].solution_state).toEqual({ status_code: 0, message: 'success' })
      expect(executions[1].solution_state).toBe('string-state')
      expect(executions[2].solution_state).toBe(123)
    })
  })

  describe('HeaderItem interface', () => {
    test('should have all required properties', () => {
      const headerItem: HeaderItem = {
        title: 'Test Header',
        value: 'test-value',
        width: '10%',
        sortable: true,
        fixedWidth: false
      }

      expect(headerItem.title).toBe('Test Header')
      expect(headerItem.value).toBe('test-value')
      expect(headerItem.width).toBe('10%')
      expect(headerItem.sortable).toBe(true)
      expect(headerItem.fixedWidth).toBe(false)
    })

    test('should allow boolean values for sortable and fixedWidth', () => {
      const headerItems: HeaderItem[] = [
        {
          title: 'Sortable Header',
          value: 'sortable',
          width: '15%',
          sortable: true,
          fixedWidth: true
        },
        {
          title: 'Non-sortable Header',
          value: 'non-sortable',
          width: '20%',
          sortable: false,
          fixedWidth: false
        }
      ]

      expect(headerItems[0].sortable).toBe(true)
      expect(headerItems[0].fixedWidth).toBe(true)
      expect(headerItems[1].sortable).toBe(false)
      expect(headerItems[1].fixedWidth).toBe(false)
    })
  })

  describe('StateInfo interface', () => {
    test('should have all required properties', () => {
      const stateInfo: StateInfo = {
        color: 'green',
        message: 'Success',
        code: 'SUCCESS'
      }

      expect(stateInfo.color).toBe('green')
      expect(stateInfo.message).toBe('Success')
      expect(stateInfo.code).toBe('SUCCESS')
    })

    test('should allow different color values', () => {
      const stateInfos: StateInfo[] = [
        { color: 'red', message: 'Error', code: 'ERROR' },
        { color: 'yellow', message: 'Warning', code: 'WARN' },
        { color: 'blue', message: 'Info', code: 'INFO' },
        { color: 'grey', message: 'Unknown', code: 'UNKNOWN' }
      ]

      expect(stateInfos[0].color).toBe('red')
      expect(stateInfos[1].color).toBe('yellow')
      expect(stateInfos[2].color).toBe('blue')
      expect(stateInfos[3].color).toBe('grey')
    })
  })

  describe('ExecutionTableProps interface', () => {
    test('should have all required properties', () => {
      const mockExecution: Execution = {
        id: 'test-id',
        createdAt: '2024-01-01T10:00:00Z',
        finishedAt: null,
        state: 1,
        solution_state: null,
        name: 'Test Execution',
        description: 'Test Description',
        userName: null,
        config: {}
      }

      const props: ExecutionTableProps = {
        executionsByDate: [mockExecution],
        formatDateByTime: true,
        showHeaders: true,
        showFooter: false,
        useFixedWidth: true
      }

      expect(props.executionsByDate).toEqual([mockExecution])
      expect(props.formatDateByTime).toBe(true)
      expect(props.showHeaders).toBe(true)
      expect(props.showFooter).toBe(false)
      expect(props.useFixedWidth).toBe(true)
    })

    test('should allow empty executions array', () => {
      const props: ExecutionTableProps = {
        executionsByDate: [],
        formatDateByTime: false,
        showHeaders: false,
        showFooter: true,
        useFixedWidth: false
      }

      expect(props.executionsByDate).toEqual([])
      expect(props.formatDateByTime).toBe(false)
      expect(props.showHeaders).toBe(false)
      expect(props.showFooter).toBe(true)
      expect(props.useFixedWidth).toBe(false)
    })

    test('should allow multiple executions', () => {
      const executions: Execution[] = [
        {
          id: 'test-1',
          createdAt: '2024-01-01T10:00:00Z',
          finishedAt: null,
          state: 1,
          solution_state: null,
          name: 'Test 1',
          description: 'Description 1',
          userName: 'user1',
          config: { solver: 'solver1' }
        },
        {
          id: 'test-2',
          createdAt: '2024-01-02T10:00:00Z',
          finishedAt: '2024-01-02T11:00:00Z',
          state: 2,
          solution_state: { status_code: 0 },
          name: 'Test 2',
          description: 'Description 2',
          userName: 'user2',
          config: { timeLimit: 600 }
        }
      ]

      const props: ExecutionTableProps = {
        executionsByDate: executions,
        formatDateByTime: true,
        showHeaders: true,
        showFooter: true,
        useFixedWidth: true
      }

      expect(props.executionsByDate).toHaveLength(2)
      expect(props.executionsByDate[0].id).toBe('test-1')
      expect(props.executionsByDate[1].id).toBe('test-2')
    })
  })

  describe('Type compatibility and validation', () => {
    test('should allow creating execution with minimal required fields', () => {
      const minimalExecution: Execution = {
        id: 'minimal',
        createdAt: '2024-01-01T10:00:00Z',
        finishedAt: null,
        state: 0,
        solution_state: null,
        name: 'Minimal',
        description: '',
        userName: null,
        config: {}
      }

      expect(minimalExecution).toBeDefined()
      expect(minimalExecution.id).toBe('minimal')
      expect(minimalExecution.config).toEqual({})
    })

    test('should allow complex execution configuration', () => {
      const complexExecution: Execution = {
        id: 'complex-id',
        createdAt: '2024-01-01T10:00:00Z',
        finishedAt: '2024-01-01T12:00:00Z',
        state: 3,
        solution_state: {
          status_code: 1,
          message: 'Optimal solution found',
          value: 42.5,
          additional_data: {
            iterations: 100,
            time_elapsed: 1800
          }
        },
        name: 'Complex Optimization',
        description: 'A complex optimization problem with multiple constraints',
        userName: 'advanced_user',
        config: {
          solver: 'GUROBI',
          timeLimit: 3600
        },
        time: '02:00:00'
      }

      expect(complexExecution.solution_state.status_code).toBe(1)
      expect(complexExecution.solution_state.additional_data.iterations).toBe(100)
      expect(complexExecution.config.solver).toBe('GUROBI')
      expect(complexExecution.config.timeLimit).toBe(3600)
    })

    test('should support header items with percentage and pixel widths', () => {
      const headers: HeaderItem[] = [
        {
          title: 'ID',
          value: 'id',
          width: '100px',
          sortable: true,
          fixedWidth: true
        },
        {
          title: 'Name',
          value: 'name',
          width: '25%',
          sortable: true,
          fixedWidth: false
        }
      ]

      expect(headers[0].width).toBe('100px')
      expect(headers[1].width).toBe('25%')
    })
  })
})
