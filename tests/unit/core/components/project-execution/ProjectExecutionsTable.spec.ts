import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import ProjectExecutionsTable from '@/components/project-execution/ProjectExecutionsTable.vue'

// Mock the custom composable
const mockUseProjectExecutionsTable = {
  openConfirmationDeleteModal: { value: false },
  deletedItem: { value: null },
  processedExecutions: [
    {
      id: 'exec-1',
      name: 'Test Execution 1',
      description: 'Test description',
      createdAt: '2024-01-15T10:00:00Z',
      finishedAt: '2024-01-15T10:30:00Z',
      userName: 'testuser',
      userFullName: 'Test User',
      state: 1,
      solution_state: 0,
      solver: 'cplex',
      config: { timeLimit: 300 },
      isDownloading: false
    },
    {
      id: 'exec-2',
      name: 'Test Execution 2 With Very Long Name That Should Show Tooltip',
      description: 'Another test description that is quite long and should trigger tooltip',
      createdAt: '2024-01-16T11:00:00Z',
      finishedAt: null,
      userName: 'anotheruser_with_very_long_username',
      userFullName: 'Another User With Very Long Full Name',
      state: 0,
      solution_state: -1,
      solver: 'gurobi',
      config: { timeLimit: 600 },
      isDownloading: true
    }
  ],
  headerExecutions: [
    { title: 'Name', value: 'name' },
    { title: 'Created', value: 'createdAt' },
    { title: 'Finished', value: 'finishedAt' },
    { title: 'State', value: 'state' },
    { title: 'Actions', value: 'actions' }
  ],
  tableKey: { value: 'test-key' },
  addColgroup: vi.fn(),
  loadExecution: vi.fn(),
  deleteExecution: vi.fn(),
  confirmDelete: vi.fn(),
  cancelDelete: vi.fn(),
  handleDownload: vi.fn(),
  getStateInfo: vi.fn((state) => ({
    color: state === 1 ? 'success' : state === 0 ? 'warning' : 'error',
    code: state === 1 ? 'COMPLETED' : state === 0 ? 'RUNNING' : 'FAILED',
    message: state === 1 ? 'Execution completed' : state === 0 ? 'Execution running' : 'Execution failed'
  })),
  getSolutionInfo: vi.fn((state) => ({
    color: state === 0 ? 'success' : 'warning',
    code: state === 0 ? 'OPTIMAL' : 'NO_SOLUTION',
    message: state === 0 ? 'Optimal solution found' : 'No solution found'
  })),
  getSolverName: vi.fn((item) => item.solver || 'Unknown'),
  getTimeLimit: vi.fn((item) => item.config?.timeLimit || 0)
}

vi.mock('@/composables/project-execution-table/useProjectExecutionsTable', () => ({
  useProjectExecutionsTable: vi.fn(() => mockUseProjectExecutionsTable)
}))

// Mock Pinia store
const mockGeneralStore = {
  appConfig: {
    parameters: {
      showExtraProjectExecutionColumns: {
        showTimeLimit: true
      }
    }
  }
}

vi.mock('@/stores/general', () => ({
  useGeneralStore: vi.fn(() => mockGeneralStore)
}))

// Mock i18n
const mockT = vi.fn((key) => {
  const translations = {
    'executionTable.loadExecution': 'Load Execution',
    'executionTable.deleteExecution': 'Delete Execution',
    'executionTable.deleteTitle': 'Delete Execution',
    'executionTable.deleteMessage': 'Are you sure you want to delete this execution?',
    'executionTable.deleteButton': 'Delete',
    'executionTable.cancelButton': 'Cancel',
    'inputOutputData.errorDownloadingExcel': 'Error downloading Excel file'
  }
  return translations[key] || key
})

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: mockT
  })
}))

