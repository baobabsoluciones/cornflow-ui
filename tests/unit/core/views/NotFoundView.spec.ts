import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import { createRouter, createWebHistory } from 'vue-router'
import { createI18n } from 'vue-i18n'
import NotFoundView from '@cornflow-ui/core/views/NotFoundView.vue'

const messages = {
  en: {
    notFound: {
      title: 'Page not found',
      message: 'The page you are looking for does not exist.',
      forbiddenTitle: 'Access denied',
      forbiddenMessage: 'You do not have permission to access this page.',
      goHome: 'Go Home',
    },
  },
}

const createWrapper = (routeQuery: Record<string, string> = {}) => {
  const vuetify = createVuetify()

  const router = createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/', component: { template: '<div>Home</div>' } },
      { path: '/not-found', component: NotFoundView },
    ],
  })

  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages,
  })

  const wrapper = shallowMount(NotFoundView, {
    global: {
      plugins: [vuetify, router, i18n],
      mocks: {
        $route: { query: routeQuery },
      },
    },
  })

  return { wrapper, router }
}

describe('NotFoundView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Component Rendering', () => {
    test('renders without errors', () => {
      const { wrapper } = createWrapper()
      expect(wrapper.exists()).toBe(true)
    })

    test('mounts successfully with vm defined', () => {
      const { wrapper } = createWrapper()
      expect(wrapper.vm).toBeDefined()
    })

    test('has correct component name', () => {
      const { wrapper } = createWrapper()
      expect(wrapper.vm.$options.name).toBe('NotFoundView')
    })
  })

  describe('404 Not Found state', () => {
    test('shows 404 code when no forbidden query', () => {
      const { wrapper } = createWrapper()
      expect(wrapper.find('.not-found-code').text()).toBe('404')
    })

    test('shows not found title', () => {
      const { wrapper } = createWrapper()
      expect(wrapper.find('.not-found-title').text()).toBe('Page not found')
    })

    test('shows not found message', () => {
      const { wrapper } = createWrapper()
      expect(wrapper.find('.not-found-subtitle').text()).toBe(
        'The page you are looking for does not exist.',
      )
    })
  })

  describe('403 Forbidden state', () => {
    test('shows 403 code when reason is forbidden', () => {
      const { wrapper } = createWrapper({ reason: 'forbidden' })
      expect(wrapper.find('.not-found-code').text()).toBe('403')
    })

    test('shows forbidden title', () => {
      const { wrapper } = createWrapper({ reason: 'forbidden' })
      expect(wrapper.find('.not-found-title').text()).toBe('Access denied')
    })

    test('shows forbidden message', () => {
      const { wrapper } = createWrapper({ reason: 'forbidden' })
      expect(wrapper.find('.not-found-subtitle').text()).toBe(
        'You do not have permission to access this page.',
      )
    })
  })

  describe('Navigation', () => {
    test('has a go home button', () => {
      const { wrapper } = createWrapper()
      const btn = wrapper.find('.mt-6')
      expect(btn.exists()).toBe(true)
    })

    test('goHome method navigates to root', async () => {
      const { wrapper, router } = createWrapper()
      const pushSpy = vi.spyOn(router, 'push')
      ;(wrapper.vm as any).goHome()
      expect(pushSpy).toHaveBeenCalledWith('/')
    })
  })

  describe('Structure', () => {
    test('has not-found-container class', () => {
      const { wrapper } = createWrapper()
      expect(wrapper.find('.not-found-container').exists()).toBe(true)
    })

    test('has not-found-content wrapper', () => {
      const { wrapper } = createWrapper()
      expect(wrapper.find('.not-found-content').exists()).toBe(true)
    })

    test('contains a v-icon element', () => {
      const { wrapper } = createWrapper()
      expect(wrapper.find('.not-found-icon').exists()).toBe(true)
    })
  })

  describe('Edge Cases', () => {
    test('handles component destruction gracefully', () => {
      const { wrapper } = createWrapper()
      expect(() => wrapper.unmount()).not.toThrow()
    })
  })
})
