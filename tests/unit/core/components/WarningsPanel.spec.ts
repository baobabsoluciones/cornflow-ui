import { describe, test, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'

const store = vi.hoisted(() => ({
  getWarnings: [] as Array<{ message: string }>,
}))

const repoMock = vi.hoisted(() => ({
  downloadWarnings: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@cornflow-ui/core/stores/general', () => ({
  useGeneralStore: () => store,
}))

vi.mock('@cornflow-ui/core/repositories/WarningsRepository', () => ({
  default: class {
    downloadWarnings = repoMock.downloadWarnings
  },
}))

import WarningsPanel from '@cornflow-ui/core/components/WarningsPanel.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: { warnings: { title: 'Warnings', downloadAll: 'Download all', noWarnings: 'There are no warnings.' } },
  },
})

/** The popover rendered inline, so the panel can be read. */
const popover = { name: 'CorePopover', template: '<div><slot name="trigger" /><slot /></div>' }

const mountPanel = () =>
  mount(WarningsPanel, { global: { plugins: [i18n], stubs: { CorePopover: popover } } })

describe('WarningsPanel', () => {
  beforeEach(() => {
    store.getWarnings = []
    repoMock.downloadWarnings.mockReset().mockResolvedValue(undefined)
  })

  test('without warnings, the bell is plain and the panel says there are none', () => {
    const wrapper = mountPanel()
    const trigger = wrapper.find('[data-testid="warnings-trigger"]')
    expect(trigger.attributes('aria-label')).toBe('Warnings')
    expect(trigger.classes()).not.toContain('has-warnings')
    expect(wrapper.find('.warnings-panel__empty').text()).toBe('There are no warnings.')
    expect(wrapper.find('[data-testid="warnings-download"]').exists()).toBe(false)
  })

  test('with warnings, the bell is marked and the panel lists them', () => {
    store.getWarnings = [{ message: 'first' }, { message: 'second' }]
    const wrapper = mountPanel()
    expect(wrapper.find('[data-testid="warnings-trigger"]').classes()).toContain('has-warnings')
    expect(wrapper.findAll('.warnings-panel__item').map((item) => item.text())).toEqual([
      'first',
      'second',
    ])
  })

  test('"Download all" asks the repository for them', async () => {
    store.getWarnings = [{ message: 'first' }]
    const wrapper = mountPanel()
    await wrapper.find('[data-testid="warnings-download"]').trigger('click')
    await flushPromises()
    expect(repoMock.downloadWarnings).toHaveBeenCalledTimes(1)
    expect(wrapper.find('[data-testid="warnings-download"]').attributes('disabled')).toBeUndefined()
  })

  test('a failed download leaves the panel usable', async () => {
    store.getWarnings = [{ message: 'first' }]
    repoMock.downloadWarnings.mockRejectedValue(new Error('network'))
    const wrapper = mountPanel()
    await wrapper.find('[data-testid="warnings-download"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="warnings-download"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.findAll('.warnings-panel__item')).toHaveLength(1)
  })
})
