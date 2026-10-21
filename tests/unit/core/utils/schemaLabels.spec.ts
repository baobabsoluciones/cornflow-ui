import { describe, test, expect, vi, beforeEach } from 'vitest'

const mockParameters = vi.hoisted(() => ({}) as Record<string, unknown>)

vi.mock('@/app/config', () => ({
  default: { getCore: () => ({ parameters: mockParameters }) },
}))

import { readSchemaLabels } from '@cornflow-ui/core/utils/schemaLabels'
import { parseNameList } from '@cornflow-ui/core/utils/common'

describe('readSchemaLabels', () => {
  beforeEach(() => {
    for (const key of Object.keys(mockParameters)) delete mockParameters[key]
  })

  test('returns the labels the app declares, or none', () => {
    expect(readSchemaLabels()).toEqual({})
    mockParameters.schemaLabels = { planning_dag: 'Planning' }
    expect(readSchemaLabels()).toEqual({ planning_dag: 'Planning' })
  })

  test('ignores labels that are not a map', () => {
    mockParameters.schemaLabels = ['Planning']
    expect(readSchemaLabels()).toEqual({})
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
