import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import CreateExecutionCreateOrSearch from '@/components/project-execution/CreateExecutionCreateOrSearch.vue'

// Mock i18n
const mockT = vi.fn((key) => {
  const translations = {
    'projectExecution.steps.step1.firstOption.title': 'Create New Execution',
    'projectExecution.steps.step1.firstOption.description': 'Create a new execution from scratch',
    'projectExecution.steps.step1.secondOption.title': 'Search Existing Execution',
    'projectExecution.steps.step1.secondOption.description': 'Find and use an existing execution'
  }
  return translations[key] || key
})

// Mock ExecutionOptionCard component
const ExecutionOptionCardStub = {
  name: 'ExecutionOptionCard',
  template: `
    <div class="execution-option-card" :data-option="option">
      <div class="option-title">{{ title }}</div>
      <div class="option-description">{{ description }}</div>
      <input 
        type="checkbox" 
        :checked="selected === option" 
        @change="handleChange"
        class="option-checkbox"
      />
    </div>
  `,
  props: ['value', 'title', 'description', 'icon', 'option', 'selected'],
  emits: ['checkbox-change'],
  methods: {
    handleChange(event) {
      this.$emit('checkbox-change', { 
        value: event.target.checked, 
        option: this.option 
      })
    }
  }
}

describe('CreateExecutionCreateOrSearch', () => {
  let vuetify: any
  let wrapper: any

  beforeEach(() => {
    vuetify = createVuetify()
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })

  const createWrapper = (props = {}) => {
    return mount(CreateExecutionCreateOrSearch, {
      props,
      global: {
        plugins: [vuetify],
        mocks: {
          $t: mockT
        },
        stubs: {
          ExecutionOptionCard: ExecutionOptionCardStub
        }
      }
    })
  }

  describe('Component Rendering', () => {
    test('renders both option cards correctly', () => {
      wrapper = createWrapper()
      
      const optionCards = wrapper.findAllComponents(ExecutionOptionCardStub)
      expect(optionCards).toHaveLength(2)
    })

    test('renders create execution option card with correct props', () => {
      wrapper = createWrapper({ optionSelected: null })
      
      const createCard = wrapper.findAll('[data-option="createExecution"]')[0]
      expect(createCard.exists()).toBe(true)
      expect(createCard.text()).toContain('Create New Execution')
      expect(createCard.text()).toContain('Create a new execution from scratch')
    })

    test('renders search execution option card with correct props', () => {
      wrapper = createWrapper({ optionSelected: null })
      
      const searchCard = wrapper.findAll('[data-option="searchExecution"]')[0]
      expect(searchCard.exists()).toBe(true)
      expect(searchCard.text()).toContain('Search Existing Execution')
      expect(searchCard.text()).toContain('Find and use an existing execution')
    })

    test('passes optionSelected prop to both cards', () => {
      wrapper = createWrapper({ optionSelected: 'createExecution' })
      
      const optionCards = wrapper.findAllComponents(ExecutionOptionCardStub)
      optionCards.forEach(card => {
        expect(card.props('selected')).toBe('createExecution')
        expect(card.props('value')).toBe('createExecution')
      })
    })
  })

  describe('Option Selection', () => {
    test('shows createExecution as selected when optionSelected is createExecution', () => {
      wrapper = createWrapper({ optionSelected: 'createExecution' })
      
      const createCheckbox = wrapper.find('[data-option="createExecution"] .option-checkbox')
      const searchCheckbox = wrapper.find('[data-option="searchExecution"] .option-checkbox')
      
      expect(createCheckbox.element.checked).toBe(true)
      expect(searchCheckbox.element.checked).toBe(false)
    })

    test('shows searchExecution as selected when optionSelected is searchExecution', () => {
      wrapper = createWrapper({ optionSelected: 'searchExecution' })
      
      const createCheckbox = wrapper.find('[data-option="createExecution"] .option-checkbox')
      const searchCheckbox = wrapper.find('[data-option="searchExecution"] .option-checkbox')
      
      expect(createCheckbox.element.checked).toBe(false)
      expect(searchCheckbox.element.checked).toBe(true)
    })

    test('shows no selection when optionSelected is null', () => {
      wrapper = createWrapper({ optionSelected: null })
      
      const createCheckbox = wrapper.find('[data-option="createExecution"] .option-checkbox')
      const searchCheckbox = wrapper.find('[data-option="searchExecution"] .option-checkbox')
      
      expect(createCheckbox.element.checked).toBe(false)
      expect(searchCheckbox.element.checked).toBe(false)
    })
  })

  describe('Event Handling', () => {
    test('emits update:optionSelected with correct option when create execution is selected', async () => {
      wrapper = createWrapper({ optionSelected: null })
      
      const createCard = wrapper.findComponent('[data-option="createExecution"]')
      await createCard.vm.$emit('checkbox-change', { value: true, option: 'createExecution' })
      
      expect(wrapper.emitted('update:optionSelected')).toBeTruthy()
      expect(wrapper.emitted('update:optionSelected')[0]).toEqual(['createExecution'])
    })

    test('emits update:optionSelected with correct option when search execution is selected', async () => {
      wrapper = createWrapper({ optionSelected: null })
      
      const searchCard = wrapper.findComponent('[data-option="searchExecution"]')
      await searchCard.vm.$emit('checkbox-change', { value: true, option: 'searchExecution' })
      
      expect(wrapper.emitted('update:optionSelected')).toBeTruthy()
      expect(wrapper.emitted('update:optionSelected')[0]).toEqual(['searchExecution'])
    })

    test('emits update:optionSelected with null when option is deselected', async () => {
      wrapper = createWrapper({ optionSelected: 'createExecution' })
      
      const createCard = wrapper.findComponent('[data-option="createExecution"]')
      await createCard.vm.$emit('checkbox-change', { value: false, option: 'createExecution' })
      
      expect(wrapper.emitted('update:optionSelected')).toBeTruthy()
      expect(wrapper.emitted('update:optionSelected')[0]).toEqual([null])
    })

    test('handles checkbox change correctly in component method', async () => {
      wrapper = createWrapper()
      
      // Test selecting an option
      await wrapper.vm.handleCheckboxChange({ value: true, option: 'createExecution' })
      expect(wrapper.emitted('update:optionSelected')).toBeTruthy()
      expect(wrapper.emitted('update:optionSelected')[0]).toEqual(['createExecution'])
      
      // Test deselecting an option
      await wrapper.vm.handleCheckboxChange({ value: false, option: 'createExecution' })
      expect(wrapper.emitted('update:optionSelected')).toHaveLength(2)
      expect(wrapper.emitted('update:optionSelected')[1]).toEqual([null])
    })
  })

  describe('Props Validation', () => {
    test('accepts string for optionSelected prop', () => {
      wrapper = createWrapper({ optionSelected: 'createExecution' })
      
      expect(wrapper.props('optionSelected')).toBe('createExecution')
    })

    test('accepts null for optionSelected prop', () => {
      wrapper = createWrapper({ optionSelected: null })
      
      expect(wrapper.props('optionSelected')).toBe(null)
    })
  })

  describe('Internationalization', () => {
    test('uses correct translation keys for create option', () => {
      wrapper = createWrapper()
      
      expect(mockT).toHaveBeenCalledWith('projectExecution.steps.step1.firstOption.title')
      expect(mockT).toHaveBeenCalledWith('projectExecution.steps.step1.firstOption.description')
    })

    test('uses correct translation keys for search option', () => {
      wrapper = createWrapper()
      
      expect(mockT).toHaveBeenCalledWith('projectExecution.steps.step1.secondOption.title')
      expect(mockT).toHaveBeenCalledWith('projectExecution.steps.step1.secondOption.description')
    })
  })

  describe('Component Structure', () => {
    test('has correct component hierarchy', () => {
      wrapper = createWrapper()
      
      expect(wrapper.find('div').exists()).toBe(true)
      expect(wrapper.findAllComponents(ExecutionOptionCardStub)).toHaveLength(2)
    })

    test('passes icon prop only to search option card', () => {
      wrapper = createWrapper()
      
      const cards = wrapper.findAllComponents(ExecutionOptionCardStub)
      const createCard = cards.find(card => card.props('option') === 'createExecution')
      const searchCard = cards.find(card => card.props('option') === 'searchExecution')
      
      expect(createCard.props('icon')).toBeUndefined()
      expect(searchCard.props('icon')).toBe('mdi-crosshairs')
    })
  })
})
