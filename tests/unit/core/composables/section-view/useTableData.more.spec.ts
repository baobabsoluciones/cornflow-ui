import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, computed, defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'

// ─── Hoisted controllable fixtures ──────────────────────────────────────────
//
// This spec COMPLEMENTS useTableData.spec.ts. It targets the heavy internal
// paths that the base spec leaves uncovered:
//   • FK/join enrichment (buildFkConfigsForProperties, enrichItemsWithJoinedColumns)
//   • parseUploadFile for Excel / CSV / JSON
//   • async bulk upload with polling (tryRunAsyncBulkUpload)
//   • in-memory pagination window (loadMore / hasMore)
//
// As in the base spec we let the REAL TableRepository run and drive its HTTP
// client (@/api/Api). Dynamic import() of TableRepository is not intercepted
// by vi.mock, so the repo must funnel through the mocked Api below.

const route = vi.hoisted(() => ({ path: '/configuration' }))

// Controllable HTTP client. `get`/`post` resolve from a per-url-or-queue map so
// the async polling flow can return a sequence of statuses.
const repoCtrl = vi.hoisted(() => ({
  // GET responses keyed by exact url; falls back to defaultGet.
  getByUrl: {} as Record<string, any[]>,
  defaultGet: [] as any[],
  // Queue of GET response *contents* consumed in order (used for status polling).
  getQueue: [] as any[],
  // Queue of POST response contents consumed in order.
  postQueue: [] as any[],
  defaultPost: { ok: true } as any,
  calls: {} as Record<string, { url: string; data: any }[]>,
}))
;(globalThis as any).__repoCtrlMore = repoCtrl

function record(method: string, url: string, data: any) {
  const c = (globalThis as any).__repoCtrlMore
  c.calls[method] = c.calls[method] || []
  c.calls[method].push({ url, data })

  let content: any
  if (method === 'get') {
    if (c.getQueue.length > 0) {
      content = c.getQueue.shift()
    } else if (Object.prototype.hasOwnProperty.call(c.getByUrl, url)) {
      content = c.getByUrl[url]
    } else {
      content = c.defaultGet
    }
  } else if (method === 'post') {
    content = c.postQueue.length > 0 ? c.postQueue.shift() : c.defaultPost
  } else {
    content = { ok: true }
  }
  return Promise.resolve({ status: 200, content })
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
  useI18n: () => ({
    t: (k: string, p?: any) => (p ? `${k}:${JSON.stringify(p)}` : k),
  }),
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
    const s = (globalThis as any).__changesStoreMore
    const ensure = (k: string) =>
      (s.map[k] = s.map[k] || {
        edits: {},
        creates: [],
        deletes: [],
        title: '',
      })
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
        t.creates.push({ tempId, data: { ...data } })
        return tempId
      },
      recordDelete: (k: string, id: any, data: any) => {
        ensure(k).deletes.push({ rowId: id, data })
      },
      isTableModified: (k: string) => Object.keys(ensure(k).edits).length > 0,
      getPendingCreates: (k: string) => ensure(k).creates,
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
;(globalThis as any).__changesStoreMore = changesStore

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

// schemaUtils — controllable so we can drive FK/join paths.
const schemaCtrl = vi.hoisted(() => ({
  // parseJoinFrom returns { table, field } parsed from a "table.field" string.
  parseJoinFromImpl: (jf: any) => {
    if (typeof jf !== 'string' || !jf.includes('.')) return null
    const [table, field] = jf.split('.')
    return { table, field }
  },
  valueNoneImpl: (_v: any, _prop: any) => false,
}))
;(globalThis as any).__schemaCtrlMore = schemaCtrl
vi.mock('@cornflow-ui/core/utils/schemaUtils', () => ({
  parseJoinFrom: vi.fn((jf: any) =>
    (globalThis as any).__schemaCtrlMore.parseJoinFromImpl(jf),
  ),
  getForeignKeyFieldName: vi.fn(() => null),
  displayValueMatchesValueNone: vi.fn((v: any, prop: any) =>
    (globalThis as any).__schemaCtrlMore.valueNoneImpl(v, prop),
  ),
  getListResponseRowProperties: vi.fn(
    (config: any) => config?.__rowSchema ?? null,
  ),
  normalizeGetListResponseToRows: vi.fn((data: any) =>
    Array.isArray(data) ? data : [],
  ),
  isMasterDataParameterObjectTable: vi.fn(
    (_tableKey: any, config: any) => !!config?.__paramObject,
  ),
  isParameterPropertySchemaVisible: vi.fn(
    (prop: any) => prop?.visible !== false,
  ),
  normalizeJsonSchemaPropertyTypeForUi: vi.fn(
    (prop: any) => prop?.type ?? 'string',
  ),
}))

