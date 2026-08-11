import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, computed, defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'

// ─── Hoisted controllable fixtures ──────────────────────────────────────────

const route = vi.hoisted(() => ({ path: '/configuration' }))

// We let the REAL TableRepository run and mock its HTTP client (@/api/Api).
// `vi.mock` reliably applies to statically-imported deps of the SUT, so the
// repository's calls funnel through this controllable stub.
const repoCtrl = vi.hoisted(() => ({
  getListResult: [] as any[], // rows returned by GET
  rejectStatus: 0, // when >=400, dispatched calls resolve with this error status
  rejectWith: null as any, // when set, client methods reject with this error
  forceRetryContent: null as any, // content payload that triggers a force-retry offer
  calls: {} as Record<string, { url: string; data: any }[]>,
}))
;(globalThis as any).__repoCtrl = repoCtrl

function record(method: string, url: string, data: any) {
  const c = (globalThis as any).__repoCtrl
  c.calls[method] = c.calls[method] || []
  c.calls[method].push({ url, data })
  if (c.rejectWith) return Promise.reject(c.rejectWith)
  const status = c.rejectStatus || 200
  let content: any
  if (method === 'get') content = c.getListResult
  else content = c.forceRetryContent ?? { ok: true }
  return Promise.resolve({ status, content })
}

vi.mock('@cornflow-ui/core/api/Api', () => ({
  default: {
    get: (url: string) => record('get', url, null),
    post: (url: string, data: any) => record('post', url, data),
    put: (url: string, data: any) => record('put', url, data),
    remove: (url: string, _h: any, _a: any, data: any) =>
      record('delete', url, data),
  },
}))

// ─── Simple mocks ────────────────────────────────────────────────────────────

vi.mock('vue-router', () => ({ useRoute: () => route }))
vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (k: string, p?: any) => (p ? `${k}:${JSON.stringify(p)}` : k) }),
  createI18n: () => ({
    install: () => {},
    global: { t: (k: string) => k, locale: { value: 'en' } },
  }),
}))

const showSnackbar = vi.hoisted(() => vi.fn())
vi.mock('@cornflow-ui/core/services/SnackbarService', () => ({ showSnackbar }))

// useExecutionTableData fake — controllable execution data via computedRefHolder.
vi.mock('@cornflow-ui/core/composables/section-view/useExecutionTableData', () => ({
  useExecutionTableData: () => ({
    items: computedRefHolder.items,
    headers: computedRefHolder.headers,
    loading: computedRefHolder.loading,
    error: computedRefHolder.error,
    tableTitle: computedRefHolder.tableTitle,
    availableFilterFields: computedRefHolder.availableFilterFields,
    isPrimitiveArray: computedRefHolder.isPrimitiveArray,
    isValidationMessageList: computedRefHolder.isValidationMessageList,
    hasData: computedRefHolder.hasData,
    loadData: vi.fn(),
    refresh: vi.fn(),
  }),
}))

vi.mock('@cornflow-ui/core/services/FrontendAutomationService', () => ({
  getSectionType: (p: string) => {
    if (p.includes('input-data')) return 'input-data'
    if (p.includes('results')) return 'results'
    return 'configuration'
  },
  getDateRangeFilterConfigs: vi.fn(() => []),
  getDefaultListQueryParams: vi.fn(() => ({})),
  getGetListQueryParameters: vi.fn(() => []),
  getDefaultListLimit: vi.fn(() => 50),
  getListDeclaresLimitParam: vi.fn(() => false),
  getListDeclaresOffsetParam: vi.fn(() => false),
  getGlobalSearchQueryParameterName: vi.fn(() => null),
  filterTypeMatchesUiOperator: vi.fn(() => true),
  isOperationSupported: vi.fn((config: any, op: string) => !!config?.[op]),
  isValidationLikeGroup: vi.fn(
    (g: any) => typeof g === 'string' && g.toLowerCase().includes('valid'),
  ),
  // Needed by the real TableRepository (shares this mocked module).
  getOperationConfig: vi.fn((config: any, op: string) => config?.[op] || null),
}))

