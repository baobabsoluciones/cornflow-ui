import { describe, test, expect, vi, beforeEach } from 'vitest'

const mockParameters = vi.hoisted(() => ({}) as Record<string, unknown>)

vi.mock('@/app/config', () => ({
  default: { getCore: () => ({ parameters: mockParameters }) },
}))

import {
  readGlobalContextDimensions,
  readSchemaLabels,
  resolveExecutionsListEndpoint,
  hasContextValue,
  toContextQueryParams,
  toContextConfig,
  isSameContextValue,
} from '@cornflow-ui/core/utils/globalContext'
import { parseNameList } from '@cornflow-ui/core/utils/common'

const PLANT = {
  key: 'plant_id',
  labelKey: 'plant',
  optionsEndpoint: '/user/plants/',
  valueField: 'plant_id',
}

describe('globalContext utils', () => {
  beforeEach(() => {
    for (const key of Object.keys(mockParameters)) delete mockParameters[key]
  })

  describe('readGlobalContextDimensions', () => {
    test('is empty when the app declares no global context', () => {
      expect(readGlobalContextDimensions()).toEqual([])
    })

    test('keeps the dimensions with key, options endpoint and value field, in order', () => {
      mockParameters.globalContext = [
        PLANT,
        { key: 'program_id', labelKey: 'program' },
        { ...PLANT, key: 'program_id', dependsOn: 'plant_id' },
        'not a dimension',
      ]

      expect(readGlobalContextDimensions().map((d) => d.key)).toEqual([
        'plant_id',
        'program_id',
      ])
    })

    test('is empty when globalContext is not a list', () => {
      mockParameters.globalContext = { plant: PLANT }
      expect(readGlobalContextDimensions()).toEqual([])
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

      mockParameters.executionsListEndpoint = { path: '/executions/', isExternal: true }
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
      expect(hasContextValue(null)).toBe(false)
      expect(hasContextValue(undefined)).toBe(false)
      expect(hasContextValue('')).toBe(false)
      expect(hasContextValue(0)).toBe(true)
      expect(hasContextValue('101')).toBe(true)
    })

    test('query parameters are strings and leave out "All"', () => {
      expect(toContextQueryParams({ plant_id: 101, program_id: null })).toEqual({
        plant_id: '101',
      })
    })

    test('config values keep their type and leave out "All"', () => {
      expect(toContextConfig({ plant_id: 101, program_id: null })).toEqual({
        plant_id: 101,
      })
    })

    test('values compare as strings', () => {
      expect(isSameContextValue(101, '101')).toBe(true)
      expect(isSameContextValue('102', '103')).toBe(false)
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
