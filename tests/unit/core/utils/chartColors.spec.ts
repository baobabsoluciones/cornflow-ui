import { describe, test, expect, afterEach, vi } from 'vitest'
import {
  getCSSVariable,
  getPrimaryColor,
  getChartColor,
  getChartColors,
  getColorWithOpacity,
} from '@cornflow-ui/core/utils/chartColors'

describe('chartColors', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    // Make sure any inline style we set during a test is removed.
    document.documentElement.style.removeProperty('--chart-color-1')
    document.documentElement.style.removeProperty('--primary')
    document.body.style.removeProperty('--chart-color-1')
  })

  describe('getCSSVariable', () => {
    test('reads a value defined on documentElement', () => {
      document.documentElement.style.setProperty('--chart-color-1', '#abcdef')
      expect(getCSSVariable('--chart-color-1')).toBe('#abcdef')
    })

    test('falls back to body when documentElement has no value', () => {
      // documentElement returns empty, body returns a value.
      document.body.style.setProperty('--chart-color-1', '#123456')
      expect(getCSSVariable('--chart-color-1')).toBe('#123456')
    })

    test('falls back to CHART_COLOR_FALLBACKS when nowhere defined', () => {
      expect(getCSSVariable('--chart-color-3')).toBe('#3ba780')
    })

    test('falls back to THEME_FALLBACKS for theme variables', () => {
      expect(getCSSVariable('--success')).toBe('#3ba780')
    })

    test('falls back to the generic primary for an unknown variable', () => {
      expect(getCSSVariable('--totally-unknown')).toBe('#326786')
    })
  })

  describe('getPrimaryColor', () => {
    test('returns the --primary fallback when undefined', () => {
      expect(getPrimaryColor()).toBe('#326786')
    })

    test('returns the defined --primary value', () => {
      document.documentElement.style.setProperty('--primary', '#0a0b0c')
      expect(getPrimaryColor()).toBe('#0a0b0c')
    })
  })

  describe('getChartColor', () => {
    test('1-based index maps to the matching chart variable', () => {
      expect(getChartColor(1)).toBe('#326786')
      expect(getChartColor(2)).toBe('#1e3f4f')
    })

    test('wraps around after 10', () => {
      // index 11 -> ((11-1) % 10) + 1 = 1
      expect(getChartColor(11)).toBe(getChartColor(1))
      // index 10 stays at 10
      expect(getChartColor(10)).toBe('#85c1d4')
    })
  })

  describe('getChartColors', () => {
    test('returns the requested count of colors', () => {
      const colors = getChartColors(3)
      expect(colors).toHaveLength(3)
      expect(colors[0]).toBe('#326786')
    })

    test('returns an empty array for zero', () => {
      expect(getChartColors(0)).toEqual([])
    })

    test('wraps past the palette size', () => {
      const colors = getChartColors(12)
      expect(colors).toHaveLength(12)
      expect(colors[10]).toBe(colors[0])
      expect(colors[11]).toBe(colors[1])
    })
  })

  describe('getColorWithOpacity', () => {
    test('converts a hex color to rgba', () => {
      expect(getColorWithOpacity('#326786', 0.5)).toBe('rgba(50, 103, 134, 0.5)')
    })

    test('handles black', () => {
      expect(getColorWithOpacity('#000000', 1)).toBe('rgba(0, 0, 0, 1)')
    })

    test('returns non-hex colors unchanged', () => {
      expect(getColorWithOpacity('rgb(1,2,3)', 0.5)).toBe('rgb(1,2,3)')
    })
  })
})
