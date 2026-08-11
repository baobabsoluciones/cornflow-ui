import { describe, test, expect, vi } from 'vitest'

vi.mock('@cornflow-ui/core/plugins/i18n', () => ({
  default: { global: { t: (key: string) => key } },
}))

let showTablesWithoutSchema = false
vi.mock('@/app/config', () => ({
  default: {
    getCore: () => ({ parameters: { get showTablesWithoutSchema() { return showTablesWithoutSchema } } }),
  },
}))

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
  getConfigType,
} from '@cornflow-ui/core/utils/tableUtils'

// Shared schema fixture: collection "instance" with a table "orders".
const schemaConfig: any = {
  instance: {
    properties: {
      orders: {
        title: 'Orders',
        visible: true,
        show: true,
        items: {
          required: ['id'],
          properties: {
            id: {
              type: 'integer',
              title: 'Identifier',
              sortable: true,
              filterable: true,
              visible: true,
            },
            name: {
              type: 'string',
              title: { en: 'Name', es: 'Nombre' },
            },
            active: {
              type: 'boolean',
              filterable: false,
              visible: false,
            },
          },
        },
      },
      hidden: {
        visible: false,
        items: { required: [], properties: {} },
      },
    },
  },
}

describe('tableUtils - schema key/visibility helpers', () => {
  test('getTableDataKeys merges schema property keys with data keys (deduped)', () => {
    const data = { orders: [], extra: [] }
    expect(getTableDataKeys(schemaConfig, 'instance', data).sort()).toEqual(
      ['extra', 'hidden', 'orders'].sort(),
    )
  })

  test('getTableVisible returns the explicit flag, defaulting to true when undefined', () => {
    expect(getTableVisible(schemaConfig, 'instance', 'orders')).toBe(true)
    expect(getTableVisible(schemaConfig, 'instance', 'hidden')).toBe(false)
    // table not present -> tableSchema undefined -> default true
    expect(getTableVisible(schemaConfig, 'instance', 'missing')).toBe(true)
  })

  test('getTableDataName resolves string, localized object and fallback titles', () => {
    expect(getTableDataName(schemaConfig, 'instance', 'orders')).toBe('Orders')
    // title is an object keyed by lang
    expect(getTableDataName({ c: { properties: { t: { title: { en: 'E', es: 'S' } } } } }, 'c', 't', 'es')).toBe('S')
    // missing lang falls back to en
    expect(getTableDataName({ c: { properties: { t: { title: { en: 'E' } } } } }, 'c', 't', 'fr')).toBe('E')
    // no schema entry -> returns the key itself
    expect(getTableDataName(schemaConfig, 'instance', 'unknown')).toBe('unknown')
  })

  test('getTableDataNames filters by visibility and schema presence', () => {
    showTablesWithoutSchema = false
    const data = { orders: [], notInSchema: [] }
    const names = getTableDataNames(schemaConfig, 'instance', data)
    // orders is in schema and visible; notInSchema excluded when flag is off
    expect(names.map((n: any) => n.value)).toEqual(['orders'])

    showTablesWithoutSchema = true
    const names2 = getTableDataNames(schemaConfig, 'instance', data)
    expect(names2.map((n: any) => n.value).sort()).toEqual(['notInSchema', 'orders'])
    showTablesWithoutSchema = false
  })
})

describe('tableUtils - json schema accessors', () => {
  test('getTableJsonSchema returns the schema or a safe default', () => {
    expect(getTableJsonSchema(schemaConfig, 'instance', 'orders')).toBe(
      schemaConfig.instance.properties.orders,
    )
    const fallback = getTableJsonSchema(schemaConfig, 'instance', 'missing')
    expect(fallback).toEqual({ type: 'array', items: { properties: {}, required: [] } })
  })

  test('getTableOption / showTable read schema-level options', () => {
    expect(getTableOption(schemaConfig, 'instance', 'orders', 'show')).toBe(true)
    expect(showTable(schemaConfig, 'instance', 'orders')).toBe(true)
    // default true when "show" not defined
    expect(showTable(schemaConfig, 'instance', 'hidden')).toBe(true)
  })

  test('getTableHeader and getTableHeaders merge required + property keys', () => {
    expect(getTableHeader(schemaConfig, 'instance', 'orders')).toEqual(['id', 'name', 'active'])
    expect(getTableHeaders(schemaConfig, 'instance', 'orders')).toEqual(['id', 'name', 'active'])
  })

  test('getTableHeaders falls back to keys when no required array', () => {
    const cfg: any = { c: { properties: { t: { items: { properties: { a: {}, b: {} } } } } } }
    expect(getTableHeaders(cfg, 'c', 't')).toEqual(['a', 'b'])
  })

  test('getTableJsonSchemaProperty returns the property definition', () => {
    expect(getTableJsonSchemaProperty(schemaConfig, 'instance', 'orders', 'name')).toEqual({
      type: 'string',
      title: { en: 'Name', es: 'Nombre' },
    })
  })
})

