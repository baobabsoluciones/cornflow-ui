import { describe, test, expect } from 'vitest'
import {
  normalizeTableKey,
  resolveCurrentModalKey,
  resolveRowsDataForKey,
  resolveTableHeadersForKey,
} from '@cornflow-ui/core/utils/sectionModalResolvers'

describe('normalizeTableKey', () => {
  test('lowercases and converts hyphens to underscores', () => {
    expect(normalizeTableKey('')).toBe('')
    expect(normalizeTableKey('My-Table')).toBe('my_table')
    expect(normalizeTableKey('ABC')).toBe('abc')
  })
})

describe('resolveCurrentModalKey', () => {
  test('group view uses the selected table', () => {
    expect(resolveCurrentModalKey(true, 'Sel-Table', 'eff')).toBe('sel_table')
  })
  test('non-group uses the effective key, empty when absent', () => {
    expect(resolveCurrentModalKey(false, 'Sel', 'Eff-Key')).toBe('eff_key')
    expect(resolveCurrentModalKey(true, null, 'Eff')).toBe('eff')
    expect(resolveCurrentModalKey(false, null, null)).toBe('')
  })
})

describe('resolveRowsDataForKey', () => {
  const live = { k: { a: 1 } }
  const recalc = { k: { rowsData: { a: 'cached' } } }
  const group = { k: { rowsData: { k: { a: 'grouped' } } } }

  test('recalculation prefers live for the current key, cached otherwise', () => {
    expect(resolveRowsDataForKey('k', 'k', true, false, live, recalc, {})).toEqual({ a: 1 })
    expect(resolveRowsDataForKey('k', 'other', true, false, live, recalc, {})).toEqual({ a: 'cached' })
  })

  test('group prefers cached, falling back to current live', () => {
    expect(resolveRowsDataForKey('k', 'k', false, true, live, {}, group)).toEqual({ a: 'grouped' })
    expect(resolveRowsDataForKey('k', 'k', false, true, live, {}, {})).toEqual({ a: 1 })
  })

  test('default returns live only for the current key', () => {
    expect(resolveRowsDataForKey('k', 'k', false, false, live, {}, {})).toEqual({ a: 1 })
    expect(resolveRowsDataForKey('k', 'other', false, false, live, {}, {})).toEqual({})
  })
})

describe('resolveTableHeadersForKey', () => {
  const live = { k: [{ key: 'c', title: 'C' }] }
  const recalc = { k: { tableHeaders: [{ key: 'd', title: 'D' }] } }
  const group = { k: { tableHeaders: { k: [{ key: 'g', title: 'G' }] } } }

  test('recalculation prefers non-empty live for current key, cached otherwise', () => {
    expect(resolveTableHeadersForKey('k', 'k', true, false, live, recalc, {})[0].key).toBe('c')
    expect(resolveTableHeadersForKey('k', 'other', true, false, live, recalc, {})[0].key).toBe('d')
    // empty live -> falls back to cached for current key
    expect(resolveTableHeadersForKey('k', 'k', true, false, { k: [] }, recalc, {})[0].key).toBe('d')
  })

  test('group prefers cached, then current live, then []', () => {
    expect(resolveTableHeadersForKey('k', 'k', false, true, live, {}, group)[0].key).toBe('g')
    expect(resolveTableHeadersForKey('k', 'k', false, true, live, {}, {})[0].key).toBe('c')
    expect(resolveTableHeadersForKey('k', 'other', false, true, live, {}, {})).toEqual([])
  })

  test('default returns live only for the current key', () => {
    expect(resolveTableHeadersForKey('k', 'k', false, false, live, {}, {})[0].key).toBe('c')
    expect(resolveTableHeadersForKey('k', 'other', false, false, live, {}, {})).toEqual([])
  })
})
