import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import { createI18n } from 'vue-i18n'
import { ref, computed } from 'vue'
import CoreTab from '@/components/core/CoreTab.vue'

describe('CoreTab', () => {
  let vuetify: any
  let wrapper: any
  let mockTabsContext: any

  beforeEach(() => {
    vuetify = createVuetify()
    vi.clearAllMocks()

    // Create mock tabs context
    const modelValue = ref('tab1')
    mockTabsContext = {
      modelValue: computed(() => modelValue.value),
      selectTab: vi.fn((value) => {
        modelValue.value = value
      }),
      color: computed(() => 'primary'),
      sliderColor: computed(() => undefined),
      registerTab: vi.fn(),
      unregisterTab: vi.fn(),
    }
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })

  const createWrapper = (props = {}, context = mockTabsContext) => {
    const i18n = createI18n({
      legacy: false,
      locale: 'en',
      messages: { en: {} },
    })

    return mount(CoreTab, {
      props: {
        value: 'tab1',
        title: 'Test Tab',
        ...props,
      },
      global: {
        plugins: [vuetify, i18n],
        provide: {
          coreTabs: context,
        },
        stubs: {
          'v-icon': {
            template: '<i class="v-icon" :data-icon="icon"><slot /></i>',
            props: ['icon', 'size'],
          },
        },
      },
    })
  }

  describe('Component Rendering', () => {
    test('renders the tab button correctly', () => {
      wrapper = createWrapper()

      expect(wrapper.find('button.m-tab').exists()).toBe(true)
      expect(wrapper.find('.m-tab__wrapper').exists()).toBe(true)
      expect(wrapper.find('.m-tab__content').exists()).toBe(true)
    })

    test('renders title prop correctly', () => {
      wrapper = createWrapper({ title: 'My Tab Title' })

      expect(wrapper.text()).toContain('My Tab Title')
    })

    test('renders slot content when provided', () => {
      wrapper = mount(CoreTab, {
        props: { value: 'tab1' },
        slots: {
          default: '<span>Custom Content</span>',
        },
        global: {
          plugins: [vuetify],
          provide: {
            coreTabs: mockTabsContext,
          },
          stubs: {
            'v-icon': true,
          },
        },
      })

      expect(wrapper.text()).toContain('Custom Content')
    })

    test('applies correct CSS classes', () => {
      wrapper = createWrapper({ value: 'tab1' })
      mockTabsContext.modelValue = computed(() => 'tab1')

      const button = wrapper.find('button.m-tab')
      expect(button.classes()).toContain('m-tab--selected')
    })

    test('applies disabled class when disabled', () => {
      wrapper = createWrapper({ disabled: true })

      const button = wrapper.find('button.m-tab')
      expect(button.classes()).toContain('m-tab--disabled')
      expect(button.attributes('disabled')).toBeDefined()
    })

    test('applies fixed class when fixed prop is true', () => {
      wrapper = createWrapper({ fixed: true })

      const button = wrapper.find('button.m-tab')
      expect(button.classes()).toContain('m-tab--fixed')
    })

    test('applies stacked class when stacked prop is true', () => {
      wrapper = createWrapper({ stacked: true })

      const button = wrapper.find('button.m-tab')
      expect(button.classes()).toContain('m-tab--stacked')
    })
  })

  describe('Icons', () => {
    test('renders prepend icon when provided', () => {
      wrapper = createWrapper({ prependIcon: 'mdi-home' })

      const prepend = wrapper.find('.m-tab__prepend')
      expect(prepend.exists()).toBe(true)
      expect(prepend.find('.v-icon').attributes('data-icon')).toBe('mdi-home')
    })

    test('renders icon when provided (used as prepend)', () => {
      wrapper = createWrapper({ icon: 'mdi-star' })

      const prepend = wrapper.find('.m-tab__prepend')
      expect(prepend.exists()).toBe(true)
      expect(prepend.find('.v-icon').attributes('data-icon')).toBe('mdi-star')
    })

    test('prefers prependIcon over icon', () => {
      wrapper = createWrapper({
        prependIcon: 'mdi-home',
        icon: 'mdi-star',
      })

      const prepend = wrapper.find('.m-tab__prepend')
      expect(prepend.find('.v-icon').attributes('data-icon')).toBe('mdi-home')
    })

    test('renders append icon when provided', () => {
      wrapper = createWrapper({ appendIcon: 'mdi-close' })

      const append = wrapper.find('.m-tab__append')
      expect(append.exists()).toBe(true)
      expect(append.find('.v-icon').attributes('data-icon')).toBe('mdi-close')
    })

    test('does not render prepend/append when no icons provided', () => {
      wrapper = createWrapper()

      expect(wrapper.find('.m-tab__prepend').exists()).toBe(false)
      expect(wrapper.find('.m-tab__append').exists()).toBe(false)
    })
  })

  describe('Selection State', () => {
    test('marks tab as selected when value matches modelValue', () => {
      const modelValue = ref('tab1')
      const context = {
        ...mockTabsContext,
        modelValue: computed(() => modelValue.value),
      }
      wrapper = createWrapper({ value: 'tab1' }, context)

      expect(wrapper.find('button.m-tab').classes()).toContain('m-tab--selected')
      expect(wrapper.find('button').attributes('aria-selected')).toBe('true')
    })

    test('marks tab as not selected when value does not match', () => {
      const modelValue = ref('tab2')
      const context = {
        ...mockTabsContext,
        modelValue: computed(() => modelValue.value),
      }
      wrapper = createWrapper({ value: 'tab1' }, context)

      expect(wrapper.find('button.m-tab').classes()).not.toContain(
        'm-tab--selected',
      )
      expect(wrapper.find('button').attributes('aria-selected')).toBe('false')
    })

    test('handles numeric values correctly', () => {
      const modelValue = ref(1)
      const context = {
        ...mockTabsContext,
        modelValue: computed(() => modelValue.value),
      }
      wrapper = createWrapper({ value: 1 }, context)

      expect(wrapper.find('button.m-tab').classes()).toContain('m-tab--selected')
    })

    test('handles string vs number comparison', () => {
      const modelValue = ref('1')
      const context = {
        ...mockTabsContext,
        modelValue: computed(() => modelValue.value),
      }
      wrapper = createWrapper({ value: 1 }, context)

      // Should match due to type coercion (==)
      expect(wrapper.find('button.m-tab').classes()).toContain('m-tab--selected')
    })
  })

  describe('Indicator and Styles', () => {
    test('renders indicator when selected and hideSlider is false', () => {
      const modelValue = ref('tab1')
      const context = {
        ...mockTabsContext,
        modelValue: computed(() => modelValue.value),
      }
      wrapper = createWrapper({ value: 'tab1' }, context)

      // Indicator is hidden when selected (CSS rule)
      const indicator = wrapper.find('.m-tab__indicator')
      expect(indicator.exists()).toBe(true)
    })

    test('hides indicator when hideSlider is true', () => {
      const modelValue = ref('tab1')
      const context = {
        ...mockTabsContext,
        modelValue: computed(() => modelValue.value),
      }
      wrapper = createWrapper({ value: 'tab1', hideSlider: true }, context)

      const indicator = wrapper.find('.m-tab__indicator')
      expect(indicator.exists()).toBe(false)
    })

    test('applies color styles when selected', () => {
      const modelValue = ref('tab1')
      const context = {
        ...mockTabsContext,
        modelValue: computed(() => modelValue.value),
        color: computed(() => 'primary'),
      }
      wrapper = createWrapper({ value: 'tab1' }, context)

      const button = wrapper.find('button.m-tab')
      const style = button.attributes('style')
      expect(style).toBeDefined()
    })

    test('uses sliderColor over color when both provided', () => {
      const modelValue = ref('tab1')
      const context = {
        ...mockTabsContext,
        modelValue: computed(() => modelValue.value),
        color: computed(() => 'primary'),
        sliderColor: computed(() => 'success'),
      }
      wrapper = createWrapper({ value: 'tab1' }, context)

      const button = wrapper.find('button.m-tab')
      const style = button.attributes('style')
      expect(style).toBeDefined()
    })
  })

  describe('Event Handling', () => {
    test('calls selectTab when clicked', async () => {
      wrapper = createWrapper({ value: 'tab1' })

      await wrapper.find('button').trigger('click')

      expect(mockTabsContext.selectTab).toHaveBeenCalledWith('tab1')
    })

    test('emits click event when clicked', async () => {
      wrapper = createWrapper()

      await wrapper.find('button').trigger('click')

      expect(wrapper.emitted('click')).toBeTruthy()
      expect(wrapper.emitted('click')![0][0]).toBeInstanceOf(Event)
    })

    test('does not call selectTab when disabled', async () => {
      wrapper = createWrapper({ disabled: true })

      await wrapper.find('button').trigger('click')

      expect(mockTabsContext.selectTab).not.toHaveBeenCalled()
    })

    test('handles Enter key press', async () => {
      wrapper = createWrapper({ value: 'tab1' })

      await wrapper.find('button').trigger('keydown', { key: 'Enter' })

      expect(mockTabsContext.selectTab).toHaveBeenCalledWith('tab1')
    })

    test('handles Space key press', async () => {
      wrapper = createWrapper({ value: 'tab1' })

      await wrapper.find('button').trigger('keydown', { key: ' ' })

      expect(mockTabsContext.selectTab).toHaveBeenCalledWith('tab1')
    })

    test('does not handle keydown when disabled', async () => {
      wrapper = createWrapper({ disabled: true, value: 'tab1' })

      await wrapper.find('button').trigger('keydown', { key: 'Enter' })

      expect(mockTabsContext.selectTab).not.toHaveBeenCalled()
    })
  })

  describe('Tab Registration', () => {
    test('registers tab on mount', async () => {
      wrapper = createWrapper({ value: 'tab1', title: 'Test Tab' })

      await wrapper.vm.$nextTick()

      expect(mockTabsContext.registerTab).toHaveBeenCalledWith(
        'tab1',
        'Test Tab',
        expect.any(HTMLElement),
      )
    })

    test('unregisters tab on unmount', () => {
      wrapper = createWrapper({ value: 'tab1' })

      wrapper.unmount()

      expect(mockTabsContext.unregisterTab).toHaveBeenCalledWith('tab1')
    })

    test('updates registration when title changes', async () => {
      wrapper = createWrapper({ value: 'tab1', title: 'Original Title' })

      await wrapper.setProps({ title: 'New Title' })
      await wrapper.vm.$nextTick()

      expect(mockTabsContext.registerTab).toHaveBeenCalledWith(
        'tab1',
        'New Title',
        expect.any(HTMLElement),
      )
    })

    test('does not register when value is undefined', () => {
      wrapper = createWrapper({ value: undefined })

      expect(mockTabsContext.registerTab).not.toHaveBeenCalled()
    })
  })

  describe('Accessibility', () => {
    test('has correct ARIA attributes', () => {
      wrapper = createWrapper({ value: 'tab1' })

      const button = wrapper.find('button')
      expect(button.attributes('role')).toBe('tab')
      expect(button.attributes('aria-controls')).toBe('tabpanel-tab1')
      expect(button.attributes('id')).toBe('tab-tab1')
    })

    test('has correct aria-selected attribute', () => {
      const modelValue = ref('tab1')
      const context = {
        ...mockTabsContext,
        modelValue: computed(() => modelValue.value),
      }
      wrapper = createWrapper({ value: 'tab1' }, context)

      expect(wrapper.find('button').attributes('aria-selected')).toBe('true')
    })
  })

  describe('Edge Cases', () => {
    test('handles missing tabs context gracefully', () => {
      wrapper = mount(CoreTab, {
        props: { value: 'tab1', title: 'Test' },
        global: {
          plugins: [vuetify],
          provide: {
            coreTabs: null,
          },
          stubs: {
            'v-icon': true,
          },
        },
      })

      expect(wrapper.find('button.m-tab').exists()).toBe(true)
      expect(wrapper.find('button').classes()).not.toContain('m-tab--selected')
    })

    test('handles undefined value', () => {
      wrapper = createWrapper({ value: undefined })

      expect(wrapper.find('button.m-tab').exists()).toBe(true)
    })

    test('gets label from text content when title not provided', async () => {
      wrapper = mount(CoreTab, {
        props: { value: 'tab1' },
        slots: {
          default: '<span>Slot Content</span>',
        },
        global: {
          plugins: [vuetify],
          provide: {
            coreTabs: mockTabsContext,
          },
          stubs: {
            'v-icon': true,
          },
        },
      })

      await wrapper.vm.$nextTick()

      // Should register with text content from slot
      expect(mockTabsContext.registerTab).toHaveBeenCalled()
    })
  })
})

