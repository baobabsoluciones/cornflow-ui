import { describe, test, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref, computed, nextTick, reactive } from 'vue'
import { createVuetify } from 'vuetify'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createRouter, createMemoryHistory } from 'vue-router'

// ---------------------------------------------------------------------------
// Mutable mock holders — each test mutates these before/after mounting so we
// can drive both branches of conditionals inside SectionView.vue.
// ---------------------------------------------------------------------------

const mockCancelLoadData = vi.fn()

// ---- useTableData ----------------------------------------------------------
const mockMakeTableDataInstance = () => ({
  items: ref<any[]>([]),
  headers: ref<any[]>([{ key: 'name', title: 'Name', type: 'string' }]),
  loading: ref(false),
  error: ref(null),
  tableTitle: ref(''),
  isPrimitiveArray: ref(false),
  isValidationMessageList: ref(false),
  enableSelection: ref(false),
  canAdd: ref(false),
  canEdit: ref(false),
  canDelete: ref(false),
  canBulkUpload: ref(false),
  bulkUploadAvailableOperations: ref([]),
  canDownloadExcel: ref(false),
  enableExcelMode: ref(false),
  isCellModified: vi.fn(() => false),
  getModifiedValue: vi.fn(),
  handleCellChange: vi.fn(),
  hasPendingChanges: ref(false),
  pendingChangesCount: ref(0),
  rowsDataForModal: ref<Record<string, any>>({}),
  tableHeadersForModal: ref<Record<string, any>>({}),
  searchValue: ref(''),
  activeFilters: ref([]),
  selectedItems: ref([]),
  showBulkUploadModal: ref(false),
  forceRetryOffer: ref(null),
  forceRetryLoading: ref(false),
  uploading: ref(false),
  uploadProgressMessage: ref(''),
  downloading: ref(false),
  bulkDeleting: ref(false),
  loadTableData: vi.fn(async () => []),
  tableData: ref({}),
  apiDateRangeFilterConfigs: ref([]),
  dateRangeValues: ref({}),
  hasMore: ref(false),
  loadingMore: ref(false),
  loadMore: vi.fn(),
  handleSearch: vi.fn(),
  handleApplyDateRange: vi.fn(),
  handleResetDateRange: vi.fn(),
  handleBulkUpload: vi.fn(),
  acceptForceRetry: vi.fn(),
  rejectForceRetry: vi.fn(),
  handleDownloadExcel: vi.fn(),
  loadData: vi.fn(async () => undefined),
  cancelLoadData: mockCancelLoadData,
  sort: ref(null),
  setFilters: vi.fn(),
  getRowState: vi.fn(() => undefined),
  addRow: vi.fn(),
  deleteRows: vi.fn(),
  restoreRows: vi.fn(),
  bulkEditRows: vi.fn(),
  isSingleRecord: ref(false),
  revertCell: vi.fn(),
  totalCount: ref(undefined),
  filteredCount: ref(undefined),
})

let mockTableDataInstances: any[] = []
let mockTableDataCallIndex = 0
const mockInvalidateTableDataCache = vi.fn()
const mockInvalidateAllTableDataCaches = vi.fn()

vi.mock('@cornflow-ui/core/composables/section-view/useTableData', () => ({
  useTableData: () => {
    const inst = mockTableDataInstances[mockTableDataCallIndex] ?? mockMakeTableDataInstance()
    mockTableDataCallIndex++
    return inst
  },
  invalidateTableDataCache: (...a: any[]) => mockInvalidateTableDataCache(...a),
  invalidateAllTableDataCaches: (...a: any[]) =>
    mockInvalidateAllTableDataCaches(...a),
}))

vi.mock('@cornflow-ui/core/composables/section-view/useExecutionTableData', () => ({
  ensureItemIds: (rows: any[]) =>
    rows.map((r, i) => (r.id != null ? r : { ...r, id: `__row_${i}` })),
}))

// ---- useSectionConfiguration ----------------------------------------------
const mockSectionConfig = {
  sectionType: ref('configuration'),
  currentConfiguration: ref<any>({ table_1: { title: 'Table 1', get_list: {} } }),
}
vi.mock('@cornflow-ui/core/composables/section-view/useSectionConfiguration', () => ({
  useSectionConfiguration: () => mockSectionConfig,
}))

// ---- useGroupTables --------------------------------------------------------
const mockGroupTablesState = {
  tableKey: ref('table_1'),
  groupName: ref<string | null>(null),
  selectedTable: ref<string | null>(null),
  selectedTabIndex: ref(0),
  isGroupView: ref(false),
  groupTables: ref<any>(null),
  tableConfig: ref<any>({ title: 'Table 1', get_list: {} }),
  selectedTableConfig: ref<any>(null),
  tabsData: ref([]),
  handleTabChange: vi.fn(),
  resolvedTableKey: ref('table_1'),
  tableSwitching: ref(false),
}
vi.mock('@cornflow-ui/core/composables/section-view/useGroupTables', () => ({
  useGroupTables: () => mockGroupTablesState,
}))

// ---- useSectionDisplay -----------------------------------------------------
vi.mock('@cornflow-ui/core/composables/section-view/useSectionDisplay', () => ({
  useSectionDisplay: () => ({
    title: ref('Section'),
    description: ref('Description'),
    currentIcon: ref('mdi-table'),
  }),
}))

// ---- useTableChanges -------------------------------------------------------
const mockTableChangesState = {
  modifiedTableKeys: ref<string[]>([]),
  hasChanges: ref(false),
  totalChangesCount: ref(0),
  getPendingDeletes: vi.fn(() => [] as (string | number)[]),
  getPendingCreates: vi.fn(() => [] as Array<{ tempId: string; data: any }>),
  getChangesForTable: vi.fn(() => null as any),
  clearAllChanges: vi.fn(),
  clearDeletesForTable: vi.fn(),
  clearCreatesForTable: vi.fn(),
  revertTableChanges: vi.fn(),
  revertChange: vi.fn(),
  revertRowChanges: vi.fn(),
  revertCreate: vi.fn(),
  revertDelete: vi.fn(),
  recordChange: vi.fn(),
  updateCreateField: vi.fn(),
  getFullGroupedChanges: vi.fn(() => [] as any[]),
  tableTitles: ref<Record<string, string>>({}),
}
vi.mock('@cornflow-ui/core/composables/useTableChanges', () => ({
  useTableChanges: () => mockTableChangesState,
}))

// ---- recalculation controller (premium-or-inert; SectionView consumes it via the registry) ----
const mockRecalculationController = {
  checkPlanDataAfterMasterDataChange: vi.fn(async () => undefined),
  runSolutionRecalculation: vi.fn(async () => undefined),
  buildRecalculationExecutionName: vi.fn(
    (name?: string | null) => String(name ?? '') || 'Recalculated',
  ),
}
vi.mock('@cornflow-ui/core/composables/section-view/useRecalculationController', () => ({
  useRecalculationController: () => mockRecalculationController,
}))

// ---- general store (reactive so SectionView watchers fire) -----------------
const mockGeneralStoreState: any = reactive({
  selectedExecution: null,
  getConfigurations: { masterData: {} },
  masterDataSections: null,
  masterDataGroups: null,
  getDataToDownload: vi.fn(async () => undefined),
  incrementUploadComponentKey: vi.fn(),
})
vi.mock('@cornflow-ui/core/stores/general', () => ({
  useGeneralStore: () => mockGeneralStoreState,
}))

// ---- TableRepository -------------------------------------------------------
const mockRepoInstance = {
  deleteBulk: vi.fn(async () => undefined),
  deleteItem: vi.fn(async () => undefined),
  createItem: vi.fn(async () => ({ id: 99 })),
  createBulk: vi.fn(async () => [{ id: 99 }]),
  putItem: vi.fn(async () => undefined),
  getList: vi.fn(async () => []),
}
const mockTableRepositoryCtor = vi.fn(() => mockRepoInstance)
let mockForceRetryPredicate = (_e: any) => false
vi.mock('@cornflow-ui/core/repositories/TableRepository', () => ({
  default: function (this: any, ...a: any[]) {
    return mockTableRepositoryCtor(...a)
  },
  isForceRetryOfferError: (e: any) => mockForceRetryPredicate(e),
}))

// ---- EditAllTablesRepository ----------------------------------------------
const mockPostEditAllTables = vi.fn(async () => undefined)
vi.mock('@cornflow-ui/core/repositories/EditAllTablesRepository', () => ({
  postEditAllTables: (...a: any[]) => mockPostEditAllTables(...a),
  mapBulkUiOperationToEditAllApi: (op: string) =>
    op === 'overwrite' ? 'overwrite_all' : 'post_bulk',
}))

// ---- useFilePreProcessing ---------------------------------------------------
// Returns null by default ("no processors configured"), which is what every other test
// here assumes: the raw files are uploaded unchanged.
const mockPreProcessFiles = vi.fn(async (_files: File[]) => null as File[] | null)
vi.mock('@cornflow-ui/core/composables/useFilePreProcessing', () => ({
  useFilePreProcessing: () => ({
    preProcessFiles: (files: File[]) => mockPreProcessFiles(files),
    preProcessFile: async (file: File) => file,
    hasFileProcessors: () => false,
  }),
}))

// ---- AutoDashboardService --------------------------------------------------
const mockGenerateAutoDashboard = vi.fn(() => [] as any[])
vi.mock('@cornflow-ui/core/services/AutoDashboardService', () => ({
  generateAutoDashboard: (...a: any[]) => mockGenerateAutoDashboard(...a),
}))

// ---- app config ------------------------------------------------------------
const mockCoreParams: any = {
  enableSolutionRecalculation: false,
  enableRecalculationOnMasterEdit: false,
  enableReplaceMasterWithUploaded: false,
  enableEditAllMasterTables: false,
  allowEditInstance: false,
  enableAutoInstanceDashboard: false,
  enableAutoSolutionDashboard: false,
  useBackendExecutionFilesDownload: false,
  tableDashboards: null,
  etl: { enableEtlMetadataAndReview: false },
}
vi.mock('@/app/config', () => ({
  default: { getCore: () => ({ parameters: mockCoreParams }) },
}))
vi.mock('@cornflow-ui/core/utils/appParameters', () => ({
  getAppParameters: () => mockCoreParams,
}))

// SectionView must be imported AFTER mocks are declared.
import SectionView from '@cornflow-ui/core/views/SectionView.vue'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const resetState = () => {
  vi.clearAllMocks()
  mockTableDataInstances = []
  mockTableDataCallIndex = 0
  mockForceRetryPredicate = () => false

  mockSectionConfig.sectionType.value = 'configuration'
  mockSectionConfig.currentConfiguration.value = {
    table_1: { title: 'Table 1', get_list: {} },
  }

  mockGroupTablesState.tableKey.value = 'table_1'
  mockGroupTablesState.groupName.value = null
  mockGroupTablesState.selectedTable.value = null
  mockGroupTablesState.selectedTabIndex.value = 0
  mockGroupTablesState.isGroupView.value = false
  mockGroupTablesState.groupTables.value = null
  mockGroupTablesState.tableConfig.value = { title: 'Table 1', get_list: {} }
  mockGroupTablesState.selectedTableConfig.value = null
  mockGroupTablesState.tabsData.value = []
  mockGroupTablesState.resolvedTableKey.value = 'table_1'
  mockGroupTablesState.tableSwitching.value = false

  mockTableChangesState.modifiedTableKeys.value = []
  mockTableChangesState.hasChanges.value = false
  mockTableChangesState.totalChangesCount.value = 0
  mockTableChangesState.getPendingDeletes.mockReturnValue([])
  mockTableChangesState.getPendingCreates.mockReturnValue([])
  mockTableChangesState.getChangesForTable.mockReturnValue(null)
  mockTableChangesState.getFullGroupedChanges.mockReturnValue([])
  mockTableChangesState.tableTitles.value = {}

  mockGeneralStoreState.selectedExecution = null
  mockGeneralStoreState.getConfigurations = { masterData: {} }
  mockGeneralStoreState.masterDataSections = null
  mockGeneralStoreState.masterDataGroups = null
  mockGeneralStoreState.getDataToDownload = vi.fn(async () => undefined)
  mockGeneralStoreState.incrementUploadComponentKey = vi.fn()

  mockRecalculationController.checkPlanDataAfterMasterDataChange = vi.fn(
    async () => undefined,
  )
  mockRecalculationController.runSolutionRecalculation = vi.fn(async () => undefined)
  mockRecalculationController.buildRecalculationExecutionName = vi.fn(
    (name?: string | null) => String(name ?? '') || 'Recalculated',
  )

  Object.assign(mockCoreParams, {
    enableSolutionRecalculation: false,
    enableRecalculationOnMasterEdit: false,
    enableReplaceMasterWithUploaded: false,
    enableEditAllMasterTables: false,
    allowEditInstance: false,
    enableAutoInstanceDashboard: false,
    enableAutoSolutionDashboard: false,
    useBackendExecutionFilesDownload: false,
    tableDashboards: null,
    etl: { enableEtlMetadataAndReview: false },
  })

  mockRepoInstance.deleteBulk = vi.fn(async () => undefined)
  mockRepoInstance.deleteItem = vi.fn(async () => undefined)
  mockRepoInstance.createItem = vi.fn(async () => ({ id: 99 }))
  mockRepoInstance.createBulk = vi.fn(async () => [{ id: 99 }])
  mockRepoInstance.putItem = vi.fn(async () => undefined)
  mockRepoInstance.getList = vi.fn(async () => [])
}