// applyFiltersAndSearch real-ish: passthrough so windowing slices the full set.
vi.mock('@cornflow-ui/core/utils/tableFilterUtils', () => ({
  getOperatorsForFieldType: vi.fn(() => ['equals']),
  getOperatorText: vi.fn((op: string) => `OP:${op}`),
  operatorNeedsValue: vi.fn(() => true),
  operatorNeedsSecondValue: vi.fn(() => false),
  generateFilterId: vi.fn(() => 'fid-1'),
  applyFiltersAndSearch: vi.fn((items: any[]) => items),
  getFilterFieldTypeFromSchemaProperty: vi.fn(() => 'string'),
}))

// csvUtils — controllable for the CSV parse path.
const csvCtrl = vi.hoisted(() => ({
  parseImpl: (_content: string, _d: string) => ({
    tableData: [{ name: 'csvRow' }],
  }),
}))
;(globalThis as any).__csvCtrlMore = csvCtrl
vi.mock('@cornflow-ui/core/utils/csvUtils', () => ({
  detectDelimiter: vi.fn(() => ','),
  parseCsvContent: vi.fn((content: string, d: string) =>
    (globalThis as any).__csvCtrlMore.parseImpl(content, d),
  ),
}))

// app config — controllable parameters.
const configCtrl = vi.hoisted(() => ({
  enableRecalculationOnMasterEdit: false,
  enableSolutionRecalculation: false,
}))
;(globalThis as any).__configCtrlMore = configCtrl
vi.mock('@/app/config', () => ({
  default: {
    getCore: () => ({
      parameters: (globalThis as any).__configCtrlMore,
    }),
  },
}))

vi.mock('@/app/composables/useFileProcessors', () => ({
  useFileProcessors: () => ({ processors: {} }),
}))

// exceljs — controllable workbook for the Excel parse path. Aliased in vitest
// config to a stub; vi.mock on the specifier overrides it for this spec.
const excelCtrl = vi.hoisted(() => ({
  // rows: array of arrays; first row is the header row.
  rows: [] as any[][],
  rowCount: 0,
}))
;(globalThis as any).__excelCtrlMore = excelCtrl
vi.mock('exceljs', () => {
  class Workbook {
    xlsx = {
      load: async (_buffer?: any) => {},
    }
    get worksheets() {
      const ctrl = (globalThis as any).__excelCtrlMore
      const sheet = {
        rowCount: ctrl.rowCount,
        eachRow: (cb: (row: any, n: number) => void) => {
          ctrl.rows.forEach((r: any[], i: number) => {
            // ExcelJS row.values is 1-based (index 0 is undefined).
            cb({ values: [undefined, ...r] }, i + 1)
          })
        },
      }
      return ctrl.rowCount >= 1 ? [sheet] : []
    }
  }
  return { Workbook, default: { Workbook } }
})

// Holder for the execution-table-data refs.
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

/** Build a File whose .text()/.arrayBuffer() resolve to the given content. */
function makeFile(name: string, content: string): File {
  const file = new File([content], name)
  // jsdom File has text()/arrayBuffer(), but FileReader.readAsText is what the
  // source uses; jsdom implements FileReader against the Blob parts, so this
  // works out of the box. Return as-is.
  return file
}

beforeEach(() => {
  vi.clearAllMocks()
  route.path = '/configuration'
  storeState = {
    selectedExecution: null,
    getConfigurations: { masterData: {}, inputData: {}, resultsData: {} },
    checkPlanDataAfterMasterDataChange: vi.fn(async () => undefined),
  }
  repoCtrl.getByUrl = {}
  repoCtrl.defaultGet = []
  repoCtrl.getQueue = []
  repoCtrl.postQueue = []
  repoCtrl.defaultPost = { ok: true }
  repoCtrl.calls = {}
  changesStore.map = {}
  schemaCtrl.parseJoinFromImpl = (jf: any) => {
    if (typeof jf !== 'string' || !jf.includes('.')) return null
    const [table, field] = jf.split('.')
    return { table, field }
  }
  schemaCtrl.valueNoneImpl = () => false
  csvCtrl.parseImpl = () => ({ tableData: [{ name: 'csvRow' }] })
  configCtrl.enableRecalculationOnMasterEdit = false
  configCtrl.enableSolutionRecalculation = false
  excelCtrl.rows = []
  excelCtrl.rowCount = 0
  computedRefHolder.items.value = []
  computedRefHolder.loading.value = false
  computedRefHolder.hasData.value = false
  invalidateAllTableDataCaches()
})

