import { afterEach, describe, expect, test, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { h } from 'vue'
import CoreCard from '@cornflow-ui/core/components/core/CoreCard.vue'
import CoreRangeSlider from '@cornflow-ui/core/components/core/CoreRangeSlider.vue'
import CoreStat from '@cornflow-ui/core/components/core/CoreStat.vue'
import CoreChart from '@cornflow-ui/core/components/core/dashboard/CoreChart.vue'
import CoreFigureGrid from '@cornflow-ui/core/components/core/dashboard/CoreFigureGrid.vue'
import CoreRangeFilter from '@cornflow-ui/core/components/core/dashboard/CoreRangeFilter.vue'
import CoreStatusBanner from '@cornflow-ui/core/components/core/dashboard/CoreStatusBanner.vue'

vi.mock('vue3-apexcharts', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    default: defineComponent({
      name: 'ApexChartStub',
      props: ['options', 'type', 'height', 'series'],
      setup: () => () => h('div', { class: 'chart' }),
    }),
  }
})

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      common: { from: 'From', to: 'To' },
      dashboard: { range: { shown: '{shown} of {count}' } },
    },
  },
})

const global = { plugins: [i18n] }

afterEach(() => {
  document.body.innerHTML = ''
})

describe('CoreCard', () => {
  test('shows its title, subtitle, icon, actions, body and footer', () => {
    const wrapper = mount(CoreCard, {
      props: { title: 'Production per day', subtitle: 'Units', icon: 'mdi-chart-bar' },
      slots: { default: 'chart', actions: '<button>Export</button>', footer: 'Legend' },
    })
    expect(wrapper.get('h2').text()).toBe('Production per day')
    expect(wrapper.get('.core-card__subtitle').text()).toBe('Units')
    expect(wrapper.find('.mdi-chart-bar').exists()).toBe(true)
    expect(wrapper.get('.core-card__actions').text()).toBe('Export')
    expect(wrapper.get('.core-card__body').text()).toBe('chart')
    expect(wrapper.get('.core-card__footer').text()).toBe('Legend')
  })

  test('has no header without a title or actions, and goes edge to edge when flush', () => {
    const wrapper = mount(CoreCard, { props: { flush: true }, slots: { default: 'table' } })
    expect(wrapper.find('header').exists()).toBe(false)
    expect(wrapper.classes()).toContain('core-card--flush')
  })
})

describe('CoreStat', () => {
  test('is a term and its value, with the caption under it', () => {
    const wrapper = mount(CoreStat, {
      props: { value: '96%', label: 'Capacity used', caption: 'of 2,200' },
    })
    expect(wrapper.get('dt').text()).toBe('Capacity used')
    expect(wrapper.findAll('dd').map((dd) => dd.text())).toEqual(['96%', 'of 2,200'])
    expect(wrapper.classes()).not.toContain('core-stat--toned')
  })

  test('takes the colour of its tone', () => {
    const wrapper = mount(CoreStat, { props: { value: '1,240', label: 'Units short', tone: 'danger' } })
    expect(wrapper.classes()).toEqual(expect.arrayContaining(['core-tone--danger', 'core-stat--toned']))
  })
})

describe('CoreStatusBanner', () => {
  test('shows the verdict in its tone, with the default icon, and its figures', () => {
    const wrapper = mount(CoreStatusBanner, {
      props: {
        title: 'Feasible plan · 3 products short',
        tone: 'warning',
        stats: [
          { value: '1,240', label: 'Units short', tone: 'danger' },
          { value: '12', label: 'Extra shifts' },
        ],
      },
    })
    expect(wrapper.classes()).toContain('core-tone--warning')
    expect(wrapper.attributes('role')).toBe('status')
    expect(wrapper.find('.mdi-alert').exists()).toBe(true)
    expect(wrapper.get('.core-status-banner__title').text()).toBe('Feasible plan · 3 products short')
    const stats = wrapper.findAll('.core-stat')
    expect(stats.map((stat) => stat.text())).toEqual(['Units short1,240', 'Extra shifts12'])
    expect(stats[0].classes()).toContain('core-tone--danger')
  })
})

describe('CoreRangeSlider', () => {
  test('has a thumb at each end, named, and a dot per step', async () => {
    const wrapper = mount(CoreRangeSlider, {
      props: { modelValue: [1, 3], max: 5, ticks: true },
      global,
      attachTo: document.body,
    })
    await flushPromises()
    const thumbs = wrapper.findAll('[role="slider"]')
    expect(thumbs.map((thumb) => thumb.attributes('aria-label'))).toEqual(['From', 'To'])
    expect(thumbs.map((thumb) => thumb.attributes('aria-valuenow'))).toEqual(['1', '3'])
    const ticks = wrapper.findAll('.core-range-slider__tick')
    expect(ticks).toHaveLength(6)
    expect(ticks.map((tick) => tick.classes().includes('is-in'))).toEqual([false, true, true, true, false, false])
  })

  test('moves a thumb with the arrows and emits the new pair', async () => {
    const wrapper = mount(CoreRangeSlider, {
      props: { modelValue: [1, 3], max: 5, labels: ['First', 'Last'] },
      global,
      attachTo: document.body,
    })
    await flushPromises()
    const last = wrapper.findAll('[role="slider"]')[1]
    expect(last.attributes('aria-label')).toBe('Last')
    await last.trigger('focus')
    await last.trigger('keydown', { key: 'ArrowRight' })
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([[1, 4]])
  })
})