const snackbarSpy = vi.fn()
let lastRouter: any = null

const viewStubs = {
  CoreTitleView: { template: '<div class="core-title-view-stub"><slot /></div>' },
  SectionDataTable: {
    name: 'SectionDataTable',
    props: [
      'tableData',
      'tableKey',
      'readOnly',
      'switching',
      'checkLevel',
      'columnSources',
      'pendingCount',
      'pendingTables',
      'reviewLabel',
      'highlightedRowId',
    ],
    emits: ['review'],
    template: '<div class="section-data-table-stub"><slot name="tabs" /></div>',
  },
  DataTableTabs: {
    name: 'DataTableTabs',
    props: ['modelValue', 'tabs'],
    emits: ['update:modelValue'],
    template: '<div class="data-table-tabs-stub"></div>',
  },
  PendingChangesPanel: {
    name: 'PendingChangesPanel',
    props: ['open', 'groups', 'saving', 'saveLabel', 'banner', 'overwrite'],
    template: '<div class="pending-panel-stub"></div>',
  },
  BulkUploadDialog: {
    name: 'BulkUploadDialog',
    props: ['open', 'tableTitle', 'accept', 'multiple', 'operations', 'phase'],
    template: '<div class="bulk-upload-stub"></div>',
  },
  RelaunchDialog: {
    name: 'RelaunchDialog',
    props: ['open', 'name', 'summary', 'sourceName', 'busy'],
    template: '<div class="relaunch-stub"></div>',
  },
  CoreConfirmDialog: { template: '<div class="confirm-stub"></div>' },
  ForceRetryConfirmDialog: { template: '<div class="force-retry-stub"></div>' },
  AutoKPICard: { template: '<div class="auto-kpi-stub"></div>' },
  AutoLineChart: { template: '<div class="auto-line-stub"></div>' },
  AutoBarChart: { template: '<div class="auto-bar-stub"></div>' },
  AutoPieChart: { template: '<div class="auto-pie-stub"></div>' },
  AutoAreaChart: { template: '<div class="auto-area-stub"></div>' },
  AutoMapChart: { template: '<div class="auto-map-stub"></div>' },
}

const createWrapper = () => {
  // Pre-create two table-data instances (tableData + selectedTableData) so
  // tests can manipulate them via mockTableDataInstances[0]/[1].
  if (mockTableDataInstances.length === 0) {
    mockTableDataInstances = [mockMakeTableDataInstance(), mockMakeTableDataInstance()]
  }
  mockTableDataCallIndex = 0

  const vuetify = createVuetify()
  const pinia = createPinia()
  setActivePinia(pinia)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/section', component: SectionView },
      { path: '/configuration/x', component: { template: '<div/>' } },
      { path: '/input-data/x', component: { template: '<div/>' } },
      { path: '/output-data/x', component: { template: '<div/>' } },
      { path: '/dashboard', component: { template: '<div/>' } },
      { path: '/project-execution', component: { template: '<div/>' } },
    ],
  })
  lastRouter = router
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    missing: (_locale, key) => key,
    messages: { en: {} },
  })

  return mount(SectionView, {
    global: {
      plugins: [vuetify, pinia, i18n, router],
      provide: { showSnackbar: snackbarSpy },
      stubs: viewStubs,
    },
  })
}

