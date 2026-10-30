import { describe, expect, test } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import DataTableTabs from '@cornflow-ui/core/components/core/data-table/DataTableTabs.vue'
import type { DataTableTab } from '@cornflow-ui/core/components/core/data-table/DataTableTabs.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      dataTable: {
        tabs: {
          previous: 'Previous tables',
          next: 'Next tables',
          allTables: 'All tables ({count})',
          search: 'Search table…',
          noMatches: 'No table matches',
          rows: '{count} row | {count} rows',
          pending: '{count} unsaved change | {count} unsaved changes',
          origin: 'Origin: {source}',
          sources: {
            database: 'database',
            file: 'file',
            edited: 'database, with manual changes',
            reuploaded: 'imported Excel',
          },
          master: {
            identical: 'Identical to the master',
            different: 'Differs from the master',
            comparing: 'Comparing with the master…',
            error: 'Could not compare with the master',
          },
          level: { error: 'Contains errors', warning: 'Contains warnings' },
        },
      },
    },
  },
})

const tabs: DataTableTab[] = [
  {
    key: 'lines',
    label: 'Lines',
    rows: 1200,
    pending: 1,
    source: 'database',
    master: 'identical',
    level: 'error',
  },
  { key: 'products', label: 'Products', rows: 36, master: 'comparing', badge: 'Input' },
  { key: 'demand', label: 'Demand', rows: 1, level: 'warning', master: 'different' },
]

const mountTabs = (modelValue = 'lines', list = tabs) =>
  mount(DataTableTabs, {
    props: { tabs: list, modelValue },
    global: { plugins: [i18n] },
    attachTo: document.body,
  })

const byTestId = (id: string) => document.body.querySelector<HTMLElement>(`[data-testid="${id}"]`)

describe('DataTableTabs', () => {
  test('shows a tab per table with its label and row count, the active one selected', () => {
    const wrapper = mountTabs('products')
    const rendered = wrapper.findAll('[role="tab"]')

    expect(rendered.map((tab) => tab.find('.data-table-tabs__label').text())).toEqual([
      'Lines',
      'Products',
      'Demand',
    ])
    expect(rendered[0].find('.data-table-tabs__rows').text()).toBe('1,200')
    expect(rendered[1].attributes('aria-selected')).toBe('true')
    expect(rendered[1].classes()).toContain('is-active')
    expect(rendered[1].attributes('tabindex')).toBe('0')
    expect(rendered[0].attributes('tabindex')).toBe('-1')
    expect(rendered[1].find('.data-table-tabs__badge').text()).toBe('Input')
    wrapper.unmount()
  })

  test('marks the origin, check level, master comparison and unsaved changes', () => {
    const wrapper = mountTabs()
    const [lines, products, demand] = wrapper.findAll('[role="tab"]')

    expect(lines.find('.mdi-database-outline').exists()).toBe(true)
    expect(lines.find('.mdi-alert-circle.is-error').exists()).toBe(true)
    expect(lines.find('.mdi-equal').exists()).toBe(true)
    expect(lines.find('.data-table-tabs__pending').text()).toBe('1')
    expect(products.find('.core-spinner').exists()).toBe(true)
    expect(demand.find('.mdi-alert.is-warning').exists()).toBe(true)
    expect(demand.find('.mdi-not-equal-variant').exists()).toBe(true)
    wrapper.unmount()
  })

  test('summarises each tab in its tooltip', () => {
    const wrapper = mountTabs()
    const [lines, , demand] = wrapper.findAll('[role="tab"]')

    expect(lines.attributes('title')).toBe(
      'Lines · 1,200 rows · 1 unsaved change · Origin: database · Identical to the master · Contains errors',
    )
    expect(demand.attributes('title')).toBe(
      'Demand · 1 row · Differs from the master · Contains warnings',
    )
    wrapper.unmount()
  })

  test('clicking a tab emits its key', async () => {
    const wrapper = mountTabs()

    await wrapper.find('[data-testid="data-table-tab-demand"]').trigger('click')

    expect(wrapper.emitted('update:modelValue')).toEqual([['demand']])
    wrapper.unmount()
  })

  test('arrow keys move the focus between tabs and Enter opens the focused one', async () => {
    const wrapper = mountTabs()
    const strip = wrapper.find('[role="tablist"]')

    await strip.trigger('keydown', { key: 'ArrowRight' })
    expect(document.activeElement).toBe(byTestId('data-table-tab-products'))
    expect(wrapper.find('[data-testid="data-table-tab-products"]').attributes('tabindex')).toBe('0')

    await strip.trigger('keydown', { key: 'End' })
    expect(document.activeElement).toBe(byTestId('data-table-tab-demand'))

    await wrapper.find('[data-testid="data-table-tab-demand"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([['demand']])
    wrapper.unmount()
  })

  test('the all-tables button counts the tables and lists them to jump to any', async () => {
    const wrapper = mountTabs()
    const all = wrapper.find('[data-testid="data-table-tabs-all"]')
    expect(all.text()).toBe('3')

    await all.trigger('click')
    await flushPromises()

    const items = document.body.querySelectorAll('[role="option"]')
    expect(items).toHaveLength(3)
    expect(byTestId('data-table-tabs-menu-lines')?.getAttribute('aria-selected')).toBe('true')

    byTestId('data-table-tabs-menu-demand')?.click()
    await flushPromises()

    expect(wrapper.emitted('update:modelValue')).toEqual([['demand']])
    expect(document.body.querySelector('[role="option"]')).toBeNull()
    wrapper.unmount()
  })

  test('the search in the all-tables list narrows it by name', async () => {
    const wrapper = mountTabs()
    await wrapper.find('[data-testid="data-table-tabs-all"]').trigger('click')
    await flushPromises()

    const search = document.body.querySelector<HTMLInputElement>(
      '[data-testid="data-table-tabs-search"]',
    )!
    search.value = 'prod'
    search.dispatchEvent(new Event('input'))
    await flushPromises()

    const items = [...document.body.querySelectorAll('[role="option"]')]
    expect(items.map((item) => item.querySelector('.data-table-tabs__menu-label')?.textContent)).toEqual(
      ['Products'],
    )

    search.value = 'zzz'
    search.dispatchEvent(new Event('input'))
    await flushPromises()
    expect(document.body.textContent).toContain('No table matches')
    wrapper.unmount()
  })

  test('shows scroll arrows when the tabs overflow the strip', async () => {
    const many = Array.from({ length: 25 }, (_, i) => ({ key: `t${i}`, label: `Table ${i}` }))
    const wrapper = mountTabs('t0', many)
    const strip = wrapper.find('[role="tablist"]').element as HTMLElement
    Object.defineProperty(strip, 'scrollWidth', { configurable: true, value: 3000 })
    Object.defineProperty(strip, 'clientWidth', { configurable: true, value: 600 })

    await wrapper.find('[role="tablist"]').trigger('scroll')

    expect(wrapper.find('[data-testid="data-table-tabs-previous"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-testid="data-table-tabs-next"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.find('[data-testid="data-table-tabs-all"]').text()).toBe('25')
    wrapper.unmount()
  })
})
