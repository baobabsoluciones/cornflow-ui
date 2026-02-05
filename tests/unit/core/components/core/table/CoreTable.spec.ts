import { describe, test, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import CoreTable from '@/components/core/table/CoreTable.vue'

vi.mock('@/composables/core-table/useFormFields', () => ({
  useFormFields: () => ({
    prepareFormDataForSubmit: vi.fn((data: any) => data),
    getChoicesOptions: vi.fn(() => []),
    getSelectorOptions: vi.fn(() => []),
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
        table: { noDataAvailable: 'No data available', yes: 'Yes', no: 'No' },
      },
    },
  })

  return mount(CoreTable, {
    props: {
      headers: [{ key: 'name', title: 'Name', value: 'name' }],
      items: [
        { id: 1, name: 'Alpha' },
        { id: 2, name: 'Beta' },
      ],
      tableKey: 'test-table',
      ...props,
    },
    global: {
      plugins: [vuetify, pinia, i18n],
      stubs: {
        CoreCheckbox: { template: '<div class="core-checkbox-stub"></div>' },
        CoreFiltersPanel: {
          template: '<div class="core-filters-panel-stub"></div>',
        },
        CoreTableInlineEdit: {
          template: '<div class="core-table-inline-edit-stub"></div>',
        },
      },
    },
  })
}

describe('CoreTable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('row props (getRowProps)', () => {
    test('getRowProps returns data-item-id for each item', () => {
      const wrapper = createWrapper()
      const getRowProps = (wrapper.vm as any).getRowProps
      expect(typeof getRowProps).toBe('function')

      const result = getRowProps({ item: { id: 1, name: 'Alpha' } })
      expect(result).toHaveProperty('data-item-id', '1')
    })

    test('getRowProps includes data-item-id for item with string id', () => {
      const wrapper = createWrapper({
        items: [{ id: 'create-t1-0-123', name: 'New Row' }],
      })
      const getRowProps = (wrapper.vm as any).getRowProps
      const result = getRowProps({
        item: { id: 'create-t1-0-123', name: 'New Row' },
      })
      expect(result).toHaveProperty('data-item-id', 'create-t1-0-123')
    })

    test('getRowProps includes custom class when getRowClass prop is provided', () => {
      const getRowClass = vi.fn((item: { id: number }) =>
        item.id === 1 ? 'row-new' : '',
      )
      const wrapper = createWrapper({ getRowClass })
      const getRowProps = (wrapper.vm as any).getRowProps

      const resultNew = getRowProps({ item: { id: 1, name: 'Alpha' } })
      expect(resultNew).toHaveProperty('class', 'row-new')
      expect(resultNew).toHaveProperty('data-item-id', '1')

      const resultOther = getRowProps({ item: { id: 2, name: 'Beta' } })
      expect(resultOther.class).toBeFalsy()
      expect(resultOther).toHaveProperty('data-item-id', '2')
    })

    test('getRowProps returns no data-item-id for item with no id when no getRowClass', () => {
      const wrapper = createWrapper({
        items: [{ name: 'NoId' }],
      })
      const getRowProps = (wrapper.vm as any).getRowProps
      const result = getRowProps({ item: { name: 'NoId' } })
      expect(result).not.toHaveProperty('data-item-id')
      expect(result['data-item-id']).toBeFalsy()
    })
  })
})