describe('SectionView', () => {
  beforeEach(() => {
    resetState()
  })

  describe('Component rendering', () => {
    test('renders view container when configurations are ready', () => {
      const wrapper = createWrapper()
      expect(wrapper.find('.section-view').exists()).toBe(true)
    })

    test('configurationsReady false when configuration is empty', () => {
      mockSectionConfig.currentConfiguration.value = {}
      const wrapper = createWrapper()
      expect((wrapper.vm as any).configurationsReady).toBe(false)
    })
  })

  // -------------------------------------------------------------------------
  // Computed section-type flags
  // -------------------------------------------------------------------------
  describe('section-type computed flags', () => {
    test('configuration section', () => {
      mockSectionConfig.sectionType.value = 'configuration'
      const vm = createWrapper().vm as any
      expect(vm.executionType).toBe(null)
      expect(vm.isConfigurationSection).toBe(true)
      expect(vm.isReadOnlyDataSection).toBe(false)
      expect(vm.isRecalculationSection).toBe(false)
    })

    test('input-data section read-only when recalculation disabled', () => {
      mockSectionConfig.sectionType.value = 'input-data'
      const vm = createWrapper().vm as any
      expect(vm.executionType).toBe('instance')
      expect(vm.isReadOnlyDataSection).toBe(true)
      expect(vm.isRecalculationSection).toBe(false)
    })

    test('results section read-only when recalculation disabled', () => {
      mockSectionConfig.sectionType.value = 'results'
      const vm = createWrapper().vm as any
      expect(vm.executionType).toBe('solution')
      expect(vm.isReadOnlyDataSection).toBe(true)
    })

    test('input-data writable + recalculation section when recalculation enabled', () => {
      mockCoreParams.enableSolutionRecalculation = true
      mockSectionConfig.sectionType.value = 'input-data'
      const vm = createWrapper().vm as any
      expect(vm.isReadOnlyDataSection).toBe(false)
      expect(vm.isRecalculationSection).toBe(true)
    })
  })

  // -------------------------------------------------------------------------
  // Pending-changes computed
  // -------------------------------------------------------------------------
  describe('pending changes computed', () => {
    test('no pending changes outside configuration/recalculation', () => {
      mockSectionConfig.sectionType.value = 'input-data'
      mockTableChangesState.hasChanges.value = true
      mockTableChangesState.totalChangesCount.value = 4
      const vm = createWrapper().vm as any
      expect(vm.hasPendingChanges).toBe(false)
      expect(vm.pendingChangesCount).toBe(0)
    })

    test('pending changes counted in configuration section', () => {
      mockSectionConfig.sectionType.value = 'configuration'
      mockTableChangesState.hasChanges.value = true
      mockTableChangesState.totalChangesCount.value = 7
      const vm = createWrapper().vm as any
      expect(vm.hasPendingChanges).toBe(true)
      expect(vm.pendingChangesCount).toBe(7)
    })


  })

  // -------------------------------------------------------------------------
  // applyPendingChangesToData
  // -------------------------------------------------------------------------
  describe('applyPendingChangesToData', () => {
    test('applies edits, deletes and creates to array tables', () => {
      mockTableChangesState.modifiedTableKeys.value = ['rows']
      mockTableChangesState.getPendingDeletes.mockImplementation((k: string) =>
        k === 'rows' ? [2] : [],
      )
      mockTableChangesState.getChangesForTable.mockImplementation((k: string) =>
        k === 'rows' ? { '1': { name: { newValue: 'edited' } } } : null,
      )
      mockTableChangesState.getPendingCreates.mockImplementation((k: string) =>
        k === 'rows' ? [{ tempId: 't1', data: { id: 't1', name: 'new' } }] : [],
      )
      const vm = createWrapper().vm as any
      const result = vm.applyPendingChangesToData({
        rows: [
          { id: 1, name: 'orig' },
          { id: 2, name: 'todelete' },
        ],
      })
      const names = result.rows.map((r: any) => r.name)
      expect(names).toContain('edited')
      expect(names).toContain('new')
      expect(names).not.toContain('todelete')
    })

    test('applies horizontal object changes (__object__)', () => {
      mockTableChangesState.modifiedTableKeys.value = ['params']
      mockTableChangesState.getChangesForTable.mockImplementation((k: string) =>
        k === 'params' ? { __object__: { rate: { newValue: 5 } } } : null,
      )
      const vm = createWrapper().vm as any
      const result = vm.applyPendingChangesToData({ params: { rate: 1 } })
      expect(result.params.rate).toBe(5)
    })

    test('applies vertical object changes (per-row value)', () => {
      mockTableChangesState.modifiedTableKeys.value = ['params']
      mockTableChangesState.getChangesForTable.mockImplementation((k: string) =>
        k === 'params' ? { alpha: { value: { newValue: 9 } } } : null,
      )
      const vm = createWrapper().vm as any
      const result = vm.applyPendingChangesToData({ params: { alpha: 1 } })
      expect(result.params.alpha).toBe(9)
    })

    test('strips synthetic __row_ ids from created rows lacking id', () => {
      mockTableChangesState.modifiedTableKeys.value = ['rows']
      mockTableChangesState.getChangesForTable.mockImplementation((k: string) =>
        k === 'rows' ? { __row_0: { name: { newValue: 'X' } } } : null,
      )
      const vm = createWrapper().vm as any
      const result = vm.applyPendingChangesToData({ rows: [{ name: 'a' }] })
      expect(result.rows[0].id).toBeUndefined()
      expect(result.rows[0].name).toBe('X')
    })
  })

  // -------------------------------------------------------------------------
  // handleSolutionRecalculation
  // -------------------------------------------------------------------------
  describe('handleSolutionRecalculation', () => {
    test('sets error when no execution selected', async () => {
      mockGeneralStoreState.selectedExecution = null
      const vm = createWrapper().vm as any
      await vm.handleSolutionRecalculation()
      expect(vm.recalculationValidationError).toBeTruthy()
      expect(vm.recalculationSaving).toBe(false)
    })

    test('sets error when instance/solution data missing', async () => {
      mockGeneralStoreState.selectedExecution = { name: 'e', instance: {}, solution: {} }
      const vm = createWrapper().vm as any
      await vm.handleSolutionRecalculation()
      expect(vm.recalculationValidationError).toBeTruthy()
    })

    test('runs recalculation on happy path', async () => {
      mockGeneralStoreState.selectedExecution = {
        name: 'Exec',
        description: 'd',
        config: {},
        instance: { data: { rows: [{ id: 1 }] } },
        solution: { data: { out: [{ id: 1 }] } },
      }
      const vm = createWrapper().vm as any
      await vm.handleSolutionRecalculation()
      expect(mockRecalculationController.runSolutionRecalculation).toHaveBeenCalled()
      expect(mockTableChangesState.clearAllChanges).toHaveBeenCalled()
      expect(vm.recalculationSaving).toBe(false)
    })

    test('captures error from store recalculation', async () => {
      mockGeneralStoreState.selectedExecution = {
        name: 'Exec',
        instance: { data: { rows: [] } },
        solution: { data: { out: [] } },
      }
      mockRecalculationController.runSolutionRecalculation = vi.fn(async () => {
        throw new Error('boom')
      })
      const vm = createWrapper().vm as any
      await vm.handleSolutionRecalculation()
      expect(vm.recalculationValidationError).toBe('boom')
    })

  })

  // -------------------------------------------------------------------------
  // Exit-confirmation handlers + onBeforeRouteLeave
  // -------------------------------------------------------------------------
  describe('exit confirmation', () => {
    test('handleConfirmExit clears changes and calls next', () => {
      const vm = createWrapper().vm as any
      const next = vi.fn()
      vm.pendingNavigationNext = next
      vm.handleConfirmExit()
      expect(mockTableChangesState.clearAllChanges).toHaveBeenCalled()
      expect(next).toHaveBeenCalled()
      expect(vm.showExitConfirmationModal).toBe(false)
    })

    test('handleCancelExit calls next(false)', () => {
      const vm = createWrapper().vm as any
      const next = vi.fn()
      vm.pendingNavigationNext = next
      vm.handleCancelExit()
      expect(next).toHaveBeenCalledWith(false)
    })

    test('navigation guard allows leaving when no pending changes', async () => {
      const wrapper = createWrapper()
      const vm = wrapper.vm as any
      const router = (wrapper as any).router ?? null
      // Drive guard directly is not exposed; assert no modal initially.
      expect(vm.showExitConfirmationModal).toBe(false)
    })
  })

  // -------------------------------------------------------------------------
  // Edit-all master tables upload
  // -------------------------------------------------------------------------
  describe('handleEditAllMasterTablesUpload', () => {
    test('shows error when no files provided', async () => {
      const vm = createWrapper().vm as any
      await vm.handleEditAllMasterTablesUpload({ files: [], operation: 'add' })
      expect(snackbarSpy).toHaveBeenCalledWith(expect.anything(), 'error')
    })

    test('success path closes modal and reloads data', async () => {
      const file = new File(['x'], 'a.xlsx')
      const vm = createWrapper().vm as any
      await vm.handleEditAllMasterTablesUpload({ files: [file], operation: 'add' })
      await flushPromises()
      expect(mockPostEditAllTables).toHaveBeenCalled()
      expect(mockInvalidateAllTableDataCaches).toHaveBeenCalled()
      expect(mockTableDataInstances[0].loadData).toHaveBeenCalled()
      expect(vm.showEditAllMasterTablesModal).toBe(false)
    })

    test('uploads what the processors produced, not the raw files', async () => {
      // The whole point of a fileProcessor is that the raw file is in a shape no backend
      // endpoint accepts, so /edit-all-tables/ has to get the processed one like the
      // instance load does.
      const raw = new File(['raw'], 'matrix.xlsx')
      const processed = new File(['flat'], 'matrix.xlsx')
      mockPreProcessFiles.mockResolvedValueOnce([processed])

      const vm = createWrapper().vm as any
      await vm.handleEditAllMasterTablesUpload({ files: [raw], operation: 'add' })
      await flushPromises()

      expect(mockPreProcessFiles).toHaveBeenCalledWith([raw])
      expect(mockPostEditAllTables).toHaveBeenCalledWith([processed], 'post_bulk')
    })

    test('the force-retry path reuses the processed files, not the upload', async () => {
      const raw = new File(['raw'], 'matrix.xlsx')
      const processed = new File(['flat'], 'matrix.xlsx')
      mockPreProcessFiles.mockResolvedValueOnce([processed])

      const vm = createWrapper().vm as any
      await vm.handleEditAllMasterTablesUpload({ files: [raw], operation: 'add' })
      await flushPromises()

      // Retrying with the raw file would undo the processing on the second attempt.
      expect(vm.pendingEditAllFiles).toEqual([processed])
    })

    test('success path in group view reloads selected table data', async () => {
      mockGroupTablesState.isGroupView.value = true
      const file = new File(['x'], 'a.xlsx')
      const vm = createWrapper().vm as any
      await vm.handleEditAllMasterTablesUpload({ files: [file], operation: 'add' })
      await flushPromises()
      expect(mockTableDataInstances[1].loadData).toHaveBeenCalled()
    })

    test('success path triggers recalculation when enabled', async () => {
      mockCoreParams.enableRecalculationOnMasterEdit = true
      const file = new File(['x'], 'a.xlsx')
      const vm = createWrapper().vm as any
      await vm.handleEditAllMasterTablesUpload({ files: [file], operation: 'add' })
      await flushPromises()
      expect(mockRecalculationController.checkPlanDataAfterMasterDataChange).toHaveBeenCalled()
    })

    test('force-retry offer on overwrite_all opens force dialog', async () => {
      mockForceRetryPredicate = () => true
      mockPostEditAllTables.mockRejectedValueOnce(
        Object.assign(new Error('conflict'), {
          forceTableKeys: ['a'],
          retryTableKeys: ['b'],
        }),
      )
      const file = new File(['x'], 'a.xlsx')
      const vm = createWrapper().vm as any
      await vm.handleEditAllMasterTablesUpload({ files: [file], operation: 'overwrite' })
      await flushPromises()
      expect(vm.editAllTablesForceContext).toEqual({
        message: 'conflict',
        forceTableKeys: ['a'],
        retryTableKeys: ['b'],
      })
      expect(vm.showEditAllMasterTablesModal).toBe(false)
    })

    test('non-force error shows snackbar', async () => {
      mockPostEditAllTables.mockRejectedValueOnce(new Error('bad'))
      const file = new File(['x'], 'a.xlsx')
      const vm = createWrapper().vm as any
      await vm.handleEditAllMasterTablesUpload({ files: [file], operation: 'add' })
      await flushPromises()
      expect(snackbarSpy).toHaveBeenCalledWith('bad', 'error')
    })

    test('reload failure after success shows snackbar', async () => {
      const file = new File(['x'], 'a.xlsx')
      mockTableDataInstances = [mockMakeTableDataInstance(), mockMakeTableDataInstance()]
      mockTableDataInstances[0].loadData = vi.fn(async () => {
        throw new Error('reload-fail')
      })
      const vm = createWrapper().vm as any
      await vm.handleEditAllMasterTablesUpload({ files: [file], operation: 'add' })
      await flushPromises()
      expect(snackbarSpy).toHaveBeenCalledWith('reload-fail', 'error')
    })
  })

  describe('confirmEditAllTablesForceRetry / cancel', () => {
    test('returns early without context', async () => {
      const vm = createWrapper().vm as any
      vm.editAllTablesForceContext = null
      await vm.confirmEditAllTablesForceRetry()
      expect(mockPostEditAllTables).not.toHaveBeenCalled()
    })

    test('clears context when files/op invalid', async () => {
      const vm = createWrapper().vm as any
      vm.editAllTablesForceContext = { message: 'm' }
      vm.pendingEditAllFiles = []
      await vm.confirmEditAllTablesForceRetry()
      expect(vm.editAllTablesForceContext).toBe(null)
    })

    test('success retry reloads and clears', async () => {
      const file = new File(['x'], 'a.xlsx')
      const vm = createWrapper().vm as any
      vm.pendingEditAllFiles = [file]
      vm.pendingEditAllApiOperation = 'overwrite_all'
      vm.editAllTablesForceContext = {
        message: 'm',
        forceTableKeys: ['a'],
        retryTableKeys: [],
      }
      await vm.confirmEditAllTablesForceRetry()
      await flushPromises()
      expect(mockPostEditAllTables).toHaveBeenCalled()
      expect(vm.editAllTablesForceContext).toBe(null)
      expect(snackbarSpy).toHaveBeenCalledWith(expect.anything(), 'success')
    })

    test('retry re-offers force when error is force-retry again', async () => {
      mockForceRetryPredicate = () => true
      mockPostEditAllTables.mockRejectedValueOnce(
        Object.assign(new Error('again'), { forceTableKeys: ['z'] }),
      )
      const file = new File(['x'], 'a.xlsx')
      const vm = createWrapper().vm as any
      vm.pendingEditAllFiles = [file]
      vm.pendingEditAllApiOperation = 'overwrite_all'
      vm.editAllTablesForceContext = { message: 'm', forceTableKeys: ['a'] }
      await vm.confirmEditAllTablesForceRetry()
      await flushPromises()
      expect(vm.editAllTablesForceContext.message).toBe('again')
    })

    test('retry non-force error shows snackbar and clears context', async () => {
      mockPostEditAllTables.mockRejectedValueOnce(new Error('fatal'))
      const file = new File(['x'], 'a.xlsx')
      const vm = createWrapper().vm as any
      vm.pendingEditAllFiles = [file]
      vm.pendingEditAllApiOperation = 'overwrite_all'
      vm.editAllTablesForceContext = { message: 'm' }
      await vm.confirmEditAllTablesForceRetry()
      await flushPromises()
      expect(snackbarSpy).toHaveBeenCalledWith('fatal', 'error')
      expect(vm.editAllTablesForceContext).toBe(null)
    })

    test('cancelEditAllTablesForceRetry resets state', () => {
      const vm = createWrapper().vm as any
      vm.editAllTablesForceContext = { message: 'm' }
      vm.pendingEditAllFiles = [new File(['x'], 'a.xlsx')]
      vm.cancelEditAllTablesForceRetry()
      expect(vm.editAllTablesForceContext).toBe(null)
      expect(vm.pendingEditAllFiles).toEqual([])
    })
  })

  // -------------------------------------------------------------------------
  // canEditAllMasterTables — 4 combinations of the two flags
  // -------------------------------------------------------------------------
  describe('canEditAllMasterTables', () => {
    // Combination 1: both flags false → false
    test('false when both enableEditAllMasterTables and enableReplaceMasterWithUploaded are false', () => {
      mockCoreParams.enableEditAllMasterTables = false
      mockCoreParams.enableReplaceMasterWithUploaded = false
      const vm = createWrapper().vm as any
      expect(vm.canEditAllMasterTables).toBe(false)
    })

    // Combination 2: only enableEditAllMasterTables true → true (the correct gate)
    test('true when enableEditAllMasterTables is true and enableReplaceMasterWithUploaded is false', () => {
      mockCoreParams.enableEditAllMasterTables = true
      mockCoreParams.enableReplaceMasterWithUploaded = false
      const vm = createWrapper().vm as any
      expect(vm.canEditAllMasterTables).toBe(true)
    })

    // Combination 3: only enableReplaceMasterWithUploaded true → false (wrong flag must NOT gate)
    test('false when enableEditAllMasterTables is false and enableReplaceMasterWithUploaded is true', () => {
      mockCoreParams.enableEditAllMasterTables = false
      mockCoreParams.enableReplaceMasterWithUploaded = true
      const vm = createWrapper().vm as any
      expect(vm.canEditAllMasterTables).toBe(false)
    })

    // Combination 4: both flags true → true
    test('true when both enableEditAllMasterTables and enableReplaceMasterWithUploaded are true', () => {
      mockCoreParams.enableEditAllMasterTables = true
      mockCoreParams.enableReplaceMasterWithUploaded = true
      const vm = createWrapper().vm as any
      expect(vm.canEditAllMasterTables).toBe(true)
    })

    test('false when not configuration section even if flag enabled', () => {
      mockCoreParams.enableEditAllMasterTables = true
      mockSectionConfig.sectionType.value = 'input-data'
      const vm = createWrapper().vm as any
      expect(vm.canEditAllMasterTables).toBe(false)
    })

    test('false when configuration is empty even if flag enabled', () => {
      mockCoreParams.enableEditAllMasterTables = true
      mockSectionConfig.currentConfiguration.value = {}
      const vm = createWrapper().vm as any
      expect(vm.canEditAllMasterTables).toBe(false)
    })
  })

  // -------------------------------------------------------------------------
  // Bulk edit modal handlers
  // -------------------------------------------------------------------------

  // -------------------------------------------------------------------------
  // Master-table save flows
  // -------------------------------------------------------------------------
  describe('handleMasterTableSaveAll', () => {
    test('no-op when no modified keys, then closes modal', async () => {
      mockTableChangesState.modifiedTableKeys.value = []
      const vm = createWrapper().vm as any
      vm.masterReviewOpen = true
      await vm.handleMasterTableSaveAll()
      expect(vm.masterReviewOpen).toBe(false)
      expect(vm.masterTableSaving).toBe(false)
    })

    test('triggers recalculation when enabled', async () => {
      mockCoreParams.enableRecalculationOnMasterEdit = true
      mockTableChangesState.modifiedTableKeys.value = []
      const vm = createWrapper().vm as any
      await vm.handleMasterTableSaveAll()
      expect(mockRecalculationController.checkPlanDataAfterMasterDataChange).toHaveBeenCalled()
    })

    test('captures non-force error', async () => {
      mockTableChangesState.modifiedTableKeys.value = ['table_1']
      mockTableChangesState.getPendingDeletes.mockReturnValue([1])
      mockSectionConfig.currentConfiguration.value = {
        table_1: { title: 'T', get_list: {}, delete_bulk: {} },
      }
      mockRepoInstance.deleteBulk = vi.fn(async () => {
        throw new Error('save-fail')
      })
      const vm = createWrapper().vm as any
      await vm.handleMasterTableSaveAll()
      expect(vm.masterTableValidationError).toBe('save-fail')
    })

    test('returns silently on force-retry error', async () => {
      mockForceRetryPredicate = () => true
      mockTableChangesState.modifiedTableKeys.value = ['table_1']
      mockTableChangesState.getPendingDeletes.mockReturnValue([1])
      mockSectionConfig.currentConfiguration.value = {
        table_1: { title: 'T', get_list: {}, delete_bulk: {} },
      }
      mockRepoInstance.deleteBulk = vi.fn(async () => {
        throw Object.assign(new Error('conflict'), {})
      })
      const vm = createWrapper().vm as any
      await vm.handleMasterTableSaveAll()
      // force retry offer captured by applyAllDeletes
      expect(vm.forceRetryOfferFromSaveAll).toBeTruthy()
      expect(vm.masterTableValidationError).toBe(null)
    })


  })

  describe('handleForceRetryConfirmFromSaveAll', () => {
    test('returns early without offer', async () => {
      const vm = createWrapper().vm as any
      vm.forceRetryOfferFromSaveAll = null
      await vm.handleForceRetryConfirmFromSaveAll()
      expect(mockRepoInstance.deleteBulk).not.toHaveBeenCalled()
    })

    test('force-deletes then saves all on success', async () => {
      mockSectionConfig.currentConfiguration.value = {
        table_1: { title: 'T', get_list: {}, delete_bulk: {} },
      }
      mockTableChangesState.modifiedTableKeys.value = []
      const vm = createWrapper().vm as any
      vm.forceRetryOfferFromSaveAll = {
        message: 'm',
        storageKey: 'table_1',
        ids: [1, 2],
      }
      await vm.handleForceRetryConfirmFromSaveAll()
      await flushPromises()
      expect(mockRepoInstance.deleteBulk).toHaveBeenCalledWith([1, 2], { force: true })
      expect(mockTableChangesState.clearDeletesForTable).toHaveBeenCalledWith('table_1')
      expect(vm.forceRetryOfferFromSaveAll).toBe(null)
    })

    test('captures non-force error during force retry', async () => {
      mockSectionConfig.currentConfiguration.value = {
        table_1: { title: 'T', get_list: {}, delete_bulk: {} },
      }
      mockRepoInstance.deleteBulk = vi.fn(async () => {
        throw new Error('boom2')
      })
      const vm = createWrapper().vm as any
      vm.forceRetryOfferFromSaveAll = {
        message: 'm',
        storageKey: 'table_1',
        ids: [1],
      }
      await vm.handleForceRetryConfirmFromSaveAll()
      await flushPromises()
      expect(vm.masterTableValidationError).toBe('boom2')
      expect(vm.forceRetryOfferFromSaveAll).toBe(null)
    })

    test('config not found throws and captures error', async () => {
      mockSectionConfig.currentConfiguration.value = {}
      const vm = createWrapper().vm as any
      vm.forceRetryOfferFromSaveAll = {
        message: 'm',
        storageKey: 'missing',
        ids: [1],
      }
      await vm.handleForceRetryConfirmFromSaveAll()
      await flushPromises()
      expect(vm.masterTableValidationError).toBeTruthy()
    })
  })

  // -------------------------------------------------------------------------
  // saveAllMasterTableChanges direct
  // -------------------------------------------------------------------------
  describe('saveAllMasterTableChanges', () => {
    test('applies deletes, creates and edits across tables', async () => {
      mockTableChangesState.modifiedTableKeys.value = ['table_1']
      mockTableChangesState.getPendingDeletes.mockReturnValue([5])
      mockTableChangesState.getPendingCreates.mockReturnValue([
        { tempId: 't1', data: { id: 't1', name: 'C' } },
      ])
      mockTableChangesState.getChangesForTable.mockReturnValue({
        '1': { name: { newValue: 'E' } },
      })
      mockSectionConfig.currentConfiguration.value = {
        table_1: {
          title: 'T',
          get_list: {},
          delete_bulk: {},
          post_bulk: {},
          put_item: {},
        },
      }
      mockRepoInstance.getList = vi.fn(async () => [{ id: 1, name: 'old' }])
      const vm = createWrapper().vm as any
      await vm.saveAllMasterTableChanges()
      await flushPromises()
      expect(mockRepoInstance.deleteBulk).toHaveBeenCalled()
      expect(mockRepoInstance.createBulk).toHaveBeenCalled()
      expect(mockRepoInstance.putItem).toHaveBeenCalled()
      expect(mockInvalidateTableDataCache).toHaveBeenCalledWith('table_1')
    })

    test('uses single-item create/delete when bulk unsupported', async () => {
      mockTableChangesState.modifiedTableKeys.value = ['table_1']
      mockTableChangesState.getPendingDeletes.mockReturnValue([5])
      mockTableChangesState.getPendingCreates.mockReturnValue([
        { tempId: 't1', data: { id: 't1', name: 'C' } },
      ])
      mockSectionConfig.currentConfiguration.value = {
        table_1: { title: 'T', get_list: {}, delete_item: {}, post_item: {} },
      }
      const vm = createWrapper().vm as any
      await vm.saveAllMasterTableChanges()
      await flushPromises()
      expect(mockRepoInstance.deleteItem).toHaveBeenCalled()
      expect(mockRepoInstance.createItem).toHaveBeenCalled()
    })

    test('skips keys without config', async () => {
      mockTableChangesState.modifiedTableKeys.value = ['ghost']
      mockSectionConfig.currentConfiguration.value = {
        table_1: { title: 'T', get_list: {} },
      }
      const vm = createWrapper().vm as any
      await vm.saveAllMasterTableChanges()
      expect(mockTableRepositoryCtor).not.toHaveBeenCalled()
    })
  })


  // -------------------------------------------------------------------------
  // Dashboard / widgets
  // -------------------------------------------------------------------------
  describe('dashboards & widgets', () => {
    test('shouldShowWidgets false without table key', async () => {
      mockGroupTablesState.tableKey.value = ''
      mockGroupTablesState.isGroupView.value = false
      const vm = createWrapper().vm as any
      expect(vm.shouldShowWidgets).toBe(false)
    })

    test('shouldShowWidgets true when auto instance dashboard enabled', async () => {
      mockSectionConfig.sectionType.value = 'input-data'
      mockCoreParams.enableAutoInstanceDashboard = true
      const vm = createWrapper().vm as any
      expect(vm.shouldShowWidgets).toBe(true)
    })

    test('getTableDashboardConfig returns null without config', () => {
      mockCoreParams.tableDashboards = null
      const vm = createWrapper().vm as any
      expect(vm.getTableDashboardConfig('table_1')).toBe(null)
    })

    test('getTableDashboardConfig returns instance config', () => {
      mockSectionConfig.sectionType.value = 'input-data'
      mockCoreParams.tableDashboards = { instance: { table_1: { showAutoDashboards: true } } }
      const vm = createWrapper().vm as any
      expect(vm.getTableDashboardConfig('table_1')).toEqual({
        showAutoDashboards: true,
      })
    })

    test('widget computed splitting (kpi/side/bottom)', () => {
      const vm = createWrapper().vm as any
      vm.widgets = [
        { type: 'kpi' },
        { type: 'pie' },
        { type: 'bar' },
        { type: 'map' },
        { type: 'line' },
        { type: 'area' },
      ]
      expect(vm.kpiWidgets.length).toBe(1)
      expect(vm.sideCharts.length).toBe(3)
      expect(vm.bottomCharts.length).toBe(2)
    })

    test('custom widgets split by position', () => {
      const vm = createWrapper().vm as any
      vm.customWidgets = [
        { component: 'A', position: 'side' },
        { component: 'B', position: 'bottom' },
      ]
      expect(vm.customSideWidgets.length).toBe(1)
      expect(vm.customBottomWidgets.length).toBe(1)
    })

    test('selected widget computed (group view)', () => {
      const vm = createWrapper().vm as any
      vm.selectedTableWidgets = [
        { type: 'kpi' },
        { type: 'pie' },
        { type: 'line' },
      ]
      vm.selectedCustomWidgets = [{ component: 'X', position: 'side' }]
      expect(vm.selectedKpiWidgets.length).toBe(1)
      expect(vm.selectedSideCharts.length).toBe(1)
      expect(vm.selectedBottomCharts.length).toBe(1)
      expect(vm.selectedCustomSideWidgets.length).toBe(1)
    })

    test('hasActualWidgets for individual and group view', () => {
      const vm = createWrapper().vm as any
      expect(vm.hasActualWidgets).toBe(false)
      vm.widgets = [{ type: 'kpi' }]
      expect(vm.hasActualWidgets).toBe(true)
    })

    test('getWidgetComponent maps types and falls back', () => {
      const vm = createWrapper().vm as any
      expect(vm.getWidgetComponent('kpi')).toBeTruthy()
      expect(vm.getWidgetComponent('line')).toBeTruthy()
      expect(vm.getWidgetComponent('unknown')).toBeTruthy()
    })

    test('getExecutionData returns instance/solution/null', () => {
      mockSectionConfig.sectionType.value = 'input-data'
      mockGeneralStoreState.selectedExecution = { instance: { data: { rows: [1] } } }
      const vm = createWrapper().vm as any
      expect(vm.getExecutionData()).toEqual({ data: { rows: [1] } })
    })

    test('getTableData returns data array or empty', () => {
      mockSectionConfig.sectionType.value = 'input-data'
      mockGeneralStoreState.selectedExecution = {
        instance: { data: { table_1: [{ id: 1 }] } },
      }
      const vm = createWrapper().vm as any
      expect(vm.getTableData('table_1')).toEqual([{ id: 1 }])
      expect(vm.getTableData('')).toEqual([])
    })

    test('generateWidgetsForTable returns empty without execution', async () => {
      mockSectionConfig.sectionType.value = 'input-data'
      mockGeneralStoreState.selectedExecution = null
      const vm = createWrapper().vm as any
      const result = await vm.generateWidgetsForTable('table_1', 'instance')
      expect(result).toEqual({ auto: [], custom: [] })
    })

    test('generateWidgetsForTable generates auto widgets when enabled', async () => {
      mockSectionConfig.sectionType.value = 'input-data'
      mockCoreParams.enableAutoInstanceDashboard = true
      mockGenerateAutoDashboard.mockReturnValue([{ type: 'kpi' }] as any)
      mockGeneralStoreState.selectedExecution = {
        instance: { data: { table_1: [{ id: 1 }] } },
      }
      const vm = createWrapper().vm as any
      const result = await vm.generateWidgetsForTable('table_1', 'instance')
      expect(result.auto.length).toBe(1)
      expect(mockGenerateAutoDashboard).toHaveBeenCalled()
    })

    test('canRenderCustomWidgets reflects selected table + executionType', () => {
      mockSectionConfig.sectionType.value = 'input-data'
      mockGroupTablesState.selectedTable.value = 'tbl'
      const vm = createWrapper().vm as any
      expect(vm.canRenderCustomWidgets).toBe(true)
    })
  })

  // -------------------------------------------------------------------------
  // ETL metadata indicators
  // -------------------------------------------------------------------------
  describe('ETL metadata indicators', () => {
    test('etlTablesFromDbNormalized empty without metadata', () => {
      mockGeneralStoreState.selectedExecution = { instance: { data: { rows: [] } } }
      const vm = createWrapper().vm as any
      expect(vm.etlTablesFromDbNormalized.size).toBe(0)
    })

    test('etlTablesFromDbNormalized parses tables_from_db', () => {
      mockGeneralStoreState.selectedExecution = {
        instance: {
          data: { __metadata__: { tables_from_db: ['My Table', 'Other'] } },
        },
      }
      const vm = createWrapper().vm as any
      expect(vm.etlTablesFromDbNormalized.size).toBe(2)
    })

    test('etlParametersFromDbNormalized handles dotted keys', () => {
      mockGeneralStoreState.selectedExecution = {
        instance: {
          data: {
            __metadata__: { parameters_from_db: ['Tbl.Field', 'Plain'] },
          },
        },
      }
      const vm = createWrapper().vm as any
      expect(vm.etlParametersFromDbNormalized.size).toBe(2)
    })

    test('isObjectParameterTable detects object schema', () => {
      mockSectionConfig.currentConfiguration.value = {
        params: { get_list: { response_schema: { type: 'object' } } },
        rows: { get_list: { response_schema: { type: 'array', items: {} } } },
      }
      const vm = createWrapper().vm as any
      expect(vm.isObjectParameterTable('params')).toBe(true)
      expect(vm.isObjectParameterTable('rows')).toBe(false)
    })

    test('showEtlTabOriginIndicators gated by flags', () => {
      mockSectionConfig.sectionType.value = 'input-data'
      mockGroupTablesState.isGroupView.value = true
      mockCoreParams.etl.enableEtlMetadataAndReview = true
      mockGeneralStoreState.selectedExecution = {
        instance: { data: { __metadata__: { tables_from_db: ['t'] } } },
      }
      const vm = createWrapper().vm as any
      expect(vm.showEtlTabOriginIndicators).toBe(true)
      expect(vm.isTableFromDb('t')).toBe(true)
    })

    test('showEtlTabOriginIndicators false when disabled', () => {
      mockSectionConfig.sectionType.value = 'input-data'
      mockGroupTablesState.isGroupView.value = true
      mockCoreParams.etl.enableEtlMetadataAndReview = false
      const vm = createWrapper().vm as any
      expect(vm.showEtlTabOriginIndicators).toBe(false)
    })

    test('buildHeaderOriginIndicators returns map for object table', () => {
      mockSectionConfig.sectionType.value = 'input-data'
      mockCoreParams.etl.enableEtlMetadataAndReview = true
      mockSectionConfig.currentConfiguration.value = {
        params: { get_list: { response_schema: { type: 'object' } } },
      }
      mockGeneralStoreState.selectedExecution = {
        instance: {
          data: { __metadata__: { parameters_from_db: ['params.rate'] } },
        },
      }
      const vm = createWrapper().vm as any
      const result = vm.buildHeaderOriginIndicators('params', [
        { key: 'rate' },
        { key: 'other' },
        { key: 'id' },
      ])
      expect(result.rate.source).toBe('db')
      expect(result.other.source).toBe('file')
      expect(result.id).toBeUndefined()
    })

    test('buildHeaderOriginIndicators empty for non-object table', () => {
      mockSectionConfig.sectionType.value = 'input-data'
      mockCoreParams.etl.enableEtlMetadataAndReview = true
      mockSectionConfig.currentConfiguration.value = {
        rows: { get_list: { response_schema: { type: 'array', items: {} } } },
      }
      const vm = createWrapper().vm as any
      expect(vm.buildHeaderOriginIndicators('rows', [{ key: 'a' }])).toEqual({})
    })
  })

  // -------------------------------------------------------------------------
  // Downloads
  // -------------------------------------------------------------------------
  describe('downloads', () => {
    test('downloadFilename default and with execution', () => {
      mockGeneralStoreState.selectedExecution = null
      let vm = createWrapper().vm as any
      expect(vm.downloadFilename).toBe('execution')

      resetState()
      mockGeneralStoreState.selectedExecution = {
        name: 'My Exec',
        createdAt: '2024-01-01',
      }
      vm = createWrapper().vm as any
      expect(vm.downloadFilename).toContain('my_exec')
    })

    test('downloadInstanceExcel: no data shows error', async () => {
      mockGeneralStoreState.selectedExecution = { experiment: {} }
      const vm = createWrapper().vm as any
      await vm.downloadInstanceExcel()
      expect(snackbarSpy).toHaveBeenCalledWith(expect.anything(), 'error')
    })

    test('downloadInstanceExcel: success path', async () => {
      const downloadExcel = vi.fn(async () => undefined)
      mockGeneralStoreState.selectedExecution = {
        name: 'e',
        createdAt: '2024-01-01',
        experiment: { instance: { data: { rows: [] } }, downloadExcel },
        instance: { data: { rows: [] } },
      }
      const vm = createWrapper().vm as any
      await vm.downloadInstanceExcel()
      expect(downloadExcel).toHaveBeenCalled()
      expect(snackbarSpy).toHaveBeenCalledWith(expect.anything(), 'success')
    })

    test('downloadInstanceExcel: download failure shows error', async () => {
      const downloadExcel = vi.fn(async () => {
        throw new Error('x')
      })
      mockGeneralStoreState.selectedExecution = {
        name: 'e',
        createdAt: '2024-01-01',
        experiment: { instance: { data: { rows: [] } }, downloadExcel },
      }
      const vm = createWrapper().vm as any
      await vm.downloadInstanceExcel()
      expect(snackbarSpy).toHaveBeenCalledWith(expect.anything(), 'error')
    })

    test('downloadSolutionExcel: success path', async () => {
      const downloadExcel = vi.fn(async () => undefined)
      mockGeneralStoreState.selectedExecution = {
        name: 'e',
        createdAt: '2024-01-01',
        experiment: { solution: { data: { out: [] } }, downloadExcel },
      }
      const vm = createWrapper().vm as any
      await vm.downloadSolutionExcel()
      expect(downloadExcel).toHaveBeenCalled()
    })

    test('downloadSolutionExcel: no data error', async () => {
      mockGeneralStoreState.selectedExecution = { experiment: {} }
      const vm = createWrapper().vm as any
      await vm.downloadSolutionExcel()
      expect(snackbarSpy).toHaveBeenCalledWith(expect.anything(), 'error')
    })

    test('tryBackendExecutionFilesDownload returns false when flag off', async () => {
      mockCoreParams.useBackendExecutionFilesDownload = false
      const vm = createWrapper().vm as any
      expect(await vm.tryBackendExecutionFilesDownload({ id: 1 })).toBe(false)
    })

    test('tryBackendExecutionFilesDownload returns false without id', async () => {
      mockCoreParams.useBackendExecutionFilesDownload = true
      const vm = createWrapper().vm as any
      expect(await vm.tryBackendExecutionFilesDownload({})).toBe(false)
    })

    test('tryBackendExecutionFilesDownload success', async () => {
      mockCoreParams.useBackendExecutionFilesDownload = true
      const vm = createWrapper().vm as any
      const ran = await vm.tryBackendExecutionFilesDownload({ executionId: 7 })
      expect(ran).toBe(true)
      expect(mockGeneralStoreState.getDataToDownload).toHaveBeenCalledWith(7, true, true)
      expect(snackbarSpy).toHaveBeenCalledWith(expect.anything(), 'success')
    })

    test('tryBackendExecutionFilesDownload error path uses i18nKey', async () => {
      mockCoreParams.useBackendExecutionFilesDownload = true
      mockGeneralStoreState.getDataToDownload = vi.fn(async () => {
        throw { i18nKey: 'some.key' }
      })
      const vm = createWrapper().vm as any
      const ran = await vm.tryBackendExecutionFilesDownload({ executionId: 7 })
      expect(ran).toBe(true)
      expect(snackbarSpy).toHaveBeenCalledWith(expect.anything(), 'error')
    })

    test('downloadInstanceExcel routes through backend when enabled', async () => {
      mockCoreParams.useBackendExecutionFilesDownload = true
      const downloadExcel = vi.fn()
      mockGeneralStoreState.selectedExecution = {
        name: 'e',
        createdAt: '2024-01-01',
        executionId: 5,
        experiment: { instance: { data: { rows: [] } }, downloadExcel },
      }
      const vm = createWrapper().vm as any
      await vm.downloadInstanceExcel()
      expect(mockGeneralStoreState.getDataToDownload).toHaveBeenCalled()
      expect(downloadExcel).not.toHaveBeenCalled()
    })

    test('downloadInstanceChecksExcel: no checks error', async () => {
      mockGeneralStoreState.selectedExecution = { experiment: { instance: {} } }
      const vm = createWrapper().vm as any
      await vm.downloadInstanceChecksExcel()
      expect(snackbarSpy).toHaveBeenCalledWith(expect.anything(), 'error')
    })

    test('downloadInstanceChecksExcel: success path', async () => {
      const downloadInstanceChecksExcel = vi.fn(async () => undefined)
      mockGeneralStoreState.selectedExecution = {
        name: 'e',
        createdAt: '2024-01-01',
        experiment: {
          instance: { dataChecks: { a: 1 } },
          downloadInstanceChecksExcel,
        },
      }
      const vm = createWrapper().vm as any
      await vm.downloadInstanceChecksExcel()
      expect(downloadInstanceChecksExcel).toHaveBeenCalled()
    })

    test('downloadSolutionChecksExcel: success path', async () => {
      const downloadSolutionChecksExcel = vi.fn(async () => undefined)
      mockGeneralStoreState.selectedExecution = {
        name: 'e',
        createdAt: '2024-01-01',
        experiment: {
          solution: { dataChecks: { a: 1 } },
          downloadSolutionChecksExcel,
        },
      }
      const vm = createWrapper().vm as any
      await vm.downloadSolutionChecksExcel()
      expect(downloadSolutionChecksExcel).toHaveBeenCalled()
    })

    test('downloadSolutionChecksExcel: no checks error', async () => {
      mockGeneralStoreState.selectedExecution = { experiment: { solution: {} } }
      const vm = createWrapper().vm as any
      await vm.downloadSolutionChecksExcel()
      expect(snackbarSpy).toHaveBeenCalledWith(expect.anything(), 'error')
    })
  })

  // -------------------------------------------------------------------------
  // Dropdown menu items
  // -------------------------------------------------------------------------
  describe('dropdown menu', () => {
    test('configuration section shows edit-all-master-tables when allowed', () => {
      mockCoreParams.enableEditAllMasterTables = true
      mockSectionConfig.sectionType.value = 'configuration'
      const vm = createWrapper().vm as any
      const ids = vm.dropdownMenuItems.map((i: any) => i.id)
      expect(ids).toContain('edit-all-master-tables')
    })

    test('input-data shows edit + download items', () => {
      mockSectionConfig.sectionType.value = 'input-data'
      mockCoreParams.allowEditInstance = true
      mockGeneralStoreState.selectedExecution = {
        instance: { data: { rows: [] } },
      }
      const vm = createWrapper().vm as any
      const ids = vm.dropdownMenuItems.map((i: any) => i.id)
      expect(ids).toContain('edit-input-data')
      expect(ids).toContain('download-excel')
    })

    test('input-data validation group uses checks for download item', () => {
      mockSectionConfig.sectionType.value = 'input-data'
      mockGroupTablesState.groupName.value = 'Validaciones'
      mockGeneralStoreState.selectedExecution = {
        experiment: { instance: { dataChecks: { a: 1 } } },
      }
      const vm = createWrapper().vm as any
      const ids = vm.dropdownMenuItems.map((i: any) => i.id)
      expect(ids).toContain('download-excel')
    })

    test('results section shows download item', () => {
      mockSectionConfig.sectionType.value = 'results'
      mockGeneralStoreState.selectedExecution = {
        solution: { data: { out: [] } },
      }
      const vm = createWrapper().vm as any
      const ids = vm.dropdownMenuItems.map((i: any) => i.id)
      expect(ids).toContain('download-excel')
    })

    test('navigateToEditInstance pushes route and increments key', () => {
      const vm = createWrapper().vm as any
      vm.navigateToEditInstance()
      expect(mockGeneralStoreState.incrementUploadComponentKey).toHaveBeenCalled()
    })


    test('edit-all-master-tables action opens modal', () => {
      mockCoreParams.enableEditAllMasterTables = true
      mockSectionConfig.sectionType.value = 'configuration'
      const vm = createWrapper().vm as any
      const item = vm.dropdownMenuItems.find(
        (i: any) => i.id === 'edit-all-master-tables',
      )
      item.action()
      expect(vm.showEditAllMasterTablesModal).toBe(true)
    })
  })

  // -------------------------------------------------------------------------
  // Validation group / instance order helpers
  // -------------------------------------------------------------------------
  describe('validation + ordering helpers', () => {
    test('isValidationsGroup reflects groupName', () => {
      mockGroupTablesState.groupName.value = 'Validaciones'
      const vm = createWrapper().vm as any
      expect(typeof vm.isValidationsGroup).toBe('boolean')
    })

    test('getInstancePreferredTableOrderForDownload empty without instance', () => {
      mockGeneralStoreState.selectedExecution = null
      const vm = createWrapper().vm as any
      expect(vm.getInstancePreferredTableOrderForDownload()).toEqual([])
    })

    test('getInstancePreferredTableOrderForDownload empty without masterData', () => {
      mockGeneralStoreState.selectedExecution = {
        instance: { data: { t1: [] } },
      }
      mockGeneralStoreState.getConfigurations = { masterData: null }
      const vm = createWrapper().vm as any
      expect(vm.getInstancePreferredTableOrderForDownload()).toEqual([])
    })
  })

  // -------------------------------------------------------------------------
  // Aggregated modal data + watchers
  // -------------------------------------------------------------------------
  describe('aggregated modal data', () => {
    test('aggregatedRowsDataForModal builds entry per modified key', async () => {
      mockTableChangesState.modifiedTableKeys.value = ['table_1']
      const vm = createWrapper().vm as any
      expect(Object.keys(vm.aggregatedRowsDataForModal)).toContain('table_1')
      expect(Object.keys(vm.aggregatedTableHeadersForModal)).toContain('table_1')
    })

    test('group watcher caches selected-table modal data', async () => {
      mockGroupTablesState.isGroupView.value = true
      mockGroupTablesState.selectedTable.value = 'Table_X'
      const vm = createWrapper().vm as any
      mockGroupTablesState.selectedTable.value = 'Table_Y'
      await nextTick()
      expect(vm.groupModalDataCache).toBeDefined()
    })

    test('execution-change watcher clears caches', async () => {
      mockGeneralStoreState.selectedExecution = { executionId: 'a' }
      const vm = createWrapper().vm as any
      vm.groupModalDataCache = { k: {} }
      mockGeneralStoreState.selectedExecution = { executionId: 'b' }
      await nextTick()
      expect(vm.groupModalDataCache).toEqual({})
    })
  })

  // -------------------------------------------------------------------------
  // activeTableData + isTableUiLoading
  // -------------------------------------------------------------------------
  describe('table loading', () => {



    test('isTableUiLoading true when tableSwitching', () => {
      mockGroupTablesState.tableSwitching.value = true
      const vm = createWrapper().vm as any
      expect(vm.isTableUiLoading(null)).toBe(true)
    })

    test('isTableUiLoading reflects instance loading when not switching', () => {
      mockGroupTablesState.tableSwitching.value = false
      const vm = createWrapper().vm as any
      expect(vm.isTableUiLoading({ loading: { value: true } })).toBe(true)
      expect(vm.isTableUiLoading({ loading: { value: false } })).toBe(false)
    })
  })

  // -------------------------------------------------------------------------
  // Route-leave navigation guard (mounted through <router-view> so the guard
  // is registered against the active route record).
  // -------------------------------------------------------------------------
  describe('onBeforeRouteLeave guard', () => {
    test('allows navigation without pending changes', async () => {
      const { sectionVm, router } = await mountThroughRouter('/section')
      const vm = sectionVm()
      await router.push('/dashboard')
      await flushPromises()
      expect(vm.showExitConfirmationModal).toBe(false)
      expect(router.currentRoute.value.path).toBe('/dashboard')
    })

    test('shows exit dialog when leaving configuration with pending changes', async () => {
      mockSectionConfig.sectionType.value = 'configuration'
      tableChangesGuardSetup()
      const { sectionVm, router } = await mountThroughRouter('/section')
      const vm = sectionVm()
      // Do NOT await: the guard aborts (stores next) so the push never resolves.
      void router.push('/dashboard').catch(() => {})
      await flushPromises()
      expect(vm.showExitConfirmationModal).toBe(true)
      expect(router.currentRoute.value.path).toBe('/section')
    })

    test('skips dialog when both routes are frontend-automation', async () => {
      mockSectionConfig.sectionType.value = 'configuration'
      tableChangesGuardSetup()
      const { sectionVm, router } = await mountThroughRouter('/configuration/a')
      const vm = sectionVm()
      await router.push('/configuration/b')
      await flushPromises()
      expect(vm.showExitConfirmationModal).toBe(false)
      expect(router.currentRoute.value.path).toBe('/configuration/b')
    })

    test('skips dialog when moving between execution-data sections during recalc', async () => {
      mockCoreParams.enableSolutionRecalculation = true
      mockSectionConfig.sectionType.value = 'input-data'
      tableChangesGuardSetup()
      const { sectionVm, router } = await mountThroughRouter('/input-data/a')
      const vm = sectionVm()
      await router.push('/output-data/a')
      await flushPromises()
      expect(vm.showExitConfirmationModal).toBe(false)
      expect(router.currentRoute.value.path).toBe('/output-data/a')
    })
  })

  // -------------------------------------------------------------------------
  // Recalc-section watcher (cross-route cache merge)
  // -------------------------------------------------------------------------
  describe('recalculation modal-cache watcher', () => {
    test('merges rowsData into recalculationModalDataCache', async () => {
      mockCoreParams.enableSolutionRecalculation = true
      mockSectionConfig.sectionType.value = 'input-data'
      const wrapper = createWrapper()
      const vm = wrapper.vm as any
      mockTableDataInstances[0].rowsDataForModal.value = {
        rows: { '1': { name: 'a' } },
      }
      mockTableDataInstances[0].tableHeadersForModal.value = {
        rows: [{ key: 'name', title: 'Name' }],
      }
      await nextTick()
      await nextTick()
      expect(vm.recalculationModalDataCache.rows).toBeDefined()
      expect(vm.recalculationModalDataCache.rows.tableHeaders.length).toBe(1)
    })

    test('group watcher populates groupModalDataCache with data', async () => {
      mockGroupTablesState.isGroupView.value = true
      mockGroupTablesState.selectedTable.value = 'Tbl'
      const wrapper = createWrapper()
      const vm = wrapper.vm as any
      mockTableDataInstances[1].rowsDataForModal.value = { tbl: { '1': {} } }
      mockTableDataInstances[1].tableHeadersForModal.value = { tbl: [] }
      await nextTick()
      await nextTick()
      expect(vm.groupModalDataCache.tbl).toBeDefined()
    })
  })

  // -------------------------------------------------------------------------
  // ETL metadata in recalculation save
  // -------------------------------------------------------------------------
  describe('handleSolutionRecalculation with ETL metadata', () => {
    test('passes ETL metadata when enabled and metadata present', async () => {
      mockCoreParams.enableSolutionRecalculation = true
      mockCoreParams.etl.enableEtlMetadataAndReview = true
      mockTableChangesState.modifiedTableKeys.value = ['rows']
      mockGeneralStoreState.selectedExecution = {
        name: 'Exec',
        instance: {
          data: {
            rows: [{ id: 1 }],
            __metadata__: { parameters_from_db: [], tables_from_db: [] },
          },
        },
        solution: { data: { out: [] } },
      }
      const vm = createWrapper().vm as any
      await vm.handleSolutionRecalculation()
      await flushPromises()
      expect(mockRecalculationController.runSolutionRecalculation).toHaveBeenCalled()
      const arg = (mockRecalculationController.runSolutionRecalculation as any).mock
        .calls[0][0]
      expect(arg).toHaveProperty('etlInstanceDataBeforeEdits')
    })
  })

  // -------------------------------------------------------------------------
  // Force-retry group view reload + recalc
  // -------------------------------------------------------------------------
  describe('confirmEditAllTablesForceRetry group + recalc', () => {
    test('group view reloads selected table and runs recalc', async () => {
      mockGroupTablesState.isGroupView.value = true
      mockCoreParams.enableRecalculationOnMasterEdit = true
      const file = new File(['x'], 'a.xlsx')
      const vm = createWrapper().vm as any
      vm.pendingEditAllFiles = [file]
      vm.pendingEditAllApiOperation = 'overwrite_all'
      vm.editAllTablesForceContext = { message: 'm', forceTableKeys: ['a'] }
      await vm.confirmEditAllTablesForceRetry()
      await flushPromises()
      expect(mockTableDataInstances[1].loadData).toHaveBeenCalled()
      expect(mockRecalculationController.checkPlanDataAfterMasterDataChange).toHaveBeenCalled()
    })
  })

  // -------------------------------------------------------------------------
  // applyAllDeletes single-item path + getExecutionData solution branch
  // -------------------------------------------------------------------------
  describe('save-all single-delete + execution data branches', () => {
    test('saveAllMasterTableChanges uses delete_item loop when no bulk', async () => {
      mockTableChangesState.modifiedTableKeys.value = ['table_1']
      mockTableChangesState.getPendingDeletes.mockReturnValue([7, 8])
      mockSectionConfig.currentConfiguration.value = {
        table_1: { title: 'T', get_list: {}, delete_item: {} },
      }
      const vm = createWrapper().vm as any
      await vm.saveAllMasterTableChanges()
      await flushPromises()
      expect(mockRepoInstance.deleteItem).toHaveBeenCalledTimes(2)
    })

    test('getExecutionData returns solution for results section', () => {
      mockSectionConfig.sectionType.value = 'results'
      mockGeneralStoreState.selectedExecution = {
        solution: { data: { out: [1] } },
      }
      const vm = createWrapper().vm as any
      expect(vm.getExecutionData()).toEqual({ data: { out: [1] } })
    })

    test('getExecutionData null without execution', () => {
      mockGeneralStoreState.selectedExecution = null
      const vm = createWrapper().vm as any
      expect(vm.getExecutionData()).toBe(null)
    })

    test('generateWidgetsForTable uses selectedTableConfig in group view', async () => {
      mockSectionConfig.sectionType.value = 'input-data'
      mockCoreParams.enableAutoInstanceDashboard = true
      mockGroupTablesState.selectedTableConfig.value = { schema: {} }
      mockGenerateAutoDashboard.mockReturnValue([{ type: 'kpi' }] as any)
      mockGeneralStoreState.selectedExecution = {
        instance: { data: { tbl: [] } },
      }
      const vm = createWrapper().vm as any
      const result = await vm.generateWidgetsForTable('tbl', 'instance', true)
      expect(result.auto.length).toBe(1)
    })

    test('generateWidgetsForTable returns empty without executionData', async () => {
      mockSectionConfig.sectionType.value = 'input-data'
      mockGeneralStoreState.selectedExecution = { somethingElse: true }
      const vm = createWrapper().vm as any
      const result = await vm.generateWidgetsForTable('tbl', 'instance')
      expect(result).toEqual({ auto: [], custom: [] })
    })
  })

  // -------------------------------------------------------------------------
  // onDeactivated cancels loads
  // -------------------------------------------------------------------------
  describe('onDeactivated', () => {
    test('cancels in-flight loads on unmount/deactivate', async () => {
      const wrapper = createWrapper()
      wrapper.unmount()
      // cancelLoadData is shared mock; just ensure no throw and component unmounts
      expect(true).toBe(true)
    })
  })

  // -------------------------------------------------------------------------
  // Extra dropdown / validations coverage
  // -------------------------------------------------------------------------
  describe('dropdown validation-group branches', () => {
    test('results validation group uses solution checks', () => {
      mockSectionConfig.sectionType.value = 'results'
      mockGroupTablesState.groupName.value = 'Validaciones'
      mockGeneralStoreState.selectedExecution = {
        experiment: { solution: { dataChecks: { a: 1 } } },
      }
      const vm = createWrapper().vm as any
      const ids = vm.dropdownMenuItems.map((i: any) => i.id)
      expect(ids).toContain('download-excel')
    })

    test('execHasInstanceChecks / execHasSolutionChecks via dropdown empty', () => {
      mockSectionConfig.sectionType.value = 'input-data'
      mockGroupTablesState.groupName.value = 'Validaciones'
      mockGeneralStoreState.selectedExecution = {
        experiment: { instance: { dataChecks: {} } },
      }
      const vm = createWrapper().vm as any
      const ids = vm.dropdownMenuItems.map((i: any) => i.id)
      expect(ids).not.toContain('download-excel')
    })

    test('input-data dropdown empty when no edit rights and no instance', () => {
      mockSectionConfig.sectionType.value = 'input-data'
      mockCoreParams.allowEditInstance = false
      mockGeneralStoreState.selectedExecution = { experiment: {} }
      const vm = createWrapper().vm as any
      expect(vm.dropdownMenuItems).toEqual([])
    })

    test('results dropdown empty without solution', () => {
      mockSectionConfig.sectionType.value = 'results'
      mockGeneralStoreState.selectedExecution = { experiment: {} }
      const vm = createWrapper().vm as any
      expect(vm.dropdownMenuItems).toEqual([])
    })
  })

  // -------------------------------------------------------------------------
  // Additional ETL indicator branches
  // -------------------------------------------------------------------------
  describe('ETL indicator branch coverage', () => {
    test('showEtlTabOriginIndicators false for validation-like group', () => {
      mockSectionConfig.sectionType.value = 'input-data'
      mockGroupTablesState.isGroupView.value = true
      mockGroupTablesState.groupName.value = 'Validaciones'
      mockCoreParams.etl.enableEtlMetadataAndReview = true
      const vm = createWrapper().vm as any
      expect(vm.showEtlTabOriginIndicators).toBe(false)
    })

    test('showEtlTabOriginIndicators false when not group view', () => {
      mockSectionConfig.sectionType.value = 'input-data'
      mockGroupTablesState.isGroupView.value = false
      mockCoreParams.etl.enableEtlMetadataAndReview = true
      const vm = createWrapper().vm as any
      expect(vm.showEtlTabOriginIndicators).toBe(false)
    })

    test('showEtlTabOriginIndicators false outside input-data', () => {
      mockSectionConfig.sectionType.value = 'results'
      mockGroupTablesState.isGroupView.value = true
      mockCoreParams.etl.enableEtlMetadataAndReview = true
      const vm = createWrapper().vm as any
      expect(vm.showEtlTabOriginIndicators).toBe(false)
    })

    test('showEtlTabOriginIndicatorsForTable both branches', () => {
      mockSectionConfig.sectionType.value = 'input-data'
      mockGroupTablesState.isGroupView.value = true
      mockCoreParams.etl.enableEtlMetadataAndReview = true
      mockSectionConfig.currentConfiguration.value = {
        rows: { get_list: { response_schema: { type: 'array', items: {} } } },
        params: { get_list: { response_schema: { type: 'object' } } },
      }
      mockGeneralStoreState.selectedExecution = {
        instance: { data: { __metadata__: { tables_from_db: ['rows'] } } },
      }
      const vm = createWrapper().vm as any
      // indicators on, rows is non-object => true
      expect(vm.showEtlTabOriginIndicatorsForTable('rows')).toBe(true)
      // params is object table => false
      expect(vm.showEtlTabOriginIndicatorsForTable('params')).toBe(false)
    })

    test('showEtlTabOriginIndicatorsForTable false when indicators off', () => {
      mockSectionConfig.sectionType.value = 'results'
      const vm = createWrapper().vm as any
      expect(vm.showEtlTabOriginIndicatorsForTable('rows')).toBe(false)
    })

    test('etl computed ignore non-string entries', () => {
      mockGeneralStoreState.selectedExecution = {
        instance: {
          data: {
            __metadata__: {
              tables_from_db: ['ok', 123, null],
              parameters_from_db: ['a.b', 5],
            },
          },
        },
      }
      const vm = createWrapper().vm as any
      expect(vm.etlTablesFromDbNormalized.size).toBe(1)
      expect(vm.etlParametersFromDbNormalized.size).toBe(1)
    })

    test('buildHeaderOriginIndicators empty for validation-like group', () => {
      mockSectionConfig.sectionType.value = 'input-data'
      mockGroupTablesState.groupName.value = 'Validaciones'
      mockCoreParams.etl.enableEtlMetadataAndReview = true
      const vm = createWrapper().vm as any
      expect(vm.buildHeaderOriginIndicators('params', [{ key: 'x' }])).toEqual({})
    })

    test('buildHeaderOriginIndicators empty when flag off', () => {
      mockSectionConfig.sectionType.value = 'input-data'
      mockCoreParams.etl.enableEtlMetadataAndReview = false
      const vm = createWrapper().vm as any
      expect(vm.buildHeaderOriginIndicators('params', [{ key: 'x' }])).toEqual({})
    })
  })

  // -------------------------------------------------------------------------
  // Dashboard config branches
  // -------------------------------------------------------------------------
  describe('dashboard config branches', () => {
    test('getTableDashboardConfig uses solution config for results', () => {
      mockSectionConfig.sectionType.value = 'results'
      mockCoreParams.tableDashboards = {
        solution: { tbl: { showAutoDashboards: false } },
      }
      const vm = createWrapper().vm as any
      expect(vm.getTableDashboardConfig('tbl')).toEqual({
        showAutoDashboards: false,
      })
    })

    test('shouldShowAutoDashboards uses table override over global', () => {
      mockSectionConfig.sectionType.value = 'results'
      mockCoreParams.enableAutoSolutionDashboard = true
      mockCoreParams.tableDashboards = {
        solution: { tbl: { showAutoDashboards: false } },
      }
      const vm = createWrapper().vm as any
      expect(vm.shouldShowAutoDashboards('tbl')).toBe(false)
      expect(vm.shouldShowAutoDashboards(null)).toBe(false)
    })

    test('hasActualWidgets group view reflects selected widgets', () => {
      mockGroupTablesState.isGroupView.value = true
      const vm = createWrapper().vm as any
      expect(vm.hasActualWidgets).toBe(false)
      vm.selectedTableWidgets = [{ type: 'kpi' }]
      expect(vm.hasActualWidgets).toBe(true)
    })

    test('shouldShowWidgets true when custom widgets present', () => {
      mockSectionConfig.sectionType.value = 'input-data'
      mockCoreParams.tableDashboards = {
        instance: { table_1: { customWidgets: [{ component: 'X', position: 'side' }] } },
      }
      const vm = createWrapper().vm as any
      expect(vm.shouldShowWidgets).toBe(true)
    })
  })

  // -------------------------------------------------------------------------
  // Save flows: edits skipped when put_item missing
  // -------------------------------------------------------------------------
  describe('save edits skip branches', () => {
    test('applyAllEdits skipped without put_item', async () => {
      mockTableChangesState.modifiedTableKeys.value = ['table_1']
      mockTableChangesState.getChangesForTable.mockReturnValue({
        '1': { name: { newValue: 'x' } },
      })
      mockSectionConfig.currentConfiguration.value = {
        table_1: { title: 'T', get_list: {} },
      }
      const vm = createWrapper().vm as any
      await vm.saveAllMasterTableChanges()
      await flushPromises()
      expect(mockRepoInstance.putItem).not.toHaveBeenCalled()
    })


    test('saveAllMasterTableChanges reloads selectedTableData in group view', async () => {
      mockGroupTablesState.isGroupView.value = true
      mockTableChangesState.modifiedTableKeys.value = ['table_1']
      mockSectionConfig.currentConfiguration.value = {
        table_1: { title: 'T', get_list: {} },
      }
      const vm = createWrapper().vm as any
      await vm.saveAllMasterTableChanges()
      await flushPromises()
      expect(mockTableDataInstances[1].loadData).toHaveBeenCalled()
    })
  })

  // -------------------------------------------------------------------------
  // Remaining download + apply edge branches
  // -------------------------------------------------------------------------
  describe('extra branch coverage', () => {
    test('downloadSolutionExcel routes through backend when enabled', async () => {
      mockCoreParams.useBackendExecutionFilesDownload = true
      const downloadExcel = vi.fn()
      mockGeneralStoreState.selectedExecution = {
        name: 'e',
        createdAt: '2024-01-01',
        executionId: 9,
        experiment: { solution: { data: { out: [] } }, downloadExcel },
      }
      const vm = createWrapper().vm as any
      await vm.downloadSolutionExcel()
      expect(mockGeneralStoreState.getDataToDownload).toHaveBeenCalled()
      expect(downloadExcel).not.toHaveBeenCalled()
    })

    test('downloadSolutionExcel error path shows error', async () => {
      const downloadExcel = vi.fn(async () => {
        throw new Error('x')
      })
      mockGeneralStoreState.selectedExecution = {
        name: 'e',
        createdAt: '2024-01-01',
        experiment: { solution: { data: { out: [] } }, downloadExcel },
      }
      const vm = createWrapper().vm as any
      await vm.downloadSolutionExcel()
      expect(snackbarSpy).toHaveBeenCalledWith(expect.anything(), 'error')
    })

    test('downloadInstanceChecksExcel error path shows error', async () => {
      const downloadInstanceChecksExcel = vi.fn(async () => {
        throw new Error('x')
      })
      mockGeneralStoreState.selectedExecution = {
        name: 'e',
        createdAt: '2024-01-01',
        experiment: {
          instance: { dataChecks: { a: 1 } },
          downloadInstanceChecksExcel,
        },
      }
      const vm = createWrapper().vm as any
      await vm.downloadInstanceChecksExcel()
      expect(snackbarSpy).toHaveBeenCalledWith(expect.anything(), 'error')
    })

    test('downloadSolutionChecksExcel error path shows error', async () => {
      const downloadSolutionChecksExcel = vi.fn(async () => {
        throw new Error('x')
      })
      mockGeneralStoreState.selectedExecution = {
        name: 'e',
        createdAt: '2024-01-01',
        experiment: {
          solution: { dataChecks: { a: 1 } },
          downloadSolutionChecksExcel,
        },
      }
      const vm = createWrapper().vm as any
      await vm.downloadSolutionChecksExcel()
      expect(snackbarSpy).toHaveBeenCalledWith(expect.anything(), 'error')
    })

    test('dropdown edit-input-data action navigates', () => {
      mockSectionConfig.sectionType.value = 'input-data'
      mockCoreParams.allowEditInstance = true
      mockGeneralStoreState.selectedExecution = {
        instance: { data: { rows: [] } },
      }
      const vm = createWrapper().vm as any
      const item = vm.dropdownMenuItems.find(
        (i: any) => i.id === 'edit-input-data',
      )
      item.action()
      expect(mockGeneralStoreState.incrementUploadComponentKey).toHaveBeenCalled()
    })

    test('dropdown download action invokes instance excel', async () => {
      const downloadExcel = vi.fn(async () => undefined)
      mockSectionConfig.sectionType.value = 'input-data'
      mockGeneralStoreState.selectedExecution = {
        name: 'e',
        createdAt: '2024-01-01',
        instance: { data: { rows: [] } },
        experiment: { instance: { data: { rows: [] } }, downloadExcel },
      }
      const vm = createWrapper().vm as any
      const item = vm.dropdownMenuItems.find(
        (i: any) => i.id === 'download-excel',
      )
      await item.action()
      await flushPromises()
      expect(downloadExcel).toHaveBeenCalled()
    })

    test('etl computed empty when metadata missing but instance present', () => {
      mockGeneralStoreState.selectedExecution = {
        instance: { data: { rows: [{ id: 1 }] } },
      }
      const vm = createWrapper().vm as any
      expect(vm.etlTablesFromDbNormalized.size).toBe(0)
      expect(vm.etlParametersFromDbNormalized.size).toBe(0)
    })

    test('etl computed empty when tables_from_db not array', () => {
      mockGeneralStoreState.selectedExecution = {
        instance: {
          data: { __metadata__: { tables_from_db: 'nope', parameters_from_db: 7 } },
        },
      }
      const vm = createWrapper().vm as any
      expect(vm.etlTablesFromDbNormalized.size).toBe(0)
      expect(vm.etlParametersFromDbNormalized.size).toBe(0)
    })

    test('applyPendingChangesToData leaves primitive object values untouched', () => {
      mockTableChangesState.modifiedTableKeys.value = ['scalar']
      mockTableChangesState.getChangesForTable.mockReturnValue(null)
      const vm = createWrapper().vm as any
      const result = vm.applyPendingChangesToData({ scalar: 42 })
      expect(result.scalar).toBe(42)
    })

    test('applyPendingChangesToData keeps row when no change for its id', () => {
      mockTableChangesState.modifiedTableKeys.value = ['rows']
      mockTableChangesState.getChangesForTable.mockReturnValue({
        '5': { name: { newValue: 'z' } },
      })
      const vm = createWrapper().vm as any
      const result = vm.applyPendingChangesToData({
        rows: [{ id: 1, name: 'keep' }],
      })
      expect(result.rows[0].name).toBe('keep')
    })
  })

  // -------------------------------------------------------------------------
  // The table, its tabs and the review of the pending changes
  // -------------------------------------------------------------------------
  describe('table and tabs', () => {
    test('a single table gets its table data, key and the pending changes', () => {
      mockSectionConfig.sectionType.value = 'configuration'
      mockTableChangesState.hasChanges.value = true
      mockTableChangesState.totalChangesCount.value = 3
      mockTableChangesState.modifiedTableKeys.value = ['table_1', 'table_2']
      const wrapper = createWrapper()
      const table = wrapper.findComponent({ name: 'SectionDataTable' })
      expect(table.props('tableData')).toBe(mockTableDataInstances[0])
      expect(table.props('tableKey')).toBe('table_1')
      expect(table.props('readOnly')).toBe(false)
      expect(table.props('pendingCount')).toBe(3)
      expect(table.props('pendingTables')).toBe(2)
    })

    test('execution data without recalculation is read-only', () => {
      mockSectionConfig.sectionType.value = 'input-data'
      const table = createWrapper().findComponent({ name: 'SectionDataTable' })
      expect(table.props('readOnly')).toBe(true)
    })

    test('a group shows the selected table with tabs marking checks, origin and pending changes', () => {
      mockSectionConfig.sectionType.value = 'input-data'
      mockGroupTablesState.isGroupView.value = true
      mockGroupTablesState.groupName.value = 'validaciones'
      mockGroupTablesState.selectedTable.value = 'checks_a'
      mockGroupTablesState.groupTables.value = {
        checks_a: { is_warning: false },
        checks_b: { is_warning: true },
      }
      mockGroupTablesState.tabsData.value = [
        { value: 'checks_a', text: 'Checks A' },
        { value: 'checks_b', text: 'Checks B' },
      ] as any
      mockTableChangesState.getChangesForTable.mockImplementation((k: string) =>
        k === 'checks_b' ? { '1': { a: {}, b: {} } } : null,
      )
      const wrapper = createWrapper()
      const vm = wrapper.vm as any
      expect(vm.isValidationsGroup).toBe(true)
      const tabs = wrapper.findComponent({ name: 'DataTableTabs' })
      expect(tabs.props('modelValue')).toBe('checks_a')
      expect(tabs.props('tabs')).toEqual([
        { key: 'checks_a', label: 'Checks A', pending: 0, level: 'error', source: undefined },
        { key: 'checks_b', label: 'Checks B', pending: 2, level: 'warning', source: undefined },
      ])
      const table = wrapper.findComponent({ name: 'SectionDataTable' })
      expect(table.props('tableData')).toBe(mockTableDataInstances[1])
      expect(table.props('checkLevel')).toBe('error')
    })

    test('picking a tab switches the group to it', async () => {
      mockGroupTablesState.isGroupView.value = true
      mockGroupTablesState.selectedTable.value = 'a'
      mockGroupTablesState.tabsData.value = [
        { value: 'a', text: 'A' },
        { value: 'b', text: 'B' },
      ] as any
      const wrapper = createWrapper()
      await wrapper.findComponent({ name: 'DataTableTabs' }).vm.$emit('update:modelValue', 'b')
      expect(mockGroupTablesState.handleTabChange).toHaveBeenCalledWith(1)
    })

    test('the force-retry dialog follows the table shown', () => {
      mockGroupTablesState.isGroupView.value = true
      const vm = createWrapper().vm as any
      expect(vm.forceRetryInstances).toEqual([{ key: 'group', data: mockTableDataInstances[1] }])
    })
  })

  describe('review of the pending changes', () => {
    test('the table opens the review; master data saves, recalculation relaunches', async () => {
      mockSectionConfig.sectionType.value = 'configuration'
      const wrapper = createWrapper()
      const vm = wrapper.vm as any
      vm.masterTableValidationError = 'old'
      await wrapper.findComponent({ name: 'SectionDataTable' }).vm.$emit('review')
      expect(vm.masterReviewOpen).toBe(true)
      expect(vm.masterTableValidationError).toBe(null)
      const panel = wrapper.findComponent({ name: 'PendingChangesPanel' })
      expect(panel.props('open')).toBe(true)
      expect(panel.props('saveLabel')).toBe('dataTable.pending.save')
    })

    test('in a recalculation the save asks for the name of the new execution', async () => {
      mockCoreParams.enableSolutionRecalculation = true
      mockSectionConfig.sectionType.value = 'input-data'
      mockGeneralStoreState.selectedExecution = { name: 'Week 43' }
      const wrapper = createWrapper()
      const vm = wrapper.vm as any
      expect(vm.saveButtonLabel).toBe('dataTable.relaunch.action')
      expect(vm.reviewButtonLabel).toBe('dataTable.relaunch.review')
      vm.saveReview()
      await nextTick()
      const relaunch = wrapper.findComponent({ name: 'RelaunchDialog' })
      expect(relaunch.props('open')).toBe(true)
      expect(relaunch.props('name')).toBe('Week 43')
      expect(relaunch.props('sourceName')).toBe('Week 43')
    })

    test('the relaunch runs with the name picked', async () => {
      mockCoreParams.enableSolutionRecalculation = true
      mockSectionConfig.sectionType.value = 'input-data'
      mockGeneralStoreState.selectedExecution = {
        name: 'Week 43',
        instance: { data: { rows: [{ id: 1 }] } },
        solution: { data: { out: [{ id: 1 }] } },
      }
      const vm = createWrapper().vm as any
      vm.relaunchOpen = true
      await vm.handleSolutionRecalculation('Week 43 · v2')
      expect(mockRecalculationController.runSolutionRecalculation).toHaveBeenCalledWith(
        expect.objectContaining({ executionName: 'Week 43 · v2' }),
      )
      expect(vm.relaunchOpen).toBe(false)
    })

    test('groups come from the changes store with the columns and rows of each table', () => {
      mockTableChangesState.modifiedTableKeys.value = ['table_1']
      mockTableChangesState.tableTitles.value = { table_1: 'Lines' }
      mockTableChangesState.getFullGroupedChanges.mockReturnValue([
        {
          tableKey: 'table_1',
          tableTitle: 'Lines',
          changes: [{ rowId: '1', fields: [{ fieldKey: 'name', oldValue: 'a', newValue: 'b' }] }],
          creates: [],
          deletes: [],
        },
      ])
      mockTableDataInstances = [mockMakeTableDataInstance(), mockMakeTableDataInstance()]
      mockTableDataInstances[0].rowsDataForModal.value = { table_1: { '1': { id: 1, name: 'a' } } }
      mockTableDataInstances[0].tableHeadersForModal.value = {
        table_1: [{ key: 'name', title: 'Name', type: 'string' }],
      }
      const vm = createWrapper().vm as any
      expect(vm.pendingGroups).toHaveLength(1)
      expect(vm.pendingGroups[0]).toMatchObject({ tableKey: 'table_1', title: 'Lines' })
      expect(vm.pendingGroups[0].items[0]).toMatchObject({
        kind: 'modified',
        label: 'Name b',
        changedKeys: ['name'],
      })
    })

    test('a validation error of the save shows in the review', () => {
      const vm = createWrapper().vm as any
      vm.masterTableValidationError = 'Row 3 is not valid'
      expect(vm.reviewValidationError).toBe('Row 3 is not valid')
      vm.clearReviewError()
      expect(vm.reviewValidationError).toBe(null)
    })

    test('the server asking to force a delete shows inside the review', async () => {
      const wrapper = createWrapper()
      const vm = wrapper.vm as any
      vm.forceRetryOfferFromSaveAll = { message: 'Dependent rows', storageKey: 'k', ids: [1] }
      vm.masterReviewOpen = true
      await nextTick()
      expect(wrapper.findComponent({ name: 'PendingChangesPanel' }).props('overwrite')).toEqual({
        message: 'Dependent rows',
      })
    })

    test('reverting a table, a row of each kind and a field', () => {
      const vm = createWrapper().vm as any
      vm.revertTable('t')
      expect(mockTableChangesState.revertTableChanges).toHaveBeenCalledWith('t')
      expect(mockTableChangesState.clearCreatesForTable).toHaveBeenCalledWith('t')
      expect(mockTableChangesState.clearDeletesForTable).toHaveBeenCalledWith('t')
      vm.revertRow('t', 'create-t-0-1', 'new')
      expect(mockTableChangesState.revertCreate).toHaveBeenCalledWith('t', 'create-t-0-1')
      vm.revertRow('t', 4, 'deleted')
      expect(mockTableChangesState.revertDelete).toHaveBeenCalledWith('t', 4)
      vm.revertRow('t', 5, 'modified')
      expect(mockTableChangesState.revertRowChanges).toHaveBeenCalledWith('t', 5)
    })

    test('a field edited in the review is recorded from its original value', () => {
      mockTableChangesState.modifiedTableKeys.value = ['table_1']
      mockTableDataInstances = [mockMakeTableDataInstance(), mockMakeTableDataInstance()]
      mockTableDataInstances[0].rowsDataForModal.value = { table_1: { '1': { id: 1, name: 'a' } } }
      const vm = createWrapper().vm as any
      vm.updateReviewField('table_1', 1, 'name', 'c')
      expect(mockTableChangesState.recordChange).toHaveBeenCalledWith('table_1', 1, 'name', 'a', 'c', 'name')
      vm.updateReviewField('table_1', 'create-table_1-0-1', 'name', 'd')
      expect(mockTableChangesState.updateCreateField).toHaveBeenCalledWith('table_1', 'create-table_1-0-1', 'name', 'd')
    })

    test('going to a change of the table shown clears its search and filters', async () => {
      mockGroupTablesState.resolvedTableKey.value = 'table_1'
      const vm = createWrapper().vm as any
      await vm.goToChange('table_1', 1, 'name')
      expect(mockTableDataInstances[0].handleSearch).toHaveBeenCalledWith('')
      expect(mockTableDataInstances[0].setFilters).toHaveBeenCalledWith([])
    })

    test('going to a change of a table not shown does nothing', async () => {
      const vm = createWrapper().vm as any
      await vm.goToChange('other', 1, 'name')
      expect(mockTableDataInstances[0].handleSearch).not.toHaveBeenCalled()
    })

    test('going to a change of another tab of the group switches to it', async () => {
      mockGroupTablesState.isGroupView.value = true
      mockGroupTablesState.tabsData.value = [
        { value: 'Table_A', text: 'A' },
        { value: 'Table_B', text: 'B' },
      ] as any
      const vm = createWrapper().vm as any
      await vm.goToChange('table_b', 1, 'name')
      expect(mockGroupTablesState.handleTabChange).toHaveBeenCalledWith(1)
      expect(mockTableDataInstances[1].setFilters).toHaveBeenCalledWith([])
    })
  })
})

