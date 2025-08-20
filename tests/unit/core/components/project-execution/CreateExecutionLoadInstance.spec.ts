import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import { nextTick } from 'vue'
import CreateExecutionLoadInstance from '@/components/project-execution/CreateExecutionLoadInstance.vue'

// Mock Instance model using vi.hoisted
const { mockInstanceClass, mockInstance } = vi.hoisted(() => {
  const mockInstance = {
    checkSchema: vi.fn(),
    data: { variables: {}, constraints: {} }
  }

  const mockInstanceClass = vi.fn().mockImplementation(() => mockInstance)
  mockInstanceClass.fromExcel = vi.fn().mockResolvedValue(mockInstance)
  mockInstanceClass.fromCsv = vi.fn().mockResolvedValue(mockInstance)

  return { mockInstanceClass, mockInstance }
})

vi.mock('@/app/models/Instance', () => ({
  Instance: mockInstanceClass
}))

// Mock useFileProcessors composable
const mockUseFileProcessors = {
  processFileByPrefix: vi.fn(),
  needsSpecialProcessing: vi.fn()
}

vi.mock('@/app/composables/useFileProcessors', () => ({
  useFileProcessors: vi.fn(() => mockUseFileProcessors)
}))

// Mock Pinia store
const mockGeneralStore = {
  appConfig: {
    Instance: mockInstanceClass,
    parameters: {
      schema: 'test-schema'
    }
  },
  getSchemaConfig: {
    instanceSchema: 'instance-schema',
    instanceChecksSchema: 'instance-checks-schema'
  }
}

vi.mock('@/stores/general', () => ({
  useGeneralStore: vi.fn(() => mockGeneralStore)
}))