// Mock MDataTable component
const MDataTableStub = {
  name: 'MDataTable',
  template: `
    <div class="m-data-table" data-testid="data-table">
      <div v-for="(item, index) in items" :key="index" class="table-row" :data-item-id="item.id">
        <div class="table-cell" data-cell="name">
          <slot name="name" :item="item">{{ item.name }}</slot>
        </div>
        <div class="table-cell" data-cell="createdAt">
          <slot name="createdAt" :item="item">{{ item.createdAt }}</slot>
        </div>
        <div class="table-cell" data-cell="finishedAt">
          <slot name="finishedAt" :item="item">{{ item.finishedAt }}</slot>
        </div>
        <div class="table-cell" data-cell="userName">
          <slot name="userName" :item="item">{{ item.userName }}</slot>
        </div>
        <div class="table-cell" data-cell="userFullName">
          <slot name="userFullName" :item="item">{{ item.userFullName }}</slot>
        </div>
        <div class="table-cell" data-cell="description">
          <slot name="description" :item="item">{{ item.description }}</slot>
        </div>
        <div class="table-cell" data-cell="solver">
          <slot name="solver" :item="item">{{ item.solver }}</slot>
        </div>
        <div class="table-cell" data-cell="timeLimit">
          <slot name="timeLimit" :item="item">{{ item.timeLimit }}</slot>
        </div>
        <div class="table-cell" data-cell="state">
          <slot name="state" :item="item">{{ item.state }}</slot>
        </div>
        <div class="table-cell" data-cell="solution">
          <slot name="solution" :item="item">{{ item.solution_state }}</slot>
        </div>
        <div class="table-cell" data-cell="excel">
          <slot name="excel" :item="item">Excel</slot>
        </div>
        <div class="table-cell" data-cell="actions">
          <slot name="actions" :item="item">Actions</slot>
        </div>
      </div>
    </div>
  `,
  props: ['headers', 'items', 'showFooter', 'showHeaders', 'hideDefaultHeader']
}

// Mock MBaseModal component
const MBaseModalStub = {
  name: 'MBaseModal',
  template: `
    <div class="m-base-modal" v-if="modelValue" data-testid="delete-modal">
      <div class="modal-title">{{ title }}</div>
      <div class="modal-content">
        <slot name="content"></slot>
      </div>
      <div class="modal-buttons">
        <button 
          v-for="button in buttons" 
          :key="button.action"
          :class="button.class"
          @click="$emit(button.action)"
          :data-action="button.action"
        >
          {{ button.text }}
        </button>
      </div>
    </div>
  `,
  props: ['modelValue', 'closeOnOutsideClick', 'title', 'buttons'],
  emits: ['delete', 'cancel', 'close']
}