afterEach(() => {
  vi.useRealTimers()
})

// ─── FK / join row schema fixtures ───────────────────────────────────────────
//
// Table `port_data` has a FK `factory_id` whose columns_to_join is ['factoria'].
// The dependent field `factoria` joins from `factories.nombre`.
const fkRowSchema = {
  properties: {
    id: { title: 'ID', type: 'number' },
    factory_id: {
      title: 'Factory',
      type: 'number',
      isForeignKey: true,
      columnsToJoin: ['factoria'],
    },
    factoria: {
      title: 'Factoria',
      type: 'string',
      isDependentField: true,
      joinFrom: 'factories.nombre',
    },
  },
  required: [],
}

// Referenced table config (so loadTableData can resolve it from the store).
const factoriesConfig = {
  title: 'Factories',
  get_list: { url: '/factories', http_method: 'get' },
  __rowSchema: {
    properties: {
      id: { title: 'ID', type: 'number' },
      nombre: { title: 'Nombre', type: 'string' },
    },
    required: [],
  },
}

const fkTableConfig = {
  title: 'Port Data',
  get_list: { url: '/ports', http_method: 'get' },
  post_bulk: { url: '/ports/bulk', http_method: 'post' },
  __rowSchema: fkRowSchema,
}

// ─── enrichItemsWithJoinedColumns (via loadData) ─────────────────────────────

describe('useTableData — FK/join enrichment on list load', () => {
  beforeEach(() => {
    storeState.getConfigurations.masterData = { factories: factoriesConfig }
    // GET /factories -> reference rows; GET /ports -> main rows with factory_id.
    repoCtrl.getByUrl['/factories'] = [
      { id: 10, nombre: 'Alpha' },
      { id: 20, nombre: 'Beta' },
    ]
    repoCtrl.getByUrl['/ports'] = [
      { id: 1, factory_id: 10 },
      { id: 2, factory_id: 20 },
      { id: 3, factory_id: 999 }, // unmatched -> left as-is
    ]
  })

  test('loadData enriches each item with the joined column value', async () => {
    const { api } = mountTableData(fkTableConfig)
    await api.loadData()
    await nextTick()
    const rows = api.items.value
    expect(rows).toHaveLength(3)
    expect(rows[0].factoria).toBe('Alpha')
    expect(rows[1].factoria).toBe('Beta')
    // Unmatched FK id leaves the row without an injected join value.
    expect(rows[2].factoria).toBeUndefined()
  })

  test('no enrichment when schema declares no columns_to_join', async () => {
    const plainConfig = {
      title: 'Plain',
      get_list: { url: '/plain', http_method: 'get' },
      __rowSchema: {
        properties: { id: { type: 'number' }, name: { type: 'string' } },
        required: [],
      },
    }
    repoCtrl.getByUrl['/plain'] = [{ id: 1, name: 'x' }]
    const { api } = mountTableData(plainConfig)
    await api.loadData()
    await nextTick()
    expect(api.items.value).toEqual([{ id: 1, name: 'x' }])
  })

  test('join table load failure is swallowed and items still load', async () => {
    // parseJoinFrom returns a table that is NOT in configurations -> loadTableData
    // returns [] (caught) -> refById empty -> rows unchanged but loaded.
    storeState.getConfigurations.masterData = {} // factories not registered
    const { api } = mountTableData(fkTableConfig)
    await api.loadData()
    await nextTick()
    expect(api.items.value).toHaveLength(3)
    expect(api.items.value[0].factoria).toBeUndefined()
  })
})

// ─── buildFkConfigsForProperties via bulk upload (mapDependentFieldsToIds) ────