describe('tableUtils - property flags and titles', () => {
  test('isTablePropertySortable defaults to true when undefined', () => {
    expect(isTablePropertySortable(schemaConfig, 'instance', 'orders', 'id')).toBe(true)
    expect(isTablePropertySortable(schemaConfig, 'instance', 'orders', 'name')).toBe(true)
  })

  test('isTablePropertyFilterable respects the flag, defaulting to false', () => {
    expect(isTablePropertyFilterable(schemaConfig, 'instance', 'orders', 'id')).toBe(true)
    expect(isTablePropertyFilterable(schemaConfig, 'instance', 'orders', 'active')).toBe(false)
    expect(isTablePropertyFilterable(schemaConfig, 'instance', 'orders', 'name')).toBe(false)
  })

  test('getTablePropertyTitle resolves string/object/fallback', () => {
    expect(getTablePropertyTitle(schemaConfig, 'instance', 'orders', 'id')).toBe('Identifier')
    expect(getTablePropertyTitle(schemaConfig, 'instance', 'orders', 'name', 'es')).toBe('Nombre')
    expect(getTablePropertyTitle(schemaConfig, 'instance', 'orders', 'name', 'fr')).toBe('Name')
    // no title -> returns the item name
    expect(getTablePropertyTitle(schemaConfig, 'instance', 'orders', 'active')).toBe('active')
  })

  test('getTablePropertyVisible defaults to true when undefined', () => {
    expect(getTablePropertyVisible(schemaConfig, 'instance', 'orders', 'id')).toBe(true)
    expect(getTablePropertyVisible(schemaConfig, 'instance', 'orders', 'active')).toBe(false)
    expect(getTablePropertyVisible(schemaConfig, 'instance', 'orders', 'name')).toBe(true)
  })
})

describe('tableUtils - header/config builders', () => {
  test('getHeadersFromData maps raw data keys to header objects', () => {
    expect(getHeadersFromData({ a: 1, b: 2 })).toEqual([
      { title: 'a', value: 'a', visible: true, sortable: true, filterable: false },
      { title: 'b', value: 'b', visible: true, sortable: true, filterable: false },
    ])
  })

  test('getTableHeadersData maps visible headers with derived type', () => {
    const headers = getTableHeadersData(schemaConfig, 'instance', 'orders', 'en')
    const byValue = Object.fromEntries(headers.map((h: any) => [h.value, h]))
    // "active" is not visible -> filtered out
    expect(Object.keys(byValue).sort()).toEqual(['id', 'name'])
    // integer mapped to number
    expect(byValue.id.type).toBe('number')
    expect(byValue.id.required).toBe(true)
    expect(byValue.name.type).toBe('string')
    expect(byValue.name.required).toBe(false)
  })

  test('getConfigTableHeadersData returns the two fixed columns', () => {
    const cols = getConfigTableHeadersData()
    expect(cols).toHaveLength(2)
    expect(cols.map((c: any) => c.value)).toEqual(['displayName', 'value'])
  })

  test('getConfigTableData builds rows from data keys', () => {
    const cfg: any = {
      instance: {
        properties: {
          config: {
            properties: {
              maxIter: { title: 'Max iterations', type: 'integer' },
              tol: { title: { en: 'Tolerance', es: 'Tolerancia' }, type: 'number' },
            },
          },
        },
      },
    }
    const rows = getConfigTableData(cfg, { maxIter: 10, tol: 0.5 }, 'instance', 'config', 'es')
    expect(rows).toEqual([
      { displayName: 'Max iterations', type: 'number', value: 10, key: 'maxIter' },
      { displayName: 'Tolerancia', type: 'number', value: 0.5, key: 'tol' },
    ])
  })

  test('getConfigDisplayName and getConfigType resolve titles and types', () => {
    const cfg: any = {
      instance: {
        properties: {
          config: {
            properties: {
              a: { title: 'Plain', type: 'integer' },
              b: { title: { en: 'B-en' }, type: 'string' },
            },
          },
        },
      },
    }
    expect(getConfigDisplayName(cfg, 'instance', 'config', 'a')).toBe('Plain')
    expect(getConfigDisplayName(cfg, 'instance', 'config', 'b', 'es')).toBe('B-en')
    expect(getConfigType(cfg, 'instance', 'config', 'a')).toBe('number')
    expect(getConfigType(cfg, 'instance', 'config', 'b')).toBe('string')
  })
})
