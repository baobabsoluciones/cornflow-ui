import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { createI18n } from 'vue-i18n'
import { reactive } from 'vue'

const makeHistorical = () => reactive({
  bannerMode: 'idle' as string,
  execution: null as any,
  errorMessage: '' as string,
  dateRange: { from: '', to: '' },
  checksData: null as Record<string, any[]> | null,
  checksWarningKeys: [] as string[],
})

const store = vi.hoisted(() => ({
  appConfig: { parameters: { enableHistoricalKpis: true } },
  historicalState: {
    bannerMode: 'idle' as string,
    execution: null as any,
    errorMessage: '' as string,
    dateRange: { from: '', to: '' },
    checksData: null as Record<string, any[]> | null,
    checksWarningKeys: [] as string[],
  },
  runHistoricalKpiFlow: vi.fn().mockResolvedValue(undefined),
  clearHistoricalExecution: vi.fn(),
}))

vi.mock('@/stores/general', () => ({
  useGeneralStore: () => store,
}))

import HistoricalDataToggle from '@/components/HistoricalDataToggle.vue'

const vuetify = createVuetify({ components, directives })

const createWrapper = () => {
  const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: {} } })
  return mount(HistoricalDataToggle, {
    global: { plugins: [vuetify, i18n] },
  })
}

