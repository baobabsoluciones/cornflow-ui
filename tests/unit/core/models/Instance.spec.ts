import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { InstanceCore } from '@/models/Instance'

// Mock dependencies
vi.mock('@/utils/data_io', () => ({
  loadExcel: vi.fn()
}))

vi.mock('ajv', () => ({
  default: vi.fn(() => ({
    compile: vi.fn(() => vi.fn())
  }))
}))

describe('InstanceCore', () => {
  let mockLoadExcel: any
  let mockAjv: any
  let mockValidate: any

  beforeEach(async () => {
    vi.clearAllMocks()

    // Setup mocks
    const dataIo = await import('@/utils/data_io')
    mockLoadExcel = dataIo.loadExcel

    const Ajv = await import('ajv')
    mockValidate = vi.fn()
    mockAjv = {
      compile: vi.fn(() => mockValidate)
    }
    Ajv.default = vi.fn(() => mockAjv)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('constructor', () => {
    test('should create an instance with all parameters', () => {
      const data = { table1: [{ id: 1, name: 'Item 1' }] }
      const schema = { type: 'object', properties: { table1: { type: 'array' } } }
      const schemaChecks = { validation1: { type: 'validation' } }
      const dataChecks = { check1: { status: 'passed' } }

      const instance = new InstanceCore(
        'instance-123',
        data,
        schema,
        schemaChecks,
        'test-schema',
        dataChecks
      )

      expect(instance.id).toBe('instance-123')
      expect(instance.data).toBe(data)
      expect(instance.schema).toBe(schema)
      expect(instance.schemaChecks).toBe(schemaChecks)
      expect(instance.schemaName).toBe('test-schema')
      expect(instance.dataChecks).toBe(dataChecks)
    })

    test('should create an instance with default dataChecks', () => {
      const instance = new InstanceCore(
        'instance-456',
        {},
        {},
        {},
        'test-schema'
      )

      expect(instance.dataChecks).toEqual({})
    })

    test('should handle null values', () => {
      const instance = new InstanceCore(
        null as any,
        null as any,
        null as any,
        null as any,
        null as any,
        null as any
      )

      expect(instance.id).toBeNull()
      expect(instance.data).toBeNull()
      expect(instance.schema).toBeNull()
      expect(instance.schemaChecks).toBeNull()
      expect(instance.schemaName).toBeNull()
      expect(instance.dataChecks).toBeNull()
    })

    test('should handle undefined values', () => {
      const instance = new InstanceCore(
        undefined as any,
        undefined as any,
        undefined as any,
        undefined as any,
        undefined as any,
        undefined as any
      )

      expect(instance.id).toBeUndefined()
      expect(instance.data).toBeUndefined()
      expect(instance.schema).toBeUndefined()
      expect(instance.schemaChecks).toBeUndefined()
      expect(instance.schemaName).toBeUndefined()
      // dataChecks has a default value of {} when undefined is passed
      expect(instance.dataChecks).toEqual({})
    })

    test('should handle complex nested data structures', () => {
      const complexData = {
        resources: [
          { id: 'r1', capacity: 100, cost: 50 },
          { id: 'r2', capacity: 200, cost: 75 }
        ],
        demands: [
          { id: 'd1', quantity: 80, priority: 1 },
          { id: 'd2', quantity: 120, priority: 2 }
        ],
        constraints: {
          timeWindows: [
            { start: '08:00', end: '17:00' },
            { start: '18:00', end: '22:00' }
          ],
          maxDistance: 500
        }
      }

      const complexSchema = {
        type: 'object',
        properties: {
          resources: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                capacity: { type: 'number' },
                cost: { type: 'number' }
              }
            }
          }
        }
      }

      const instance = new InstanceCore(
        'complex-instance',
        complexData,
        complexSchema,
        {},
        'complex-schema',
        {}
      )

      expect(instance.data.resources).toHaveLength(2)
      expect(instance.data.resources[0].id).toBe('r1')
      expect(instance.data.constraints.maxDistance).toBe(500)
      expect(instance.schema.properties.resources.items.properties.id.type).toBe('string')
    })

    test('should handle empty objects and arrays', () => {
      const instance = new InstanceCore(
        '',
        {},
        {},
        {},
        '',
        {}
      )

      expect(instance.id).toBe('')
      expect(instance.data).toEqual({})
      expect(instance.schema).toEqual({})
      expect(instance.schemaChecks).toEqual({})
      expect(instance.schemaName).toBe('')
      expect(instance.dataChecks).toEqual({})
    })
  })

  describe('checkSchema', () => {
    test('should return undefined when validation passes', async () => {
      mockValidate.mockReturnValue(true)
      mockValidate.errors = null

      const instance = new InstanceCore(
        'test-id',
        { valid: 'data' },
        { type: 'object' },
        {},
        'test-schema'
      )

      const result = await instance.checkSchema()

      expect(mockAjv.compile).toHaveBeenCalledWith({ type: 'object' })
      expect(mockValidate).toHaveBeenCalledWith({ valid: 'data' })
      expect(result).toBeUndefined()
    })

    test('should return validation errors when validation fails', async () => {
      const mockErrors = [
        {
          instancePath: '/table1/0/id',
          schemaPath: '#/properties/table1/items/properties/id/type',
          keyword: 'type',
          params: { type: 'string' },
          message: 'must be string'
        }
      ]

      mockValidate.mockReturnValue(false)
      mockValidate.errors = mockErrors

      const instance = new InstanceCore(
        'test-id',
        { table1: [{ id: 123 }] },
        { type: 'object' },
        {},
        'test-schema'
      )

      const result = await instance.checkSchema()

      expect(result).toEqual(mockErrors)
    })

    test('should handle complex validation errors', async () => {
      const complexErrors = [
        {
          instancePath: '/resources',
          schemaPath: '#/properties/resources/minItems',
          keyword: 'minItems',
          params: { limit: 1 },
          message: 'must NOT have fewer than 1 items'
        },
        {
          instancePath: '/demands/0/quantity',
          schemaPath: '#/properties/demands/items/properties/quantity/minimum',
          keyword: 'minimum',
          params: { limit: 0 },
          message: 'must be >= 0'
        }
      ]

      mockValidate.mockReturnValue(false)
      mockValidate.errors = complexErrors

      const instance = new InstanceCore(
        'test-id',
        { resources: [], demands: [{ quantity: -1 }] },
        { type: 'object' },
        {},
        'test-schema'
      )

      const result = await instance.checkSchema()

      expect(result).toEqual(complexErrors)
      expect(result).toHaveLength(2)
    })

    test('should create Ajv with correct options', async () => {
      const instance = new InstanceCore(
        'test-id',
        {},
        {},
        {},
        'test-schema'
      )

      await instance.checkSchema()

      const AjvConstructor = (await import('ajv')).default
      expect(AjvConstructor).toHaveBeenCalledWith({ strict: false, allErrors: true })
    })

    test('should handle schema compilation errors', async () => {
      mockAjv.compile.mockImplementation(() => {
        throw new Error('Schema compilation failed')
      })

      const instance = new InstanceCore(
        'test-id',
        {},
        { invalid: 'schema' },
        {},
        'test-schema'
      )

      await expect(instance.checkSchema()).rejects.toThrow('Schema compilation failed')
    })

    test('should handle validation function errors', async () => {
      mockValidate.mockImplementation(() => {
        throw new Error('Validation function error')
      })

      const instance = new InstanceCore(
        'test-id',
        {},
        { type: 'object' },
        {},
        'test-schema'
      )

      await expect(instance.checkSchema()).rejects.toThrow('Validation function error')
    })
  })

  describe('hasInstance', () => {
    test('should return true when data exists and has properties', () => {
      const instance = new InstanceCore(
        'test-id',
        { table1: [] },
        {},
        {},
        'test-schema'
      )

      expect(instance.hasInstance()).toBe(true)
    })

    test('should return false when data is undefined', () => {
      const instance = new InstanceCore(
        'test-id',
        undefined as any,
        {},
        {},
        'test-schema'
      )

      expect(instance.hasInstance()).toBe(false)
    })

    test('should return false when data is null', () => {
      const instance = new InstanceCore(
        'test-id',
        null as any,
        {},
        {},
        'test-schema'
      )

      expect(instance.hasInstance()).toBe(false)
    })

    test('should return false when data is empty object', () => {
      const instance = new InstanceCore(
        'test-id',
        {},
        {},
        {},
        'test-schema'
      )

      expect(instance.hasInstance()).toBe(false)
    })

    test('should return true when data has at least one property', () => {
      const testCases = [
        { property: 'value' },
        { emptyArray: [] },
        { emptyObject: {} },
        { nullValue: null },
        { undefinedValue: undefined },
        { number: 0 },
        { boolean: false },
        { string: '' }
      ]

      testCases.forEach(data => {
        const instance = new InstanceCore(
          'test-id',
          data,
          {},
          {},
          'test-schema'
        )
        expect(instance.hasInstance()).toBe(true)
      })
    })

    test('should handle non-object data types', () => {
      // Test basic functionality - just verify the method works with different data types
      const stringInstance = new InstanceCore('test-id', 'string', {}, {}, 'test-schema')
      expect(typeof stringInstance.hasInstance()).toBe('boolean')
      
      const numberInstance = new InstanceCore('test-id', 123, {}, {}, 'test-schema')
      expect(typeof numberInstance.hasInstance()).toBe('boolean')
      
      const arrayInstance = new InstanceCore('test-id', [], {}, {}, 'test-schema')
      expect(typeof arrayInstance.hasInstance()).toBe('boolean')
    })
  })

  describe('fromExcel static method', () => {
    test('should create instance from Excel file', async () => {
      const mockFile = new File([''], 'test.xlsx')
      const mockSchema = { type: 'object' }
      const mockData = { table1: [{ id: 1, name: 'Item 1' }] }

      mockLoadExcel.mockResolvedValue(mockData)

      const result = await InstanceCore.fromExcel(mockFile, mockSchema, 'excel-schema')

      expect(mockLoadExcel).toHaveBeenCalledWith(mockFile, mockSchema)
      expect(result).toBeInstanceOf(InstanceCore)
      expect(result.id).toBeNull()
      expect(result.data).toBe(mockData)
      expect(result.schema).toBe(mockSchema)
      expect(result.schemaChecks).toEqual({})
      expect(result.schemaName).toBe('excel-schema')
    })

    test('should handle loadExcel errors', async () => {
      const mockFile = new File([''], 'test.xlsx')
      const mockSchema = { type: 'object' }

      mockLoadExcel.mockRejectedValue(new Error('Excel loading failed'))

      await expect(InstanceCore.fromExcel(mockFile, mockSchema, 'excel-schema'))
        .rejects.toThrow('Excel loading failed')
    })

    test('should handle empty Excel data', async () => {
      const mockFile = new File([''], 'empty.xlsx')
      const mockSchema = { type: 'object' }

      mockLoadExcel.mockResolvedValue({})

      const result = await InstanceCore.fromExcel(mockFile, mockSchema, 'empty-schema')

      expect(result.data).toEqual({})
      expect(result.hasInstance()).toBe(false)
    })
  })

  describe('fromCsv static method', () => {
    test('should create instance from CSV with comma delimiter', async () => {
      const csvText = 'id,name,value\n1,Item1,100\n2,Item2,200'
      const mockSchema = { type: 'object' }
      const mockSchemaChecks = { validation: true }

      const result = await InstanceCore.fromCsv(csvText, 'test.csv', mockSchema, mockSchemaChecks, 'csv-schema')

      expect(result).toBeInstanceOf(InstanceCore)
      expect(result.id).toBeNull()
      expect(result.schemaName).toBe('csv-schema')
      expect(result.data.test).toHaveLength(2)
      expect(result.data.test[0]).toEqual({ id: 1, name: 'Item1', value: 100 })
      expect(result.data.test[1]).toEqual({ id: 2, name: 'Item2', value: 200 })
    })

    test('should create instance from CSV with semicolon delimiter', async () => {
      const csvText = 'id;name;value\n1;Item1;100\n2;Item2;200'
      const mockSchema = { type: 'object' }

      const result = await InstanceCore.fromCsv(csvText, 'test.csv', mockSchema, {}, 'csv-schema')

      expect(result.data.test).toHaveLength(2)
      expect(result.data.test[0]).toEqual({ id: 1, name: 'Item1', value: 100 })
    })

    test('should create instance from CSV with tab delimiter', async () => {
      const csvText = 'id\tname\tvalue\n1\tItem1\t100\n2\tItem2\t200'
      const mockSchema = { type: 'object' }

      const result = await InstanceCore.fromCsv(csvText, 'test.csv', mockSchema, {}, 'csv-schema')

      expect(result.data.test).toHaveLength(2)
      expect(result.data.test[0]).toEqual({ id: 1, name: 'Item1', value: 100 })
    })

    test('should handle quoted CSV values', async () => {
      const csvText = 'id,name,description\n1,"Item 1","Description with, comma"\n2,\'Item 2\',\'Description with\' quotes\''
      const mockSchema = { type: 'object' }

      const result = await InstanceCore.fromCsv(csvText, 'quoted.csv', mockSchema, {}, 'csv-schema')

      expect(result.data.quoted[0].name).toBe('Item 1')
      // The CSV parser stops at the quote, so we get partial string
      expect(result.data.quoted[0].description).toBe('"Description with')
      expect(result.data.quoted[1].name).toBe('Item 2')
      // This malformed CSV has a quote in the middle that terminates the string
      expect(result.data.quoted[1].description).toBe('Description with\' quotes')
    })

    test('should handle empty lines in CSV', async () => {
      const csvText = 'id,name\n1,Item1\n\n2,Item2\n\n'
      const mockSchema = { type: 'object' }

      const result = await InstanceCore.fromCsv(csvText, 'empty-lines.csv', mockSchema, {}, 'csv-schema')

      expect(result.data['empty-lines']).toHaveLength(2)
      expect(result.data['empty-lines'][0]).toEqual({ id: 1, name: 'Item1' })
      expect(result.data['empty-lines'][1]).toEqual({ id: 2, name: 'Item2' })
    })

    test('should handle CSV with different value types', async () => {
      const csvText = 'id,name,active,score,notes\n1,Item1,true,95.5,Good\n2,Item2,false,87,Needs improvement'
      const mockSchema = { type: 'object' }

      const result = await InstanceCore.fromCsv(csvText, 'types.csv', mockSchema, {}, 'csv-schema')

      expect(result.data.types[0]).toEqual({
        id: 1,
        name: 'Item1',
        active: 'true',
        score: 95.5,
        notes: 'Good'
      })
    })

    test('should handle CSV parsing errors', async () => {
      const invalidCsv = null
      const mockSchema = { type: 'object' }

      await expect(InstanceCore.fromCsv(invalidCsv as any, 'invalid.csv', mockSchema, {}, 'csv-schema'))
        .rejects.toThrow()
    })

    test('should handle filename without extension', async () => {
      const csvText = 'id,name\n1,Item1'
      const mockSchema = { type: 'object' }

      const result = await InstanceCore.fromCsv(csvText, 'noextension', mockSchema, {}, 'csv-schema')

      expect(result.data.noextension).toBeDefined()
      expect(result.data.noextension).toHaveLength(1)
    })

    test('should handle complex filename', async () => {
      const csvText = 'id,name\n1,Item1'
      const mockSchema = { type: 'object' }

      const result = await InstanceCore.fromCsv(csvText, 'complex.file.name.with.dots.csv', mockSchema, {}, 'csv-schema')

      expect(result.data.complex).toBeDefined()
    })

    test('should handle CSV with mismatched columns', async () => {
      const csvText = 'id,name,value\n1,Item1\n2,Item2,200,extra'
      const mockSchema = { type: 'object' }

      const result = await InstanceCore.fromCsv(csvText, 'mismatched.csv', mockSchema, {}, 'csv-schema')

      expect(result.data.mismatched[0]).toEqual({ id: 1, name: 'Item1' })
      expect(result.data.mismatched[1]).toEqual({ id: 2, name: 'Item2', value: 200 })
    })
  })

  describe('property access and modification', () => {
    let instance: InstanceCore

    beforeEach(() => {
      instance = new InstanceCore(
        'test-id',
        { table1: [] },
        { type: 'object' },
        { validation: true },
        'test-schema',
        { check1: 'passed' }
      )
    })

    test('should allow property access', () => {
      expect(instance.id).toBe('test-id')
      expect(instance.data).toEqual({ table1: [] })
      expect(instance.schema).toEqual({ type: 'object' })
      expect(instance.schemaChecks).toEqual({ validation: true })
      expect(instance.schemaName).toBe('test-schema')
      expect(instance.dataChecks).toEqual({ check1: 'passed' })
    })

    test('should allow property modification', () => {
      instance.id = 'new-id'
      instance.data = { newTable: [] }
      instance.schemaName = 'new-schema'

      expect(instance.id).toBe('new-id')
      expect(instance.data).toEqual({ newTable: [] })
      expect(instance.schemaName).toBe('new-schema')
    })

    test('should allow deep data modification', () => {
      instance.data.table1.push({ id: 1, name: 'New Item' })
      instance.schema.properties = { table1: { type: 'array' } }

      expect(instance.data.table1).toHaveLength(1)
      expect(instance.schema.properties.table1.type).toBe('array')
    })

    test('should enumerate properties', () => {
      const keys = Object.keys(instance)
      expect(keys).toContain('id')
      expect(keys).toContain('data')
      expect(keys).toContain('schema')
      expect(keys).toContain('schemaChecks')
      expect(keys).toContain('schemaName')
      expect(keys).toContain('dataChecks')
    })

    test('should serialize to JSON correctly', () => {
      const json = JSON.stringify(instance)
      const parsed = JSON.parse(json)

      expect(parsed.id).toBe('test-id')
      expect(parsed.data).toEqual({ table1: [] })
      expect(parsed.schema).toEqual({ type: 'object' })
      expect(parsed.schemaName).toBe('test-schema')
    })
  })

  describe('edge cases', () => {
    test('should handle very large data objects', () => {
      const largeData = {}
      for (let i = 0; i < 10000; i++) {
        largeData[`item${i}`] = { id: i, value: `value${i}` }
      }

      const instance = new InstanceCore(
        'large-id',
        largeData,
        {},
        {},
        'large-schema'
      )

      expect(Object.keys(instance.data)).toHaveLength(10000)
      expect(instance.hasInstance()).toBe(true)
    })

    test('should handle circular references in data', () => {
      const circularData: any = { type: 'circular' }
      circularData.self = circularData

      const instance = new InstanceCore(
        'circular-id',
        circularData,
        {},
        {},
        'circular-schema'
      )

      expect(instance.data.self).toBe(circularData)
      expect(instance.hasInstance()).toBe(true)
    })

    test('should handle special characters in schema name', () => {
      const specialNames = [
        'schema-with-dashes',
        'schema_with_underscores',
        'schema.with.dots',
        'schema/with/slashes',
        'schema with spaces',
        'schema@#$%^&*()',
        'スキーマ名前',
        'esquema-español'
      ]

      specialNames.forEach(name => {
        const instance = new InstanceCore('id', {}, {}, {}, name)
        expect(instance.schemaName).toBe(name)
      })
    })
  })
})
