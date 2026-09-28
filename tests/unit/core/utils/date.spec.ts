import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import {
  formatDateForFilename,
  formatLocalDateKey,
  formatLocalTimeHHmm,
  normalizeBackendDate,
  parseLocalDateKey,
  toUTCDayBoundary,
} from '@cornflow-ui/core/utils/date'

describe('formatDateForFilename', () => {
  test('formats a date correctly regardless of timezone', () => {
    // Create a date and format it, then check the structure
    const dateString = '2023-12-25T15:30:45.123Z'
    const result = formatDateForFilename(dateString)
    
    // Check that result matches the expected pattern
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}-\d{2}-\d{2}$/)
    
    // Check that the date parts are properly padded
    const parts = result.split('-')
    expect(parts).toHaveLength(5)
    expect(parts[0]).toHaveLength(4) // year
    expect(parts[1]).toHaveLength(2) // month
    expect(parts[2]).toHaveLength(2) // day
    expect(parts[3]).toHaveLength(2) // hour
    expect(parts[4]).toHaveLength(2) // minute
  })

  test('formats date with local time input', () => {
    const result = formatDateForFilename('2023-01-05 08:15:30')
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}-\d{2}-\d{2}$/)
  })

  test('ensures date components are properly padded', () => {
    // Test various date components to ensure padding
    const testCases = [
      '2023-01-05T01:05:30',
      '2023-12-25T23:59:30',
      '2024-02-29T00:00:30'
    ]
    
    testCases.forEach(dateStr => {
      const result = formatDateForFilename(dateStr)
      const parts = result.split('-')
      
      // Each part should be properly padded
      expect(parts[1]).toHaveLength(2) // month
      expect(parts[2]).toHaveLength(2) // day
      expect(parts[3]).toHaveLength(2) // hour
      expect(parts[4]).toHaveLength(2) // minute
    })
  })

  test('handles different date string formats', () => {
    const formats = [
      '2023-12-25T15:30:45',
      '2023-12-25T15:30:45.123Z',
      'December 25, 2023 15:30:45'
    ]
    
    formats.forEach(format => {
      const result = formatDateForFilename(format)
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}-\d{2}-\d{2}$/)
    })
  })

  test('maintains consistent format across different years', () => {
    const years = ['1990-01-01T00:00:00', '2024-12-31T23:59:59', '2030-06-15T12:30:45']
    
    years.forEach(dateStr => {
      const result = formatDateForFilename(dateStr)
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}-\d{2}-\d{2}$/)
    })
  })

  test('handles Date object input', () => {
    const date = new Date('2023-12-25T15:30:45.123Z')
    const result = formatDateForFilename(date.toISOString())
    
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}-\d{2}-\d{2}$/)
    expect(result).toContain('2023-12-')
  })

  test('preserves year integrity', () => {
    const result = formatDateForFilename('2023-12-25T15:30:45.123Z')
    expect(result.startsWith('2023-')).toBe(true)
  })

  test('handles leap year dates', () => {
    const result = formatDateForFilename('2024-02-29T12:30:45.123Z')
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}-\d{2}-\d{2}$/)
    expect(result).toContain('-02-')
  })
})

describe('normalizeBackendDate', () => {
  test('treats naive backend timestamps as UTC', () => {
    expect(normalizeBackendDate('2026-09-28T08:30:12.123456')).toBe(
      '2026-09-28T08:30:12.123Z',
    )
    expect(normalizeBackendDate('2026-09-28T08:30:12')).toBe(
      '2026-09-28T08:30:12Z',
    )
  })

  test('keeps timestamps that already carry a timezone', () => {
    expect(normalizeBackendDate('2026-09-28T08:30:12Z')).toBe(
      '2026-09-28T08:30:12Z',
    )
    expect(normalizeBackendDate('2026-09-28T08:30:12+02:00')).toBe(
      '2026-09-28T08:30:12+02:00',
    )
    expect(normalizeBackendDate('2026-09-28T08:30:12-0530')).toBe(
      '2026-09-28T08:30:12-0530',
    )
  })

  test('accepts a space as date/time separator', () => {
    expect(normalizeBackendDate('2026-09-28 08:30:12')).toBe(
      '2026-09-28T08:30:12Z',
    )
  })

  test('leaves unrecognised values untouched', () => {
    expect(normalizeBackendDate('not a date')).toBe('not a date')
    expect(normalizeBackendDate('')).toBe('')
  })

  test('leaves date-only and empty values untouched', () => {
    expect(normalizeBackendDate('2026-09-28')).toBe('2026-09-28')
    expect(normalizeBackendDate(null)).toBeNull()
    expect(normalizeBackendDate(undefined)).toBeUndefined()
  })
})

describe('parseLocalDateKey', () => {
  test('reads a bare day as local midnight', () => {
    expect(parseLocalDateKey('2026-09-28')).toEqual(new Date(2026, 8, 28))
  })

  test('falls back to Date parsing for other values', () => {
    const value = '2026-09-28T08:30:00Z'
    expect(parseLocalDateKey(value)).toEqual(new Date(value))
  })
})

describe('invalid dates', () => {
  test('local formatters return an empty string', () => {
    expect(formatLocalDateKey('invalid-date')).toBe('')
    expect(formatLocalTimeHHmm('invalid-date')).toBe('')
  })
})

describe('local timezone formatting (Europe/Madrid)', () => {
  // Restore by re-assigning the resolved zone: deleting TZ does not reset
  // Node's cached timezone.
  const originalTZ =
    process.env.TZ ?? Intl.DateTimeFormat().resolvedOptions().timeZone

  beforeAll(() => {
    process.env.TZ = 'Europe/Madrid'
  })

  afterAll(() => {
    process.env.TZ = originalTZ
  })

  test('shows the local time of a naive UTC backend timestamp', () => {
    const createdAt = normalizeBackendDate('2026-09-28T08:30:00')
    // CEST (UTC+2) in September
    expect(formatLocalTimeHHmm(createdAt)).toBe('10:30')
    // CET (UTC+1) in January
    expect(formatLocalTimeHHmm(normalizeBackendDate('2026-01-15T08:30:00'))).toBe(
      '09:30',
    )
  })

  test('groups executions around midnight on the local day', () => {
    const createdAt = normalizeBackendDate('2026-09-28T23:30:00')
    expect(formatLocalDateKey(createdAt)).toBe('2026-09-29')
    expect(formatLocalTimeHHmm(createdAt)).toBe('01:30')
  })

  test('uses local time in download filenames', () => {
    expect(
      formatDateForFilename(normalizeBackendDate('2026-09-28T08:30:00')),
    ).toBe('2026-09-28-10-30')
  })

  test('parses picked days in a timezone west of UTC without shifting', () => {
    process.env.TZ = 'America/Mexico_City'
    try {
      const day = parseLocalDateKey('2026-09-28')
      expect(day.getDate()).toBe(28)
      expect(toUTCDayBoundary(day)).toBe('2026-09-28T06:00:00.000Z')
    } finally {
      process.env.TZ = 'Europe/Madrid'
    }
  })

  test('builds UTC boundaries for the local day', () => {
    const day = new Date(2026, 8, 28, 15, 0, 0)
    expect(toUTCDayBoundary(day)).toBe('2026-09-27T22:00:00.000Z')
    expect(toUTCDayBoundary(day, true)).toBe('2026-09-28T21:59:59.999Z')
    // Does not mutate the input
    expect(day.getHours()).toBe(15)
  })
})
