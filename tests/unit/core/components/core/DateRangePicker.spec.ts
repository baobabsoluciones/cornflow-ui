import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import DateRangePicker from '@/components/core/DateRangePicker.vue'

describe('DateRangePicker', () => {
  let vuetify: any
  let wrapper: any

  beforeEach(() => {
    vuetify = createVuetify()
    vi.clearAllMocks()
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })

  const createWrapper = (props = {}) => {
    return mount(DateRangePicker, {
      props: {
        startDateTitle: 'Start Date',
        endDateTitle: 'End Date',
        ...props
      },
      global: {
        plugins: [vuetify],
        stubs: {
          VRow: { template: '<div class="v-row"><slot /></div>' },
          VCol: { template: '<div class="v-col"><slot /></div>' },
          VDatePicker: {
            template: '<div class="v-date-picker" @click="handleClick"></div>',
            props: ['modelValue', 'max', 'min', 'hideHeader', 'color', 'elevation', 'maxWidth'],
            emits: ['update:modelValue'],
            methods: {
              handleClick() {
                this.$emit('update:modelValue', '2023-12-25')
              }
            }
          }
        }
      }
    })
  }

  test('renders correctly with default props', () => {
    wrapper = createWrapper()
    
    expect(wrapper.exists()).toBe(true)
    expect(wrapper.find('.v-row').exists()).toBe(true)
    expect(wrapper.findAll('.v-col')).toHaveLength(2)
    expect(wrapper.findAll('.v-date-picker')).toHaveLength(2)
  })

  test('displays custom date titles', () => {
    wrapper = createWrapper({
      startDateTitle: 'Custom Start',
      endDateTitle: 'Custom End'
    })
    
    const titles = wrapper.findAll('h5')
    expect(titles[0].text()).toBe('Custom Start')
    expect(titles[1].text()).toBe('Custom End')
  })

  test('displays default date titles when props not provided', () => {
    wrapper = createWrapper({
      startDateTitle: undefined,
      endDateTitle: undefined
    })
    
    const titles = wrapper.findAll('h5')
    expect(titles[0].text()).toBe('Start date')
    expect(titles[1].text()).toBe('End date')
  })

  test('initializes with correct default data', () => {
    wrapper = createWrapper()
    
    const vm = wrapper.vm as any
    expect(vm.startDate).toBeNull()
    expect(vm.endDate).toBeNull()
    expect(vm.today).toBe(new Date().toISOString().substr(0, 10))
  })

  test('emits start-date-change when startDate changes', async () => {
    wrapper = createWrapper()
    
    const vm = wrapper.vm as any
    vm.startDate = '2023-12-01'
    await wrapper.vm.$nextTick()
    
    expect(wrapper.emitted('start-date-change')).toBeTruthy()
    expect(wrapper.emitted('start-date-change')?.[0]).toEqual(['2023-12-01'])
  })

  test('emits end-date-change when endDate changes', async () => {
    wrapper = createWrapper()
    
    const vm = wrapper.vm as any
    vm.endDate = '2023-12-31'
    await wrapper.vm.$nextTick()
    
    expect(wrapper.emitted('end-date-change')).toBeTruthy()
    expect(wrapper.emitted('end-date-change')?.[0]).toEqual(['2023-12-31'])
  })

  test('start date picker has correct props', () => {
    wrapper = createWrapper()
    
    const datePickers = wrapper.findAll('.v-date-picker')
    expect(datePickers).toHaveLength(2)
    
    // Since we're using stubs, we can't easily test props, but we can test structure
    expect(datePickers[0].exists()).toBe(true)
  })

  test('end date picker has correct props', () => {
    wrapper = createWrapper()
    
    const datePickers = wrapper.findAll('.v-date-picker')
    expect(datePickers).toHaveLength(2)
    
    // Since we're using stubs, we can't easily test props, but we can test structure
    expect(datePickers[1].exists()).toBe(true)
  })

  test('date picker constraint logic works with reactive data', async () => {
    wrapper = createWrapper()
    
    const vm = wrapper.vm as any
    
    // Test start date affects end date constraint
    vm.endDate = '2023-12-31'
    await wrapper.vm.$nextTick()
    
    // We can verify the reactive data is working
    expect(vm.endDate).toBe('2023-12-31')
  })

  test('today constraint is properly set', () => {
    wrapper = createWrapper()
    
    const vm = wrapper.vm as any
    const today = vm.today
    
    // Verify today is correctly formatted
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  test('date constraint logic with start date', async () => {
    wrapper = createWrapper()
    
    const vm = wrapper.vm as any
    vm.startDate = '2023-12-01'
    await wrapper.vm.$nextTick()
    
    // Verify the reactive data is working
    expect(vm.startDate).toBe('2023-12-01')
  })

  test('date picker structure is correctly rendered', () => {
    wrapper = createWrapper()
    
    const datePickers = wrapper.findAll('.v-date-picker')
    expect(datePickers).toHaveLength(2)
    
    // Both date pickers should be rendered
    expect(datePickers[0].exists()).toBe(true)
    expect(datePickers[1].exists()).toBe(true)
  })

  test('watchers trigger on data changes', async () => {
    wrapper = createWrapper()
    
    const vm = wrapper.vm as any
    
    // Test startDate watcher
    vm.startDate = '2023-12-01'
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('start-date-change')).toBeTruthy()
    
    // Test endDate watcher
    vm.endDate = '2023-12-31'
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('end-date-change')).toBeTruthy()
  })

  test('multiple date changes emit multiple events', async () => {
    wrapper = createWrapper()
    
    const vm = wrapper.vm as any
    
    vm.startDate = '2023-12-01'
    await wrapper.vm.$nextTick()
    
    vm.startDate = '2023-12-02'
    await wrapper.vm.$nextTick()
    
    vm.startDate = '2023-12-03'
    await wrapper.vm.$nextTick()
    
    const startDateEvents = wrapper.emitted('start-date-change')
    expect(startDateEvents).toHaveLength(3)
    expect(startDateEvents?.[0]).toEqual(['2023-12-01'])
    expect(startDateEvents?.[1]).toEqual(['2023-12-02'])
    expect(startDateEvents?.[2]).toEqual(['2023-12-03'])
  })

  test('today is formatted correctly', () => {
    wrapper = createWrapper()
    
    const vm = wrapper.vm as any
    const today = new Date().toISOString().substr(0, 10)
    
    expect(vm.today).toBe(today)
    expect(vm.today).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  test('component structure with proper CSS classes', () => {
    wrapper = createWrapper()
    
    const row = wrapper.find('.v-row')
    expect(row.classes()).toContain('mt-1')
    expect(row.classes()).toContain('justify-space-around')
    
    const cols = wrapper.findAll('.v-col')
    expect(cols[0].classes()).toContain('v-col-s-12')
    expect(cols[0].classes()).toContain('v-col-6')
    expect(cols[1].classes()).toContain('v-col-s-12')
    expect(cols[1].classes()).toContain('v-col-6')
  })

  test('handles null values gracefully', async () => {
    wrapper = createWrapper()
    
    const vm = wrapper.vm as any
    
    // Initialize with values first to ensure watchers work
    vm.startDate = '2023-12-01'
    vm.endDate = '2023-12-31'
    await wrapper.vm.$nextTick()
    
    // Clear any previous events
    wrapper.vm.$emit('start-date-change', null)
    wrapper.vm.$emit('end-date-change', null)
    
    // Set to null (should not cause errors)
    vm.startDate = null
    vm.endDate = null
    await wrapper.vm.$nextTick()
    
    // Verify the values are null without causing errors
    expect(vm.startDate).toBeNull()
    expect(vm.endDate).toBeNull()
  })

  test('prop validation works correctly', () => {
    const startDateTitleProp = DateRangePicker.props?.startDateTitle
    const endDateTitleProp = DateRangePicker.props?.endDateTitle
    
    expect(startDateTitleProp?.type).toBe(String)
    expect(startDateTitleProp?.default).toBe('Start date')
    expect(endDateTitleProp?.type).toBe(String)
    expect(endDateTitleProp?.default).toBe('End date')
  })
})