describe('CoreRangeFilter', () => {
  const labels = ['Mon 3', 'Tue 4', 'Wed 5', 'Wk 10', 'Wk 17']
  const presets = [
    { value: 'all', label: 'All', range: [0, 4] as [number, number] },
    { value: 'weeks', label: 'Weekly', range: [3, 4] as [number, number] },
    { value: 'months', label: 'Monthly', range: null },
  ]

  test('reads the range and how much of the scale it takes, with the matching preset picked', () => {
    const wrapper = mount(CoreRangeFilter, {
      props: { modelValue: [3, 4], labels, presets, label: 'Horizon' },
      global,
    })
    expect(wrapper.get('.core-range-filter__label').text()).toBe('Horizon')
    expect(wrapper.get('.core-range-filter__range').text()).toBe('Wk 10 → Wk 17')
    expect(wrapper.get('.core-range-filter__count').text()).toBe('2 of 5')
    const radios = wrapper.findAll('[role="radio"]')
    expect(radios.map((radio) => radio.attributes('aria-checked'))).toEqual(['false', 'true', 'false'])
    expect(radios[2].attributes('disabled')).toBeDefined()
  })

  test('a preset sets its range, and the summary can be the page own', async () => {
    const wrapper = mount(CoreRangeFilter, {
      props: { modelValue: [0, 0], labels, presets, summary: 'the 5 periods' },
      global,
    })
    expect(wrapper.get('.core-range-filter__range').text()).toBe('Mon 3')
    expect(wrapper.get('.core-range-filter__count').text()).toBe('the 5 periods')
    await wrapper.findAll('[role="radio"]')[0].trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([[[0, 4]]])
  })
})

describe('CoreFigureGrid', () => {
  const columns = [
    { key: 'mon', title: 'Mon 3', subtitle: 'day' },
    { key: 'week', title: 'Week', subtitle: '3/03', emphasis: true, divider: true },
    { key: 'cap', title: 'Capacity', reference: true },
  ]
  const rows = [
    {
      key: 'a',
      label: 'Line A',
      cells: {
        mon: { value: '120', caption: '96%' },
        week: { value: '600', caption: '+1 shift', tone: 'danger' as const },
        cap: { value: '650' },
      },
    },
    { key: 'b', label: 'Line B', cells: { week: { value: '80' } } },
  ]
  const total = { key: 'total', label: 'All lines', cells: { mon: { value: '120' }, week: { value: '680' } } }

  test('lays out the figures by row and column, with a dot where there is none', () => {
    const wrapper = mount(CoreFigureGrid, { props: { rowHeader: 'Line', columns, rows, total } })
    const head = wrapper.findAll('thead th').map((th) => th.text())
    expect(head).toEqual(['Line', 'Mon 3day', 'Week3/03', 'Capacity'])
    const first = wrapper.findAll('tbody tr')[0].findAll('td')
    expect(first.map((td) => td.text())).toEqual(['12096%', '600+1 shift', '650'])
    expect(first[1].classes()).toEqual(expect.arrayContaining(['is-emphasis', 'has-divider']))
    expect(first[1].find('.core-tone--danger').exists()).toBe(true)
    expect(wrapper.findAll('tbody tr')[1].findAll('td')[0].text()).toBe('·')
    expect(wrapper.findAll('tfoot td').map((td) => td.text())).toEqual(['120', '680', '·'])
    expect(wrapper.find('button').exists()).toBe(false)
  })

  test('picks a figure, not the reference ones, and picks it off again', async () => {
    const wrapper = mount(CoreFigureGrid, { props: { columns, rows, selectable: true, selected: null } })
    const buttons = wrapper.findAll('tbody button')
    expect(buttons).toHaveLength(3)
    await buttons[1].trigger('click')
    expect(wrapper.emitted('update:selected')).toEqual([[{ row: 'a', column: 'week' }]])
    await wrapper.setProps({ selected: { row: 'a', column: 'week' } })
    expect(buttons[1].attributes('aria-pressed')).toBe('true')
    expect(buttons[1].element.closest('td')?.classList.contains('is-selected')).toBe(true)
    await buttons[1].trigger('click')
    expect(wrapper.emitted('update:selected')?.at(-1)).toEqual([null])
  })

  test('opens the detail of the picked figure next to it', async () => {
    const wrapper = mount(CoreFigureGrid, {
      props: { columns, rows, selectable: true, selected: { row: 'b', column: 'week' } },
      slots: { detail: ({ row, column }: { row: string; column: string }) => h('p', `${row} · ${column}`) },
      attachTo: document.body,
    })
    await flushPromises()
    expect(document.body.textContent).toContain('b · week')
    wrapper.unmount()
  })
})

describe('CoreChart', () => {
  test('draws the chart again, formatters and all, when its options change', async () => {
    const wrapper = mount(CoreChart, {
      props: {
        type: 'bar',
        height: 240,
        options: { yaxis: { labels: { formatter: (value: number) => `${value} u` } } },
        series: [{ name: 'Line A', data: [1, 2] }],
      },
    })
    const chart = () => wrapper.findComponent({ name: 'ApexChartStub' })
    const first = chart().vm
    expect(chart().props('height')).toBe(240)

    const formatter = (value: number) => `${value} kg`
    await wrapper.setProps({ options: { yaxis: { labels: { formatter } } } })
    expect(chart().vm).not.toBe(first)
    expect(chart().props('options').yaxis.labels.formatter).toBe(formatter)
  })
})
