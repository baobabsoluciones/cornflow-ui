import { describe, test, expect, vi } from 'vitest'

vi.mock('@/utils/schemaUtils', () => ({
  buildLowercasedKeyMap: (row: any) =>
    new Map(Object.entries(row || {}).map(([k, v]) => [k.toLowerCase(), v])),
  resolveComparableLowercasedKeys: ({ row1, row2, excludedKeys }: any) => {
    const keys = new Set(
      [...Object.keys(row1 || {}), ...Object.keys(row2 || {})].map((k) => k.toLowerCase()),
    )
    for (const e of excludedKeys || []) keys.delete(String(e).toLowerCase())
    return [...keys]
  },
}))

import {
  normalizeStringValue,
  normalizeNumberValue,
  normalizeValue,
  areRowsDifferent,
} from '@/utils/rowComparison'

describe('normalizeStringValue', () => {
  test('blank -> null', () => {
    expect(normalizeStringValue('   ')).toBeNull()
  })
  test('numeric strings -> numbers', () => {
    expect(normalizeStringValue('42')).toBe(42)
    expect(normalizeStringValue('-5')).toBe(-5)
    expect(normalizeStringValue('3.14')).toBe(3.14)
  })
  test('boolean strings -> booleans', () => {
    expect(normalizeStringValue('true')).toBe(true)
    expect(normalizeStringValue('FALSE')).toBe(false)
  })
  test('other strings pass through trimmed', () => {
    expect(normalizeStringValue('  hello ')).toBe('hello')
  })
})

describe('normalizeNumberValue', () => {
  test('NaN -> null, integers and decimals preserved', () => {
    expect(normalizeNumberValue(NaN)).toBeNull()
    expect(normalizeNumberValue(7)).toBe(7)
    expect(normalizeNumberValue(3.14)).toBe(3.14)
  })
})

describe('normalizeValue', () => {
  test('maps nullish/empty to null', () => {
    expect(normalizeValue(null)).toBeNull()
    expect(normalizeValue(undefined)).toBeNull()
    expect(normalizeValue('')).toBeNull()
  })
  test('delegates by type and stringifies objects', () => {
    expect(normalizeValue('true')).toBe(true)
    expect(normalizeValue(5)).toBe(5)
    expect(normalizeValue(false)).toBe(false)
    expect(normalizeValue({ a: 1 })).toBe('{"a":1}')
  })
})

describe('areRowsDifferent', () => {
  test('identical rows are not different', () => {
    expect(areRowsDifferent({ a: 1, b: 'x' }, { a: 1, b: 'x' }, null)).toBe(false)
  })
  test('differing values are detected', () => {
    expect(areRowsDifferent({ a: 1 }, { a: 2 }, null)).toBe(true)
  })
  test('one side missing/null is a difference', () => {
    expect(areRowsDifferent({ a: 1 }, { a: null }, null)).toBe(true)
  })
  test('both null/missing on a key is not a difference', () => {
    expect(areRowsDifferent({ a: null }, { a: '' }, null)).toBe(false)
  })
  test('string/number coercion treats "5" and 5 as equal', () => {
    expect(areRowsDifferent({ a: '5' }, { a: 5 }, null)).toBe(false)
  })
  test('excluded keys are ignored', () => {
    expect(areRowsDifferent({ a: 1, skip: 1 }, { a: 1, skip: 2 }, null, new Set(['skip']))).toBe(false)
  })
})