let storeState: any
vi.mock('@cornflow-ui/core/stores/general', () => ({ useGeneralStore: () => storeState }))
// useTableData consumes recalculation via the core controller (premium-or-inert), not the store.
vi.mock('@cornflow-ui/core/composables/section-view/useRecalculationController', () => ({
  useRecalculationController: () => storeState,
}))

// useTableChanges fake — in-memory stores keyed by table.
const changesStore = vi.hoisted(() => ({ map: {} as Record<string, any> }))
vi.mock('@cornflow-ui/core/composables/useTableChanges', () => ({
  useTableChanges: () => {
    const s = (globalThis as any).__changesStore
    const ensure = (k: string) =>
      (s.map[k] = s.map[k] || { edits: {}, creates: [], deletes: [], title: '' })
    return {
      isCellModified: (k: string, rowId: any, f: string) =>
        !!ensure(k).edits[String(rowId)]?.[f],
      getCurrentValue: (k: string, rowId: any, f: string, fallback: any) =>
        ensure(k).edits[String(rowId)]?.[f]?.newValue ?? fallback,
      recordChange: (k: string, rowId: any, f: string, _o: any, n: any) => {
        const t = ensure(k)
        t.edits[String(rowId)] = t.edits[String(rowId)] || {}
        t.edits[String(rowId)][f] = { newValue: n }
      },
      setTableTitle: (k: string, title: string) => {
        ensure(k).title = title
      },
      recordCreate: (k: string, data: any) => {
        const t = ensure(k)
        const tempId = `create-${k}-${t.creates.length}`
        // Match real shape: { tempId, data }
        t.creates.push({ tempId, data: { ...data } })
        return tempId
      },
      recordDelete: (k: string, id: any, data: any) => {
        ensure(k).deletes.push({ rowId: id, data })
      },
      isTableModified: (k: string) => Object.keys(ensure(k).edits).length > 0,
      getPendingCreates: (k: string) => ensure(k).creates,
      // Real getPendingDeletes returns rowIds only.
      getPendingDeletes: (k: string) => ensure(k).deletes.map((d: any) => d.rowId),
      getChangesForTable: (k: string) => ensure(k).edits,
      clearDeletesForTable: (k: string) => {
        ensure(k).deletes = []
      },
      clearCreatesForTable: (k: string) => {
        ensure(k).creates = []
      },
      revertTableChanges: (k: string) => {
        s.map[k] = { edits: {}, creates: [], deletes: [], title: '' }
      },
      getRowClass: (_k: string, item: any) => (item?.__new ? 'row-new' : ''),
    }
  },
}))
;(globalThis as any).__changesStore = changesStore

// useFormFields fake
vi.mock('@cornflow-ui/core/composables/core-table/useFormFields', () => ({
  useFormFields: () => ({
    prepareFormDataForSubmit: (data: any) => ({ ...data }),
    updateDependentFields: (_f: string, _v: any, data: any) => data,
  }),
}))

vi.mock('@cornflow-ui/core/utils/data_io', () => ({
  exportTableToExcel: vi.fn(async () => undefined),
}))

vi.mock('@cornflow-ui/core/utils/schemaUtils', () => ({
  parseJoinFrom: vi.fn(() => null),
  getForeignKeyFieldName: vi.fn(() => null),
  displayValueMatchesValueNone: vi.fn(() => false),
  getListResponseRowProperties: vi.fn((config: any) => config?.__rowSchema ?? null),
  normalizeGetListResponseToRows: vi.fn((data: any) =>
    Array.isArray(data) ? data : [],
  ),
  isMasterDataParameterObjectTable: vi.fn(
    (_tableKey: any, config: any) => !!config?.__paramObject,
  ),
  isParameterPropertySchemaVisible: vi.fn((prop: any) => prop?.visible !== false),
  normalizeJsonSchemaPropertyTypeForUi: vi.fn((prop: any) => prop?.type ?? 'string'),
}))

