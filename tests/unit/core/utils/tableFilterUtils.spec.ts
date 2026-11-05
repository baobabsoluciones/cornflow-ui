import { describe, expect, it } from 'vitest'
import {
  generateSecureId,
  generateFrontendRowId,
  isFrontendRowId,
  generateFilterId,
  applyFilterToItem,
  applyFiltersAndSearch,
  generateHeadersFromData,
  type FilterCondition,
} from '@cornflow-ui/core/utils/tableFilterUtils'

const filter = (overrides: Partial<FilterCondition> = {}): FilterCondition => ({
  id: 'f1',
  field: 'name',
  operator: 'is',
  value: '',
  ...overrides,
})

describe('generateFrontendRowId / isFrontendRowId', () => {
  test('generates recognisable row ids with and without index', () => {
    const withIndex = generateFrontendRowId('products', 3)
    const withoutIndex = generateFrontendRowId('products')
    expect(withIndex).toMatch(/^products_3_[0-9a-f]{12}$/)
    expect(withoutIndex).toMatch(/^products_[0-9a-f]{12}$/)
    expect(isFrontendRowId(withIndex, 'products')).toBe(true)
    expect(isFrontendRowId(withoutIndex, 'products')).toBe(true)
  })

  test('does not match real ids or other tables', () => {
    expect(isFrontendRowId(7, 'products')).toBe(false)
    expect(isFrontendRowId('P-001', 'products')).toBe(false)
    expect(isFrontendRowId('products_abc', 'products')).toBe(false)
    expect(isFrontendRowId(generateFrontendRowId('stations'), 'products')).toBe(false)
    expect(isFrontendRowId('products_1a2b3c4d5e6f', '')).toBe(false)
  })
})

describe('generateSecureId', () => {
  it('returns a 12-char id with no prefix by default', () => {
    const id = generateSecureId()
    expect(id).toHaveLength(12)
    expect(id).not.toContain('-')
    expect(id).not.toContain('_')
  })

  it('prefixes the id with the given prefix and underscore', () => {
    const id = generateSecureId('row')
    expect(id.startsWith('row_')).toBe(true)
    expect(id.slice(4)).toHaveLength(12)
  })

  it('generates unique ids across calls', () => {
    expect(generateSecureId()).not.toBe(generateSecureId())
  })

  it('treats empty-string prefix the same as no prefix', () => {
    expect(generateSecureId('')).toHaveLength(12)
  })
})

describe('generateFilterId', () => {
  it('returns an id prefixed with "filter_"', () => {
    const id = generateFilterId()
    expect(id.startsWith('filter_')).toBe(true)
    expect(id.slice('filter_'.length)).toHaveLength(12)
  })

  it('generates unique ids', () => {
    expect(generateFilterId()).not.toBe(generateFilterId())
  })
})

describe('applyFilterToItem', () => {
  describe('is operator', () => {
    it('matches with string comparison', () => {
      expect(applyFilterToItem({ name: 'abc' }, filter({ value: 'abc' }))).toBe(
        true,
      )
    })

    it('coerces values to strings before comparing', () => {
      expect(
        applyFilterToItem({ age: 30 }, filter({ field: 'age', value: '30' })),
      ).toBe(true)
    })

    it('returns false when not equal', () => {
      expect(applyFilterToItem({ name: 'abc' }, filter({ value: 'xyz' }))).toBe(
        false,
      )
    })
  })

  describe('is_not operator', () => {
    it('returns true when different', () => {
      expect(
        applyFilterToItem(
          { name: 'abc' },
          filter({ operator: 'is_not', value: 'xyz' }),
        ),
      ).toBe(true)
    })

    it('returns false when equal', () => {
      expect(
        applyFilterToItem(
          { name: 'abc' },
          filter({ operator: 'is_not', value: 'abc' }),
        ),
      ).toBe(false)
    })
  })

  describe('contains operator', () => {
    it('matches case-insensitively', () => {
      expect(
        applyFilterToItem(
          { name: 'HelloWorld' },
          filter({ operator: 'contains', value: 'world' }),
        ),
      ).toBe(true)
    })

    it('returns false when substring is absent', () => {
      expect(
        applyFilterToItem(
          { name: 'Hello' },
          filter({ operator: 'contains', value: 'zzz' }),
        ),
      ).toBe(false)
    })
  })

  describe('is_between operator (numeric)', () => {
    const between = (value: string, value2: string) =>
      filter({ field: 'n', operator: 'is_between', value, value2 })

    it('returns true within numeric range', () => {
      expect(applyFilterToItem({ n: 5 }, between('1', '10'))).toBe(true)
    })

    it('returns true on inclusive bounds', () => {
      expect(applyFilterToItem({ n: 1 }, between('1', '10'))).toBe(true)
      expect(applyFilterToItem({ n: 10 }, between('1', '10'))).toBe(true)
    })

    it('returns false below/above range', () => {
      expect(applyFilterToItem({ n: 0 }, between('1', '10'))).toBe(false)
      expect(applyFilterToItem({ n: 11 }, between('1', '10'))).toBe(false)
    })
  })

  describe('is_between operator (string fallback)', () => {
    const between = (value: string, value2: string) =>
      filter({ field: 's', operator: 'is_between', value, value2 })

    it('returns true when both bounds are empty', () => {
      expect(applyFilterToItem({ s: 'anything' }, between('', ''))).toBe(true)
    })

    it('compares lexicographically when both bounds present', () => {
      expect(applyFilterToItem({ s: 'm' }, between('a', 'z'))).toBe(true)
      expect(applyFilterToItem({ s: '2026-04-15' }, between('2026-01-01', '2026-12-31'))).toBe(true)
      expect(applyFilterToItem({ s: '2025-04-15' }, between('2026-01-01', '2026-12-31'))).toBe(false)
    })

    it('uses only lower bound when upper is empty', () => {
      expect(applyFilterToItem({ s: 'm' }, between('a', ''))).toBe(true)
      expect(applyFilterToItem({ s: 'a' }, between('m', ''))).toBe(false)
    })

    it('uses only upper bound when lower is empty', () => {
      expect(applyFilterToItem({ s: 'a' }, between('', 'm'))).toBe(true)
      expect(applyFilterToItem({ s: 'z' }, between('', 'm'))).toBe(false)
    })

    it('falls back to string comparison when raw value is blank', () => {
      // raw '' trims to blank so numeric branch is skipped
      expect(applyFilterToItem({ s: '' }, between('a', 'z'))).toBe(false)
    })
  })

  describe('has_any_value operator', () => {
    const f = filter({ field: 'v', operator: 'has_any_value' })

    it('returns true for a present value', () => {
      expect(applyFilterToItem({ v: 'x' }, f)).toBe(true)
      expect(applyFilterToItem({ v: 0 }, f)).toBe(true)
      expect(applyFilterToItem({ v: false }, f)).toBe(true)
    })

    it('returns false for null, undefined and empty string', () => {
      expect(applyFilterToItem({ v: null }, f)).toBe(false)
      expect(applyFilterToItem({ v: undefined }, f)).toBe(false)
      expect(applyFilterToItem({ v: '' }, f)).toBe(false)
    })
  })

  describe('unknown operator', () => {
    it('returns true (no-op) by default', () => {
      expect(
        applyFilterToItem({ name: 'x' }, filter({ operator: 'weird' as any })),
      ).toBe(true)
    })
  })
})

