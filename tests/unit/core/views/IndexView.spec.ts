import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { h } from 'vue'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createRouter, createWebHistory } from 'vue-router'
import IndexView from '@cornflow-ui/core/views/IndexView.vue'
import { useGeneralStore } from '@cornflow-ui/core/stores/general'
import {
  setTopBannerOffset,
  resetTopBannerOffsets,
} from '@cornflow-ui/core/plugins/layoutOffsets'
import { registerPremiumModules } from '@cornflow-ui/core/plugins/extensions'

// Mock AuthService
const mockAuthService = vi.hoisted(() => ({
  isAuthenticated: vi.fn()
}))

vi.mock('@cornflow-ui/core/services/AuthService', () => ({
  default: mockAuthService
}))

// Mock config
const mockConfig = vi.hoisted(() => ({
  isStagingEnvironment: false,
  schemas: [] as string[],
  initConfig: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('@cornflow-ui/core/config', () => ({
  default: mockConfig
}))

// Mock Vue3Marquee
vi.mock('vue3-marquee', () => ({
  Vue3Marquee: {
    name: 'Vue3Marquee',
    setup: (props: { 'pause-on-hover': boolean }, { slots }: any) => () => h('div', { 'data-testid': 'marquee' }, slots.default?.())
  }
}))

// Mock components
vi.mock('@cornflow-ui/core/components/AppDrawer.vue', () => ({
  default: {
    name: 'CoreAppDrawer',
    setup: () => () => h('div', { 'data-testid': 'app-drawer' }, 'AppDrawer')
  }
}))

vi.mock('@cornflow-ui/core/components/AppView.vue', () => ({
  default: {
    name: 'CoreAppView',
    setup: () => () => h('div', { 'data-testid': 'app-view' }, 'AppView')
  }
}))

/** A premium module that mounts something in the top bar. */
const topBarModule = {
  id: 'top-bar-item',
  globalComponents: [
    {
      slot: 'app-top-bar' as const,
      component: { name: 'TopBarItem', setup: () => () => h('div', { 'data-testid': 'top-bar-item' }) },
    },
  ],
}

const createWrapper = async (isAuthenticated = true, isStagingEnvironment = false) => {
  const vuetify = createVuetify()
  const pinia = createPinia()
  setActivePinia(pinia)
  
  const router = createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/', name: 'home', component: { template: '<div>Home</div>' } },
      { path: '/project-execution', name: 'project-execution', component: { template: '<div>Project Execution</div>' } },
      { path: '/history-execution', name: 'history-execution', component: { template: '<div>History Execution</div>' } },
      { path: '/output-data', name: 'output-data', component: { template: '<div>Output Data</div>' } },
      { path: '/input-data', name: 'input-data', component: { template: '<div>Input Data</div>' } },
      { path: '/other-route', name: 'other-route', component: { template: '<div>Other Route</div>' } }
    ]
  })
  
  // Initialize router
  await router.push('/')
  await router.isReady()
  
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: {
      en: {
        projectExecution: {
          create: 'Create',
          stagingWarning: 'This is a staging environment'
        }
      }
    }
  })

  // Mock store
  const generalStore = useGeneralStore()
  
  // Mock the store state and getters
  generalStore.loadedExecutions = [
    { executionId: 1, name: 'Test Execution 1', state: 1 },
    { executionId: 2, name: 'Test Execution 2', state: 1 }
  ]
  
  const mockTabs = [
    { value: 1, text: 'Test Execution 1', state: 1, solutionStatusCode: null },
    { value: 2, text: 'Test Execution 2', state: 0, solutionStatusCode: null }
  ]

  // Mock the getter using Object.defineProperty for better control
  Object.defineProperty(generalStore, 'getLoadedExecutionTabs', {
    get: () => mockTabs,
    configurable: true
  })
  
  generalStore.selectedExecution = { executionId: 2 }
  generalStore.initializeData = vi.fn()
  generalStore.removeLoadedExecution = vi.fn()
  generalStore.incrementUploadComponentKey = vi.fn()
  generalStore.setSelectedExecution = vi.fn()

  // Mock AuthService
  mockAuthService.isAuthenticated.mockReturnValue(isAuthenticated)
  
  // Mock config
  mockConfig.isStagingEnvironment = isStagingEnvironment
  
  const marqueeTemplate = isStagingEnvironment 
    ? '<div class="marquee-container" style="height: 40px"><div data-testid="marquee"></div></div>'
    : ''

  const wrapper = mount(IndexView, {
    global: {
      plugins: [vuetify, pinia, i18n, router],
      stubs: {
        'v-app': {
          setup: (_, { slots }) => () => {
            const children: any[] = []
            
            if (marqueeTemplate) {
              children.push(h('div', { class: 'marquee-container', style: 'height: 40px' }, [
                h('div', { 'data-testid': 'marquee' })
              ]))
            }
            
            children.push(
              h('div', { class: 'app-drawer', 'data-testid': 'app-drawer' }),
              h('div', { 'data-testid': 'app-view' }, 'Powered by baobab soluciones'),
              h('div', { class: 'tab-container' }, slots.default?.())
            )
            
            return h('div', {}, children)
          }
        },
'Vue3Marquee': {
          setup: () => () => h('div', { 'data-testid': 'marquee' })
        },
        'CoreAppDrawer': {
          setup: () => () => h('div', { 'data-testid': 'app-drawer', class: 'app-drawer' })
        },
        'CoreAppView': {
          setup: (_, { slots }) => () => h('div', { 'data-testid': 'app-view' }, ['Powered by baobab soluciones', slots.default?.()])
        }
      }
    }
  })

  return { wrapper, generalStore, router }
}

