import { describe, test, expect } from 'vitest'
import {
  shouldSkipCompareDisplayKey,
  restrictLabelsToSchema,
  orderLabelsByPriority,
  buildOrderedFieldKeys,
} from '@/utils/compareFieldOrder'

describe('shouldSkipCompareDisplayKey', () => {
  test('skips ignored meta fields (case-insensitive)', () => {
    expect(shouldSkipCompareDisplayKey('id', new Set())).toBe(true)
    expect(shouldSkipCompareDisplayKey('CREATED_AT', new Set())).toBe(true)
  })
  test('skips excluded keys (case-insensitive) and keeps others', () => {
    expect(shouldSkipCompareDisplayKey('Foo', new Set(['foo']))).toBe(true)
    expect(shouldSkipCompareDisplayKey('name', new Set())).toBe(false)
  })
})

describe('orderLabelsByPriority', () => {
  test('orders keyFields, then headerKeys, then the rest alphabetically', () => {
    const labels = new Map([
      ['a', 'A'],
      ['b', 'B'],
      ['c', 'C'],
      ['k', 'K'],
    ])
    expect(orderLabelsByPriority(labels, ['b'], ['k'])).toEqual(['K', 'B', 'A', 'C'])
  })
  test('ignores keys not present in the label map and dedupes', () => {
    const labels = new Map([['a', 'A']])
    expect(orderLabelsByPriority(labels, ['missing', 'a'], ['a'])).toEqual(['A'])
  })
})

describe('restrictLabelsToSchema', () => {
  test('restricts to allowed columns and adds missing schema columns', () => {
    const labels = new Map([
      ['a', 'A'],
      ['x', 'X'],
    ])
    restrictLabelsToSchema(labels, new Set(), ['A', 'New'])
    expect([...labels.entries()].sort()).toEqual([
      ['a', 'A'],
      ['new', 'New'],
    ])
  })
  test('is a no-op without allowed columns', () => {
    const labels = new Map([['a', 'A']])
    restrictLabelsToSchema(labels, new Set(), null)
    expect([...labels.keys()]).toEqual(['a'])
  })
})

describe('buildOrderedFieldKeys', () => {
  test('merges instance/master keys, skips meta, orders by header priority', () => {
    const ordered = buildOrderedFieldKeys(
      { Name: 'x', id: 1 },
      { name: 'y', Extra: 2 },
      new Set(),
      ['name'],
      [],
      null,
    )
    expect(ordered).toEqual(['Name', 'Extra'])
  })

  test('restricts to schema columns when provided', () => {
    const ordered = buildOrderedFieldKeys(
      { Name: 'x' },
      { name: 'y', Extra: 2 },
      new Set(),
      ['name'],
      [],
      ['Name'],
    )
    expect(ordered).toEqual(['Name'])
  })
})
