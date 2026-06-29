import { describe, test, expect, vi, beforeEach } from 'vitest'
import { ref, computed } from 'vue'

let idCounter = 0
vi.mock('@/utils/tableFilterUtils', () => ({
  generateSecureId: (prefix: string) => `${prefix}-${++idCounter}`,
}))

const ctrl = vi.hoisted(() => ({ rowSchema: null as any }))
vi.mock('@/utils/schemaUtils', () => ({
  getListResponseRowProperties: () => ctrl.rowSchema,
}))

import {
  useTableFilters,
  type FilterCondition,
} from '@/composables/core-table/useTableFilters'

const $t = (key: string) => `t:${key}`

beforeEach(() => {
  idCounter = 0
  ctrl.rowSchema = {
    properties: {
      id: { type: 'integer' },
      name: { type: 'string', title: 'Name' },
      age: { type: 'integer' },
      active: { type: 'boolean' },
      hidden_field: { type: 'string', frontendReadOnly: true },
      created: { type: 'string' },
    },
  }
})

function setup(items: any[] = []) {
  return useTableFilters(computed(() => items), computed(() => ({ x: 1 })), $t)
}

function cond(p: Partial<FilterCondition>): FilterCondition {
  return { id: p.id ?? 'f1', field: p.field ?? 'name', operator: p.operator ?? 'is', value: p.value, value2: p.value2 }
}

describe('useTableFilters - availableFields', () => {
  test('builds sorted fields excluding id and frontendReadOnly', () => {
    const f = setup()
    const keys = f.availableFields.value.map((x) => x.key)
    expect(keys).not.toContain('id')
    expect(keys).not.toContain('hidden_field')
    expect(keys).toContain('name')
    // sorted by title; titles default to formatted key
    const titles = f.availableFields.value.map((x) => x.title)
    expect([...titles]).toEqual([...titles].sort((a, b) => a.localeCompare(b)))
  })

  test('formats title from key when no schema title', () => {
    const f = setup()
    const created = f.availableFields.value.find((x) => x.key === 'created')
    expect(created?.title).toBe('Created')
  })

  test('returns empty when tableConfig falsy', () => {
    const f = useTableFilters(computed(() => []), computed(() => null), $t)
    expect(f.availableFields.value).toEqual([])
  })

  test('returns empty when rowSchema has no properties', () => {
    ctrl.rowSchema = {}
    const f = setup()
    expect(f.availableFields.value).toEqual([])
  })
})

describe('useTableFilters - operators metadata', () => {
  test('getOperatorsForFieldType per type', () => {
    const f = setup()
    expect(f.getOperatorsForFieldType('string')).toContain('contains')
    expect(f.getOperatorsForFieldType('number')).toContain('is_between')
    expect(f.getOperatorsForFieldType('integer')).toContain('is_greater_than_or_equal')
    expect(f.getOperatorsForFieldType('boolean')).toEqual(['is', 'is_not'])
    expect(f.getOperatorsForFieldType('date')).toContain('is_between')
    expect(f.getOperatorsForFieldType('weird')).toEqual(['is', 'is_not', 'contains', 'has_any_value'])
  })

  test('getOperatorText uses $t when provided', () => {
    const f = setup()
    expect(f.getOperatorText('is')).toBe('t:table.filters.operators.is')
  })

  test('getOperatorText falls back to English when no $t', () => {
    const f = useTableFilters(computed(() => []), computed(() => ({})))
    expect(f.getOperatorText('is_greater_than_or_equal')).toBe('is greater than or equal to')
    expect(f.getOperatorText('contains')).toBe('contains')
  })

  test('operatorNeedsValue / operatorNeedsSecondValue', () => {
    const f = setup()
    expect(f.operatorNeedsValue('has_any_value')).toBe(false)
    expect(f.operatorNeedsValue('is')).toBe(true)
    expect(f.operatorNeedsSecondValue('is_between')).toBe(true)
    expect(f.operatorNeedsSecondValue('is')).toBe(false)
  })
})

