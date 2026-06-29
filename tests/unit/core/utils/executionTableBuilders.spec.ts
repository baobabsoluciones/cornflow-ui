import { describe, test, expect, vi } from 'vitest'

// Isolate the builder logic: leaf helpers become deterministic identities.
vi.mock('@/utils/schemaUtils', () => ({
  filterParameterObjectByVisibleProperties: (data: any) => data,
  isParameterPropertySchemaVisible: () => true,
  isAllowLoadFromDbDisabled: () => false,
  normalizeJsonSchemaPropertyTypeForUi: (prop: any) => prop?.type || 'string',
}))
vi.mock('@/utils/i18nUtils', () => ({
  resolveTitle: (title: any, fallback: string) =>
    typeof title === 'string' ? title : fallback,
}))
vi.mock('@/utils/tableFilterUtils', () => ({
  generateHeadersFromData: (rows: any[]) =>
    Object.keys(rows[0] || {}).map((k) => ({ key: k, value: k })),
  generateSecureId: (seed: string) => `id_${seed}`,
}))

import {
  OBJECT_TABLE_ROW_ID,
  formatTitle,
  createParameterTableVertical,
  createObjectTableObject,
  createValidationTables,
  createTableObject,
  injectParameterSwitchColumns,
} from '@/utils/executionTableBuilders'

const t = (key: string) => key

describe('formatTitle / OBJECT_TABLE_ROW_ID', () => {
  test('formatTitle title-cases and de-underscores', () => {
    expect(formatTitle('my_table')).toBe('My table')
    expect(formatTitle('orders')).toBe('Orders')
  })
  test('OBJECT_TABLE_ROW_ID is the synthetic single-row id', () => {
    expect(OBJECT_TABLE_ROW_ID).toBe('__object__')
  })
})

const paramSchema = {
  properties: {
    paramsTable: {
      title: 'Params',
      required: ['p1'],
      properties: { p1: { title: 'P1' }, p2: {} },
    },
  },
}

describe('createParameterTableVertical', () => {
  test('non-reuploaded: single from-DB column, row flags from parameterSwitches', () => {
    const etlFlow = {
      tableSwitches: { paramsTable: { variant: 'single' } },
      parameterSwitches: { 'paramsTable.p1': false },
    }
    const table = createParameterTableVertical('paramsTable', { p1: 10, p2: 'x' }, paramSchema, {
      t,
      instanceSchema: {},
      etlFlow,
    })

    expect(table.isParameterTableVertical).toBe(true)
    expect(table.headers.map((h: any) => h.key)).toEqual([
      'selection',
      'parameterTitle',
      'value',
      '__etl_from_db__',
    ])
    expect(table.items).toHaveLength(2)
    expect(table.items[0]).toMatchObject({ parameterTitle: 'P1', value: 10, __etl_from_db__: true })
    // p2 has no switch entry -> from-DB false, title falls back to formatTitle
    expect(table.items[1]).toMatchObject({ parameterTitle: 'P2', __etl_from_db__: false })
  })

  test('reuploaded: three switch columns with default/from-db/fixed flags', () => {
    const etlFlow = {
      tableSwitches: { paramsTable: { variant: 'reuploaded' } },
      parameterSwitches: { 'paramsTable.p1': null, 'paramsTable.p2': true },
    }
    const table = createParameterTableVertical('paramsTable', { p1: 1, p2: 2 }, paramSchema, {
      t,
      instanceSchema: {},
      etlFlow,
    })

    expect(table.headers.map((h: any) => h.key)).toEqual([
      'selection',
      'parameterTitle',
      'value',
      '__etl_default__',
      '__etl_from_db__',
      '__etl_fixed__',
    ])
    expect(table.items[0]).toMatchObject({ __etl_default__: true, __etl_from_db__: false, __etl_fixed__: false })
    expect(table.items[1]).toMatchObject({ __etl_default__: false, __etl_fixed__: true })
  })
})

describe('createObjectTableObject', () => {
  test('builds headers from the object schema properties', () => {
    const schema = {
      properties: {
        obj: {
          title: 'Obj',
          required: ['a'],
          properties: { a: { type: 'integer' }, b: { type: 'string' } },
        },
      },
    }
    const table = createObjectTableObject('obj', { a: 1, b: 'x' }, schema, { instanceSchema: {} })

    expect(table.title).toBe('Obj')
    expect(table.headers.map((h: any) => h.key)).toEqual(['selection', 'a', 'b'])
    const colA = table.headers.find((h: any) => h.key === 'a')
    expect(colA.type).toBe('number') // integer -> number
    expect(colA.required).toBe(true)
    expect(table.items).toEqual([{ id: OBJECT_TABLE_ROW_ID, a: 1, b: 'x' }])
  })

  test('falls back to data-derived headers when there is no property schema', () => {
    const schema = { properties: { obj: { title: '' } } }
    const table = createObjectTableObject('obj', { x: 1 }, schema, { instanceSchema: {} })

    // generated headers (mocked) minus id/selection, with selection prepended
    expect(table.headers.map((h: any) => h.key)).toEqual(['selection', 'x'])
    expect(table.title).toBe('Obj') // formatTitle('obj')
    expect(table.items[0]).toEqual({ id: OBJECT_TABLE_ROW_ID, x: 1 })
  })
})

