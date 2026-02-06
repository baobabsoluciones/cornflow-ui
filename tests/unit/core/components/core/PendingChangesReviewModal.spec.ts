import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import PendingChangesReviewModal from '@/components/core/PendingChangesReviewModal.vue'
import { useTableChanges } from '@/composables/useTableChanges'

const createWrapper = (props: Record<string, unknown> = {}) => {
  const vuetify = createVuetify()
  const pinia = createPinia()
  setActivePinia(pinia)
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: {
      en: {
        pendingChanges: {
          title: 'Pending changes',
          changes: 'changes',
          reviewChanges: 'Review changes',
          modifiedRows: 'modified rows',
          row: 'row',
          newRow: 'New row',
          deletedRow: 'Deleted row',
          revert: 'Revert',
          revertAll: 'Revert all',
          saveAll: 'Save all',
          cancel: 'Cancel',
        },
        sectionView: {
          exitConfirmation: {
            title: 'Unsaved changes',
            message: 'You have unsaved changes.',
            confirmButton: 'Leave',
            cancelButton: 'Stay',
          },
        },
      },
    },
  })

  return mount(PendingChangesReviewModal, {
    props: {
      modelValue: true,
      tableHeaders: {
        my_table: [
          { key: 'selection', title: '', type: 'selection' },
          { key: 'id', title: 'ID', type: 'number' },
          { key: 'name', title: 'Name', type: 'string' },
        ],
      },
      rowsData: {},
      ...props,
    },
    global: {
      plugins: [vuetify, pinia, i18n],
      stubs: {
        'v-dialog': { template: '<div class="v-dialog"><slot /></div>' },
        'v-card': { template: '<div class="v-card"><slot /></div>' },
        'v-expansion-panels': {
          template: '<div class="v-expansion-panels"><slot /></div>',
        },
        'v-expansion-panel': {
          template: '<div class="v-expansion-panel"><slot /></div>',
        },
        'v-expansion-panel-title': {
          template: '<div class="v-expansion-panel-title"><slot /></div>',
        },
        'v-expansion-panel-text': {
          template: '<div class="v-expansion-panel-text"><slot /></div>',
        },
      },
    },
  })
}

describe('PendingChangesReviewModal', () => {
  let tableChanges: ReturnType<typeof useTableChanges>

  beforeEach(() => {
    tableChanges = useTableChanges()
    tableChanges.clearAllChanges()
  })

  afterEach(() => {
    tableChanges.clearAllChanges()
  })

  describe('getVisibleHeaders (via rendered output)', () => {
    test('excludes id and selection columns from new row (creates) section', () => {
      tableChanges.recordCreate('my_table', { name: 'New Item' }, 'My Table')
      const wrapper = createWrapper()

      const createsTable = wrapper.find(
        '.pending-changes-modal__row--new .pending-changes-modal__table',
      )
      expect(createsTable.exists()).toBe(true)
      const tableHeaders = createsTable.findAll('thead th')
      const headerTexts = tableHeaders
        .map((th) => th.text().trim())
        .filter(Boolean)

      expect(headerTexts).toContain('Name')
      expect(headerTexts).not.toContain('ID')
      expect(headerTexts.filter((t) => t === '').length).toBe(0)
    })

    test('shows only data columns in creates section when headers include selection and id', () => {
      tableChanges.recordCreate(
        'my_table',
        { name: 'A', code: 'X' },
        'My Table',
      )
      const wrapper = createWrapper({
        tableHeaders: {
          my_table: [
            { key: 'selection', title: '' },
            { key: 'id', title: 'ID' },
            { key: 'name', title: 'Name' },
            { key: 'code', title: 'Code' },
          ],
        },
      })

      const dataTable = wrapper.find(
        '.pending-changes-modal__row--new .pending-changes-modal__table',
      )
      expect(dataTable.exists()).toBe(true)
      const ths = dataTable.findAll('thead th')
      const titles = ths.map((th) => th.text().trim())
      expect(titles).toContain('Name')
      expect(titles).toContain('Code')
      expect(titles).not.toContain('ID')
    })
  })

  describe('rendering', () => {
    test('renders when modelValue is true', () => {
      const wrapper = createWrapper()
      expect(wrapper.exists()).toBe(true)
    })
  })
})
