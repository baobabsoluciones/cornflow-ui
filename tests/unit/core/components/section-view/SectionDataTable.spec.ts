import { describe, test, expect, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { ref } from 'vue'
import SectionDataTable from '@cornflow-ui/core/components/section-view/SectionDataTable.vue'
import { createEnI18n } from '../core/data-table/i18nEn'

const makeTableData = (overrides: Record<string, any> = {}) => ({
  items: ref<any[]>([
    { id: 1, line: 'L1', plant: 'North', plant_id: 7 },
    { id: 2, line: 'L2', plant: 'South', plant_id: 8 },
  ]),
  headers: ref<any[]>([
    { key: 'selection', title: '' },
    { key: 'line', title: 'Line', type: 'string', required: true },
    { key: 'plant', title: 'Plant', type: 'string', joinFrom: 'plants.name', isDependentField: true, isMainSelector: true, foreignKeyField: 'plant_id', valueNone: { title: 'No plant' } },
    { key: 'plant_id', title: 'Plant id', type: 'integer', isForeignKey: true, columnsToJoin: ['plant'] },
  ]),
  loading: ref(false),
  error: ref<string | null>(null),
  tableTitle: ref('Lines'),
  isPrimitiveArray: ref(false),
  isValidationMessageList: ref(false),
  enableSelection: ref(true),
  canAdd: ref(true),
  canEdit: ref(true),
  canDelete: ref(true),
  canBulkUpload: ref(true),
  bulkUploadAvailableOperations: ref(['post_bulk']),
  canDownloadExcel: ref(true),
  enableExcelMode: ref(true),
  isCellModified: vi.fn(() => false),
  getModifiedValue: vi.fn(),
  handleCellChange: vi.fn(),
  searchValue: ref(''),
  activeFilters: ref<any[]>([]),
  selectedItems: ref<any[]>([]),
  showBulkUploadModal: ref(false),
  uploading: ref(false),
  uploadProgressMessage: ref(''),
  downloading: ref(false),
  bulkDeleting: ref(false),
  loadTableData: vi.fn(async () => [{ name: 'North' }, { name: 'South' }, { name: 'North' }]),
  tableData: ref({}),
  apiDateRangeFilterConfigs: ref<any[]>([]),
  dateRangeValues: ref({}),
  hasMore: ref(false),
  loadingMore: ref(false),
  loadMore: vi.fn(),
  handleSearch: vi.fn(),
  handleApplyDateRange: vi.fn(),
  handleResetDateRange: vi.fn(),
  handleBulkUpload: vi.fn(),
  handleDownloadExcel: vi.fn(),
  loadData: vi.fn(),
  sort: ref(null),
  setFilters: vi.fn(),
  getRowState: vi.fn(() => undefined),
  addRow: vi.fn(),
  deleteRows: vi.fn(),
  restoreRows: vi.fn(),
  bulkEditRows: vi.fn(),
  isSingleRecord: ref(false),
  revertCell: vi.fn(),
  totalCount: ref<number | undefined>(undefined),
  filteredCount: ref<number | undefined>(undefined),
  ...overrides,
})

const CoreDataTableStub = {
  name: 'CoreDataTable',
  props: [
    'title', 'columns', 'rows', 'cellValue', 'status', 'filterable', 'editable', 'selectable',
    'canAdd', 'canDelete', 'selected', 'search', 'filters', 'optionsFor', 'dateRanges',
    'dateRangeValues', 'pendingCount', 'totalCount', 'filteredCount', 'uploadPhase',
  ],
  emits: [
    'update:search', 'update:filters', 'update:selected', 'cell-change', 'add-row', 'delete-rows',
    'restore-rows', 'bulk-edit', 'upload', 'download-excel', 'need-options', 'load-more', 'retry',
    'review', 'discard', 'action', 'date-range',
  ],
  template: '<div class="core-data-table-stub"><slot name="tabs" /><slot name="body" /></div>',
}
const MessageListStub = { name: 'MessageList', props: ['messages', 'level'], template: '<div class="message-list-stub" />' }
const ParametersTableStub = {
  name: 'ParametersTable',
  props: ['rows', 'readOnly'],
  emits: ['update:value', 'revert'],
  template: '<div class="parameters-table-stub" />',
}

const mountTable = (tableData = makeTableData(), props: Record<string, any> = {}) =>
  mount(SectionDataTable, {
    props: { tableData, tableKey: 'lines', ...props },
    global: {
      plugins: [createEnI18n()],
      stubs: { CoreDataTable: CoreDataTableStub, MessageList: MessageListStub, ParametersTable: ParametersTableStub },
    },
  })

const table = (wrapper: ReturnType<typeof mountTable>) => wrapper.findComponent({ name: 'CoreDataTable' })

describe('SectionDataTable', () => {
  test('columns come from the headers, without the selection and the foreign keys', () => {
    const wrapper = mountTable(makeTableData(), {
      columnSources: { line: { source: 'db', tooltip: 'From the database' } },
    })
    const columns = table(wrapper).props('columns')
    expect(columns.map((c: any) => c.key)).toEqual(['line', 'plant'])
    expect(columns[0]).toMatchObject({ title: 'Line', type: 'text', required: true, source: { kind: 'database', tooltip: 'From the database' } })
    expect(columns[1].type).toBe('reference')
    expect(table(wrapper).props('title')).toBe('Lines')
  })

  test('a list of plain values is a one-column table', () => {
    const data = makeTableData({ isPrimitiveArray: ref(true), items: ref([5, 7]) })
    const wrapper = mountTable(data)
    expect(table(wrapper).props('columns')).toEqual([{ key: 'value', title: 'Value', type: 'number' }])
    expect(table(wrapper).props('rows')).toEqual([{ id: 0, value: 5 }, { id: 1, value: 7 }])
  })

  test('a check that only returns sentences is a list of messages, without filters', () => {
    const data = makeTableData({
      isValidationMessageList: ref(true),
      items: ref([{ id: 0, message: 'Line L4 has no shifts.' }]),
    })
    const wrapper = mountTable(data, { checkLevel: 'warning' })
    const list = wrapper.findComponent({ name: 'MessageList' })
    expect(list.props('messages')).toEqual(['Line L4 has no shifts.'])
    expect(list.props('level')).toBe('warning')
    expect(table(wrapper).props('filterable')).toBe(false)
  })

  test('a table of one record is a list of its fields, edited through the cell changes', async () => {
    const data = makeTableData({
      isSingleRecord: ref(true),
      items: ref([{ id: 3, line: 'L9', plant: 'North' }]),
    })
    const wrapper = mountTable(data)
    const params = wrapper.findComponent({ name: 'ParametersTable' })
    expect(params.props('rows').map((r: any) => [r.id, r.label, r.value])).toEqual([
      ['line', 'Line', 'L9'],
      ['plant', 'Plant', 'North'],
    ])
    expect(table(wrapper).props('canAdd')).toBe(false)
    await params.vm.$emit('update:value', 'line', 'L10')
    expect(data.handleCellChange).toHaveBeenCalledWith('lines', 3, 'line', 'L9', 'L10')
    await params.vm.$emit('revert', 'line')
    expect(data.revertCell).toHaveBeenCalledWith(3, 'line')
  })

  test('status follows loading, the tab switch and errors', async () => {
    const data = makeTableData()
    const wrapper = mountTable(data)
    expect(table(wrapper).props('status')).toBe('ready')
    data.loading.value = true
    await flushPromises()
    expect(table(wrapper).props('status')).toBe('loading')
    data.loading.value = false
    data.error.value = 'boom'
    await flushPromises()
    expect(table(wrapper).props('status')).toBe('error')
    await wrapper.setProps({ switching: true })
    expect(table(wrapper).props('status')).toBe('loading')
  })

  test('editing needs Excel mode and edit rights, and not a read-only section', async () => {
    const wrapper = mountTable()
    expect(table(wrapper).props('editable')).toBe(true)
    await wrapper.setProps({ readOnly: true })
    expect(table(wrapper).props('editable')).toBe(false)
    expect(table(wrapper).props('selectable')).toBe(false)
  })

  test('the events of the table go to its table data', async () => {
    const data = makeTableData()
    const wrapper = mountTable(data)
    const t = table(wrapper)
    await t.vm.$emit('update:search', 'north')
    expect(data.handleSearch).toHaveBeenCalledWith('north')
    const filters = [{ id: 'f', field: 'line', operator: 'contains', value: 'L' }]
    await t.vm.$emit('update:filters', filters)
    expect(data.setFilters).toHaveBeenCalledWith(filters)
    await t.vm.$emit('cell-change', data.items.value[0], 'line', 'L1b')
    expect(data.handleCellChange).toHaveBeenCalledWith('lines', 1, 'line', 'L1', 'L1b')
    await t.vm.$emit('add-row', { line: 'L3' })
    expect(data.addRow).toHaveBeenCalledWith({ line: 'L3' })
    await t.vm.$emit('delete-rows', [1])
    expect(data.deleteRows).toHaveBeenCalledWith([1])
    await t.vm.$emit('restore-rows', [2])
    expect(data.restoreRows).toHaveBeenCalledWith([2])
    await t.vm.$emit('bulk-edit', [1, 2], { line: 'X' })
    expect(data.bulkEditRows).toHaveBeenCalledWith([1, 2], { line: 'X' })
    const upload = { files: [], operation: 'post_bulk' }
    await t.vm.$emit('upload', upload)
    expect(data.handleBulkUpload).toHaveBeenCalledWith(upload)
    await t.vm.$emit('download-excel')
    expect(data.handleDownloadExcel).toHaveBeenCalled()
    await t.vm.$emit('load-more')
    expect(data.loadMore).toHaveBeenCalled()
    await t.vm.$emit('retry')
    expect(data.loadData).toHaveBeenCalled()
    await t.vm.$emit('review')
    await t.vm.$emit('discard')
    expect(wrapper.emitted('review')).toHaveLength(2)
  })

  test('a cell shows its pending value when it was edited', () => {
    const data = makeTableData({
      isCellModified: vi.fn((id: number, key: string) => id === 1 && key === 'line'),
      getModifiedValue: vi.fn(() => 'L1 edited'),
    })
    const wrapper = mountTable(data)
    const cellValue = table(wrapper).props('cellValue')
    expect(cellValue(data.items.value[0], 'line')).toBe('L1 edited')
    expect(cellValue(data.items.value[1], 'line')).toBe('L2')
  })

  test('the selection is the ids of the selected items', async () => {
    const data = makeTableData()
    const wrapper = mountTable(data)
    await table(wrapper).vm.$emit('update:selected', [2])
    expect(data.selectedItems.value).toEqual([data.items.value[1]])
    await flushPromises()
    expect(table(wrapper).props('selected')).toEqual([2])
  })

  test('the options of a reference come from its table, with the "none" option first', async () => {
    const data = makeTableData()
    const wrapper = mountTable(data)
    const t = table(wrapper)
    const plant = t.props('columns')[1]
    expect(t.props('optionsFor')(plant)).toBeUndefined()
    await t.vm.$emit('need-options', plant)
    await flushPromises()
    expect(data.loadTableData).toHaveBeenCalledWith('plants')
    expect(t.props('optionsFor')(plant)).toEqual([
      { value: null, label: 'No plant' },
      { value: 'North', label: 'North' },
      { value: 'South', label: 'South' },
    ])
  })

  test('the date ranges of the table apply and reset through its table data', async () => {
    const data = makeTableData({
      apiDateRangeFilterConfigs: ref([{ paramGte: 'date_gte', paramLte: 'date_lte', label: 'Date' }]),
    })
    const wrapper = mountTable(data)
    const t = table(wrapper)
    expect(t.props('dateRanges')).toEqual([{ key: 'date_gte', label: 'Date' }])
    await t.vm.$emit('date-range', 'date_gte', { from: '2026-10-01', to: '2026-10-31' })
    expect(data.handleApplyDateRange).toHaveBeenCalledWith('date_gte', { from: '2026-10-01', to: '2026-10-31' })
    await t.vm.$emit('date-range', 'date_gte', null)
    expect(data.handleResetDateRange).toHaveBeenCalledWith('date_gte')
  })

  test('counts and the upload phase come from the table data', async () => {
    const data = makeTableData({ totalCount: ref(500), filteredCount: ref(42) })
    const wrapper = mountTable(data)
    expect(table(wrapper).props('totalCount')).toBe(500)
    expect(table(wrapper).props('filteredCount')).toBe(42)
    expect(table(wrapper).props('uploadPhase')).toBe('form')
    data.uploading.value = true
    await flushPromises()
    expect(table(wrapper).props('uploadPhase')).toBe('loading')
  })
})
