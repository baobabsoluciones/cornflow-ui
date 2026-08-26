import { describe, test, expect } from 'vitest'
import {
  transformOpenApiToTableConfig,
  getRequestSchemaFromDefinitions,
  getResponseSchemaFromDefinitions,
  convertDefinitionToSchema,
} from '@cornflow-ui/core/modules/frontend-automation/openApiTransform'

// ─── convertDefinitionToSchema ───────────────────────────────────────────────

describe('convertDefinitionToSchema', () => {
  test('returns empty object schema for invalid input', () => {
    expect(convertDefinitionToSchema(null)).toEqual({
      type: 'object',
      properties: {},
      required: [],
    })
  })
  test('handles definition without properties', () => {
    const result = convertDefinitionToSchema({ required: ['x'] })
    expect(result.properties).toEqual({})
    expect(result.required).toEqual(['x'])
  })
  test('converts properties with formats, choices, columns_to_join, join_from', () => {
    const def = {
      title: 'My Table',
      required: ['name'],
      properties: {
        name: { type: 'string', title: 'Name' },
        fecha: { type: 'string', format: 'date' },
        estado: { type: 'string', choices: ['A', 'B'] },
        factoria_id: { type: 'integer', columns_to_join: ['factoria'] },
        factoria: {
          type: 'string',
          join_from: 'factorias.nombre',
          value_none: { title: { en: 'ALL' } },
        },
      },
    }
    const schema = convertDefinitionToSchema(def, 'en')
    expect(schema.type).toBe('object')
    expect(schema.properties.name.required).toBe(true)
    expect(schema.properties.fecha.type).toBe('date')
    expect(schema.properties.fecha.format).toBe('date')
    expect(schema.properties.estado.choices).toEqual(['A', 'B'])
    expect(schema.properties.factoria_id.isForeignKey).toBe(true)
    expect(schema.properties.factoria_id.columnsToJoin).toEqual(['factoria'])
    expect(schema.properties.factoria.isDependentField).toBe(true)
    expect(schema.properties.factoria.foreignKeyField).toBe('factoria_id')
    expect(schema.properties.factoria.valueNone).toEqual({ title: { en: 'ALL' } })
  })
})

// ─── getRequestSchemaFromDefinitions / getResponseSchemaFromDefinitions ──────

describe('getRequestSchemaFromDefinitions', () => {
  const definitions = {
    Areas: { properties: { id: { type: 'integer' }, name: { type: 'string' } } },
  }
  test('returns null for read-only operations', () => {
    expect(getRequestSchemaFromDefinitions('get_list', definitions, 'Areas')).toBeNull()
    expect(getRequestSchemaFromDefinitions('get_item', definitions, 'Areas')).toBeNull()
  })
  test('returns object schema for post_item', () => {
    const schema = getRequestSchemaFromDefinitions('post_item', definitions, 'Areas')
    expect(schema.type).toBe('object')
  })
  test('wraps in array for post_bulk', () => {
    const schema = getRequestSchemaFromDefinitions('post_bulk', definitions, 'Areas')
    expect(schema.type).toBe('array')
    expect(schema.items.type).toBe('object')
  })
  test('returns null when definition missing', () => {
    expect(getRequestSchemaFromDefinitions('post_item', {}, 'Nope')).toBeNull()
  })
})