vi.mock('@cornflow-ui/core/utils/tableFilterUtils', () => ({
  getOperatorsForFieldType: vi.fn(() => ['equals']),
  getOperatorText: vi.fn((op: string) => `OP:${op}`),
  operatorNeedsValue: vi.fn(() => true),
  operatorNeedsSecondValue: vi.fn(() => false),
  generateFilterId: vi.fn(() => 'fid-1'),
  applyFiltersAndSearch: vi.fn((items: any[]) => items),
  getFilterFieldTypeFromSchemaProperty: vi.fn(() => 'string'),
}))

vi.mock('@cornflow-ui/core/utils/csvUtils', () => ({
  detectDelimiter: vi.fn(() => ','),
  parseCsvContent: vi.fn(() => [{ id: 1 }]),
}))

vi.mock('@/app/config', () => ({
  default: {
    getCore: () => ({
      parameters: {
        enableRecalculationOnMasterEdit: false,
        enableSolutionRecalculation: false,
      },
    }),
  },
}))

vi.mock('@/app/composables/useFileProcessors', () => ({
  useFileProcessors: () => ({ processors: {} }),
}))

// Holder for the execution-table-data refs (built after vue import).
const computedRefHolder: any = {}

import { ref as vref } from 'vue'
computedRefHolder.items = vref<any[]>([])
computedRefHolder.headers = vref<any[]>([])
computedRefHolder.loading = vref(false)
computedRefHolder.error = vref<string | null>(null)
computedRefHolder.tableTitle = vref('Exec')
computedRefHolder.availableFilterFields = vref<any[]>([])
computedRefHolder.isPrimitiveArray = vref(false)
computedRefHolder.isValidationMessageList = vref(false)
computedRefHolder.hasData = vref(false)

import {
  useTableData,
  invalidateTableDataCache,
  invalidateAllTableDataCaches,
} from '@cornflow-ui/core/composables/section-view/useTableData'

// ─── Mount helper ────────────────────────────────────────────────────────────

function mountTableData(
  tableConfigValue: any,
  opts: { tableKey?: string; executionType?: string | null } = {},
) {
  let api: ReturnType<typeof useTableData>
  const Comp = defineComponent({
    setup() {
      api = useTableData(
        ref(opts.tableKey ?? 'table_a'),
        computed(() => tableConfigValue),
        opts.executionType !== undefined
          ? computed(() => opts.executionType as any)
          : undefined,
      )
      return () => h('div')
    },
  })
  const wrapper = mount(Comp)
  return { api: api!, wrapper }
}

const rowSchema = {
  properties: {
    id: { title: 'ID', type: 'number' },
    name: { title: 'Name', type: 'string' },
  },
  required: ['name'],
}

const masterConfig = {
  title: 'Master Table',
  get_list: { url: '/list', http_method: 'get' },
  post_item: { url: '/post', http_method: 'post' },
  put_item: { url: '/put/{id}', http_method: 'put' },
  delete_item: { url: '/del/{id}', http_method: 'delete' },
  delete_bulk: { url: '/delbulk', http_method: 'delete' },
  __rowSchema: rowSchema,
}

// Config WITHOUT put_item so Excel mode is OFF and add/delete hit the API path.
const masterConfigNoExcel = {
  title: 'Master NoExcel',
  get_list: { url: '/list', http_method: 'get' },
  post_item: { url: '/post', http_method: 'post' },
  delete_item: { url: '/del/{id}', http_method: 'delete' },
  delete_bulk: { url: '/delbulk', http_method: 'delete' },
  __rowSchema: rowSchema,
}

beforeEach(() => {
  vi.clearAllMocks()
  route.path = '/configuration'
  storeState = {
    selectedExecution: null,
    getConfigurations: { masterData: {}, inputData: {}, resultsData: {} },
    checkPlanDataAfterMasterDataChange: vi.fn(async () => undefined),
  }
  repoCtrl.getListResult = []
  repoCtrl.rejectWith = null
  repoCtrl.rejectStatus = 0
  repoCtrl.forceRetryContent = null
  repoCtrl.calls = {}
  changesStore.map = {}
  invalidateAllTableDataCaches()
})

afterEach(() => {
  vi.useRealTimers()
})

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('cache invalidation helpers', () => {
  test('invalidateTableDataCache and invalidateAllTableDataCaches do not throw', () => {
    expect(() => invalidateTableDataCache('foo')).not.toThrow()
    expect(() => invalidateTableDataCache('')).not.toThrow()
    expect(() => invalidateAllTableDataCaches()).not.toThrow()
  })
})