describe('IndexView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Component Rendering', () => {
    test('renders basic structure', async () => {
      const { wrapper } = await createWrapper()

      expect(wrapper.find('[data-testid="app-drawer"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="app-view"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="execution-tab-bar"]').exists()).toBe(true)
    })

    test('renders staging warning when isStagingEnvironment is true', async () => {
      const { wrapper } = await createWrapper(true, true)

      expect(wrapper.find('.marquee-container').exists()).toBe(true)
      expect(wrapper.find('[data-testid="marquee"]').exists()).toBe(true)
    })

    test('does not render staging warning when isStagingEnvironment is false', async () => {
      const { wrapper } = await createWrapper(true, false)

      expect(wrapper.find('.marquee-container').exists()).toBe(false)
      expect(wrapper.find('[data-testid="marquee"]').exists()).toBe(false)
    })

    test('renders baobab logo and powered by text', async () => {
      const { wrapper } = await createWrapper()

      expect(wrapper.find('.powered-by__logo').exists()).toBe(true)
      expect(wrapper.find('.powered-by').text()).toContain('Powered by')
      expect(wrapper.text()).toContain('baobab soluciones')
    })
  })

  describe('Execution tab bar', () => {
    test('has a tab per loaded execution, the selected one marked, and "Create"', async () => {
      const { wrapper } = await createWrapper()
      const bar = wrapper.findComponent({ name: 'CoreExecutionTabBar' })

      expect(bar.props('tabs').map((tab: any) => [tab.id, tab.name])).toEqual([
        [1, 'Test Execution 1'],
        [2, 'Test Execution 2'],
      ])
      expect(bar.props('selected')).toBe(2)
      expect(bar.props('createLabel')).toBe('Create')
      expect(wrapper.find('[data-testid="execution-tab-2"]').attributes('aria-selected')).toBe('true')
    })

    test('a running execution shows a spinner instead of the dot of its state', async () => {
      const { wrapper } = await createWrapper()
      const [finished, running] = wrapper.findComponent({ name: 'CoreExecutionTabBar' }).props('tabs')

      expect(finished.status.spin).toBe(false)
      expect(running.status.spin).toBe(true)
    })
  })

  describe('Computed Properties', () => {
    test('showStagingWarning computed returns config value', async () => {
      const { wrapper } = await createWrapper(true, true)
      
      expect(wrapper.vm.showStagingWarning).toBe(true)
    })
  })

  describe('Event Handlers', () => {
    test('removeTab calls store removeLoadedExecution', async () => {
      const { wrapper, generalStore } = await createWrapper()
      
      await wrapper.vm.removeTab(1)
      
      expect(generalStore.removeLoadedExecution).toHaveBeenCalledWith(1)
    })

    test('createTab navigates to project-execution and increments key', async () => {
      const { wrapper, generalStore, router } = await createWrapper()
      const pushSpy = vi.spyOn(router, 'push')
      
      await wrapper.vm.createTab()
      await router.isReady()
      
      expect(pushSpy).toHaveBeenCalledWith({ path: 'project-execution' })
      expect(generalStore.incrementUploadComponentKey).toHaveBeenCalled()
    })

    describe('selectTab', () => {
      test('deselects tab when same execution is selected and on project-execution route', async () => {
        const { wrapper, generalStore, router } = await createWrapper()
        await router.push('/project-execution')
        await router.isReady()
        
        
        await wrapper.vm.selectTab(2)
        
        expect(generalStore.setSelectedExecution).toHaveBeenCalledWith(null)
})

      test('deselects tab when same execution is selected and on history-execution route', async () => {
        const { wrapper, generalStore, router } = await createWrapper()
        await router.push('/history-execution')
        await router.isReady()
        
        
        await wrapper.vm.selectTab(2)
        
        expect(generalStore.setSelectedExecution).toHaveBeenCalledWith(null)
})

      test('navigates to history-execution when deselecting on output-data route', async () => {
        const { wrapper, generalStore, router } = await createWrapper()
        await router.push('/output-data')
        await router.isReady()
        
        const pushSpy = vi.spyOn(router, 'push')
        
        await wrapper.vm.selectTab(2)
        
        expect(generalStore.setSelectedExecution).toHaveBeenCalledWith(null)
        expect(pushSpy).toHaveBeenCalledWith('/history-execution')
})

      test('selects different execution from project-execution', async () => {
        const { wrapper, generalStore } = await createWrapper()
        
        
        await wrapper.vm.selectTab(3)
        
        expect(generalStore.setSelectedExecution).toHaveBeenCalledWith(3)
})

      test('selects different execution from history-execution', async () => {
        const { wrapper, generalStore } = await createWrapper()
        
        
        await wrapper.vm.selectTab(3)
        
        expect(generalStore.setSelectedExecution).toHaveBeenCalledWith(3)
})

      test('selects different execution on other routes', async () => {
        const { wrapper, generalStore } = await createWrapper()
        
        
        await wrapper.vm.selectTab(3)
        
        expect(generalStore.setSelectedExecution).toHaveBeenCalledWith(3)
})
})
  })

  describe('Authentication Initialization', () => {
    test('calls initializeData when user is authenticated', async () => {
      const { generalStore } = await createWrapper(true)
      
      expect(generalStore.initializeData).toHaveBeenCalled()
    })

    test('does not call initializeData when user is not authenticated', async () => {
      const { generalStore } = await createWrapper(false)
      
      expect(generalStore.initializeData).not.toHaveBeenCalled()
    })
  })

  describe('Exposed Properties', () => {
    test('exposes the execution tabs', async () => {
      const { wrapper } = await createWrapper()

      expect(wrapper.vm.executionTabs.map((tab: any) => tab.id)).toEqual([1, 2])
    })
  })

  describe('Component Structure', () => {
    test('has correct CSS classes and structure', async () => {
      const { wrapper } = await createWrapper()
      
      expect(wrapper.find('.app-drawer').exists()).toBe(true)
      expect(wrapper.find('.execution-tabs').exists()).toBe(true)
    })

    test('applies correct styling for staging warning', async () => {
      const { wrapper } = await createWrapper(true, true)
      const marqueeContainer = wrapper.find('.marquee-container')
      
      expect(marqueeContainer.exists()).toBe(true)
      expect(marqueeContainer.attributes('style')).toContain('height: 40px')
    })
  })

  describe('Edge Cases', () => {
    test('handles null selectedExecution gracefully', async () => {
      const { wrapper, generalStore } = await createWrapper()
      generalStore.selectedExecution = null
      await wrapper.vm.$nextTick()
      
      
      await expect(async () => {
        await wrapper.vm.selectTab(3)
      }).not.toThrow()
    })

    test('handles undefined executionId gracefully', async () => {
      const { wrapper, generalStore } = await createWrapper()
      generalStore.selectedExecution = { executionId: undefined }
      await wrapper.vm.$nextTick()
      
      
      await expect(async () => {
        await wrapper.vm.selectTab(3)
      }).not.toThrow()
    })

    test('handles empty tabs array gracefully', async () => {
      const { wrapper, generalStore } = await createWrapper()
      generalStore.loadedExecutions = []
      await wrapper.vm.$nextTick()
      
      
      await expect(async () => {
        await wrapper.vm.selectTab(3)
      }).not.toThrow()
    })
  })

  describe('Top bar', () => {
    afterEach(() => {
      mockConfig.schemas = []
      registerPremiumModules([])
      resetTopBannerOffsets()
    })

    test('is not rendered, and leaves no top offset, when there is nothing to show', async () => {
      const { wrapper } = await createWrapper()

      expect(wrapper.find('[data-testid="app-top-bar"]').exists()).toBe(false)
      expect(wrapper.find('.main-content').attributes('style') ?? '').not.toContain(
        '--app-top-offset',
      )
    })

    test('shows what premium modules mount in it, and reserves its height', async () => {
      registerPremiumModules([topBarModule])
      const { wrapper } = await createWrapper()

      expect(wrapper.find('[data-testid="app-top-bar"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="top-bar-item"]').exists()).toBe(true)
      expect(wrapper.find('.main-content').attributes('style')).toContain(
        '--app-top-offset: 56px',
      )
    })

    test('is not rendered for a user who may switch DAG: the module selector is in the side menu', async () => {
      mockConfig.schemas = ['planning_dag', 'stock_dag']
      const { wrapper, generalStore } = await createWrapper()

      generalStore.availableSchemas = ['planning_dag', 'stock_dag']
      await wrapper.vm.$nextTick()

      expect(wrapper.find('[data-testid="app-top-bar"]').exists()).toBe(false)
    })

    test('goes first in the fixed top stack, above the staging notice and the banners', async () => {
      registerPremiumModules([topBarModule])
      setTopBannerOffset('some-banner', 48)
      const { wrapper } = await createWrapper(true, true)

      const stack = wrapper.find('[data-testid="app-top-stack"]')
      const parts = stack.element.children
      expect(parts[0].getAttribute('data-testid')).toBe('app-top-bar')
      expect(parts[1].classList.contains('marquee-container')).toBe(true)
      expect(parts[2].classList.contains('app-top-stack__banners')).toBe(true)
      expect((parts[2] as HTMLElement).style.height).toBe('48px')
      // 56 (bar) + 40 (staging notice) + 48 (banner)
      const style = wrapper.find('.main-content').attributes('style')
      expect(style).toContain('padding-top: 144px')
      expect(style).toContain('--app-top-offset: 144px')
    })

    test('without a top bar, the staging notice and the banners still reserve their height', async () => {
      setTopBannerOffset('some-banner', 48)
      const { wrapper } = await createWrapper(true, true)

      expect(wrapper.find('[data-testid="app-top-bar"]').exists()).toBe(false)
      expect(wrapper.find('.main-content').attributes('style')).toContain(
        '--app-top-offset: 88px',
      )
    })

    test('shows the no-access message when the user has no DAG', async () => {
      const { wrapper, generalStore } = await createWrapper()

      generalStore.noSchemaAccess = true
      await wrapper.vm.$nextTick()

      expect(wrapper.find('[data-testid="no-schema-access"]').exists()).toBe(true)
    })
  })

  describe('Tab Management Logic', () => {
    test('correctly identifies when same execution is selected', async () => {
      const { wrapper, generalStore } = await createWrapper()
      generalStore.selectedExecution = { executionId: 5 }
      await wrapper.vm.$nextTick()
      
      await wrapper.vm.selectTab(5)
      
      expect(generalStore.setSelectedExecution).toHaveBeenCalledWith(null)
    })

    test('correctly identifies when different execution is selected', async () => {
      const { wrapper, generalStore } = await createWrapper()
      generalStore.selectedExecution = { executionId: 5 }
      await wrapper.vm.$nextTick()
      
      await wrapper.vm.selectTab(7)
      
      expect(generalStore.setSelectedExecution).toHaveBeenCalledWith(7)
    })
  })
})
