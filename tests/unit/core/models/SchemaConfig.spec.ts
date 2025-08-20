import { describe, test, expect, beforeEach } from 'vitest'
import { SchemaConfig } from '@/models/SchemaConfig'

describe('SchemaConfig', () => {
  describe('constructor', () => {
    test('should create a schema config with all properties', () => {
      const config = {
        parameters: {
          timeLimit: 300,
          solver: 'CBC'
        }
      }
      const instanceSchema = {
        type: 'object',
        properties: {
          tables: { type: 'object' }
        }
      }
      const instanceChecksSchema = {
        checks: {
          validation1: { type: 'validation' }
        }
      }
      const solutionSchema = {
        type: 'object',
        properties: {
          results: { type: 'array' }
        }
      }
      const solutionChecksSchema = {
        checks: {
          feasibility: { type: 'validation' }
        }
      }
      const name = 'test-schema'

      const schemaConfig = new SchemaConfig(
        config,
        instanceSchema,
        instanceChecksSchema,
        solutionSchema,
        solutionChecksSchema,
        name
      )

      expect(schemaConfig.config).toBe(config)
      expect(schemaConfig.instanceSchema).toBe(instanceSchema)
      expect(schemaConfig.instanceChecksSchema).toBe(instanceChecksSchema)
      expect(schemaConfig.solutionSchema).toBe(solutionSchema)
      expect(schemaConfig.solutionChecksSchema).toBe(solutionChecksSchema)
      expect(schemaConfig.name).toBe(name)
    })

    test('should create a schema config with null values', () => {
      const schemaConfig = new SchemaConfig(
        null,
        null,
        null,
        null,
        null,
        'null-schema'
      )

      expect(schemaConfig.config).toBeNull()
      expect(schemaConfig.instanceSchema).toBeNull()
      expect(schemaConfig.instanceChecksSchema).toBeNull()
      expect(schemaConfig.solutionSchema).toBeNull()
      expect(schemaConfig.solutionChecksSchema).toBeNull()
      expect(schemaConfig.name).toBe('null-schema')
    })

    test('should create a schema config with undefined values', () => {
      const schemaConfig = new SchemaConfig(
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        'undefined-schema'
      )

      expect(schemaConfig.config).toBeUndefined()
      expect(schemaConfig.instanceSchema).toBeUndefined()
      expect(schemaConfig.instanceChecksSchema).toBeUndefined()
      expect(schemaConfig.solutionSchema).toBeUndefined()
      expect(schemaConfig.solutionChecksSchema).toBeUndefined()
      expect(schemaConfig.name).toBe('undefined-schema')
    })

    test('should create a schema config with empty objects', () => {
      const schemaConfig = new SchemaConfig(
        {},
        {},
        {},
        {},
        {},
        'empty-schema'
      )

      expect(schemaConfig.config).toEqual({})
      expect(schemaConfig.instanceSchema).toEqual({})
      expect(schemaConfig.instanceChecksSchema).toEqual({})
      expect(schemaConfig.solutionSchema).toEqual({})
      expect(schemaConfig.solutionChecksSchema).toEqual({})
      expect(schemaConfig.name).toBe('empty-schema')
    })

    test('should handle complex nested schemas', () => {
      const complexConfig = {
        parameters: {
          timeLimit: 3600,
          solver: 'GUROBI',
          options: {
            presolve: true,
            cuts: 'auto',
            heuristics: {
              enabled: true,
              frequency: 10
            }
          }
        },
        metadata: {
          version: '1.0',
          created: '2023-01-01'
        }
      }

      const complexInstanceSchema = {
        type: 'object',
        properties: {
          tables: {
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
                  },
                  required: ['id', 'capacity']
                }
              },
              demands: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    quantity: { type: 'number' }
                  }
                }
              }
            }
          }
        }
      }

      const schemaConfig = new SchemaConfig(
        complexConfig,
        complexInstanceSchema,
        {},
        {},
        {},
        'complex-optimization-schema'
      )

      expect(schemaConfig.config.parameters.options.heuristics.frequency).toBe(10)
      expect(schemaConfig.instanceSchema.properties.tables.properties.resources.items.properties.id.type).toBe('string')
      expect(schemaConfig.name).toBe('complex-optimization-schema')
    })

    test('should handle arrays as schema values', () => {
      const arrayConfig = ['option1', 'option2', 'option3']
      const arraySchema = [
        { type: 'string' },
        { type: 'number' },
        { type: 'boolean' }
      ]

      const schemaConfig = new SchemaConfig(
        arrayConfig,
        arraySchema,
        [],
        null,
        undefined,
        'array-schema'
      )

      expect(Array.isArray(schemaConfig.config)).toBe(true)
      expect(schemaConfig.config).toHaveLength(3)
      expect(schemaConfig.instanceSchema[0].type).toBe('string')
    })

    test('should handle primitive values', () => {
      const schemaConfig = new SchemaConfig(
        'simple-config',
        42,
        true,
        3.14,
        false,
        'primitive-schema'
      )

      expect(schemaConfig.config).toBe('simple-config')
      expect(schemaConfig.instanceSchema).toBe(42)
      expect(schemaConfig.instanceChecksSchema).toBe(true)
      expect(schemaConfig.solutionSchema).toBe(3.14)
      expect(schemaConfig.solutionChecksSchema).toBe(false)
      expect(schemaConfig.name).toBe('primitive-schema')
    })

    test('should handle special string values for name', () => {
      const specialNames = [
        '',
        ' ',
        'schema-with-dashes',
        'schema_with_underscores',
        'SchemaWithCamelCase',
        'schema.with.dots',
        'schema/with/slashes',
        'schema with spaces',
        'schema@#$%^&*()',
        'schema-123-numbers',
        'ライブラリスキーマ', // Japanese
        'схема-конфиг'      // Cyrillic
      ]

      specialNames.forEach(name => {
        const schemaConfig = new SchemaConfig({}, {}, {}, {}, {}, name)
        expect(schemaConfig.name).toBe(name)
      })
    })

    test('should handle large schema objects', () => {
      const largeConfig = {}
      const largeSchema = { properties: {} }

      // Create large objects
      for (let i = 0; i < 1000; i++) {
        largeConfig[`param${i}`] = `value${i}`
        largeSchema.properties[`field${i}`] = { type: 'string' }
      }

      const schemaConfig = new SchemaConfig(
        largeConfig,
        largeSchema,
        {},
        {},
        {},
        'large-schema'
      )

      expect(Object.keys(schemaConfig.config)).toHaveLength(1000)
      expect(Object.keys(schemaConfig.instanceSchema.properties)).toHaveLength(1000)
      expect(schemaConfig.config.param999).toBe('value999')
      expect(schemaConfig.instanceSchema.properties.field999.type).toBe('string')
    })
  })

  describe('property access and modification', () => {
    let schemaConfig: SchemaConfig

    beforeEach(() => {
      schemaConfig = new SchemaConfig(
        { solver: 'CBC' },
        { type: 'object' },
        { validation: true },
        { type: 'array' },
        { checks: [] },
        'test-schema'
      )
    })

    test('should allow property access', () => {
      expect(schemaConfig.config.solver).toBe('CBC')
      expect(schemaConfig.instanceSchema.type).toBe('object')
      expect(schemaConfig.instanceChecksSchema.validation).toBe(true)
      expect(schemaConfig.solutionSchema.type).toBe('array')
      expect(Array.isArray(schemaConfig.solutionChecksSchema.checks)).toBe(true)
      expect(schemaConfig.name).toBe('test-schema')
    })

    test('should allow property modification', () => {
      schemaConfig.config = { solver: 'GUROBI' }
      schemaConfig.name = 'updated-schema'

      expect(schemaConfig.config.solver).toBe('GUROBI')
      expect(schemaConfig.name).toBe('updated-schema')
    })

    test('should allow deep property modification', () => {
      schemaConfig.config.solver = 'CPLEX'
      schemaConfig.instanceSchema.additionalProperties = false

      expect(schemaConfig.config.solver).toBe('CPLEX')
      expect(schemaConfig.instanceSchema.additionalProperties).toBe(false)
    })

    test('should enumerate properties', () => {
      const keys = Object.keys(schemaConfig)
      expect(keys).toContain('config')
      expect(keys).toContain('instanceSchema')
      expect(keys).toContain('instanceChecksSchema')
      expect(keys).toContain('solutionSchema')
      expect(keys).toContain('solutionChecksSchema')
      expect(keys).toContain('name')
    })

    test('should serialize to JSON correctly', () => {
      const json = JSON.stringify(schemaConfig)
      const parsed = JSON.parse(json)

      expect(parsed.config.solver).toBe('CBC')
      expect(parsed.instanceSchema.type).toBe('object')
      expect(parsed.name).toBe('test-schema')
    })

    test('should handle circular references in schemas', () => {
      // Create a circular reference
      const circularSchema: any = { type: 'object' }
      circularSchema.self = circularSchema

      const schemaConfig = new SchemaConfig(
        {},
        circularSchema,
        {},
        {},
        {},
        'circular-schema'
      )

      expect(schemaConfig.instanceSchema.self).toBe(circularSchema)
      expect(schemaConfig.instanceSchema.self.self).toBe(circularSchema)
    })
  })

  describe('edge cases', () => {
    test('should handle schema config with functions', () => {
      const configWithFunction = {
        validate: () => true,
        transform: (data: any) => data
      }

      const schemaConfig = new SchemaConfig(
        configWithFunction,
        {},
        {},
        {},
        {},
        'function-schema'
      )

      expect(typeof schemaConfig.config.validate).toBe('function')
      expect(schemaConfig.config.validate()).toBe(true)
    })

    test('should handle schema config with dates', () => {
      const dateConfig = {
        created: new Date('2023-01-01'),
        modified: new Date('2023-12-31')
      }

      const schemaConfig = new SchemaConfig(
        dateConfig,
        {},
        {},
        {},
        {},
        'date-schema'
      )

      expect(schemaConfig.config.created instanceof Date).toBe(true)
      expect(schemaConfig.config.created.getFullYear()).toBe(2023)
    })

    test('should handle schema config with symbols', () => {
      const symbol = Symbol('test')
      const configWithSymbol = {
        [symbol]: 'symbol-value',
        regular: 'regular-value'
      }

      const schemaConfig = new SchemaConfig(
        configWithSymbol,
        {},
        {},
        {},
        {},
        'symbol-schema'
      )

      expect(schemaConfig.config[symbol]).toBe('symbol-value')
      expect(schemaConfig.config.regular).toBe('regular-value')
    })
  })
})
