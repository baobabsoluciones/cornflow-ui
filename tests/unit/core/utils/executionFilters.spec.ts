import { describe, test, expect, vi, beforeEach } from 'vitest'

const mockParameters = vi.hoisted(() => ({}) as Record<string, unknown>)

vi.mock('@/app/config', () => ({
  default: { getCore: () => ({ parameters: mockParameters }) },
}))

import {
  readExecutionFilters,
  resolveExecutionsListEndpoint,
  hasFilterValue,
  toFilterQueryParams,
} from '@cornflow-ui/core/utils/executionFilters'

const PLANT = { key: 'plant_id', labelKey: 'plant', joinFrom: 'plants.name' }

describe('executionFilters utils', () => {
  beforeEach(() => {
    for (const key of Object.keys(mockParameters)) delete mockParameters[key]
  })

  describe('readExecutionFilters', () => {
    test('is empty when the app declares no filters', () => {
      expect(readExecutionFilters()).toEqual([])
    })

    test('keeps the filters with a key and a <table>.<column> joinFrom, in order', () => {
      mockParameters.executionFilters = [
        PLANT,
        { key: 'program_id', labelKey: 'program' },
        { key: 'region_id', labelKey: 'region', joinFrom: 'regions' },
        { key: 'program_id', labelKey: 'program', joinFrom: 'programs.name' },
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
      expect(hasFilterValue(1)).toBe(true)
    })

    test('query parameters are strings and leave out "All"', () => {
      expect(toFilterQueryParams({ plant_id: 1, program_id: null })).toEqual({
        plant_id: '1',
      })
    })
  })
})
