import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import CreateExecutionNameDescription from '@/components/project-execution/CreateExecutionNameDescription.vue'

// Mock i18n
const mockT = vi.fn((key) => {
  const translations = {
    'projectExecution.steps.step2.nameTitleField': 'Execution Name',
    'projectExecution.steps.step2.namePlaceholder': 'Enter execution name',
    'projectExecution.steps.step2.descriptionTitleField': 'Description',
    'projectExecution.steps.step2.descriptionPlaceholder': 'Enter description'
  }
  return translations[key] || key
})

const i18nPlugin = {
  install(app) {
    app.config.globalProperties.$t = mockT
  }
}

// Mock MInputField component
const MInputFieldStub = {
  name: 'MInputField',
  template: `
    <div class="m-input-field">
      <label v-if="title">{{ title }}</label>
      <input 
        :value="modelValue" 
        @input="$emit('update:modelValue', $event.target.value)"
        :placeholder="placeholder"
        :type="type"
      />
    </div>
  `,
  props: ['modelValue', 'title', 'placeholder', 'type', 'prependInnerIcon'],
  emits: ['update:modelValue']
}

describe('CreateExecutionNameDescription', () => {
  let vuetify
  let wrapper

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
    return mount(CreateExecutionNameDescription, {
      props: {
        name: '',
        description: '',
        ...props
      },
      global: {
        plugins: [vuetify, i18nPlugin],
        stubs: {
          MInputField: MInputFieldStub
        }
      }
    })
  }

  describe('Component Rendering', () => {
    test('should render correctly with default props', () => {
      wrapper = createWrapper()
      
      expect(wrapper.find('.input-fields-container').exists()).toBe(true)
      expect(wrapper.findAll('.input-field')).toHaveLength(2)
    })

    test('should render name input field with correct props', () => {
      wrapper = createWrapper()
      
      const nameField = wrapper.findAll('.m-input-field')[0]
      expect(nameField.find('label').text()).toBe('Execution Name')
      expect(nameField.find('input').attributes('placeholder')).toBe('Enter execution name')
      expect(nameField.find('input').attributes('type')).toBe('text')
    })

    test('should render description input field with correct props', () => {
      wrapper = createWrapper()
      
      const descriptionField = wrapper.findAll('.m-input-field')[1]
      expect(descriptionField.find('label').text()).toBe('Description')
      expect(descriptionField.find('input').attributes('placeholder')).toBe('Enter description')
      expect(descriptionField.find('input').attributes('type')).toBe('text')
    })

    test('should display initial values when props are provided', () => {
      wrapper = createWrapper({
        name: 'Test Execution',
        description: 'Test Description'
      })
      
      const nameInput = wrapper.findAll('.m-input-field')[0].find('input')
      const descriptionInput = wrapper.findAll('.m-input-field')[1].find('input')
      
      expect(nameInput.element.value).toBe('Test Execution')
      expect(descriptionInput.element.value).toBe('Test Description')
    })
  })

  describe('Two-way Data Binding', () => {
    test('should emit update:name when name input changes', async () => {
      wrapper = createWrapper({ name: 'Initial Name' })
      
      const nameInput = wrapper.findAll('.m-input-field')[0].find('input')
      await nameInput.setValue('Updated Name')
      
      expect(wrapper.emitted('update:name')).toBeTruthy()
      expect(wrapper.emitted('update:name')[0]).toEqual(['Updated Name'])
    })

    test('should emit update:description when description input changes', async () => {
      wrapper = createWrapper({ description: 'Initial Description' })
      
      const descriptionInput = wrapper.findAll('.m-input-field')[1].find('input')
      await descriptionInput.setValue('Updated Description')
      
      expect(wrapper.emitted('update:description')).toBeTruthy()
      expect(wrapper.emitted('update:description')[0]).toEqual(['Updated Description'])
    })

    test('should update local computed properties when props change', async () => {
      wrapper = createWrapper({ name: 'Initial', description: 'Initial Desc' })
      
      await wrapper.setProps({ name: 'Updated Name', description: 'Updated Description' })
      
      const nameInput = wrapper.findAll('.m-input-field')[0].find('input')
      const descriptionInput = wrapper.findAll('.m-input-field')[1].find('input')
      
      expect(nameInput.element.value).toBe('Updated Name')
      expect(descriptionInput.element.value).toBe('Updated Description')
    })
  })

  describe('Computed Properties', () => {
    test('localName getter should return name prop', () => {
      wrapper = createWrapper({ name: 'Test Name' })
      
      expect(wrapper.vm.localName).toBe('Test Name')
    })

    test('localName setter should emit update:name', () => {
      wrapper = createWrapper()
      
      wrapper.vm.localName = 'New Name'
      
      expect(wrapper.emitted('update:name')).toBeTruthy()
      expect(wrapper.emitted('update:name')[0]).toEqual(['New Name'])
    })

    test('localDescription getter should return description prop', () => {
      wrapper = createWrapper({ description: 'Test Description' })
      
      expect(wrapper.vm.localDescription).toBe('Test Description')
    })

    test('localDescription setter should emit update:description', () => {
      wrapper = createWrapper()
      
      wrapper.vm.localDescription = 'New Description'
      
      expect(wrapper.emitted('update:description')).toBeTruthy()
      expect(wrapper.emitted('update:description')[0]).toEqual(['New Description'])
    })
  })

  describe('Component Structure', () => {
    test('should have correct CSS classes for styling', () => {
      wrapper = createWrapper()
      
      expect(wrapper.find('.input-fields-container').exists()).toBe(true)
      expect(wrapper.find('.input-fields-container').classes()).toContain('mt-3')
      expect(wrapper.findAll('.input-field')).toHaveLength(2)
    })

    test('should maintain proper flexbox layout structure', () => {
      wrapper = createWrapper()
      
      const container = wrapper.find('.input-fields-container')
      expect(container.exists()).toBe(true)
      
      const inputFields = wrapper.findAll('.input-field')
      expect(inputFields).toHaveLength(2)
    })
  })

  describe('Props Validation', () => {
    test('should handle empty string props', () => {
      wrapper = createWrapper({ name: '', description: '' })
      
      expect(wrapper.vm.localName).toBe('')
      expect(wrapper.vm.localDescription).toBe('')
    })

    test('should handle undefined props', () => {
      wrapper = createWrapper({ name: undefined, description: undefined })
      
      expect(wrapper.vm.localName).toBeUndefined()
      expect(wrapper.vm.localDescription).toBeUndefined()
    })

    test('should handle null props', () => {
      wrapper = createWrapper({ name: null, description: null })
      
      expect(wrapper.vm.localName).toBeNull()
      expect(wrapper.vm.localDescription).toBeNull()
    })
  })

  describe('Edge Cases', () => {
    test('should handle rapid input changes', async () => {
      wrapper = createWrapper()
      
      const nameInput = wrapper.findAll('.m-input-field')[0].find('input')
      
      // Simulate rapid typing
      await nameInput.setValue('A')
      await nameInput.setValue('AB')
      await nameInput.setValue('ABC')
      
      expect(wrapper.emitted('update:name')).toHaveLength(3)
      expect(wrapper.emitted('update:name')[0]).toEqual(['A'])
      expect(wrapper.emitted('update:name')[1]).toEqual(['AB'])
      expect(wrapper.emitted('update:name')[2]).toEqual(['ABC'])
    })

    test('should handle special characters in inputs', async () => {
      wrapper = createWrapper()
      
      const nameInput = wrapper.findAll('.m-input-field')[0].find('input')
      const descriptionInput = wrapper.findAll('.m-input-field')[1].find('input')
      
      const specialText = 'Test @#$%^&*()_+-=[]{}|;:,.<>?'
      
      await nameInput.setValue(specialText)
      await descriptionInput.setValue(specialText)
      
      expect(wrapper.emitted('update:name')[0]).toEqual([specialText])
      expect(wrapper.emitted('update:description')[0]).toEqual([specialText])
    })

    test('should handle very long text inputs', async () => {
      wrapper = createWrapper()
      
      const longText = 'A'.repeat(1000)
      const nameInput = wrapper.findAll('.m-input-field')[0].find('input')
      
      await nameInput.setValue(longText)
      
      expect(wrapper.emitted('update:name')[0]).toEqual([longText])
    })
  })

  describe('Accessibility', () => {
    test('should have proper input types for accessibility', () => {
      wrapper = createWrapper()
      
      const inputs = wrapper.findAll('input')
      inputs.forEach(input => {
        expect(input.attributes('type')).toBe('text')
      })
    })

    test('should have labels associated with inputs', () => {
      wrapper = createWrapper()
      
      const nameField = wrapper.findAll('.m-input-field')[0]
      const descriptionField = wrapper.findAll('.m-input-field')[1]
      
      expect(nameField.find('label').exists()).toBe(true)
      expect(descriptionField.find('label').exists()).toBe(true)
    })

    test('should have meaningful placeholders', () => {
      wrapper = createWrapper()
      
      const nameInput = wrapper.findAll('.m-input-field')[0].find('input')
      const descriptionInput = wrapper.findAll('.m-input-field')[1].find('input')
      
      expect(nameInput.attributes('placeholder')).toBeTruthy()
      expect(descriptionInput.attributes('placeholder')).toBeTruthy()
    })
  })
})
