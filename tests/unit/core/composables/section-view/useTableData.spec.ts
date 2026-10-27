import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, computed, defineComponent, h, nextTick } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'

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
    get: (url: string, params: any) => record('get', url, params),
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

// get_list parameters of the table under test (filters the API applies).
const listParams = vi.hoisted(() => ({ value: [] as any[] }))
;(globalThis as any).__listParams = listParams

vi.mock('@cornflow-ui/core/services/FrontendAutomationService', () => ({
  getSectionType: (p: string) => {
    if (p.includes('input-data')) return 'input-data'
    if (p.includes('results')) return 'results'
    return 'configuration'
  },
  getDateRangeFilterConfigs: vi.fn(() => []),
  getDefaultListQueryParams: vi.fn(() => ({})),
  getGetListQueryParameters: vi.fn(() => (globalThis as any).__listParams.value),
  getDefaultListLimit: vi.fn(() => 50),
  getListDeclaresLimitParam: vi.fn(() => false),
  getListDeclaresOffsetParam: vi.fn(() => false),
  getGlobalSearchQueryParameterName: vi.fn(() => null),
  // An equality param filters with "is"; the rest accept any operator.
  filterTypeMatchesUiOperator: vi.fn((ft: string, op: string) =>
    ft === 'value_is_equal' ? op === 'is' : true,
  ),
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
      isRowModified: (k: string, rowId: any) =>
        Object.keys(ensure(k).edits[String(rowId)] ?? {}).length > 0,
      getCurrentValue: (k: string, rowId: any, f: string, fallback: any) =>
        ensure(k).edits[String(rowId)]?.[f]?.newValue ?? fallback,
      recordChange: (k: string, rowId: any, f: string, _o: any, n: any) => {
        const t = ensure(k)
        t.edits[String(rowId)] = t.edits[String(rowId)] || {}
        t.edits[String(rowId)][f] = { newValue: n }
      },
      revertChange: (k: string, rowId: any, f: string) => {
        delete ensure(k).edits[String(rowId)]?.[f]
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
      updateCreateField: (k: string, tempId: string, f: string, v: any) => {
        const create = ensure(k).creates.find((c: any) => c.tempId === tempId)
        if (create) create.data[f] = v
      },
      recordDelete: (k: string, id: any, data: any) => {
        ensure(k).deletes.push({ rowId: id, data })
      },
      revertDelete: (k: string, id: any) => {
        const t = ensure(k)
        t.deletes = t.deletes.filter((d: any) => String(d.rowId) !== String(id))
      },
      isTableModified: (k: string) => Object.keys(ensure(k).edits).length > 0,
      getPendingCreates: (k: string) => ensure(k).creates,
      // Real getPendingDeletes returns rowIds only.
      getPendingDeletes: (k: string) => ensure(k).deletes.map((d: any) => d.rowId),
      getChangesForTable: (k: string) => ensure(k).edits,
      getRowClass: (k: string, item: any) => {
        const t = ensure(k)
        if (t.deletes.some((d: any) => String(d.rowId) === String(item?.id))) return 'row-deleted'
        if (t.creates.some((c: any) => c.tempId === item?.id)) return 'row-new'
        return ''
      },
    }
  },
}))
;(globalThis as any).__changesStore = changesStore

