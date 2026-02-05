import { describe, test, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref, computed } from 'vue'
import { createVuetify } from 'vuetify'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createRouter, createMemoryHistory } from 'vue-router'
import SectionView from '@/views/SectionView.vue'

const mockCancelLoadData = vi.fn()

vi.mock('@/composables/section-view/useTableData', () => ({
  useTableData: () => ({
    items: ref([]),
    headers: ref([]),
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
    loadTableData: vi.fn(),
    tableHeadersForModal: computed(() => ({})),
    rowsDataForModal: computed(() => ({})),
    cancelLoadData: mockCancelLoadData,
    handleCellChange: vi.fn(),
    saveAllChanges: vi.fn(),
    revertTableChanges: vi.fn(),
    error: ref(null),
  }),
}))

vi.mock('@/composables/section-view/useSectionConfiguration', () => ({
  useSectionConfiguration: () => ({
    sectionType: ref('configuration'),
    currentConfiguration: ref({ table_1: { title: 'Table 1', get_list: {} } }),
  }),
}))

vi.mock('@/composables/section-view/useGroupTables', () => ({
  useGroupTables: () => ({
    tableKey: ref('table_1'),
    groupName: ref(null),
    selectedTable: ref(null),
    selectedTabIndex: ref(0),
    isGroupView: ref(false),
    groupTables: ref(null),
    tableConfig: ref({ title: 'Table 1', get_list: {} }),
    selectedTableConfig: ref(null),
    tabsData: ref([]),
    handleTabChange: vi.fn(),
    resolvedTableKey: ref('table_1'),
  }),
}))

vi.mock('@/composables/section-view/useSectionDisplay', () => ({
  useSectionDisplay: () => ({
    title: ref('Section'),
    description: ref('Description'),
    currentIcon: ref('mdi-table'),
  }),
}))

const createWrapper = () => {
  const vuetify = createVuetify()
  const pinia = createPinia()
  setActivePinia(pinia)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/section', component: SectionView }],
  })
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: {
      en: {
        executionTable: { loading: 'Loading...' },
        pendingChanges: {
          changesIndicator: '{count} changes',
          reviewChanges: 'Review changes',
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

  return mount(SectionView, {
    global: {
      plugins: [vuetify, pinia, i18n, router],
      stubs: {
        CoreTitleView: {
          template: '<div class="core-title-view-stub"><slot /></div>',
        },
        CoreTable: { template: '<div class="core-table-stub"></div>' },
        SimpleList: { template: '<div class="simple-list-stub"></div>' },
        CoreTab: { template: '<div class="core-tab-stub"></div>' },
        CoreTabs: { template: '<div class="core-tabs-stub"></div>' },
        PendingChangesReviewModal: {
          template: '<div class="pending-modal-stub"></div>',
        },
        MBaseModal: {
          template: '<div class="m-base-modal-stub"><slot /></div>',
        },
      },
    },
  })
}

describe('SectionView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Component rendering', () => {
    test('renders view container when configurations are ready', () => {
      const wrapper = createWrapper()
      expect(wrapper.find('.section-view').exists()).toBe(true)
    })
  })
})