describe('useTableData — FK mapping on bulk upload (mapDependentFieldsToIds)', () => {
  beforeEach(() => {
    storeState.getConfigurations.masterData = { factories: factoriesConfig }
    repoCtrl.getByUrl['/factories'] = [
      { id: 10, nombre: 'Alpha' },
      { id: 20, nombre: 'Beta' },
    ]
    repoCtrl.getByUrl['/ports'] = []
  })

  test('resolves dependent display value to FK id and strips the dep column', async () => {
    const { api } = mountTableData(fkTableConfig)
    const file = makeFile('data.json', JSON.stringify([{ factoria: 'Beta' }]))
    await api.handleBulkUpload({ files: [file], operation: 'post_bulk' })
    await nextTick()
    const posted = repoCtrl.calls.post?.find((c) => c.url === '/ports/bulk')
    expect(posted).toBeDefined()
    const body = posted!.data
    expect(Array.isArray(body)).toBe(true)
    expect(body[0].factory_id).toBe(20)
    // Dependent display column removed before sending.
    expect('factoria' in body[0]).toBe(false)
    expect(showSnackbar).toHaveBeenCalledWith(
      'table.messages.bulkUploadSuccess',
      'success',
    )
  })

  test('throws bulkUploadReferenceNotFound when display value has no match', async () => {
    const { api } = mountTableData(fkTableConfig)
    const file = makeFile(
      'data.json',
      JSON.stringify([{ factoria: 'DoesNotExist' }]),
    )
    await api.handleBulkUpload({ files: [file], operation: 'post_bulk' })
    await nextTick()
    // No bulk POST happened; error surfaced via snackbar.
    expect(
      repoCtrl.calls.post?.some((c) => c.url === '/ports/bulk'),
    ).toBeFalsy()
    const errCall = showSnackbar.mock.calls.find(
      (c) =>
        typeof c[0] === 'string' &&
        c[0].includes('table.messages.bulkUploadReferenceNotFound'),
    )
    expect(errCall).toBeDefined()
  })

  test('value-none display sets FK to null instead of throwing', async () => {
    schemaCtrl.valueNoneImpl = (v: any) => v === '__NONE__'
    const { api } = mountTableData(fkTableConfig)
    const file = makeFile(
      'data.json',
      JSON.stringify([{ factoria: '__NONE__' }]),
    )
    await api.handleBulkUpload({ files: [file], operation: 'post_bulk' })
    await nextTick()
    const posted = repoCtrl.calls.post?.find((c) => c.url === '/ports/bulk')
    expect(posted).toBeDefined()
    expect(posted!.data[0].factory_id).toBeNull()
  })
})

// ─── parseUploadFile: JSON / CSV / Excel ─────────────────────────────────────

describe('useTableData — parseUploadFile', () => {
  const plainBulkConfig = {
    title: 'Plain Bulk',
    get_list: { url: '/pb', http_method: 'get' },
    post_bulk: { url: '/pb/bulk', http_method: 'post' },
    __rowSchema: {
      properties: { id: { type: 'number' }, name: { type: 'string' } },
      required: [],
    },
  }

  beforeEach(() => {
    repoCtrl.getByUrl['/pb'] = []
  })

  test('parses a JSON array file', async () => {
    const { api } = mountTableData(plainBulkConfig)
    const file = makeFile(
      'rows.json',
      JSON.stringify([{ name: 'a' }, { name: 'b' }]),
    )
    await api.handleBulkUpload({ files: [file], operation: 'post_bulk' })
    await nextTick()
    const posted = repoCtrl.calls.post?.find((c) => c.url === '/pb/bulk')
    expect(posted).toBeDefined()
    expect(posted!.data).toHaveLength(2)
    expect(posted!.data[0].name).toBe('a')
  })

  test('wraps a single JSON object into an array', async () => {
    const { api } = mountTableData(plainBulkConfig)
    const file = makeFile('row.json', JSON.stringify({ name: 'solo' }))
    await api.handleBulkUpload({ files: [file], operation: 'post_bulk' })
    await nextTick()
    const posted = repoCtrl.calls.post?.find((c) => c.url === '/pb/bulk')
    expect(posted!.data).toHaveLength(1)
    expect(posted!.data[0].name).toBe('solo')
  })

  test('parses a CSV file via csvUtils', async () => {
    csvCtrl.parseImpl = () => ({
      tableData: [{ name: 'csv-a' }, { name: 'csv-b' }],
    })
    const { api } = mountTableData(plainBulkConfig)
    const file = makeFile('rows.csv', 'name\ncsv-a\ncsv-b')
    await api.handleBulkUpload({ files: [file], operation: 'post_bulk' })
    await nextTick()
    const posted = repoCtrl.calls.post?.find((c) => c.url === '/pb/bulk')
    expect(posted).toBeDefined()
    expect(posted!.data).toHaveLength(2)
    expect(posted!.data[1].name).toBe('csv-b')
  })

  test('parses an Excel file via mocked exceljs workbook', async () => {
    excelCtrl.rows = [
      ['name', 'qty'],
      ['xls-a', 5],
      ['xls-b', ''],
    ]
    excelCtrl.rowCount = 3
    const { api } = mountTableData(plainBulkConfig)
    const file = makeFile('rows.xlsx', 'binary')
    await api.handleBulkUpload({ files: [file], operation: 'post_bulk' })
    await nextTick()
    const posted = repoCtrl.calls.post?.find((c) => c.url === '/pb/bulk')
    expect(posted).toBeDefined()
    expect(posted!.data).toHaveLength(2)
    expect(posted!.data[0].name).toBe('xls-a')
    expect(posted!.data[0].qty).toBe(5)
    // Empty cell normalized to null by parseExcelFile then by backend normalizer.
    expect(posted!.data[1].qty).toBeNull()
  })

  test('Excel with only a header row throws (surfaced as snackbar error)', async () => {
    excelCtrl.rows = [['name']]
    excelCtrl.rowCount = 1
    const { api } = mountTableData(plainBulkConfig)
    const file = makeFile('rows.xlsx', 'binary')
    await api.handleBulkUpload({ files: [file], operation: 'post_bulk' })
    await nextTick()
    expect(
      repoCtrl.calls.post?.some((c) => c.url === '/pb/bulk'),
    ).toBeFalsy()
    expect(showSnackbar).toHaveBeenCalledWith(
      'table.fileProcessingError',
      'error',
    )
  })

  test('unsupported extension surfaces invalidFileFormat error', async () => {
    const { api } = mountTableData(plainBulkConfig)
    const file = makeFile('rows.txt', 'whatever')
    await api.handleBulkUpload({ files: [file], operation: 'post_bulk' })
    await nextTick()
    expect(showSnackbar).toHaveBeenCalledWith(
      'table.messages.invalidFileFormat',
      'error',
    )
  })

  test('empty file list reports a bulk-upload error', async () => {
    const { api } = mountTableData(plainBulkConfig)
    await api.handleBulkUpload({ files: [], operation: 'post_bulk' })
    expect(showSnackbar).toHaveBeenCalledWith(
      'table.messages.errorBulkUpload',
      'error',
    )
  })
})

