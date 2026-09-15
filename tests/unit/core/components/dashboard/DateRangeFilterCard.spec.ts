import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import { vuetify, createTestI18n } from '../../helpers'
import DateRangeFilterCard from '@cornflow-ui/core/components/dashboard/DateRangeFilterCard.vue'

describe('DateRangeFilterCard', () => {
  let wrapper: any

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    if (wrapper) {
    }
  })

  const createWrapper = (props = {}) => {
    const i18n = createTestI18n({
      en: {
        trendsDashboard: {
          filters: {
            from: 'From',
            to: 'To',
            apply: 'Apply',
            reset: 'Reset',
          },
        },
      },
    } as any)

    return shallowMount(DateRangeFilterCard, {
      props: {
        dateFrom: '2024-01-01',
        dateTo: '2024-12-31',
        ...props,
      },
      global: {
        plugins: [vuetify, i18n],
        stubs: {
          'v-row': true,
          'v-col': true,
          'v-text-field': true,
          'v-btn': true,
          'v-spacer': true,
        },
      },
    })
  }

  test('renders without errors', () => {
    wrapper = createWrapper()
    expect(wrapper.exists()).toBe(true)
  })

  test('has the correct root class', () => {
    wrapper = createWrapper()
    expect(wrapper.find('.date-range-filter-card').exists()).toBe(true)
  })

  test('accepts dateFrom prop', () => {
    wrapper = createWrapper({ dateFrom: '2024-06-01' })
    expect(wrapper.props('dateFrom')).toBe('2024-06-01')
  })

  test('accepts dateTo prop', () => {
    wrapper = createWrapper({ dateTo: '2024-06-30' })
    expect(wrapper.props('dateTo')).toBe('2024-06-30')
  })

  test('accepts loading prop', () => {
    wrapper = createWrapper({ loading: true })
    expect(wrapper.props('loading')).toBe(true)
  })

  test('accepts custom i18nKeyPrefix', () => {
    wrapper = createWrapper({ i18nKeyPrefix: 'ateneaDashboard.filters' })
    expect(wrapper.props('i18nKeyPrefix')).toBe('ateneaDashboard.filters')
  })
})
