import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { shallowMount, flushPromises } from '@vue/test-utils'
import { reactive } from 'vue'
import { createVuetify } from 'vuetify'
import { createI18n } from 'vue-i18n'

const mockRoute = {
  params: { sectionId: 'automation', subsectionKey: 'rules' },
  query: {},
}

vi.mock('vue-router', () => ({
  useRoute: vi.fn(() => mockRoute),
}))

const mockGetSubsectionDef = vi.hoisted(() => vi.fn((): unknown => null))
vi.mock('@cornflow-ui/core/app/config', () => ({
  default: {
    getFrontendAutomationSubsectionDef: mockGetSubsectionDef,
  },
}))

const mockStore = reactive({
  getSchemaName: 'planning_dag',
  getUser: { roles: [{ name: 'planner' }] } as { roles: Array<{ name: string }> },
})
vi.mock('@cornflow-ui/core/stores/general', () => ({
  useGeneralStore: () => mockStore,
}))

const RulesView = { name: 'RulesView', template: '<div class="rules-view" />' }

function subsectionDef(gating: { roles?: string[]; schemas?: string[] } = {}) {
  return {
    path: 'rules',
    name: 'Rules',
    titleKey: 'rules',
    icon: 'mdi-view',
    component: async () => ({ default: RulesView }),
    ...gating,
  }
}

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
    mockGetSubsectionDef.mockReturnValue(null)
    mockStore.getSchemaName = 'planning_dag'
    mockStore.getUser = { roles: [{ name: 'planner' }] }
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

  describe('Gating', () => {
    test('shows a sub-section without gating', async () => {
      mockGetSubsectionDef.mockReturnValue(subsectionDef())
      const { wrapper } = createWrapper()
      await flushPromises()

      expect(wrapper.find('.pa-4').exists()).toBe(false)
    })

    test('shows not found for a sub-section of another DAG', async () => {
      mockGetSubsectionDef.mockReturnValue(subsectionDef({ schemas: ['stock_dag'] }))
      const { wrapper } = createWrapper()
      await flushPromises()

      expect(wrapper.find('.pa-4').exists()).toBe(true)
    })

    test('shows not found for a sub-section of other roles', async () => {
      mockGetSubsectionDef.mockReturnValue(subsectionDef({ roles: ['admin'] }))
      const { wrapper } = createWrapper()
      await flushPromises()

      expect(wrapper.find('.pa-4').exists()).toBe(true)
    })

    test('follows a DAG switch', async () => {
      mockGetSubsectionDef.mockReturnValue(subsectionDef({ schemas: ['planning_dag'] }))
      const { wrapper } = createWrapper()
      await flushPromises()
      expect(wrapper.find('.pa-4').exists()).toBe(false)

      mockStore.getSchemaName = 'stock_dag'
      await flushPromises()

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
