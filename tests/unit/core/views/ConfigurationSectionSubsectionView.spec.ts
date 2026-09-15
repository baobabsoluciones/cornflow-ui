import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import { createI18n } from 'vue-i18n'

const mockRoute = {
  params: { sectionId: 'automation', subsectionKey: 'rules' },
  query: {},
}

vi.mock('vue-router', () => ({
  useRoute: vi.fn(() => mockRoute),
}))

vi.mock('@cornflow-ui/core/app/config', () => ({
  default: {
    getFrontendAutomationSubsectionDef: vi.fn(() => null),
  },
}))

import ConfigurationSectionSubsectionView from '@cornflow-ui/core/views/ConfigurationSectionSubsectionView.vue'

const createWrapper = (
  params: Record<string, string> = {
    sectionId: 'automation',
    subsectionKey: 'rules',
  },
) => {
  mockRoute.params = params as any

  const vuetify = createVuetify()

  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: {
      en: {
        errors: {
          notFound: 'Not found',
        },
      },
    },
  })

  const wrapper = shallowMount(ConfigurationSectionSubsectionView, {
    global: {
      plugins: [vuetify, i18n],
    },
  })

  return { wrapper }
}

describe('ConfigurationSectionSubsectionView', () => {
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
      expect(wrapper.vm.$options.name).toBe(
        'ConfigurationSectionSubsectionView',
      )
    })
  })

  describe('Error State', () => {
    test('shows error alert when subsection def is not found', () => {
      const { wrapper } = createWrapper()
      expect(wrapper.find('.pa-4').exists()).toBe(true)
    })

    test('shows error when params are missing', () => {
      const { wrapper } = createWrapper({ sectionId: '', subsectionKey: '' })
      expect(wrapper.find('.pa-4').exists()).toBe(true)
    })
  })

  describe('Edge Cases', () => {
    test('handles component destruction gracefully', () => {
      const { wrapper } = createWrapper()
      expect(() => wrapper.unmount()).not.toThrow()
    })
  })
})
