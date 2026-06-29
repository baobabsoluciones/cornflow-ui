import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { Execution } from '@/models/Execution'

// Mock the getUserFullName utility
vi.mock('@/utils/user', () => ({
  default: vi.fn()
}))

describe('Execution', () => {
  let mockGetUserFullName: any

  beforeEach(async () => {
    // Get the mocked function
    const userUtils = await import('@/utils/user')
    mockGetUserFullName = userUtils.default
    
    // Reset mocks
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('constructor', () => {
    test('should create an execution with all required parameters', () => {
      mockGetUserFullName.mockReturnValue('John Doe')

      const execution = new Execution({
        message: 'Success',
        createdAt: '2023-01-01T00:00:00Z',
        config: { solver: 'CBC' },
        state: 1,
        solution_state: 200,
        name: 'Test Execution',
        description: 'Test Description',
        indicators: '{"kpi1": 100}',
        dataHash: 'hash123',
        schema: 'test-schema',
        instanceId: 'instance-123',
        id: 'exec-456',
        userId: 789,
      })

      expect(execution.message).toBe('Success')
      expect(execution.createdAt).toBe('2023-01-01T00:00:00Z')
      expect(execution.config).toEqual({ solver: 'CBC' })
      expect(execution.state).toBe(1)
      expect(execution.solution_state).toBe(200)
      expect(execution.name).toBe('Test Execution')
      expect(execution.description).toBe('Test Description')
      expect(execution.indicators).toBe('{"kpi1": 100}')
      expect(execution.dataHash).toBe('hash123')
      expect(execution.schema).toBe('test-schema')
      expect(execution.instanceId).toBe('instance-123')
      expect(execution.id).toBe('exec-456')
      expect(execution.userId).toBe(789)
      expect(execution.userName).toBeNull()
      expect(execution.finishedAt).toBeNull()
      expect(execution.userFullName).toBe('John Doe')
      expect(mockGetUserFullName).toHaveBeenCalledWith(null, null)
    })

    test('should create an execution with all optional parameters', () => {
      mockGetUserFullName.mockReturnValue('Jane Smith')

      const execution = new Execution({
        message: 'Completed',
        createdAt: '2023-01-01T00:00:00Z',
        config: { solver: 'GUROBI' },
        state: 2,
        solution_state: 201,
        name: 'Full Execution',
        description: 'Full Description',
        indicators: '{"kpi2": 200}',
        dataHash: 'hash456',
        schema: 'full-schema',
        instanceId: 'instance-456',
        id: 'exec-789',
        userId: 123,
        userName: 'jsmith',
        userFirstName: 'Jane',
        userLastName: 'Smith',
        finishedAt: '2023-01-01T01:00:00Z',
      })

      expect(execution.userName).toBe('jsmith')
      expect(execution.finishedAt).toBe('2023-01-01T01:00:00Z')
      expect(execution.userFullName).toBe('Jane Smith')
      expect(mockGetUserFullName).toHaveBeenCalledWith('Jane', 'Smith')
    })

    test('should handle null optional parameters', () => {
      mockGetUserFullName.mockReturnValue('Unknown User')

      const execution = new Execution({
        message: 'Error',
        createdAt: '2023-01-01T00:00:00Z',
        config: {},
        state: 0,
        solution_state: 500,
        name: 'Error Execution',
        description: 'Error Description',
        indicators: '{}',
        dataHash: 'hash-error',
        schema: 'error-schema',
        instanceId: 'instance-error',
        id: 'exec-error',
        userId: 999,
        userName: null,
        userFirstName: null,
        userLastName: null,
        finishedAt: null,
      })

      expect(execution.userName).toBeNull()
      expect(execution.finishedAt).toBeNull()
      expect(execution.userFullName).toBe('Unknown User')
      expect(mockGetUserFullName).toHaveBeenCalledWith(null, null)
    })

    test('should handle empty strings for optional parameters', () => {
      mockGetUserFullName.mockReturnValue('')

      const execution = new Execution({
        message: 'Empty',
        createdAt: '2023-01-01T00:00:00Z',
        config: {},
        state: 1,
        solution_state: 200,
        name: 'Empty Execution',
        description: 'Empty Description',
        indicators: '',
        dataHash: '',
        schema: '',
        instanceId: '',
        id: '',
        userId: 0,
        userName: '',
        userFirstName: '',
        userLastName: '',
        finishedAt: '',
      })

      expect(execution.userName).toBe('')
      expect(execution.finishedAt).toBe('')
      expect(execution.userFullName).toBe('')
      expect(mockGetUserFullName).toHaveBeenCalledWith('', '')
    })

    test('should handle complex config objects', () => {
      mockGetUserFullName.mockReturnValue('Config User')

      const complexConfig = {
        solver: 'CPLEX',
        parameters: {
          timeLimit: 3600,
          mipGap: 0.01,
          threads: 4,
          options: {
            presolve: true,
            cuts: 'auto',
            heuristics: {
              enabled: true,
              frequency: 10
            }
          }
        },
        callbacks: {
          onProgress: () => {},
          onComplete: () => {}
        },
        metadata: {
          version: '1.0',
          created: new Date('2023-01-01')
        }
      }

      const execution = new Execution({
        message: 'Complex Config',
        createdAt: '2023-01-01T00:00:00Z',
        config: complexConfig,
        state: 1,
        solution_state: 200,
        name: 'Complex Execution',
        description: 'Complex Description',
        indicators: '{"complex": true}',
        dataHash: 'complex-hash',
        schema: 'complex-schema',
        instanceId: 'complex-instance',
        id: 'complex-exec',
        userId: 111,
      })

      expect(execution.config).toBe(complexConfig)
      expect(execution.config.solver).toBe('CPLEX')
      expect(execution.config.parameters.options.heuristics.frequency).toBe(10)
      expect(typeof execution.config.callbacks.onProgress).toBe('function')
    })

    test('should handle different date formats', () => {
      mockGetUserFullName.mockReturnValue('Date User')

      const dateFormats = [
        '2023-01-01T00:00:00Z',
        '2023-01-01T00:00:00.000Z',
        '2023-01-01T00:00:00+00:00',
        '2023-01-01 00:00:00',
        '01/01/2023',
        '2023-01-01'
      ]

      dateFormats.forEach(dateFormat => {
        const execution = new Execution({
          message: 'Date Test',
          createdAt: dateFormat,
          config: {},
          state: 1,
          solution_state: 200,
          name: 'Date Execution',
          description: 'Date Description',
          indicators: '{}',
          dataHash: 'date-hash',
          schema: 'date-schema',
          instanceId: 'date-instance',
          id: 'date-exec',
          userId: 222,
          userName: null,
          userFirstName: null,
          userLastName: null,
          finishedAt: dateFormat,
        })

        expect(execution.createdAt).toBe(dateFormat)
        expect(execution.finishedAt).toBe(dateFormat)
      })
    })

    test('should handle different state values', () => {
      mockGetUserFullName.mockReturnValue('State User')

      const stateValues = [
        { state: 0, solution_state: 0 },    // Initial
        { state: 1, solution_state: 200 },  // Running/Success
        { state: 2, solution_state: 201 },  // Completed/Optimal
        { state: -1, solution_state: 500 }, // Error/Failed
        { state: 99, solution_state: 999 }  // Custom states
      ]

      stateValues.forEach(({ state, solution_state }) => {
        const execution = new Execution({
          message: 'State Test',
          createdAt: '2023-01-01T00:00:00Z',
          config: {},
          state: state,
          solution_state: solution_state,
          name: 'State Execution',
          description: 'State Description',
          indicators: '{}',
          dataHash: 'state-hash',
          schema: 'state-schema',
          instanceId: 'state-instance',
          id: 'state-exec',
          userId: 333,
        })

        expect(execution.state).toBe(state)
        expect(execution.solution_state).toBe(solution_state)
      })
    })

    test('should handle JSON indicators', () => {
      mockGetUserFullName.mockReturnValue('JSON User')

      const indicatorTypes = [
        '{}',
        '{"kpi1": 100}',
        '{"kpi1": 100, "kpi2": "optimal", "kpi3": true}',
        '[]',
        '[1, 2, 3]',
        '"string indicator"',
        'null',
        'true',
        '42'
      ]

      indicatorTypes.forEach(indicators => {
        const execution = new Execution({
          message: 'JSON Test',
          createdAt: '2023-01-01T00:00:00Z',
          config: {},
          state: 1,
          solution_state: 200,
          name: 'JSON Execution',
          description: 'JSON Description',
          indicators: indicators,
          dataHash: 'json-hash',
          schema: 'json-schema',
          instanceId: 'json-instance',
          id: 'json-exec',
          userId: 444,
        })

        expect(execution.indicators).toBe(indicators)
      })
    })

    test('should handle special characters in string fields', () => {
      mockGetUserFullName.mockReturnValue('Special Çharacters 中文 العربية')

      const execution = new Execution({
        message: 'Success with émojis 🚀 and newlines\n\ttabs',
        createdAt: '2023-01-01T00:00:00Z',
        config: { "special": "çharacters中文العربية" },
        state: 1,
        solution_state: 200,
        name: 'Execution with special çharacters 中文 العربية',
        description: 'Description with\nnewlines\tand\rcarriage returns',
        indicators: '{"unicode": "🌟🚀💻"}',
        dataHash: 'hash-with-special-chars-çñü',
        schema: 'schema-çñü-中文',
        instanceId: 'instance-العربية',
        id: 'exec-🚀',
        userId: 555,
        userName: 'user-çñü',
        userFirstName: 'José María',
        userLastName: "O'Connor-Smith",
        finishedAt: '2023-01-01T00:00:00Z',
      })

      expect(execution.name).toContain('çharacters')
      expect(execution.name).toContain('中文')
      expect(execution.name).toContain('العربية')
      expect(execution.description).toContain('\n')
      expect(execution.description).toContain('\t')
      expect(execution.description).toContain('\r')
      expect(execution.indicators).toContain('🌟')
      expect(execution.id).toContain('🚀')
    })
  })

  describe('property access and modification', () => {
    let execution: Execution

    beforeEach(() => {
      mockGetUserFullName.mockReturnValue('Test User')
      execution = new Execution({
        message: 'Test Message',
        createdAt: '2023-01-01T00:00:00Z',
        config: { solver: 'TEST' },
        state: 1,
        solution_state: 200,
        name: 'Test Name',
        description: 'Test Description',
        indicators: '{"test": true}',
        dataHash: 'test-hash',
        schema: 'test-schema',
        instanceId: 'test-instance',
        id: 'test-exec',
        userId: 123,
      })
    })

    test('should allow property access', () => {
      expect(execution.message).toBe('Test Message')
      expect(execution.createdAt).toBe('2023-01-01T00:00:00Z')
      expect(execution.config).toEqual({ solver: 'TEST' })
      expect(execution.state).toBe(1)
      expect(execution.solution_state).toBe(200)
      expect(execution.name).toBe('Test Name')
      expect(execution.description).toBe('Test Description')
      expect(execution.indicators).toBe('{"test": true}')
      expect(execution.dataHash).toBe('test-hash')
      expect(execution.schema).toBe('test-schema')
      expect(execution.instanceId).toBe('test-instance')
      expect(execution.id).toBe('test-exec')
      expect(execution.userId).toBe(123)
      expect(execution.userName).toBeNull()
      expect(execution.finishedAt).toBeNull()
      expect(execution.userFullName).toBe('Test User')
    })

    test('should allow property modification', () => {
      execution.message = 'Updated Message'
      execution.state = 2
      execution.solution_state = 201
      execution.name = 'Updated Name'
      execution.userName = 'updated-user'
      execution.finishedAt = '2023-01-01T01:00:00Z'

      expect(execution.message).toBe('Updated Message')
      expect(execution.state).toBe(2)
      expect(execution.solution_state).toBe(201)
      expect(execution.name).toBe('Updated Name')
      expect(execution.userName).toBe('updated-user')
      expect(execution.finishedAt).toBe('2023-01-01T01:00:00Z')
    })

    test('should allow deep config modification', () => {
      execution.config.solver = 'UPDATED'
      execution.config.newProperty = 'new value'

      expect(execution.config.solver).toBe('UPDATED')
      expect(execution.config.newProperty).toBe('new value')
    })

    test('should enumerate properties', () => {
      const keys = Object.keys(execution)
      const expectedKeys = [
        'message', 'createdAt', 'finishedAt', 'config', 'state', 'solution_state',
        'name', 'description', 'indicators', 'dataHash', 'schema', 'instanceId',
        'id', 'userId', 'userName', 'userFullName'
      ]

      expectedKeys.forEach(key => {
        expect(keys).toContain(key)
      })
    })

    test('should serialize to JSON correctly', () => {
      const json = JSON.stringify(execution)
      const parsed = JSON.parse(json)

      expect(parsed.message).toBe('Test Message')
      expect(parsed.state).toBe(1)
      expect(parsed.config.solver).toBe('TEST')
      expect(parsed.userFullName).toBe('Test User')
    })
  })

  describe('getUserFullName integration', () => {
    test('should call getUserFullName with firstName and lastName', () => {
      mockGetUserFullName.mockReturnValue('Full Name Result')

      const execution = new Execution({
        message: 'Test',
        createdAt: '2023-01-01T00:00:00Z',
        config: {},
        state: 1,
        solution_state: 200,
        name: 'Test',
        description: 'Test',
        indicators: '{}',
        dataHash: 'hash',
        schema: 'schema',
        instanceId: 'instance',
        id: 'exec',
        userId: 123,
        userName: 'username',
        userFirstName: 'First',
        userLastName: 'Last',
      })

      expect(mockGetUserFullName).toHaveBeenCalledTimes(1)
      expect(mockGetUserFullName).toHaveBeenCalledWith('First', 'Last')
      expect(execution.userFullName).toBe('Full Name Result')
    })

    test('should handle getUserFullName with undefined parameters', () => {
      mockGetUserFullName.mockReturnValue('Undefined Result')

      const execution = new Execution({
        message: 'Test',
        createdAt: '2023-01-01T00:00:00Z',
        config: {},
        state: 1,
        solution_state: 200,
        name: 'Test',
        description: 'Test',
        indicators: '{}',
        dataHash: 'hash',
        schema: 'schema',
        instanceId: 'instance',
        id: 'exec',
        userId: 123,
        // No optional parameters
      })

      expect(mockGetUserFullName).toHaveBeenCalledWith(null, null)
      expect(execution.userFullName).toBe('Undefined Result')
    })

    test('should handle getUserFullName returning different types', () => {
      const testCases = [
        null,
        undefined,
        '',
        'string result',
        123,
        true,
        {},
        []
      ]

      testCases.forEach(returnValue => {
        mockGetUserFullName.mockReturnValue(returnValue)
        const execution = new Execution({
          message: 'Test',
          createdAt: '2023-01-01T00:00:00Z',
          config: {},
          state: 1,
          solution_state: 200,
          name: 'Test',
          description: 'Test',
          indicators: '{}',
          dataHash: 'hash',
          schema: 'schema',
          instanceId: 'instance',
          id: 'exec',
          userId: 123,
        })
        // getUserFullName might have fallback logic, so check actual value
        if (returnValue === null || returnValue === undefined || returnValue === '') {
          expect(execution.userFullName).toBeNull()
        } else {
          expect(execution.userFullName).toBe(returnValue)
        }
      })
    })

    test('should handle getUserFullName throwing an error', () => {
      mockGetUserFullName.mockImplementation(() => {
        throw new Error('getUserFullName failed')
      })

      expect(() => {
        new Execution({
          message: 'Test',
          createdAt: '2023-01-01T00:00:00Z',
          config: {},
          state: 1,
          solution_state: 200,
          name: 'Test',
          description: 'Test',
          indicators: '{}',
          dataHash: 'hash',
          schema: 'schema',
          instanceId: 'instance',
          id: 'exec',
          userId: 123,
        })
      }).toThrow('getUserFullName failed')
    })
  })

  describe('edge cases', () => {
    test('should handle very large numbers', () => {
      mockGetUserFullName.mockReturnValue('Large Numbers')

      const execution = new Execution({
        message: 'Large Numbers',
        createdAt: '2023-01-01T00:00:00Z',
        config: {},
        state: Number.MAX_SAFE_INTEGER,
        solution_state: Number.MAX_VALUE,
        name: 'Large',
        description: 'Large',
        indicators: '{}',
        dataHash: 'hash',
        schema: 'schema',
        instanceId: 'instance',
        id: 'exec',
        userId: Number.MAX_SAFE_INTEGER,
      })

      expect(execution.state).toBe(Number.MAX_SAFE_INTEGER)
      expect(execution.solution_state).toBe(Number.MAX_VALUE)
      expect(execution.userId).toBe(Number.MAX_SAFE_INTEGER)
    })

    test('should handle negative numbers', () => {
      mockGetUserFullName.mockReturnValue('Negative Numbers')

      const execution = new Execution({
        message: 'Negative',
        createdAt: '2023-01-01T00:00:00Z',
        config: {},
        state: -1,
        solution_state: -500,
        name: 'Negative',
        description: 'Negative',
        indicators: '{}',
        dataHash: 'hash',
        schema: 'schema',
        instanceId: 'instance',
        id: 'exec',
        userId: -999,
      })

      expect(execution.state).toBe(-1)
      expect(execution.solution_state).toBe(-500)
      expect(execution.userId).toBe(-999)
    })

    test('should handle zero values', () => {
      mockGetUserFullName.mockReturnValue('Zero Values')

      const execution = new Execution({
        message: '',
        createdAt: '',
        config: {},
        state: 0,
        solution_state: 0,
        name: '',
        description: '',
        indicators: '',
        dataHash: '',
        schema: '',
        instanceId: '',
        id: '',
        userId: 0,
      })

      expect(execution.state).toBe(0)
      expect(execution.solution_state).toBe(0)
      expect(execution.userId).toBe(0)
      expect(execution.message).toBe('')
      expect(execution.name).toBe('')
    })
  })
})