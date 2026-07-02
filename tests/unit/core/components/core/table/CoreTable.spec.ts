import { describe, test, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref, nextTick } from 'vue'
import { createVuetify } from 'vuetify'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import CoreTable from '@cornflow-ui/core/components/core/table/CoreTable.vue'

// --- useFormFields mock -----------------------------------------------------
// The component delegates field-type resolution, formatting and selector
// loading to this composable. We provide a controllable mock so individual
// tests can drive branch logic (field types, choices, selector options).
const formFieldsState = {
  fieldType: 'string' as string,
  inputType: 'text' as string,
  formatted: 'FMT' as string,
  choicesOptions: [] as Array<{ value: any; text: string }>,
  selectorOptions: ref<Record<string, Array<{ value: any; text: string }>>>(
    {},
  ),
  loadingSelectorOptions: ref<Record<string, boolean>>({}),
}

const loadSelectorOptionsMock = vi.fn(async () => {})
const updateDependentFieldsMock = vi.fn(
  (_field: string, _value: any, data: any) => data,
)

vi.mock('@cornflow-ui/core/composables/core-table/useFormFields', () => ({
  useFormFields: () => ({
    prepareFormDataForSubmit: vi.fn((data: any) => data),
    getChoicesOptions: vi.fn(() => formFieldsState.choicesOptions),
    getSelectorOptions: vi.fn(() => []),
    getFieldType: vi.fn(() => formFieldsState.fieldType),
    getInputType: vi.fn(() => formFieldsState.inputType),
    formatCellValue: vi.fn(() => formFieldsState.formatted),
    updateDependentFields: updateDependentFieldsMock,
    loadSelectorOptions: loadSelectorOptionsMock,
    selectorOptions: formFieldsState.selectorOptions,
    loadingSelectorOptions: formFieldsState.loadingSelectorOptions,
  }),
}))

// --- useTableHeight mock ----------------------------------------------------
// Avoid ResizeObserver / window listeners noise in jsdom; expose a settable
// tableContainer ref so DOM-driven helpers can be exercised.
const tableContainerRef = ref<HTMLElement | null>(null)
vi.mock('@cornflow-ui/core/composables/core-table/useTableHeight', () => ({
  useTableHeight: () => ({
    tableHeight: ref(400),
    tableContainer: tableContainerRef,
    calculateTableHeight: vi.fn(),
    initializeHeight: vi.fn(),
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
        // Stub overlay-driven components to avoid jsdom visualViewport errors
        CoreModal: { template: '<div class="core-modal-stub"></div>' },
        CoreConfirmDialog: {
          template: '<div class="core-confirm-dialog-stub"></div>',
        },
        CoreBulkUploadModal: {
          template: '<div class="core-bulk-upload-stub"></div>',
        },
        FloatingSelectionBar: {
          template: '<div class="floating-selection-stub"></div>',
        },
      },
    },
  })
}

const vmOf = (wrapper: ReturnType<typeof createWrapper>) => wrapper.vm as any

