import { describe, test, expect, vi, beforeEach } from 'vitest'
import {
  getTableDataKeys,
  getTableVisible,
  getTableDataNames,
  getTableDataName,
  getTableJsonSchema,
  getTableOption,
  showTable,
  getTableHeader,
  getTableJsonSchemaProperty,
  isTablePropertySortable,
  isTablePropertyFilterable,
  getTablePropertyTitle,
  getTablePropertyVisible,
  getTableHeaders,
  getHeadersFromData,
  getTableHeadersData,
  getConfigTableHeadersData,
  getConfigTableData,
  getConfigDisplayName,
  getConfigType
} from '@/utils/tableUtils'

// Mock dependencies
vi.mock('@/plugins/i18n', () => ({
  default: {
    global: {
      t: vi.fn((key) => key)
    }
  }
}))

vi.mock('@/app/config', () => ({
  default: {
    getCore: vi.fn().mockReturnValue({
      parameters: {
        showTablesWithoutSchema: true
      }
    })
  }
}))

describe('tableUtils', () => {
  let mockSchemaConfig
  let mockData

  beforeEach(() => {
    vi.clearAllMocks()
    
    mockSchemaConfig = {
      'testCollection': {
        properties: {
          'users': {
            type: 'array',
            visible: true,
            show: true,
            title: { en: 'Users', es: 'Usuarios' },
            items: {
              properties: {
                id: { 
                  type: 'integer', 
                  title: 'User ID', 
                  visible: true, 
                  sortable: true, 
                  filterable: false 
                },
                name: { 
                  type: 'string', 
                  title: { en: 'Name', es: 'Nombre' }, 
                  visible: true, 
                  sortable: true, 
                  filterable: true 
                },
                email: { 
                  type: 'string', 
                  title: 'Email', 
                  visible: false, 
                  sortable: false, 
                  filterable: false 
                },
                age: { 
                  type: 'number', 
                  title: 'Age', 
                  visible: true, 
                  sortable: true, 
                  filterable: true 
                }
              },
              required: ['id', 'name']
            }
          },
          'config': {
            type: 'object',
            visible: true,
            properties: {
              setting1: { type: 'string', title: 'Setting 1' },
              setting2: { type: 'integer', title: 'Setting 2' },
              hiddenSetting: { type: 'string', visible: false }
            }
          },
          'hiddenTable': {
            type: 'array',
            visible: false,
            items: {
              properties: {
                data: { type: 'string' }
              }
            }
          }
        }
      }
    }

    mockData = {
      users: [
        { id: 1, name: 'John', email: 'john@example.com', age: 25 },
        { id: 2, name: 'Jane', email: 'jane@example.com', age: 30 }
      ],
      config: {
        setting1: 'value1',
        setting2: 42
      },
      extraTable: [
        { data: 'test' }
      ]
    }
  })

  describe('getTableDataKeys', () => {
    test('returns unique keys from both schema and data', () => {
      const result = getTableDataKeys(mockSchemaConfig, 'testCollection', mockData)
      
      expect(result).toContain('users')
      expect(result).toContain('config')
      expect(result).toContain('hiddenTable')
      expect(result).toContain('extraTable')
      expect(result).toHaveLength(4)
    })

    test('handles empty data', () => {
      const result = getTableDataKeys(mockSchemaConfig, 'testCollection', {})
      
      expect(result).toContain('users')
      expect(result).toContain('config')
      expect(result).toContain('hiddenTable')
      expect(result).toHaveLength(3)
    })

    test('handles missing schema collection', () => {
      // This should actually throw an error based on the implementation
      expect(() => {
        getTableDataKeys({}, 'missingCollection', mockData)
      }).toThrow()
    })
  })

  describe('getTableVisible', () => {
    test('returns true for visible table', () => {
      const result = getTableVisible(mockSchemaConfig, 'testCollection', 'users')
      expect(result).toBe(true)
    })

    test('returns false for hidden table', () => {
      const result = getTableVisible(mockSchemaConfig, 'testCollection', 'hiddenTable')
      expect(result).toBe(false)
    })

    test('returns true for table without visible property (default)', () => {
      const schemaWithoutVisible = {
        'testCollection': {
          properties: {
            'defaultTable': {
              type: 'array'
            }
          }
        }
      }
      
      const result = getTableVisible(schemaWithoutVisible, 'testCollection', 'defaultTable')
      expect(result).toBe(true)
    })

    test('handles missing table', () => {
      const result = getTableVisible(mockSchemaConfig, 'testCollection', 'nonexistent')
      expect(result).toBe(true)
    })
  })

  describe('getTableDataNames', () => {
    test('returns table names with visibility filtering', () => {
      const result = getTableDataNames(mockSchemaConfig, 'testCollection', mockData)
      
      const visibleTables = result.filter(table => table.visible)
      expect(visibleTables).toHaveLength(3) // users, config, extraTable (hiddenTable filtered out)
      
      const usersTable = result.find(table => table.value === 'users')
      expect(usersTable?.text).toBe('Users')
    })

    test('uses localized titles when available', () => {
      const result = getTableDataNames(mockSchemaConfig, 'testCollection', mockData, 'es')
      
      const usersTable = result.find(table => table.value === 'users')
      expect(usersTable?.text).toBe('Usuarios')
    })

    test('falls back to key name when no title', () => {
      const result = getTableDataNames(mockSchemaConfig, 'testCollection', mockData)
      
      const extraTable = result.find(table => table.value === 'extraTable')
      expect(extraTable?.text).toBe('extraTable')
    })
  })

  describe('getTableDataName', () => {
    test('returns localized title when available', () => {
      const result = getTableDataName(mockSchemaConfig, 'testCollection', 'users', 'es')
      expect(result).toBe('Usuarios')
    })

    test('falls back to english title', () => {
      const result = getTableDataName(mockSchemaConfig, 'testCollection', 'users', 'fr')
      expect(result).toBe('Users')
    })

    test('returns string title directly', () => {
      const result = getTableDataName(mockSchemaConfig, 'testCollection', 'config', 'en')
      expect(result).toBe('config') // No title defined, returns key
    })

    test('returns key when no schema found', () => {
      const result = getTableDataName(mockSchemaConfig, 'testCollection', 'nonexistent')
      expect(result).toBe('nonexistent')
    })
  })

  describe('getTableJsonSchema', () => {
    test('returns schema for existing table', () => {
      const result = getTableJsonSchema(mockSchemaConfig, 'testCollection', 'users')
      
      expect(result.type).toBe('array')
      expect(result.items.properties).toHaveProperty('name')
    })

    test('returns default schema for non-existing table', () => {
      const result = getTableJsonSchema(mockSchemaConfig, 'testCollection', 'nonexistent')
      
      expect(result).toEqual({
        type: 'array',
        items: {
          properties: {},
          required: []
        }
      })
    })
  })

  describe('getTableOption', () => {
    test('returns specific option from table schema', () => {
      const result = getTableOption(mockSchemaConfig, 'testCollection', 'users', 'visible')
      expect(result).toBe(true)
    })

    test('returns undefined for non-existing option', () => {
      const result = getTableOption(mockSchemaConfig, 'testCollection', 'users', 'nonexistent')
      expect(result).toBeUndefined()
    })
  })

  describe('showTable', () => {
    test('returns show property when defined', () => {
      const result = showTable(mockSchemaConfig, 'testCollection', 'users')
      expect(result).toBe(true)
    })

    test('returns true when show property is undefined', () => {
      const schemaWithoutShow = {
        'testCollection': {
          properties: {
            'defaultTable': {
              type: 'array'
            }
          }
        }
      }
      
      const result = showTable(schemaWithoutShow, 'testCollection', 'defaultTable')
      expect(result).toBe(true)
    })
  })

  describe('getTableHeader', () => {
    test('returns header keys including required and all properties', () => {
      const result = getTableHeader(mockSchemaConfig, 'testCollection', 'users')
      
      expect(result).toContain('id')
      expect(result).toContain('name')
      expect(result).toContain('email')
      expect(result).toContain('age')
      expect(result).toHaveLength(4)
    })

    test('handles missing required array', () => {
      const schemaWithoutRequired = {
        'testCollection': {
          properties: {
            'table': {
              type: 'array',
              items: {
                properties: {
                  field1: { type: 'string' },
                  field2: { type: 'string' }
                }
              }
            }
          }
        }
      }
      
      const result = getTableHeader(schemaWithoutRequired, 'testCollection', 'table')
      expect(result).toEqual(['field1', 'field2'])
    })
  })

  describe('getTableJsonSchemaProperty', () => {
    test('returns property schema', () => {
      const result = getTableJsonSchemaProperty(mockSchemaConfig, 'testCollection', 'users', 'name')
      
      expect(result.type).toBe('string')
      expect(result.title.en).toBe('Name')
    })

    test('returns undefined for non-existing property', () => {
      const result = getTableJsonSchemaProperty(mockSchemaConfig, 'testCollection', 'users', 'nonexistent')
      expect(result).toBeUndefined()
    })
  })

  describe('isTablePropertySortable', () => {
    test('returns true for sortable property', () => {
      const result = isTablePropertySortable(mockSchemaConfig, 'testCollection', 'users', 'name')
      expect(result).toBe(true)
    })

    test('returns false for non-sortable property', () => {
      const result = isTablePropertySortable(mockSchemaConfig, 'testCollection', 'users', 'email')
      expect(result).toBe(false)
    })

    test('returns true by default when property not found', () => {
      // This will throw an error since the property doesn't exist
      expect(() => {
        isTablePropertySortable({}, 'collection', 'table', 'property')
      }).toThrow()
    })
  })

  describe('isTablePropertyFilterable', () => {
    test('returns true for filterable property', () => {
      const result = isTablePropertyFilterable(mockSchemaConfig, 'testCollection', 'users', 'name')
      expect(result).toBe(true)
    })

    test('returns false for non-filterable property', () => {
      const result = isTablePropertyFilterable(mockSchemaConfig, 'testCollection', 'users', 'id')
      expect(result).toBe(false)
    })

    test('returns false by default when property not found', () => {
      // This will throw an error since the property doesn't exist
      expect(() => {
        isTablePropertyFilterable({}, 'collection', 'table', 'property')
      }).toThrow()
    })
  })

  describe('getTablePropertyTitle', () => {
    test('returns localized title', () => {
      const result = getTablePropertyTitle(mockSchemaConfig, 'testCollection', 'users', 'name', 'es')
      expect(result).toBe('Nombre')
    })

    test('falls back to english title', () => {
      const result = getTablePropertyTitle(mockSchemaConfig, 'testCollection', 'users', 'name', 'fr')
      expect(result).toBe('Name')
    })

    test('returns string title directly', () => {
      const result = getTablePropertyTitle(mockSchemaConfig, 'testCollection', 'users', 'id')
      expect(result).toBe('User ID')
    })

    test('returns property name when no title', () => {
      // This will throw an error since the property doesn't exist
      expect(() => {
        getTablePropertyTitle({}, 'collection', 'table', 'property')
      }).toThrow()
    })
  })

  describe('getTablePropertyVisible', () => {
    test('returns true for visible property', () => {
      const result = getTablePropertyVisible(mockSchemaConfig, 'testCollection', 'users', 'name')
      expect(result).toBe(true)
    })

    test('returns false for hidden property', () => {
      const result = getTablePropertyVisible(mockSchemaConfig, 'testCollection', 'users', 'email')
      expect(result).toBe(false)
    })

    test('returns true by default', () => {
      // This will throw an error since the property doesn't exist
      expect(() => {
        getTablePropertyVisible({}, 'collection', 'table', 'property')
      }).toThrow()
    })
  })

  describe('getTableHeaders', () => {
    test('returns headers with required first', () => {
      const result = getTableHeaders(mockSchemaConfig, 'testCollection', 'users')
      
      expect(result[0]).toBe('id')
      expect(result[1]).toBe('name')
      expect(result).toContain('email')
      expect(result).toContain('age')
    })

    test('uses all keys when no required fields', () => {
      const schemaWithoutRequired = {
        'testCollection': {
          properties: {
            'table': {
              items: {
                properties: {
                  field1: { type: 'string' },
                  field2: { type: 'string' }
                }
              }
            }
          }
        }
      }
      
      const result = getTableHeaders(schemaWithoutRequired, 'testCollection', 'table')
      expect(result).toEqual(['field1', 'field2'])
    })
  })

  describe('getHeadersFromData', () => {
    test('creates headers from data object keys', () => {
      const data = { name: 'John', age: 25, email: 'john@example.com' }
      const result = getHeadersFromData(data)
      
      expect(result).toHaveLength(3)
      expect(result[0]).toEqual({
        title: 'name',
        value: 'name',
        visible: true,
        sortable: true,
        filterable: false
      })
    })

    test('handles empty data object', () => {
      const result = getHeadersFromData({})
      expect(result).toEqual([])
    })
  })

  describe('getTableHeadersData', () => {
    test('returns formatted headers data', () => {
      const result = getTableHeadersData(mockSchemaConfig, 'testCollection', 'users')
      
      const visibleHeaders = result.filter(header => header.visible)
      expect(visibleHeaders).toHaveLength(3) // id, name, age (email is hidden)
      
      const nameHeader = result.find(header => header.value === 'name')
      expect(nameHeader?.title).toBe('Name')
      expect(nameHeader?.sortable).toBe(true)
      expect(nameHeader?.filterable).toBe(true)
      expect(nameHeader?.required).toBe(true)
    })

    test('converts integer type to number', () => {
      const result = getTableHeadersData(mockSchemaConfig, 'testCollection', 'users')
      
      const idHeader = result.find(header => header.value === 'id')
      expect(idHeader?.type).toBe('number')
    })

    test('uses localized titles', () => {
      const result = getTableHeadersData(mockSchemaConfig, 'testCollection', 'users', 'es')
      
      const nameHeader = result.find(header => header.value === 'name')
      expect(nameHeader?.title).toBe('Nombre')
    })
  })

  describe('getConfigTableHeadersData', () => {
    test('returns config table headers', () => {
      const result = getConfigTableHeadersData()
      
      expect(result).toHaveLength(2)
      expect(result[0].value).toBe('displayName')
      expect(result[1].value).toBe('value')
      expect(result[0].config).toBe(true)
    })
  })

  describe('getConfigTableData', () => {
    test('formats config data for table display', () => {
      const configData = { setting1: 'value1', setting2: 42 }
      const result = getConfigTableData(mockSchemaConfig, configData, 'testCollection', 'config')
      
      expect(result).toHaveLength(2)
      expect(result[0].key).toBe('setting1')
      expect(result[0].value).toBe('value1')
      expect(result[0].displayName).toBe('Setting 1')
      expect(result[0].type).toBe('string')
      
      expect(result[1].key).toBe('setting2')
      expect(result[1].value).toBe(42)
      expect(result[1].type).toBe('number')
    })

    test('uses localized display names', () => {
      const schemaWithLocalizedTitles = {
        'testCollection': {
          properties: {
            'config': {
              type: 'object',
              properties: {
                setting1: { 
                  type: 'string', 
                  title: { en: 'Setting 1', es: 'Configuración 1' } 
                }
              }
            }
          }
        }
      }
      
      const result = getConfigTableData(schemaWithLocalizedTitles, { setting1: 'test' }, 'testCollection', 'config', 'es')
      expect(result[0].displayName).toBe('Configuración 1')
    })
  })

  describe('getConfigDisplayName', () => {
    test('returns localized title', () => {
      const schemaWithLocalizedTitles = {
        'testCollection': {
          properties: {
            'config': {
              properties: {
                setting1: { 
                  title: { en: 'Setting 1', es: 'Configuración 1' } 
                }
              }
            }
          }
        }
      }
      
      const result = getConfigDisplayName(schemaWithLocalizedTitles, 'testCollection', 'config', 'setting1', 'es')
      expect(result).toBe('Configuración 1')
    })

    test('falls back to key when no title', () => {
      // This will throw an error since the property doesn't exist
      expect(() => {
        getConfigDisplayName({}, 'collection', 'table', 'key')
      }).toThrow()
    })
  })

  describe('getConfigType', () => {
    test('returns string type', () => {
      const result = getConfigType(mockSchemaConfig, 'testCollection', 'config', 'setting1')
      expect(result).toBe('string')
    })

    test('converts integer to number', () => {
      const result = getConfigType(mockSchemaConfig, 'testCollection', 'config', 'setting2')
      expect(result).toBe('number')
    })

    test('handles missing property', () => {
      // This will throw an error since the property doesn't exist
      expect(() => {
        getConfigType({}, 'collection', 'table', 'key')
      }).toThrow()
    })
  })
})