describe('useTableData — master table capabilities', () => {
  test('computed capabilities reflect master config operations', () => {
    const { api } = mountTableData(masterConfig)
    expect(api.enableSearch.value).toBe(true)
    expect(api.enableFilters.value).toBe(true)
    expect(api.enableSelection.value).toBe(true)
    expect(api.enableActions.value).toBe(true)
    expect(api.canAdd.value).toBe(true)
    expect(api.canEdit.value).toBe(true)
    expect(api.canDelete.value).toBe(true)
    expect(api.canBulkUpload.value).toBe(false) // no bulk ops declared
    expect(api.canDownloadExcel.value).toBe(true)
    expect(api.searchPlaceholder.value).toBe('table.searchPlaceholder')
  })

  test('headers exclude id and build selection column', () => {
    const { api } = mountTableData(masterConfig)
    const keys = api.headers.value.map((h: any) => h.value)
    expect(keys).toContain('selection')
    expect(keys).toContain('name')
    expect(keys).not.toContain('id')
  })

  test('availableFilterFields and formFields derived from schema', () => {
    const { api } = mountTableData(masterConfig)
    expect(api.availableFilterFields.value.map((f: any) => f.key)).toContain('name')
    expect(api.formFields.value.map((f: any) => f.key)).toEqual(['name'])
  })

  test('canBulkUpload true when bulk ops supported', () => {
    const { api } = mountTableData({
      ...masterConfig,
      post_bulk: { url: '/b', http_method: 'post' },
    })
    expect(api.canBulkUpload.value).toBe(true)
    expect(api.bulkUploadAvailableOperations.value).toContain('post_bulk')
  })

  test('isParameterObjectTable disables add', () => {
    const { api } = mountTableData({ ...masterConfig, __paramObject: true })
    expect(api.canAdd.value).toBe(false)
    // handleAddItem is a no-op for param object tables
    api.handleAddItem()
    expect(api.showAddEditModal.value).toBe(false)
  })
})

describe('useTableData — filter / search / selection handlers', () => {
  test('handleAddFilter / handleRemoveFilter / handleClearAllFilters', () => {
    const { api } = mountTableData(masterConfig)
    api.handleAddFilter({ field: 'name', operator: 'equals', value: 'x' })
    expect(api.activeFilters.value).toHaveLength(1)
    expect(api.activeFilters.value[0].id).toBe('fid-1')
    // invalid filter ignored
    api.handleAddFilter(null)
    api.handleAddFilter({ field: '', operator: '' })
    expect(api.activeFilters.value).toHaveLength(1)
    api.handleRemoveFilter('fid-1')
    expect(api.activeFilters.value).toHaveLength(0)
    api.handleAddFilter({ field: 'name', operator: 'equals' })
    api.handleClearAllFilters()
    expect(api.activeFilters.value).toHaveLength(0)
  })

  test('date range handlers update dateRangeValues', () => {
    const { api } = mountTableData(masterConfig)
    api.handleApplyDateRange('created', { from: 'a', to: 'b' })
    expect(api.dateRangeValues.value.created).toEqual({ from: 'a', to: 'b' })
    api.handleResetDateRange('created')
    expect(api.dateRangeValues.value.created).toBeUndefined()
    api.handleApplyDateRange('', null as any) // no-op
    api.handleResetDateRange('') // no-op
  })

  test('selection handlers', () => {
    const { api } = mountTableData(masterConfig)
    api.items // ensure init
    const a = { id: 1 }
    api.handleSelectItem(a)
    expect(api.selectedItems.value).toHaveLength(1)
    api.handleSelectItem(a) // toggle off
    expect(api.selectedItems.value).toHaveLength(0)
    api.handleSelectAll(true)
    api.handleSelectAll(false)
    expect(api.selectedItems.value).toHaveLength(0)
    api.handleClearSelection()
    expect(api.selectedItems.value).toHaveLength(0)
  })

  test('handleSearch sets searchValue (client-side path)', () => {
    vi.useFakeTimers()
    const { api } = mountTableData(masterConfig)
    api.handleSearch('hello')
    expect(api.searchValue.value).toBe('hello')
    vi.advanceTimersByTime(300)
  })

  test('filter util passthroughs', () => {
    const { api } = mountTableData(masterConfig)
    expect(api.getOperatorsForFieldType('string')).toEqual(['equals'])
    expect(api.getOperatorText('equals')).toBe('OP:equals')
    expect(api.operatorNeedsValue('equals')).toBe(true)
    expect(api.operatorNeedsSecondValue('between')).toBe(false)
    expect(api.generateFilterId()).toBe('fid-1')
  })
})