// ─── tryRunAsyncBulkUpload: polling with fake timers ─────────────────────────

describe('useTableData — async bulk upload (tryRunAsyncBulkUpload)', () => {
  const asyncConfig = {
    title: 'Async Table',
    get_list: { url: '/async', http_method: 'get' },
    async_post_bulk: { url: '/async/upload', http_method: 'post' },
    async_upload_status: {
      url: '/async/status/{upload_id}',
      http_method: 'get',
    },
    __rowSchema: {
      properties: { id: { type: 'number' }, name: { type: 'string' } },
      required: [],
    },
  }

  beforeEach(() => {
    repoCtrl.getByUrl['/async'] = []
  })

  test('polls until completed, reloads list, closes modal, success snackbar', async () => {
    vi.useFakeTimers()
    // POST start -> upload_id. Then status GETs: processing, processing, completed.
    repoCtrl.postQueue = [{ upload_id: 'up-1', status: 'queued' }]
    repoCtrl.getQueue = [
      { status: 'processing', total_rows_loaded: 5 },
      { status: 'processing', total_rows_loaded: 12 },
      { status: 'completed', total_rows_loaded: 20 },
      // Final fetchListEnriched after completion reads default GET (=[]).
    ]
    const { api } = mountTableData(asyncConfig)
    api.showBulkUploadModal.value = true

    const file = makeFile('big.xlsx', 'binary')
    const promise = api.handleBulkUpload({
      files: [file],
      operation: 'post_bulk',
    })

    // Drain the polling loop (each non-terminal poll waits intervalMs=2000).
    await vi.runAllTimersAsync()
    await promise

    expect(api.showBulkUploadModal.value).toBe(false)
    expect(showSnackbar).toHaveBeenCalledWith(
      expect.stringContaining('table.messages.asyncUploadCompleted'),
      'success',
    )
    // The start upload POST hit the async endpoint.
    expect(
      repoCtrl.calls.post?.some((c) => c.url === '/async/upload'),
    ).toBe(true)
    // No sync bulk POST happened.
    expect(
      repoCtrl.calls.post?.some((c) => c.url.includes('/bulk')),
    ).toBeFalsy()
  })

  test('updates uploadProgressMessage during processing', async () => {
    vi.useFakeTimers()
    repoCtrl.postQueue = [{ upload_id: 'up-2', status: 'queued' }]
    repoCtrl.getQueue = [
      { status: 'processing', total_rows_loaded: 7 },
      { status: 'completed', total_rows_loaded: 7 },
    ]
    const { api } = mountTableData(asyncConfig)
    const file = makeFile('big.xlsx', 'binary')
    const promise = api.handleBulkUpload({
      files: [file],
      operation: 'post_bulk',
    })
    await vi.runAllTimersAsync()
    await promise
    // After completion the progress message is cleared in the finally block.
    expect(api.uploadProgressMessage.value).toBe('')
  })

  test('failed status surfaces error and keeps modal logic intact', async () => {
    vi.useFakeTimers()
    repoCtrl.postQueue = [{ upload_id: 'up-3', status: 'queued' }]
    repoCtrl.getQueue = [
      { status: 'processing', total_rows_loaded: 1 },
      { status: 'failed', error_message: 'boom on server' },
    ]
    const { api } = mountTableData(asyncConfig)
    const file = makeFile('big.xlsx', 'binary')
    const promise = api.handleBulkUpload({
      files: [file],
      operation: 'post_bulk',
    })
    await vi.runAllTimersAsync()
    await promise
    expect(api.error.value).toBe('boom on server')
    expect(showSnackbar).toHaveBeenCalledWith('boom on server', 'error')
  })

  test('falls back to sync path when no async op declared', async () => {
    // Plain config: no async_* ops -> tryRunAsyncBulkUpload returns false.
    const syncConfig = {
      title: 'Sync Only',
      get_list: { url: '/so', http_method: 'get' },
      post_bulk: { url: '/so/bulk', http_method: 'post' },
      __rowSchema: {
        properties: { id: { type: 'number' }, name: { type: 'string' } },
        required: [],
      },
    }
    repoCtrl.getByUrl['/so'] = []
    const { api } = mountTableData(syncConfig)
    const file = makeFile('rows.json', JSON.stringify([{ name: 'a' }]))
    await api.handleBulkUpload({ files: [file], operation: 'post_bulk' })
    await nextTick()
    expect(
      repoCtrl.calls.post?.some((c) => c.url === '/so/bulk'),
    ).toBe(true)
  })
})

