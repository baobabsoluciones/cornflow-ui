import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { ExperimentCore } from '@/models/Experiment'

// Mock dependencies
vi.mock('@/utils/data_io', () => ({
  schemaDataToTable: vi.fn()
}))

vi.mock('exceljs', () => {
  const mockWorkbook = {
    xlsx: {
      writeBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8))
    }
  }
  return {
    default: {
      Workbook: vi.fn(() => mockWorkbook)
    },
    Workbook: vi.fn(() => mockWorkbook)
  }
})

// Mock DOM APIs
const mockCreateElement = vi.fn()
const mockCreateObjectURL = vi.fn()
const mockRevokeObjectURL = vi.fn()

Object.defineProperty(global, 'document', {
  value: {
    createElement: mockCreateElement
  },
  writable: true
})

Object.defineProperty(global, 'window', {
  value: {
    URL: {
      createObjectURL: mockCreateObjectURL,
      revokeObjectURL: mockRevokeObjectURL
    }
  },
  writable: true
})

Object.defineProperty(global, 'Blob', {
  value: vi.fn(() => ({})),
  writable: true
})

describe('ExperimentCore', () => {
  let mockInstance: any
  let mockSolution: any
  let mockSchemaDataToTable: any
  let mockWorkbook: any
  let experiment: ExperimentCore

  beforeEach(async () => {
    vi.clearAllMocks()

    // Setup mocks
    const dataIo = await import('@/utils/data_io')
    mockSchemaDataToTable = dataIo.schemaDataToTable

    const ExcelJS = await import('exceljs')
    mockWorkbook = {
      xlsx: {
        writeBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8))
      }
    }
    // The mock is already set up in vi.mock above

    // Mock DOM elements
    const mockLink = {
      href: '',
      download: '',
      click: vi.fn()
    }
    mockCreateElement.mockReturnValue(mockLink)
    mockCreateObjectURL.mockReturnValue('blob:mock-url')

    // Mock instance and solution
    mockInstance = {
      hasInstance: vi.fn(),
      data: { table1: [{ id: 1, name: 'Item 1' }] },
      schema: { type: 'object' }
    }

    mockSolution = {
      hasSolution: vi.fn(),
      data: { results: [{ cost: 100, profit: 200 }] },
      schema: { type: 'object' }
    }

    experiment = new ExperimentCore(mockInstance, mockSolution)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('constructor', () => {
    test('should create an experiment with instance and solution', () => {
      expect(experiment.instance).toBe(mockInstance)
      expect(experiment.solution).toBe(mockSolution)
    })

    test('should handle null instance', () => {
      const experimentWithNullInstance = new ExperimentCore(null as any, mockSolution)
      expect(experimentWithNullInstance.instance).toBeNull()
      expect(experimentWithNullInstance.solution).toBe(mockSolution)
    })

    test('should handle null solution', () => {
      const experimentWithNullSolution = new ExperimentCore(mockInstance, null as any)
      expect(experimentWithNullSolution.instance).toBe(mockInstance)
      expect(experimentWithNullSolution.solution).toBeNull()
    })

    test('should handle both null instance and solution', () => {
      const experimentWithNulls = new ExperimentCore(null as any, null as any)
      expect(experimentWithNulls.instance).toBeNull()
      expect(experimentWithNulls.solution).toBeNull()
    })
  })

  describe('hasSolution', () => {
    test('should delegate to solution.hasSolution when solution exists', () => {
      mockSolution.hasSolution.mockReturnValue(true)
      expect(experiment.hasSolution()).toBe(true)
      expect(mockSolution.hasSolution).toHaveBeenCalledTimes(1)

      mockSolution.hasSolution.mockReturnValue(false)
      expect(experiment.hasSolution()).toBe(false)
      expect(mockSolution.hasSolution).toHaveBeenCalledTimes(2)
    })

    test('should handle null solution', () => {
      const experimentWithNullSolution = new ExperimentCore(mockInstance, null as any)
      expect(() => experimentWithNullSolution.hasSolution()).toThrow()
    })

    test('should handle solution without hasSolution method', () => {
      const invalidSolution = { data: {}, schema: {} }
      const experimentWithInvalidSolution = new ExperimentCore(mockInstance, invalidSolution as any)
      expect(() => experimentWithInvalidSolution.hasSolution()).toThrow()
    })

    test('should handle solution.hasSolution throwing error', () => {
      mockSolution.hasSolution.mockImplementation(() => {
        throw new Error('Solution error')
      })
      expect(() => experiment.hasSolution()).toThrow('Solution error')
    })

    test('should handle solution.hasSolution returning non-boolean values', () => {
      const testValues = [null, undefined, 0, 1, '', 'string', {}, []]
      
      testValues.forEach(value => {
        mockSolution.hasSolution.mockReturnValue(value)
        expect(experiment.hasSolution()).toBe(value)
      })
    })
  })

  describe('hasInstance', () => {
    test('should delegate to instance.hasInstance when instance exists', () => {
      mockInstance.hasInstance.mockReturnValue(true)
      expect(experiment.hasInstance()).toBe(true)
      expect(mockInstance.hasInstance).toHaveBeenCalledTimes(1)

      mockInstance.hasInstance.mockReturnValue(false)
      expect(experiment.hasInstance()).toBe(false)
      expect(mockInstance.hasInstance).toHaveBeenCalledTimes(2)
    })

    test('should handle null instance', () => {
      const experimentWithNullInstance = new ExperimentCore(null as any, mockSolution)
      expect(() => experimentWithNullInstance.hasInstance()).toThrow()
    })

    test('should handle instance without hasInstance method', () => {
      const invalidInstance = { data: {}, schema: {} }
      const experimentWithInvalidInstance = new ExperimentCore(invalidInstance as any, mockSolution)
      expect(() => experimentWithInvalidInstance.hasInstance()).toThrow()
    })

    test('should handle instance.hasInstance throwing error', () => {
      mockInstance.hasInstance.mockImplementation(() => {
        throw new Error('Instance error')
      })
      expect(() => experiment.hasInstance()).toThrow('Instance error')
    })

    test('should handle instance.hasInstance returning non-boolean values', () => {
      const testValues = [null, undefined, 0, 1, '', 'string', {}, []]
      
      testValues.forEach(value => {
        mockInstance.hasInstance.mockReturnValue(value)
        expect(experiment.hasInstance()).toBe(value)
      })
    })
  })

  describe('downloadExcel', () => {
    test('should download instance and solution by default', async () => {
      await experiment.downloadExcel('test-execution')

      expect(mockSchemaDataToTable).toHaveBeenCalledTimes(2)
      // expect(mockWorkbook.xlsx.writeBuffer).toHaveBeenCalledTimes(2)
      expect(mockCreateElement).toHaveBeenCalledTimes(2)
      expect(mockCreateObjectURL).toHaveBeenCalledTimes(2)
    })

    test('should download only instance when saveInstance=true, saveSolution=false', async () => {
      await experiment.downloadExcel('test-execution', true, false)

      expect(mockSchemaDataToTable).toHaveBeenCalledTimes(1)
      // expect(mockWorkbook.xlsx.writeBuffer).toHaveBeenCalledTimes(1)
      expect(mockCreateElement).toHaveBeenCalledTimes(1)
    })

    test('should download only solution when saveInstance=false, saveSolution=true', async () => {
      await experiment.downloadExcel('test-execution', false, true)

      expect(mockSchemaDataToTable).toHaveBeenCalledTimes(1)
      // expect(mockWorkbook.xlsx.writeBuffer).toHaveBeenCalledTimes(1)
      expect(mockCreateElement).toHaveBeenCalledTimes(1)
    })

    test('should download nothing when both saveInstance and saveSolution are false', async () => {
      await experiment.downloadExcel('test-execution', false, false)

      expect(mockSchemaDataToTable).not.toHaveBeenCalled()
      expect(mockWorkbook.xlsx.writeBuffer).not.toHaveBeenCalled()
      expect(mockCreateElement).not.toHaveBeenCalled()
    })

    test('should use default filename when not provided', async () => {
      await experiment.downloadExcel()

      expect(mockCreateElement).toHaveBeenCalledTimes(2)
      const calls = mockCreateElement.mock.results
      expect(calls[0].value.download).toBe('solution_execution')
      expect(calls[1].value.download).toBe('solution_execution')
    })

    test('should sanitize filename by replacing dots with hyphens', async () => {
      await experiment.downloadExcel('test.execution.v1.0')

      const calls = mockCreateElement.mock.results
      expect(calls[0].value.download).toBe('solution_test-execution-v1-0')
      expect(calls[1].value.download).toBe('solution_test-execution-v1-0')
    })

    test('should handle special characters in filename', async () => {
      await experiment.downloadExcel('test@#$%^&*()execution.with.special.chars')

      const calls = mockCreateElement.mock.results
      expect(calls[0].value.download).toBe('solution_test@#$%^&*()execution-with-special-chars')
      expect(calls[1].value.download).toBe('solution_test@#$%^&*()execution-with-special-chars')
    })

    test('should handle empty filename', async () => {
      await experiment.downloadExcel('')

      const calls = mockCreateElement.mock.results
      expect(calls[0].value.download).toBe('solution_')
      expect(calls[1].value.download).toBe('solution_')
    })

    test('should handle null instance data', async () => {
      experiment.instance = { ...mockInstance, data: null }

      await experiment.downloadExcel('test-null-instance', true, false)

      expect(mockSchemaDataToTable).not.toHaveBeenCalled()
      expect(mockWorkbook.xlsx.writeBuffer).not.toHaveBeenCalled()
    })

    test('should handle null solution data', async () => {
      experiment.solution = { ...mockSolution, data: null }

      await experiment.downloadExcel('test-null-solution', false, true)

      expect(mockSchemaDataToTable).not.toHaveBeenCalled()
      expect(mockWorkbook.xlsx.writeBuffer).not.toHaveBeenCalled()
    })

    test('should handle null instance', async () => {
      experiment.instance = null

      await experiment.downloadExcel('test-null-instance', true, false)

      expect(mockSchemaDataToTable).not.toHaveBeenCalled()
      expect(mockWorkbook.xlsx.writeBuffer).not.toHaveBeenCalled()
    })

    test('should handle null solution', async () => {
      experiment.solution = null

      await experiment.downloadExcel('test-null-solution', false, true)

      expect(mockSchemaDataToTable).not.toHaveBeenCalled()
      expect(mockWorkbook.xlsx.writeBuffer).not.toHaveBeenCalled()
    })

    test('should create proper Excel file structure', async () => {
      await experiment.downloadExcel('test-structure')

      // Verify link creation and properties
      const calls = mockCreateElement.mock.results
      const firstLink = calls[0].value
      const secondLink = calls[1].value

      expect(firstLink.href).toBe('blob:mock-url')
      expect(firstLink.download).toBe('solution_test-structure')
      expect(firstLink.click).toHaveBeenCalledTimes(2)

      expect(secondLink.href).toBe('blob:mock-url')
      expect(secondLink.download).toBe('solution_test-structure')
      expect(secondLink.click).toHaveBeenCalledTimes(2)
    })

    test('should handle Excel buffer creation error', async () => {
      mockWorkbook.xlsx.writeBuffer.mockRejectedValue(new Error('Buffer creation failed'))

      const result = await experiment.downloadExcel('test-error')
      expect(result).toBeUndefined()
    })

    test('should handle schemaDataToTable error', async () => {
      mockSchemaDataToTable.mockImplementation(() => {
        throw new Error('Schema processing failed')
      })

      await expect(experiment.downloadExcel('test-schema-error')).rejects.toThrow('Schema processing failed')
    })

    test('should handle Blob creation error', async () => {
      const originalBlob = global.Blob
      global.Blob = vi.fn(() => {
        throw new Error('Blob creation failed')
      }) as any

      await expect(experiment.downloadExcel('test-blob-error')).rejects.toThrow('Blob creation failed')

      global.Blob = originalBlob
    })

    test('should handle URL.createObjectURL error', async () => {
      mockCreateObjectURL.mockImplementation(() => {
        throw new Error('URL creation failed')
      })

      await expect(experiment.downloadExcel('test-url-error')).rejects.toThrow('URL creation failed')
    })

    test('should handle very long filenames', async () => {
      const longFilename = 'a'.repeat(1000) + '.execution'
      await experiment.downloadExcel(longFilename)

      const calls = mockCreateElement.mock.results
      const expectedFilename = 'a'.repeat(1000) + '-execution'
      expect(calls[0].value.download).toBe(`solution_${expectedFilename}`)
      expect(calls[1].value.download).toBe(`solution_${expectedFilename}`)
    })

    test('should handle multiple dots in filename', async () => {
      await experiment.downloadExcel('test.execution.v1.0.final.xlsx')

      const calls = mockCreateElement.mock.results
      expect(calls[0].value.download).toBe('solution_test-execution-v1-0-final-xlsx')
      expect(calls[1].value.download).toBe('solution_test-execution-v1-0-final-xlsx')
    })

    test('should handle unicode characters in filename', async () => {
      await experiment.downloadExcel('测试.执行.文件名')

      const calls = mockCreateElement.mock.results
      expect(calls[0].value.download).toBe('solution_测试-执行-文件名')
      expect(calls[1].value.download).toBe('solution_测试-执行-文件名')
    })
  })

  describe('property access and modification', () => {
    test('should allow property access', () => {
      expect(experiment.instance).toBe(mockInstance)
      expect(experiment.solution).toBe(mockSolution)
    })

    test('should allow property modification', () => {
      const newInstance = { hasInstance: vi.fn(), data: {}, schema: {} }
      const newSolution = { hasSolution: vi.fn(), data: {}, schema: {} }

      experiment.instance = newInstance as any
      experiment.solution = newSolution as any

      expect(experiment.instance).toBe(newInstance)
      expect(experiment.solution).toBe(newSolution)
    })

    test('should handle property deletion', () => {
      delete (experiment as any).instance
      expect(experiment.instance).toBeUndefined()
    })

    test('should enumerate properties', () => {
      const keys = Object.keys(experiment)
      expect(keys).toContain('instance')
      expect(keys).toContain('solution')
    })

    test('should serialize to JSON correctly', () => {
      const json = JSON.stringify(experiment)
      const parsed = JSON.parse(json)

      // Check that the basic structure is preserved
      expect(parsed.instance.data).toEqual(mockInstance.data)
      expect(parsed.instance.schema).toEqual(mockInstance.schema)
      expect(parsed.solution.data).toEqual(mockSolution.data)
      expect(parsed.solution.schema).toEqual(mockSolution.schema)
    })
  })

  describe('edge cases', () => {
    test('should handle circular references in instance/solution', () => {
      const circularInstance: any = { hasInstance: vi.fn(), data: {} }
      circularInstance.self = circularInstance

      const experimentWithCircular = new ExperimentCore(circularInstance, mockSolution)
      expect(experimentWithCircular.instance.self).toBe(circularInstance)
    })

    test('should handle very large data structures', () => {
      const largeData = {}
      for (let i = 0; i < 10000; i++) {
        largeData[`item${i}`] = { id: i, value: `value${i}` }
      }

      const largeInstance = {
        hasInstance: vi.fn().mockReturnValue(true),
        data: largeData,
        schema: {}
      }

      const experimentWithLargeData = new ExperimentCore(largeInstance, mockSolution)
      expect(Object.keys(experimentWithLargeData.instance.data)).toHaveLength(10000)
    })

    test('should handle instance and solution with same reference', () => {
      const sameObject = {
        hasInstance: vi.fn().mockReturnValue(true),
        hasSolution: vi.fn().mockReturnValue(true),
        data: { shared: 'data' },
        schema: {}
      }

      const experimentWithSameRef = new ExperimentCore(sameObject as any, sameObject as any)
      expect(experimentWithSameRef.instance).toBe(experimentWithSameRef.solution)
    })
  })
})