describe('useTableData — modal open/close handlers', () => {
  test('add / edit / delete / bulk delete modal toggles', () => {
    const { api } = mountTableData(masterConfig)
    api.handleAddItem()
    expect(api.showAddEditModal.value).toBe(true)
    expect(api.isEditing.value).toBe(false)

    api.handleEditItem({ id: 5, name: 'z' })
    expect(api.isEditing.value).toBe(true)
    expect(api.formData.value).toEqual({ id: 5, name: 'z' })

    api.handleDeleteItem({ id: 5 })
    expect(api.showDeleteDialog.value).toBe(true)

    api.selectedItems.value = [{ id: 1 }]
    api.handleBulkDelete()
    expect(api.showBulkDeleteDialog.value).toBe(true)

    api.handleCancelDelete()
    expect(api.showDeleteDialog.value).toBe(false)
    api.handleCancelBulkDelete()
    expect(api.showBulkDeleteDialog.value).toBe(false)
    api.handleCancelBulkUpload()
    expect(api.showBulkUploadModal.value).toBe(false)
  })

  test('inline edit lifecycle', () => {
    const { api } = mountTableData(masterConfig)
    api.startInlineEdit({ id: 9, name: 'n' })
    expect(api.editingRowId.value).toBe(9)
    expect(api.isEditingAnyRow.value).toBe(true)
    api.updateInlineField('name', 'new')
    expect((api.editingData.value as any).name).toBe('new')
    api.cancelInlineEdit()
    expect(api.editingRowId.value).toBeNull()
  })
})

