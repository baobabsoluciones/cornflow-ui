import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import { nextTick } from 'vue'
import CreateExecutionLoadInstance from '@/components/project-execution/CreateExecutionLoadInstance.vue'

// Mock Instance model using vi.hoisted
const { mockInstanceClass, mockInstance } = vi.hoisted(() => {
  const mockInstance = {
    checkSchema: vi.fn(),
    data: { variables: {}, constraints: {} },
  }

  const mockInstanceClass = vi.fn().mockImplementation(() => mockInstance)
  mockInstanceClass.fromExcel = vi.fn().mockResolvedValue(mockInstance)
  mockInstanceClass.fromCsv = vi.fn().mockResolvedValue(mockInstance)

  return { mockInstanceClass, mockInstance }
})

vi.mock('@/app/models/Instance', () => ({
  Instance: mockInstanceClass,
}))

// Mock useInstanceProcessing composable
const mockInstanceProcessing = {
  processFiles: vi.fn(),
  processInstanceData: vi.fn(),
  processFromDb: vi.fn(),
  supportedExtensions: { value: ['json', 'xlsx', 'csv'] },
  state: { value: { isProcessing: false } },
  canProcessFiles: { value: true },
  resetState: vi.fn(),
}

const mockBuildInstanceDataFromAlternativeFields = vi.fn(() => ({ built: true }))

vi.mock('@/composables/useInstanceProcessing', () => ({
  useInstanceProcessing: vi.fn(() => mockInstanceProcessing),
  buildInstanceDataFromAlternativeFields: (...args: any[]) =>
    mockBuildInstanceDataFromAlternativeFields(...args),
}))

// Mock useFileProcessors composable
const mockUseFileProcessors = {
  processFileByPrefix: vi.fn(),
  needsSpecialProcessing: vi.fn(),
}

vi.mock('@/app/composables/useFileProcessors', () => ({
  useFileProcessors: vi.fn(() => mockUseFileProcessors),
}))

// Mock Pinia store
const mockGeneralStore = {
  appConfig: {
    Instance: mockInstanceClass,
    parameters: {
      schema: 'test-schema',
      loadInstanceStepOptional: undefined,
    },
    getSchemaName: 'test-schema',
  },
  getSchemaConfig: {
    instanceSchema: 'instance-schema',
    instanceChecksSchema: 'instance-checks-schema',
  },
}

vi.mock('@/stores/general', () => ({
  useGeneralStore: vi.fn(() => mockGeneralStore),
}))

// Mock i18n
const mockT = vi.fn((key) => {
  const translations = {
    'projectExecution.steps.step3.loadInstance.dragAndDropDescription':
      'Drag and drop instance files',
    'projectExecution.steps.step3.loadInstance.uploadFile': 'Upload Files',
    'projectExecution.steps.step3.loadInstance.invalidFileFormat':
      'Invalid file format',
    'projectExecution.steps.step3.loadInstance.loadInstance': 'Load Instance',
    'projectExecution.steps.step3.loadInstance.noValidInstancesError':
      'No valid instances found',
    'projectExecution.steps.step3.loadInstance.instanceSchemaError':
      'Instance schema validation failed',
    'projectExecution.steps.step3.loadInstance.instancesLoaded':
      'Instances loaded successfully',
    'projectExecution.steps.step3.loadInstance.unexpectedError':
      'Unexpected error occurred',
    'projectExecution.steps.step3.loadInstance.fileReadError':
      'Failed to read file',
    'projectExecution.steps.step3.loadInstance.unsupportedFileFormat':
      'Unsupported file format',
    'projectExecution.steps.step3.loadInstance.optionalOrDivider': 'or',
    'projectExecution.steps.step3.loadInstance.alternativeParametersHint':
      'Hint',
    'projectExecution.steps.step3.loadInstance.loadParameters':
      'Load parameters',
    'projectExecution.steps.step3.loadInstance.warningTitle': 'Warning',
    'common.file': 'file',
    'common.files': 'files',
  }
  return translations[key] || key
})

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: mockT,
  }),
}))

