import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import { createRouter, createWebHistory } from 'vue-router'
import ExecutionInfoCard from '@/components/project-execution/ExecutionInfoCard.vue'

// Mock vue-i18n
const mockT = vi.fn((key) => {
  const translations = {
    'projectExecution.infoCard.noExecutionSelected': 'No Execution Selected',
    'projectExecution.infoCard.loadExecutionMessage': 'Please select an execution to view details',
    'projectExecution.infoCard.executionCreated': 'Execution Created Successfully',
    'projectExecution.infoCard.solutionWillLoadMessage': 'Solution will be loaded automatically',
    'projectExecution.infoCard.noSolutionFoundTitle': 'No Solution Found',
    'projectExecution.infoCard.noSolutionMessage': 'The execution completed but no solution was found',
    'projectExecution.infoCard.createNewExecution': 'Create New Execution',
    'projectExecution.infoCard.loadFromHistory': 'Load from History'
  }
  return translations[key] || key
})

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: mockT
  })
}))

// Mock Pinia store
const mockGeneralStore = {
  incrementUploadComponentKey: vi.fn()
}

vi.mock('@/stores/general', () => ({
  useGeneralStore: vi.fn(() => mockGeneralStore)
}))

// Mock MInfoCard component
const MInfoCardStub = {
  name: 'MInfoCard',
  template: `
    <div class="m-info-card" :data-testid="'info-card-' + title.replace(/ /g, '-').toLowerCase()">
      <div class="info-card-title">{{ title }}</div>
      <div class="info-card-description">{{ description }}</div>
      <div class="info-card-icon" :data-icon="icon" :data-color="iconColor"></div>
      <div class="info-card-content">
        <slot name="content"></slot>
      </div>
    </div>
  `,
  props: ['title', 'description', 'icon', 'iconColor']
}