describe('useTableData — API save / delete flows', () => {
  test('handleSaveItem (add) calls createItem and reloads (non-excel)', async () => {
    const { api } = mountTableData(masterConfigNoExcel)
    api.handleAddItem()
    api.formData.value = { name: 'new' }
    await api.handleSaveItem()
    await nextTick()
    expect(repoCtrl.calls.post).toHaveLength(1)
    expect(api.saving.value).toBe(false)
  })

  test('handleSaveItem (excel mode add) stages a pending create', async () => {
    const { api } = mountTableData(masterConfig) // has put_item -> excel mode
    api.handleAddItem()
    api.formData.value = { name: 'staged' }
    await api.handleSaveItem()
    expect(repoCtrl.calls.post).toBeUndefined()
    expect(api.hasPendingChanges.value).toBe(true)
    expect(showSnackbar).toHaveBeenCalledWith('pendingChanges.changeStaged', 'success')
  })

  test('handleSaveItem surfaces error on repository reject', async () => {
    repoCtrl.rejectWith = new Error('save failed')
    const { api } = mountTableData(masterConfigNoExcel)
    api.handleAddItem()
    api.formData.value = { name: 'x' }
    await api.handleSaveItem()
    expect(showSnackbar).toHaveBeenCalledWith('save failed', 'error')
  })

  test('handleConfirmDelete calls deleteItem (non-excel)', async () => {
    const { api } = mountTableData(masterConfigNoExcel)
    api.formData.value = { id: 3 }
    await api.handleConfirmDelete()
    expect(repoCtrl.calls.delete).toHaveLength(1)
    expect(api.showDeleteDialog.value).toBe(false)
  })

  test('handleConfirmDelete in excel mode stages a delete', async () => {
    const { api } = mountTableData(masterConfig)
    api.formData.value = { id: 3 }
    await api.handleConfirmDelete()
    expect(repoCtrl.calls.delete).toBeUndefined()
    expect(api.hasPendingChanges.value).toBe(true)
  })

  test('handleConfirmDelete offers force retry on ForceRetryOfferError', async () => {
    const ffr = Object.assign(new Error('needs force'), {
      name: 'ForceRetryOfferError',
    })
    repoCtrl.rejectWith = ffr
    const { api } = mountTableData(masterConfigNoExcel)
    api.formData.value = { id: 3 }
    await api.handleConfirmDelete()
    expect(api.forceRetryOffer.value?.operation).toBe('delete_item')
  })

  test('handleConfirmBulkDelete calls deleteBulk (non-excel)', async () => {
    const { api } = mountTableData(masterConfigNoExcel)
    api.selectedItems.value = [{ id: 1 }, { id: 2 }]
    await api.handleConfirmBulkDelete()
    expect(repoCtrl.calls.delete).toHaveLength(1)
  })

  test('saveInlineEdit calls putItem', async () => {
    const { api } = mountTableData(masterConfig)
    api.startInlineEdit({ id: 7, name: 'n' })
    api.editingData.value = { id: 7, name: 'updated' }
    await api.saveInlineEdit()
    expect(repoCtrl.calls.put).toHaveLength(1)
    expect(api.editingRowId.value).toBeNull()
  })

  test('handleConfirmBulkUpload uses createBulk and reloads', async () => {
    const { api } = mountTableData({
      ...masterConfig,
      post_bulk: { url: '/postbulk', http_method: 'post' },
    })
    await api.handleConfirmBulkUpload([{ name: 'a' }])
    expect(repoCtrl.calls.post).toHaveLength(1)
    expect(repoCtrl.calls.post[0].url).toBe('/postbulk')
    expect(api.showBulkUploadModal.value).toBe(false)
    expect(showSnackbar).toHaveBeenCalledWith(
      'table.messages.bulkUploadSuccess',
      'success',
    )
  })

  test('handleConfirmBulkUpload prefers updateBulk when post_update_bulk', async () => {
    const { api } = mountTableData({
      ...masterConfig,
      post_update_bulk: { url: '/u', http_method: 'post' },
    })
    await api.handleConfirmBulkUpload([{ name: 'a' }])
    expect(repoCtrl.calls.post).toHaveLength(1)
    expect(repoCtrl.calls.post[0].url).toBe('/u')
  })

  test('handleConfirmBulkUpload no-op with empty data', async () => {
    const { api } = mountTableData(masterConfig)
    await api.handleConfirmBulkUpload([])
    expect(repoCtrl.calls.post).toBeUndefined()
  })

  test('saveAllChanges persists staged creates/deletes/edits then reloads', async () => {
    const { api } = mountTableData({
      ...masterConfig,
      post_bulk: { url: '/postbulk', http_method: 'post' },
    })
    // stage a create + an edit
    api.handleAddItem()
    api.formData.value = { name: 'c1' }
    await api.handleSaveItem()
    api.handleCellChange('table_a', 1, 'name', 'old', 'new')
    repoCtrl.getListResult = [{ id: 1, name: 'old' }]
    await api.saveAllChanges()
    expect((repoCtrl.calls.post ?? []).length).toBeGreaterThanOrEqual(1)
    expect(showSnackbar).toHaveBeenCalledWith('table.messages.itemUpdated', 'success')
  })
})

describe('useTableData — force retry', () => {
  test('acceptForceRetry for delete_item calls deleteItem with force', async () => {
    const { api } = mountTableData(masterConfig)
    api.forceRetryOffer.value = { message: 'm', operation: 'delete_item', id: 4 }
    await api.acceptForceRetry()
    expect(repoCtrl.calls.delete).toHaveLength(1)
    expect(api.forceRetryOffer.value).toBeNull()
  })

  test('rejectForceRetry clears offer', () => {
    const { api } = mountTableData(masterConfig)
    api.forceRetryOffer.value = { message: 'm', operation: 'delete_item', id: 4 }
    api.rejectForceRetry()
    expect(api.forceRetryOffer.value).toBeNull()
  })

  test('acceptForceRetry no-op when no offer', async () => {
    const { api } = mountTableData(masterConfig)
    await api.acceptForceRetry()
    expect(repoCtrl.calls.delete).toBeUndefined()
  })
})