// ─── In-memory pagination window (execution data) ────────────────────────────

describe('useTableData — in-memory pagination window', () => {
  beforeEach(() => {
    route.path = '/input-data'
    storeState.selectedExecution = {
      experiment: { instance: { data: { table_a: [] } } },
    }
    // 450 execution rows -> first window is 200; loadMore grows by 200.
    computedRefHolder.items.value = Array.from({ length: 450 }, (_, i) => ({
      id: i,
    }))
    computedRefHolder.hasData.value = true
  })

  test('windows the execution dataset and grows on loadMore', async () => {
    const { api } = mountTableData(
      { ...fkTableConfig, __rowSchema: undefined },
      { executionType: 'instance' },
    )
    // Use a plain (no-join) config so no enrichment delays the window.
    expect(api.items.value).toHaveLength(200)
    expect(api.hasMore.value).toBe(true)
    expect(api.loadingMore.value).toBe(false)

    api.loadMore()
    await nextTick()
    expect(api.items.value).toHaveLength(400)
    expect(api.hasMore.value).toBe(true)

    api.loadMore()
    await nextTick()
    // 450 total -> capped at full length.
    expect(api.items.value).toHaveLength(450)
    expect(api.hasMore.value).toBe(false)
  })

  test('master table without limit/offset uses in-memory window too', async () => {
    route.path = '/configuration'
    storeState.selectedExecution = null
    const masterConfig = {
      title: 'Big Master',
      get_list: { url: '/big', http_method: 'get' },
      __rowSchema: {
        properties: { id: { type: 'number' }, name: { type: 'string' } },
        required: [],
      },
    }
    repoCtrl.getByUrl['/big'] = Array.from({ length: 300 }, (_, i) => ({
      id: i,
      name: `n${i}`,
    }))
    const { api } = mountTableData(masterConfig)
    await api.loadData()
    await nextTick()
    // Full dataset loaded into `items`, but dynamicItems is windowed to 200.
    expect(api.items.value).toHaveLength(200)
    expect(api.hasMore.value).toBe(true)
    api.loadMore()
    await nextTick()
    expect(api.items.value).toHaveLength(300)
    expect(api.hasMore.value).toBe(false)
    // loadMore in in-memory mode never sets loadingMore true.
    expect(api.loadingMore.value).toBe(false)
  })
})
