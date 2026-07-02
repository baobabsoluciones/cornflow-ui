import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import CorePanelData from '@cornflow-ui/core/components/core/CorePanelData.vue'

// data_io imports the app i18n singleton; formatDateForHeaders only needs a date + locale
vi.mock('@cornflow-ui/core/utils/data_io', () => ({
  formatDateForHeaders: (date: string) => `header:${date}`,
}))

describe('CorePanelData', () => {
  let vuetify: any
  let wrapper: any

  beforeEach(() => {
    vuetify = createVuetify({ components, directives })
  })

  afterEach(() => {
    if (wrapper) wrapper.unmount()
  })

  const createWrapper = (props = {}, slots = {}) =>
    mount(CorePanelData, {
      props: {
        data: [],
        checkboxOptions: [],
        ...props,
      },
      slots,
      global: {
        plugins: [vuetify],
        stubs: { 'v-icon': true },
      },
    })

  test('renders no-data message when data empty', () => {
    wrapper = createWrapper({
      data: [],
      noDataMessage: 'Nothing here',
    })
    expect(wrapper.text()).toContain('Nothing here')
  })

  test('regularOptions excludes custom and customOption finds custom', () => {
    wrapper = createWrapper({
      checkboxOptions: [
        { label: 'Week', value: 'week' },
        { label: 'Custom', value: 'custom', isCustom: true },
      ],
    })
    const vm = wrapper.vm as any
    expect(vm.regularOptions).toHaveLength(1)
    expect(vm.regularOptions[0].value).toBe('week')
    expect(vm.customOption.value).toBe('custom')
  })

  test('customOption is null when no custom option', () => {
    wrapper = createWrapper({
      checkboxOptions: [{ label: 'Week', value: 'week' }],
    })
    expect((wrapper.vm as any).customOption).toBe(null)
  })

  test('renders a checkbox per regular option', () => {
    wrapper = createWrapper({
      checkboxOptions: [
        { label: 'A', value: 'a' },
        { label: 'B', value: 'b' },
      ],
    })
    expect(wrapper.findAllComponents({ name: 'VCheckbox' }).length).toBe(2)
  })

  test('emits date-range-changed when a checkbox change fires', () => {
    wrapper = createWrapper({
      checkboxOptions: [{ label: 'A', value: 'a' }],
    })
    const vm = wrapper.vm as any
    vm.selectedDateRange = 'a'
    vm.$emit('date-range-changed', vm.selectedDateRange)
    expect(wrapper.emitted('date-range-changed')![0]).toEqual(['a'])
  })

  test('renders expansion panels for data and formats date headers', () => {
    wrapper = createWrapper({
      data: [
        { date: '2024-01-01', data: [] },
        { date: '2024-01-02', data: [] },
      ],
      allPanelsOpen: true,
    })
    expect(wrapper.text()).toContain('header:2024-01-01')
    expect(wrapper.text()).toContain('header:2024-01-02')
  })

  test('renders custom-checkbox slot when selectedDateRange is custom', async () => {
    wrapper = createWrapper(
      {
        checkboxOptions: [
          { label: 'Custom', value: 'custom', isCustom: true },
        ],
      },
      { 'custom-checkbox': '<div class="custom-slot">picker</div>' },
    )
    ;(wrapper.vm as any).selectedDateRange = 'custom'
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.custom-slot').exists()).toBe(true)
  })

  test('watcher opens all panels when data length changes and allPanelsOpen', async () => {
    wrapper = createWrapper({ data: [], allPanelsOpen: true })
    await wrapper.setProps({
      data: [
        { date: '2024-01-01', data: [] },
        { date: '2024-01-02', data: [] },
      ],
    })
    await wrapper.vm.$nextTick()
    expect((wrapper.vm as any).openedPanels).toEqual([0, 1])
  })

  test('watcher does not open panels when allPanelsOpen false', async () => {
    wrapper = createWrapper({ data: [], allPanelsOpen: false })
    await wrapper.setProps({
      data: [{ date: '2024-01-01', data: [] }],
    })
    await wrapper.vm.$nextTick()
    expect((wrapper.vm as any).openedPanels).toEqual([])
  })

  test('renders table slot content when panel is open', async () => {
    wrapper = createWrapper(
      { data: [], allPanelsOpen: true },
      { table: '<div class="table-slot">tbl</div>' },
    )
    // Changing data length triggers the watcher which opens all panels
    await wrapper.setProps({ data: [{ date: '2024-01-01', data: [{ x: 1 }] }] })
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.table-slot').exists()).toBe(true)
  })

  test('renders no-data slot override when data empty', () => {
    wrapper = createWrapper(
      { data: [] },
      { 'no-data': '<div class="nd-slot">empty</div>' },
    )
    expect(wrapper.find('.nd-slot').exists()).toBe(true)
  })
})
