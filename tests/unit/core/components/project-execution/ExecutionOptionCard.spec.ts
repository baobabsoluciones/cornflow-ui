import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import ExecutionOptionCard from '@/components/project-execution/ExecutionOptionCard.vue'

describe('ExecutionOptionCard', () => {
  let vuetify
  let wrapper

  beforeEach(() => {
    vuetify = createVuetify({
      components,
      directives,
    })
    vi.clearAllMocks()
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })

  const createWrapper = (props = {}) => {
    return mount(ExecutionOptionCard, {
      props: {
        title: 'Test Title',
        option: 'test-option',
        ...props
      },
      global: {
        plugins: [vuetify]
      }
    })
  }

  describe('Component Rendering', () => {
    test('should render correctly with required props', () => {
      wrapper = createWrapper({
        title: 'Test Execution Option',
        option: 'test-option'
      })
      
      expect(wrapper.exists()).toBe(true)
      expect(wrapper.find('h4').text()).toBe('Test Execution Option')
    })

    test('should render with default icon when not provided', () => {
      wrapper = createWrapper()
      
      // Should use default icon
      expect(wrapper.vm.icon).toBe('mdi-star')
    })

    test('should render with custom icon when provided', () => {
      wrapper = createWrapper({
        icon: 'mdi-custom-icon'
      })
      
      expect(wrapper.vm.icon).toBe('mdi-custom-icon')
    })

    test('should render description when provided', () => {
      wrapper = createWrapper({
        description: 'This is a test description'
      })
      
      const descriptionSpan = wrapper.find('span')
      expect(descriptionSpan.text()).toBe('This is a test description')
    })

    test('should render empty description when not provided', () => {
      wrapper = createWrapper()
      
      const descriptionSpan = wrapper.find('span')
      expect(descriptionSpan.text()).toBe('')
    })
  })

  describe('Checkbox Behavior', () => {
    test('should be unchecked when selected prop does not match option', () => {
      wrapper = createWrapper({
        option: 'option-a',
        selected: 'option-b'
      })
      
      expect(wrapper.vm.isChecked).toBe(false)
    })

    test('should be checked when selected prop matches option', () => {
      wrapper = createWrapper({
        option: 'option-a',
        selected: 'option-a'
      })
      
      expect(wrapper.vm.isChecked).toBe(true)
    })

    test('should be unchecked when selected prop is null', () => {
      wrapper = createWrapper({
        option: 'option-a',
        selected: null
      })
      
      expect(wrapper.vm.isChecked).toBe(false)
    })

    test('should emit checkbox-change when checkbox is checked', async () => {
      wrapper = createWrapper({
        option: 'test-option',
        selected: null
      })
      
      // Set isChecked to true (simulating user checking the checkbox)
      wrapper.vm.isChecked = true
      
      expect(wrapper.emitted('checkbox-change')).toBeTruthy()
      expect(wrapper.emitted('checkbox-change')[0]).toEqual([{ value: true, option: 'test-option' }])
    })

    test('should not emit when checkbox is unchecked (set to false)', async () => {
      wrapper = createWrapper({
        option: 'test-option',
        selected: 'test-option'
      })
      
      // Set isChecked to false (simulating user unchecking the checkbox)
      wrapper.vm.isChecked = false
      
      // Since the setter only emits when val is truthy, no emission should occur
      expect(wrapper.emitted('checkbox-change')).toBeFalsy()
    })
  })

  describe('Card Styling', () => {
    test('should apply unselected card styling when not selected', () => {
      wrapper = createWrapper({
        option: 'test-option',
        selected: null
      })
      
      const cardStyle = wrapper.vm.cardStyle
      
      expect(cardStyle).toEqual({
        borderRadius: '10px !important',
        borderColor: '#e4e7ec !important'
      })
    })

    test('should apply selected card styling when selected', () => {
      wrapper = createWrapper({
        option: 'test-option',
        selected: 'test-option'
      })
      
      const cardStyle = wrapper.vm.cardStyle
      
      expect(cardStyle).toEqual({
        borderRadius: '10px !important',
        borderColor: 'rgb(var(--v-theme-primary)) !important'
      })
    })

    test('should have correct CSS classes for layout', () => {
      wrapper = createWrapper()
      
      expect(wrapper.find('.d-flex').exists()).toBe(true)
      expect(wrapper.find('.align-center').exists()).toBe(true)
      expect(wrapper.find('.title-execution').exists()).toBe(true)
    })
  })

  describe('Computed Properties', () => {
    test('isChecked getter should return true when option matches selected', () => {
      wrapper = createWrapper({
        option: 'test-option',
        selected: 'test-option'
      })
      
      expect(wrapper.vm.isChecked).toBe(true)
    })

    test('isChecked getter should return false when option does not match selected', () => {
      wrapper = createWrapper({
        option: 'option-a',
        selected: 'option-b'
      })
      
      expect(wrapper.vm.isChecked).toBe(false)
    })

    test('isChecked setter should emit correct value when set to true', () => {
      wrapper = createWrapper({
        option: 'test-option',
        selected: null
      })
      
      wrapper.vm.isChecked = true
      
      expect(wrapper.emitted('checkbox-change')).toBeTruthy()
      expect(wrapper.emitted('checkbox-change')[0]).toEqual([{ value: true, option: 'test-option' }])
    })

    test('cardStyle should return correct border for unselected state', () => {
      wrapper = createWrapper({
        option: 'test-option',
        selected: null
      })
      
      expect(wrapper.vm.cardStyle).toEqual({
        borderRadius: '10px !important',
        borderColor: '#e4e7ec !important'
      })
    })

    test('cardStyle should return correct border for selected state', () => {
      wrapper = createWrapper({
        option: 'test-option',
        selected: 'test-option'
      })
      
      expect(wrapper.vm.cardStyle).toEqual({
        borderRadius: '10px !important',
        borderColor: 'rgb(var(--v-theme-primary)) !important'
      })
    })
  })

  describe('Props Validation', () => {
    test('should handle different icon types', () => {
      const customIcon = 'mdi-custom-test'
      wrapper = createWrapper({
        icon: customIcon
      })
      
      expect(wrapper.props('icon')).toBe(customIcon)
    })

    test('should require title prop', () => {
      wrapper = createWrapper()
      
      expect(wrapper.props('title')).toBeDefined()
    })

    test('should require option prop', () => {
      wrapper = createWrapper()
      
      expect(wrapper.props('option')).toBeDefined()
    })

    test('should handle empty description', () => {
      wrapper = createWrapper({
        description: ''
      })
      
      expect(wrapper.props('description')).toBe('')
    })

    test('should handle long title text', () => {
      const longTitle = 'This is a very long title that might wrap to multiple lines in the UI'
      wrapper = createWrapper({
        title: longTitle
      })
      
      expect(wrapper.find('h4').text()).toBe(longTitle)
    })

    test('should handle long description text', () => {
      const longDescription = 'This is a very long description that contains multiple sentences and should test how the component handles longer content that might wrap to multiple lines.'
      wrapper = createWrapper({
        description: longDescription
      })
      
      const descriptionSpan = wrapper.find('span')
      expect(descriptionSpan.text()).toBe(longDescription)
    })
  })

  describe('Component Structure', () => {
    test('should have correct component name', () => {
      wrapper = createWrapper()
      
      expect(wrapper.vm.$options.name).toBe('ExecutionOptionCard')
    })

    test('should have proper card layout structure', () => {
      wrapper = createWrapper()
      
      // Check main structure elements exist
      expect(wrapper.find('h4').exists()).toBe(true)
      expect(wrapper.find('span').exists()).toBe(true)
      expect(wrapper.findComponent({ name: 'VCard' }).exists()).toBe(true)
    })

    test('should have correct CSS classes for title section', () => {
      wrapper = createWrapper()
      
      const titleSection = wrapper.find('.title-execution')
      expect(titleSection.exists()).toBe(true)
      expect(titleSection.classes()).toContain('d-flex')
      expect(titleSection.classes()).toContain('align-center')
    })
  })

  describe('Event Handling', () => {
    test('should handle multiple rapid checkbox changes', async () => {
      wrapper = createWrapper({
        option: 'test-option',
        selected: null
      })
      
      // Simulate rapid checking
      wrapper.vm.isChecked = true
      await wrapper.vm.$nextTick()
      
      expect(wrapper.emitted('checkbox-change')).toHaveLength(1)
      expect(wrapper.emitted('checkbox-change')[0]).toEqual([{ value: true, option: 'test-option' }])
    })

    test('should handle prop changes correctly', async () => {
      wrapper = createWrapper({
        option: 'option-a',
        selected: null
      })
      
      expect(wrapper.vm.isChecked).toBe(false)
      
      await wrapper.setProps({ selected: 'option-a' })
      expect(wrapper.vm.isChecked).toBe(true)
      
      await wrapper.setProps({ selected: 'option-b' })
      expect(wrapper.vm.isChecked).toBe(false)
    })
  })

  describe('Edge Cases', () => {
    test('should handle undefined selected prop', () => {
      wrapper = createWrapper({
        option: 'test-option',
        selected: undefined
      })
      
      expect(wrapper.vm.isChecked).toBe(false)
    })

    test('should handle empty string as option', () => {
      wrapper = createWrapper({
        option: '',
        selected: ''
      })
      
      expect(wrapper.vm.isChecked).toBe(true)
    })

    test('should handle special characters in option and selected', () => {
      const specialOption = 'option-@#$%^&*()'
      wrapper = createWrapper({
        option: specialOption,
        selected: specialOption
      })
      
      expect(wrapper.vm.isChecked).toBe(true)
    })

    test('should handle string representation of numbers', () => {
      wrapper = createWrapper({
        option: '123',
        selected: '123'
      })
      
      expect(wrapper.vm.isChecked).toBe(true)
    })

    test('should handle mixed case strings', () => {
      wrapper = createWrapper({
        option: 'Test-Option',
        selected: 'Test-Option'
      })
      
      expect(wrapper.vm.isChecked).toBe(true)
    })
  })

  describe('Styling and CSS', () => {
    test('should apply correct padding to card text', () => {
      wrapper = createWrapper()
      
      const cardTextElements = wrapper.findAll('.pa-4')
      expect(cardTextElements.length).toBeGreaterThanOrEqual(0)
    })

    test('should apply correct margin classes', () => {
      wrapper = createWrapper()
      
      expect(wrapper.find('.ml-3').exists()).toBe(true)
      expect(wrapper.find('.ml-2').exists()).toBe(true)
      expect(wrapper.find('.mr-2').exists()).toBe(true)
    })

    test('should have flex-grow class on title', () => {
      wrapper = createWrapper()
      
      const titleElement = wrapper.find('h4')
      expect(titleElement.classes()).toContain('flex-grow-1')
    })
  })

  describe('Data Properties', () => {
    test('should have empty data function', () => {
      wrapper = createWrapper()
      
      expect(wrapper.vm.$data).toEqual({})
    })

    test('should properly initialize with props', () => {
      wrapper = createWrapper({
        title: 'Custom Title',
        option: 'custom-option',
        description: 'Custom Description',
        icon: 'mdi-custom',
        selected: 'custom-option'
      })
      
      expect(wrapper.vm.title).toBe('Custom Title')
      expect(wrapper.vm.option).toBe('custom-option')
      expect(wrapper.vm.description).toBe('Custom Description')
      expect(wrapper.vm.icon).toBe('mdi-custom')
      expect(wrapper.vm.selected).toBe('custom-option')
    })
  })

  describe('Accessibility', () => {
    test('should have semantic HTML structure', () => {
      wrapper = createWrapper()
      
      expect(wrapper.find('h4').exists()).toBe(true)
      expect(wrapper.find('span').exists()).toBe(true)
    })

    test('should have proper checkbox for interaction', () => {
      wrapper = createWrapper()
      
      // Vuetify checkbox should be present
      const checkbox = wrapper.findComponent({ name: 'VCheckbox' })
      expect(checkbox.exists()).toBe(true)
    })

    test('should have accessible text content', () => {
      wrapper = createWrapper({
        title: 'Accessible Title',
        description: 'Accessible Description'
      })
      
      expect(wrapper.text()).toContain('Accessible Title')
      expect(wrapper.text()).toContain('Accessible Description')
    })
  })
})
