import { describe, test, expect, afterEach, vi } from 'vitest'

// Override the global apex stub with one that declares props so we can assert
// on the options/series objects passed to the chart.
vi.mock('vue3-apexcharts', () => ({
  default: {
    name: 'VueApexChartStub',
    props: ['options', 'series', 'type', 'height'],
    template: '<div class="vue-apexchart-stub" />',
  },
}))

import AutoLineChart from '@cornflow-ui/core/components/dashboard/AutoLineChart.vue'
import { mountDashboard } from './dashboardTestUtils'

let wrapper: any
afterEach(() => {
  if (wrapper) wrapper.unmount()
})

const baseConfig = (over: Record<string, any> = {}) => ({
  categories: ['Jan', 'Feb', 'Mar'],
  series: [{ name: 'A', data: [1, 2, 3] }],
  ...over,
})

const mountChart = (config: Record<string, any>, title = 'My Chart') =>
  mountDashboard(AutoLineChart, { props: { title, config } })

describe('AutoLineChart', () => {
  test('renders the title and the apexcharts stub', () => {
    wrapper = mountChart(baseConfig())
    expect(wrapper.find('.chart-title').text()).toBe('My Chart')
    expect(wrapper.find('.vue-apexchart-stub').exists()).toBe(true)
  })

  test('hides the total section when totalValue is undefined', () => {
    wrapper = mountChart(baseConfig())
    expect(wrapper.find('.chart-total-section').exists()).toBe(false)
  })

  test('shows total as plain number by default', () => {
    wrapper = mountChart(baseConfig({ totalValue: 12345 }))
    expect(wrapper.find('.chart-total-value').text()).toBe('12,345')
  })

  test('formats total as currency', () => {
    wrapper = mountChart(baseConfig({ totalValue: 1000, totalFormat: 'currency' }))
    expect(wrapper.find('.chart-total-value').text()).toContain('$')
  })

  test('formats total as percentage', () => {
    wrapper = mountChart(
      baseConfig({ totalValue: 50.5, totalFormat: 'percentage' }),
    )
    expect(wrapper.find('.chart-total-value').text()).toBe('50.50%')
  })

  test('shows positive total change with class', () => {
    wrapper = mountChart(baseConfig({ totalValue: 1, totalChange: 4 }))
    const change = wrapper.find('.chart-total-change')
    expect(change.exists()).toBe(true)
    expect(change.classes()).toContain('positive')
    expect(change.text()).toContain('+4.0%')
  })

  test('shows negative total change with class', () => {
    wrapper = mountChart(baseConfig({ totalValue: 1, totalChange: -4 }))
    const change = wrapper.find('.chart-total-change')
    expect(change.classes()).toContain('negative')
    expect(change.text()).toContain('-4.0%')
  })

  test('appends absolute change for currency total', () => {
    wrapper = mountChart(
      baseConfig({
        totalValue: 1,
        totalFormat: 'currency',
        totalChange: 2,
        totalChangeValue: 300,
      }),
    )
    expect(wrapper.find('.chart-total-change').text()).toContain('$')
  })

  test('renders the total period when change and period are present', () => {
    wrapper = mountChart(
      baseConfig({ totalValue: 1, totalChange: 1, totalPeriod: 'YTD' }),
    )
    expect(wrapper.find('.chart-total-period').text()).toBe('YTD')
  })

  test('renders a message banner when config.message exists', () => {
    wrapper = mountChart(baseConfig({ message: 'Heads up' }))
    expect(wrapper.find('.chart-message').text()).toBe('Heads up')
  })

  test('omits message banner when no message', () => {
    wrapper = mountChart(baseConfig())
    expect(wrapper.find('.chart-message').exists()).toBe(false)
  })

  test('passes the series through to the chart options (single series)', () => {
    wrapper = mountChart(baseConfig())
    const apex = wrapper.findComponent({ name: 'VueApexChartStub' })
    expect(apex.props('series')).toEqual([{ name: 'A', data: [1, 2, 3] }])
    // single series => no legend
    expect(apex.props('options').legend.show).toBe(false)
    expect(apex.props('options').markers.size).toBe(4)
  })

  test('enables legend and adjusts markers for multiple series', () => {
    wrapper = mountChart(
      baseConfig({
        series: [
          { name: 'A', data: [1] },
          { name: 'B', data: [2] },
        ],
      }),
    )
    const apex = wrapper.findComponent({ name: 'VueApexChartStub' })
    expect(apex.props('options').legend.show).toBe(true)
    expect(apex.props('options').markers.size).toBe(3)
  })

  test('rotates x-axis labels when there are many categories', () => {
    const many = Array.from({ length: 20 }, (_, i) => `c${i}`)
    wrapper = mountChart(baseConfig({ categories: many }))
    const opts = wrapper.findComponent({ name: 'VueApexChartStub' }).props('options')
    expect(opts.xaxis.labels.rotate).toBe(-45)
    expect(opts.xaxis.labels.rotateAlways).toBe(true)
  })

  test('y-axis formatter abbreviates large numbers', () => {
    wrapper = mountChart(baseConfig())
    const fmt = wrapper
      .findComponent({ name: 'VueApexChartStub' })
      .props('options').yaxis.labels.formatter
    expect(fmt(2_500_000)).toBe('2.5M')
    expect(fmt(3_400)).toBe('3.4K')
    expect(fmt(42)).toBe('42')
  })

  test('tooltip y formatter formats numbers', () => {
    wrapper = mountChart(baseConfig())
    const fmt = wrapper
      .findComponent({ name: 'VueApexChartStub' })
      .props('options').tooltip.y.formatter
    expect(fmt(1234.5)).toBe('1,234.5')
  })
})