describe('applyFiltersAndSearch', () => {
  const items = [
    { name: 'Alice', age: 30, city: 'Madrid' },
    { name: 'Bob', age: 25, city: 'Barcelona' },
    { name: 'Carol', age: 40, city: 'Madrid' },
  ]

  it('returns the same reference when no search and no filters', () => {
    const result = applyFiltersAndSearch(items, '', [])
    expect(result).toBe(items)
  })

  it('filters by search only', () => {
    const result = applyFiltersAndSearch(items, 'madrid', [])
    expect(result).toHaveLength(2)
    expect(result.map((r) => r.name)).toEqual(['Alice', 'Carol'])
  })

  it('filters by a single column filter only', () => {
    const result = applyFiltersAndSearch(items, '', [
      filter({ field: 'city', operator: 'is', value: 'Barcelona' }),
    ])
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Bob')
  })

  it('combines search and filters (AND semantics)', () => {
    const result = applyFiltersAndSearch(items, 'madrid', [
      filter({ field: 'age', operator: 'is_between', value: '35', value2: '50' }),
    ])
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Carol')
  })

  it('applies multiple filters as AND', () => {
    const result = applyFiltersAndSearch(items, '', [
      filter({ field: 'city', operator: 'is', value: 'Madrid' }),
      filter({ field: 'age', operator: 'is_between', value: '20', value2: '35' }),
    ])
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Alice')
  })

  it('returns empty array when nothing matches', () => {
    const result = applyFiltersAndSearch(items, 'nonexistent', [])
    expect(result).toEqual([])
  })
})

describe('generateHeadersFromData', () => {
  it('returns empty array for null/undefined/empty data', () => {
    expect(generateHeadersFromData(null as any)).toEqual([])
    expect(generateHeadersFromData(undefined as any)).toEqual([])
    expect(generateHeadersFromData([])).toEqual([])
  })

  it('derives header metadata from first item keys', () => {
    const headers = generateHeadersFromData([{ name: 'Alice' }])
    expect(headers).toHaveLength(1)
    expect(headers[0]).toEqual({
      title: 'name',
      key: 'name',
      value: 'name',
      sortable: true,
      filterable: true,
      type: 'string',
    })
  })

  it('detects integer, number, boolean and string types', () => {
    const headers = generateHeadersFromData([
      { count: 10, ratio: 1.5, active: true, label: 'x' },
    ])
    const byKey = Object.fromEntries(headers.map((h) => [h.key, h.type]))
    expect(byKey.count).toBe('integer')
    expect(byKey.ratio).toBe('number')
    expect(byKey.active).toBe('boolean')
    expect(byKey.label).toBe('string')
  })

  it('only uses the first item to build headers', () => {
    const headers = generateHeadersFromData([
      { a: 1 },
      { a: 2, b: 'extra' },
    ])
    expect(headers.map((h) => h.key)).toEqual(['a'])
  })
})
