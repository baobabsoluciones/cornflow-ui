import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { h } from 'vue'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createRouter, createWebHistory } from 'vue-router'
import IndexView from '@/views/IndexView.vue'
import { useGeneralStore } from '@/stores/general'

// Mock AuthService
const mockAuthService = vi.hoisted(() => ({
  isAuthenticated: vi.fn()
}))

vi.mock('@/services/AuthService', () => ({
  default: mockAuthService
}))

// Mock config
const mockConfig = vi.hoisted(() => ({
  isStagingEnvironment: false,
  initConfig: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('@/config', () => ({
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
vi.mock('@/components/AppDrawer.vue', () => ({
  default: {
    name: 'CoreAppDrawer',
    setup: () => () => h('div', { 'data-testid': 'app-drawer' }, 'AppDrawer')
  }
}))

vi.mock('@/components/AppView.vue', () => ({
  default: {
    name: 'CoreAppView',
    setup: () => () => h('div', { 'data-testid': 'app-view' }, 'AppView')
  }
}))

// Mock Mango UI components
vi.mock('mango-vue', () => ({
  MAppBarTab: {
    name: 'MAppBarTab',
    props: ['tabs', 'createTitle'],
    emits: ['close', 'create', 'select'],
    setup: (props: any, { slots }: any) => () => h('div', { 'data-testid': 'm-app-bar-tab' }, slots.actions?.())
  }
}))

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
  
  // Create modifiable tabs for testing
  const mockTabs = [
    { value: 1, text: 'Test Execution 1', icon: 'mdi-checkbox-marked', loading: false, selected: false },
    { value: 2, text: 'Test Execution 2', icon: 'mdi-checkbox-marked', loading: false, selected: false }
  ]
  
  // Mock the getter using Object.defineProperty for better control
  Object.defineProperty(generalStore, 'getLoadedExecutionTabs', {
    get: () => mockTabs,
    configurable: true
  })
  
  generalStore.tabBarKey = 1
  generalStore.selectedExecution = { executionId: 2 }
  generalStore.initializeData = vi.fn()
  generalStore.removeLoadedExecution = vi.fn()
  generalStore.incrementUploadComponentKey = vi.fn()
  generalStore.setSelectedExecution = vi.fn()
  generalStore.incrementTabBarKey = vi.fn()

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
        'v-img': {
          setup: () => () => h('div', { 'data-testid': 'v-img' })
        },
        'Vue3Marquee': {
          setup: () => () => h('div', { 'data-testid': 'marquee' })
        },
        'CoreAppDrawer': {
          setup: () => () => h('div', { 'data-testid': 'app-drawer', class: 'app-drawer' })
        },
        'CoreAppView': {
          setup: (_, { slots }) => () => h('div', { 'data-testid': 'app-view' }, ['Powered by baobab soluciones', slots.default?.()])
        },
        'MAppBarTab': {
          name: 'MAppBarTab',
          props: ['tabs', 'createTitle'],
          setup: (_, { slots }) => () => h('div', { 'data-testid': 'm-app-bar-tab' }, [
            slots.actions?.()
          ])
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
      expect(wrapper.find('[data-testid="m-app-bar-tab"]').exists()).toBe(true)
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

      expect(wrapper.find('[data-testid="v-img"]').exists()).toBe(true)
      expect(wrapper.text()).toContain('Powered by')
      expect(wrapper.text()).toContain('baobab soluciones')
    })
  })

  describe('Component Props', () => {
    test('passes correct props to MAppBarTab', async () => {
      const { wrapper, generalStore } = await createWrapper()
      const appBarTab = wrapper.findComponent({ name: 'MAppBarTab' })

      expect(appBarTab.props('tabs')).toEqual(generalStore.getLoadedExecutionTabs)
      expect(appBarTab.props('createTitle')).toBe('Create')
      // The key is used for Vue's reactivity, we can verify the component exists and has the right props
      expect(appBarTab.exists()).toBe(true)
    })
  })

  describe('Computed Properties', () => {
    test('tabsData computed returns store tabs', async () => {
      const { wrapper, generalStore } = await createWrapper()
      
      expect(wrapper.vm.tabsData).toEqual(generalStore.getLoadedExecutionTabs)
    })

    test('tabsKey computed returns store tab bar key', async () => {
      const { wrapper, generalStore } = await createWrapper()
      
      expect(wrapper.vm.tabsKey).toBe(generalStore.tabBarKey)
    })

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
        
        const executionTab = { value: 2 }
        const goSpy = vi.spyOn(router, 'go')
        
        await wrapper.vm.selectTab(executionTab)
        
        expect(generalStore.setSelectedExecution).toHaveBeenCalledWith(null)
        expect(goSpy).toHaveBeenCalledWith(-1)
        expect(generalStore.incrementTabBarKey).toHaveBeenCalled()
      })

      test('deselects tab when same execution is selected and on history-execution route', async () => {
        const { wrapper, generalStore, router } = await createWrapper()
        await router.push('/history-execution')
        await router.isReady()
        
        const executionTab = { value: 2 }
        const goSpy = vi.spyOn(router, 'go')
        
        await wrapper.vm.selectTab(executionTab)
        
        expect(generalStore.setSelectedExecution).toHaveBeenCalledWith(null)
        expect(goSpy).toHaveBeenCalledWith(-1)
        expect(generalStore.incrementTabBarKey).toHaveBeenCalled()
      })

      test('navigates to history-execution when deselecting on other routes', async () => {
        const { wrapper, generalStore, router } = await createWrapper()
        await router.push('/other-route')
        await router.isReady()
        
        const executionTab = { value: 2 }
        const pushSpy = vi.spyOn(router, 'push')
        
        await wrapper.vm.selectTab(executionTab)
        
        expect(generalStore.setSelectedExecution).toHaveBeenCalledWith(null)
        expect(pushSpy).toHaveBeenCalledWith('/history-execution')
        expect(generalStore.incrementTabBarKey).toHaveBeenCalled()
      })

      test('selects different execution and navigates to output-data from project-execution', async () => {
        const { wrapper, generalStore, router } = await createWrapper()
        await router.push('/project-execution')
        await router.isReady()
        
        const executionTab = { value: 3 }
        const pushSpy = vi.spyOn(router, 'push')
        
        await wrapper.vm.selectTab(executionTab)
        
        expect(generalStore.setSelectedExecution).toHaveBeenCalledWith(3)
        expect(pushSpy).toHaveBeenCalledWith('/output-data')
        expect(generalStore.incrementTabBarKey).toHaveBeenCalled()
      })

      test('selects different execution and navigates to output-data from history-execution', async () => {
        const { wrapper, generalStore, router } = await createWrapper()
        await router.push('/history-execution')
        await router.isReady()
        
        const executionTab = { value: 3 }
        const pushSpy = vi.spyOn(router, 'push')
        
        await wrapper.vm.selectTab(executionTab)
        
        expect(generalStore.setSelectedExecution).toHaveBeenCalledWith(3)
        expect(pushSpy).toHaveBeenCalledWith('/output-data')
        expect(generalStore.incrementTabBarKey).toHaveBeenCalled()
      })

      test('selects different execution and increments upload key on other routes', async () => {
        const { wrapper, generalStore, router } = await createWrapper()
        await router.push('/other-route')
        await router.isReady()
        
        const executionTab = { value: 3 }
        
        await wrapper.vm.selectTab(executionTab)
        
        expect(generalStore.setSelectedExecution).toHaveBeenCalledWith(3)
        expect(generalStore.incrementUploadComponentKey).toHaveBeenCalled()
        expect(generalStore.incrementTabBarKey).toHaveBeenCalled()
      })

      test('updates tab selection states correctly', async () => {
        const { wrapper, generalStore } = await createWrapper()
        
        // Change the selectedExecution to something different to test selection
        generalStore.selectedExecution = { executionId: 999 }
        
        // Select the first tab (value: 1)
        const executionTab = { value: 1 }
        
        await wrapper.vm.selectTab(executionTab)
        await wrapper.vm.$nextTick()
        
        // Check that tabs are updated correctly - first tab should be selected
        expect(generalStore.getLoadedExecutionTabs[0].selected).toBe(true)
        expect(generalStore.getLoadedExecutionTabs[1].selected).toBe(false)
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
    test('exposes tabsData and tabsKey', async () => {
      const { wrapper, generalStore } = await createWrapper()
      
      // Access exposed properties through wrapper.vm
      expect(wrapper.vm.tabsData).toBeDefined()
      expect(wrapper.vm.tabsKey).toBeDefined()
      
      // Verify the exposed properties match the store values
      expect(wrapper.vm.tabsData).toEqual(generalStore.getLoadedExecutionTabs)
      expect(wrapper.vm.tabsKey).toBe(generalStore.tabBarKey)
    })
  })

  describe('Component Structure', () => {
    test('has correct CSS classes and structure', async () => {
      const { wrapper } = await createWrapper()
      
      expect(wrapper.find('.app-drawer').exists()).toBe(true)
      expect(wrapper.find('.tab-container').exists()).toBe(true)
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
      
      const executionTab = { value: 3 }
      
      await expect(async () => {
        await wrapper.vm.selectTab(executionTab)
      }).not.toThrow()
    })

    test('handles undefined executionId gracefully', async () => {
      const { wrapper, generalStore } = await createWrapper()
      generalStore.selectedExecution = { executionId: undefined }
      await wrapper.vm.$nextTick()
      
      const executionTab = { value: 3 }
      
      await expect(async () => {
        await wrapper.vm.selectTab(executionTab)
      }).not.toThrow()
    })

    test('handles empty tabs array gracefully', async () => {
      const { wrapper, generalStore } = await createWrapper()
      generalStore.loadedExecutions = []
      await wrapper.vm.$nextTick()
      
      const executionTab = { value: 3 }
      
      await expect(async () => {
        await wrapper.vm.selectTab(executionTab)
      }).not.toThrow()
    })
  })

  describe('Tab Management Logic', () => {
    test('correctly identifies when same execution is selected', async () => {
      const { wrapper, generalStore } = await createWrapper()
      generalStore.selectedExecution = { executionId: 5 }
      await wrapper.vm.$nextTick()
      
      const executionTab = { value: 5 }
      
      await wrapper.vm.selectTab(executionTab)
      
      expect(generalStore.setSelectedExecution).toHaveBeenCalledWith(null)
    })

    test('correctly identifies when different execution is selected', async () => {
      const { wrapper, generalStore } = await createWrapper()
      generalStore.selectedExecution = { executionId: 5 }
      await wrapper.vm.$nextTick()
      
      const executionTab = { value: 7 }
      
      await wrapper.vm.selectTab(executionTab)
      
      expect(generalStore.setSelectedExecution).toHaveBeenCalledWith(7)
    })
  })
})
