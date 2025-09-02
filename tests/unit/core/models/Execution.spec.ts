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

      const execution = new Execution(
        'Success',                    // message
        '2023-01-01T00:00:00Z',      // createdAt
        { solver: 'CBC' },           // config
        1,                           // state
        200,                         // solution_state
        'Test Execution',            // name
        'Test Description',          // description
        '{"kpi1": 100}',            // indicators
        'hash123',                   // dataHash
        'test-schema',               // schema
        'instance-123',              // instanceId
        'exec-456',                  // id
        789                          // userId
      )

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

      const execution = new Execution(
        'Completed',                 // message
        '2023-01-01T00:00:00Z',     // createdAt
        { solver: 'GUROBI' },       // config
        2,                          // state
        201,                        // solution_state
        'Full Execution',           // name
        'Full Description',         // description
        '{"kpi2": 200}',           // indicators
        'hash456',                  // dataHash
        'full-schema',              // schema
        'instance-456',             // instanceId
        'exec-789',                 // id
        123,                        // userId
        'jsmith',                   // userName
        'Jane',                     // userFirstName
        'Smith',                    // userLastName
        '2023-01-01T01:00:00Z'     // finishedAt
      )

      expect(execution.userName).toBe('jsmith')
      expect(execution.finishedAt).toBe('2023-01-01T01:00:00Z')
      expect(execution.userFullName).toBe('Jane Smith')
      expect(mockGetUserFullName).toHaveBeenCalledWith('Jane', 'Smith')
    })

    test('should handle null optional parameters', () => {
      mockGetUserFullName.mockReturnValue('Unknown User')

      const execution = new Execution(
        'Error',
        '2023-01-01T00:00:00Z',
        {},
        0,
        500,
        'Error Execution',
        'Error Description',
        '{}',
        'hash-error',
        'error-schema',
        'instance-error',
        'exec-error',
        999,
        null,    // userName
        null,    // userFirstName
        null,    // userLastName
        null     // finishedAt
      )

      expect(execution.userName).toBeNull()
      expect(execution.finishedAt).toBeNull()
      expect(execution.userFullName).toBe('Unknown User')
      expect(mockGetUserFullName).toHaveBeenCalledWith(null, null)
    })

    test('should handle empty strings for optional parameters', () => {
      mockGetUserFullName.mockReturnValue('')

      const execution = new Execution(
        'Empty',
        '2023-01-01T00:00:00Z',
        {},
        1,
        200,
        'Empty Execution',
        'Empty Description',
        '',
        '',
        '',
        '',
        '',
        0,
        '',      // userName
        '',      // userFirstName
        '',      // userLastName
        ''       // finishedAt
      )

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

      const execution = new Execution(
        'Complex Config',
        '2023-01-01T00:00:00Z',
        complexConfig,
        1,
        200,
        'Complex Execution',
        'Complex Description',
        '{"complex": true}',
        'complex-hash',
        'complex-schema',
        'complex-instance',
        'complex-exec',
        111
      )

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
        const execution = new Execution(
          'Date Test',
          dateFormat,
          {},
          1,
          200,
          'Date Execution',
          'Date Description',
          '{}',
          'date-hash',
          'date-schema',
          'date-instance',
          'date-exec',
          222,
          null,
          null,
          null,
          dateFormat
        )

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
        const execution = new Execution(
          'State Test',
          '2023-01-01T00:00:00Z',
          {},
          state,
          solution_state,
          'State Execution',
          'State Description',
          '{}',
          'state-hash',
          'state-schema',
          'state-instance',
          'state-exec',
          333
        )

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
        const execution = new Execution(
          'JSON Test',
          '2023-01-01T00:00:00Z',
          {},
          1,
          200,
          'JSON Execution',
          'JSON Description',
          indicators,
          'json-hash',
          'json-schema',
          'json-instance',
          'json-exec',
          444
        )

        expect(execution.indicators).toBe(indicators)
      })
    })

    test('should handle special characters in string fields', () => {
      mockGetUserFullName.mockReturnValue('Special Çharacters 中文 العربية')

      const execution = new Execution(
        'Success with émojis 🚀 and newlines\n\ttabs',
        '2023-01-01T00:00:00Z',
        { "special": "çharacters中文العربية" },
        1,
        200,
        'Execution with special çharacters 中文 العربية',
        'Description with\nnewlines\tand\rcarriage returns',
        '{"unicode": "🌟🚀💻"}',
        'hash-with-special-chars-çñü',
        'schema-çñü-中文',
        'instance-العربية',
        'exec-🚀',
        555,
        'user-çñü',
        'José María',
        "O'Connor-Smith",
        '2023-01-01T00:00:00Z'
      )

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
      execution = new Execution(
        'Test Message',
        '2023-01-01T00:00:00Z',
        { solver: 'TEST' },
        1,
        200,
        'Test Name',
        'Test Description',
        '{"test": true}',
        'test-hash',
        'test-schema',
        'test-instance',
        'test-exec',
        123
      )
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

      const execution = new Execution(
        'Test',
        '2023-01-01T00:00:00Z',
        {},
        1,
        200,
        'Test',
        'Test',
        '{}',
        'hash',
        'schema',
        'instance',
        'exec',
        123,
        'username',
        'First',
        'Last'
      )

      expect(mockGetUserFullName).toHaveBeenCalledTimes(1)
      expect(mockGetUserFullName).toHaveBeenCalledWith('First', 'Last')
      expect(execution.userFullName).toBe('Full Name Result')
    })

    test('should handle getUserFullName with undefined parameters', () => {
      mockGetUserFullName.mockReturnValue('Undefined Result')

      const execution = new Execution(
        'Test',
        '2023-01-01T00:00:00Z',
        {},
        1,
        200,
        'Test',
        'Test',
        '{}',
        'hash',
        'schema',
        'instance',
        'exec',
        123
        // No optional parameters
      )

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
        const execution = new Execution(
          'Test',
          '2023-01-01T00:00:00Z',
          {},
          1,
          200,
          'Test',
          'Test',
          '{}',
          'hash',
          'schema',
          'instance',
          'exec',
          123
        )
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
        new Execution(
          'Test',
          '2023-01-01T00:00:00Z',
          {},
          1,
          200,
          'Test',
          'Test',
          '{}',
          'hash',
          'schema',
          'instance',
          'exec',
          123
        )
      }).toThrow('getUserFullName failed')
    })
  })

  describe('edge cases', () => {
    test('should handle very large numbers', () => {
      mockGetUserFullName.mockReturnValue('Large Numbers')

      const execution = new Execution(
        'Large Numbers',
        '2023-01-01T00:00:00Z',
        {},
        Number.MAX_SAFE_INTEGER,
        Number.MAX_VALUE,
        'Large',
        'Large',
        '{}',
        'hash',
        'schema',
        'instance',
        'exec',
        Number.MAX_SAFE_INTEGER
      )

      expect(execution.state).toBe(Number.MAX_SAFE_INTEGER)
      expect(execution.solution_state).toBe(Number.MAX_VALUE)
      expect(execution.userId).toBe(Number.MAX_SAFE_INTEGER)
    })

    test('should handle negative numbers', () => {
      mockGetUserFullName.mockReturnValue('Negative Numbers')

      const execution = new Execution(
        'Negative',
        '2023-01-01T00:00:00Z',
        {},
        -1,
        -500,
        'Negative',
        'Negative',
        '{}',
        'hash',
        'schema',
        'instance',
        'exec',
        -999
      )

      expect(execution.state).toBe(-1)
      expect(execution.solution_state).toBe(-500)
      expect(execution.userId).toBe(-999)
    })

    test('should handle zero values', () => {
      mockGetUserFullName.mockReturnValue('Zero Values')

      const execution = new Execution(
        '',
        '',
        {},
        0,
        0,
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        0
      )

      expect(execution.state).toBe(0)
      expect(execution.solution_state).toBe(0)
      expect(execution.userId).toBe(0)
      expect(execution.message).toBe('')
      expect(execution.name).toBe('')
    })
  })
})