// Mock i18n
const mockT = vi.fn((key) => {
  const translations = {
    'projectExecution.steps.step3.loadInstance.dragAndDropDescription': 'Drag and drop instance files',
    'projectExecution.steps.step3.loadInstance.uploadFile': 'Upload Files',
    'projectExecution.steps.step3.loadInstance.invalidFileFormat': 'Invalid file format',
    'projectExecution.steps.step3.loadInstance.loadInstance': 'Load Instance',
    'projectExecution.steps.step3.loadInstance.noValidInstancesError': 'No valid instances found',
    'projectExecution.steps.step3.loadInstance.instanceSchemaError': 'Instance schema validation failed',
    'projectExecution.steps.step3.loadInstance.instancesLoaded': 'Instances loaded successfully',
    'projectExecution.steps.step3.loadInstance.unexpectedError': 'Unexpected error occurred',
    'projectExecution.steps.step3.loadInstance.fileReadError': 'Failed to read file',
    'projectExecution.steps.step3.loadInstance.unsupportedFileFormat': 'Unsupported file format'
  }
  return translations[key] || key
})

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: mockT
  })
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
  props: ['multiple', 'downloadIcon', 'description', 'uploadedFiles', 'formatsAllowed', 'errors', 'downloadButtonTitle', 'invalidFileText'],
  emits: ['files-selected'],
  setup() {
    const mockFiles = [
      new File(['{"test": "data"}'], 'test.json', { type: 'application/json' })
    ]
    return { mockFiles }
  }
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
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })

  const createWrapper = (props = {}) => {
    const defaultProps = {
      instance: null,
      fileSelected: null,
      existingInstanceErrors: null,
      newExecution: {}
    }
    
    return mount(CreateExecutionLoadInstance, {
      props: { ...defaultProps, ...props },
      global: {
        plugins: [vuetify],
        provide: {
          showSnackbar: mockShowSnackbar
        },
        stubs: {
          MDragNDropFile: MDragNDropFileStub,
          VBtn: {
            template: '<button class="v-btn" @click="$emit(\'click\')" :disabled="disabled" :class="$attrs.class"><slot /></button>',
            props: ['color', 'disabled', 'elevation', 'large'],
            emits: ['click']
          },
          VIcon: {
            template: '<i class="v-icon" :data-left="left"><slot /></i>',
            props: ['left']
          },
          VProgressCircular: {
            template: '<div class="v-progress-circular" :data-indeterminate="indeterminate" :data-color="color" :data-size="size"></div>',
            props: ['indeterminate', 'color', 'size']
          }
        }
      }
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
      const testFile = new File(['test content'], 'test.json', { type: 'application/json' })
      
      await wrapper.vm.onFileSelected([testFile])
      
      expect(wrapper.vm.selectedFiles).toEqual([testFile])
      expect(wrapper.vm.instanceErrors).toBe(null)
    })

    test('enables button when files are selected', async () => {
      const testFile = new File(['test content'], 'test.json', { type: 'application/json' })
      
      await wrapper.vm.onFileSelected([testFile])
      await nextTick()
      
      const button = wrapper.find('.load-instance-btn')
      expect(button.attributes('disabled')).toBeFalsy()
    })

    test('shows file count in button text', async () => {
      const testFiles = [
        new File(['test1'], 'test1.json', { type: 'application/json' }),
        new File(['test2'], 'test2.json', { type: 'application/json' })
      ]
      
      await wrapper.vm.onFileSelected(testFiles)
      await nextTick()
      
      const button = wrapper.find('.load-instance-btn')
      expect(button.text()).toContain('(2 files)')
    })

    test('shows singular file text for one file', async () => {
      const testFile = new File(['test'], 'test.json', { type: 'application/json' })
      
      await wrapper.vm.onFileSelected([testFile])
      await nextTick()
      
      const button = wrapper.find('.load-instance-btn')
      expect(button.text()).toContain('(1 file)')
    })

    test('resets errors when new files are selected', async () => {
      wrapper.vm.instanceErrors = 'Previous error'
      const testFile = new File(['test'], 'test.json', { type: 'application/json' })
      
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
      const fileContent = '{"variables": {"x": 1}, "constraints": {"c1": "x <= 10"}}'
      const testFile = new File([fileContent], 'test.json', { type: 'application/json' })
      
      // Mock FileReader
      const mockFileReader = {
        readAsText: vi.fn(),
        result: fileContent,
        onload: null,
        onerror: null
      }
      global.FileReader = vi.fn(() => mockFileReader)
      
      wrapper.vm.selectedFiles = [testFile]
      
      const processPromise = wrapper.vm.processFiles()
      
      // Trigger file reader onload
      mockFileReader.onload()
      
      await processPromise
      
      expect(wrapper.emitted('instanceSelected')).toBeTruthy()
      expect(mockShowSnackbar).toHaveBeenCalledWith('Instances loaded successfully')
    })

    test('processes Excel file successfully', async () => {
      const testFile = new File([new ArrayBuffer(8)], 'test.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      
      const mockFileReader = {
        readAsArrayBuffer: vi.fn(),
        result: new ArrayBuffer(8),
        onload: null,
        onerror: null
      }
      global.FileReader = vi.fn(() => mockFileReader)
      
      wrapper.vm.selectedFiles = [testFile]
      
      const processPromise = wrapper.vm.processFiles()
      
      // Trigger file reader onload
      mockFileReader.onload()
      
      await processPromise
      
      expect(mockInstanceClass.fromExcel).toHaveBeenCalled()
      expect(wrapper.emitted('instanceSelected')).toBeTruthy()
    })

    test('processes CSV file successfully', async () => {
      const fileContent = 'variable,value\nx,1\ny,2'
      const testFile = new File([fileContent], 'test.csv', { type: 'text/csv' })
      
      const mockFileReader = {
        readAsText: vi.fn(),
        result: fileContent,
        onload: null,
        onerror: null
      }
      global.FileReader = vi.fn(() => mockFileReader)
      
      wrapper.vm.selectedFiles = [testFile]
      
      const processPromise = wrapper.vm.processFiles()
      
      // Trigger file reader onload
      mockFileReader.onload()
      
      await processPromise
      
      expect(mockInstanceClass.fromCsv).toHaveBeenCalled()
      expect(wrapper.emitted('instanceSelected')).toBeTruthy()
    })

    test('handles unsupported file format', async () => {
      const testFile = new File(['test content'], 'test.txt', { type: 'text/plain' })
      
      const mockFileReader = {
        readAsText: vi.fn(),
        result: 'test content',
        onload: null,
        onerror: null
      }
      global.FileReader = vi.fn(() => mockFileReader)
      
      wrapper.vm.selectedFiles = [testFile]
      
      const processPromise = wrapper.vm.processFiles()
      
      // Trigger file reader onload
      mockFileReader.onload()
      
      await processPromise
      
      expect(mockShowSnackbar).toHaveBeenCalledWith(
        'test.txt: Unexpected error occurred',
        'error'
      )
    })

    test('shows loading spinner during processing', async () => {
      const testFile = new File(['{}'], 'test.json', { type: 'application/json' })
      wrapper.vm.selectedFiles = [testFile]
      
      const mockFileReader = {
        readAsText: vi.fn(),
        result: '{}',
        onload: null,
        onerror: null
      }
      global.FileReader = vi.fn(() => mockFileReader)
      
      const processPromise = wrapper.vm.processFiles()
      
      // Should show loading
      expect(wrapper.vm.isCheckingSchema).toBe(true)
      await nextTick()
      expect(wrapper.find('.v-progress-circular').exists()).toBe(true)
      
      // Complete processing
      mockFileReader.onload()
      await processPromise
      
      // Should hide loading
      expect(wrapper.vm.isCheckingSchema).toBe(false)
    })

    test('handles file reader error', async () => {
      const testFile = new File(['test'], 'test.json', { type: 'application/json' })
      
      const mockFileReader = {
        readAsText: vi.fn(),
        onload: null,
        onerror: null
      }
      global.FileReader = vi.fn(() => mockFileReader)
      
      wrapper.vm.selectedFiles = [testFile]
      
      const processPromise = wrapper.vm.processFiles()
      
      // Trigger file reader error
      mockFileReader.onerror(new Error('Read failed'))
      
      await processPromise
      
      expect(wrapper.vm.instanceErrors).toContain('Failed to read file')
      expect(wrapper.emitted('update:existingInstanceErrors')).toBeTruthy()
    })
  })

  describe('Schema Validation', () => {
    beforeEach(() => {
      wrapper = createWrapper()
    })

    test('handles schema validation errors', async () => {
      const validationErrors = [
        { instancePath: '/variables', message: 'Required property missing' }
      ]
      mockInstance.checkSchema.mockResolvedValue(validationErrors)
      
      const testFile = new File(['{}'], 'test.json', { type: 'application/json' })
      
      const mockFileReader = {
        readAsText: vi.fn(),
        result: '{}',
        onload: null,
        onerror: null
      }
      global.FileReader = vi.fn(() => mockFileReader)
      
      wrapper.vm.selectedFiles = [testFile]
      
      const processPromise = wrapper.vm.processFiles()
      mockFileReader.onload()
      await processPromise
      
      expect(wrapper.vm.instanceErrors).toContain('Required property missing')
      expect(mockShowSnackbar).toHaveBeenCalledWith(
        'Instance schema validation failed',
        'error'
      )
    })

    test('handles schema validation exception', async () => {
      mockInstance.checkSchema.mockRejectedValue(new Error('Validation failed'))
      
      const testFile = new File(['{}'], 'test.json', { type: 'application/json' })
      
      const mockFileReader = {
        readAsText: vi.fn(),
        result: '{}',
        onload: null,
        onerror: null
      }
      global.FileReader = vi.fn(() => mockFileReader)
      
      wrapper.vm.selectedFiles = [testFile]
      
      const processPromise = wrapper.vm.processFiles()
      mockFileReader.onload()
      await processPromise
      
      expect(wrapper.vm.instanceErrors).toContain('Validation failed')
      expect(mockShowSnackbar).toHaveBeenCalledWith(
        'Instance schema validation failed',
        'error'
      )
    })
  })

  describe('Special File Processing', () => {
    beforeEach(() => {
      wrapper = createWrapper()
    })

    test('handles special file processing when needed', async () => {
      const specialInstance = { data: { special: true }, checkSchema: vi.fn().mockResolvedValue([]) }
      mockUseFileProcessors.needsSpecialProcessing.mockReturnValue(true)
      mockUseFileProcessors.processFileByPrefix.mockResolvedValue(specialInstance)
      
      const testFile = new File(['special content'], 'special_prefix_test.json', { type: 'application/json' })
      
      const mockFileReader = {
        readAsText: vi.fn(),
        result: 'special content',
        onload: null,
        onerror: null
      }
      global.FileReader = vi.fn(() => mockFileReader)
      
      wrapper.vm.selectedFiles = [testFile]
      
      const processPromise = wrapper.vm.processFiles()
      mockFileReader.onload()
      await processPromise
      
      expect(mockUseFileProcessors.processFileByPrefix).toHaveBeenCalledWith(
        testFile,
        'special content',
        'json',
        mockGeneralStore.getSchemaConfig
      )
    })

    test('handles special file processing errors', async () => {
      mockUseFileProcessors.needsSpecialProcessing.mockReturnValue(true)
      mockUseFileProcessors.processFileByPrefix.mockRejectedValue(new Error('Special processing failed'))
      
      const testFile = new File(['special content'], 'special_prefix_test.json', { type: 'application/json' })
      
      const mockFileReader = {
        readAsText: vi.fn(),
        result: 'special content',
        onload: null,
        onerror: null
      }
      global.FileReader = vi.fn(() => mockFileReader)
      
      wrapper.vm.selectedFiles = [testFile]
      
      const processPromise = wrapper.vm.processFiles()
      mockFileReader.onload()
      await processPromise
      
      expect(wrapper.vm.instanceErrors).toContain('Special processing failed')
      expect(mockShowSnackbar).toHaveBeenCalledWith(
        expect.stringContaining('Special processing failed'),
        'error'
      )
    })
  })

  describe('Instance Merging', () => {
    beforeEach(() => {
      wrapper = createWrapper()
    })

    test('merges multiple instances correctly', async () => {
      const instance1 = { data: { variables: { x: 1 }, constraints: { c1: 'x <= 10' } } }
      const instance2 = { data: { variables: { y: 2 }, constraints: { c2: 'y >= 5' } } }
      
      wrapper.vm.processedInstances = [instance1, instance2]
      
      const mergedInstance = await wrapper.vm.mergeInstances()
      
      // The merging creates a new Instance with merged data
      expect(mergedInstance).toEqual(mockInstance)
      expect(mockInstanceClass).toHaveBeenCalledWith(
        null,
        expect.objectContaining({
          variables: { x: 1, y: 2 },
          constraints: { c1: 'x <= 10', c2: 'y >= 5' }
        }),
        expect.any(String),
        expect.any(String),
        expect.any(String)
      )
    })

    test('handles array merging correctly', async () => {
      const instance1 = { data: { items: [1, 2] } }
      const instance2 = { data: { items: [3, 4] } }
      
      wrapper.vm.processedInstances = [instance1, instance2]
      
      const mergedInstance = await wrapper.vm.mergeInstances()
      
      // The merging creates a new Instance with merged array data
      expect(mergedInstance).toEqual(mockInstance)
      expect(mockInstanceClass).toHaveBeenCalledWith(
        null,
        expect.objectContaining({
          items: [1, 2, 3, 4]
        }),
        expect.any(String),
        expect.any(String),
        expect.any(String)
      )
    })

    test('handles single instance without merging', async () => {
      const testFile = new File(['{"variables": {"x": 1}}'], 'test.json', { type: 'application/json' })
      
      const mockFileReader = {
        readAsText: vi.fn(),
        result: '{"variables": {"x": 1}}',
        onload: null,
        onerror: null
      }
      global.FileReader = vi.fn(() => mockFileReader)
      
      wrapper.vm.selectedFiles = [testFile]
      
      const processPromise = wrapper.vm.processFiles()
      mockFileReader.onload()
      await processPromise
      
      // Should not call mergeInstances for single file
      expect(wrapper.vm.processedInstances).toHaveLength(1)
      expect(wrapper.emitted('instanceSelected')).toBeTruthy()
    })

    test('handles merging errors', async () => {
      // Simulate error by making Instance constructor throw
      mockInstanceClass.mockImplementationOnce(() => {
        throw new Error('Instance creation failed')
      })
      
      const instance1 = { data: { variables: {} } }
      const instance2 = { data: { constraints: {} } }
      
      wrapper.vm.processedInstances = [instance1, instance2]
      
      await expect(wrapper.vm.mergeInstances()).rejects.toThrow('Instance creation failed')
    })
  })

  describe('Props and Watchers', () => {
    test('initializes with fileSelected prop', () => {
      const testFile = new File(['test'], 'test.json', { type: 'application/json' })
      wrapper = createWrapper({ fileSelected: testFile })
      
      expect(wrapper.vm.selectedFiles).toEqual([testFile])
    })

    test('watches existingInstanceErrors prop', async () => {
      wrapper = createWrapper({ existingInstanceErrors: 'Initial error' })
      
      expect(wrapper.vm.instanceErrors).toBe('Initial error')
      
      await wrapper.setProps({ existingInstanceErrors: 'Updated error' })
      
      expect(wrapper.vm.instanceErrors).toBe('Updated error')
    })

    test('accepts all required props', () => {
      const props = {
        instance: mockInstance,
        fileSelected: new File(['test'], 'test.json'),
        existingInstanceErrors: 'Test error',
        newExecution: { name: 'Test Execution' }
      }
      
      wrapper = createWrapper(props)
      
      expect(wrapper.props()).toEqual(expect.objectContaining(props))
    })
  })

  describe('Event Emission', () => {
    beforeEach(() => {
      wrapper = createWrapper()
    })

    test('emits update:existingInstanceErrors when errors change', async () => {
      await wrapper.vm.onFileSelected([])
      
      expect(wrapper.emitted('update:existingInstanceErrors')).toBeTruthy()
      expect(wrapper.emitted('update:existingInstanceErrors')[0]).toEqual([null])
    })

    test('emits instanceSelected when processing succeeds', async () => {
      const testFile = new File(['{}'], 'test.json', { type: 'application/json' })
      
      const mockFileReader = {
        readAsText: vi.fn(),
        result: '{}',
        onload: null,
        onerror: null
      }
      global.FileReader = vi.fn(() => mockFileReader)
      
      wrapper.vm.selectedFiles = [testFile]
      
      const processPromise = wrapper.vm.processFiles()
      mockFileReader.onload()
      await processPromise
      
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
      const testFile = new File(['invalid json'], 'test.json', { type: 'application/json' })
      
      const mockFileReader = {
        readAsText: vi.fn(),
        result: 'invalid json',
        onload: null,
        onerror: null
      }
      global.FileReader = vi.fn(() => mockFileReader)
      
      wrapper.vm.selectedFiles = [testFile]
      
      const processPromise = wrapper.vm.processFiles()
      mockFileReader.onload()
      await processPromise
      
      expect(wrapper.vm.instanceErrors).toContain('Unexpected error occurred')
      expect(mockShowSnackbar).toHaveBeenCalledWith(
        expect.stringContaining('Unexpected error occurred'),
        'error'
      )
    })

    test('ensures loading state is reset on error', async () => {
      const testFile = new File(['invalid'], 'test.json', { type: 'application/json' })
      
      const mockFileReader = {
        readAsText: vi.fn(),
        result: 'invalid json',
        onload: null,
        onerror: null
      }
      global.FileReader = vi.fn(() => mockFileReader)
      
      wrapper.vm.selectedFiles = [testFile]
      
      const processPromise = wrapper.vm.processFiles()
      mockFileReader.onload()
      await processPromise
      
      expect(wrapper.vm.isCheckingSchema).toBe(false)
    })
  })

  describe('Button Interaction', () => {
    beforeEach(() => {
      wrapper = createWrapper()
    })

    test('verifies button has correct click handler', async () => {
      const testFile = new File(['{}'], 'test.json', { type: 'application/json' })
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
      wrapper.vm.isCheckingSchema = true
      await nextTick()
      
      const button = wrapper.find('.load-instance-btn')
      expect(button.attributes('disabled')).toBe('')
    })
  })

  describe('Integration Tests', () => {
    test('complete workflow: file selection to successful processing', async () => {
      const testFile = new File(['{"variables": {"x": 1}}'], 'complete_test.json', { type: 'application/json' })
      
      const mockFileReader = {
        readAsText: vi.fn(),
        result: '{"variables": {"x": 1}}',
        onload: null,
        onerror: null
      }
      global.FileReader = vi.fn(() => mockFileReader)
      
      wrapper = createWrapper()
      
      // 1. Select file
      await wrapper.vm.onFileSelected([testFile])
      expect(wrapper.vm.selectedFiles).toEqual([testFile])
      
      // 2. Process file
      const processPromise = wrapper.vm.processFiles()
      expect(wrapper.vm.isCheckingSchema).toBe(true)
      
      // 3. Complete processing
      mockFileReader.onload()
      await processPromise
      
      // 4. Verify results
      expect(wrapper.vm.isCheckingSchema).toBe(false)
      expect(wrapper.emitted('instanceSelected')).toBeTruthy()
      expect(mockShowSnackbar).toHaveBeenCalledWith('Instances loaded successfully')
    })
  })
})