describe('HistoricalDataToggle', () => {
  let wrapper: any

  beforeEach(() => {
    vi.clearAllMocks()
    store.appConfig = { parameters: { enableHistoricalKpis: true } }
    store.historicalState = makeHistorical()
  })

  afterEach(() => {
    if (wrapper) wrapper.unmount()
  })

  describe('enabled gating', () => {
    test('renders nothing when feature disabled', () => {
      store.appConfig = { parameters: { enableHistoricalKpis: false } }
      wrapper = createWrapper()
      expect(wrapper.find('.historical-toggle').exists()).toBe(false)
    })

    test('renders root when feature enabled', () => {
      wrapper = createWrapper()
      expect(wrapper.find('.historical-toggle').exists()).toBe(true)
    })

    test('enabled handles missing appConfig parameters gracefully', () => {
      store.appConfig = {} as any
      wrapper = createWrapper()
      expect(wrapper.vm.enabled).toBe(false)
    })
  })

  describe('computed: isLoading', () => {
    test('true for creating / data_check / polling', () => {
      wrapper = createWrapper()
      store.historicalState.bannerMode = 'creating'
      expect(wrapper.vm.isLoading).toBe(true)
      store.historicalState.bannerMode = 'data_check'
      expect(wrapper.vm.isLoading).toBe(true)
      store.historicalState.bannerMode = 'polling'
      expect(wrapper.vm.isLoading).toBe(true)
    })

    test('false for idle', () => {
      wrapper = createWrapper()
      store.historicalState.bannerMode = 'idle'
      expect(wrapper.vm.isLoading).toBe(false)
    })
  })

  describe('computed: canLoad', () => {
    test('false when dates empty', () => {
      wrapper = createWrapper()
      expect(wrapper.vm.canLoad).toBe(false)
    })

    test('true when both dates present and not loading', async () => {
      wrapper = createWrapper()
      wrapper.vm.mode = 'historical'
      wrapper.vm.dateFrom = '2024-01-01'
      wrapper.vm.dateTo = '2024-02-01'
      await wrapper.vm.$nextTick()
      expect(wrapper.vm.canLoad).toBe(true)
    })

    test('false when loading even with dates', async () => {
      store.historicalState.bannerMode = 'polling'
      wrapper = createWrapper()
      wrapper.vm.dateFrom = '2024-01-01'
      wrapper.vm.dateTo = '2024-02-01'
      await wrapper.vm.$nextTick()
      expect(wrapper.vm.canLoad).toBe(false)
    })
  })

  describe('computed: statusMessage and statusClass', () => {
    test('creating message', () => {
      store.historicalState.bannerMode = 'creating'
      wrapper = createWrapper()
      expect(wrapper.vm.statusMessage).toBe('historical.creating')
      expect(wrapper.vm.statusClass).toBe('info-text')
    })

    test('data_check message', () => {
      store.historicalState.bannerMode = 'data_check'
      wrapper = createWrapper()
      expect(wrapper.vm.statusMessage).toBe('historical.checking')
    })

    test('polling message', () => {
      store.historicalState.bannerMode = 'polling'
      wrapper = createWrapper()
      expect(wrapper.vm.statusMessage).toBe('historical.polling')
    })

    test('error uses store error message when set', () => {
      store.historicalState.bannerMode = 'error'
      store.historicalState.errorMessage = 'It broke'
      wrapper = createWrapper()
      expect(wrapper.vm.statusMessage).toBe('It broke')
      expect(wrapper.vm.statusClass).toBe('error-text')
    })

    test('error falls back to generic key when no message', () => {
      store.historicalState.bannerMode = 'error'
      store.historicalState.errorMessage = ''
      wrapper = createWrapper()
      expect(wrapper.vm.statusMessage).toBe('historical.error')
    })

    test('null for idle', () => {
      wrapper = createWrapper()
      expect(wrapper.vm.statusMessage).toBeNull()
    })
  })

  describe('watchers', () => {
    test('emits update:isHistorical when mode changes', async () => {
      wrapper = createWrapper()
      wrapper.vm.mode = 'historical'
      await wrapper.vm.$nextTick()
      expect(wrapper.emitted('update:isHistorical')).toBeTruthy()
      expect(wrapper.emitted('update:isHistorical')![0]).toEqual([true])
    })

    test('bannerMode -> done with execution switches to historical and syncs dates', async () => {
      wrapper = createWrapper()
      store.historicalState.execution = { id: 1 }
      store.historicalState.dateRange = { from: '2024-03-01', to: '2024-03-31' }
      store.historicalState.bannerMode = 'done'
      await wrapper.vm.$nextTick()
      expect(wrapper.vm.mode).toBe('historical')
      expect(wrapper.vm.dateFrom).toBe('2024-03-01')
      expect(wrapper.vm.dateTo).toBe('2024-03-31')
    })

    test('bannerMode -> checks_error switches to historical and collapses checks', async () => {
      wrapper = createWrapper()
      store.historicalState.dateRange = { from: '2024-04-01', to: '2024-04-30' }
      store.historicalState.bannerMode = 'checks_error'
      await wrapper.vm.$nextTick()
      expect(wrapper.vm.mode).toBe('historical')
      expect(wrapper.vm.checksExpanded).toBe(false)
    })

    test('bannerMode -> idle resets to execution mode', async () => {
      store.historicalState.execution = { id: 1 }
      store.historicalState.bannerMode = 'done'
      wrapper = createWrapper()
      wrapper.vm.dateFrom = '2024-01-01'
      await wrapper.vm.$nextTick()
      store.historicalState.bannerMode = 'idle'
      await wrapper.vm.$nextTick()
      expect(wrapper.vm.mode).toBe('execution')
      expect(wrapper.vm.dateFrom).toBe('')
    })
  })

  describe('methods', () => {
    test('loadHistorical calls store flow with current dates', async () => {
      wrapper = createWrapper()
      wrapper.vm.dateFrom = '2024-01-01'
      wrapper.vm.dateTo = '2024-02-01'
      await wrapper.vm.loadHistorical()
      expect(store.runHistoricalKpiFlow).toHaveBeenCalledWith(
        '2024-01-01',
        '2024-02-01',
      )
    })

    test('clearHistorical resets state and calls store clear', () => {
      wrapper = createWrapper()
      wrapper.vm.mode = 'historical'
      wrapper.vm.dateFrom = '2024-01-01'
      wrapper.vm.clearHistorical()
      expect(store.clearHistoricalExecution).toHaveBeenCalled()
      expect(wrapper.vm.mode).toBe('execution')
      expect(wrapper.vm.dateFrom).toBe('')
      expect(wrapper.vm.checksExpanded).toBe(false)
    })

    test('formatCheckTableName humanizes snake_case', () => {
      wrapper = createWrapper()
      expect(wrapper.vm.formatCheckTableName('some_table_name')).toBe(
        'Some Table Name',
      )
    })

    test('isWarningTable detects keys present in warning list', () => {
      store.historicalState.checksWarningKeys = ['warn_table']
      wrapper = createWrapper()
      expect(wrapper.vm.isWarningTable('warn_table')).toBe(true)
      expect(wrapper.vm.isWarningTable('other')).toBe(false)
    })

    test('isWarningTable returns false when keys not an array', () => {
      store.historicalState.checksWarningKeys = null as any
      wrapper = createWrapper()
      expect(wrapper.vm.isWarningTable('x')).toBe(false)
    })
  })

  describe('created sync', () => {
    test('syncs to historical on created when done with execution', () => {
      store.historicalState.bannerMode = 'done'
      store.historicalState.execution = { id: 1 }
      store.historicalState.dateRange = { from: '2024-05-01', to: '2024-05-31' }
      wrapper = createWrapper()
      expect(wrapper.vm.mode).toBe('historical')
      expect(wrapper.vm.dateFrom).toBe('2024-05-01')
    })
  })

  describe('rendering', () => {
    test('shows historical date controls when mode is historical', async () => {
      wrapper = createWrapper()
      wrapper.vm.mode = 'historical'
      await wrapper.vm.$nextTick()
      expect(wrapper.find('.date-controls').exists()).toBe(true)
    })

    test('shows active chip in done mode', async () => {
      store.historicalState.bannerMode = 'done'
      wrapper = createWrapper()
      await wrapper.vm.$nextTick()
      expect(wrapper.find('.historical-active-chip').exists()).toBe(true)
    })

    test('shows checks_error alert with table sections', async () => {
      store.historicalState.bannerMode = 'checks_error'
      store.historicalState.checksData = {
        bad_table: [{ col1: 'a', col2: 'b' }],
      }
      wrapper = createWrapper()
      wrapper.vm.checksExpanded = true
      await wrapper.vm.$nextTick()
      expect(wrapper.find('.checks-error-alert').exists()).toBe(true)
      expect(wrapper.find('.checks-table-section').exists()).toBe(true)
    })

    test('shows checks_warning alert with warning + error table icons', async () => {
      store.historicalState.execution = { id: 1 }
      store.historicalState.bannerMode = 'checks_warning'
      store.historicalState.checksData = {
        warn_table: [{ a: 1 }],
        err_table: [{ b: 2 }],
      }
      store.historicalState.checksWarningKeys = ['warn_table']
      wrapper = createWrapper()
      wrapper.vm.checksExpanded = true
      await wrapper.vm.$nextTick()
      expect(wrapper.find('.checks-error-alert').exists()).toBe(true)
      const sections = wrapper.findAll('.checks-table-section')
      expect(sections.length).toBe(2)
      // active chip also shows for checks_warning
      expect(wrapper.find('.historical-active-chip').exists()).toBe(true)
    })

    test('expands and collapses checks via show/hide buttons', async () => {
      store.historicalState.bannerMode = 'checks_error'
      store.historicalState.checksData = { t: [{ a: 1 }] }
      wrapper = createWrapper()
      await wrapper.vm.$nextTick()
      expect(wrapper.vm.checksExpanded).toBe(false)

      const showBtn = wrapper
        .findAll('button')
        .find((b: any) => b.text() === 'historical.showErrors')
      await showBtn.trigger('click')
      expect(wrapper.vm.checksExpanded).toBe(true)

      const hideBtn = wrapper
        .findAll('button')
        .find((b: any) => b.text() === 'historical.hideErrors')
      await hideBtn.trigger('click')
      expect(wrapper.vm.checksExpanded).toBe(false)
    })

    test('shows clear button when historical execution active and clears on click', async () => {
      store.historicalState.execution = { id: 1 }
      store.historicalState.bannerMode = 'done'
      wrapper = createWrapper()
      await wrapper.vm.$nextTick()
      const clearBtn = wrapper
        .findAll('button')
        .find((b: any) => b.text() === 'historical.clear')
      expect(clearBtn).toBeTruthy()
      await clearBtn.trigger('click')
      expect(store.clearHistoricalExecution).toHaveBeenCalled()
    })

    test('shows progress bar while loading', async () => {
      store.historicalState.bannerMode = 'polling'
      wrapper = createWrapper()
      await wrapper.vm.$nextTick()
      expect(wrapper.find('.v-progress-linear').exists()).toBe(true)
    })
  })
})