// useFormFields fake
vi.mock('@cornflow-ui/core/composables/core-table/useFormFields', () => ({
  useFormFields: () => ({
    prepareFormDataForSubmit: (data: any) => ({ ...data }),
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

// 300 rows: more than one window (200). `group` is 'a' for a third of them.
const bigRows = Array.from({ length: 300 }, (_, i) => ({
  id: i,
  rank: i,
  group: i % 3 === 0 ? 'a' : 'b',
}))

const bigConfig = {
  ...masterConfig,
  __rowSchema: {
    properties: {
      id: { type: 'number' },
      rank: { type: 'number' },
      group: { type: 'string' },
    },
    required: [],
  },
}

async function mountLoaded(config: any, rows: any[]) {
  repoCtrl.getListResult = rows
  const mounted = mountTableData(config)
  await mounted.api.loadData()
  await nextTick()
  return mounted
}

const getCount = () => repoCtrl.calls.get?.length ?? 0

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
  listParams.value = []
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
    expect(api.enableSelection.value).toBe(true)
    expect(api.canAdd.value).toBe(true)
    expect(api.canEdit.value).toBe(true)
    expect(api.canDelete.value).toBe(true)
    expect(api.canBulkUpload.value).toBe(false) // no bulk ops declared
    expect(api.canDownloadExcel.value).toBe(true)
    expect(api.enableExcelMode.value).toBe(true)
  })

  test('headers exclude id and build selection column', () => {
    const { api } = mountTableData(masterConfig)
    const keys = api.headers.value.map((h: any) => h.value)
    expect(keys).toContain('selection')
    expect(keys).toContain('name')
    expect(keys).not.toContain('id')
  })

  test('loaded rows decide the column order, not the schema', async () => {
    // Declaration order here is c, b, a; the rows arrive as a, b, c. The table must show
    // what the rows say, so it cannot disagree with the Excel download of the same table.
    const config = {
      ...masterConfig,
      __rowSchema: {
        properties: { c: { type: 'string' }, b: { type: 'string' }, a: { type: 'string' } },
        required: [],
      },
    }
    repoCtrl.getListResult = [{ a: 1, b: 2, c: 3 }]

    const { api } = mountTableData(config)
    await api.loadData()
    await nextTick()

    expect(
      api.headers.value.map((h: any) => h.value).filter((v: string) => v !== 'selection'),
    ).toEqual(['a', 'b', 'c'])
  })

  test('without rows the order comes from required, then the rest', () => {
    const config = {
      ...masterConfig,
      __rowSchema: {
        properties: { a: { type: 'string' }, b: { type: 'string' }, c: { type: 'string' } },
        required: ['c'],
      },
    }

    const { api } = mountTableData(config)

    expect(
      api.headers.value.map((h: any) => h.value).filter((v: string) => v !== 'selection'),
    ).toEqual(['c', 'a', 'b'])
  })

  test("the schema's declared order outranks the loaded rows", async () => {
    const config = {
      ...masterConfig,
      __rowSchema: {
        order: ['c', 'a', 'b'],
        properties: { a: { type: 'string' }, b: { type: 'string' }, c: { type: 'string' } },
        required: [],
      },
    }
    repoCtrl.getListResult = [{ a: 1, b: 2, c: 3 }]

    const { api } = mountTableData(config)
    await api.loadData()
    await nextTick()

    expect(
      api.headers.value.map((h: any) => h.value).filter((v: string) => v !== 'selection'),
    ).toEqual(['c', 'a', 'b'])
  })

  test('canBulkUpload true when bulk ops supported', () => {
    const { api } = mountTableData({
      ...masterConfig,
      post_bulk: { url: '/b', http_method: 'post' },
    })
    expect(api.canBulkUpload.value).toBe(true)
    expect(api.bulkUploadAvailableOperations.value).toContain('post_bulk')
  })

  test('a parameter object table is a single record: no add, no delete', async () => {
    const { api } = await mountLoaded({ ...masterConfig, __paramObject: true }, [
      { id: 1, name: 'a' },
    ])
    expect(api.isSingleRecord.value).toBe(true)
    expect(api.canAdd.value).toBe(false)
    expect(api.canDelete.value).toBe(false)

    await api.deleteRows([1])
    expect(repoCtrl.calls.delete).toBeUndefined()
    expect(changesStore.map.table_a?.deletes ?? []).toHaveLength(0)
  })

  test('a table flagged as parameters is a single record', () => {
    expect(mountTableData({ ...masterConfig, isParameterTable: true }).api.isSingleRecord.value).toBe(
      true,
    )
    expect(mountTableData(masterConfig).api.isSingleRecord.value).toBe(false)
  })
})

describe('useTableData — search, filters and sort', () => {
  test('date range handlers update dateRangeValues', () => {
    const { api } = mountTableData(masterConfig)
    api.handleApplyDateRange('created', { from: 'a', to: 'b' })
    expect(api.dateRangeValues.value.created).toEqual({ from: 'a', to: 'b' })
    api.handleResetDateRange('created')
    expect(api.dateRangeValues.value.created).toBeUndefined()
    api.handleApplyDateRange('', null as any) // no-op
    api.handleResetDateRange('') // no-op
  })

  test('handleSearch sets searchValue (client-side path)', () => {
    vi.useFakeTimers()
    const { api } = mountTableData(masterConfig)
    api.handleSearch('hello')
    expect(api.searchValue.value).toBe('hello')
    vi.advanceTimersByTime(300)
  })

  test('a change in a filter the API applies reloads the list with it', async () => {
    listParams.value = [
      {
        name: 'name_eq',
        is_filter: true,
        filter_info: { filters_on: 'name', filter_type: 'value_is_equal' },
      },
    ]
    const { api } = await mountLoaded(masterConfig, [{ id: 1, name: 'x' }])
    const before = getCount()

    api.setFilters([{ id: 'f1', field: 'name', operator: 'is', value: 'x' }])
    await flushPromises()

    expect(getCount()).toBe(before + 1)
    expect(repoCtrl.calls.get.at(-1)?.data).toMatchObject({ name_eq: 'x' })
  })

  test('a filter applied to the loaded rows does not reload', async () => {
    const { api } = await mountLoaded(masterConfig, [
      { id: 1, name: 'x' },
      { id: 2, name: 'y' },
    ])
    const before = getCount()

    api.setFilters([{ id: 'f1', field: 'name', operator: 'is', value: 'y' }])
    await flushPromises()

    expect(getCount()).toBe(before)
    expect(api.items.value.map((r: any) => r.id)).toEqual([2])
  })

  test('a list filter with one value goes to the API as "is"', async () => {
    listParams.value = [
      {
        name: 'name_eq',
        is_filter: true,
        filter_info: { filters_on: 'name', filter_type: 'value_is_equal' },
      },
    ]
    const { api } = await mountLoaded(masterConfig, [{ id: 1, name: 'x' }])
    const before = getCount()

    api.setFilters([
      { id: 'f1', field: 'name', operator: 'is_any_of', value: '', values: ['x'] },
    ])
    await flushPromises()

    expect(getCount()).toBe(before + 1)
    expect(repoCtrl.calls.get.at(-1)?.data).toMatchObject({ name_eq: 'x' })
  })

  test('a list filter with several values stays on the loaded rows', async () => {
    listParams.value = [
      {
        name: 'name_eq',
        is_filter: true,
        filter_info: { filters_on: 'name', filter_type: 'value_is_equal' },
      },
    ]
    const { api } = await mountLoaded(masterConfig, [
      { id: 1, name: 'x' },
      { id: 2, name: 'y' },
      { id: 3, name: 'z' },
    ])
    const before = getCount()

    api.setFilters([
      { id: 'f1', field: 'name', operator: 'is_any_of', value: '', values: ['x', 'z'] },
    ])
    await flushPromises()

    expect(getCount()).toBe(before)
    expect(api.items.value.map((r: any) => r.id)).toEqual([1, 3])
  })

  test('the sort orders the whole set before the window is cut', async () => {
    const { api } = await mountLoaded(bigConfig, bigRows)

    api.sort.value = { key: 'rank', direction: 'desc' }
    await nextTick()

    expect(api.items.value).toHaveLength(200)
    expect(api.items.value[0].rank).toBe(299)
    expect(api.items.value[199].rank).toBe(100)
  })

  test('totalCount counts every row and filteredCount the ones that pass the filters', async () => {
    const { api } = await mountLoaded(bigConfig, bigRows)
    expect(api.totalCount.value).toBe(300)
    expect(api.filteredCount.value).toBe(300)

    api.setFilters([{ id: 'f1', field: 'group', operator: 'is', value: 'a' }])
    await nextTick()

    expect(api.totalCount.value).toBe(300)
    expect(api.filteredCount.value).toBe(100)
    expect(api.items.value).toHaveLength(100)
  })

  test('totalCount and filteredCount are unknown while the server pages the list', async () => {
    const automation = await import('@cornflow-ui/core/services/FrontendAutomationService')
    vi.mocked(automation.getListDeclaresLimitParam).mockReturnValue(true)
    vi.mocked(automation.getListDeclaresOffsetParam).mockReturnValue(true)
    try {
      const { api } = await mountLoaded(masterConfig, [{ id: 1, name: 'x' }])
      expect(api.totalCount.value).toBeUndefined()
      expect(api.filteredCount.value).toBeUndefined()
    } finally {
      vi.mocked(automation.getListDeclaresLimitParam).mockReturnValue(false)
      vi.mocked(automation.getListDeclaresOffsetParam).mockReturnValue(false)
    }
  })
})

describe('useTableData — adding and deleting rows', () => {
  test('addRow creates the row through the API and reloads (non-excel)', async () => {
    const { api } = mountTableData(masterConfigNoExcel)
    await api.addRow({ name: 'new' })
    expect(repoCtrl.calls.post).toHaveLength(1)
    expect(repoCtrl.calls.post[0].data).toEqual({ name: 'new' })
    expect(showSnackbar).toHaveBeenCalledWith('table.messages.itemCreated', 'success')
  })

  test('addRow in excel mode stages a pending create and shows the row', async () => {
    const { api } = mountTableData(masterConfig)
    await api.addRow({ name: 'staged' })
    expect(repoCtrl.calls.post).toBeUndefined()
    expect(api.hasPendingChanges.value).toBe(true)
    expect(api.items.value).toContainEqual({ id: 'create-table_a-0', name: 'staged' })
    expect(showSnackbar).toHaveBeenCalledWith('pendingChanges.changeStaged', 'success')
  })

  test('addRow surfaces the error when the API rejects', async () => {
    const { api } = mountTableData(masterConfigNoExcel)
    await flushPromises()
    repoCtrl.rejectWith = new Error('save failed')
    await api.addRow({ name: 'x' })
    expect(api.error.value).toBe('save failed')
    expect(showSnackbar).toHaveBeenCalledWith('save failed', 'error')
  })

  test('deleteRows deletes the rows through the API (non-excel)', async () => {
    const { api } = await mountLoaded(masterConfigNoExcel, [
      { id: 1, name: 'a' },
      { id: 2, name: 'b' },
    ])
    await api.deleteRows([1, 2])
    expect(repoCtrl.calls.delete).toHaveLength(1)
    expect(api.selectedItems.value).toEqual([])
    expect(showSnackbar).toHaveBeenCalledWith('table.messages.itemsDeleted', 'success')
  })

  test('deleteRows offers a force retry when the API asks for it', async () => {
    const { api } = await mountLoaded(masterConfigNoExcel, [
      { id: 1, name: 'a' },
      { id: 2, name: 'b' },
    ])
    repoCtrl.rejectWith = Object.assign(new Error('needs force'), {
      name: 'ForceRetryOfferError',
    })
    await api.deleteRows([2])
    expect(api.forceRetryOffer.value).toEqual({
      message: 'needs force',
      operation: 'delete_bulk',
      ids: [2],
    })
  })

  test('deleteRows in excel mode marks the rows and restoreRows takes them back', async () => {
    const { api } = await mountLoaded(masterConfig, [
      { id: 1, name: 'a' },
      { id: 2, name: 'b' },
    ])
    await api.deleteRows([1])
    expect(repoCtrl.calls.delete).toBeUndefined()
    expect(api.pendingChangesCount.value).toBe(1)
    expect(api.getRowState({ id: 1 })).toBe('deleted')
    expect(api.getRowState({ id: 2 })).toBeUndefined()

    api.restoreRows([1])
    expect(api.getRowState({ id: 1 })).toBeUndefined()
    expect(api.hasPendingChanges.value).toBe(false)
  })
})

describe('useTableData — force retry', () => {
  test('acceptForceRetry for delete_bulk deletes the rows with force', async () => {
    const { api } = mountTableData(masterConfig)
    api.forceRetryOffer.value = { message: 'm', operation: 'delete_bulk', ids: [4, 5] }
    await api.acceptForceRetry()
    expect(repoCtrl.calls.delete).toHaveLength(1)
    expect(api.forceRetryOffer.value).toBeNull()
    expect(showSnackbar).toHaveBeenCalledWith('table.messages.itemsDeleted', 'success')
  })

  test('rejectForceRetry clears offer', () => {
    const { api } = mountTableData(masterConfig)
    api.forceRetryOffer.value = { message: 'm', operation: 'delete_bulk', ids: [4] }
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
    expect(api.enableSelection.value).toBe(false)
    expect(api.canAdd.value).toBe(false)
    expect(api.canEdit.value).toBe(false)
    expect(api.canDelete.value).toBe(false)
    expect(api.enableExcelMode.value).toBe(false)
  })

  test('totalCount and filteredCount come from the execution rows', () => {
    const { api } = mountTableData(masterConfig, { executionType: 'instance' })
    expect(api.totalCount.value).toBe(2)
    expect(api.filteredCount.value).toBe(2)
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
  })

  test('revertCell takes back the change of one cell', () => {
    const { api } = mountTableData(masterConfig)
    api.handleCellChange('table_a', 1, 'name', 'old', 'new')
    api.revertCell(1, 'name')
    expect(api.isCellModified(1, 'name')).toBe(false)
    expect(api.pendingChangesCount.value).toBe(0)
  })

  test('an edit on a created row updates the create instead of recording a change', async () => {
    const { api } = mountTableData(masterConfig)
    await api.addRow({ name: 'draft' })

    api.handleCellChange('table_a', 'create-table_a-0', 'name', 'draft', 'final')

    expect(changesStore.map.table_a.creates[0].data).toEqual({ name: 'final' })
    expect(changesStore.map.table_a.edits).toEqual({})
    expect(api.items.value).toContainEqual({ id: 'create-table_a-0', name: 'final' })
    expect(api.pendingChangesCount.value).toBe(1)
  })

  test('bulkEditRows records the values in each row', async () => {
    const { api } = await mountLoaded(masterConfig, [
      { id: 1, name: 'a' },
      { id: 2, name: 'b' },
      { id: 3, name: 'c' },
    ])
    api.bulkEditRows([1, 2], { name: 'X' })
    expect(api.pendingChangesCount.value).toBe(2)
    expect(api.getModifiedValue(1, 'name')).toBe('X')
    expect(api.getModifiedValue(2, 'name')).toBe('X')
    expect(api.isCellModified(3, 'name')).toBe(false)
    expect(showSnackbar).toHaveBeenCalledWith('table.bulkEditApplied:{"count":2}', 'success')
  })

  test('getRowState tells a new, a modified and an untouched row apart', async () => {
    const { api } = await mountLoaded(masterConfig, [
      { id: 1, name: 'a' },
      { id: 2, name: 'b' },
    ])
    await api.addRow({ name: 'c' })
    api.handleCellChange('table_a', 1, 'name', 'a', 'A')

    expect(api.getRowState({ id: 'create-table_a-0' })).toBe('new')
    expect(api.getRowState({ id: 1 })).toBe('modified')
    expect(api.getRowState({ id: 2 })).toBeUndefined()
  })

  test('getRowState is empty when the table does not stage changes', () => {
    const { api } = mountTableData(masterConfigNoExcel)
    api.handleCellChange('table_a', 1, 'name', 'a', 'A')
    expect(api.getRowState({ id: 1 })).toBeUndefined()
  })

  test('rowsDataForModal and tableHeadersForModal keyed by storage key', () => {
    const { api } = mountTableData(masterConfig)
    const rows = api.rowsDataForModal.value
    const headers = api.tableHeadersForModal.value
    expect(Object.keys(rows)).toContain('table_a')
    expect(Object.keys(headers)).toContain('table_a')
  })
})
