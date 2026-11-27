import { describe, test, expect } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ExecutionDataFilterStrip from '@cornflow-ui/core/components/section-view/ExecutionDataFilterStrip.vue'
import type { ExecutionDataFilter } from '@cornflow-ui/core/utils/executionDataFilter'
import { createEnI18n } from '../core/data-table/i18nEn'

const filter: ExecutionDataFilter = {
  param: 'plant',
  title: { en: 'Plant', es: 'Planta' },
  value: 'P1',
  options: [
    { value: 'P1', label: 'North' },
    { value: 'P2', label: 'South' },
  ],
  tables: { instance: ['demand'], solution: [] },
}

const byTestId = (id: string) =>
  document.body.querySelector<HTMLElement>(`[data-testid="${id}"]`)

const mountStrip = (props: Record<string, unknown> = {}) =>
  mount(ExecutionDataFilterStrip, {
    props: { filter, ...props },
    attachTo: document.body,
    global: { plugins: [createEnI18n()] },
  })

const openMenu = async (wrapper: ReturnType<typeof mountStrip>) => {
  await wrapper.find('.filter-chip__main').trigger('click')
  await flushPromises()
}

describe('ExecutionDataFilterStrip', () => {
  test('shows the value the table carries under the title in the current language', () => {
    const wrapper = mountStrip()

    expect(wrapper.find('.filter-chip__label').text()).toBe('Plant')
    expect(wrapper.find('.filter-chip__value').text()).toBe('North')
    expect(wrapper.text()).toContain('Only the rows of the picked value are shown.')
    wrapper.unmount()
  })

  test('picking another value asks for it', async () => {
    const wrapper = mountStrip()
    await openMenu(wrapper)

    byTestId('filter-option-P2')?.click()
    await flushPromises()

    expect(wrapper.emitted('pick')).toEqual([['P2']])
    wrapper.unmount()
  })

  test('picking the value it shows asks for nothing', async () => {
    const wrapper = mountStrip()
    await openMenu(wrapper)

    byTestId('filter-option-P1')?.click()
    await flushPromises()

    expect(wrapper.emitted('pick')).toBeUndefined()
    wrapper.unmount()
  })

  test('while a value is read, it says so and takes no other', async () => {
    const wrapper = mountStrip({ loading: true })
    expect(wrapper.find('[data-testid="data-filter-loading"]').exists()).toBe(true)
    await openMenu(wrapper)

    byTestId('filter-option-P2')?.click()
    await flushPromises()

    expect(wrapper.emitted('pick')).toBeUndefined()
    wrapper.unmount()
  })

  test('the options can be searched', async () => {
    const wrapper = mountStrip()
    await openMenu(wrapper)

    expect(document.body.querySelector('.core-menu__search-input')).not.toBeNull()
    wrapper.unmount()
  })
})
