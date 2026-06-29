import { describe, test, expect, vi } from 'vitest'

vi.mock('@cornflow-ui/core/plugins/i18n', () => ({
  default: { global: { t: (key: string) => key } },
}))

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
  getFilterNames,
} from '@cornflow-ui/core/utils/filterUtils'

// Builds a fake selectedExecution with the shape the helpers traverse.
const makeExecution = (data: any, filtersPreference: any = undefined) => ({
  experiment: { instance: { data } },
  getFiltersPreference: vi.fn(() => filtersPreference),
})

describe('filterUtils - primitives', () => {
  test('isEmptyObject only true for a plain empty object', () => {
    expect(isEmptyObject({})).toBe(true)
    expect(isEmptyObject({ a: 1 })).toBe(false)
    expect(isEmptyObject([])).toBe(false)
  })

  test('getFilterType maps schema types (incl. tuple form) to widget types', () => {
    expect(getFilterType('string')).toBe('checkbox')
    expect(getFilterType('boolean')).toBe('checkbox')
    expect(getFilterType('integer')).toBe('range')
    expect(getFilterType('number')).toBe('range')
    expect(getFilterType('date')).toBe('daterange')
    expect(getFilterType(['integer', 'null'])).toBe('range')
    expect(getFilterType('unknown')).toBe('')
  })
})

describe('filterUtils - getColumnData', () => {
  const exec = makeExecution({
    orders: [
      { category: 'A', qty: 1 },
      { category: 'B', qty: 2 },
      { category: 'A', qty: 3 },
    ],
  })

  test('returns unique values for a column', () => {
    expect(getColumnData(exec, 'instance', 'orders', 'category')).toEqual(['A', 'B'])
  })

  test('returns [] when the table is missing or not an array', () => {
    expect(getColumnData(exec, 'instance', 'missing', 'category')).toEqual([])
    const bad = makeExecution({ orders: { not: 'array' } })
    expect(getColumnData(bad, 'instance', 'orders', 'category')).toEqual([])
  })
})

describe('filterUtils - filter selection state', () => {
  test('isFilterSelected is true only for a non-empty filter object', () => {
    const exec = makeExecution({}, { orders: { category: { value: ['A'] } } })
    expect(isFilterSelected(exec, 'instance', 'orders', 'category')).toBe(true)
    // empty filter object -> not selected
    const exec2 = makeExecution({}, { orders: { category: {} } })
    expect(isFilterSelected(exec2, 'instance', 'orders', 'category')).toBe(false)
    // no preference at all -> not selected
    const exec3 = makeExecution({}, undefined)
    expect(isFilterSelected(exec3, 'instance', 'orders', 'category')).toBe(false)
  })

  test('isFilterChecked matches stringified values against the filter', () => {
    const exec = makeExecution({}, { orders: { category: { value: ['A', 'false'] } } })
    expect(isFilterChecked(exec, 'instance', 'orders', 'category', 'A')).toBe(true)
    expect(isFilterChecked(exec, 'instance', 'orders', 'category', 'C')).toBe(false)
    // falsy value becomes 'false'
    expect(isFilterChecked(exec, 'instance', 'orders', 'category', false)).toBe(true)
    // no preference -> false
    const exec2 = makeExecution({}, undefined)
    expect(isFilterChecked(exec2, 'instance', 'orders', 'category', 'A')).toBe(false)
  })
})

describe('filterUtils - option/min/max helpers', () => {
  const exec = makeExecution(
    {
      orders: [
        { qty: 5, day: '2024-01-10' },
        { qty: 1, day: '2024-03-20' },
        { qty: 9, day: '2024-02-15' },
      ],
    },
    { orders: { qty: { value: ['5'] } } },
  )

  test('getFilterOptions returns labelled options with checked state', () => {
    const opts = getFilterOptions(exec, 'instance', 'orders', 'qty')
    expect(opts).toEqual([
      { label: 5, value: 5, checked: true },
      { label: 1, value: 1, checked: false },
      { label: 9, value: 9, checked: false },
    ])
  })

  test('getFilterMinValue / getFilterMaxValue', () => {
    expect(getFilterMinValue(exec, 'instance', 'orders', 'qty')).toBe(1)
    expect(getFilterMaxValue(exec, 'instance', 'orders', 'qty')).toBe(9)
  })

  test('getFilterMinDate / getFilterMaxDate compare lexicographically', () => {
    expect(getFilterMinDate(exec, 'instance', 'orders', 'day')).toBe('2024-01-10')
    expect(getFilterMaxDate(exec, 'instance', 'orders', 'day')).toBe('2024-03-20')
  })
})

describe('filterUtils - getFilterNames', () => {
  const schemaConfig: any = {
    instance: {
      properties: {
        orders: {
          items: {
            required: ['category', 'qty'],
            properties: {
              category: { type: 'string', title: 'Category', filterable: true },
              qty: { type: 'integer', title: 'Quantity', filterable: true },
              flag: { type: 'boolean', title: 'Flag', filterable: true },
            },
          },
        },
      },
    },
  }

  const exec = makeExecution(
    {
      orders: [
        { category: 'A', qty: 5, flag: true },
        { category: 'B', qty: 1, flag: false },
      ],
    },
    {},
  )

  test('builds a filter descriptor per header with the right widget type', () => {
    const names = getFilterNames(schemaConfig, exec, 'instance', 'orders', 'instance', 'en')

    // string -> checkbox with options
    expect(names.category.type).toBe('checkbox')
    expect(names.category.options.map((o: any) => o.value)).toEqual(['A', 'B'])
    expect(names.category.required).toBe(true)

    // integer -> range with numeric min/max
    expect(names.qty.type).toBe('range')
    expect(names.qty.min).toBe(1)
    expect(names.qty.max).toBe(5)

    // boolean -> checkbox with the two fixed true/false options
    expect(names.flag.type).toBe('checkbox')
    expect(names.flag.options).toHaveLength(2)
    expect(names.flag.options.map((o: any) => o.value)).toEqual(['true', 'false'])
  })

  test('promotes a string column to daterange when its values look like dates', () => {
    const dateSchema: any = {
      instance: {
        properties: {
          orders: {
            items: {
              required: [],
              properties: {
                day: { type: 'string', title: 'Day', filterable: true },
              },
            },
          },
        },
      },
    }
    const dateExec = makeExecution(
      { orders: [{ day: '2024-01-10' }, { day: '2024-02-20' }] },
      {},
    )
    const names = getFilterNames(dateSchema, dateExec, 'instance', 'orders', 'instance', 'en')
    expect(names.day.type).toBe('daterange')
    expect(names.day.min).toBe('2024-01-10')
    expect(names.day.max).toBe('2024-02-20')
  })
})
