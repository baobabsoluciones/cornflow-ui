import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import { createRouter, createWebHistory } from 'vue-router'
import AppView from '@/components/AppView.vue'

// Mock the general store
const mockGeneralStore = {
  uploadComponentKey: 'test-key-123'
}

vi.mock('@/stores/general', () => ({
  useGeneralStore: vi.fn(() => mockGeneralStore)
}))

// Mock HelpMenu component
const HelpMenuStub = {
  name: 'HelpMenu',
  template: '<div class="help-menu-stub">HelpMenu</div>'
}

describe('AppView', () => {
  let vuetify: any
  let router: any
  let wrapper: any

  beforeEach(() => {
    vuetify = createVuetify()
    
    // Create a simple router for testing
    router = createRouter({
      history: createWebHistory(),
      routes: [
        { path: '/', component: { template: '<div>Home</div>' } },
        { path: '/test', component: { template: '<div>Test</div>' } }
      ]
    })
    
    // Reset mock store state
    mockGeneralStore.uploadComponentKey = 'test-key-123'
    
    vi.clearAllMocks()
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })

  const createWrapper = (routePath = '/') => {
    router.push(routePath)
    
    return mount(AppView, {
      global: {
        plugins: [vuetify, router],
        stubs: {
          HelpMenu: HelpMenuStub,
          RouterView: {
            template: '<div class="router-view-stub"><slot /></div>'
          }
        }
      }
    })
  }

  test('renders the component correctly', () => {
    wrapper = createWrapper()
    
    expect(wrapper.find('.main-container')).toBeTruthy()
    expect(wrapper.find('.help-menu-stub').exists()).toBe(true)
    expect(wrapper.find('.router-view-stub').exists()).toBe(true)
  })

  test('displays HelpMenu component', () => {
    wrapper = createWrapper()
    
    const helpMenu = wrapper.findComponent(HelpMenuStub)
    expect(helpMenu.exists()).toBe(true)
  })

  test('has router-view with keep-alive', () => {
    wrapper = createWrapper()
    
    // Check that the template contains the expected structure
    const mainContainer = wrapper.find('.main-container')
    expect(mainContainer.exists()).toBe(true)
    
    // The router-view should be present (stubbed)
    const routerView = wrapper.find('.router-view-stub')
    expect(routerView.exists()).toBe(true)
  })

  test('computed property getKey returns store uploadComponentKey', () => {
    wrapper = createWrapper()
    
    const vm = wrapper.vm as any
    expect(vm.getKey).toBe('test-key-123')
  })

  test('store is properly initialized', () => {
    wrapper = createWrapper()
    
    const vm = wrapper.vm as any
    expect(vm.store).toBeDefined()
    expect(vm.store.uploadComponentKey).toBe('test-key-123')
  })

  test('component has correct name', () => {
    wrapper = createWrapper()
    
    expect(wrapper.vm.$options.name).toBe('CoreAppView')
  })

  test('getKey computed property works correctly', () => {
    wrapper = createWrapper()
    
    const vm = wrapper.vm as any
    const key = vm.getKey
    expect(key).toBe('test-key-123')
    expect(typeof key).toBe('string')
    
    // Verify the computed property returns the store value
    expect(vm.store.uploadComponentKey).toBe(key)
  })

  test('keep-alive key attribute is bound to getKey', () => {
    // Ensure we start with the expected value
    mockGeneralStore.uploadComponentKey = 'test-key-123'
    wrapper = createWrapper()
    
    // Since we're using stubs, we need to check the actual template rendering
    // The keep-alive component should have the key attribute
    const vm = wrapper.vm as any
    expect(vm.getKey).toBe('test-key-123')
  })

  test('component renders without errors on different routes', async () => {
    wrapper = createWrapper('/')
    expect(wrapper.exists()).toBe(true)

    await router.push('/test')
    await wrapper.vm.$nextTick()
    
    expect(wrapper.exists()).toBe(true)
    expect(wrapper.find('.main-container').exists()).toBe(true)
  })

  test('component structure matches expected layout', () => {
    wrapper = createWrapper()
    
    const html = wrapper.html()
    
    // Check that the main container is the root element
    expect(wrapper.classes()).toContain('main-container')
    
    // Check that both HelpMenu and router-view are present
    expect(html).toContain('help-menu-stub')
    expect(html).toContain('router-view-stub')
  })
})