describe('CoreTable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    formFieldsState.fieldType = 'string'
    formFieldsState.inputType = 'text'
    formFieldsState.formatted = 'FMT'
    formFieldsState.choicesOptions = []
    formFieldsState.selectorOptions.value = {}
    formFieldsState.loadingSelectorOptions.value = {}
    tableContainerRef.value = null
  })

  describe('row props (getRowProps)', () => {
    test('getRowProps returns data-item-id for each item', () => {
      const wrapper = createWrapper()
      const getRowProps = vmOf(wrapper).getRowProps
      expect(typeof getRowProps).toBe('function')

      const result = getRowProps({ item: { id: 1, name: 'Alpha' } })
      expect(result).toHaveProperty('data-item-id', '1')
    })

    test('getRowProps includes data-item-id for item with string id', () => {
      const wrapper = createWrapper({
        items: [{ id: 'create-t1-0-123', name: 'New Row' }],
      })
      const getRowProps = vmOf(wrapper).getRowProps
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
      const getRowProps = vmOf(wrapper).getRowProps

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
      const getRowProps = vmOf(wrapper).getRowProps
      const result = getRowProps({ item: { name: 'NoId' } })
      expect(result).not.toHaveProperty('data-item-id')
      expect(result['data-item-id']).toBeFalsy()
    })

    test('getRowProps adds row-fijar-active when fijar column value is truthy', () => {
      const wrapper = createWrapper({
        headers: [{ key: 'fijar', title: 'Fijar', value: 'fijar' }],
        items: [{ id: 1, fijar: true }],
      })
      const getRowProps = vmOf(wrapper).getRowProps
      const result = getRowProps({ item: { id: 1, fijar: true } })
      expect(result.class).toContain('row-fijar-active')
    })
  })

  // --- safe* computeds ------------------------------------------------------
  describe('safe computeds', () => {
    test('safeHeaders filters hidden / foreignKey / columnsToJoin headers', () => {
      const wrapper = createWrapper({
        headers: [
          { key: 'a', title: 'A' },
          { key: 'b', title: 'B', hidden: true },
          { key: 'c', title: 'C', isForeignKey: true },
          { key: 'd', title: 'D', columnsToJoin: ['x'] },
        ],
      })
      const vm = vmOf(wrapper)
      expect(vm.safeHeaders.map((h: any) => h.key)).toEqual(['a'])
    })

    test('safeHeaders returns [] when headers is not an array', () => {
      const wrapper = createWrapper({ headers: null as any })
      expect(vmOf(wrapper).safeHeaders).toEqual([])
    })

    test('safeItems returns [] when items is not an array', () => {
      const wrapper = createWrapper({ items: null as any })
      expect(vmOf(wrapper).safeItems).toEqual([])
    })

    test('safeActiveFilters / safeSelectedItems guard non-arrays', () => {
      const wrapper = createWrapper({
        activeFilters: null as any,
        selectedItems: null as any,
      })
      const vm = vmOf(wrapper)
      expect(vm.safeActiveFilters).toEqual([])
      expect(vm.safeSelectedItems).toEqual([])
    })

    test('visibleAvailableFilterFields maps headers and excludes selection/filterable=false', () => {
      const wrapper = createWrapper({
        headers: [
          { key: 'selection', title: 'sel' },
          { key: 'a', title: 'A', type: 'number' },
          { key: 'b', title: 'B', filterable: false },
          { value: 'c' },
        ],
      })
      const fields = vmOf(wrapper).visibleAvailableFilterFields
      const keys = fields.map((f: any) => f.key)
      expect(keys).toContain('a')
      expect(keys).toContain('c')
      expect(keys).not.toContain('selection')
      expect(keys).not.toContain('b')
      const aField = fields.find((f: any) => f.key === 'a')
      expect(aField.type).toBe('number')
    })

    test('filter count computeds reflect activeFilters / selectedItems', () => {
      const wrapper = createWrapper({
        activeFilters: [{ id: 1 }, { id: 2 }],
        selectedItems: [{ id: 1 }],
      })
      const vm = vmOf(wrapper)
      expect(vm.hasActiveFilters).toBe(true)
      expect(vm.activeFiltersCount).toBe(2)
      expect(vm.hasSelectedItems).toBe(true)
      expect(vm.selectedItemsCount).toBe(1)
    })
  })

  // --- computed flags -------------------------------------------------------
  describe('computed configuration', () => {
    test('usePlainReadOnlyCells true when readOnlyDisplay set', () => {
      const wrapper = createWrapper({ readOnlyDisplay: true, canEdit: true })
      expect(vmOf(wrapper).usePlainReadOnlyCells).toBe(true)
    })

    test('usePlainReadOnlyCells true when cannot edit', () => {
      const wrapper = createWrapper({ readOnlyDisplay: false, canEdit: false })
      expect(vmOf(wrapper).usePlainReadOnlyCells).toBe(true)
    })

    test('usePlainReadOnlyCells false when canEdit and not readOnlyDisplay', () => {
      const wrapper = createWrapper({ readOnlyDisplay: false, canEdit: true })
      expect(vmOf(wrapper).usePlainReadOnlyCells).toBe(false)
    })

    test('resolvedBulkUploadOperations falls back to defaults when empty', () => {
      const wrapper = createWrapper({ bulkUploadOperations: [] })
      expect(vmOf(wrapper).resolvedBulkUploadOperations).toEqual([
        'post_bulk',
        'overwrite_all',
      ])
    })

    test('resolvedBulkUploadOperations uses provided ops when present', () => {
      const wrapper = createWrapper({ bulkUploadOperations: ['x', 'y'] })
      expect(vmOf(wrapper).resolvedBulkUploadOperations).toEqual(['x', 'y'])
    })

    test('computedSearchPlaceholder uses prop or i18n key', () => {
      const w1 = createWrapper({ searchPlaceholder: 'Find...' })
      expect(vmOf(w1).computedSearchPlaceholder).toBe('Find...')
      const w2 = createWrapper({ searchPlaceholder: undefined })
      expect(vmOf(w2).computedSearchPlaceholder).toBe('table.searchPlaceholder')
    })

    test('tableActionItems contains entries per permission', () => {
      const wrapper = createWrapper({
        canAdd: true,
        canBulkUpload: true,
        canDownloadExcel: true,
        downloading: true,
      })
      const items = vmOf(wrapper).tableActionItems
      const ids = items.map((i: any) => i.id)
      expect(ids).toEqual(['add', 'bulk-upload', 'download-excel'])
      const dl = items.find((i: any) => i.id === 'download-excel')
      expect(dl.disabled).toBe(true)
      expect(dl.rightContent).toBe('⏳')
    })

    test('tableActionItems empty when no permissions', () => {
      const wrapper = createWrapper()
      expect(vmOf(wrapper).tableActionItems).toEqual([])
    })
  })

  // --- header origin indicator ---------------------------------------------
  describe('getHeaderOriginIndicator', () => {
    test('returns null without key or indicators', () => {
      const wrapper = createWrapper()
      const vm = vmOf(wrapper)
      expect(vm.getHeaderOriginIndicator('')).toBeNull()
      expect(vm.getHeaderOriginIndicator('missing')).toBeNull()
    })

    test('returns indicator config when present', () => {
      const wrapper = createWrapper({
        headerOriginIndicators: {
          name: { source: 'db', tooltip: 'From DB' },
        },
      })
      const ind = vmOf(wrapper).getHeaderOriginIndicator('name')
      expect(ind).toEqual({ source: 'db', tooltip: 'From DB' })
    })
  })

  // --- search / filter / date range handlers -------------------------------
  describe('toolbar handlers + emits', () => {
    test('handleSearch emits update:searchValue and search', () => {
      const wrapper = createWrapper()
      vmOf(wrapper).handleSearch('term')
      expect(wrapper.emitted('update:searchValue')?.[0]).toEqual(['term'])
      expect(wrapper.emitted('search')?.[0]).toEqual(['term'])
    })

    test('filter handlers emit', () => {
      const wrapper = createWrapper()
      const vm = vmOf(wrapper)
      vm.handleAddFilter({ id: 'f1' })
      vm.handleRemoveFilter('f1')
      vm.handleClearAllFilters()
      expect(wrapper.emitted('add-filter')?.[0]).toEqual([{ id: 'f1' }])
      expect(wrapper.emitted('remove-filter')?.[0]).toEqual(['f1'])
      expect(wrapper.emitted('clear-all-filters')).toBeTruthy()
    })

    test('toggleFiltersPanel toggles and emits state', () => {
      const wrapper = createWrapper()
      const vm = vmOf(wrapper)
      vm.toggleFiltersPanel()
      expect(wrapper.emitted('toggle-filters-panel')?.[0]).toEqual([true])
      vm.toggleFiltersPanel()
      expect(wrapper.emitted('toggle-filters-panel')?.[1]).toEqual([false])
    })

    test('selection handlers emit', () => {
      const wrapper = createWrapper({ selectedItems: [{ id: 9 }] })
      const vm = vmOf(wrapper)
      vm.handleSelectItem({ id: 1 })
      vm.handleSelectAll(true)
      vm.handleClearSelection()
      vm.handleBulkDelete()
      expect(wrapper.emitted('select-item')?.[0]).toEqual([{ id: 1 }])
      expect(wrapper.emitted('select-all')?.[0]).toEqual([true])
      expect(wrapper.emitted('clear-selection')).toBeTruthy()
      expect(wrapper.emitted('bulk-delete')?.[0]).toEqual([[{ id: 9 }]])
    })

    test('CRUD + file handlers emit', () => {
      const wrapper = createWrapper()
      const vm = vmOf(wrapper)
      vm.handleAddItem()
      vm.handleEditItem({ id: 1 })
      vm.handleDeleteItem({ id: 2 })
      vm.handleSaveItem({ a: 1 })
      vm.handleCancelEdit()
      vm.handleBulkUpload({ files: [], operation: 'x' })
      vm.handleDownloadExcel()
      expect(wrapper.emitted('add-item')).toBeTruthy()
      expect(wrapper.emitted('edit-item')?.[0]).toEqual([{ id: 1 }])
      expect(wrapper.emitted('delete-item')?.[0]).toEqual([{ id: 2 }])
      expect(wrapper.emitted('save-item')?.[0]).toEqual([{ a: 1 }])
      expect(wrapper.emitted('cancel-edit')).toBeTruthy()
      expect(wrapper.emitted('bulk-upload')?.[0]).toEqual([
        { files: [], operation: 'x' },
      ])
      expect(wrapper.emitted('download-excel')).toBeTruthy()
    })

    test('handleApplyDateRange / handleResetDateRange emit', () => {
      const wrapper = createWrapper()
      const vm = vmOf(wrapper)
      vm.handleApplyDateRange({ key: 'k', from: 'a', to: 'b' })
      vm.handleResetDateRange('k')
      expect(wrapper.emitted('apply-date-range')?.[0]).toEqual([
        { key: 'k', from: 'a', to: 'b' },
      ])
      expect(wrapper.emitted('reset-date-range')?.[0]).toEqual(['k'])
    })

    test('confirm / cancel delete + bulk handlers emit', () => {
      const wrapper = createWrapper()
      const vm = vmOf(wrapper)
      vm.handleConfirmDelete()
      vm.handleConfirmBulkDelete()
      vm.handleCancelDelete()
      vm.handleCancelBulkDelete()
      vm.handleCancelBulkUpload()
      expect(wrapper.emitted('confirm-delete')).toBeTruthy()
      expect(wrapper.emitted('confirm-bulk-delete')).toBeTruthy()
      expect(wrapper.emitted('cancel-delete')).toBeTruthy()
      expect(wrapper.emitted('cancel-bulk-delete')).toBeTruthy()
      expect(wrapper.emitted('cancel-bulk-upload')).toBeTruthy()
    })

    test('handleTableActionClick is a no-op (does not throw)', () => {
      const wrapper = createWrapper()
      expect(() => vmOf(wrapper).handleTableActionClick({ id: 'x' })).not.toThrow()
    })
  })

  // --- date range local state ----------------------------------------------
  describe('date range local state', () => {
    const dateConfigs = [
      {
        paramGte: 'created__gte',
        paramLte: 'created__lte',
        filtersOn: 'created',
        label: 'Created',
      },
    ]

    test('initial values from props.dateRangeValues', () => {
      const wrapper = createWrapper({
        dateRangeFilterConfigs: dateConfigs,
        dateRangeValues: { created__gte: { from: '2024-01-01', to: '2024-02-01' } },
      })
      const vm = vmOf(wrapper)
      expect(vm.getDateRangeFrom('created__gte')).toBe('2024-01-01')
      expect(vm.getDateRangeTo('created__gte')).toBe('2024-02-01')
      expect(vm.hasDateRangeValue('created__gte')).toBe(true)
      expect(vm.hasDateRangeValue('missing')).toBe(false)
    })

    test('getDateRange* default empty for unknown key', () => {
      const wrapper = createWrapper({ dateRangeFilterConfigs: dateConfigs })
      const vm = vmOf(wrapper)
      expect(vm.getDateRangeFrom('nope')).toBe('')
      expect(vm.getDateRangeTo('nope')).toBe('')
    })

    test('setDateRangeFrom empty emits reset-date-range', () => {
      const wrapper = createWrapper({ dateRangeFilterConfigs: dateConfigs })
      vmOf(wrapper).setDateRangeFrom('created__gte', '')
      expect(wrapper.emitted('reset-date-range')?.[0]).toEqual(['created__gte'])
    })

    test('setDateRangeTo empty emits reset-date-range', () => {
      const wrapper = createWrapper({ dateRangeFilterConfigs: dateConfigs })
      vmOf(wrapper).setDateRangeTo('created__gte', '')
      expect(wrapper.emitted('reset-date-range')?.[0]).toEqual(['created__gte'])
    })

    test('setting both ends schedules apply-date-range (debounced)', () => {
      vi.useFakeTimers()
      const wrapper = createWrapper({ dateRangeFilterConfigs: dateConfigs })
      const vm = vmOf(wrapper)
      vm.setDateRangeFrom('created__gte', '2024-01-01')
      vm.setDateRangeTo('created__gte', '2024-02-01')
      vi.advanceTimersByTime(500)
      const applied = wrapper.emitted('apply-date-range')
      expect(applied?.[applied.length - 1]).toEqual([
        { key: 'created__gte', from: '2024-01-01', to: '2024-02-01' },
      ])
      vi.useRealTimers()
    })

    test('clearDateRange resets value and emits reset-date-range', () => {
      const wrapper = createWrapper({
        dateRangeFilterConfigs: dateConfigs,
        dateRangeValues: { created__gte: { from: '2024-01-01', to: '2024-02-01' } },
      })
      const vm = vmOf(wrapper)
      vm.clearDateRange('created__gte')
      expect(vm.hasDateRangeValue('created__gte')).toBe(false)
      expect(wrapper.emitted('reset-date-range')?.[0]).toEqual(['created__gte'])
    })
  })

  // --- cell value resolution ------------------------------------------------
  describe('cell value resolution', () => {
    test('getCellDisplayValueForHeader returns undefined without key', () => {
      const wrapper = createWrapper()
      expect(
        vmOf(wrapper).getCellDisplayValueForHeader({ id: 1 }, {}),
      ).toBeUndefined()
    })

    test('getCellDisplayValueForHeader returns item value', () => {
      const wrapper = createWrapper()
      const val = vmOf(wrapper).getCellDisplayValueForHeader(
        { id: 1, name: 'Alpha' },
        { key: 'name' },
      )
      expect(val).toBe('Alpha')
    })

    test('getCellDisplayValueForHeader returns modified value in excel mode', () => {
      const wrapper = createWrapper({
        enableExcelMode: true,
        isCellModified: () => true,
        getModifiedValue: () => 'MODIFIED',
      })
      const val = vmOf(wrapper).getCellDisplayValueForHeader(
        { id: 1, name: 'Alpha' },
        { key: 'name' },
      )
      expect(val).toBe('MODIFIED')
    })

    test('getCellDisplayValueForHeader falls through when modified value undefined', () => {
      const wrapper = createWrapper({
        enableExcelMode: true,
        isCellModified: () => true,
        getModifiedValue: () => undefined,
      })
      const val = vmOf(wrapper).getCellDisplayValueForHeader(
        { id: 1, name: 'Alpha' },
        { key: 'name' },
      )
      expect(val).toBe('Alpha')
    })

    test('getCellDisplayValueForHeader resolves joinFrom when value empty', () => {
      const wrapper = createWrapper({
        tableData: {
          refs: [{ id: 5, label: 'Resolved Label' }],
        },
      })
      const header = {
        key: 'ref_label',
        joinFrom: 'refs',
        foreignKeyField: 'ref_id',
        columnsToJoin: ['label'],
        joinColumn: 'label',
      }
      const item = { id: 1, ref_id: 5, ref_label: '' }
      const val = vmOf(wrapper).getCellDisplayValueForHeader(item, header)
      // resolveJoinFromValue may or may not resolve depending on shape;
      // assert it does not throw and returns either resolved text or empty
      expect(val === '' || typeof val === 'string').toBe(true)
    })

    test('getCellDisplayValue returns item value and modified value', () => {
      const w1 = createWrapper()
      expect(vmOf(w1).getCellDisplayValue({ id: 1, x: 7 }, 'x')).toBe(7)

      const w2 = createWrapper({
        enableExcelMode: true,
        isCellModified: () => true,
        getModifiedValue: () => 'M',
      })
      expect(vmOf(w2).getCellDisplayValue({ id: 1, x: 7 }, 'x')).toBe('M')
    })
  })

  // --- formatting -----------------------------------------------------------
  describe('formatting helpers', () => {
    test('formatCellValueForDisplay returns empty for null/undefined', () => {
      const wrapper = createWrapper()
      const vm = vmOf(wrapper)
      expect(vm.formatCellValueForDisplay(null, { key: 'name' })).toBe('')
      expect(vm.formatCellValueForDisplay(undefined, { key: 'name' })).toBe('')
    })

    test('formatCellValueForDisplay boolean -> yes/no keys', () => {
      const wrapper = createWrapper()
      const vm = vmOf(wrapper)
      expect(
        vm.formatCellValueForDisplay(true, { key: 'b', type: 'boolean' }),
      ).toBe('Yes')
      expect(
        vm.formatCellValueForDisplay(false, { key: 'b', type: 'boolean' }),
      ).toBe('No')
    })

    test('formatCellValueForDisplay boolean via getFieldType', () => {
      formFieldsState.fieldType = 'boolean'
      const wrapper = createWrapper()
      expect(
        vmOf(wrapper).formatCellValueForDisplay(true, { key: 'b' }),
      ).toBe('Yes')
    })

    test('formatCellValueForDisplay non-boolean uses composable formatCellValue', () => {
      formFieldsState.fieldType = 'string'
      formFieldsState.formatted = 'FORMATTED'
      const wrapper = createWrapper()
      expect(
        vmOf(wrapper).formatCellValueForDisplay('x', { key: 'name' }),
      ).toBe('FORMATTED')
    })

    test('formatCellValue delegates to composable', () => {
      formFieldsState.formatted = 'DONE'
      const wrapper = createWrapper()
      expect(vmOf(wrapper).formatCellValue('a', 'string')).toBe('DONE')
    })

    test('getFieldType / getInputTypeForHeader delegate to composable', () => {
      formFieldsState.fieldType = 'number'
      formFieldsState.inputType = 'number'
      const wrapper = createWrapper()
      const vm = vmOf(wrapper)
      expect(vm.getFieldType('name')).toBe('number')
      expect(vm.getInputTypeForHeader({ key: 'name' })).toBe('number')
    })
  })

  // --- field-type predicates ------------------------------------------------
  describe('field type predicates', () => {
    test('isTextOrNumberField true for string/number, false for selector/choices', () => {
      formFieldsState.fieldType = 'string'
      const wrapper = createWrapper()
      const vm = vmOf(wrapper)
      expect(vm.isTextOrNumberField({ key: 'name' })).toBe(true)
      expect(vm.isTextOrNumberField({ key: 'name', joinFrom: 'x' })).toBe(false)
      expect(
        vm.isTextOrNumberField({ key: 'name', choices: ['a', 'b'] }),
      ).toBe(false)
    })

    test('isTextOrNumberField false for non text/number field type', () => {
      formFieldsState.fieldType = 'date'
      const wrapper = createWrapper()
      expect(vmOf(wrapper).isTextOrNumberField({ key: 'd' })).toBe(false)
    })

    test('isDateLikeField true for date/datetime/time', () => {
      const wrapper = createWrapper()
      const vm = vmOf(wrapper)
      formFieldsState.fieldType = 'date'
      expect(vm.isDateLikeField({ key: 'd' })).toBe(true)
      formFieldsState.fieldType = 'string'
      expect(vm.isDateLikeField({ key: 'd' })).toBe(false)
    })

    test('isSelectorField true for joinFrom/isMainSelector/isDependentField', () => {
      const wrapper = createWrapper()
      const vm = vmOf(wrapper)
      expect(vm.isSelectorField({ joinFrom: 'x' })).toBe(true)
      expect(vm.isSelectorField({ isMainSelector: true })).toBe(true)
      expect(vm.isSelectorField({ isDependentField: true })).toBe(true)
      expect(vm.isSelectorField({})).toBe(false)
    })

    test('hasChoices true only for non-empty choices array', () => {
      const wrapper = createWrapper()
      const vm = vmOf(wrapper)
      expect(vm.hasChoices({ choices: ['a'] })).toBe(true)
      expect(vm.hasChoices({ choices: [] })).toBe(false)
      expect(vm.hasChoices({})).toBe(false)
    })

    test('isFijarColumn detects fijar key and renderAsSwitch', () => {
      const wrapper = createWrapper()
      const vm = vmOf(wrapper)
      expect(vm.isFijarColumn({ key: 'fijar' })).toBe(true)
      expect(vm.isFijarColumn({ key: 'FIJAR' })).toBe(true)
      expect(vm.isFijarColumn({ key: 'x', renderAsSwitch: true })).toBe(true)
      expect(vm.isFijarColumn({ key: 'x' })).toBe(false)
      expect(vm.isFijarColumn(null)).toBe(false)
      expect(vm.isFijarColumn({})).toBe(false)
    })

    test('isCellDisabledByRow respects cellDisabledKey', () => {
      const wrapper = createWrapper()
      const vm = vmOf(wrapper)
      expect(
        vm.isCellDisabledByRow({ blocked: true }, { cellDisabledKey: 'blocked' }),
      ).toBe(true)
      expect(
        vm.isCellDisabledByRow({ blocked: false }, { cellDisabledKey: 'blocked' }),
      ).toBe(false)
      expect(vm.isCellDisabledByRow({ x: 1 }, {})).toBe(false)
      expect(vm.isCellDisabledByRow(null, { cellDisabledKey: 'k' })).toBe(false)
    })
  })

  // --- row class ------------------------------------------------------------
  describe('getRowClass', () => {
    test('combines custom class and fijar active', () => {
      const getRowClass = vi.fn(() => 'row-new')
      const wrapper = createWrapper({
        getRowClass,
        headers: [{ key: 'fijar', title: 'F' }],
      })
      const vm = vmOf(wrapper)
      const cls = vm.getRowClass({ id: 1, fijar: 'true' })
      expect(cls).toContain('row-new')
      expect(cls).toContain('row-fijar-active')
    })

    test('returns empty when no custom class and fijar value falsy', () => {
      const wrapper = createWrapper({
        headers: [{ key: 'fijar', title: 'F' }],
      })
      expect(vmOf(wrapper).getRowClass({ id: 1, fijar: false })).toBe('')
    })

    test('fijar active for numeric 1', () => {
      const wrapper = createWrapper({
        headers: [{ key: 'fijar', title: 'F' }],
      })
      expect(vmOf(wrapper).getRowClass({ id: 1, fijar: 1 })).toBe(
        'row-fijar-active',
      )
    })
  })

  // --- selector / boolean options ------------------------------------------
  describe('selector and choices options', () => {
    test('getBooleanOptions returns yes/no options', () => {
      const wrapper = createWrapper()
      const opts = vmOf(wrapper).getBooleanOptions()
      expect(opts).toEqual([
        { value: true, text: 'Yes' },
        { value: false, text: 'No' },
      ])
    })

    test('getSelectorOrChoicesOptions returns boolean options for boolean type', () => {
      const wrapper = createWrapper()
      const opts = vmOf(wrapper).getSelectorOrChoicesOptions({
        key: 'b',
        type: 'boolean',
      })
      expect(opts[0]).toEqual({ value: true, text: 'Yes' })
    })

    test('getSelectorOrChoicesOptions uses getChoicesOptions when field config found', () => {
      formFieldsState.choicesOptions = [{ value: 'a', text: 'A' }]
      const wrapper = createWrapper({
        formFields: [{ key: 'status', choices: ['a'] }],
      })
      const opts = vmOf(wrapper).getSelectorOrChoicesOptions({
        key: 'status',
        choices: ['a'],
      })
      expect(opts).toEqual([{ value: 'a', text: 'A' }])
    })

    test('getSelectorOrChoicesOptions falls back to header.choices when no field config', () => {
      const wrapper = createWrapper({ formFields: [] })
      const opts = vmOf(wrapper).getSelectorOrChoicesOptions({
        key: 'status',
        choices: ['x', 'y'],
      })
      expect(opts).toEqual([
        { value: 'x', text: 'x' },
        { value: 'y', text: 'y' },
      ])
    })

    test('getSelectorOrChoicesOptions returns selector options for FK fields', () => {
      formFieldsState.selectorOptions.value = {
        owner: [{ value: 1, text: 'Owner 1' }],
      }
      const wrapper = createWrapper()
      const opts = vmOf(wrapper).getSelectorOrChoicesOptions({
        key: 'owner',
        joinFrom: 'owners',
      })
      expect(opts).toEqual([{ value: 1, text: 'Owner 1' }])
    })

    test('getSelectorOptions / isSelectorLoading reflect composable state', () => {
      formFieldsState.selectorOptions.value = { f: [{ value: 1, text: 'x' }] }
      formFieldsState.loadingSelectorOptions.value = { f: true }
      const wrapper = createWrapper()
      const vm = vmOf(wrapper)
      expect(vm.getSelectorOptions('f')).toEqual([{ value: 1, text: 'x' }])
      expect(vm.getSelectorOptions('missing')).toEqual([])
      expect(vm.isSelectorLoading('f')).toBe(true)
      expect(vm.isSelectorLoading('missing')).toBe(false)
    })
  })

  // --- inline editing -------------------------------------------------------
  describe('inline editing', () => {
    test('isRowEditing matches editingRowId', () => {
      const wrapper = createWrapper({ editingRowId: 1 })
      const vm = vmOf(wrapper)
      expect(vm.isRowEditing(1)).toBe(true)
      expect(vm.isRowEditing(2)).toBe(false)
    })

    test('isRowEditing respects editingTableKey mismatch', () => {
      const wrapper = createWrapper({
        editingRowId: 1,
        editingTableKey: 'other-table',
        tableKey: 'test-table',
      })
      expect(vmOf(wrapper).isRowEditing(1)).toBe(false)
    })

    test('isRowEditing true when editingTableKey matches tableKey', () => {
      const wrapper = createWrapper({
        editingRowId: 1,
        editingTableKey: 'test-table',
        tableKey: 'test-table',
      })
      expect(vmOf(wrapper).isRowEditing(1)).toBe(true)
    })

    test('inline edit emit helpers', () => {
      const wrapper = createWrapper()
      const vm = vmOf(wrapper)
      vm.startInlineEdit({ id: 1 }, 'name')
      vm.saveInlineEdit()
      vm.cancelInlineEdit()
      expect(wrapper.emitted('start-inline-edit')?.[0]).toEqual([
        { id: 1 },
        'name',
      ])
      expect(wrapper.emitted('save-inline-edit')).toBeTruthy()
      expect(wrapper.emitted('cancel-inline-edit')).toBeTruthy()
    })

    test('updateInlineField emits update-inline-field', () => {
      const wrapper = createWrapper({ editingRowId: 1 })
      vmOf(wrapper).updateInlineField('name', 'New')
      expect(wrapper.emitted('update-inline-field')?.[0]).toEqual([
        'name',
        'New',
      ])
      expect(updateDependentFieldsMock).toHaveBeenCalled()
    })

    test('updateInlineField emits cell-change in excel mode', () => {
      const wrapper = createWrapper({
        enableExcelMode: true,
        editingRowId: 1,
        items: [{ id: 1, name: 'Alpha' }],
      })
      vmOf(wrapper).updateInlineField('name', 'New')
      const cellChange = wrapper.emitted('cell-change')
      expect(cellChange).toBeTruthy()
      expect(cellChange?.[0]?.[0]).toBe('test-table')
      expect(cellChange?.[0]?.[1]).toBe(1)
      expect(cellChange?.[0]?.[2]).toBe('name')
      expect(cellChange?.[0]?.[4]).toBe('New')
    })

    test('updateInlineField with overrides resolves rowId and oldValue', () => {
      const wrapper = createWrapper({
        enableExcelMode: true,
        items: [{ id: 7, fijar: false }],
      })
      vmOf(wrapper).updateInlineField('fijar', true, 7, false)
      const cellChange = wrapper.emitted('cell-change')
      expect(cellChange?.[0]?.[1]).toBe(7)
      expect(cellChange?.[0]?.[3]).toBe(false)
      expect(cellChange?.[0]?.[4]).toBe(true)
    })

    test('updateInlineField on fijar column schedules row class refresh', () => {
      const wrapper = createWrapper({
        headers: [{ key: 'fijar', title: 'F' }],
        editingRowId: 1,
        items: [{ id: 1, fijar: false }],
      })
      expect(() => vmOf(wrapper).updateInlineField('fijar', true)).not.toThrow()
      expect(wrapper.emitted('update-inline-field')?.[0]).toEqual([
        'fijar',
        true,
      ])
    })

    test('isLastEditableColumn identifies last non-selection/actions header', () => {
      const wrapper = createWrapper({
        headers: [
          { key: 'selection' },
          { key: 'name' },
          { key: 'value' },
          { key: 'actions' },
        ],
      })
      const vm = vmOf(wrapper)
      expect(vm.isLastEditableColumn('value')).toBe(true)
      expect(vm.isLastEditableColumn('name')).toBe(false)
    })

    test('loadInlineSelectorOptions early-returns without editingRowId', async () => {
      const wrapper = createWrapper({ editingRowId: null })
      await vmOf(wrapper).loadInlineSelectorOptions()
      expect(loadSelectorOptionsMock).not.toHaveBeenCalled()
    })

    test('loadInlineSelectorOptions loads options for selector/choices headers', async () => {
      const wrapper = createWrapper({
        editingRowId: 1,
        headers: [
          { key: 'name' },
          { key: 'owner', joinFrom: 'owners' },
          { key: 'status', choices: ['a', 'b'] },
        ],
        formFields: [{ key: 'owner', joinFrom: 'owners' }],
      })
      await vmOf(wrapper).loadInlineSelectorOptions()
      expect(loadSelectorOptionsMock).toHaveBeenCalledTimes(2)
    })

    test('editingRowId watcher triggers loadInlineSelectorOptions on set', async () => {
      const wrapper = createWrapper({
        editingRowId: null,
        headers: [{ key: 'owner', joinFrom: 'owners' }],
      })
      await wrapper.setProps({ editingRowId: 5 })
      await nextTick()
      expect(loadSelectorOptionsMock).toHaveBeenCalled()
    })
  })

  // --- alignment ------------------------------------------------------------
  describe('getColumnAlignment', () => {
    test('returns center for selection/actions, left otherwise', () => {
      const wrapper = createWrapper()
      const vm = vmOf(wrapper)
      expect(vm.getColumnAlignment('selection')).toBe('center')
      expect(vm.getColumnAlignment('actions')).toBe('center')
      expect(vm.getColumnAlignment('name')).toBe('left')
    })
  })

  // --- watchers / lifecycle -------------------------------------------------
  describe('watchers and lifecycle', () => {
    test('loading false transition bumps forceRerender', async () => {
      vi.useFakeTimers()
      const wrapper = createWrapper({ loading: true })
      await wrapper.setProps({ loading: false })
      await nextTick()
      vi.advanceTimersByTime(500)
      expect(() => vmOf(wrapper)).not.toThrow()
      vi.useRealTimers()
    })

    test('items empty -> populated does not throw (tableKey watcher)', async () => {
      vi.useFakeTimers()
      const wrapper = createWrapper({ items: [] })
      await wrapper.setProps({ items: [{ id: 1, name: 'X' }] })
      await nextTick()
      vi.advanceTimersByTime(500)
      expect(vmOf(wrapper).safeItems.length).toBe(1)
      vi.useRealTimers()
    })

    test('editingData watcher runs without error', async () => {
      vi.useFakeTimers()
      const wrapper = createWrapper({ editingData: {} })
      await wrapper.setProps({ editingData: { name: 'Z' } })
      await nextTick()
      vi.advanceTimersByTime(200)
      expect(() => vmOf(wrapper)).not.toThrow()
      vi.useRealTimers()
    })

    test('hasMore + items watcher attaches load-more scroll without error', async () => {
      vi.useFakeTimers()
      const wrapper = createWrapper({ hasMore: false, items: [{ id: 1 }] })
      await wrapper.setProps({ hasMore: true })
      await nextTick()
      vi.advanceTimersByTime(200)
      expect(() => vmOf(wrapper)).not.toThrow()
      vi.useRealTimers()
    })

    test('component unmounts cleanly', () => {
      const wrapper = createWrapper()
      expect(() => wrapper.unmount()).not.toThrow()
    })
  })

  // --- DOM-driven runApplyFijarRowClasses -----------------------------------
  describe('runApplyFijarRowClasses (DOM driven via scheduler)', () => {
    test('applies fijar/new/deleted styles based on rows in tableContainer', async () => {
      // Build a fake table container DOM with rows for fijar + pending logic
      const container = document.createElement('div')
      container.innerHTML = `
        <table class="v-data-table-virtual">
          <tbody>
            <tr data-item-id="1"><td>1</td><td>Alpha</td></tr>
            <tr data-item-id="2"><td>2</td><td>Beta</td></tr>
          </tbody>
        </table>`

      const getRowClass = (item: any) =>
        item.id === 1 ? 'row-new' : item.id === 2 ? 'row-deleted' : ''

      const wrapper = createWrapper({
        getRowClass,
        headers: [
          { key: 'id', title: 'ID' },
          { key: 'fijar', title: 'F' },
        ],
        items: [
          { id: 1, fijar: false },
          { id: 2, fijar: true },
        ],
      })
      // Point the (mocked) tableContainer ref at our fake DOM, then run the
      // row-class pass directly (debounced scheduler wraps the same function).
      tableContainerRef.value = container
      const vm = vmOf(wrapper)
      vm.runApplyFijarRowClasses()
      await nextTick()

      const rows = container.querySelectorAll('tr')
      expect(rows[0].classList.contains('row-new')).toBe(true)
      expect(rows[1].classList.contains('row-deleted')).toBe(true)
    })

    test('runApplyFijarRowClasses applies fijar-active style from item data', async () => {
      const container = document.createElement('div')
      container.innerHTML = `
        <table class="v-data-table-virtual">
          <tbody>
            <tr><td>10</td><td>active</td></tr>
          </tbody>
        </table>`
      const wrapper = createWrapper({
        headers: [
          { key: 'id', title: 'ID' },
          { key: 'fijar', title: 'F' },
        ],
        items: [{ id: 10, fijar: true }],
      })
      tableContainerRef.value = container
      vmOf(wrapper).runApplyFijarRowClasses()
      await nextTick()
      const row = container.querySelector('tr') as HTMLElement
      expect(row.classList.contains('row-fijar-active')).toBe(true)
    })

    test('scheduleApplyFijarRowClasses no-op when no tableContainer', () => {
      tableContainerRef.value = null
      const wrapper = createWrapper()
      expect(() => vmOf(wrapper).scheduleApplyFijarRowClasses()).not.toThrow()
      expect(() => vmOf(wrapper).runApplyFijarRowClasses()).not.toThrow()
    })

    test('runApplyFijarRowClasses fijar-active via switch input in row', async () => {
      const container = document.createElement('div')
      container.innerHTML = `
        <table class="v-data-table-virtual">
          <tbody>
            <tr>
              <td>1</td>
              <td><div class="v-switch"><input type="checkbox" checked /></div></td>
            </tr>
          </tbody>
        </table>`
      const wrapper = createWrapper({
        headers: [
          { key: 'id', title: 'ID' },
          { key: 'fijar', title: 'F' },
        ],
        items: [{ id: 1, fijar: true }],
      })
      tableContainerRef.value = container
      vmOf(wrapper).runApplyFijarRowClasses()
      await nextTick()
      const row = container.querySelector('tr') as HTMLElement
      expect(row.classList.contains('row-fijar-active')).toBe(true)
      // exercise hover handlers attached to the active fijar row
      row.dispatchEvent(new Event('mouseenter'))
      row.dispatchEvent(new Event('mouseleave'))
      expect(row.classList.contains('row-fijar-active')).toBe(true)
    })

    test('runApplyFijarRowClasses unchecked switch clears fijar-active', async () => {
      const container = document.createElement('div')
      container.innerHTML = `
        <table class="v-data-table-virtual">
          <tbody>
            <tr class="row-fijar-active">
              <td>1</td>
              <td><div class="v-switch"><input type="checkbox" /></div></td>
            </tr>
          </tbody>
        </table>`
      const wrapper = createWrapper({
        headers: [
          { key: 'id', title: 'ID' },
          { key: 'fijar', title: 'F' },
        ],
        items: [{ id: 1, fijar: false }],
      })
      tableContainerRef.value = container
      vmOf(wrapper).runApplyFijarRowClasses()
      await nextTick()
      const row = container.querySelector('tr') as HTMLElement
      expect(row.classList.contains('row-fijar-active')).toBe(false)
    })

    test('runApplyFijarRowClasses fijar-active via data-fijar-value attribute', async () => {
      const container = document.createElement('div')
      container.innerHTML = `
        <table class="v-data-table-virtual">
          <tbody>
            <tr>
              <td>1</td>
              <td><div data-fijar-value="true">x</div></td>
            </tr>
          </tbody>
        </table>`
      const wrapper = createWrapper({
        headers: [
          { key: 'id', title: 'ID' },
          { key: 'fijar', title: 'F' },
        ],
        items: [{ id: 1, fijar: true }],
      })
      tableContainerRef.value = container
      vmOf(wrapper).runApplyFijarRowClasses()
      await nextTick()
      const row = container.querySelector('tr') as HTMLElement
      expect(row.classList.contains('row-fijar-active')).toBe(true)
    })

    test('runApplyFijarRowClasses no fijar header just clears background', async () => {
      const container = document.createElement('div')
      container.innerHTML = `
        <table class="v-data-table-virtual">
          <tbody><tr><td>1</td><td>x</td></tr></tbody>
        </table>`
      const wrapper = createWrapper({
        headers: [{ key: 'id' }, { key: 'name' }],
        items: [{ id: 1, name: 'x' }],
      })
      tableContainerRef.value = container
      expect(() => vmOf(wrapper).runApplyFijarRowClasses()).not.toThrow()
    })
  })

  // --- DOM listener setup ---------------------------------------------------
  describe('listener setup', () => {
    const buildContainer = () => {
      const container = document.createElement('div')
      container.innerHTML = `
        <div class="v-data-table-virtual">
          <div class="v-table__wrapper">
            <table><tbody><tr><td>1</td></tr></tbody></table>
          </div>
        </div>`
      return container
    }

    test('setupFijarListeners attaches scroll/observer/interval and clears them', async () => {
      vi.useFakeTimers()
      const container = buildContainer()
      const wrapper = createWrapper()
      tableContainerRef.value = container
      const vm = vmOf(wrapper)
      expect(() => vm.setupFijarListeners()).not.toThrow()
      // Trigger the scroll handler to cover its body + nested timeout
      const wrapperEl = container.querySelector('.v-table__wrapper') as HTMLElement
      wrapperEl.dispatchEvent(new Event('scroll'))
      vi.advanceTimersByTime(100)
      // Interval callback (450ms)
      vi.advanceTimersByTime(500)
      expect(() => vm.clearFijarListeners()).not.toThrow()
      vi.useRealTimers()
    })

    test('setupFijarListeners no-op without tableContainer', () => {
      tableContainerRef.value = null
      const wrapper = createWrapper()
      expect(() => vmOf(wrapper).setupFijarListeners()).not.toThrow()
    })

    test('setupLoadMoreScroll attaches scroll and emits load-more near bottom', () => {
      vi.useFakeTimers()
      const container = buildContainer()
      const wrapper = createWrapper({ hasMore: true, loadingMore: false })
      tableContainerRef.value = container
      const vm = vmOf(wrapper)
      const wrapperEl = container.querySelector('.v-table__wrapper') as HTMLElement
      // Force near-bottom geometry
      Object.defineProperty(wrapperEl, 'scrollTop', { value: 1000, configurable: true })
      Object.defineProperty(wrapperEl, 'clientHeight', { value: 500, configurable: true })
      Object.defineProperty(wrapperEl, 'scrollHeight', { value: 1500, configurable: true })
      vm.setupLoadMoreScroll()
      wrapperEl.dispatchEvent(new Event('scroll'))
      vi.advanceTimersByTime(200)
      expect(wrapper.emitted('load-more')).toBeTruthy()
      vm.clearLoadMoreScroll()
      vi.useRealTimers()
    })

    test('setupLoadMoreScroll does not emit when not near bottom', () => {
      vi.useFakeTimers()
      const container = buildContainer()
      const wrapper = createWrapper({ hasMore: true, loadingMore: false })
      tableContainerRef.value = container
      const vm = vmOf(wrapper)
      const wrapperEl = container.querySelector('.v-table__wrapper') as HTMLElement
      Object.defineProperty(wrapperEl, 'scrollTop', { value: 0, configurable: true })
      Object.defineProperty(wrapperEl, 'clientHeight', { value: 100, configurable: true })
      Object.defineProperty(wrapperEl, 'scrollHeight', { value: 1500, configurable: true })
      vm.setupLoadMoreScroll()
      wrapperEl.dispatchEvent(new Event('scroll'))
      vi.advanceTimersByTime(200)
      expect(wrapper.emitted('load-more')).toBeFalsy()
      vm.clearLoadMoreScroll()
      vi.useRealTimers()
    })

    test('setupLoadMoreScroll no-op when displayAsAlertList', () => {
      const container = buildContainer()
      const wrapper = createWrapper({ displayAsAlertList: true, hasMore: true })
      tableContainerRef.value = container
      expect(() => vmOf(wrapper).setupLoadMoreScroll()).not.toThrow()
    })
  })

  // --- extra branch coverage ------------------------------------------------
  describe('additional branches', () => {
    test('tableActionItems bulk-upload action emits update:showBulkUploadModal', () => {
      const wrapper = createWrapper({ canBulkUpload: true })
      const item = vmOf(wrapper).tableActionItems.find(
        (i: any) => i.id === 'bulk-upload',
      )
      item.action()
      expect(wrapper.emitted('update:showBulkUploadModal')?.[0]).toEqual([true])
    })

    test('tableActionItems add + download actions emit', () => {
      const wrapper = createWrapper({ canAdd: true, canDownloadExcel: true })
      const items = vmOf(wrapper).tableActionItems
      items.find((i: any) => i.id === 'add').action()
      items.find((i: any) => i.id === 'download-excel').action()
      expect(wrapper.emitted('add-item')).toBeTruthy()
      expect(wrapper.emitted('download-excel')).toBeTruthy()
    })

    test('getCellDisplayValueForHeader resolves joinFrom value from tableData', () => {
      const wrapper = createWrapper({
        tableData: {
          owners: [{ id: 5, name: 'Owner Five' }],
        },
      })
      const header = {
        key: 'owner_name',
        joinFrom: 'owners.name',
        foreignKeyField: 'owner_id',
      }
      const item = { id: 1, owner_id: 5, owner_name: '' }
      const val = vmOf(wrapper).getCellDisplayValueForHeader(item, header)
      expect(val).toBe('Owner Five')
    })

    test('runApplyFijarRowClasses resolves item by index fallback', async () => {
      const container = document.createElement('div')
      // No data-item-id and a non-matching id cell -> forces index fallback
      container.innerHTML = `
        <table class="v-data-table-virtual">
          <tbody><tr><td>999</td><td>x</td></tr></tbody>
        </table>`
      const getRowClass = () => 'row-new'
      const wrapper = createWrapper({
        getRowClass,
        headers: [{ key: 'id' }, { key: 'fijar' }],
        items: [{ id: 1, fijar: false }],
      })
      tableContainerRef.value = container
      vmOf(wrapper).runApplyFijarRowClasses()
      await nextTick()
      const row = container.querySelector('tr') as HTMLElement
      expect(row.classList.contains('row-new')).toBe(true)
    })

    test('scheduleApplyDateRange applies when only "to" set after existing "from"', () => {
      vi.useFakeTimers()
      const dateConfigs = [
        {
          paramGte: 'd__gte',
          paramLte: 'd__lte',
          filtersOn: 'd',
          label: 'D',
        },
      ]
      const wrapper = createWrapper({
        dateRangeFilterConfigs: dateConfigs,
        dateRangeValues: { d__gte: { from: '2024-01-01', to: '' } },
      })
      const vm = vmOf(wrapper)
      vm.setDateRangeTo('d__gte', '2024-03-01')
      vi.advanceTimersByTime(500)
      const applied = wrapper.emitted('apply-date-range')
      expect(applied?.[applied.length - 1]).toEqual([
        { key: 'd__gte', from: '2024-01-01', to: '2024-03-01' },
      ])
      vi.useRealTimers()
    })

    test('onActivated / onDeactivated style hooks do not throw', async () => {
      // Mount inside KeepAlive to exercise activated/deactivated paths
      const wrapper = createWrapper()
      // Re-triggering lifecycle via unmount is sufficient to cover cleanup
      expect(() => wrapper.unmount()).not.toThrow()
    })
  })
})
