import { describe, test, expect } from 'vitest'
import { parseBoolean } from '@cornflow-ui/core/utils/common'

describe('parseBoolean', () => {
  describe('null / undefined / empty', () => {
    test('returns null for undefined', () => {
      expect(parseBoolean(undefined)).toBeNull()
    })

    test('returns null for null', () => {
      expect(parseBoolean(null)).toBeNull()
    })

    test('returns null for empty string', () => {
      expect(parseBoolean('')).toBeNull()
    })
  })

  describe('string values', () => {
    test.each([
      ['true', true],
      ['TRUE', true],
      ['True', true],
      ['  true  ', true],
      ['1', true],
    ])('returns true for %j', (input, expected) => {
      expect(parseBoolean(input)).toBe(expected)
    })

    test.each([
      ['false', false],
      ['FALSE', false],
      ['False', false],
      ['  false  ', false],
      ['0', false],
    ])('returns false for %j', (input, expected) => {
      expect(parseBoolean(input)).toBe(expected)
    })

    test.each(['yes', 'no', 'abc', '2', ' '])(
      'returns null for unrecognised string %j',
      (input) => {
        expect(parseBoolean(input)).toBeNull()
      },
    )
  })

  describe('number values', () => {
    test('returns true for 1', () => {
      expect(parseBoolean(1)).toBe(true)
    })

    test('returns false for 0', () => {
      expect(parseBoolean(0)).toBe(false)
    })

    test.each([2, -1, 0.5, NaN, Infinity])(
      'returns null for non-boolean number %j',
      (input) => {
        expect(parseBoolean(input)).toBeNull()
      },
    )
  })

  describe('boolean values', () => {
    test('returns true for true', () => {
      expect(parseBoolean(true)).toBe(true)
    })

    test('returns false for false', () => {
      expect(parseBoolean(false)).toBe(false)
    })
  })

  describe('other types', () => {
    test('returns null for an object', () => {
      expect(parseBoolean({})).toBeNull()
    })

    test('returns null for an array', () => {
      expect(parseBoolean([])).toBeNull()
    })

    test('returns null for a function', () => {
      expect(parseBoolean(() => {})).toBeNull()
    })
  })
})
