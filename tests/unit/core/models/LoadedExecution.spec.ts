import { describe, test, expect, vi, beforeEach } from 'vitest'
import { LoadedExecution } from '@/models/LoadedExecution'
import { ExperimentCore } from '@/models/Experiment'

// Mock the ExperimentCore
const mockExperiment = {
  hasSolution: vi.fn(),
  hasInstance: vi.fn(),
  instance: {
    id: 'instance-123',
    data: { table1: [] }
  },
  solution: {
    id: 'solution-456',
    data: { results: [] }
  }
}

describe('LoadedExecution', () => {
  let loadedExecution: LoadedExecution

  beforeEach(() => {
    vi.clearAllMocks()
    mockExperiment.hasSolution.mockReturnValue(true)
    mockExperiment.hasInstance.mockReturnValue(true)

    loadedExecution = new LoadedExecution(
      mockExperiment as any,
      'exec-123',
      'Test Execution',
      'Test Description',
      '2023-01-01T00:00:00Z',
      1,
      'Success',
      { solver: 'CBC' }
    )
  })

  describe('constructor', () => {
    test('should create a loaded execution with all properties', () => {
      expect(loadedExecution.experiment).toBe(mockExperiment)
      expect(loadedExecution.executionId).toBe('exec-123')
      expect(loadedExecution.name).toBe('Test Execution')
      expect(loadedExecution.description).toBe('Test Description')
      expect(loadedExecution.createdAt).toBe('2023-01-01T00:00:00Z')
      expect(loadedExecution.state).toBe(1)
      expect(loadedExecution.messageState).toBe('Success')
      expect(loadedExecution.config).toEqual({ solver: 'CBC' })
    })

    test('should initialize UI preferences with default values', () => {
      expect(loadedExecution.getSelectedTablePreference('instance')).toBeNull()
      expect(loadedExecution.getSelectedTablePreference('solution')).toBeNull()
      expect(loadedExecution.getFiltersPreference('instance')).toEqual({})
      expect(loadedExecution.getFiltersPreference('solution')).toEqual({})
      expect(loadedExecution.getDashboardPreferences()).toBeNull()
    })

    test('should handle empty string values', () => {
      const emptyExecution = new LoadedExecution(
        mockExperiment as any,
        '',
        '',
        '',
        '',
        0,
        '',
        {}
      )

      expect(emptyExecution.executionId).toBe('')
      expect(emptyExecution.name).toBe('')
      expect(emptyExecution.description).toBe('')
      expect(emptyExecution.createdAt).toBe('')
      expect(emptyExecution.messageState).toBe('')
    })

    test('should handle null and undefined values', () => {
      const nullExecution = new LoadedExecution(
        mockExperiment as any,
        'exec-null',
        'Null Test',
        null as any,
        '2023-01-01T00:00:00Z',
        -1,
        null as any,
        null
      )

      expect(nullExecution.description).toBeNull()
      expect(nullExecution.messageState).toBeNull()
      expect(nullExecution.config).toBeNull()
    })

    test('should handle complex config objects', () => {
      const complexConfig = {
        solver: 'GUROBI',
        parameters: {
          timeLimit: 3600,
          options: {
            presolve: true,
            cuts: 'auto'
          }
        },
        callbacks: {
          onProgress: () => {},
          onComplete: () => {}
        }
      }

      const complexExecution = new LoadedExecution(
        mockExperiment as any,
        'exec-complex',
        'Complex Execution',
        'Complex Description',
        '2023-01-01T00:00:00Z',
        2,
        'Completed',
        complexConfig
      )

      expect(complexExecution.config).toBe(complexConfig)
      expect(complexExecution.config.parameters.timeLimit).toBe(3600)
      expect(typeof complexExecution.config.callbacks.onProgress).toBe('function')
    })
  })

  describe('table preferences', () => {
    test('should set and get selected table preference for instance', () => {
      loadedExecution.setSelectedTablePreference('table1', 'instance')
      expect(loadedExecution.getSelectedTablePreference('instance')).toBe('table1')
    })

    test('should set and get selected table preference for solution', () => {
      loadedExecution.setSelectedTablePreference('results', 'solution')
      expect(loadedExecution.getSelectedTablePreference('solution')).toBe('results')
    })

    test('should handle multiple table preference changes', () => {
      loadedExecution.setSelectedTablePreference('table1', 'instance')
      loadedExecution.setSelectedTablePreference('table2', 'instance')
      expect(loadedExecution.getSelectedTablePreference('instance')).toBe('table2')

      loadedExecution.setSelectedTablePreference('results1', 'solution')
      loadedExecution.setSelectedTablePreference('results2', 'solution')
      expect(loadedExecution.getSelectedTablePreference('solution')).toBe('results2')
    })

    test('should handle empty string table names', () => {
      loadedExecution.setSelectedTablePreference('', 'instance')
      expect(loadedExecution.getSelectedTablePreference('instance')).toBe('')
    })

    test('should handle special characters in table names', () => {
      const specialTableName = 'table-with_special.chars@123'
      loadedExecution.setSelectedTablePreference(specialTableName, 'instance')
      expect(loadedExecution.getSelectedTablePreference('instance')).toBe(specialTableName)
    })

    test('should maintain separate preferences for instance and solution', () => {
      loadedExecution.setSelectedTablePreference('instance-table', 'instance')
      loadedExecution.setSelectedTablePreference('solution-table', 'solution')

      expect(loadedExecution.getSelectedTablePreference('instance')).toBe('instance-table')
      expect(loadedExecution.getSelectedTablePreference('solution')).toBe('solution-table')
    })
  })

  describe('filter preferences', () => {
    test('should set and get filter preferences for instance', () => {
      const filters = {
        status: ['active', 'inactive'],
        category: 'type1',
        range: { min: 0, max: 100 }
      }

      loadedExecution.setFiltersPreference(filters, 'instance')
      expect(loadedExecution.getFiltersPreference('instance')).toEqual(filters)
    })

    test('should set and get filter preferences for solution', () => {
      const filters = {
        feasible: true,
        cost: { min: 0, max: 1000 },
        variables: ['x1', 'x2', 'x3']
      }

      loadedExecution.setFiltersPreference(filters, 'solution')
      expect(loadedExecution.getFiltersPreference('solution')).toEqual(filters)
    })

    test('should handle null filter preferences', () => {
      loadedExecution.setFiltersPreference(null, 'instance')
      expect(loadedExecution.getFiltersPreference('instance')).toBeNull()
    })

    test('should handle empty object filter preferences', () => {
      loadedExecution.setFiltersPreference({}, 'solution')
      expect(loadedExecution.getFiltersPreference('solution')).toEqual({})
    })

    test('should handle complex nested filter objects', () => {
      const complexFilters = {
        level1: {
          level2: {
            level3: {
              values: [1, 2, 3],
              conditions: {
                operator: 'AND',
                rules: [
                  { field: 'name', operator: 'contains', value: 'test' },
                  { field: 'value', operator: '>', value: 10 }
                ]
              }
            }
          }
        },
        arrays: [
          { type: 'string', values: ['a', 'b', 'c'] },
          { type: 'number', values: [1, 2, 3] }
        ]
      }

      loadedExecution.setFiltersPreference(complexFilters, 'instance')
      const retrievedFilters = loadedExecution.getFiltersPreference('instance')

      expect(retrievedFilters.level1.level2.level3.values).toEqual([1, 2, 3])
      expect(retrievedFilters.arrays[0].values).toEqual(['a', 'b', 'c'])
    })

    test('should maintain separate filter preferences for instance and solution', () => {
      const instanceFilters = { instance: 'filter' }
      const solutionFilters = { solution: 'filter' }

      loadedExecution.setFiltersPreference(instanceFilters, 'instance')
      loadedExecution.setFiltersPreference(solutionFilters, 'solution')

      expect(loadedExecution.getFiltersPreference('instance')).toEqual(instanceFilters)
      expect(loadedExecution.getFiltersPreference('solution')).toEqual(solutionFilters)
    })

    test('should handle filter preference updates', () => {
      const initialFilters = { initial: 'value' }
      const updatedFilters = { updated: 'value', new: 'property' }

      loadedExecution.setFiltersPreference(initialFilters, 'instance')
      expect(loadedExecution.getFiltersPreference('instance')).toEqual(initialFilters)

      loadedExecution.setFiltersPreference(updatedFilters, 'instance')
      expect(loadedExecution.getFiltersPreference('instance')).toEqual(updatedFilters)
    })
  })

  describe('dashboard preferences', () => {
    test('should set and get dashboard preferences', () => {
      const dashboardConfig = {
        layout: 'grid',
        widgets: [
          { type: 'chart', id: 'chart1', position: { x: 0, y: 0 } },
          { type: 'table', id: 'table1', position: { x: 1, y: 0 } }
        ],
        theme: 'dark',
        autoRefresh: true
      }

      loadedExecution.setDashboardPreference(dashboardConfig)
      expect(loadedExecution.getDashboardPreferences()).toEqual(dashboardConfig)
    })

    test('should handle null dashboard preferences', () => {
      loadedExecution.setDashboardPreference(null)
      expect(loadedExecution.getDashboardPreferences()).toBeNull()
    })

    test('should handle undefined dashboard preferences', () => {
      loadedExecution.setDashboardPreference(undefined)
      expect(loadedExecution.getDashboardPreferences()).toBeUndefined()
    })

    test('should handle empty object dashboard preferences', () => {
      loadedExecution.setDashboardPreference({})
      expect(loadedExecution.getDashboardPreferences()).toEqual({})
    })

    test('should handle complex dashboard configurations', () => {
      const complexDashboard = {
        version: '2.0',
        metadata: {
          created: '2023-01-01',
          author: 'user123'
        },
        layout: {
          type: 'responsive',
          breakpoints: {
            xs: { cols: 1, margin: [5, 5] },
            sm: { cols: 2, margin: [10, 10] },
            md: { cols: 3, margin: [15, 15] }
          }
        },
        widgets: [
          {
            id: 'widget1',
            type: 'line-chart',
            config: {
              dataSource: 'execution-results',
              xAxis: 'time',
              yAxis: ['cost', 'profit'],
              colors: ['#ff0000', '#00ff00']
            },
            layout: { x: 0, y: 0, w: 2, h: 1 }
          }
        ],
        globalFilters: {
          dateRange: { start: '2023-01-01', end: '2023-12-31' },
          categories: ['type1', 'type2']
        }
      }

      loadedExecution.setDashboardPreference(complexDashboard)
      const retrieved = loadedExecution.getDashboardPreferences()

      expect(retrieved.layout.breakpoints.md.cols).toBe(3)
      expect(retrieved.widgets[0].config.colors).toEqual(['#ff0000', '#00ff00'])
      expect(retrieved.globalFilters.categories).toEqual(['type1', 'type2'])
    })

    test('should handle dashboard preference updates', () => {
      const initialDashboard = { layout: 'list' }
      const updatedDashboard = { layout: 'grid', theme: 'light' }

      loadedExecution.setDashboardPreference(initialDashboard)
      expect(loadedExecution.getDashboardPreferences()).toEqual(initialDashboard)

      loadedExecution.setDashboardPreference(updatedDashboard)
      expect(loadedExecution.getDashboardPreferences()).toEqual(updatedDashboard)
    })
  })

  describe('experiment delegation', () => {
    test('should delegate hasSolution to experiment', () => {
      mockExperiment.hasSolution.mockReturnValue(true)
      expect(loadedExecution.hasSolution()).toBe(true)
      expect(mockExperiment.hasSolution).toHaveBeenCalledTimes(1)

      mockExperiment.hasSolution.mockReturnValue(false)
      expect(loadedExecution.hasSolution()).toBe(false)
      expect(mockExperiment.hasSolution).toHaveBeenCalledTimes(2)
    })

    test('should delegate hasInstance to experiment', () => {
      mockExperiment.hasInstance.mockReturnValue(true)
      expect(loadedExecution.hasInstance()).toBe(true)
      expect(mockExperiment.hasInstance).toHaveBeenCalledTimes(1)

      mockExperiment.hasInstance.mockReturnValue(false)
      expect(loadedExecution.hasInstance()).toBe(false)
      expect(mockExperiment.hasInstance).toHaveBeenCalledTimes(2)
    })

    test('should handle experiment method errors', () => {
      mockExperiment.hasSolution.mockImplementation(() => {
        throw new Error('Experiment error')
      })

      expect(() => loadedExecution.hasSolution()).toThrow('Experiment error')
    })

    test('should handle experiment returning non-boolean values', () => {
      const testValues = [null, undefined, 0, 1, '', 'string', {}, []]

      testValues.forEach(value => {
        mockExperiment.hasSolution.mockReturnValue(value)
        expect(loadedExecution.hasSolution()).toBe(value)

        mockExperiment.hasInstance.mockReturnValue(value)
        expect(loadedExecution.hasInstance()).toBe(value)
      })
    })
  })

  describe('property access and modification', () => {
    test('should allow property access', () => {
      expect(loadedExecution.experiment).toBe(mockExperiment)
      expect(loadedExecution.executionId).toBe('exec-123')
      expect(loadedExecution.name).toBe('Test Execution')
      expect(loadedExecution.description).toBe('Test Description')
      expect(loadedExecution.createdAt).toBe('2023-01-01T00:00:00Z')
      expect(loadedExecution.state).toBe(1)
      expect(loadedExecution.messageState).toBe('Success')
      expect(loadedExecution.config).toEqual({ solver: 'CBC' })
    })

    test('should allow property modification', () => {
      loadedExecution.executionId = 'new-exec-id'
      loadedExecution.name = 'Updated Name'
      loadedExecution.description = 'Updated Description'
      loadedExecution.state = 2
      loadedExecution.messageState = 'Completed'

      expect(loadedExecution.executionId).toBe('new-exec-id')
      expect(loadedExecution.name).toBe('Updated Name')
      expect(loadedExecution.description).toBe('Updated Description')
      expect(loadedExecution.state).toBe(2)
      expect(loadedExecution.messageState).toBe('Completed')
    })

    test('should allow config modification', () => {
      loadedExecution.config.solver = 'GUROBI'
      loadedExecution.config.newProperty = 'new value'

      expect(loadedExecution.config.solver).toBe('GUROBI')
      expect(loadedExecution.config.newProperty).toBe('new value')
    })

    test('should handle experiment replacement', () => {
      const newExperiment = {
        hasSolution: vi.fn().mockReturnValue(false),
        hasInstance: vi.fn().mockReturnValue(false)
      }

      loadedExecution.experiment = newExperiment as any
      expect(loadedExecution.experiment).toBe(newExperiment)
      expect(loadedExecution.hasSolution()).toBe(false)
      expect(loadedExecution.hasInstance()).toBe(false)
    })

    test('should enumerate properties', () => {
      const keys = Object.keys(loadedExecution)
      const expectedKeys = [
        'experiment', 'executionId', 'name', 'description', 'createdAt',
        'state', 'messageState', 'config', 'uiPreferences'
      ]

      expectedKeys.forEach(key => {
        expect(keys).toContain(key)
      })
    })

    test('should serialize to JSON correctly', () => {
      // Note: uiPreferences is private, so it won't be in JSON unless there's a custom toJSON
      const json = JSON.stringify(loadedExecution)
      const parsed = JSON.parse(json)

      expect(parsed.executionId).toBe('exec-123')
      expect(parsed.name).toBe('Test Execution')
      expect(parsed.state).toBe(1)
      expect(parsed.config.solver).toBe('CBC')
    })
  })

  describe('edge cases', () => {
    test('should handle invalid preference types', () => {
      // TypeScript would prevent this, but testing runtime behavior
      expect(() => {
        loadedExecution.setSelectedTablePreference('table1', 'invalid' as any)
      }).not.toThrow()

      expect(() => {
        loadedExecution.getSelectedTablePreference('invalid' as any)
      }).not.toThrow()
    })

    test('should handle very large data structures', () => {
      const largeFilters = {}
      for (let i = 0; i < 1000; i++) {
        largeFilters[`filter${i}`] = {
          values: Array.from({ length: 100 }, (_, j) => `value${i}_${j}`),
          metadata: { index: i, created: new Date() }
        }
      }

      loadedExecution.setFiltersPreference(largeFilters, 'instance')
      const retrieved = loadedExecution.getFiltersPreference('instance')

      expect(Object.keys(retrieved)).toHaveLength(1000)
      expect(retrieved.filter999.values).toHaveLength(100)
    })

    test('should handle circular references in preferences', () => {
      const circularObject: any = { type: 'circular' }
      circularObject.self = circularObject

      loadedExecution.setFiltersPreference(circularObject, 'instance')
      const retrieved = loadedExecution.getFiltersPreference('instance')

      expect(retrieved.self).toBe(circularObject)
      expect(retrieved.self.self).toBe(circularObject)
    })
  })
})