describe('useTableData — loadData', () => {
  test('loadData fetches list and populates items', async () => {
    repoCtrl.getListResult = [{ id: 1 }, { id: 2 }]
    const { api } = mountTableData(masterConfig)
    await api.loadData()
    await nextTick()
    expect(api.items.value).toHaveLength(2)
  })

  test('loadData no-op without get_list', async () => {
    const { api } = mountTableData({ title: 'NoList' })
    await api.loadData()
    expect(repoCtrl.calls.get).toBeUndefined()
  })

  test('loadData sets error on reject', async () => {
    repoCtrl.getListResult = []
    repoCtrl.rejectWith = new Error('list failed')
    const { api } = mountTableData(masterConfig)
    await api.loadData()
    await nextTick()
    expect(api.error.value).toBe('Failed to load data')
  })

  test('cancelLoadData increments load token without throwing', () => {
    const { api } = mountTableData(masterConfig)
    expect(() => api.cancelLoadData()).not.toThrow()
  })
})

describe('useTableData — Excel download', () => {
  test('handleDownloadExcel for master table calls exporter', async () => {
    const dataIo = await import('@cornflow-ui/core/utils/data_io')
    repoCtrl.getListResult = [{ id: 1, name: 'a' }]
    const { api } = mountTableData(masterConfig)
    await api.handleDownloadExcel()
    expect(dataIo.exportTableToExcel).toHaveBeenCalled()
  })
})

describe('useTableData — execution data mode', () => {
  beforeEach(() => {
    route.path = '/input-data'
    storeState.selectedExecution = {
      experiment: { instance: { data: { table_a: [{ id: 1 }] } } },
    }
    computedRefHolder.items.value = [{ id: 1 }, { id: 2 }]
    computedRefHolder.hasData.value = true
  })

  test('uses execution data: items come from execution composable, actions disabled', () => {
    const { api } = mountTableData(masterConfig, { executionType: 'instance' })
    expect(api.items.value).toHaveLength(2)
    expect(api.enableActions.value).toBe(false)
    expect(api.canAdd.value).toBe(false)
    expect(api.canDelete.value).toBe(false)
  })

  test('saveAllChanges is a no-op in execution mode', async () => {
    const { api } = mountTableData(masterConfig, { executionType: 'instance' })
    await api.saveAllChanges()
    expect(repoCtrl.calls.put).toBeUndefined()
  })
})

describe('useTableData — Excel mode (pending changes)', () => {
  test('hasPendingChanges and pendingChangesCount track recorded changes', () => {
    const { api } = mountTableData(masterConfig)
    api.handleCellChange('table_a', 1, 'name', 'old', 'new')
    expect(api.hasPendingChanges.value).toBe(true)
    expect(api.pendingChangesCount.value).toBe(1)
    expect(api.isCellModified(1, 'name')).toBe(true)
    expect(api.getModifiedValue(1, 'name')).toBe('new')
    // clearPendingChanges reverts the underlying change store for this table.
    api.clearPendingChanges()
    expect(Object.keys(changesStore.map['table_a'].edits)).toHaveLength(0)
  })

  test('handleBulkEdit records change for each selected item', () => {
    const { api } = mountTableData(masterConfig)
    api.selectedItems.value = [{ id: 1, name: 'a' }, { id: 2, name: 'b' }]
    api.handleBulkEdit({ name: 'X' })
    expect(api.pendingChangesCount.value).toBe(2)
    expect(showSnackbar).toHaveBeenCalled()
  })

  test('rowsDataForModal and tableHeadersForModal keyed by storage key', () => {
    const { api } = mountTableData(masterConfig)
    const rows = api.rowsDataForModal.value
    const headers = api.tableHeadersForModal.value
    expect(Object.keys(rows)).toContain('table_a')
    expect(Object.keys(headers)).toContain('table_a')
  })

  test('getRowClass returns empty when excel mode off', () => {
    const { api } = mountTableData(masterConfig)
    expect(api.getRowClass({ id: 1 })).toBe('')
  })
})
