import { describe, test, expect } from 'vitest'
import { fmtK, formatDate, formatDateLong, dayKey } from '@cornflow-ui/core/utils/chartFormat'

describe('fmtK', () => {
  test('formats millions, thousands and small numbers', () => {
    expect(fmtK(1_500_000)).toBe('1.5M')
    expect(fmtK(34_000)).toBe('34K')
    expect(fmtK(567)).toBe('567')
    expect(fmtK(-2_000)).toBe('-2K')
    expect(fmtK(0)).toBe('0')
  })
})

describe('formatDate', () => {
  test('zero-pads day/month', () => {
    expect(formatDate(new Date(2026, 2, 5))).toBe('05/03')
    expect(formatDate(new Date(2026, 10, 25))).toBe('25/11')
  })
})

describe('formatDateLong', () => {
  test('prefixes a weekday and appends the year', () => {
    const out = formatDateLong(new Date(2026, 2, 5))
    expect(out).toMatch(/^(Dom|Lun|Mar|Mié|Jue|Vie|Sáb) 05\/03\/2026$/)
  })
})

describe('dayKey', () => {
  test('builds a year-month-date key (month is 0-based)', () => {
    expect(dayKey(new Date(2026, 2, 5))).toBe('2026-2-5')
  })
})
