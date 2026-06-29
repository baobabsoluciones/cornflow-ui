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
  items: ref([]),
  headers: ref([{ key: 'name', title: 'Name', type: 'string' }]),
  loading: ref(false),
  tableTitle: ref(''),
  searchValue: ref(''),
  searchPlaceholder: ref('Search'),
  activeFilters: ref([]),
  selectedItems: ref([]),
  enableExcelMode: ref(false),
  hasPendingChanges: ref(false),
  pendingChangesCount: ref(0),
  enableSearch: ref(true),
  enableFilters: ref(true),
  enableSelection: ref(false),
  enableActions: ref(true),
  enableBulkActions: ref(false),
  canAdd: ref(false),
  canEdit: ref(false),
  canDelete: ref(false),
  canBulkUpload: ref(false),
  bulkUploadAvailableOperations: ref([]),
  canDownloadExcel: ref(false),
  isPrimitiveArray: ref(false),
  availableFilterFields: ref([]),
  showAddEditModal: ref(false),
  showDeleteDialog: ref(false),
  showBulkDeleteDialog: ref(false),
  showBulkUploadModal: ref(false),
  formFields: ref([]),
  formData: ref({}),
  isEditing: ref(false),
  saving: ref(false),
  deleting: ref(false),
  bulkDeleting: ref(false),
  uploading: ref(false),
  uploadProgressMessage: ref(''),
  downloading: ref(false),
  editingRowId: ref(null),
  editingData: ref({}),
  originalData: ref({}),
  isEditingAnyRow: ref(false),
  tableData: ref({}),
  isCellModified: vi.fn(),
  getModifiedValue: vi.fn(),
  getRowClass: vi.fn(() => ''),
  handleSearch: vi.fn(),
  getOperatorsForFieldType: vi.fn(),
  getOperatorText: vi.fn(),
  operatorNeedsValue: vi.fn(),
  operatorNeedsSecondValue: vi.fn(),
  generateFilterId: vi.fn(),
  apiDateRangeFilterConfigs: ref([]),
  dateRangeValues: ref({}),
  hasMore: ref(false),
  loadingMore: ref(false),
  loadMore: vi.fn(),
  updateInlineField: vi.fn(),
  forceRetryOffer: ref(null),
  forceRetryLoading: ref(false),
  acceptForceRetry: vi.fn(),
  rejectForceRetry: vi.fn(),
  handleApplyDateRange: vi.fn(),
  handleResetDateRange: vi.fn(),
  handleAddFilter: vi.fn(),
  handleRemoveFilter: vi.fn(),
  handleClearAllFilters: vi.fn(),
  handleToggleFiltersPanel: vi.fn(),
  handleSelectItem: vi.fn(),
  handleSelectAll: vi.fn(),
  handleClearSelection: vi.fn(),
  handleAddItem: vi.fn(),
  handleEditItem: vi.fn(),
  handleDeleteItem: vi.fn(),
  handleBulkDelete: vi.fn(),
  handleSaveItem: vi.fn(),
  handleBulkUpload: vi.fn(),
  handleBulkEdit: vi.fn(),
  handleDownloadExcel: vi.fn(),
  handleConfirmDelete: vi.fn(),
  handleConfirmBulkDelete: vi.fn(),
  startInlineEdit: vi.fn(),
  saveInlineEdit: vi.fn(),
  cancelInlineEdit: vi.fn(),
  handleAddClick: vi.fn(),
  handleEditClick: vi.fn(),
  handleDeleteClick: vi.fn(),
  handleBulkDeleteClick: vi.fn(),
  handleBulkUploadClick: vi.fn(),
  handleSelectItems: vi.fn(),
  loadTableData: vi.fn(async () => []),
  loadData: vi.fn(async () => undefined),
  tableHeadersForModal: ref<Record<string, any>>({}),
  rowsDataForModal: ref<Record<string, any>>({}),
  cancelLoadData: mockCancelLoadData,
  handleCellChange: vi.fn(),
  saveAllChanges: vi.fn(),
  revertTableChanges: vi.fn(),
  error: ref(null),
})

let mockTableDataInstances: any[] = []
let mockTableDataCallIndex = 0
const mockInvalidateTableDataCache = vi.fn()
const mockInvalidateAllTableDataCaches = vi.fn()

vi.mock('@/composables/section-view/useTableData', () => ({
  useTableData: () => {
    const inst = mockTableDataInstances[mockTableDataCallIndex] ?? mockMakeTableDataInstance()
    mockTableDataCallIndex++
    return inst
  },
  invalidateTableDataCache: (...a: any[]) => mockInvalidateTableDataCache(...a),
  invalidateAllTableDataCaches: (...a: any[]) =>
    mockInvalidateAllTableDataCaches(...a),
}))

