import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { createI18n } from 'vue-i18n'
import CoreFiltersPanel from '@/components/core/table/CoreFiltersPanel.vue'

const menuStub = {
  name: 'v-menu',
  props: ['modelValue'],
  template:
    '<div class="v-menu-stub"><slot name="activator" :props="{}" /><slot /></div>',
}

const defaultOperators: Record<string, string[]> = {
  string: ['is', 'contains', 'has_any_value'],
  number: ['is', 'is_between'],
  integer: ['is', 'is_between'],
  boolean: ['is'],
  date: ['is_between'],
  'date-time': ['is_between'],
}

describe('CoreFiltersPanel', () => {
  let vuetify: any
  let wrapper: any

  beforeEach(() => {
    vuetify = createVuetify({ components, directives })
  })

  afterEach(() => {
    if (wrapper) wrapper.unmount()
  })

  const baseProps = (overrides: Record<string, any> = {}) => ({
    showPanel: true,
    activeFilters: [],
    availableFields: [
      { key: 'name', title: 'Name', type: 'string' },
      { key: 'age', title: 'Age', type: 'number' },
      { key: 'active', title: 'Active', type: 'boolean' },
      { key: 'created', title: 'Created', type: 'date' },
    ],
    hasActiveFilters: false,
    activeFiltersCount: 0,
    getOperatorsForFieldType: (t: string) => defaultOperators[t] || ['is'],
    getOperatorText: (op: string) => `op:${op}`,
    operatorNeedsValue: (op: string) => op !== 'has_any_value',
    operatorNeedsSecondValue: (op: string) => op === 'is_between',
    generateFilterId: () => 'gen-id',
    ...overrides,
  })

  const createWrapper = (props = {}) => {
    const i18n = createI18n({
      legacy: false,
      locale: 'en',
      messages: {
        en: {
          table: {
            yes: 'Yes',
            no: 'No',
            filters: {
              addCondition: 'Add',
              field: 'Field',
              operator: 'Operator',
              value: 'Value',
              valueTo: 'Value to',
              dateFrom: 'From',
              dateTo: 'To',
              and: 'And',
              cancel: 'Cancel',
              apply: 'Apply',
            },
          },
        },
      },
    })
    return mount(CoreFiltersPanel, {
      props: { ...baseProps(), ...props },
      global: {
        plugins: [vuetify, i18n],
        stubs: {
          'v-menu': menuStub,
          'v-icon': true,
          CoreButton: {
            name: 'CoreButton',
            props: ['text', 'disabled'],
            template:
              '<button class="core-button-stub" :disabled="disabled" @click="$emit(\'click\')">{{ text }}</button>',
          },
        },
      },
    })
  }

  test('does not render panel when showPanel false', () => {
    wrapper = createWrapper({ showPanel: false })
    expect(wrapper.find('.core-filters-panel').exists()).toBe(false)
  })

  test('renders panel when showPanel true', () => {
    wrapper = createWrapper()
    expect(wrapper.find('.core-filters-panel').exists()).toBe(true)
  })

  test('renders a chip per active filter', () => {
    wrapper = createWrapper({
      activeFilters: [
        { id: '1', field: 'name', operator: 'is', value: 'Alice' },
        { id: '2', field: 'age', operator: 'is', value: 30 },
      ],
    })
    expect(
      wrapper.findAll('.core-filters-panel__filter-chip').length,
    ).toBeGreaterThanOrEqual(2)
  })

  test('fieldOptions maps available fields', () => {
    wrapper = createWrapper()
    const opts = (wrapper.vm as any).fieldOptions
    expect(opts[0]).toMatchObject({ title: 'Name', key: 'name', type: 'string' })
  })

  test('watcher initializes newFilter to first field on mount', () => {
    wrapper = createWrapper()
    expect((wrapper.vm as any).newFilter.field).toBe('name')
  })

  test('currentFieldType reflects selected field', async () => {
    wrapper = createWrapper()
    ;(wrapper.vm as any).newFilter.field = 'age'
    await wrapper.vm.$nextTick()
    expect((wrapper.vm as any).currentFieldType).toBe('number')
  })

  test('isBooleanFilterField and isDateOnlyFilterField computed', async () => {
    wrapper = createWrapper()
    const vm = wrapper.vm as any
    vm.newFilter.field = 'active'
    await wrapper.vm.$nextTick()
    expect(vm.isBooleanFilterField).toBe(true)
    vm.newFilter.field = 'created'
    await wrapper.vm.$nextTick()
    expect(vm.isDateOnlyFilterField).toBe(true)
  })

  test('handleNewFilterFieldChange for date field sets is_between', () => {
    wrapper = createWrapper()
    const vm = wrapper.vm as any
    vm.handleNewFilterFieldChange('created')
    expect(vm.newFilter.operator).toBe('is_between')
    expect(vm.newFilter.value).toBe('')
    expect(vm.newFilter.value2).toBe('')
  })

  test('handleNewFilterFieldChange for non-date sets first operator', () => {
    wrapper = createWrapper()
    const vm = wrapper.vm as any
    vm.handleNewFilterFieldChange('name')
    expect(vm.newFilter.operator).toBe('is')
    expect(vm.newFilter.value2).toBe(undefined)
  })

  test('handleNewFilterOperatorChange clears values when no value needed', () => {
    wrapper = createWrapper()
    const vm = wrapper.vm as any
    vm.newFilter.value = 'x'
    vm.newFilter.value2 = 'y'
    vm.handleNewFilterOperatorChange('has_any_value')
    expect(vm.newFilter.value).toBe('')
    expect(vm.newFilter.value2).toBe(undefined)
  })

  test('handleNewFilterOperatorChange clears value2 when no second value', () => {
    wrapper = createWrapper()
    const vm = wrapper.vm as any
    vm.newFilter.value = 'x'
    vm.newFilter.value2 = 'y'
    vm.handleNewFilterOperatorChange('is')
    expect(vm.newFilter.value2).toBe(undefined)
  })

  test('isNewFilterValid false with no field', async () => {
    wrapper = createWrapper({ availableFields: [] })
    expect((wrapper.vm as any).isNewFilterValid).toBe(false)
  })

  test('isNewFilterValid requires a date range value for date field', async () => {
    wrapper = createWrapper()
    const vm = wrapper.vm as any
    vm.newFilter.field = 'created'
    vm.handleNewFilterFieldChange('created')
    await wrapper.vm.$nextTick()
    expect(vm.isNewFilterValid).toBe(false)
    vm.newFilter.value = '2024-01-01'
    await wrapper.vm.$nextTick()
    expect(vm.isNewFilterValid).toBe(true)
  })

  test('isNewFilterValid requires value when operator needs value', async () => {
    wrapper = createWrapper()
    const vm = wrapper.vm as any
    vm.newFilter.field = 'name'
    vm.handleNewFilterFieldChange('name')
    await wrapper.vm.$nextTick()
    expect(vm.isNewFilterValid).toBe(false)
    vm.newFilter.value = 'Alice'
    await wrapper.vm.$nextTick()
    expect(vm.isNewFilterValid).toBe(true)
  })

  test('isNewFilterValid valid for has_any_value (no value needed)', async () => {
    wrapper = createWrapper()
    const vm = wrapper.vm as any
    vm.newFilter.field = 'name'
    vm.newFilter.operator = 'has_any_value'
    await wrapper.vm.$nextTick()
    expect(vm.isNewFilterValid).toBe(true)
  })

  test('applyNewFilter emits add-filter with normalized number value', async () => {
    wrapper = createWrapper()
    const vm = wrapper.vm as any
    vm.newFilter.field = 'age'
    vm.handleNewFilterFieldChange('age')
    vm.newFilter.value = '42'
    await wrapper.vm.$nextTick()
    vm.applyNewFilter()
    const emitted = wrapper.emitted('add-filter')![0][0] as any
    expect(emitted).toMatchObject({ id: 'gen-id', field: 'age', value: 42 })
  })

  test('applyNewFilter normalizes boolean field value', async () => {
    wrapper = createWrapper()
    const vm = wrapper.vm as any
    vm.newFilter.field = 'active'
    vm.newFilter.operator = 'is'
    vm.newFilter.value = true
    await wrapper.vm.$nextTick()
    vm.applyNewFilter()
    const emitted = wrapper.emitted('add-filter')![0][0] as any
    expect(emitted.value).toBe(true)
  })

  test('applyNewFilter resets form and closes menu', async () => {
    wrapper = createWrapper()
    const vm = wrapper.vm as any
    vm.handleNewFilterFieldChange('name')
    vm.newFilter.value = 'X'
    await wrapper.vm.$nextTick()
    vm.applyNewFilter()
    expect(vm.showAddFilterMenu).toBe(false)
    expect(vm.newFilter.field).toBe('name')
  })

  test('cancelAddFilter resets and closes', () => {
    wrapper = createWrapper()
    const vm = wrapper.vm as any
    vm.showAddFilterMenu = true
    vm.cancelAddFilter()
    expect(vm.showAddFilterMenu).toBe(false)
  })

  test('handleRemoveFilter emits remove-filter', () => {
    wrapper = createWrapper()
    ;(wrapper.vm as any).handleRemoveFilter('abc')
    expect(wrapper.emitted('remove-filter')![0]).toEqual(['abc'])
  })

  test('handleClearAllFilters emits clear-all-filters', () => {
    wrapper = createWrapper()
    ;(wrapper.vm as any).handleClearAllFilters()
    expect(wrapper.emitted('clear-all-filters')).toBeTruthy()
  })

  test('getFilterDisplayText handles has_any_value operator', () => {
    wrapper = createWrapper()
    const text = (wrapper.vm as any).getFilterDisplayText({
      field: 'name',
      operator: 'has_any_value',
      value: '',
    })
    expect(text).toContain('Name')
    expect(text).toContain('op:has_any_value')
  })

  test('getFilterDisplayText handles boolean field', () => {
    wrapper = createWrapper()
    const text = (wrapper.vm as any).getFilterDisplayText({
      field: 'active',
      operator: 'is',
      value: true,
    })
    expect(text).toBe('Active: Yes')
  })

  test('getFilterDisplayText handles date is_between with both values', () => {
    wrapper = createWrapper()
    const text = (wrapper.vm as any).getFilterDisplayText({
      field: 'created',
      operator: 'is_between',
      value: '2024-01-01',
      value2: '2024-02-01',
    })
    expect(text).toContain('2024-01-01')
    expect(text).toContain('2024-02-01')
  })

  test('getFilterDisplayText handles date is_between with only from', () => {
    wrapper = createWrapper()
    const text = (wrapper.vm as any).getFilterDisplayText({
      field: 'created',
      operator: 'is_between',
      value: '2024-01-01',
      value2: '',
    })
    expect(text).toContain('From')
  })

  test('getFilterDisplayText handles numeric is_between', () => {
    wrapper = createWrapper()
    const text = (wrapper.vm as any).getFilterDisplayText({
      field: 'age',
      operator: 'is_between',
      value: 10,
      value2: 20,
    })
    expect(text).toContain('10')
    expect(text).toContain('20')
  })

  test('getFilterDisplayText default branch', () => {
    wrapper = createWrapper()
    const text = (wrapper.vm as any).getFilterDisplayText({
      field: 'name',
      operator: 'is',
      value: 'Alice',
    })
    expect(text).toBe('Name op:is Alice')
  })

  test('getFilterDisplayText formats object value via title/label', () => {
    wrapper = createWrapper()
    const text = (wrapper.vm as any).getFilterDisplayText({
      field: 'name',
      operator: 'is',
      value: { title: 'ObjTitle' },
    })
    expect(text).toContain('ObjTitle')
  })

  test('dateInputTypeForField maps datetime to datetime-local', () => {
    wrapper = createWrapper()
    const fn = (wrapper.vm as any).dateInputTypeForField
    expect(fn('date-time')).toBe('datetime-local')
    expect(fn('datetime')).toBe('datetime-local')
    expect(fn('date')).toBe('date')
  })

  test('value2InputType returns number for numeric fields', async () => {
    wrapper = createWrapper()
    const vm = wrapper.vm as any
    vm.newFilter.field = 'age'
    await wrapper.vm.$nextTick()
    expect(vm.value2InputType).toBe('number')
    vm.newFilter.field = 'name'
    await wrapper.vm.$nextTick()
    expect(vm.value2InputType).toBe('text')
  })

  test('watcher resets filter when availableFields change and current field gone', async () => {
    wrapper = createWrapper()
    await wrapper.setProps({
      availableFields: [{ key: 'other', title: 'Other', type: 'string' }],
    })
    await wrapper.vm.$nextTick()
    expect((wrapper.vm as any).newFilter.field).toBe('other')
  })
})
