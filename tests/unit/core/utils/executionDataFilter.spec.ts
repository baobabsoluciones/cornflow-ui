import { describe, test, expect, vi, afterEach } from 'vitest'
import {
  combineExecutionDataFilters,
  dataFilterQuery,
  narrowsTable,
  parseExecutionDataFilter,
} from '@cornflow-ui/core/utils/executionDataFilter'

const answer = {
  param: 'plant',
  title: { en: 'Plant', es: 'Planta' },
  value: 'P1',
  options: [
    { value: 'P1', label: 'North' },
    { value: 'P2', label: '' },
  ],
  tables: ['demand'],
}

describe('executionDataFilter', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('parseExecutionDataFilter', () => {
    test('reads the data filter of an answer, an option without label named by its value', () => {
      expect(parseExecutionDataFilter(answer)).toEqual({
        ...answer,
        options: [
          { value: 'P1', label: 'North' },
          { value: 'P2', label: 'P2' },
        ],
      })
    })

    test('takes a title as plain text', () => {
      expect(parseExecutionDataFilter({ ...answer, title: 'Plant' })?.title).toBe('Plant')
    })

    test('an answer without data filter is read as it is', () => {
      expect(parseExecutionDataFilter(undefined)).toBeNull()
      expect(parseExecutionDataFilter(null)).toBeNull()
    })

    test('an unusable data filter is ignored with a warning', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const unusable = [
        'plant',
        { ...answer, param: '' },
        { ...answer, value: 3 },
        { ...answer, options: [{ value: 'P1' }] },
        { ...answer, tables: 'demand' },
        { ...answer, title: { en: 3 } },
      ]

      for (const raw of unusable) {
        expect(parseExecutionDataFilter(raw)).toBeNull()
      }
      expect(warn).toHaveBeenCalledTimes(unusable.length)
    })
  })

  describe('combineExecutionDataFilters', () => {
    const instance = parseExecutionDataFilter({ ...answer, tables: ['demand', 'stock'] })
    const solution = parseExecutionDataFilter({ ...answer, tables: ['daily_plan'] })

    test('joins the tables the solution and the instance narrow', () => {
      expect(combineExecutionDataFilters(solution, instance)?.tables).toEqual({
        instance: ['demand', 'stock'],
        solution: ['daily_plan'],
      })
    })

    test('takes the rest from the answer that has one', () => {
      expect(combineExecutionDataFilters(null, instance)).toMatchObject({
        param: 'plant',
        value: 'P1',
        tables: { instance: ['demand', 'stock'], solution: [] },
      })
    })

    test('is null when neither answer is read in parts', () => {
      expect(combineExecutionDataFilters(null, null)).toBeNull()
    })
  })

  test('dataFilterQuery gives the query parameter of the value picked', () => {
    expect(dataFilterQuery({ param: 'plant', value: 'P2' })).toEqual({ plant: 'P2' })
    expect(dataFilterQuery(null)).toEqual({})
  })

  test('narrowsTable tells the tables of each kind the filter narrows', () => {
    const filter = combineExecutionDataFilters(
      parseExecutionDataFilter({ ...answer, tables: ['daily_plan'] }),
      parseExecutionDataFilter(answer),
    )

    expect(narrowsTable(filter, 'instance', 'demand')).toBe(true)
    expect(narrowsTable(filter, 'solution', 'demand')).toBe(false)
    expect(narrowsTable(filter, 'solution', 'daily_plan')).toBe(true)
    expect(narrowsTable(null, 'instance', 'demand')).toBe(false)
    expect(narrowsTable(filter, null, 'demand')).toBe(false)
  })
})
