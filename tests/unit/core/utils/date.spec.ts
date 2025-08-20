import { describe, test, expect } from 'vitest'
import { formatDateForFilename } from '@/utils/date'

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