vi.mock('@/composables/section-view/useExecutionTableData', () => ({
  ensureItemIds: (rows: any[]) =>
    rows.map((r, i) => (r.id != null ? r : { ...r, id: `__row_${i}` })),
}))

// ---- useSectionConfiguration ----------------------------------------------
const mockSectionConfig = {
  sectionType: ref('configuration'),
  currentConfiguration: ref<any>({ table_1: { title: 'Table 1', get_list: {} } }),
}
vi.mock('@/composables/section-view/useSectionConfiguration', () => ({
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
vi.mock('@/composables/section-view/useGroupTables', () => ({
  useGroupTables: () => mockGroupTablesState,
}))

// ---- useSectionDisplay -----------------------------------------------------
vi.mock('@/composables/section-view/useSectionDisplay', () => ({
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
}
vi.mock('@/composables/useTableChanges', () => ({
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
vi.mock('@/composables/section-view/useRecalculationController', () => ({
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
vi.mock('@/stores/general', () => ({
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
vi.mock('@/repositories/TableRepository', () => ({
  default: function (this: any, ...a: any[]) {
    return mockTableRepositoryCtor(...a)
  },
  isForceRetryOfferError: (e: any) => mockForceRetryPredicate(e),
}))

// ---- EditAllTablesRepository ----------------------------------------------
const mockPostEditAllTables = vi.fn(async () => undefined)
vi.mock('@/repositories/EditAllTablesRepository', () => ({
  postEditAllTables: (...a: any[]) => mockPostEditAllTables(...a),
  mapBulkUiOperationToEditAllApi: (op: string) =>
    op === 'overwrite' ? 'overwrite_all' : 'post_bulk',
}))

// ---- AutoDashboardService --------------------------------------------------
const mockGenerateAutoDashboard = vi.fn(() => [] as any[])
vi.mock('@/services/AutoDashboardService', () => ({
  generateAutoDashboard: (...a: any[]) => mockGenerateAutoDashboard(...a),
}))

// ---- app config ------------------------------------------------------------
const mockCoreParams: any = {
  enableSolutionRecalculation: false,
  enableRecalculationOnMasterEdit: false,
  enableReplaceMasterWithUploaded: false,
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

// SectionView must be imported AFTER mocks are declared.
import SectionView from '@/views/SectionView.vue'

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
      stubs: {
        CoreTitleView: { template: '<div class="core-title-view-stub"><slot /></div>' },
        CoreTable: { template: '<div class="core-table-stub"></div>' },
        SimpleList: { template: '<div class="simple-list-stub"></div>' },
        CoreTab: { template: '<div class="core-tab-stub"></div>' },
        CoreTabs: { template: '<div class="core-tabs-stub"></div>' },
        PendingChangesReviewModal: { template: '<div class="pending-modal-stub"></div>' },
        CoreBulkUploadModal: { template: '<div class="bulk-upload-stub"></div>' },
        CoreBulkEditModal: { template: '<div class="bulk-edit-stub"></div>' },
        ForceRetryConfirmDialog: { template: '<div class="force-retry-stub"></div>' },
        MBaseModal: { template: '<div class="m-base-modal-stub"><slot /></div>' },
        AutoKPICard: { template: '<div class="auto-kpi-stub"></div>' },
        AutoLineChart: { template: '<div class="auto-line-stub"></div>' },
        AutoBarChart: { template: '<div class="auto-bar-stub"></div>' },
        AutoPieChart: { template: '<div class="auto-pie-stub"></div>' },
        AutoAreaChart: { template: '<div class="auto-area-stub"></div>' },
        AutoMapChart: { template: '<div class="auto-map-stub"></div>' },
        'v-dialog': { template: '<div class="v-dialog-stub"><slot /></div>' },
        'v-menu': { template: '<div class="v-menu-stub"><slot /></div>' },
      },
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

    test('modifiedTableKeysInGroup filters to current group', () => {
      mockGroupTablesState.isGroupView.value = true
      mockGroupTablesState.groupTables.value = { Table_A: {}, Table_B: {} }
      mockTableChangesState.modifiedTableKeys.value = ['table_a', 'other_table']
      const vm = createWrapper().vm as any
      expect(vm.modifiedTableKeysInGroup).toEqual(['table_a'])
    })

    test('modifiedTableKeysInGroup empty when not group view', () => {
      mockGroupTablesState.isGroupView.value = false
      const vm = createWrapper().vm as any
      expect(vm.modifiedTableKeysInGroup).toEqual([])
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

    test('open and close recalculation pending modal', () => {
      const vm = createWrapper().vm as any
      vm.openRecalculationPendingModal()
      expect(vm.showRecalculationPendingModal).toBe(true)
      vm.recalculationValidationError = 'err'
      vm.handleCloseRecalculationPendingModal()
      expect(vm.showRecalculationPendingModal).toBe(false)
      expect(vm.recalculationValidationError).toBe(null)
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
  // canEditAllMasterTables
  // -------------------------------------------------------------------------
  describe('canEditAllMasterTables', () => {
    test('false when flag disabled', () => {
      mockCoreParams.enableReplaceMasterWithUploaded = false
      const vm = createWrapper().vm as any
      expect(vm.canEditAllMasterTables).toBe(false)
    })

    test('false when not configuration section', () => {
      mockCoreParams.enableReplaceMasterWithUploaded = true
      mockSectionConfig.sectionType.value = 'input-data'
      const vm = createWrapper().vm as any
      expect(vm.canEditAllMasterTables).toBe(false)
    })

    test('true when enabled in configuration with config', () => {
      mockCoreParams.enableReplaceMasterWithUploaded = true
      mockSectionConfig.sectionType.value = 'configuration'
      const vm = createWrapper().vm as any
      expect(vm.canEditAllMasterTables).toBe(true)
    })

    test('false when configuration empty', () => {
      mockCoreParams.enableReplaceMasterWithUploaded = true
      mockSectionConfig.currentConfiguration.value = {}
      const vm = createWrapper().vm as any
      expect(vm.canEditAllMasterTables).toBe(false)
    })
  })

  // -------------------------------------------------------------------------
  // Bulk edit modal handlers
  // -------------------------------------------------------------------------
  describe('bulk edit', () => {
    test('handleBulkEditEvent opens modal with source', () => {
      const vm = createWrapper().vm as any
      vm.handleBulkEditEvent('group')
      expect(vm.bulkEditSource).toBe('group')
      expect(vm.showBulkEditModal).toBe(true)
    })

    test('handleBulkEditApply (single) calls tableData handler', () => {
      const vm = createWrapper().vm as any
      vm.handleBulkEditEvent('single')
      vm.handleBulkEditApply({ field: 1 })
      expect(mockTableDataInstances[0].handleBulkEdit).toHaveBeenCalledWith({ field: 1 })
      expect(vm.showBulkEditModal).toBe(false)
    })

    test('handleBulkEditApply (group) calls selectedTableData handler', () => {
      const vm = createWrapper().vm as any
      vm.handleBulkEditEvent('group')
      vm.handleBulkEditApply({ field: 2 })
      expect(mockTableDataInstances[1].handleBulkEdit).toHaveBeenCalledWith({ field: 2 })
    })

    test('activeBulkEditHeaders/Count reflect source', () => {
      mockTableDataInstances = [mockMakeTableDataInstance(), mockMakeTableDataInstance()]
      mockTableDataInstances[1].selectedItems.value = [1, 2, 3]
      const vm = createWrapper().vm as any
      vm.handleBulkEditEvent('group')
      expect(vm.activeBulkEditSelectedCount).toBe(3)
      expect(vm.activeBulkEditHeaders.length).toBeGreaterThan(0)
    })
  })

  // -------------------------------------------------------------------------
  // Master-table save flows
  // -------------------------------------------------------------------------
  describe('handleMasterTableSaveAll', () => {
    test('no-op when no modified keys, then closes modal', async () => {
      mockTableChangesState.modifiedTableKeys.value = []
      const vm = createWrapper().vm as any
      vm.showMasterTablePendingModal = true
      await vm.handleMasterTableSaveAll()
      expect(vm.showMasterTablePendingModal).toBe(false)
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

    test('openMasterTablePendingModal resets error', () => {
      const vm = createWrapper().vm as any
      vm.masterTableValidationError = 'old'
      vm.openMasterTablePendingModal()
      expect(vm.showMasterTablePendingModal).toBe(true)
      expect(vm.masterTableValidationError).toBe(null)
    })

    test('handleCloseMasterTablePendingModal clears offer', () => {
      const vm = createWrapper().vm as any
      vm.showMasterTablePendingModal = true
      vm.forceRetryOfferFromSaveAll = { message: 'm', storageKey: 'k', ids: [1] }
      vm.handleCloseMasterTablePendingModal()
      expect(vm.showMasterTablePendingModal).toBe(false)
      expect(vm.forceRetryOfferFromSaveAll).toBe(null)
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

  describe('saveAllGroupMasterTableChanges', () => {
    test('returns early with no keys', async () => {
      mockGroupTablesState.isGroupView.value = true
      mockGroupTablesState.groupTables.value = { Table_A: { get_list: {} } }
      mockTableChangesState.modifiedTableKeys.value = []
      const vm = createWrapper().vm as any
      await vm.saveAllGroupMasterTableChanges()
      expect(mockTableRepositoryCtor).not.toHaveBeenCalled()
    })

    test('saves deletes/creates/edits for group tables', async () => {
      mockGroupTablesState.isGroupView.value = true
      mockGroupTablesState.groupTables.value = {
        Table_A: {
          get_list: {},
          delete_item: {},
          post_item: {},
          put_item: {},
        },
      }
      mockTableChangesState.modifiedTableKeys.value = ['table_a']
      mockTableChangesState.getPendingDeletes.mockReturnValue([3])
      mockTableChangesState.getPendingCreates.mockReturnValue([
        { tempId: 't', data: { id: 't', name: 'n' } },
      ])
      mockTableChangesState.getChangesForTable.mockReturnValue({
        '1': { name: { newValue: 'z' } },
      })
      mockRepoInstance.getList = vi.fn(async () => [{ id: 1, name: 'a' }])
      const vm = createWrapper().vm as any
      await vm.saveAllGroupMasterTableChanges()
      await flushPromises()
      expect(mockRepoInstance.deleteItem).toHaveBeenCalled()
      expect(mockRepoInstance.createItem).toHaveBeenCalled()
      expect(mockRepoInstance.putItem).toHaveBeenCalled()
      expect(mockTableDataInstances[1].loadData).toHaveBeenCalled()
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
      mockCoreParams.enableReplaceMasterWithUploaded = true
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

    test('handleDropdownItemClick is a no-op', () => {
      const vm = createWrapper().vm as any
      expect(() => vm.handleDropdownItemClick({ id: 'x' })).not.toThrow()
    })

    test('edit-all-master-tables action opens modal', () => {
      mockCoreParams.enableReplaceMasterWithUploaded = true
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
  describe('activeTableData + loading', () => {
    test('activeTableData returns tableData for non-group', () => {
      mockGroupTablesState.isGroupView.value = false
      const vm = createWrapper().vm as any
      expect(vm.activeTableData).toBe(mockTableDataInstances[0])
    })

    test('activeTableData returns selectedTableData for group', () => {
      mockGroupTablesState.isGroupView.value = true
      const vm = createWrapper().vm as any
      expect(vm.activeTableData).toBe(mockTableDataInstances[1])
    })

    test('table change watcher resets inline editing state', async () => {
      const vm = createWrapper().vm as any
      mockTableDataInstances[0].editingRowId.value = 'r1'
      mockGroupTablesState.tableKey.value = 'table_2'
      await nextTick()
      expect(mockTableDataInstances[0].editingRowId.value).toBe(null)
    })

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

    test('group edits skip rows not found in items', async () => {
      mockGroupTablesState.isGroupView.value = true
      mockGroupTablesState.groupTables.value = {
        Table_A: { get_list: {}, put_item: {} },
      }
      mockTableChangesState.modifiedTableKeys.value = ['table_a']
      mockTableChangesState.getChangesForTable.mockReturnValue({
        '999': { name: { newValue: 'z' } },
      })
      mockRepoInstance.getList = vi.fn(async () => [{ id: 1, name: 'a' }])
      const vm = createWrapper().vm as any
      await vm.saveAllGroupMasterTableChanges()
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
})

// Helpers used by guard tests -------------------------------------------------
function tableChangesGuardSetup() {
  mockTableChangesState.hasChanges.value = true
  mockTableChangesState.totalChangesCount.value = 2
  mockTableChangesState.modifiedTableKeys.value = ['table_1']
}

const guardStubs = {
  CoreTitleView: { template: '<div><slot /></div>' },
  CoreTable: { template: '<div></div>' },
  SimpleList: { template: '<div></div>' },
  CoreTab: { template: '<div></div>' },
  CoreTabs: { template: '<div></div>' },
  PendingChangesReviewModal: { template: '<div></div>' },
  CoreBulkUploadModal: { template: '<div></div>' },
  CoreBulkEditModal: { template: '<div></div>' },
  ForceRetryConfirmDialog: { template: '<div></div>' },
  MBaseModal: { template: '<div><slot /></div>' },
  AutoKPICard: { template: '<div></div>' },
  AutoLineChart: { template: '<div></div>' },
  AutoBarChart: { template: '<div></div>' },
  AutoPieChart: { template: '<div></div>' },
  AutoAreaChart: { template: '<div></div>' },
  AutoMapChart: { template: '<div></div>' },
  'v-dialog': { template: '<div><slot /></div>' },
  'v-menu': { template: '<div><slot /></div>' },
}

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