describe('getResponseSchemaFromDefinitions', () => {
  const definitions = {
    Areas: { properties: { id: { type: 'integer' }, name: { type: 'string' } } },
  }
  test('get_list returns array wrapper', () => {
    const schema = getResponseSchemaFromDefinitions('get_list', 'Areas', definitions)
    expect(schema.type).toBe('array')
    expect(schema.items.type).toBe('object')
  })
  test('get_item returns object schema', () => {
    const schema = getResponseSchemaFromDefinitions('get_item', 'Areas', definitions)
    expect(schema.type).toBe('object')
  })
  test('other operations return null', () => {
    expect(getResponseSchemaFromDefinitions('post_item', 'Areas', definitions)).toBeNull()
  })
  test('resolves definition via path $ref when provided', () => {
    const paths = {
      '/areas/': {
        get: {
          responses: { default: { schema: { items: { $ref: '#/definitions/Areas' } } } },
        },
      },
    }
    const schema = getResponseSchemaFromDefinitions(
      'get_list',
      'unknown_table',
      definitions,
      'en',
      { paths, getListUrl: '/areas/' },
    )
    expect(schema.type).toBe('array')
  })
  test('returns null when definition not found', () => {
    expect(getResponseSchemaFromDefinitions('get_list', 'Nope', {})).toBeNull()
  })
})

// ─── transformOpenApiToTableConfig ───────────────────────────────────────────

describe('transformOpenApiToTableConfig', () => {
  test('builds config, sections and groups', () => {
    const openApiSchema = {
      available_automations: {
        tables: {
          areas: {
            title: { en: 'Areas' },
            group: 'grp1',
            order: 1,
            get_list: { url: '/areas/', http_method: 'GET' },
            get_item: { url: '/areas/{id}/', http_method: 'GET' },
            ignored_no_url: { foo: 'bar' },
          },
        },
        groups: { grp1: { title: { en: 'Group One' }, icon: 'mdi-folder', order: 2, section: 'sec1' } },
        sections: { sec1: { title: { en: 'Section One' }, order: 1 } },
      },
      definitions: {
        Areas: { properties: { id: { type: 'integer' }, name: { type: 'string' } } },
      },
      paths: {
        '/areas/': {
          get: {
            parameters: [{ name: 'q', in: 'query' }],
            responses: { default: { schema: { items: { $ref: '#/definitions/Areas' } } } },
          },
        },
      },
    }
    const { config, sections, groups } = transformOpenApiToTableConfig(openApiSchema, 'en')
    expect(config.areas.title).toBe('Areas')
    expect(config.areas.group).toBe('Group One')
    expect(config.areas.section).toBe('sec1')
    expect(config.areas.get_list.parameters).toEqual([{ name: 'q', in: 'query' }])
    expect(config.areas.get_list.response_schema.type).toBe('array')
    expect(config.areas.ignored_no_url).toBeUndefined()
    expect(sections[0].id).toBe('sec1')
    expect(groups[0].id).toBe('grp1')
  })
  test('drops a null "schemas" so it never reaches the visibility filters', () => {
    const openApiSchema = {
      available_automations: {
        tables: {
          nullSchemas: {
            title: { en: 'Null schemas' },
            group: null,
            section: 'sec1',
            schemas: null,
            get_list: { url: '/null-schemas/', http_method: 'GET' },
          },
          withSchemas: {
            title: { en: 'With schemas' },
            group: null,
            section: 'sec1',
            schemas: ['dagA'],
            get_list: { url: '/with-schemas/', http_method: 'GET' },
          },
        },
        groups: {},
        sections: { sec1: { title: { en: 'Section One' }, order: 1 } },
      },
      definitions: {},
      paths: {},
    }
    const { config } = transformOpenApiToTableConfig(openApiSchema, 'en')
    // Absent, not null: the filters treat "absent" as "visible in all schemas".
    expect('schemas' in config.nullSchemas).toBe(false)
    expect(config.withSchemas.schemas).toEqual(['dagA'])
  })
  test('handles tables-only available_automations (no groups/sections)', () => {
    const openApiSchema = {
      available_automations: {
        simple: { title: 'Simple', get_list: { url: '/s/', http_method: 'GET' } },
      },
      definitions: { Simple: { properties: { id: { type: 'integer' } } } },
      paths: {},
    }
    const { config } = transformOpenApiToTableConfig(openApiSchema)
    expect(config.simple.title).toBe('Simple')
  })
})
