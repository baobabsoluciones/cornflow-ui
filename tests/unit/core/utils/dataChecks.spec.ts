import { describe, test, expect } from 'vitest'
import { hasAnyChecksData } from '@cornflow-ui/core/utils/dataChecks'

describe('hasAnyChecksData', () => {
  test('false for null/non-object', () => {
    expect(hasAnyChecksData(null)).toBe(false)
    expect(hasAnyChecksData('x')).toBe(false)
  })

  test('true when a key holds a non-empty array', () => {
    expect(hasAnyChecksData({ t1: [{ a: 1 }] })).toBe(true)
  })

  test('true when a key holds a non-empty object', () => {
    expect(hasAnyChecksData({ t1: { a: 1 } })).toBe(true)
  })

  test('false when all values are empty', () => {
    expect(hasAnyChecksData({ t1: [], t2: {} })).toBe(false)
  })
})
