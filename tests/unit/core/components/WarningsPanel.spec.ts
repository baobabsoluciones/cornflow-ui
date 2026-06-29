import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { createI18n } from 'vue-i18n'

const store = vi.hoisted(() => ({
  getWarnings: [] as Array<{ message: string }>,
}))

const repoMock = vi.hoisted(() => ({
  downloadWarnings: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/stores/general', () => ({
  useGeneralStore: () => store,
}))

vi.mock('@/repositories/WarningsRepository', () => ({
  default: class {
    downloadWarnings = repoMock.downloadWarnings
  },
}))

import WarningsPanel from '@/components/WarningsPanel.vue'

const vuetify = createVuetify({ components, directives })

const createWrapper = () => {
  const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: {} } })
  return mount(WarningsPanel, {
    global: {
      plugins: [vuetify, i18n],
      stubs: {
        'v-tooltip': { template: '<div><slot name="activator" :props="{}" /><slot /></div>' },
      },
    },
  })
}

describe('WarningsPanel', () => {
  let wrapper: any

  beforeEach(() => {
    vi.clearAllMocks()
    store.getWarnings = []
  })

  afterEach(() => {
    if (wrapper) wrapper.unmount()
  })

  describe('computed', () => {
    test('hasWarnings is false when there are no warnings', () => {
      wrapper = createWrapper()
      expect(wrapper.vm.hasWarnings).toBe(false)
      expect(wrapper.vm.warnings).toEqual([])
    })

    test('hasWarnings is true when warnings exist', () => {
      store.getWarnings = [{ message: 'w1' }]
      wrapper = createWrapper()
      expect(wrapper.vm.hasWarnings).toBe(true)
      expect(wrapper.vm.warnings).toHaveLength(1)
    })
  })

  describe('toggle open state', () => {
    test('toggles open when bell button is clicked', async () => {
      wrapper = createWrapper()
      expect(wrapper.vm.open).toBe(false)

      await wrapper.find('button').trigger('click')
      expect(wrapper.vm.open).toBe(true)

      await wrapper.find('button').trigger('click')
      expect(wrapper.vm.open).toBe(false)
    })

    test('renders the panel card when open', async () => {
      wrapper = createWrapper()
      wrapper.vm.open = true
      await wrapper.vm.$nextTick()
      expect(wrapper.find('.v-card').exists()).toBe(true)
    })

    test('shows the no-warnings message when empty and open', async () => {
      wrapper = createWrapper()
      wrapper.vm.open = true
      await wrapper.vm.$nextTick()
      expect(wrapper.text()).toContain('warnings.noWarnings')
    })

    test('renders one block per warning when warnings exist', async () => {
      store.getWarnings = [{ message: 'first' }, { message: 'second' }]
      wrapper = createWrapper()
      wrapper.vm.open = true
      await wrapper.vm.$nextTick()
      expect(wrapper.text()).toContain('first')
      expect(wrapper.text()).toContain('second')
    })
  })

  describe('download', () => {
    test('calls the repository and resets downloading on success', async () => {
      wrapper = createWrapper()
      await wrapper.vm.download()
      expect(repoMock.downloadWarnings).toHaveBeenCalledTimes(1)
      expect(wrapper.vm.downloading).toBe(false)
    })

    test('swallows errors and resets downloading flag', async () => {
      repoMock.downloadWarnings.mockRejectedValueOnce(new Error('boom'))
      wrapper = createWrapper()
      await wrapper.vm.download()
      expect(wrapper.vm.downloading).toBe(false)
    })
  })
})
