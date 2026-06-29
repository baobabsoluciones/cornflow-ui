import { describe, test, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'

// useFilters is invoked when searchText is set; return a recognizable filtered subset.
const mockUseFilters = vi.fn((items: any[]) => items.slice(0, 1))
vi.mock('@/utils/useFilters', () => ({
  default: (...args: any[]) => mockUseFilters(...args),
}))

import { useTableUtils } from '@/composables/core-table/useTableUtils'

const $t = (key: string) => key

beforeEach(() => {
  vi.clearAllMocks()
  mockUseFilters.mockImplementation((items: any[]) => items.slice(0, 1))
})

function setup(config: any = { properties: {} }, items: any[] = [], search = '') {
  return useTableUtils(ref(config), ref(items), ref(search), $t)
}

describe('useTableUtils', () => {
  test('getColumnAlignment maps boolean to center and others to start', () => {
    const u = setup()
    expect(u.getColumnAlignment('boolean')).toBe('center')
    expect(u.getColumnAlignment('string')).toBe('start')
    expect(u.getColumnAlignment('number')).toBe('start')
  })

  test('isBooleanField reflects schema type', () => {
    const u = setup({ properties: { flag: { type: 'boolean' }, name: { type: 'string' } } })
    expect(u.isBooleanField('flag')).toBe(true)
    expect(u.isBooleanField('name')).toBe(false)
    expect(u.isBooleanField('missing')).toBe(false)
  })

  test('isBooleanField false when config is null', () => {
    const u = useTableUtils(ref(null), ref([]), ref(''), $t)
    expect(u.isBooleanField('flag')).toBe(false)
  })

  test('formatBooleanValue uses translations', () => {
    const u = setup()
    expect(u.formatBooleanValue(true)).toBe('table.yes')
    expect(u.formatBooleanValue(false)).toBe('table.no')
  })

  test('getFieldType returns schema type or defaults to string', () => {
    const u = setup({ properties: { age: { type: 'integer' } } })
    expect(u.getFieldType('age')).toBe('integer')
    expect(u.getFieldType('unknown')).toBe('string')
  })

  test('filteredItems returns all items when search empty', () => {
    const items = [{ id: 1 }, { id: 2 }]
    const u = setup({ properties: {} }, items, '')
    expect(u.filteredItems.value).toEqual(items)
    expect(mockUseFilters).not.toHaveBeenCalled()
  })

  test('filteredItems returns all items when search is only whitespace', () => {
    const items = [{ id: 1 }, { id: 2 }]
    const u = setup({ properties: {} }, items, '   ')
    expect(u.filteredItems.value).toEqual(items)
    expect(mockUseFilters).not.toHaveBeenCalled()
  })

  test('filteredItems delegates to useFilters when search present', () => {
    const items = [{ id: 1 }, { id: 2 }]
    const u = setup({ properties: {} }, items, 'foo')
    expect(u.filteredItems.value).toEqual([{ id: 1 }])
    expect(mockUseFilters).toHaveBeenCalledWith(items, 'foo', {}, ['id'])
  })

  test('handleSearch is a no-op', () => {
    const u = setup()
    expect(() => u.handleSearch('whatever')).not.toThrow()
  })
})