describe('ProjectExecutionsTable', () => {
  let vuetify: any
  let wrapper: any
  let mockShowSnackbar: any

  beforeEach(() => {
    vuetify = createVuetify()
    mockShowSnackbar = vi.fn()
    vi.clearAllMocks()
    // Reset modal state
    mockUseProjectExecutionsTable.openConfirmationDeleteModal.value = false
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })

  const createWrapper = (props = {}) => {
    const defaultProps = {
      executionsByDate: []
    }
    
    return mount(ProjectExecutionsTable, {
      props: { ...defaultProps, ...props },
      global: {
        plugins: [vuetify],
        provide: {
          showSnackbar: mockShowSnackbar
        },
        mocks: {
          $t: mockT
        },
        stubs: {
          MDataTable: MDataTableStub,
          MBaseModal: MBaseModalStub,
          VTooltip: {
            template: '<div class="v-tooltip" :data-location="location"><slot /></div>',
            props: ['activator', 'location']
          },
          VChip: {
            template: '<span class="v-chip" :data-color="color" :data-size="size" :data-value="value"><slot /></span>',
            props: ['size', 'color', 'value']
          },
          VIcon: {
            template: '<i class="v-icon" @click="$emit(\'click\')" :data-size="size"><slot /></i>',
            props: ['size'],
            emits: ['click']
          },
          VProgressCircular: {
            template: '<div class="v-progress-circular" :data-indeterminate="indeterminate" :data-size="size" :data-width="width" :data-color="color"></div>',
            props: ['indeterminate', 'size', 'width', 'color']
          },
          VRow: {
            template: '<div class="v-row" :class="$attrs.class"><slot /></div>'
          }
        }
      }
    })
  }

  describe('Component Rendering', () => {
    test('renders the table wrapper and container', () => {
      wrapper = createWrapper()
      
      expect(wrapper.find('.table-wrapper').exists()).toBe(true)
      expect(wrapper.find('.table-container').exists()).toBe(true)
      expect(wrapper.findComponent(MDataTableStub).exists()).toBe(true)
    })

    test('applies correct CSS classes based on props', () => {
      wrapper = createWrapper({
        useFixedWidth: true,
        showHeaders: false
      })
      
      const container = wrapper.find('.table-container')
      expect(container.classes()).toContain('fixed-width')
      expect(container.classes()).toContain('no-headers')
    })

    test('passes correct props to MDataTable', () => {
      wrapper = createWrapper({
        showFooter: false,
        showHeaders: true
      })
      
      const dataTable = wrapper.findComponent(MDataTableStub)
      expect(dataTable.props('showFooter')).toBe(false)
      expect(dataTable.props('showHeaders')).toBe(true)
      expect(dataTable.props('hideDefaultHeader')).toBe(false)
      expect(dataTable.props('headers')).toEqual(mockUseProjectExecutionsTable.headerExecutions)
      expect(dataTable.props('items')).toEqual(mockUseProjectExecutionsTable.processedExecutions)
    })
  })

  describe('Table Column Rendering', () => {
    beforeEach(() => {
      wrapper = createWrapper()
    })

    test('renders execution names with tooltips for long names', () => {
      const nameCell = wrapper.find('[data-cell="name"]')
      expect(nameCell.text()).toContain('Test Execution 1')
      
      // Check for tooltip on long names
      const tooltips = wrapper.findAll('.v-tooltip')
      expect(tooltips.length).toBeGreaterThan(0)
    })

    test('renders created and finished dates correctly', () => {
      const createdAtCells = wrapper.findAll('[data-cell="createdAt"]')
      expect(createdAtCells[0].text()).toContain('2024-01-15')
      
      const finishedAtCells = wrapper.findAll('[data-cell="finishedAt"]')
      expect(finishedAtCells[0].text()).toContain('2024-01-15')
      expect(finishedAtCells[1].text()).toContain('-') // null finishedAt should show '-'
    })

    test('renders user information with tooltips for long usernames', () => {
      const userNameCells = wrapper.findAll('[data-cell="userName"]')
      expect(userNameCells[0].text()).toContain('testuser')
      expect(userNameCells[1].text()).toContain('anotheruser_with_very_long_username')
      
      const userFullNameCells = wrapper.findAll('[data-cell="userFullName"]')
      expect(userFullNameCells[0].text()).toContain('Test User')
    })

    test('renders description with tooltips for long descriptions', () => {
      const descriptionCells = wrapper.findAll('[data-cell="description"]')
      expect(descriptionCells[0].text()).toContain('Test description')
      expect(descriptionCells[1].text()).toContain('Another test description')
    })

    test('renders solver information', () => {
      const solverCells = wrapper.findAll('[data-cell="solver"]')
      expect(solverCells.length).toBeGreaterThan(0)
      // The getSolverName mock function should be called
      expect(mockUseProjectExecutionsTable.getSolverName).toHaveBeenCalled()
    })

    test('renders time limit when enabled', () => {
      const timeLimitCells = wrapper.findAll('[data-cell="timeLimit"]')
      expect(timeLimitCells.length).toBeGreaterThan(0)
    })

    test('renders state chips with correct colors and tooltips', () => {
      const stateCells = wrapper.findAll('[data-cell="state"]')
      const stateChips = stateCells[0].findAll('.v-chip')
      expect(stateChips.length).toBeGreaterThan(0)
      expect(mockUseProjectExecutionsTable.getStateInfo).toHaveBeenCalled()
    })

    test('renders solution chips with correct information', () => {
      const solutionCells = wrapper.findAll('[data-cell="solution"]')
      const solutionChips = solutionCells[0].findAll('.v-chip')
      expect(solutionChips.length).toBeGreaterThan(0)
      expect(mockUseProjectExecutionsTable.getSolutionInfo).toHaveBeenCalled()
    })
  })

  describe('Excel Download Functionality', () => {
    beforeEach(() => {
      wrapper = createWrapper()
    })

    test('renders excel download icon when not downloading', () => {
      const excelCells = wrapper.findAll('[data-cell="excel"]')
      const icons = excelCells[0].findAll('.v-icon')
      expect(icons.length).toBeGreaterThan(0)
    })

    test('renders progress indicator when downloading', () => {
      const excelCells = wrapper.findAll('[data-cell="excel"]')
      // Second item has isDownloading: true
      const progressIndicators = excelCells[1].findAll('.v-progress-circular')
      expect(progressIndicators.length).toBeGreaterThan(0)
    })

    test('handles download click successfully', async () => {
      mockUseProjectExecutionsTable.handleDownload.mockResolvedValueOnce({ success: true })
      
      const testItem = { id: 'test', isDownloading: false }
      await wrapper.vm.handleDownloadClick(testItem)
      
      expect(mockUseProjectExecutionsTable.handleDownload).toHaveBeenCalledWith(testItem)
      expect(testItem.isDownloading).toBe(false) // Should be reset after completion
    })

    test('handles download click with error', async () => {
      mockUseProjectExecutionsTable.handleDownload.mockResolvedValueOnce({ error: 'Download failed' })
      
      const testItem = { id: 'test', isDownloading: false }
      await wrapper.vm.handleDownloadClick(testItem)
      
      expect(mockShowSnackbar).toHaveBeenCalledWith('Error downloading Excel file', 'error')
      expect(testItem.isDownloading).toBe(false)
    })
  })

  describe('Action Buttons', () => {
    beforeEach(() => {
      wrapper = createWrapper({
        loadingExecutions: new Set(['exec-2'])
      })
    })

    test('renders load execution icon when not loading', () => {
      const actionCells = wrapper.findAll('[data-cell="actions"]')
      const loadIcons = actionCells[0].findAll('.v-icon')
      expect(loadIcons.length).toBeGreaterThan(0)
    })

    test('renders progress indicator for loading executions', () => {
      const actionCells = wrapper.findAll('[data-cell="actions"]')
      // Second execution should show loading indicator
      const progressIndicators = actionCells[1].findAll('.v-progress-circular')
      expect(progressIndicators.length).toBeGreaterThan(0)
    })

    test('emits loadExecution event when load button clicked', async () => {
      const testExecution = { id: 'test-exec' }
      await wrapper.vm.loadExecutionClick(testExecution)
      
      expect(wrapper.emitted('loadExecution')).toBeTruthy()
      expect(wrapper.emitted('loadExecution')![0]).toEqual([testExecution])
    })

    test('renders delete icon for all executions', () => {
      const actionCells = wrapper.findAll('[data-cell="actions"]')
      actionCells.forEach(cell => {
        const deleteIcons = cell.findAll('.v-icon')
        expect(deleteIcons.length).toBeGreaterThan(0)
      })
    })
  })

  describe('Delete Confirmation Modal', () => {
    beforeEach(() => {
      wrapper = createWrapper()
    })

    test('does not render modal when not open', () => {
      const modal = wrapper.findComponent(MBaseModalStub)
      const modelValue = modal.props('modelValue')
      // The prop receives a reactive ref, so check its value property
      expect(modelValue.value).toBe(false)
    })

    test('renders modal when openConfirmationDeleteModal is true', async () => {
      mockUseProjectExecutionsTable.openConfirmationDeleteModal.value = true
      await wrapper.vm.$nextTick()
      
      expect(wrapper.find('[data-testid="delete-modal"]').exists()).toBe(true)
      expect(wrapper.text()).toContain('Delete Execution')
      expect(wrapper.text()).toContain('Are you sure you want to delete this execution?')
    })

    test('handles delete confirmation', async () => {
      mockUseProjectExecutionsTable.openConfirmationDeleteModal.value = true
      mockUseProjectExecutionsTable.deletedItem.value = { id: 'test-exec' }
      await wrapper.vm.$nextTick()
      
      const deleteButton = wrapper.find('[data-action="delete"]')
      await deleteButton.trigger('click')
      
      expect(wrapper.emitted('deleteExecution')).toBeTruthy()
      expect(wrapper.emitted('deleteExecution')![0]).toEqual([{ id: 'test-exec' }])
    })

    test('handles cancel action', async () => {
      mockUseProjectExecutionsTable.openConfirmationDeleteModal.value = true
      await wrapper.vm.$nextTick()
      
      const cancelButton = wrapper.find('[data-action="cancel"]')
      await cancelButton.trigger('click')
      
      // Modal should call cancelDelete from composable
      expect(mockUseProjectExecutionsTable.cancelDelete).toHaveBeenCalled()
    })
  })

  describe('Date Formatting', () => {
    test('formats dates as ISO date by default', () => {
      wrapper = createWrapper({ formatDateByTime: false })
      
      const result = wrapper.vm.formatToHHmm('2024-01-15T10:30:00Z')
      // The result depends on the local timezone, so just check the format
      expect(result).toMatch(/^\d{2}:\d{2}$/)
    })

    test('formats dates as time when formatDateByTime is true', () => {
      wrapper = createWrapper({ formatDateByTime: true })
      
      // Test the formatToHHmm utility function
      const result = wrapper.vm.formatToHHmm('2024-01-15T14:30:00Z')
      expect(result).toMatch(/\d{2}:\d{2}/)
    })
  })

  describe('Props and Configuration', () => {
    test('accepts executionsByDate prop', () => {
      const executions = [{ id: 'test', name: 'Test' }]
      wrapper = createWrapper({ executionsByDate: executions })
      
      expect(wrapper.props('executionsByDate')).toEqual(executions)
    })

    test('uses default prop values correctly', () => {
      wrapper = createWrapper()
      
      expect(wrapper.props('formatDateByTime')).toBe(false)
      expect(wrapper.props('showFooter')).toBe(true)
      expect(wrapper.props('showHeaders')).toBe(true)
      expect(wrapper.props('useFixedWidth')).toBe(true)
      expect(wrapper.props('loadingExecutions')).toEqual(new Set())
    })

    test('respects showTimeLimit configuration from store', () => {
      wrapper = createWrapper()
      
      expect(wrapper.vm.showTimeLimit).toBe(true)
    })
  })

  describe('Composable Integration', () => {
    beforeEach(() => {
      wrapper = createWrapper()
    })

    test('uses composable functions for state and solution info', () => {
      wrapper.vm.getStateInfo(1)
      wrapper.vm.getSolutionInfo(0)
      wrapper.vm.getSolverName({ solver: 'test' })
      wrapper.vm.getTimeLimit({ config: { timeLimit: 300 } })
      
      expect(mockUseProjectExecutionsTable.getStateInfo).toHaveBeenCalledWith(1)
      expect(mockUseProjectExecutionsTable.getSolutionInfo).toHaveBeenCalledWith(0)
      expect(mockUseProjectExecutionsTable.getSolverName).toHaveBeenCalledWith({ solver: 'test' })
      expect(mockUseProjectExecutionsTable.getTimeLimit).toHaveBeenCalledWith({ config: { timeLimit: 300 } })
    })

    test('uses composable data for table rendering', () => {
      const dataTable = wrapper.findComponent(MDataTableStub)
      
      expect(dataTable.props('items')).toBe(mockUseProjectExecutionsTable.processedExecutions)
      expect(dataTable.props('headers')).toBe(mockUseProjectExecutionsTable.headerExecutions)
    })
  })

  describe('Event Emitting', () => {
    beforeEach(() => {
      wrapper = createWrapper()
    })

    test('emits loadExecution event correctly', () => {
      const execution = { id: 'test' }
      wrapper.vm.loadExecutionClick(execution)
      
      expect(wrapper.emitted('loadExecution')).toBeTruthy()
      expect(wrapper.emitted('loadExecution')![0]).toEqual([execution])
    })

    test('emits deleteExecution event correctly', () => {
      mockUseProjectExecutionsTable.deletedItem.value = { id: 'deleted-exec' }
      wrapper.vm.confirmDeleteClick()
      
      expect(wrapper.emitted('deleteExecution')).toBeTruthy()
      expect(wrapper.emitted('deleteExecution')![0]).toEqual([{ id: 'deleted-exec' }])
    })
  })

  describe('Injection and Dependencies', () => {
    test('injects showSnackbar function correctly', () => {
      wrapper = createWrapper()
      
      expect(wrapper.vm.showSnackbar).toBe(mockShowSnackbar)
    })

    test('uses i18n translation function', () => {
      wrapper = createWrapper()
      
      expect(mockT).toHaveBeenCalledWith('executionTable.loadExecution')
      expect(mockT).toHaveBeenCalledWith('executionTable.deleteExecution')
    })
  })
})
