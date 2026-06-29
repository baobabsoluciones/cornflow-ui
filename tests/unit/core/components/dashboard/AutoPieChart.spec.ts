import { describe, test, expect, afterEach, vi } from 'vitest'

vi.mock('vue3-apexcharts', () => ({
  default: {
    name: 'VueApexChartStub',
    props: ['options', 'series', 'type', 'height'],
    template: '<div class="vue-apexchart-stub" />',
  },
}))

import AutoPieChart from '@/components/dashboard/AutoPieChart.vue'
import { mountDashboard } from './dashboardTestUtils'

let wrapper: any
afterEach(() => {
  if (wrapper) wrapper.unmount()
})

const baseConfig = (over: Record<string, any> = {}) => ({
  labels: ['Alpha', 'Beta'],
  series: [30, 70],
  ...over,
})

const mountChart = (config: Record<string, any>, title = 'Distribution') =>
  mountDashboard(AutoPieChart, { props: { title, config } })

describe('AutoPieChart', () => {
  test('renders title and the apex donut stub', () => {
    wrapper = mountChart(baseConfig())
    expect(wrapper.find('.chart-title').text()).toBe('Distribution')
    expect(wrapper.find('.vue-apexchart-stub').exists()).toBe(true)
  })

  test('renders one legend item per label by default', () => {
    wrapper = mountChart(baseConfig())
    expect(wrapper.findAll('.legend-item').length).toBe(2)
  })

  test('hides the legend when showLegend is false', () => {
    wrapper = mountChart(baseConfig({ showLegend: false }))
    expect(wrapper.find('.chart-legend').exists()).toBe(false)
  })

  test('shows the center total label when totalLabel is provided', () => {
    wrapper = mountChart(baseConfig({ totalLabel: 'Units' }))
    expect(wrapper.find('.chart-center-label').exists()).toBe(true)
    expect(wrapper.find('.chart-center-total').text()).toBe('100')
    expect(wrapper.find('.chart-center-text').text()).toBe('Units')
  })

  test('omits the center label when no totalLabel', () => {
    wrapper = mountChart(baseConfig())
    expect(wrapper.find('.chart-center-label').exists()).toBe(false)
  })

  test('computes per-slice percentages', () => {
    wrapper = mountChart(baseConfig())
    const pcts = wrapper.findAll('.legend-percentage').map((n: any) => n.text())
    expect(pcts[0]).toBe('(30.0%)')
    expect(pcts[1]).toBe('(70.0%)')
  })

  test('shows 0% for every slice when the total is zero', () => {
    wrapper = mountChart(baseConfig({ series: [0, 0] }))
    const pcts = wrapper.findAll('.legend-percentage').map((n: any) => n.text())
    expect(pcts).toEqual(['(0%)', '(0%)'])
  })

  test('formats slice values with thousands separators', () => {
    wrapper = mountChart(baseConfig({ labels: ['Big'], series: [12345] }))
    expect(wrapper.find('.legend-value').text()).toBe('12,345')
  })

  test('passes labels and colors through to chart options', () => {
    wrapper = mountChart(baseConfig())
    const apex = wrapper.findComponent({ name: 'VueApexChartStub' })
    expect(apex.props('series')).toEqual([30, 70])
    expect(apex.props('options').labels).toEqual(['Alpha', 'Beta'])
    expect(apex.props('options').colors).toHaveLength(2)
  })

  test('dataLabels formatter hides small slices', () => {
    wrapper = mountChart(baseConfig())
    const fmt = wrapper
      .findComponent({ name: 'VueApexChartStub' })
      .props('options').dataLabels.formatter
    expect(fmt(10)).toBe('10.0%')
    expect(fmt(3)).toBe('')
  })

  test('tooltip custom renderer builds the html with the right percentage', () => {
    wrapper = mountChart(baseConfig())
    const custom = wrapper
      .findComponent({ name: 'VueApexChartStub' })
      .props('options').tooltip.custom
    const html = custom({
      series: [30, 70],
      seriesIndex: 1,
      w: { globals: { labels: ['Alpha', 'Beta'] } },
    })
    expect(html).toContain('Beta')
    expect(html).toContain('70.0%')
  })

  test('tooltip renderer handles a zero total gracefully', () => {
    wrapper = mountChart(baseConfig({ series: [0, 0] }))
    const custom = wrapper
      .findComponent({ name: 'VueApexChartStub' })
      .props('options').tooltip.custom
    const html = custom({
      series: [0, 0],
      seriesIndex: 0,
      w: { globals: { labels: [] } },
    })
    expect(html).toContain('(0%)')
  })
})
