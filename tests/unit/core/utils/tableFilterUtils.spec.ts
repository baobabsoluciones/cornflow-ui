import { describe, expect, it } from 'vitest'
import {
  generateSecureId,
  getFilterFieldTypeFromSchemaProperty,
  isDateLikeFieldType,
  getOperatorsForFieldType,
  getOperatorText,
  operatorNeedsValue,
  operatorNeedsSecondValue,
  generateFilterId,
  applyFilterToItem,
  itemMatchesSearch,
  applyFiltersAndSearch,
  generateHeadersFromData,
  type FilterCondition,
} from '@/utils/tableFilterUtils'

const filter = (overrides: Partial<FilterCondition> = {}): FilterCondition => ({
  id: 'f1',
  field: 'name',
  operator: 'is',
  value: '',
  ...overrides,
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

describe('getFilterFieldTypeFromSchemaProperty', () => {
  it('returns "string" when prop is null/undefined', () => {
    expect(getFilterFieldTypeFromSchemaProperty(null as any)).toBe('string')
    expect(getFilterFieldTypeFromSchemaProperty(undefined as any)).toBe(
      'string',
    )
  })

  it('returns "date" for format date', () => {
    expect(getFilterFieldTypeFromSchemaProperty({ format: 'date' })).toBe('date')
  })

  it('returns "date-time" for format date-time', () => {
    expect(
      getFilterFieldTypeFromSchemaProperty({ format: 'date-time' }),
    ).toBe('date-time')
  })

  it('returns "date-time" for format datetime', () => {
    expect(
      getFilterFieldTypeFromSchemaProperty({ format: 'datetime' }),
    ).toBe('date-time')
  })

  it('maps integer type to "number"', () => {
    expect(getFilterFieldTypeFromSchemaProperty({ type: 'integer' })).toBe(
      'number',
    )
  })

  it('returns the type when present and not integer', () => {
    expect(getFilterFieldTypeFromSchemaProperty({ type: 'boolean' })).toBe(
      'boolean',
    )
  })

  it('falls back to "string" when type is missing', () => {
    expect(getFilterFieldTypeFromSchemaProperty({})).toBe('string')
  })

  it('prioritises date format over type', () => {
    expect(
      getFilterFieldTypeFromSchemaProperty({ type: 'string', format: 'date' }),
    ).toBe('date')
  })
})

describe('isDateLikeFieldType', () => {
  it('returns true for date, date-time and datetime', () => {
    expect(isDateLikeFieldType('date')).toBe(true)
    expect(isDateLikeFieldType('date-time')).toBe(true)
    expect(isDateLikeFieldType('datetime')).toBe(true)
  })

  it('returns false for non-date types', () => {
    expect(isDateLikeFieldType('string')).toBe(false)
    expect(isDateLikeFieldType('number')).toBe(false)
    expect(isDateLikeFieldType('')).toBe(false)
  })
})

describe('getOperatorsForFieldType', () => {
  it('returns string operators', () => {
    expect(getOperatorsForFieldType('string')).toEqual([
      'is',
      'is_not',
      'contains',
      'has_any_value',
    ])
  })

  it('returns number operators for number and integer', () => {
    const expected = ['is', 'is_not', 'is_between', 'has_any_value']
    expect(getOperatorsForFieldType('number')).toEqual(expected)
    expect(getOperatorsForFieldType('integer')).toEqual(expected)
  })

  it('returns only is_between for date-like types', () => {
    expect(getOperatorsForFieldType('date')).toEqual(['is_between'])
    expect(getOperatorsForFieldType('date-time')).toEqual(['is_between'])
    expect(getOperatorsForFieldType('datetime')).toEqual(['is_between'])
  })

  it('returns is/is_not for boolean', () => {
    expect(getOperatorsForFieldType('boolean')).toEqual(['is', 'is_not'])
  })

  it('returns default operators for unknown type', () => {
    expect(getOperatorsForFieldType('mystery')).toEqual([
      'is',
      'is_not',
      'has_any_value',
    ])
  })
})

describe('getOperatorText', () => {
  const t = (key: string) => `T:${key}`

  it('returns the translated text for known operators', () => {
    expect(getOperatorText('is', t)).toBe('T:table.filters.operators.is')
    expect(getOperatorText('is_not', t)).toBe(
      'T:table.filters.operators.is_not',
    )
    expect(getOperatorText('contains', t)).toBe(
      'T:table.filters.operators.contains',
    )
    expect(getOperatorText('is_between', t)).toBe(
      'T:table.filters.operators.is_between',
    )
    expect(getOperatorText('has_any_value', t)).toBe(
      'T:table.filters.operators.has_any_value',
    )
  })

  it('returns the operator itself when unknown', () => {
    expect(getOperatorText('unknown_op', t)).toBe('unknown_op')
  })
})

describe('operatorNeedsValue', () => {
  it('returns false only for has_any_value', () => {
    expect(operatorNeedsValue('has_any_value')).toBe(false)
  })

  it('returns true for value-requiring operators', () => {
    expect(operatorNeedsValue('is')).toBe(true)
    expect(operatorNeedsValue('is_not')).toBe(true)
    expect(operatorNeedsValue('contains')).toBe(true)
    expect(operatorNeedsValue('is_between')).toBe(true)
  })
})

describe('operatorNeedsSecondValue', () => {
  it('returns true only for is_between', () => {
    expect(operatorNeedsSecondValue('is_between')).toBe(true)
  })

  it('returns false for other operators', () => {
    expect(operatorNeedsSecondValue('is')).toBe(false)
    expect(operatorNeedsSecondValue('has_any_value')).toBe(false)
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
        applyFilterToItem({ name: 'x' }, filter({ operator: 'weird' })),
      ).toBe(true)
    })
  })
})

describe('itemMatchesSearch', () => {
  it('returns true when search term is empty', () => {
    expect(itemMatchesSearch({ a: 1 }, '')).toBe(true)
  })

  it('matches case-insensitively across values', () => {
    expect(itemMatchesSearch({ name: 'Alice', city: 'Madrid' }, 'mad')).toBe(
      true,
    )
  })

  it('matches numeric values coerced to string', () => {
    expect(itemMatchesSearch({ age: 42 }, '42')).toBe(true)
  })

  it('ignores null and undefined values', () => {
    expect(itemMatchesSearch({ a: null, b: undefined }, 'x')).toBe(false)
  })

  it('returns false when no value matches', () => {
    expect(itemMatchesSearch({ name: 'Alice' }, 'zzz')).toBe(false)
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