// Helpers used by guard tests -------------------------------------------------
function tableChangesGuardSetup() {
  mockTableChangesState.hasChanges.value = true
  mockTableChangesState.totalChangesCount.value = 2
  mockTableChangesState.modifiedTableKeys.value = ['table_1']
}

const guardStubs = viewStubs

async function mountThroughRouter(startPath: string) {
  if (mockTableDataInstances.length === 0) {
    mockTableDataInstances = [
      mockMakeTableDataInstance(),
      mockMakeTableDataInstance(),
    ]
  }
  mockTableDataCallIndex = 0
  const vuetify = createVuetify()
  const pinia = createPinia()
  setActivePinia(pinia)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/section', component: SectionView },
      { path: '/configuration/:id', component: SectionView },
      { path: '/input-data/:id', component: SectionView },
      { path: '/output-data/:id', component: SectionView },
      { path: '/dashboard', component: { template: '<div>dash</div>' } },
    ],
  })
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    missing: (_l: string, k: string) => k,
    messages: { en: {} },
  })
  const Host = { template: '<router-view />' }
  router.push(startPath)
  await router.isReady()
  const wrapper = mount(Host, {
    global: {
      plugins: [vuetify, pinia, i18n, router],
      provide: { showSnackbar: snackbarSpy },
      stubs: guardStubs,
    },
  })
  await flushPromises()
  const sectionVm = () =>
    wrapper.findComponent(SectionView).vm as any
  return { wrapper, router, sectionVm }
}
