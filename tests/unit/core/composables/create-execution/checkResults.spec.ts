import { describe, test, expect } from 'vitest'
import { checkResultsOf } from '@cornflow-ui/core/composables/create-execution/checkResults'

describe('checkResultsOf', () => {
  const properties = {
    missing_products: {
      title: 'Missing products',
      is_warning: false,
      items: { properties: { product: { title: 'Product' }, week: {} } },
    },
    tight_capacity: { description: 'Lines above 95 %' },
    empty_check: { is_warning: false },
  }

  test('lists the checks that found something: errors first, then the ones that found most', () => {
    const results = checkResultsOf(properties, {
      tight_capacity: [{ line: 'L1' }, { line: 'L2' }],
      missing_products: [{ product: 'P-1', week: 43 }],
      empty_check: [],
    })

    expect(results.map((r) => [r.key, r.kind, r.records.length])).toEqual([
      ['missing_products', 'error', 1],
      ['tight_capacity', 'warning', 2],
    ])
  })

  test('titles a check and its columns from the schema, or from their keys in words', () => {
    const [missing] = checkResultsOf(properties, {
      missing_products: [{ product: 'P-1', week: 43, plant_code: 'N' }],
    })

    expect(missing.title).toBe('Missing products')
    expect(missing.columns).toEqual([
      { key: 'product', title: 'Product' },
      { key: 'week', title: 'Week' },
      { key: 'plant_code', title: 'Plant code' },
    ])

    const [tight] = checkResultsOf(properties, { tight_capacity: [{ line: 'L1' }] })
    expect(tight.title).toBe('Tight capacity')
    expect(tight.description).toBe('Lines above 95 %')
  })

  test('a check that returns plain values has them as one column', () => {
    const [tight] = checkResultsOf(properties, { tight_capacity: ['L1 is full', 'L2 is full'] })

    expect(tight.columns).toEqual([{ key: 'value', title: 'Value' }])
    expect(tight.records).toEqual([{ value: 'L1 is full' }, { value: 'L2 is full' }])
  })

  test('a check the data does not have, or that is not a list, found nothing', () => {
    expect(checkResultsOf(properties, { missing_products: { not: 'a list' } })).toEqual([])
  })
})
