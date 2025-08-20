import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import SchemaRepository from '@/repositories/SchemaRepository'

// Mock the API client
vi.mock('@/api/Api', () => ({
  default: {
    get: vi.fn()
  }
}))

// Mock SchemaConfig model
vi.mock('@/models/SchemaConfig', () => ({
  SchemaConfig: vi.fn()
}))

describe('SchemaRepository', () => {
  let repository: SchemaRepository
  let mockClient: any

  beforeEach(async () => {
    // Get mocked modules
    const Api = await import('@/api/Api')
    mockClient = Api.default
    
    // Reset mocks
    vi.clearAllMocks()
    
    repository = new SchemaRepository()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getSchema', () => {
    const mockSchemaData = {
      config: {
        parameters: {
          time_limit: 300,
          solver: 'CBC'
        }
      },
      instance: {
        properties: {
          tables: {
            type: 'object',
            properties: {
              resources: { type: 'array' },
              demands: { type: 'array' }
            }
          }
        }
      },
      instance_checks: {
        checks: {
          resource_availability: {
            type: 'validation',
            description: 'Check resource availability'
          }
        }
      },
      solution: {
        properties: {
          assignments: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                resource_id: { type: 'string' },
                task_id: { type: 'string' }
              }
            }
          }
        }
      },
      solution_checks: {
        checks: {
          assignment_validation: {
            type: 'validation',
            description: 'Validate assignments'
          }
        }
      },
      name: 'test-schema'
    }

    test('should get schema successfully', async () => {
      const mockResponse = {
        status: 200,
        content: mockSchemaData
      }
      mockClient.get.mockResolvedValue(mockResponse)

      const result = await repository.getSchema('test-schema')

      expect(mockClient.get).toHaveBeenCalledWith('/schema/test-schema/')
    })

    test('should throw error when API returns non-200 status', async () => {
      const mockResponse = {
        status: 404,
        content: { error: 'Schema not found' }
      }
      mockClient.get.mockResolvedValue(mockResponse)

      await expect(repository.getSchema('invalid-schema')).rejects.toThrow('Error getting schema')
    })

    test('should handle API call failure', async () => {
      const error = new Error('Network error')
      mockClient.get.mockRejectedValue(error)

      await expect(repository.getSchema('test-schema')).rejects.toThrow('Network error')
    })

    test('should handle empty schema name', async () => {
      const mockResponse = {
        status: 200,
        content: mockSchemaData
      }
      mockClient.get.mockResolvedValue(mockResponse)

      const result = await repository.getSchema('')

      expect(mockClient.get).toHaveBeenCalledWith('/schema//')
    })

    test('should handle schema with minimal data', async () => {
      const minimalSchemaData = {
        config: null,
        instance: null,
        instance_checks: null,
        solution: null,
        solution_checks: null,
        name: 'minimal-schema'
      }
      const mockResponse = {
        status: 200,
        content: minimalSchemaData
      }
      mockClient.get.mockResolvedValue(mockResponse)

      const result = await repository.getSchema('minimal-schema')

      expect(mockClient.get).toHaveBeenCalledWith('/schema/minimal-schema/')
    })

    test('should handle schema with empty objects', async () => {
      const emptySchemaData = {
        config: {},
        instance: {},
        instance_checks: {},
        solution: {},
        solution_checks: {},
        name: 'empty-schema'
      }
      const mockResponse = {
        status: 200,
        content: emptySchemaData
      }
      mockClient.get.mockResolvedValue(mockResponse)

      const result = await repository.getSchema('empty-schema')

      expect(mockClient.get).toHaveBeenCalledWith('/schema/empty-schema/')
    })

    test('should handle 401 unauthorized error', async () => {
      const mockResponse = {
        status: 401,
        content: { error: 'Unauthorized' }
      }
      mockClient.get.mockResolvedValue(mockResponse)

      await expect(repository.getSchema('test-schema')).rejects.toThrow('Error getting schema')
    })

    test('should handle 403 forbidden error', async () => {
      const mockResponse = {
        status: 403,
        content: { error: 'Forbidden' }
      }
      mockClient.get.mockResolvedValue(mockResponse)

      await expect(repository.getSchema('test-schema')).rejects.toThrow('Error getting schema')
    })

    test('should handle 500 server error', async () => {
      const mockResponse = {
        status: 500,
        content: { error: 'Internal server error' }
      }
      mockClient.get.mockResolvedValue(mockResponse)

      await expect(repository.getSchema('test-schema')).rejects.toThrow('Error getting schema')
    })

    test('should handle complex schema with nested structures', async () => {
      const complexSchemaData = {
        config: {
          parameters: {
            time_limit: 3600,
            solver: 'GUROBI',
            mip_gap: 0.01,
            advanced_options: {
              presolve: true,
              cuts: 'auto',
              heuristics: 'on'
            }
          }
        },
        instance: {
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
                    }
                  }
                }
              }
            }
          }
        },
        instance_checks: {
          checks: {
            resource_capacity: {
              type: 'validation',
              description: 'Check if resource capacity is positive',
              severity: 'error'
            }
          }
        },
        solution: {
          type: 'object',
          properties: {
            tables: {
              type: 'object',
              properties: {
                assignments: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      resource_id: { type: 'string' },
                      demand_id: { type: 'string' },
                      quantity: { type: 'number' }
                    }
                  }
                }
              }
            }
          }
        },
        solution_checks: {
          checks: {
            assignment_feasibility: {
              type: 'validation',
              description: 'Check if assignments are feasible',
              severity: 'error'
            }
          }
        },
        name: 'complex-optimization-schema'
      }

      const mockResponse = {
        status: 200,
        content: complexSchemaData
      }
      mockClient.get.mockResolvedValue(mockResponse)

      const result = await repository.getSchema('complex-optimization-schema')

      expect(mockClient.get).toHaveBeenCalledWith('/schema/complex-optimization-schema/')
    })

    test('should handle schema name with special characters', async () => {
      const schemaName = 'test-schema_v2.1'
      const mockResponse = {
        status: 200,
        content: { ...mockSchemaData, name: schemaName }
      }
      mockClient.get.mockResolvedValue(mockResponse)

      const result = await repository.getSchema(schemaName)

      expect(mockClient.get).toHaveBeenCalledWith(`/schema/${schemaName}/`)
    })

    test('should handle timeout error', async () => {
      const timeoutError = new Error('Request timeout')
      timeoutError.name = 'TimeoutError'
      mockClient.get.mockRejectedValue(timeoutError)

      await expect(repository.getSchema('test-schema')).rejects.toThrow('Request timeout')
    })
  })
})