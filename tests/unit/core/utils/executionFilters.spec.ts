import { describe, test, expect, vi, beforeEach } from 'vitest'

const mockParameters = vi.hoisted(() => ({}) as Record<string, unknown>)

vi.mock('@/app/config', () => ({
  default: { getCore: () => ({ parameters: mockParameters }) },
}))

import {
  readExecutionFilters,
  readSchemaLabels,
  resolveExecutionsListEndpoint,
  hasFilterValue,
  toFilterQueryParams,
  isSameOptionValue,
} from '@cornflow-ui/core/utils/executionFilters'
import { parseNameList } from '@cornflow-ui/core/utils/common'

const PLANT = {
  key: 'plant_id',
  labelKey: 'plant',
  optionsEndpoint: '/user/plants/',
  valueField: 'plant_id',
}

describe('executionFilters utils', () => {
  beforeEach(() => {
    for (const key of Object.keys(mockParameters)) delete mockParameters[key]
  })

  describe('readExecutionFilters', () => {
    test('is empty when the app declares no filters', () => {
      expect(readExecutionFilters()).toEqual([])
    })

    test('keeps the filters with key, options endpoint and value field, in order', () => {
      mockParameters.executionFilters = [
        PLANT,
        { key: 'program_id', labelKey: 'program' },
        { ...PLANT, key: 'program_id', dependsOn: 'plant_id' },
        'not a filter',
      ]

      expect(readExecutionFilters().map((filter) => filter.key)).toEqual([
        'plant_id',
        'program_id',
      ])
    })

    test('is empty when executionFilters is not a list', () => {
      mockParameters.executionFilters = { plant: PLANT }
      expect(readExecutionFilters()).toEqual([])
    })
  })

  describe('readSchemaLabels', () => {
    test('returns the labels the app declares, or none', () => {
      expect(readSchemaLabels()).toEqual({})
      mockParameters.schemaLabels = { planning_dag: 'Planning' }
      expect(readSchemaLabels()).toEqual({ planning_dag: 'Planning' })
    })
  })

  describe('resolveExecutionsListEndpoint', () => {
    test("is Cornflow's GET /execution/ unless the app declares another", () => {
      expect(resolveExecutionsListEndpoint()).toEqual({
        path: '/execution/',
        isExternal: false,
      })

      mockParameters.executionsListEndpoint = {
        path: '/executions/',
        isExternal: true,
      }
      expect(resolveExecutionsListEndpoint()).toEqual({
        path: '/executions/',
        isExternal: true,
      })
    })

    test('ignores a declaration without path', () => {
      mockParameters.executionsListEndpoint = { isExternal: true }
      expect(resolveExecutionsListEndpoint().path).toBe('/execution/')
    })
  })

  describe('values', () => {
    test('"All" and missing values are not picked values', () => {
      expect(hasFilterValue(null)).toBe(false)
      expect(hasFilterValue(undefined)).toBe(false)
      expect(hasFilterValue('')).toBe(false)
      expect(hasFilterValue(0)).toBe(true)
      expect(hasFilterValue('101')).toBe(true)
    })

    test('query parameters are strings and leave out "All"', () => {
      expect(toFilterQueryParams({ plant_id: 101, program_id: null })).toEqual({
        plant_id: '101',
      })
    })

    test('values compare as strings', () => {
      expect(isSameOptionValue(101, '101')).toBe(true)
      expect(isSameOptionValue('102', '103')).toBe(false)
    })
  })
})

describe('parseNameList', () => {
  test('reads arrays and comma-separated strings, dropping blanks and repeats', () => {
    expect(parseNameList(['a', ' b ', 'a', '', 3])).toEqual(['a', 'b'])
    expect(parseNameList('a, b,,a')).toEqual(['a', 'b'])
  })

  test('is empty for anything else', () => {
    expect(parseNameList(undefined)).toEqual([])
    expect(parseNameList(null)).toEqual([])
    expect(parseNameList({})).toEqual([])
  })
})
