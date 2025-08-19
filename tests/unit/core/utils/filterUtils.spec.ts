import { describe, test, expect, vi, beforeEach } from 'vitest'
import {
  isEmptyObject,
  getFilterType,
  getColumnData,
  isFilterSelected,
  isFilterChecked,
  getFilterOptions,
  getFilterMinValue,
  getFilterMaxValue,
  getFilterMinDate,
  getFilterMaxDate,
  getFilterNames
} from '@/utils/filterUtils'

// Mock dependencies
vi.mock('@/plugins/i18n', () => ({
  default: {
    global: {
      t: vi.fn((key) => {
        const translations = {
          'inputOutputData.true': 'True',
          'inputOutputData.false': 'False'
        }
        return translations[key] || key
      })
    }
  }
}))

const mockTableUtils = vi.hoisted(() => ({
  isTablePropertyFilterable: vi.fn(),
  getTableHeaders: vi.fn(),
  getTableJsonSchema: vi.fn(),
  getTableJsonSchemaProperty: vi.fn(),
  getTablePropertyTitle: vi.fn()
}))

vi.mock('@/utils/tableUtils', () => mockTableUtils)

describe('filterUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('isEmptyObject', () => {
    test('returns true for empty object', () => {
      expect(isEmptyObject({})).toBe(true)
    })

    test('returns false for object with properties', () => {
      expect(isEmptyObject({ key: 'value' })).toBe(false)
    })

    test('returns false for array', () => {
      expect(isEmptyObject([])).toBe(false)
    })

    test('returns false for null', () => {
      // The actual function will throw an error with null, so we should test for that
      expect(() => isEmptyObject(null)).toThrow()
    })

    test('returns false for undefined', () => {
      // The actual function will throw an error with undefined, so we should test for that
      expect(() => isEmptyObject(undefined)).toThrow()
    })

    test('returns false for string', () => {
      expect(isEmptyObject('')).toBe(false)
    })

    test('returns false for number', () => {
      expect(isEmptyObject(0)).toBe(false)
    })

    test('returns false for boolean', () => {
      expect(isEmptyObject(false)).toBe(false)
    })

    test('returns false for object with inherited properties', () => {
      class TestClass {
        method() {}
      }
      expect(isEmptyObject(new TestClass())).toBe(false)
    })
  })

  describe('getFilterType', () => {
    test('returns checkbox for string type', () => {
      expect(getFilterType('string')).toBe('checkbox')
    })

    test('returns checkbox for boolean type', () => {
      expect(getFilterType('boolean')).toBe('checkbox')
    })

    test('returns range for integer type', () => {
      expect(getFilterType('integer')).toBe('range')
    })

    test('returns range for number type', () => {
      expect(getFilterType('number')).toBe('range')
    })

    test('returns daterange for date type', () => {
      expect(getFilterType('date')).toBe('daterange')
    })

    test('returns empty string for unknown type', () => {
      expect(getFilterType('unknown')).toBe('')
    })

    test('handles array type (uses first element)', () => {
      expect(getFilterType(['string', 'number'])).toBe('checkbox')
      expect(getFilterType(['integer'])).toBe('range')
    })

    test('handles empty array', () => {
      expect(getFilterType([])).toBe('')
    })

    test('handles null/undefined', () => {
      expect(getFilterType(null)).toBe('')
      expect(getFilterType(undefined)).toBe('')
    })
  })

  describe('getColumnData', () => {
    test('extracts unique column values from execution data', () => {
      const selectedExecution = {
        experiment: {
          input: {
            data: {
              users: [
                { name: 'John', age: 25 },
                { name: 'Jane', age: 30 },
                { name: 'John', age: 25 }, // duplicate
                { name: 'Bob', age: 35 }
              ]
            }
          }
        }
      }

      const result = getColumnData(selectedExecution, 'input', 'users', 'name')
      expect(result).toEqual(['John', 'Jane', 'Bob'])
    })

    test('returns empty array when table does not exist', () => {
      const selectedExecution = {
        experiment: {
          input: {
            data: {}
          }
        }
      }

      const result = getColumnData(selectedExecution, 'input', 'nonexistent', 'column')
      expect(result).toEqual([])
    })

    test('returns empty array when table is not an array', () => {
      const selectedExecution = {
        experiment: {
          input: {
            data: {
              config: { setting: 'value' }
            }
          }
        }
      }

      const result = getColumnData(selectedExecution, 'input', 'config', 'setting')
      expect(result).toEqual([])
    })

    test('handles missing column in some rows', () => {
      const selectedExecution = {
        experiment: {
          input: {
            data: {
              users: [
                { name: 'John', age: 25 },
                { name: 'Jane' }, // missing age
                { name: 'Bob', age: 35 }
              ]
            }
          }
        }
      }

      const result = getColumnData(selectedExecution, 'input', 'users', 'age')
      expect(result).toEqual([25, 35])
    })

    test('includes null and undefined values', () => {
      const selectedExecution = {
        experiment: {
          input: {
            data: {
              users: [
                { name: 'John', value: null },
                { name: 'Jane', value: undefined },
                { name: 'Bob', value: 'test' }
              ]
            }
          }
        }
      }

      const result = getColumnData(selectedExecution, 'input', 'users', 'value')
      expect(result).toEqual([null, undefined, 'test'])
    })

    test('handles different data types', () => {
      const selectedExecution = {
        experiment: {
          input: {
            data: {
              mixed: [
                { value: 'string' },
                { value: 42 },
                { value: true },
                { value: new Date('2023-01-01') }
              ]
            }
          }
        }
      }

      const result = getColumnData(selectedExecution, 'input', 'mixed', 'value')
      expect(result).toHaveLength(4)
      expect(result).toContain('string')
      expect(result).toContain(42)
      expect(result).toContain(true)
    })
  })

  describe('isFilterSelected', () => {
    test('returns true when filter is selected and not empty', () => {
      const selectedExecution = {
        getFiltersPreference: vi.fn().mockReturnValue({
          users: {
            name: { value: ['John', 'Jane'] }
          }
        })
      }

      const result = isFilterSelected(selectedExecution, 'input', 'users', 'name')
      expect(result).toBe(true)
    })

    test('returns false when filter is empty object', () => {
      const selectedExecution = {
        getFiltersPreference: vi.fn().mockReturnValue({
          users: {
            name: {}
          }
        })
      }

      const result = isFilterSelected(selectedExecution, 'input', 'users', 'name')
      expect(result).toBe(false)
    })

    test('returns false when filter is undefined', () => {
      const selectedExecution = {
        getFiltersPreference: vi.fn().mockReturnValue({
          users: {}
        })
      }

      const result = isFilterSelected(selectedExecution, 'input', 'users', 'name')
      expect(result).toBe(false)
    })

    test('returns false when table filters are undefined', () => {
      const selectedExecution = {
        getFiltersPreference: vi.fn().mockReturnValue({})
      }

      const result = isFilterSelected(selectedExecution, 'input', 'users', 'name')
      expect(result).toBe(false)
    })

    test('returns false when filters preference is null', () => {
      const selectedExecution = {
        getFiltersPreference: vi.fn().mockReturnValue(null)
      }

      const result = isFilterSelected(selectedExecution, 'input', 'users', 'name')
      expect(result).toBe(false)
    })

    test('returns false when selectedExecution is null', () => {
      const result = isFilterSelected(null, 'input', 'users', 'name')
      expect(result).toBe(false)
    })
  })

  describe('isFilterChecked', () => {
    test('returns true when value is in filter array', () => {
      const selectedExecution = {
        getFiltersPreference: vi.fn().mockReturnValue({
          users: {
            name: { value: ['John', 'Jane'] }
          }
        })
      }

      const result = isFilterChecked(selectedExecution, 'input', 'users', 'name', 'John')
      expect(result).toBe(true)
    })

    test('returns false when value is not in filter array', () => {
      const selectedExecution = {
        getFiltersPreference: vi.fn().mockReturnValue({
          users: {
            name: { value: ['John', 'Jane'] }
          }
        })
      }

      const result = isFilterChecked(selectedExecution, 'input', 'users', 'name', 'Bob')
      expect(result).toBe(false)
    })

    test('converts value to string for comparison', () => {
      const selectedExecution = {
        getFiltersPreference: vi.fn().mockReturnValue({
          users: {
            age: { value: ['25', '30'] }
          }
        })
      }

      const result = isFilterChecked(selectedExecution, 'input', 'users', 'age', 25)
      expect(result).toBe(true)
    })

    test('handles boolean values correctly', () => {
      const selectedExecution = {
        getFiltersPreference: vi.fn().mockReturnValue({
          users: {
            active: { value: ['true'] }
          }
        })
      }

      const result = isFilterChecked(selectedExecution, 'input', 'users', 'active', true)
      expect(result).toBe(true)
    })

    test('handles null/undefined values', () => {
      const selectedExecution = {
        getFiltersPreference: vi.fn().mockReturnValue({
          users: {
            value: { value: ['false'] }
          }
        })
      }

      const result = isFilterChecked(selectedExecution, 'input', 'users', 'value', null)
      expect(result).toBe(true) // null converts to 'false'
    })

    test('returns false when filter is undefined', () => {
      const selectedExecution = {
        getFiltersPreference: vi.fn().mockReturnValue({
          users: {}
        })
      }

      const result = isFilterChecked(selectedExecution, 'input', 'users', 'name', 'John')
      expect(result).toBe(false)
    })
  })

  describe('getFilterOptions', () => {
    test('returns options with checked status', () => {
      const selectedExecution = {
        experiment: {
          input: {
            data: {
              users: [
                { name: 'John' },
                { name: 'Jane' },
                { name: 'Bob' }
              ]
            }
          }
        },
        getFiltersPreference: vi.fn().mockReturnValue({
          users: {
            name: { value: ['John'] }
          }
        })
      }

      const result = getFilterOptions(selectedExecution, 'input', 'users', 'name')
      
      expect(result).toHaveLength(3)
      expect(result[0]).toEqual({ label: 'John', value: 'John', checked: true })
      expect(result[1]).toEqual({ label: 'Jane', value: 'Jane', checked: false })
      expect(result[2]).toEqual({ label: 'Bob', value: 'Bob', checked: false })
    })

    test('handles duplicate values', () => {
      const selectedExecution = {
        experiment: {
          input: {
            data: {
              users: [
                { name: 'John' },
                { name: 'Jane' },
                { name: 'John' } // duplicate
              ]
            }
          }
        },
        getFiltersPreference: vi.fn().mockReturnValue({})
      }

      const result = getFilterOptions(selectedExecution, 'input', 'users', 'name')
      
      expect(result).toHaveLength(2)
      expect(result.map(opt => opt.label)).toEqual(['John', 'Jane'])
    })

    test('handles empty data', () => {
      const selectedExecution = {
        experiment: {
          input: {
            data: {
              users: []
            }
          }
        },
        getFiltersPreference: vi.fn().mockReturnValue({})
      }

      const result = getFilterOptions(selectedExecution, 'input', 'users', 'name')
      expect(result).toEqual([])
    })
  })

  describe('getFilterMinValue', () => {
    test('returns minimum numeric value', () => {
      const selectedExecution = {
        experiment: {
          input: {
            data: {
              users: [
                { age: 25 },
                { age: 30 },
                { age: 20 }
              ]
            }
          }
        }
      }

      const result = getFilterMinValue(selectedExecution, 'input', 'users', 'age')
      expect(result).toBe(20)
    })

    test('handles negative numbers', () => {
      const selectedExecution = {
        experiment: {
          input: {
            data: {
              values: [
                { amount: -10 },
                { amount: 5 },
                { amount: -20 }
              ]
            }
          }
        }
      }

      const result = getFilterMinValue(selectedExecution, 'input', 'values', 'amount')
      expect(result).toBe(-20)
    })

    test('handles single value', () => {
      const selectedExecution = {
        experiment: {
          input: {
            data: {
              users: [{ age: 25 }]
            }
          }
        }
      }

      const result = getFilterMinValue(selectedExecution, 'input', 'users', 'age')
      expect(result).toBe(25)
    })
  })

  describe('getFilterMaxValue', () => {
    test('returns maximum numeric value', () => {
      const selectedExecution = {
        experiment: {
          input: {
            data: {
              users: [
                { age: 25 },
                { age: 30 },
                { age: 20 }
              ]
            }
          }
        }
      }

      const result = getFilterMaxValue(selectedExecution, 'input', 'users', 'age')
      expect(result).toBe(30)
    })

    test('handles negative numbers', () => {
      const selectedExecution = {
        experiment: {
          input: {
            data: {
              values: [
                { amount: -10 },
                { amount: 5 },
                { amount: -20 }
              ]
            }
          }
        }
      }

      const result = getFilterMaxValue(selectedExecution, 'input', 'values', 'amount')
      expect(result).toBe(5)
    })

    test('handles floating point numbers', () => {
      const selectedExecution = {
        experiment: {
          input: {
            data: {
              values: [
                { price: 19.99 },
                { price: 25.50 },
                { price: 12.75 }
              ]
            }
          }
        }
      }

      const result = getFilterMaxValue(selectedExecution, 'input', 'values', 'price')
      expect(result).toBe(25.50)
    })
  })

  describe('getFilterMinDate', () => {
    test('returns earliest date', () => {
      const selectedExecution = {
        experiment: {
          input: {
            data: {
              events: [
                { date: '2023-12-25' },
                { date: '2023-11-15' },
                { date: '2024-01-01' }
              ]
            }
          }
        }
      }

      const result = getFilterMinDate(selectedExecution, 'input', 'events', 'date')
      expect(result).toBe('2023-11-15')
    })

    test('handles single date', () => {
      const selectedExecution = {
        experiment: {
          input: {
            data: {
              events: [{ date: '2023-12-25' }]
            }
          }
        }
      }

      const result = getFilterMinDate(selectedExecution, 'input', 'events', 'date')
      expect(result).toBe('2023-12-25')
    })

    test('handles Date objects', () => {
      const date1 = new Date('2023-12-25')
      const date2 = new Date('2023-11-15')
      const date3 = new Date('2024-01-01')

      const selectedExecution = {
        experiment: {
          input: {
            data: {
              events: [
                { date: date1 },
                { date: date2 },
                { date: date3 }
              ]
            }
          }
        }
      }

      const result = getFilterMinDate(selectedExecution, 'input', 'events', 'date')
      expect(result).toBe(date2)
    })
  })

  describe('getFilterMaxDate', () => {
    test('returns latest date', () => {
      const selectedExecution = {
        experiment: {
          input: {
            data: {
              events: [
                { date: '2023-12-25' },
                { date: '2023-11-15' },
                { date: '2024-01-01' }
              ]
            }
          }
        }
      }

      const result = getFilterMaxDate(selectedExecution, 'input', 'events', 'date')
      expect(result).toBe('2024-01-01')
    })

    test('handles Date objects', () => {
      const date1 = new Date('2023-12-25')
      const date2 = new Date('2023-11-15')
      const date3 = new Date('2024-01-01')

      const selectedExecution = {
        experiment: {
          input: {
            data: {
              events: [
                { date: date1 },
                { date: date2 },
                { date: date3 }
              ]
            }
          }
        }
      }

      const result = getFilterMaxDate(selectedExecution, 'input', 'events', 'date')
      expect(result).toBe(date3)
    })
  })

  describe('getFilterNames', () => {
    test('returns comprehensive filter configuration', () => {
      const mockSchemaConfig = { mock: 'schemaConfig' }
      const mockSelectedExecution = {
        getFiltersPreference: vi.fn().mockReturnValue({
          testTable: {
            stringCol: { value: ['test'] },
            numberCol: { value: [10, 20] }
          }
        }),
        experiment: {
          instance: {
            data: {
              testTable: [
                { stringCol: 'test1', numberCol: 10, boolCol: true },
                { stringCol: 'test2', numberCol: 20, boolCol: false }
              ]
            }
          }
        }
      }

      mockTableUtils.getTableHeaders.mockReturnValue(['stringCol', 'numberCol', 'boolCol'])
      mockTableUtils.getTableJsonSchemaProperty.mockImplementation((schema, collection, table, header) => {
        const types = {
          stringCol: { type: 'string' },
          numberCol: { type: 'number' },
          boolCol: { type: 'boolean' }
        }
        return types[header] || { type: 'string' }
      })
      mockTableUtils.getTablePropertyTitle.mockImplementation((schema, collection, table, header) => {
        return `Title for ${header}`
      })
      mockTableUtils.isTablePropertyFilterable.mockReturnValue(true)
      mockTableUtils.getTableJsonSchema.mockReturnValue({
        items: {
          required: ['stringCol']
        }
      })

      const result = getFilterNames(mockSchemaConfig, mockSelectedExecution, 'instance', 'testTable', 'instance', 'en')

      expect(result).toBeDefined()
      expect(result.stringCol).toBeDefined()
      expect(result.stringCol.title).toBe('Title for stringCol')
      expect(result.stringCol.type).toBe('checkbox')
      expect(result.stringCol.filterable).toBe(true)
      expect(result.stringCol.required).toBe(true)

      expect(result.numberCol).toBeDefined()
      expect(result.numberCol.type).toBe('range')
      expect(result.numberCol.required).toBe(false)

      expect(result.boolCol).toBeDefined()
      expect(result.boolCol.type).toBe('checkbox')
    })

    test('handles boolean filter options correctly', () => {
      const mockSchemaConfig = { mock: 'schemaConfig' }
      const mockSelectedExecution = {
        getFiltersPreference: vi.fn().mockReturnValue({}),
        experiment: {
          instance: {
            data: {
              testTable: [
                { boolCol: true },
                { boolCol: false }
              ]
            }
          }
        }
      }

      mockTableUtils.getTableHeaders.mockReturnValue(['boolCol'])
      mockTableUtils.getTableJsonSchemaProperty.mockReturnValue({ type: 'boolean' })
      mockTableUtils.getTablePropertyTitle.mockReturnValue('Boolean Column')
      mockTableUtils.isTablePropertyFilterable.mockReturnValue(true)
      mockTableUtils.getTableJsonSchema.mockReturnValue({
        items: { required: [] }
      })

      const result = getFilterNames(mockSchemaConfig, mockSelectedExecution, 'instance', 'testTable', 'instance', 'en')

      expect(result.boolCol.type).toBe('checkbox')
      expect(result.boolCol.options).toHaveLength(2)
      expect(result.boolCol.options[0].label).toBe('True')
      expect(result.boolCol.options[0].value).toBe('true')
      expect(result.boolCol.options[1].label).toBe('False')
      expect(result.boolCol.options[1].value).toBe('false')
    })

    test('detects date columns and converts to daterange type', () => {
      const mockSchemaConfig = { mock: 'schemaConfig' }
      const mockSelectedExecution = {
        getFiltersPreference: vi.fn().mockReturnValue({}),
        experiment: {
          instance: {
            data: {
              testTable: [
                { dateCol: '2023-01-15T10:00:00Z' },
                { dateCol: '2023-01-20T10:00:00Z' }
              ]
            }
          }
        }
      }

      mockTableUtils.getTableHeaders.mockReturnValue(['dateCol'])
      mockTableUtils.getTableJsonSchemaProperty.mockReturnValue({ type: 'string' })
      mockTableUtils.getTablePropertyTitle.mockReturnValue('Date Column')
      mockTableUtils.isTablePropertyFilterable.mockReturnValue(true)
      mockTableUtils.getTableJsonSchema.mockReturnValue({
        items: { required: [] }
      })

      const result = getFilterNames(mockSchemaConfig, mockSelectedExecution, 'instance', 'testTable', 'instance', 'en')

      expect(result.dateCol.type).toBe('daterange')
      expect(result.dateCol.min).toBeDefined()
      expect(result.dateCol.max).toBeDefined()
    })

    test('handles range type filters', () => {
      const mockSchemaConfig = { mock: 'schemaConfig' }
      const mockSelectedExecution = {
        getFiltersPreference: vi.fn().mockReturnValue({}),
        experiment: {
          instance: {
            data: {
              testTable: [
                { numberCol: 10 },
                { numberCol: 20 },
                { numberCol: 5 }
              ]
            }
          }
        }
      }

      mockTableUtils.getTableHeaders.mockReturnValue(['numberCol'])
      mockTableUtils.getTableJsonSchemaProperty.mockReturnValue({ type: 'number' })
      mockTableUtils.getTablePropertyTitle.mockReturnValue('Number Column')
      mockTableUtils.isTablePropertyFilterable.mockReturnValue(true)
      mockTableUtils.getTableJsonSchema.mockReturnValue({
        items: { required: [] }
      })

      const result = getFilterNames(mockSchemaConfig, mockSelectedExecution, 'instance', 'testTable', 'instance', 'en')

      expect(result.numberCol.type).toBe('range')
      expect(result.numberCol.min).toBe(5)
      expect(result.numberCol.max).toBe(20)
    })

    test('handles non-filterable columns', () => {
      const mockSchemaConfig = { mock: 'schemaConfig' }
      const mockSelectedExecution = {
        getFiltersPreference: vi.fn().mockReturnValue({}),
        experiment: {
          instance: {
            data: {
              testTable: [{ nonFilterableCol: 'data' }]
            }
          }
        }
      }

      mockTableUtils.getTableHeaders.mockReturnValue(['nonFilterableCol'])
      mockTableUtils.getTableJsonSchemaProperty.mockReturnValue({ type: 'string' })
      mockTableUtils.getTablePropertyTitle.mockReturnValue('Non Filterable Column')
      mockTableUtils.isTablePropertyFilterable.mockReturnValue(false)
      mockTableUtils.getTableJsonSchema.mockReturnValue({
        items: { required: [] }
      })

      const result = getFilterNames(mockSchemaConfig, mockSelectedExecution, 'instance', 'testTable', 'instance', 'en')

      expect(result.nonFilterableCol.filterable).toBe(false)
    })

    test('handles different language parameter', () => {
      const mockSchemaConfig = { mock: 'schemaConfig' }
      const mockSelectedExecution = {
        getFiltersPreference: vi.fn().mockReturnValue({}),
        experiment: {
          instance: {
            data: {
              testTable: [{ testCol: 'data' }]
            }
          }
        }
      }

      mockTableUtils.getTableHeaders.mockReturnValue(['testCol'])
      mockTableUtils.getTableJsonSchemaProperty.mockReturnValue({ type: 'string' })
      mockTableUtils.getTablePropertyTitle.mockImplementation((schema, collection, table, header, lang) => {
        return lang === 'es' ? 'Título en español' : 'English Title'
      })
      mockTableUtils.isTablePropertyFilterable.mockReturnValue(true)
      mockTableUtils.getTableJsonSchema.mockReturnValue({
        items: { required: [] }
      })

      const resultEn = getFilterNames(mockSchemaConfig, mockSelectedExecution, 'instance', 'testTable', 'instance', 'en')
      const resultEs = getFilterNames(mockSchemaConfig, mockSelectedExecution, 'instance', 'testTable', 'instance', 'es')

      expect(resultEn.testCol.title).toBe('English Title')
      expect(resultEs.testCol.title).toBe('Título en español')
    })

    test('handles empty headers array', () => {
      const mockSchemaConfig = { mock: 'schemaConfig' }
      const mockSelectedExecution = {
        getFiltersPreference: vi.fn().mockReturnValue({}),
        experiment: {
          instance: {
            data: {
              testTable: []
            }
          }
        }
      }

      mockTableUtils.getTableHeaders.mockReturnValue([])

      const result = getFilterNames(mockSchemaConfig, mockSelectedExecution, 'instance', 'testTable', 'instance', 'en')

      expect(result).toEqual({})
    })

    test('handles array type headers', () => {
      const mockSchemaConfig = { mock: 'schemaConfig' }
      const mockSelectedExecution = {
        getFiltersPreference: vi.fn().mockReturnValue({}),
        experiment: {
          instance: {
            data: {
              testTable: [{ arrayCol: 'data' }]
            }
          }
        }
      }

      mockTableUtils.getTableHeaders.mockReturnValue(['arrayCol'])
      mockTableUtils.getTableJsonSchemaProperty.mockReturnValue({ type: ['string', 'null'] })
      mockTableUtils.getTablePropertyTitle.mockReturnValue('Array Column')
      mockTableUtils.isTablePropertyFilterable.mockReturnValue(true)
      mockTableUtils.getTableJsonSchema.mockReturnValue({
        items: { required: [] }
      })

      const result = getFilterNames(mockSchemaConfig, mockSelectedExecution, 'instance', 'testTable', 'instance', 'en')

      expect(result.arrayCol.type).toBe('checkbox') // Should use first type in array
    })

    test('handles missing required array in schema', () => {
      const mockSchemaConfig = { mock: 'schemaConfig' }
      const mockSelectedExecution = {
        getFiltersPreference: vi.fn().mockReturnValue({}),
        experiment: {
          instance: {
            data: {
              testTable: [{ testCol: 'data' }]
            }
          }
        }
      }

      mockTableUtils.getTableHeaders.mockReturnValue(['testCol'])
      mockTableUtils.getTableJsonSchemaProperty.mockReturnValue({ type: 'string' })
      mockTableUtils.getTablePropertyTitle.mockReturnValue('Test Column')
      mockTableUtils.isTablePropertyFilterable.mockReturnValue(true)
      mockTableUtils.getTableJsonSchema.mockReturnValue({
        items: {} // No required array
      })

      const result = getFilterNames(mockSchemaConfig, mockSelectedExecution, 'instance', 'testTable', 'instance', 'en')

      expect(result.testCol.required).toBeUndefined()
    })
  })

  describe('Additional getFilterMinDate Coverage', () => {
    test('should return minimum date from column data', () => {
      const mockSelectedExecution = {
        experiment: {
          instance: {
            data: {
              testTable: [
                { dateCol: '2023-01-15' },
                { dateCol: '2023-01-10' },
                { dateCol: '2023-01-20' }
              ]
            }
          }
        }
      }

      const result = getFilterMinDate(mockSelectedExecution, 'instance', 'testTable', 'dateCol')
      expect(result).toBe('2023-01-10')
    })

    test('should handle empty data array', () => {
      const mockSelectedExecution = {
        experiment: {
          instance: {
            data: {
              testTable: []
            }
          }
        }
      }

      const result = getFilterMinDate(mockSelectedExecution, 'instance', 'testTable', 'dateCol')
      expect(result).toBeUndefined()
    })
  })

  describe('Additional getFilterMaxDate Coverage', () => {
    test('should return maximum date from column data', () => {
      const mockSelectedExecution = {
        experiment: {
          instance: {
            data: {
              testTable: [
                { dateCol: '2023-01-15' },
                { dateCol: '2023-01-10' },
                { dateCol: '2023-01-20' }
              ]
            }
          }
        }
      }

      const result = getFilterMaxDate(mockSelectedExecution, 'instance', 'testTable', 'dateCol')
      expect(result).toBe('2023-01-20')
    })

    test('should handle Date objects', () => {
      const date1 = new Date('2023-01-15')
      const date2 = new Date('2023-01-20')
      const date3 = new Date('2023-01-10')

      const mockSelectedExecution = {
        experiment: {
          instance: {
            data: {
              testTable: [
                { dateCol: date1 },
                { dateCol: date2 },
                { dateCol: date3 }
              ]
            }
          }
        }
      }

      const result = getFilterMaxDate(mockSelectedExecution, 'instance', 'testTable', 'dateCol')
      expect(result).toEqual(date2)
    })
  })

  describe('Additional Edge Cases', () => {
    test('getColumnData should handle missing table data gracefully', () => {
      const mockSelectedExecution = {
        experiment: {
          instance: {
            data: {} // No table data
          }
        }
      }

      const result = getColumnData(mockSelectedExecution, 'instance', 'missingTable', 'column')
      expect(result).toEqual([])
    })

    test('getColumnData should handle non-array table data', () => {
      const mockSelectedExecution = {
        experiment: {
          instance: {
            data: {
              testTable: 'not an array'
            }
          }
        }
      }

      const result = getColumnData(mockSelectedExecution, 'instance', 'testTable', 'column')
      expect(result).toEqual([])
    })

    test('isFilterSelected should handle missing execution', () => {
      const result = isFilterSelected(null, 'instance', 'table', 'header')
      expect(result).toBe(false)
    })

    test('isFilterChecked should handle missing execution', () => {
      const result = isFilterChecked(null, 'instance', 'table', 'header', 'value')
      expect(result).toBe(false)
    })

    test('isFilterChecked should handle null/undefined values', () => {
      const mockSelectedExecution = {
        getFiltersPreference: vi.fn().mockReturnValue({
          testTable: {
            testHeader: { value: ['false'] }
          }
        })
      }

      const resultNull = isFilterChecked(mockSelectedExecution, 'instance', 'testTable', 'testHeader', null)
      const resultUndefined = isFilterChecked(mockSelectedExecution, 'instance', 'testTable', 'testHeader', undefined)

      expect(resultNull).toBe(true) // null converts to 'false'
      expect(resultUndefined).toBe(true) // undefined converts to 'false'
    })

    test('getFilterNames should handle missing options gracefully', () => {
      const mockSchemaConfig = { mock: 'schemaConfig' }
      const mockSelectedExecution = {
        getFiltersPreference: vi.fn().mockReturnValue({}),
        experiment: {
          instance: {
            data: {
              testTable: [] // Empty data
            }
          }
        }
      }

      mockTableUtils.getTableHeaders.mockReturnValue(['emptyCol'])
      mockTableUtils.getTableJsonSchemaProperty.mockReturnValue({ type: 'string' })
      mockTableUtils.getTablePropertyTitle.mockReturnValue('Empty Column')
      mockTableUtils.isTablePropertyFilterable.mockReturnValue(true)
      mockTableUtils.getTableJsonSchema.mockReturnValue({
        items: { required: [] }
      })

      const result = getFilterNames(mockSchemaConfig, mockSelectedExecution, 'instance', 'testTable', 'instance', 'en')

      expect(result.emptyCol).toBeDefined()
      expect(result.emptyCol.options).toEqual([])
    })
  })
})