describe('ExecutionInfoCard', () => {
  let vuetify: any
  let router: any
  let wrapper: any

  beforeEach(() => {
    vuetify = createVuetify()
    router = createRouter({
      history: createWebHistory(),
      routes: [
        { path: '/project-execution', component: { template: '<div>Project Execution</div>' } },
        { path: '/history-execution', component: { template: '<div>History Execution</div>' } }
      ]
    })
    
    vi.clearAllMocks()
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })

  const createWrapper = (props = {}) => {
    return mount(ExecutionInfoCard, {
      props,
      global: {
        plugins: [vuetify, router],
        mocks: {
          $t: mockT
        },
        stubs: {
          MInfoCard: MInfoCardStub,
          VBtn: {
            template: '<button class="v-btn" @click="$emit(\'click\')" :data-variant="variant" :data-icon="prependIcon"><slot /></button>',
            props: ['variant', 'prepend-icon', 'prependIcon'],
            emits: ['click']
          }
        }
      }
    })
  }

  // Helper function to create mock execution
  const createMockExecution = (overrides = {}) => ({
    id: 'test-execution',
    name: 'Test Execution',
    state: 1,
    hasSolution: vi.fn().mockReturnValue(true),
    ...overrides
  })

  describe('Component Rendering - No Execution', () => {
    test('renders when no execution is selected', () => {
      wrapper = createWrapper({ selectedExecution: null })
      
      expect(wrapper.findComponent(MInfoCardStub).exists()).toBe(true)
    })

    test('displays correct title when no execution selected', () => {
      wrapper = createWrapper({ selectedExecution: null })
      
      expect(wrapper.text()).toContain('No Execution Selected')
    })

    test('displays correct description when no execution selected', () => {
      wrapper = createWrapper({ selectedExecution: null })
      
      expect(wrapper.text()).toContain('Please select an execution to view details')
    })

    test('displays warning icon when no execution selected', () => {
      wrapper = createWrapper({ selectedExecution: null })
      
      const icon = wrapper.find('.info-card-icon')
      expect(icon.attributes('data-icon')).toBe('mdi-alert-circle')
      expect(icon.attributes('data-color')).toBe('var(--warning)')
    })

    test('shows navigation buttons when no execution selected', () => {
      wrapper = createWrapper({ selectedExecution: null })
      
      const buttons = wrapper.findAll('.v-btn')
      expect(buttons).toHaveLength(2)
      expect(buttons[0].text()).toContain('Create New Execution')
      expect(buttons[1].text()).toContain('Load from History')
    })
  })

  describe('Component Rendering - With Execution States', () => {
    test('renders when execution has state 0', () => {
      const execution = createMockExecution({ state: 0 })
      wrapper = createWrapper({ selectedExecution: execution })
      
      expect(wrapper.findComponent(MInfoCardStub).exists()).toBe(true)
    })

    test('renders when execution has state -7', () => {
      const execution = createMockExecution({ state: -7 })
      wrapper = createWrapper({ selectedExecution: execution })
      
      expect(wrapper.findComponent(MInfoCardStub).exists()).toBe(true)
    })

    test('does not render when execution has state 1', () => {
      const execution = createMockExecution({ state: 1 })
      wrapper = createWrapper({ selectedExecution: execution })
      
      expect(wrapper.findComponent(MInfoCardStub).exists()).toBe(false)
    })

    test('renders for solution type when execution has no solution', () => {
      const execution = createMockExecution({ 
        state: 1,
        hasSolution: vi.fn().mockReturnValue(false)
      })
      wrapper = createWrapper({ 
        selectedExecution: execution, 
        type: 'solution' 
      })
      
      expect(wrapper.findComponent(MInfoCardStub).exists()).toBe(true)
    })

    test('does not render for solution type when execution has solution', () => {
      const execution = createMockExecution({ 
        state: 1,
        hasSolution: vi.fn().mockReturnValue(true)
      })
      wrapper = createWrapper({ 
        selectedExecution: execution, 
        type: 'solution' 
      })
      
      expect(wrapper.findComponent(MInfoCardStub).exists()).toBe(false)
    })
  })

  describe('Computed Properties - Success State', () => {
    test('displays success title and description for successful execution', () => {
      const execution = createMockExecution({ state: 0 })
      wrapper = createWrapper({ selectedExecution: execution })
      
      expect(wrapper.text()).toContain('Execution Created Successfully')
      expect(wrapper.text()).toContain('Solution will be loaded automatically')
    })

    test('displays success icon and color for successful execution', () => {
      const execution = createMockExecution({ state: 0 })
      wrapper = createWrapper({ selectedExecution: execution })
      
      const icon = wrapper.find('.info-card-icon')
      expect(icon.attributes('data-icon')).toBe('mdi-check-circle')
      expect(icon.attributes('data-color')).toBe('var(--success)')
    })
  })

  describe('Computed Properties - No Solution State', () => {
    test('displays no solution title and description for solution type without solution', () => {
      const execution = createMockExecution({ 
        state: 1,
        hasSolution: vi.fn().mockReturnValue(false)
      })
      wrapper = createWrapper({ 
        selectedExecution: execution, 
        type: 'solution' 
      })
      
      expect(wrapper.text()).toContain('No Solution Found')
      expect(wrapper.text()).toContain('The execution completed but no solution was found')
    })

    test('displays warning icon and color for solution type without solution', () => {
      const execution = createMockExecution({ 
        state: 1,
        hasSolution: vi.fn().mockReturnValue(false)
      })
      wrapper = createWrapper({ 
        selectedExecution: execution, 
        type: 'solution' 
      })
      
      const icon = wrapper.find('.info-card-icon')
      expect(icon.attributes('data-icon')).toBe('mdi-alert-circle')
      expect(icon.attributes('data-color')).toBe('var(--warning)')
    })
  })

  describe('Navigation Functionality', () => {
    test('navigates to project execution page when create button clicked', async () => {
      const routerPushSpy = vi.spyOn(router, 'push')
      wrapper = createWrapper({ selectedExecution: null })
      
      const createButton = wrapper.findAll('.v-btn')[0]
      await createButton.trigger('click')
      
      expect(routerPushSpy).toHaveBeenCalledWith({ path: '/project-execution' })
      expect(mockGeneralStore.incrementUploadComponentKey).toHaveBeenCalled()
    })

    test('navigates to history execution page when load button clicked', async () => {
      const routerPushSpy = vi.spyOn(router, 'push')
      wrapper = createWrapper({ selectedExecution: null })
      
      const loadButton = wrapper.findAll('.v-btn')[1]
      await loadButton.trigger('click')
      
      expect(routerPushSpy).toHaveBeenCalledWith('/history-execution')
      expect(mockGeneralStore.incrementUploadComponentKey).not.toHaveBeenCalled()
    })

    test('navigateTo method handles project execution path correctly', () => {
      const routerPushSpy = vi.spyOn(router, 'push')
      wrapper = createWrapper({ selectedExecution: null })
      
      wrapper.vm.navigateTo('/project-execution')
      
      expect(routerPushSpy).toHaveBeenCalledWith({ path: '/project-execution' })
      expect(mockGeneralStore.incrementUploadComponentKey).toHaveBeenCalled()
    })

    test('navigateTo method handles other paths correctly', () => {
      const routerPushSpy = vi.spyOn(router, 'push')
      wrapper = createWrapper({ selectedExecution: null })
      
      wrapper.vm.navigateTo('/other-path')
      
      expect(routerPushSpy).toHaveBeenCalledWith('/other-path')
      expect(mockGeneralStore.incrementUploadComponentKey).not.toHaveBeenCalled()
    })
  })

  describe('Props Validation', () => {
    test('accepts valid selectedExecution object', () => {
      const execution = createMockExecution()
      wrapper = createWrapper({ selectedExecution: execution })
      
      expect(wrapper.props('selectedExecution')).toEqual(execution)
    })

    test('accepts null selectedExecution', () => {
      wrapper = createWrapper({ selectedExecution: null })
      
      expect(wrapper.props('selectedExecution')).toBe(null)
    })

    test('accepts valid type prop', () => {
      wrapper = createWrapper({ type: 'solution' })
      
      expect(wrapper.props('type')).toBe('solution')
    })

    test('uses default type when not provided', () => {
      wrapper = createWrapper()
      
      expect(wrapper.props('type')).toBe('instance')
    })
  })

  describe('Icon Logic', () => {
    test('returns check circle icon for execution with solution', () => {
      const execution = createMockExecution({ 
        state: 0,
        hasSolution: vi.fn().mockReturnValue(true)
      })
      wrapper = createWrapper({ selectedExecution: execution })
      
      expect(wrapper.vm.iconInfoCard).toBe('mdi-check-circle')
    })

    test('returns alert circle icon for execution without solution (solution type)', () => {
      const execution = createMockExecution({ 
        state: 0,
        hasSolution: vi.fn().mockReturnValue(false)
      })
      wrapper = createWrapper({ 
        selectedExecution: execution, 
        type: 'solution' 
      })
      
      expect(wrapper.vm.iconInfoCard).toBe('mdi-alert-circle')
    })

    test('returns alert circle icon when no execution', () => {
      wrapper = createWrapper({ selectedExecution: null })
      
      expect(wrapper.vm.iconInfoCard).toBe('mdi-alert-circle')
    })
  })

  describe('Icon Color Logic', () => {
    test('returns success color for execution with solution', () => {
      const execution = createMockExecution({ 
        state: 0,
        hasSolution: vi.fn().mockReturnValue(true)
      })
      wrapper = createWrapper({ selectedExecution: execution })
      
      expect(wrapper.vm.iconColorInfoCard).toBe('var(--success)')
    })

    test('returns warning color for execution without solution (solution type)', () => {
      const execution = createMockExecution({ 
        state: 0,
        hasSolution: vi.fn().mockReturnValue(false)
      })
      wrapper = createWrapper({ 
        selectedExecution: execution, 
        type: 'solution' 
      })
      
      expect(wrapper.vm.iconColorInfoCard).toBe('var(--warning)')
    })

    test('returns warning color when no execution', () => {
      wrapper = createWrapper({ selectedExecution: null })
      
      expect(wrapper.vm.iconColorInfoCard).toBe('var(--warning)')
    })
  })

  describe('Title Logic', () => {
    test('returns correct title for no execution', () => {
      wrapper = createWrapper({ selectedExecution: null })
      
      expect(wrapper.vm.titleInfoCard).toBe('No Execution Selected')
    })

    test('returns correct title for execution with solution', () => {
      const execution = createMockExecution({ 
        state: 0,
        hasSolution: vi.fn().mockReturnValue(true)
      })
      wrapper = createWrapper({ selectedExecution: execution })
      
      expect(wrapper.vm.titleInfoCard).toBe('Execution Created Successfully')
    })

    test('returns correct title for execution without solution (solution type)', () => {
      const execution = createMockExecution({ 
        state: 0,
        hasSolution: vi.fn().mockReturnValue(false)
      })
      wrapper = createWrapper({ 
        selectedExecution: execution, 
        type: 'solution' 
      })
      
      expect(wrapper.vm.titleInfoCard).toBe('No Solution Found')
    })
  })

  describe('Description Logic', () => {
    test('returns correct description for no execution', () => {
      wrapper = createWrapper({ selectedExecution: null })
      
      expect(wrapper.vm.descriptionInfoCard).toBe('Please select an execution to view details')
    })

    test('returns correct description for execution with solution', () => {
      const execution = createMockExecution({ 
        state: 0,
        hasSolution: vi.fn().mockReturnValue(true)
      })
      wrapper = createWrapper({ selectedExecution: execution })
      
      expect(wrapper.vm.descriptionInfoCard).toBe('Solution will be loaded automatically')
    })

    test('returns correct description for execution without solution (solution type)', () => {
      const execution = createMockExecution({ 
        state: 0,
        hasSolution: vi.fn().mockReturnValue(false)
      })
      wrapper = createWrapper({ 
        selectedExecution: execution, 
        type: 'solution' 
      })
      
      expect(wrapper.vm.descriptionInfoCard).toBe('The execution completed but no solution was found')
    })
  })

  describe('Component Structure', () => {
    test('has correct CSS classes', () => {
      wrapper = createWrapper({ selectedExecution: null })
      
      const infoCard = wrapper.findComponent(MInfoCardStub)
      expect(infoCard.classes()).toContain('mt-5')
      expect(infoCard.classes()).toContain('info-card')
    })

    test('button container has correct structure when no execution', () => {
      wrapper = createWrapper({ selectedExecution: null })
      
      expect(wrapper.find('.button-container').exists()).toBe(true)
      expect(wrapper.findAll('.v-btn')).toHaveLength(2)
    })

    test('buttons have correct icons and variants', () => {
      wrapper = createWrapper({ selectedExecution: null })
      
      const buttons = wrapper.findAll('.v-btn')
      expect(buttons[0].attributes('data-variant')).toBe('outlined')
      expect(buttons[0].attributes('data-icon')).toBe('mdi-chart-timeline-variant')
      expect(buttons[1].attributes('data-variant')).toBe('outlined')
      expect(buttons[1].attributes('data-icon')).toBe('mdi-history')
    })
  })

  describe('Internationalization', () => {
    test('uses correct translation keys', () => {
      wrapper = createWrapper({ selectedExecution: null })
      
      expect(mockT).toHaveBeenCalledWith('projectExecution.infoCard.noExecutionSelected')
      expect(mockT).toHaveBeenCalledWith('projectExecution.infoCard.loadExecutionMessage')
      expect(mockT).toHaveBeenCalledWith('projectExecution.infoCard.createNewExecution')
      expect(mockT).toHaveBeenCalledWith('projectExecution.infoCard.loadFromHistory')
    })

    test('uses solution-specific translation keys', () => {
      const execution = createMockExecution({ 
        state: 0,
        hasSolution: vi.fn().mockReturnValue(false)
      })
      wrapper = createWrapper({ 
        selectedExecution: execution, 
        type: 'solution' 
      })
      
      expect(mockT).toHaveBeenCalledWith('projectExecution.infoCard.noSolutionFoundTitle')
      expect(mockT).toHaveBeenCalledWith('projectExecution.infoCard.noSolutionMessage')
    })
  })

  describe('Edge Cases', () => {
    test('handles execution without hasSolution method gracefully', () => {
      const execution = { state: 0, id: 'test' } // No hasSolution method
      
      // Create wrapper with type 'instance' to avoid hasSolution being called
      wrapper = createWrapper({ 
        selectedExecution: execution, 
        type: 'instance' 
      })
      
      // Should render successfully without crashing
      expect(wrapper.vm.iconInfoCard).toBe('mdi-check-circle')
      expect(wrapper.vm.titleInfoCard).toBe('Execution Created Successfully')
    })

    test('handles execution with valid hasSolution method', () => {
      const execution = createMockExecution({ 
        state: 0,
        hasSolution: vi.fn().mockReturnValue(true)
      })
      
      wrapper = createWrapper({ 
        selectedExecution: execution, 
        type: 'solution' 
      })
      
      // Should use the hasSolution result correctly
      expect(execution.hasSolution).toHaveBeenCalled()
      expect(wrapper.vm.iconInfoCard).toBe('mdi-check-circle')
    })
  })
})