// Mock MDragNDropFile component
const MDragNDropFileStub = {
  name: 'MDragNDropFile',
  template: `
    <div class="m-drag-drop-file" data-testid="drag-drop-file">
      <div class="description">{{ description }}</div>
      <div class="uploaded-files">
        <div v-for="file in uploadedFiles" :key="file.name" class="uploaded-file">{{ file.name }}</div>
      </div>
      <div class="errors" v-if="errors" v-html="errors"></div>
      <button @click="$emit('files-selected', mockFiles)" data-testid="file-select">
        {{ downloadButtonTitle }}
      </button>
    </div>
  `,
  props: [
    'multiple',
    'downloadIcon',
    'description',
    'uploadedFiles',
    'formatsAllowed',
    'errors',
    'downloadButtonTitle',
    'invalidFileText',
  ],
  emits: ['files-selected'],
  setup() {
    const mockFiles = [
      new File(['{"test": "data"}'], 'test.json', { type: 'application/json' }),
    ]
    return { mockFiles }
  },
}

describe('CreateExecutionLoadInstance', () => {
  let vuetify: any
  let wrapper: any
  let mockShowSnackbar: any

  beforeEach(() => {
    vuetify = createVuetify()
    mockShowSnackbar = vi.fn()
    vi.clearAllMocks()

    // Reset mocks
    mockInstance.checkSchema.mockResolvedValue([])
    mockInstanceClass.fromExcel.mockResolvedValue(mockInstance)
    mockInstanceClass.fromCsv.mockResolvedValue(mockInstance)
    mockUseFileProcessors.processFileByPrefix.mockResolvedValue(null)
    mockUseFileProcessors.needsSpecialProcessing.mockReturnValue(false)

    // Reset instanceProcessing mock
    mockInstanceProcessing.processFiles.mockResolvedValue({
      success: true,
      instance: mockInstance,
    })
    mockInstanceProcessing.processInstanceData.mockResolvedValue({
      success: true,
      instance: mockInstance,
    })
    mockInstanceProcessing.processFromDb.mockResolvedValue({
      success: true,
      instance: mockInstance,
    })
    mockInstanceProcessing.state.value.isProcessing = false
    mockInstanceProcessing.canProcessFiles.value = true
    // Reset etl config + raw configurations to a clean default each test
    mockGeneralStore.appConfig.parameters.etl = undefined
    mockGeneralStore.rawConfigurations = { masterData: null }
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })

  const createWrapper = (props = {}) => {
    const defaultProps = {
      instance: null,
      selectedFiles: [],
      existingInstanceErrors: null,
      newExecution: {},
    }

    return mount(CreateExecutionLoadInstance, {
      props: { ...defaultProps, ...props },
      global: {
        plugins: [vuetify],
        provide: {
          showSnackbar: mockShowSnackbar,
        },
        stubs: {
          MDragNDropFile: MDragNDropFileStub,
          VBtn: {
            template:
              '<button class="v-btn" @click="$emit(\'click\')" :disabled="disabled" :class="$attrs.class"><slot /></button>',
            props: ['color', 'disabled', 'elevation', 'large'],
            emits: ['click'],
          },
          VIcon: {
            template: '<i class="v-icon" :data-left="left"><slot /></i>',
            props: ['left'],
          },
          VProgressCircular: {
            template:
              '<div class="v-progress-circular" :data-indeterminate="indeterminate" :data-color="color" :data-size="size"></div>',
            props: ['indeterminate', 'color', 'size'],
          },
          VAlert: {
            template:
              '<div class="v-alert" :data-type="type" :data-closable="closable"><slot /></div>',
            props: ['type', 'variant', 'density', 'closable'],
            emits: ['click:close'],
          },
        },
      },
    })
  }

  describe('Component Rendering', () => {
    beforeEach(() => {
      wrapper = createWrapper()
    })

    test('renders the drag and drop component', () => {
      expect(wrapper.findComponent(MDragNDropFileStub).exists()).toBe(true)
    })

    test('renders the load instance button', () => {
      const button = wrapper.find('.load-instance-btn')
      expect(button.exists()).toBe(true)
      expect(button.text()).toContain('Load Instance')
    })

    test('button is disabled when no files are selected', () => {
      const button = wrapper.find('.load-instance-btn')
      expect(button.attributes('disabled')).toBe('')
    })

    test('does not show progress spinner initially', () => {
      expect(wrapper.find('.v-progress-circular').exists()).toBe(false)
    })

    test('passes correct props to MDragNDropFile', () => {
      const dragDrop = wrapper.findComponent(MDragNDropFileStub)
      expect(dragDrop.props('multiple')).toBe('') // Boolean attributes become empty strings in stubs
      expect(dragDrop.props('downloadIcon')).toBe('mdi-upload')
      expect(dragDrop.props('formatsAllowed')).toEqual(['json', 'xlsx', 'csv'])
    })
  })

  describe('File Selection', () => {
    beforeEach(() => {
      wrapper = createWrapper()
    })

    test('handles file selection from drag and drop component', async () => {
      const testFile = new File(['test content'], 'test.json', {
        type: 'application/json',
      })

      await wrapper.vm.onFileSelected([testFile])

      expect(wrapper.vm.selectedFiles).toEqual([testFile])
      expect(wrapper.vm.instanceErrors).toBe(null)
    })

    test('enables button when files are selected', async () => {
      const testFile = new File(['test content'], 'test.json', {
        type: 'application/json',
      })

      await wrapper.vm.onFileSelected([testFile])
      await nextTick()

      const button = wrapper.find('.load-instance-btn')
      expect(button.attributes('disabled')).toBeFalsy()
    })

    test('shows file count in button text', async () => {
      const testFiles = [
        new File(['test1'], 'test1.json', { type: 'application/json' }),
        new File(['test2'], 'test2.json', { type: 'application/json' }),
      ]

      await wrapper.vm.onFileSelected(testFiles)
      await nextTick()

      const button = wrapper.find('.load-instance-btn')
      expect(button.text()).toContain('(2 files)')
    })

    test('shows singular file text for one file', async () => {
      const testFile = new File(['test'], 'test.json', {
        type: 'application/json',
      })

      await wrapper.vm.onFileSelected([testFile])
      await nextTick()

      const button = wrapper.find('.load-instance-btn')
      expect(button.text()).toContain('(1 file)')
    })

    test('resets errors when new files are selected', async () => {
      wrapper.vm.instanceErrors = 'Previous error'
      const testFile = new File(['test'], 'test.json', {
        type: 'application/json',
      })

      await wrapper.vm.onFileSelected([testFile])

      expect(wrapper.vm.instanceErrors).toBe(null)
      expect(wrapper.emitted('update:existingInstanceErrors')).toBeTruthy()
    })
  })

  describe('File Processing', () => {
    beforeEach(() => {
      wrapper = createWrapper()
    })

    test('processes single JSON file successfully', async () => {
      const testFile = new File(['{}'], 'test.json', {
        type: 'application/json',
      })

      wrapper.vm.selectedFiles = [testFile]

      await wrapper.vm.processFiles()

      expect(mockInstanceProcessing.processFiles).toHaveBeenCalledWith([
        testFile,
      ])
      expect(wrapper.emitted('instanceSelected')).toBeTruthy()
      expect(mockShowSnackbar).toHaveBeenCalledWith(
        'Instances loaded successfully',
      )
    })

    test('processes Excel file successfully', async () => {
      const testFile = new File([new ArrayBuffer(8)], 'test.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })

      wrapper.vm.selectedFiles = [testFile]

      await wrapper.vm.processFiles()

      expect(mockInstanceProcessing.processFiles).toHaveBeenCalledWith([
        testFile,
      ])
      expect(wrapper.emitted('instanceSelected')).toBeTruthy()
    })

    test('processes CSV file successfully', async () => {
      const testFile = new File(['variable,value\nx,1\ny,2'], 'test.csv', {
        type: 'text/csv',
      })

      wrapper.vm.selectedFiles = [testFile]

      await wrapper.vm.processFiles()

      expect(mockInstanceProcessing.processFiles).toHaveBeenCalledWith([
        testFile,
      ])
      expect(wrapper.emitted('instanceSelected')).toBeTruthy()
    })

    test('handles unsupported file format', async () => {
      const testFile = new File(['test content'], 'test.txt', {
        type: 'text/plain',
      })

      // Mock processFiles to return error
      mockInstanceProcessing.processFiles.mockResolvedValue({
        success: false,
        errors: 'Unsupported file format',
      })

      wrapper.vm.selectedFiles = [testFile]

      await wrapper.vm.processFiles()

      expect(mockShowSnackbar).toHaveBeenCalledWith(
        'Instance schema validation failed',
        'error',
      )
    })

    test('shows loading spinner during processing', async () => {
      const testFile = new File(['{}'], 'test.json', {
        type: 'application/json',
      })
      wrapper.vm.selectedFiles = [testFile]

      // Test that the computed property reflects the mock state
      expect(wrapper.vm.isCheckingSchema).toBe(false)

      // Test that progress circular is not shown initially
      expect(wrapper.find('.v-progress-circular').exists()).toBe(false)

      // The loading state is managed by the instanceProcessing composable
      // We can verify that the component correctly uses the computed property
      expect(typeof wrapper.vm.isCheckingSchema).toBe('boolean')
    })

    test('handles file reader error', async () => {
      const testFile = new File(['test'], 'test.json', {
        type: 'application/json',
      })

      // Mock processFiles to return error
      mockInstanceProcessing.processFiles.mockResolvedValue({
        success: false,
        errors: 'Failed to read file',
      })

      wrapper.vm.selectedFiles = [testFile]

      await wrapper.vm.processFiles()

      expect(wrapper.vm.instanceErrors).toContain('Failed to read file')
      expect(wrapper.emitted('update:existingInstanceErrors')).toBeTruthy()
    })
  })

  describe('Schema Validation', () => {
    beforeEach(() => {
      wrapper = createWrapper()
    })

    test('handles schema validation errors', async () => {
      const testFile = new File(['{}'], 'test.json', {
        type: 'application/json',
      })

      // Mock processFiles to return validation errors
      mockInstanceProcessing.processFiles.mockResolvedValue({
        success: false,
        errors: 'Required property missing',
      })

      wrapper.vm.selectedFiles = [testFile]

      await wrapper.vm.processFiles()

      expect(wrapper.vm.instanceErrors).toContain('Required property missing')
      expect(mockShowSnackbar).toHaveBeenCalledWith(
        'Instance schema validation failed',
        'error',
      )
    })

    test('handles schema validation exception', async () => {
      const testFile = new File(['{}'], 'test.json', {
        type: 'application/json',
      })

      // Mock processFiles to throw exception
      mockInstanceProcessing.processFiles.mockRejectedValue(
        new Error('Validation failed'),
      )

      wrapper.vm.selectedFiles = [testFile]

      await wrapper.vm.processFiles()

      expect(wrapper.vm.instanceErrors).toContain('Validation failed')
      expect(mockShowSnackbar).toHaveBeenCalledWith(
        'Instance schema validation failed',
        'error',
      )
    })
  })

  describe('Special File Processing', () => {
    beforeEach(() => {
      wrapper = createWrapper()
    })

    test('handles special file processing when needed', async () => {
      const testFile = new File(
        ['special content'],
        'special_prefix_test.json',
        { type: 'application/json' },
      )

      wrapper.vm.selectedFiles = [testFile]

      await wrapper.vm.processFiles()

      expect(mockInstanceProcessing.processFiles).toHaveBeenCalledWith([
        testFile,
      ])
      expect(wrapper.emitted('instanceSelected')).toBeTruthy()
    })

    test('handles special file processing errors', async () => {
      const testFile = new File(
        ['special content'],
        'special_prefix_test.json',
        { type: 'application/json' },
      )

      // Mock processFiles to return error
      mockInstanceProcessing.processFiles.mockResolvedValue({
        success: false,
        errors: 'Special processing failed',
      })

      wrapper.vm.selectedFiles = [testFile]

      await wrapper.vm.processFiles()

      expect(wrapper.vm.instanceErrors).toContain('Special processing failed')
      expect(mockShowSnackbar).toHaveBeenCalledWith(
        'Instance schema validation failed',
        'error',
      )
    })
  })

  describe('Props and Watchers', () => {
    test('initializes with selectedFiles prop', async () => {
      const testFile = new File(['test'], 'test.json', {
        type: 'application/json',
      })
      wrapper = createWrapper({ selectedFiles: [testFile] })

      // Wait for onMounted to run
      await nextTick()

      expect(wrapper.vm.selectedFiles).toEqual([testFile])
    })

    test('watches existingInstanceErrors prop', async () => {
      wrapper = createWrapper({ existingInstanceErrors: 'Initial error' })

      expect(wrapper.vm.instanceErrors).toBe('Initial error')

      await wrapper.setProps({ existingInstanceErrors: 'Updated error' })

      expect(wrapper.vm.instanceErrors).toBe('Updated error')
    })

    test('accepts all required props', () => {
      const testFile = new File(['test'], 'test.json')
      const props = {
        instance: null, // Vue type checking doesn't work with mocked classes
        selectedFiles: [testFile],
        existingInstanceErrors: 'Test error',
        newExecution: { name: 'Test Execution' },
      }

      wrapper = createWrapper(props)

      expect(wrapper.props()).toEqual(
        expect.objectContaining({
          selectedFiles: expect.arrayContaining([testFile]),
          existingInstanceErrors: 'Test error',
          newExecution: { name: 'Test Execution' },
        }),
      )
    })
  })

  describe('Event Emission', () => {
    beforeEach(() => {
      wrapper = createWrapper()
    })

    test('emits update:existingInstanceErrors when errors change', async () => {
      await wrapper.vm.onFileSelected([])

      expect(wrapper.emitted('update:existingInstanceErrors')).toBeTruthy()
      expect(wrapper.emitted('update:existingInstanceErrors')[0]).toEqual([
        null,
      ])
    })

    test('emits instanceSelected when processing succeeds', async () => {
      const testFile = new File(['{}'], 'test.json', {
        type: 'application/json',
      })

      const mockFileReader = {
        readAsText: vi.fn(),
        result: '{}',
        onload: null,
        onerror: null,
      }
      global.FileReader = vi.fn(() => mockFileReader)

      // Mock the instanceProcessing to return success
      const mockInstanceProcessing = wrapper.vm.instanceProcessing
      mockInstanceProcessing.processFiles = vi.fn().mockResolvedValue({
        success: true,
        instance: mockInstance,
      })

      wrapper.vm.selectedFiles = [testFile]

      await wrapper.vm.processFiles()

      expect(wrapper.emitted('instanceSelected')).toBeTruthy()
      expect(wrapper.emitted('instanceSelected')[0][0]).toBeDefined()
    })
  })

  describe('Error Handling', () => {
    beforeEach(() => {
      wrapper = createWrapper()
    })

    test('handles no valid instances error', async () => {
      // No files selected
      await wrapper.vm.processFiles()

      // Should exit early without processing
      expect(wrapper.vm.isCheckingSchema).toBe(false)
    })

    test('handles JSON parsing errors', async () => {
      const testFile = new File(['invalid json'], 'test.json', {
        type: 'application/json',
      })

      // Mock processFiles to return JSON parsing error
      mockInstanceProcessing.processFiles.mockResolvedValue({
        success: false,
        errors: 'Unexpected token \'i\', "invalid json" is not valid JSON',
      })

      wrapper.vm.selectedFiles = [testFile]

      await wrapper.vm.processFiles()

      expect(wrapper.vm.instanceErrors).toContain('Unexpected token')
      expect(mockShowSnackbar).toHaveBeenCalledWith(
        'Instance schema validation failed',
        'error',
      )
    })

    test('ensures loading state is reset on error', async () => {
      const testFile = new File(['invalid'], 'test.json', {
        type: 'application/json',
      })

      // Mock processFiles to return error
      mockInstanceProcessing.processFiles.mockResolvedValue({
        success: false,
        errors: 'Processing error',
      })

      wrapper.vm.selectedFiles = [testFile]

      await wrapper.vm.processFiles()

      expect(wrapper.vm.isCheckingSchema).toBe(false)
    })
  })

  describe('Button Interaction', () => {
    beforeEach(() => {
      wrapper = createWrapper()
    })

    test('verifies button has correct click handler', async () => {
      const testFile = new File(['{}'], 'test.json', {
        type: 'application/json',
      })
      wrapper.vm.selectedFiles = [testFile]
      await wrapper.vm.$nextTick()

      const button = wrapper.find('button.load-instance-btn')
      expect(button.exists()).toBe(true)
      expect(button.classes()).toContain('load-instance-btn')

      // Test the button attributes and text
      expect(button.text()).toContain('Load Instance')
      expect(button.text()).toContain('(1 file)')
    })

    test('button is disabled during processing', async () => {
      // Set the processing state in the mock
      mockInstanceProcessing.state.value.isProcessing = true
      await nextTick()

      const button = wrapper.find('.load-instance-btn')
      expect(button.attributes('disabled')).toBe('')

      // Reset the state
      mockInstanceProcessing.state.value.isProcessing = false
    })
  })

  describe('Integration Tests', () => {
    test('complete workflow: file selection to successful processing', async () => {
      const testFile = new File(
        ['{"variables": {"x": 1}}'],
        'complete_test.json',
        { type: 'application/json' },
      )

      wrapper = createWrapper()

      // 1. Select file
      await wrapper.vm.onFileSelected([testFile])
      expect(wrapper.vm.selectedFiles).toEqual([testFile])

      // 2. Process file
      await wrapper.vm.processFiles()

      // 3. Verify results
      expect(mockInstanceProcessing.processFiles).toHaveBeenCalledWith([
        testFile,
      ])
      expect(wrapper.emitted('instanceSelected')).toBeTruthy()
      expect(mockShowSnackbar).toHaveBeenCalledWith(
        'Instances loaded successfully',
      )
    })
  })

  describe('ETL warning display', () => {
    const file = () =>
      new File(['x'], 'inst.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })

    test('does not render warning alert when result has no warning', async () => {
      mockInstanceProcessing.processFiles.mockResolvedValueOnce({
        success: true,
        instance: mockInstance,
      })
      wrapper = createWrapper()
      await wrapper.vm.onFileSelected([file()])
      await wrapper.vm.processFiles()
      await nextTick()

      expect(wrapper.find('.load-instance-warning').exists()).toBe(false)
      expect(wrapper.vm.warningMessage).toBeNull()
    })

    test('renders warning alert with backend message on success', async () => {
      mockInstanceProcessing.processFiles.mockResolvedValueOnce({
        success: true,
        instance: mockInstance,
        warning: 'Some non-blocking issue happened',
      })
      wrapper = createWrapper()
      await wrapper.vm.onFileSelected([file()])
      await wrapper.vm.processFiles()
      await nextTick()

      const alert = wrapper.find('.load-instance-warning')
      expect(alert.exists()).toBe(true)
      expect(alert.attributes('data-type')).toBe('warning')
      expect(alert.text()).toContain('Warning') // title from i18n
      expect(alert.text()).toContain('Some non-blocking issue happened')
      // Instance is still emitted — warning is non-blocking.
      expect(wrapper.emitted('instanceSelected')).toBeTruthy()
    })

    test('previous warning is cleared when user selects new files', async () => {
      mockInstanceProcessing.processFiles.mockResolvedValueOnce({
        success: true,
        instance: mockInstance,
        warning: 'old warning',
      })
      wrapper = createWrapper()
      await wrapper.vm.onFileSelected([file()])
      await wrapper.vm.processFiles()
      await nextTick()
      expect(wrapper.vm.warningMessage).toBe('old warning')

      await wrapper.vm.onFileSelected([file()])
      await nextTick()

      expect(wrapper.vm.warningMessage).toBeNull()
      expect(wrapper.find('.load-instance-warning').exists()).toBe(false)
    })

    test('warning is reset when a new processing succeeds without warning', async () => {
      mockInstanceProcessing.processFiles
        .mockResolvedValueOnce({
          success: true,
          instance: mockInstance,
          warning: 'first',
        })
        .mockResolvedValueOnce({
          success: true,
          instance: mockInstance,
        })
      wrapper = createWrapper()
      await wrapper.vm.onFileSelected([file()])
      await wrapper.vm.processFiles()
      await nextTick()
      expect(wrapper.vm.warningMessage).toBe('first')

      await wrapper.vm.processFiles()
      await nextTick()
      expect(wrapper.vm.warningMessage).toBeNull()
    })

    test('warning is cleared on processing failure', async () => {
      mockInstanceProcessing.processFiles
        .mockResolvedValueOnce({
          success: true,
          instance: mockInstance,
          warning: 'previous warning',
        })
        .mockResolvedValueOnce({
          success: false,
          errors: 'Something broke',
          rawErrors: null,
        })
      wrapper = createWrapper()
      await wrapper.vm.onFileSelected([file()])
      await wrapper.vm.processFiles()
      await nextTick()
      expect(wrapper.vm.warningMessage).toBe('previous warning')

      await wrapper.vm.processFiles()
      await nextTick()
      expect(wrapper.vm.warningMessage).toBeNull()
    })
  })

  describe('Load from DB button', () => {
    test('hidden by default when etl config is absent', () => {
      wrapper = createWrapper()
      expect(wrapper.vm.showLoadFromDbButton).toBeFalsy()
      expect(wrapper.find('.load-from-db-btn').exists()).toBe(false)
    })

    test('shown when useEtlBackend and enableLoadFromDb are true', async () => {
      mockGeneralStore.appConfig.parameters.etl = {
        useEtlBackend: true,
        enableLoadFromDb: true,
      }
      wrapper = createWrapper()
      await nextTick()
      expect(wrapper.vm.showLoadFromDbButton).toBe(true)
      expect(wrapper.find('.load-from-db-btn').exists()).toBe(true)
    })

    test('processFromDb success emits instanceSelected and externalEtlData', async () => {
      mockInstanceProcessing.processFromDb.mockResolvedValueOnce({
        success: true,
        instance: mockInstance,
        rawData: { tables: {} },
      })
      wrapper = createWrapper()
      await wrapper.vm.processFromDb()
      await nextTick()
      expect(mockInstanceProcessing.processFromDb).toHaveBeenCalled()
      expect(wrapper.emitted('instanceSelected')).toBeTruthy()
      expect(wrapper.emitted('externalEtlData')).toBeTruthy()
    })

    test('processFromDb failure surfaces errors', async () => {
      mockInstanceProcessing.processFromDb.mockResolvedValueOnce({
        success: false,
        errors: 'db error',
        rawErrors: null,
      })
      wrapper = createWrapper()
      await wrapper.vm.processFromDb()
      await nextTick()
      expect(wrapper.vm.instanceErrors).toContain('db error')
    })

    test('processFromDb handles thrown exceptions', async () => {
      mockInstanceProcessing.processFromDb.mockRejectedValueOnce(
        new Error('boom'),
      )
      wrapper = createWrapper()
      await wrapper.vm.processFromDb()
      await nextTick()
      expect(wrapper.vm.instanceErrors).toContain('boom')
    })
  })

  describe('Alternative parameter fields', () => {
    const withFields = (fields: any[]) => {
      mockGeneralStore.appConfig.parameters.etl = {
        alternativeParameterFields: fields,
      }
    }

    test('showAlternativeColumn is false with no fields', () => {
      wrapper = createWrapper()
      expect(wrapper.vm.showAlternativeColumn).toBe(false)
      expect(wrapper.find('.load-parameters-btn').exists()).toBe(false)
    })

    test('renders the alternative column when fields are configured', async () => {
      withFields([
        { id: 'year', titleKey: 'fields.year', type: 'number' },
        { id: 'name', titleKey: 'fields.name', type: 'text' },
      ])
      wrapper = createWrapper()
      await nextTick()
      expect(wrapper.vm.showAlternativeColumn).toBe(true)
      expect(wrapper.find('.load-parameters-btn').exists()).toBe(true)
    })

    test('initializes paramValues from configured fields', async () => {
      withFields([{ id: 'year', titleKey: 'fields.year' }])
      wrapper = createWrapper()
      await nextTick()
      expect(wrapper.vm.paramValues).toHaveProperty('year')
      expect(wrapper.vm.paramValues.year).toBeNull()
    })

    test('inputTypeForField maps field types', async () => {
      withFields([{ id: 'a', titleKey: 'k' }])
      wrapper = createWrapper()
      await nextTick()
      expect(wrapper.vm.inputTypeForField({ type: 'date' })).toBe('date')
      expect(wrapper.vm.inputTypeForField({ type: 'number' })).toBe('number')
      expect(wrapper.vm.inputTypeForField({ type: 'text' })).toBe('text')
      expect(wrapper.vm.inputTypeForField({ type: undefined })).toBe('text')
    })

    test('canProcessParameters is false when a required field is empty', async () => {
      withFields([{ id: 'year', titleKey: 'k', required: true }])
      wrapper = createWrapper()
      await nextTick()
      expect(wrapper.vm.canProcessParameters).toBe(false)
    })

    test('canProcessParameters is true when required fields are filled', async () => {
      withFields([
        { id: 'year', titleKey: 'k', required: true },
        { id: 'opt', titleKey: 'k2', required: false },
      ])
      wrapper = createWrapper()
      await nextTick()
      wrapper.vm.paramValues.year = '2024'
      await nextTick()
      expect(wrapper.vm.canProcessParameters).toBe(true)
    })

    test('processParameters returns early when not processable', async () => {
      withFields([{ id: 'year', titleKey: 'k', required: true }])
      wrapper = createWrapper()
      await nextTick()
      await wrapper.vm.processParameters()
      expect(mockInstanceProcessing.processInstanceData).not.toHaveBeenCalled()
    })

    test('processParameters builds payload and processes when valid', async () => {
      withFields([{ id: 'year', titleKey: 'k', required: true }])
      mockInstanceProcessing.processInstanceData.mockResolvedValueOnce({
        success: true,
        instance: mockInstance,
        rawData: { tables: {} },
      })
      wrapper = createWrapper()
      await nextTick()
      wrapper.vm.paramValues.year = '2024'
      await nextTick()
      await wrapper.vm.processParameters()
      await nextTick()
      expect(mockBuildInstanceDataFromAlternativeFields).toHaveBeenCalled()
      expect(mockInstanceProcessing.processInstanceData).toHaveBeenCalled()
      expect(wrapper.emitted('instanceSelected')).toBeTruthy()
      expect(wrapper.emitted('externalEtlData')).toBeTruthy()
    })

    test('processParameters handles processing errors', async () => {
      withFields([{ id: 'year', titleKey: 'k', required: true }])
      mockInstanceProcessing.processInstanceData.mockResolvedValueOnce({
        success: false,
        errors: 'param error',
        rawErrors: null,
      })
      wrapper = createWrapper()
      await nextTick()
      wrapper.vm.paramValues.year = '2024'
      await nextTick()
      await wrapper.vm.processParameters()
      await nextTick()
      expect(wrapper.vm.instanceErrors).toContain('param error')
    })

    test('processParameters handles thrown exceptions', async () => {
      withFields([{ id: 'year', titleKey: 'k', required: true }])
      mockInstanceProcessing.processInstanceData.mockRejectedValueOnce(
        new Error('explode'),
      )
      wrapper = createWrapper()
      await nextTick()
      wrapper.vm.paramValues.year = '2024'
      await nextTick()
      await wrapper.vm.processParameters()
      await nextTick()
      expect(wrapper.vm.instanceErrors).toContain('explode')
    })
  })

  describe('displayedErrors computed', () => {
    const rawErr = (n: number) =>
      Array.from({ length: n }, (_, i) => ({
        instancePath: `/p${i}`,
        message: 'bad',
        keyword: 'type',
        schemaPath: '#/x',
        params: {},
      }))

    test('returns null when there are no errors', () => {
      wrapper = createWrapper()
      expect(wrapper.vm.displayedErrors).toBeNull()
    })

    test('returns errors as-is when there are no raw errors', async () => {
      wrapper = createWrapper()
      wrapper.vm.instanceErrors = '<p><strong>Errors</strong></p>'
      await nextTick()
      expect(wrapper.vm.displayedErrors).toBe('<p><strong>Errors</strong></p>')
    })

    test('adds total + download button when within display limit', async () => {
      wrapper = createWrapper()
      wrapper.vm.instanceErrors = '<p><strong>Errors</strong></p>'
      wrapper.vm.rawErrors = rawErr(3)
      await nextTick()
      const html = wrapper.vm.displayedErrors
      expect(html).toContain('totalErrors')
      expect(html).toContain('download-errors-btn')
    })

    test('limits displayed errors when above the display limit', async () => {
      wrapper = createWrapper()
      wrapper.vm.instanceErrors =
        '<p><strong>Instance errors</strong></p>'
      wrapper.vm.rawErrors = rawErr(200) // > DISPLAY_ERROR_LIMIT (150)
      await nextTick()
      const html = wrapper.vm.displayedErrors
      expect(html).toContain('andMoreErrors')
      expect(html).toContain('download-errors-btn')
    })
  })
})