describe('createValidationTables', () => {
  const identity = (items: any[]) => items

  test('builds a table from a primitive array (value column)', () => {
    const execution = { instance: { dataChecks: { errors: ['e1', 'e2'] } } }
    const tables = createValidationTables(execution, { applyFilters: identity, checksSchema: {} })
    expect(tables).toHaveLength(1)
    const tbl = tables[0]
    expect(tbl.key).toBe('validation_errors')
    expect(tbl.isValidationTable).toBe(true)
    expect(tbl.headers.map((h: any) => h.key)).toEqual(['id', 'value'])
    expect(tbl.items).toHaveLength(2)
    expect(tbl.items[0].value).toBe('e1')
  })

  test('builds a table from an object array and flags warnings via checksSchema', () => {
    const execution = { instance: { dataChecks: { rows: [{ a: 1 }, { a: 2 }] } } }
    const checksSchema = { properties: { rows: { is_warning: true } } }
    const tables = createValidationTables(execution, { applyFilters: identity, checksSchema })
    expect(tables[0].isWarning).toBe(true)
    // id header + data headers (id/selection filtered out of generated)
    expect(tables[0].headers[0].key).toBe('id')
    expect(tables[0].items).toHaveLength(2)
  })

  test('skips empty / non-array check entries', () => {
    const execution = { instance: { dataChecks: { empty: [], notArray: { x: 1 } } } }
    expect(createValidationTables(execution, { applyFilters: identity, checksSchema: {} })).toEqual([])
  })

  test('tolerates missing dataChecks', () => {
    expect(createValidationTables({ instance: {} }, { applyFilters: identity, checksSchema: {} })).toEqual([])
  })
})

describe('createTableObject', () => {
  const identity = (items: any[]) => items

  test('builds schema-driven headers when schema keys match the data', () => {
    const config = {
      title: 'Orders',
      get_list: {
        response_schema: {
          items: {
            required: ['a'],
            properties: { a: { title: 'A', type: 'string' }, b: { type: 'integer' } },
          },
        },
      },
    }
    const data = [{ a: 'x', b: 1 }]
    const table = createTableObject('orders', data, {}, config, { applyFilters: identity })

    expect(table.title).toBe('Orders')
    expect(table.headers.map((h: any) => h.key)).toEqual(['selection', 'a', 'b'])
    expect(table.headers.find((h: any) => h.key === 'a').required).toBe(true)
    // ids are injected into rows lacking one
    expect(table.items[0].id).toBeDefined()
  })

  test('falls back to data-derived headers when there is no response schema', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const table = createTableObject('t', [{ x: 1 }], { t: {} }, undefined, { applyFilters: identity })
    expect(table.headers.map((h: any) => h.key)).toEqual(['selection', 'x'])
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  test('enriches data headers when schema keys do not match the data', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const config = {
      get_list: {
        response_schema: {
          items: { required: [], properties: { foo: { title: 'Foo', type: 'string' } } },
        },
      },
    }
    // data uses "bar", schema declares "foo" -> mismatch -> enriched fallback
    const table = createTableObject('t', [{ bar: 1 }], {}, config, { applyFilters: identity })
    expect(table.headers.map((h: any) => h.key)).toEqual(['selection', 'bar'])
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})

describe('injectParameterSwitchColumns', () => {
  const t = (k: string) => k

  test('is a no-op when there is no ETL flow', () => {
    const obj = { headers: [], items: [{ name: 'p1' }] }
    injectParameterSwitchColumns(obj, 'T', { t, etlFlow: null })
    expect(obj.headers).toHaveLength(0)
  })

  test('non-reuploaded: adds one from-DB column and sets row flags', () => {
    const obj: any = { headers: [], items: [{ name: 'p1' }, { name: 'p2' }] }
    const etlFlow = {
      tableSwitches: { T: { variant: 'single' } },
      parameterSwitches: { 'T.p1': false },
    }
    injectParameterSwitchColumns(obj, 'T', { t, etlFlow })
    expect(obj.headers.map((h: any) => h.key)).toEqual(['__etl_from_db__'])
    expect(obj.items[0].__etl_from_db__).toBe(true)
    expect(obj.items[1].__etl_from_db__).toBe(false)
  })

  test('reuploaded: adds three columns and derives default/from-db/fixed flags', () => {
    const obj: any = {
      headers: [],
      items: [{ name: 'p1' }, { name: 'p2' }, { foo: 'no-name' }],
    }
    const etlFlow = {
      tableSwitches: { T: { variant: 'reuploaded' } },
      parameterSwitches: { 'T.p1': null, 'T.p2': true },
    }
    injectParameterSwitchColumns(obj, 'T', { t, etlFlow })
    expect(obj.headers.map((h: any) => h.key)).toEqual([
      '__etl_default__',
      '__etl_from_db__',
      '__etl_fixed__',
    ])
    expect(obj.items[0]).toMatchObject({ __etl_default__: true, __etl_fixed__: false })
    expect(obj.items[1]).toMatchObject({ __etl_fixed__: true })
    // row without a name/ID/key is skipped (no flags added)
    expect(obj.items[2].__etl_default__).toBeUndefined()
  })
})