describe('useTableFilters - filteredItems / evaluateFilterCondition', () => {
  const items = [
    { id: 1, name: 'Alice', age: 30, active: true, created: '2020' },
    { id: 2, name: 'Bob', age: 20, active: false, created: '' },
    { id: 3, name: 'Carol', age: 40, active: true, created: null },
  ]

  test('returns all items when no active filters', () => {
    const f = setup(items)
    expect(f.filteredItems.value).toBe(items)
  })

  test('is operator (string) filters exact match', () => {
    const f = setup(items)
    f.addFilter(cond({ field: 'name', operator: 'is', value: 'Alice' }))
    expect(f.filteredItems.value.map((i) => i.id)).toEqual([1])
  })

  test('is_not operator', () => {
    const f = setup(items)
    f.addFilter(cond({ field: 'name', operator: 'is_not', value: 'Alice' }))
    expect(f.filteredItems.value.map((i) => i.id)).toEqual([2, 3])
  })

  test('contains operator case-insensitive and non-string returns false', () => {
    const f = setup(items)
    expect(f.evaluateFilterCondition(items[0], cond({ field: 'name', operator: 'contains', value: 'lic' }))).toBe(true)
    expect(f.evaluateFilterCondition(items[0], cond({ field: 'age', operator: 'contains', value: '30' }))).toBe(false)
  })

  test('has_any_value treats null/empty as missing', () => {
    const f = setup(items)
    f.addFilter(cond({ field: 'created', operator: 'has_any_value' }))
    expect(f.filteredItems.value.map((i) => i.id)).toEqual([1])
  })

  test('numeric comparison operators', () => {
    const f = setup(items)
    expect(f.evaluateFilterCondition(items[0], cond({ field: 'age', operator: 'is_greater_than', value: 25 }))).toBe(true)
    expect(f.evaluateFilterCondition(items[1], cond({ field: 'age', operator: 'is_less_than', value: 25 }))).toBe(true)
    expect(f.evaluateFilterCondition(items[0], cond({ field: 'age', operator: 'is_greater_than_or_equal', value: 30 }))).toBe(true)
    expect(f.evaluateFilterCondition(items[0], cond({ field: 'age', operator: 'is_less_than_or_equal', value: 30 }))).toBe(true)
    expect(f.evaluateFilterCondition(items[0], cond({ field: 'age', operator: 'is_between', value: 25, value2: 35 }))).toBe(true)
    expect(f.evaluateFilterCondition(items[2], cond({ field: 'age', operator: 'is_between', value: 25, value2: 35 }))).toBe(false)
  })

  test('boolean is comparison via compareValues', () => {
    const f = setup(items)
    f.addFilter(cond({ field: 'active', operator: 'is', value: true }))
    expect(f.filteredItems.value.map((i) => i.id)).toEqual([1, 3])
  })

  test('compareValues handles both-null and one-null', () => {
    const f = setup(items)
    // both null => true
    expect(f.evaluateFilterCondition({ created: null } as any, cond({ field: 'created', operator: 'is', value: null }))).toBe(true)
    // one null => false
    expect(f.evaluateFilterCondition({ created: null } as any, cond({ field: 'created', operator: 'is', value: 'x' }))).toBe(false)
  })

  test('numeric compareValues NaN returns false', () => {
    const f = setup(items)
    expect(f.evaluateFilterCondition({ age: 'abc' } as any, cond({ field: 'age', operator: 'is', value: 5 }))).toBe(false)
  })

  test('default branch returns true for unknown operator', () => {
    const f = setup(items)
    expect(f.evaluateFilterCondition(items[0], cond({ field: 'name', operator: 'nope' as any }))).toBe(true)
  })
})

describe('useTableFilters - mutations & modal', () => {
  test('addFilter, removeFilter, clearAllFilters, counts', () => {
    const f = setup()
    f.addFilter(cond({ id: 'a' }))
    f.addFilter(cond({ id: 'b' }))
    expect(f.activeFiltersCount.value).toBe(2)
    expect(f.hasActiveFilters.value).toBe(true)
    f.removeFilter('a')
    expect(f.activeFilters.value.map((x) => x.id)).toEqual(['b'])
    f.clearAllFilters()
    expect(f.activeFilters.value).toEqual([])
    expect(f.hasActiveFilters.value).toBe(false)
  })

  test('updateFilter merges updates and ignores unknown id', () => {
    const f = setup()
    f.addFilter(cond({ id: 'a', value: 'x' }))
    f.updateFilter('a', { value: 'y' })
    expect(f.activeFilters.value[0].value).toBe('y')
    f.updateFilter('missing', { value: 'z' })
    expect(f.activeFilters.value[0].value).toBe('y')
  })

  test('generateFilterId delegates to generateSecureId', () => {
    const f = setup()
    expect(f.generateFilterId()).toMatch(/^filter-\d+$/)
  })

  test('createEmptyFilter uses first available field and operator', () => {
    const f = setup()
    const c = f.createEmptyFilter()
    const first = f.availableFields.value[0]
    expect(c.field).toBe(first.key)
    expect(c.operator).toBe(f.getOperatorsForFieldType(first.type)[0])
    expect(c.value).toBe('')
  })

  test('createEmptyFilter defaults when no fields', () => {
    ctrl.rowSchema = {}
    const f = setup()
    const c = f.createEmptyFilter()
    expect(c.field).toBe('')
    expect(c.operator).toBe('is')
  })

  test('open/close filter modal', () => {
    const f = setup()
    f.openFilterModal()
    expect(f.showFilterModal.value).toBe(true)
    f.closeFilterModal()
    expect(f.showFilterModal.value).toBe(false)
  })
})
