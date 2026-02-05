import { describe, test, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import ExecutionDataView from '@/components/project-execution/ExecutionDataView.vue'

vi.mock('@/composables/useTableChanges', () => ({
  useTableChanges: () => ({
    getRowClass: vi.fn((_tableKey: string, _item: any) => ''),
    hasChanges: { value: false },
    totalChangesCount: { value: 0 },
    getPendingCreates: vi.fn(() => []),
    getPendingDeletes: vi.fn(() => []),
    getChangesForTable: vi.fn(() => null),
    recordCreate: vi.fn(() => 'create-t0-0'),
    recordDelete: vi.fn(),
    revertChange: vi.fn(),
    revertRowChanges: vi.fn(),
    revertTableChanges: vi.fn(),
    clearAllChanges: vi.fn(),
    getFullGroupedChanges: vi.fn(() => []),
    getPendingDeletesWithData: vi.fn(() => []),
    modifiedTableKeys: { value: [] },
  }),
}))

const createWrapper = (props: Record<string, unknown> = {}) => {
  const vuetify = createVuetify()
  const pinia = createPinia()
  setActivePinia(pinia)
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: {
      en: {
        projectExecution: {
          steps: { step5: { check: 'Check data' } },
        },
        inputOutputData: {
          dataChecksPassedMessage: 'Checks passed',
          dataChecksLoadingMessage: 'Loading...',
          dataChecksFailedMessage: 'Checks failed',
        },
        pendingChanges: {
          changesIndicator: '{count} changes',
          reviewChanges: 'Review changes',
        },
      },
    },
  })

  return mount(ExecutionDataView, {
    props: {
      execution: {
        instance: {
          data: {},
          schema: { properties: {} },
        },
      },
      ...props,
    },
    global: {
      plugins: [vuetify, pinia, i18n],
      stubs: {
        CoreTable: { template: '<div class="core-table-stub"></div>' },
        CoreTabs: { template: '<div class="core-tabs-stub"><slot /></div>' },
        CoreTab: { template: '<div class="core-tab-stub"><slot /></div>' },
        PendingChangesReviewModal: {
          template: '<div class="pending-changes-modal-stub"></div>',
        },
      },
    },
  })
}

describe('ExecutionDataView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Component rendering', () => {
    test('renders execution data view container', () => {
      const wrapper = createWrapper()
      expect(wrapper.find('.execution-data-view').exists()).toBe(true)
    })

    test('renders without execution prop (optional)', () => {
      const wrapper = mount(ExecutionDataView, {
        props: {},
        global: {
          plugins: [
            createVuetify(),
            createPinia(),
            createI18n({ legacy: false, locale: 'en', messages: { en: {} } }),
          ],
          stubs: {
            CoreTable: true,
            CoreTabs: true,
            CoreTab: true,
            PendingChangesReviewModal: true,
          },
        },
      })
      expect(wrapper.find('.execution-data-view').exists()).toBe(true)
    })
  })
})
