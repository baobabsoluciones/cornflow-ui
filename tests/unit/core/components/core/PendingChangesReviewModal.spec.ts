import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import PendingChangesReviewModal from '@cornflow-ui/core/components/core/PendingChangesReviewModal.vue'
import { useTableChanges } from '@cornflow-ui/core/composables/useTableChanges'

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

    test('shows empty state when there are no changes', () => {
      const wrapper = createWrapper()
      expect(wrapper.find('.pending-changes-modal__empty').exists()).toBe(true)
    })

    test('renders a panel per table when changes exist', () => {
      tableChanges.recordCreate('my_table', { name: 'X' }, 'My Table')
      const wrapper = createWrapper()
      expect(wrapper.find('.pending-changes-modal__panel').exists()).toBe(true)
    })
  })

  describe('helpers (added)', () => {
    test('formatValue handles null, boolean, object, and truncation', () => {
      const wrapper = createWrapper()
      expect(wrapper.vm.formatValue(null)).toBe('-')
      expect(wrapper.vm.formatValue(undefined)).toBe('-')
      expect(wrapper.vm.formatValue(true)).toContain('S')
      expect(wrapper.vm.formatValue(false)).toContain('No')
      expect(wrapper.vm.formatValue({ a: 1 })).toBe('{"a":1}')
      const long = 'x'.repeat(60)
      expect(wrapper.vm.formatValue(long).endsWith('...')).toBe(true)
    })

    test('getInputTypeForHeader maps schema types to html input types', () => {
      const wrapper = createWrapper()
      expect(wrapper.vm.getInputTypeForHeader({ type: 'date' })).toBe('date')
      expect(wrapper.vm.getInputTypeForHeader({ type: 'datetime' })).toBe(
        'datetime-local',
      )
      expect(wrapper.vm.getInputTypeForHeader({ type: 'time' })).toBe('time')
      expect(wrapper.vm.getInputTypeForHeader({ type: 'number' })).toBe('number')
      expect(wrapper.vm.getInputTypeForHeader({})).toBe('text')
    })

    test('getVisibleHeaders filters id/selection/_id/foreign-key/hidden', () => {
      const wrapper = createWrapper({
        tableHeaders: {
          my_table: [
            { key: 'id', title: 'ID' },
            { key: 'selection', title: '' },
            { key: 'building_id', title: 'Building Id' },
            { key: 'fk', title: 'FK', isForeignKey: true },
            { key: 'hid', title: 'Hidden', hidden: true },
            { key: 'name', title: 'Name' },
          ],
        },
      })
      const visible = wrapper.vm.getVisibleHeaders('my_table')
      expect(visible.map((h: any) => h.key)).toEqual(['name'])
    })

    test('isFieldModified and getFieldOldValue read the field list', () => {
      const wrapper = createWrapper()
      const rowGroup = {
        fields: [{ fieldKey: 'name', oldValue: 'old', newValue: 'new' }],
      }
      expect(wrapper.vm.isFieldModified(rowGroup, 'name')).toBe(true)
      expect(wrapper.vm.isFieldModified(rowGroup, 'other')).toBe(false)
      expect(wrapper.vm.getFieldOldValue(rowGroup, 'name')).toBe('old')
    })

    test('getRowFieldValue prefers modified value then row data', () => {
      const wrapper = createWrapper({
        rowsData: { my_table: { '1': { name: 'fromRow' } } },
      })
      const rowGroup = {
        fields: [{ fieldKey: 'name', oldValue: 'o', newValue: 'modified' }],
      }
      expect(wrapper.vm.getRowFieldValue('my_table', '1', 'name', rowGroup)).toBe(
        'modified',
      )
      const emptyGroup = { fields: [] }
      expect(
        wrapper.vm.getRowFieldValue('my_table', '1', 'name', emptyGroup),
      ).toBe('fromRow')
    })
  })

  describe('totalChangesCount + save text (added)', () => {
    test('saveText/saveIcon fall back to defaults', () => {
      const wrapper = createWrapper()
      expect(wrapper.vm.saveText).toBe('pendingChanges.saveAllChanges')
      expect(wrapper.vm.saveIcon).toBe('mdi-content-save-all')
    })

    test('saveText/saveIcon honor props', () => {
      const wrapper = createWrapper({
        saveButtonText: 'Apply',
        saveButtonIcon: 'mdi-check',
      })
      expect(wrapper.vm.saveText).toBe('Apply')
      expect(wrapper.vm.saveIcon).toBe('mdi-check')
    })

    test('counts creates/deletes when filtered by tableKeysFilter', () => {
      tableChanges.recordCreate('my_table', { name: 'X' }, 'My Table')
      const wrapper = createWrapper({ tableKeysFilter: ['my_table'] })
      expect(wrapper.vm.totalChangesCount).toBe(1)
    })
  })

  describe('handlers + emits (added)', () => {
    test('toggleFullscreen flips the flag', () => {
      const wrapper = createWrapper()
      expect(wrapper.vm.isFullscreen).toBe(false)
      wrapper.vm.toggleFullscreen()
      expect(wrapper.vm.isFullscreen).toBe(true)
    })

    test('handleClose emits close and update:modelValue false', () => {
      const wrapper = createWrapper()
      wrapper.vm.handleClose()
      expect(wrapper.emitted('close')).toBeTruthy()
      expect(wrapper.emitted('update:modelValue')![0]).toEqual([false])
    })

    test('handleSaveAll emits save with grouped changes', () => {
      tableChanges.recordChange(
        'my_table',
        '1',
        'name',
        'old',
        'new',
        'My Table',
      )
      const wrapper = createWrapper({
        rowsData: { my_table: { '1': { id: 1, name: 'old' } } },
      })
      wrapper.vm.handleSaveAll()
      expect(wrapper.emitted('save')).toBeTruthy()
    })

    test('clearValidationError emits clear-validation-error', () => {
      const wrapper = createWrapper()
      wrapper.vm.clearValidationError()
      expect(wrapper.emitted('clear-validation-error')).toBeTruthy()
    })

    test('handleRevertAll opens confirm; confirmRevertAll clears and emits', () => {
      tableChanges.recordCreate('my_table', { name: 'X' }, 'My Table')
      const wrapper = createWrapper()
      wrapper.vm.handleRevertAll()
      expect(wrapper.vm.showRevertAllConfirm).toBe(true)
      wrapper.vm.confirmRevertAll()
      expect(wrapper.vm.showRevertAllConfirm).toBe(false)
      expect(wrapper.emitted('revert-all')).toBeTruthy()
    })

    test('revertRowChanges emits revert-row', () => {
      const wrapper = createWrapper()
      wrapper.vm.revertRowChanges('my_table', '1')
      expect(wrapper.emitted('revert-row')![0]).toEqual(['my_table', '1'])
    })
  })

  describe('validation error rendering (added)', () => {
    test('renders validation error alert when prop set', () => {
      const wrapper = createWrapper({ validationError: '<b>bad</b>' })
      expect(wrapper.html()).toContain('bad')
    })

    test('renders processing alert when saving', () => {
      tableChanges.recordCreate('my_table', { name: 'X' }, 'My Table')
      const wrapper = createWrapper({ saving: true })
      expect(
        wrapper.find('.pending-changes-modal__processing-alert').exists(),
      ).toBe(true)
    })
  })

  describe('edited and deleted row rendering (added)', () => {
    test('renders an edited row block with old/new value cells', () => {
      tableChanges.recordChange(
        'my_table',
        '1',
        'name',
        'Old Name',
        'New Name',
        'My Table',
      )
      const wrapper = createWrapper({
        rowsData: { my_table: { '1': { id: 1, name: 'Old Name' } } },
      })
      expect(wrapper.find('.pending-changes-modal__row--edited').exists()).toBe(
        true,
      )
      expect(wrapper.find('.pending-changes-modal__old-val').text()).toContain(
        'Old Name',
      )
    })

    test('renders a deleted row block with row data', () => {
      tableChanges.recordDelete('my_table', '5', { id: 5, name: 'Doomed' })
      const wrapper = createWrapper({
        rowsData: { my_table: { '5': { id: 5, name: 'Doomed' } } },
      })
      expect(wrapper.find('.pending-changes-modal__row--deleted').exists()).toBe(
        true,
      )
      expect(wrapper.text()).toContain('Doomed')
    })

    test('deleted row without data falls back to ID display', () => {
      tableChanges.recordDelete('my_table', '7')
      const wrapper = createWrapper()
      const deletedBlock = wrapper.find('.pending-changes-modal__row--deleted')
      expect(deletedBlock.exists()).toBe(true)
      expect(deletedBlock.text()).toContain('7')
    })
  })

  describe('create field display + update (added)', () => {
    test('handleUpdateCreate records the create field change', () => {
      tableChanges.recordCreate('my_table', { name: '' }, 'My Table')
      const created = tableChanges.getFullGroupedChanges()[0].creates[0]
      const wrapper = createWrapper()
      wrapper.vm.handleUpdateCreate('my_table', created.tempId, 'name', 'Typed')
      const after = tableChanges.getFullGroupedChanges()[0].creates[0]
      expect(after.data.name).toBe('Typed')
    })

    test('getCreateFieldDisplayValue returns the raw value when no joinFrom', () => {
      const wrapper = createWrapper()
      const result = wrapper.vm.getCreateFieldDisplayValue(
        { data: { name: 'Plain' } },
        { key: 'name' },
      )
      expect(result).toBe('Plain')
    })

    test('getCreateFieldDisplayValue resolves joinFrom display value', () => {
      const wrapper = createWrapper({
        tableData: { buildings: [{ id: 10, name: 'Tower' }] },
      })
      const result = wrapper.vm.getCreateFieldDisplayValue(
        { data: { building_id: 10 } },
        {
          key: 'building_name',
          joinFrom: 'buildings.name',
          foreignKeyField: 'building_id',
        },
      )
      expect(result).toBe('Tower')
    })
  })
})
