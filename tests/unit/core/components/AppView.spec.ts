import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import { createRouter, createWebHistory } from 'vue-router'
import { createI18n } from 'vue-i18n'
import AppView from '@/components/AppView.vue'

const mockGeneralStore = {
  uploadComponentKey: 'test-key-123',
  isDrawerPinned: false,
  getWarnings: [] as unknown[],
}

vi.mock('@/stores/general', () => ({
  useGeneralStore: vi.fn(() => mockGeneralStore),
}))

vi.mock('@/app/config', () => ({
  default: {
    getCore: () => ({
      parameters: {
        enableWarnings: false,
      },
    }),
    isAppSectionShowsLoadingOnEnter: (path: string) =>
      path === '/loading-example',
  },
}))

const HelpMenuStub = {
  name: 'HelpMenu',
  template: '<div class="help-menu-stub">HelpMenu</div>',
}

describe('AppView', () => {
  let vuetify: ReturnType<typeof createVuetify>
  let router: ReturnType<typeof createRouter>
  let i18n: ReturnType<typeof createI18n>
  let wrapper: ReturnType<typeof mount> | undefined

  beforeEach(() => {
    vuetify = createVuetify()
    i18n = createI18n({
      legacy: false,
      locale: 'en',
      messages: {
        en: {
          general: {
            loading: 'Loading...',
          },
        },
      },
    })

    router = createRouter({
      history: createWebHistory(),
      routes: [
        { path: '/', component: { template: '<div>Home</div>' } },
        { path: '/test', component: { template: '<div>Test</div>' } },
        {
          path: '/loading-example',
          component: { template: '<div>Loading example</div>' },
          meta: { showsLoadingOnEnter: true },
        },
      ],
    })

    mockGeneralStore.uploadComponentKey = 'test-key-123'
    vi.clearAllMocks()
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
  })

  const createWrapper = async (routePath = '/') => {
    await router.push(routePath)
    await router.isReady()

    return mount(AppView, {
      global: {
        plugins: [vuetify, router, i18n],
        stubs: {
          HelpMenu: HelpMenuStub,
          RouterView: {
            template: '<div class="router-view-stub"><slot /></div>',
          },
        },
      },
    })
  }

  test('renders the component correctly', async () => {
    wrapper = await createWrapper()

    expect(wrapper.find('.main-container').exists()).toBe(true)
    expect(wrapper.find('.help-menu-stub').exists()).toBe(true)
    expect(wrapper.find('.router-view-stub').exists()).toBe(true)
  })

  test('displays HelpMenu component', async () => {
    wrapper = await createWrapper()

    const helpMenu = wrapper.findComponent(HelpMenuStub)
    expect(helpMenu.exists()).toBe(true)
  })

  test('has router-view with keep-alive', async () => {
    wrapper = await createWrapper()

    expect(wrapper.find('.main-container').exists()).toBe(true)
    expect(wrapper.find('.router-view-stub').exists()).toBe(true)
  })

  test('component has correct name', async () => {
    wrapper = await createWrapper()

    expect(wrapper.vm.$options.name).toBe('CoreAppView')
  })

  test('component renders without errors on different routes', async () => {
    wrapper = await createWrapper('/')
    expect(wrapper.exists()).toBe(true)

    await router.push('/test')
    await wrapper.vm.$nextTick()

    expect(wrapper.exists()).toBe(true)
    expect(wrapper.find('.main-container').exists()).toBe(true)
  })

  test('shows loading overlay for app sections with showsLoadingOnEnter', async () => {
    wrapper = await createWrapper('/loading-example')
    await wrapper.vm.$nextTick()

    expect(
      wrapper.find('[data-testid="app-section-loading-overlay"]').exists(),
    ).toBe(true)
  })

  test('hides loading overlay for routes without showsLoadingOnEnter', async () => {
    wrapper = await createWrapper('/test')
    await wrapper.vm.$nextTick()

    expect(
      wrapper.find('[data-testid="app-section-loading-overlay"]').exists(),
    ).toBe(false)
  })
})
