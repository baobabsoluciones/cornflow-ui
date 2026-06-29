import { describe, test, expect, afterEach } from 'vitest'
import AutoKPICard from '@cornflow-ui/core/components/dashboard/AutoKPICard.vue'
import { mountDashboard } from './dashboardTestUtils'

let wrapper: any
afterEach(() => {
  if (wrapper) wrapper.unmount()
})

const mountCard = (config: Record<string, any>) =>
  mountDashboard(AutoKPICard, { props: { config } })

describe('AutoKPICard', () => {
  test('renders label and number-formatted value by default', () => {
    wrapper = mountCard({ value: 1234.5, label: 'Volumen' })
    expect(wrapper.find('.kpi-title').text()).toBe('Volumen')
    // es-ES uses a comma as the decimal separator.
    expect(wrapper.find('.kpi-value').text()).toContain(',5')
  })

  test('formats currency values', () => {
    wrapper = mountCard({ value: 1000, label: 'Coste', format: 'currency' })
    const text = wrapper.find('.kpi-value').text()
    expect(text).toContain('€')
  })

  test('formats percentage values', () => {
    wrapper = mountCard({ value: 12.345, label: 'Ratio', format: 'percentage' })
    expect(wrapper.find('.kpi-value').text()).toBe('12.35%')
  })

  test('hides bottom section when no change and no period', () => {
    wrapper = mountCard({ value: 1, label: 'X' })
    expect(wrapper.find('.kpi-bottom-section').exists()).toBe(false)
  })

  test('shows positive change with a plus sign and positive class', () => {
    wrapper = mountCard({ value: 1, label: 'X', change: 5 })
    const change = wrapper.find('.kpi-change')
    expect(change.exists()).toBe(true)
    expect(change.classes()).toContain('positive')
    expect(change.text()).toContain('+5.0%')
  })

  test('shows negative change with negative class and no plus sign', () => {
    wrapper = mountCard({ value: 1, label: 'X', change: -3 })
    const change = wrapper.find('.kpi-change')
    expect(change.classes()).toContain('negative')
    expect(change.text()).toContain('-3.0%')
  })

  test('appends absolute change value for currency format', () => {
    wrapper = mountCard({
      value: 1,
      label: 'X',
      format: 'currency',
      change: 2,
      changeValue: -500,
    })
    const text = wrapper.find('.kpi-change').text()
    expect(text).toContain('+2.0%')
    expect(text).toContain('€')
  })

  test('renders the period and separator when both change and period exist', () => {
    wrapper = mountCard({ value: 1, label: 'X', change: 1, period: 'Last 30' })
    expect(wrapper.find('.kpi-period').text()).toBe('Last 30')
    expect(wrapper.find('.kpi-separator').exists()).toBe(true)
  })

  test('renders period without separator when there is no change', () => {
    wrapper = mountCard({ value: 1, label: 'X', period: 'Last 30' })
    expect(wrapper.find('.kpi-period').exists()).toBe(true)
    expect(wrapper.find('.kpi-separator').exists()).toBe(false)
  })

  describe('icon selection by label', () => {
    test('maximum -> trending-up + success', () => {
      wrapper = mountCard({ value: 1, label: 'Stock Maximo' })
      expect(wrapper.findComponent({ name: 'VIcon' }).props('icon')).toBe(
        'mdi-trending-up',
      )
      expect(wrapper.find('.kpi-icon-wrapper').classes()).toContain(
        'kpi-icon--success',
      )
    })

    test('minimum -> trending-down + warning', () => {
      wrapper = mountCard({ value: 1, label: 'Stock Minimo' })
      expect(wrapper.findComponent({ name: 'VIcon' }).props('icon')).toBe(
        'mdi-trending-down',
      )
      expect(wrapper.find('.kpi-icon-wrapper').classes()).toContain(
        'kpi-icon--warning',
      )
    })

    test('average -> chart-line-variant + accent', () => {
      wrapper = mountCard({ value: 1, label: 'Promedio diario' })
      expect(wrapper.findComponent({ name: 'VIcon' }).props('icon')).toBe(
        'mdi-chart-line-variant',
      )
      expect(wrapper.find('.kpi-icon-wrapper').classes()).toContain(
        'kpi-icon--accent',
      )
    })

    test('total -> calculator + primary', () => {
      wrapper = mountCard({ value: 1, label: 'Total entradas' })
      expect(wrapper.findComponent({ name: 'VIcon' }).props('icon')).toBe(
        'mdi-calculator',
      )
      expect(wrapper.find('.kpi-icon-wrapper').classes()).toContain(
        'kpi-icon--primary',
      )
    })

    test('uses config.icon as fallback when label matches nothing', () => {
      wrapper = mountCard({ value: 1, label: 'neutral metric', icon: 'mdi-foo' })
      expect(wrapper.findComponent({ name: 'VIcon' }).props('icon')).toBe(
        'mdi-foo',
      )
    })

    test('defaults to chart-box when nothing matches and no icon given', () => {
      wrapper = mountCard({ value: 1, label: 'neutral metric' })
      expect(wrapper.findComponent({ name: 'VIcon' }).props('icon')).toBe(
        'mdi-chart-box',
      )
    })
  })
})
