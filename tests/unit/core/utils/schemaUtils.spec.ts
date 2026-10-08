import { describe, test, expect } from 'vitest'
import {
  getExcludedKeysForMasterTableCompare,
  orderedRowMatchKeyCandidates,
  rowMatchKeyPart,
  buildRowMatchKey,
  isUniqueKeyForRows,
  resolveMatchKeyFields,
  applyMasterTableDisplayNormalization,
  getForeignKeyFieldName,
  getDependentFields,
  formatTitle,
  resolveDefaultGroupName,
  parseJoinFrom,
  resolveTableConfigTitles,
  getAvailableLocales,
  isParameterTableSchema,
  isParameterTableAutomationConfig,
  getListResponseRowProperties,
  normalizeGetListResponseToRows,
  isAllowLoadFromDbDisabled,
  isParameterPropertySchemaVisible,
  isTableSchemaVisible,
  normalizeJsonSchemaPropertyTypeForUi,
  getInstanceSchemaRootForTables,
  normalizeTableNameForEtlLookup,
  getInstanceTableJsonSchemaForKey,
  getInstanceTableSchemaColumns,
  getMasterJoinedDisplayColumns,
  buildLowercasedKeyMap,
  resolveComparableLowercasedKeys,
  getSolutionSchemaRootForTables,
  getSolutionTableJsonSchemaForKey,
  pickInstanceDataForEtlPayload,
  getMasterDataTableConfigForKey,
  resolveAlternativeParameterPayloadShapeForTable,
  buildAlternativeParameterInstanceData,
  convertParameterNameValueArraysToObjectsForInstance,
  patchInstanceSchemaRootForParameterTableEtlExport,
  isMasterDataParameterObjectTable,
  filterParameterObjectByVisibleProperties,
  stripInvisibleParameterPropertiesFromInstanceData,
  stripFrontendRowIdsFromInstanceData,
  normalizeMasterListToParameterRows,
  parameterRowsToParameterObject,
  transformJsonSchemaToAutomationFormat,
  displayValueMatchesValueNone,
  resolveDisplayValuesToFkIds,
  getExecutionConfigFromSchemaConfig,
  getPreEtlConfigFields,
  pickPreEtlConfigValues,
  coerceValueToJsonSchemaField,
  coerceSolutionDataBySchema,
} from '@cornflow-ui/core/utils/schemaUtils'

// ─── formatTitle / resolveDefaultGroupName / parseJoinFrom ───────────────────

describe('formatTitle', () => {
  test('capitalizes and joins snake_case words', () => {
    expect(formatTitle('factoria_id')).toBe('Factoria Id')
    expect(formatTitle('name')).toBe('Name')
    expect(formatTitle('')).toBe('')
  })
})

describe('resolveDefaultGroupName', () => {
  test('maps known group keys to i18n keys, otherwise returns the key', () => {
    expect(resolveDefaultGroupName('input-tables')).toBe('table.groups.inputTables')
    expect(resolveDefaultGroupName('output-tables')).toBe('table.groups.outputTables')
    expect(resolveDefaultGroupName('other')).toBe('other')
  })
})

describe('parseJoinFrom', () => {
  test('parses table.field', () => {
    expect(parseJoinFrom('factorias.nombre')).toEqual({
      table: 'factorias',
      field: 'nombre',
    })
  })
  test('returns null for invalid inputs', () => {
    expect(parseJoinFrom('')).toBeNull()
    expect(parseJoinFrom('noseparator')).toBeNull()
    expect(parseJoinFrom('a.b.c')).toBeNull()
    // @ts-expect-error testing non-string
    expect(parseJoinFrom(null)).toBeNull()
  })
})

// ─── Row matching ────────────────────────────────────────────────────────────

describe('orderedRowMatchKeyCandidates', () => {
  test('prioritizes codigo/code/name and ignores id-like keys, sorts rest', () => {
    const result = orderedRowMatchKeyCandidates([
      'id',
      'created_at',
      'zzz',
      'nombre',
      'codigo_factoria',
      'aaa',
    ])
    expect(result[0]).toBe('codigo_factoria')
    expect(result[1]).toBe('nombre')
    expect(result).not.toContain('id')
    expect(result).not.toContain('created_at')
    // rest sorted alphabetically
    expect(result.slice(2)).toEqual(['aaa', 'zzz'])
  })
})

describe('rowMatchKeyPart', () => {
  test('handles null/undefined/object/primitive', () => {
    expect(rowMatchKeyPart(null)).toBe('')
    expect(rowMatchKeyPart(undefined)).toBe('')
    expect(rowMatchKeyPart(42)).toBe('42')
    expect(rowMatchKeyPart('x')).toBe('x')
    expect(rowMatchKeyPart({ a: 1 })).toBe('{"a":1}')
  })
})

describe('buildRowMatchKey', () => {
  test('builds composite key with exact then case-insensitive lookup', () => {
    const row = { Codigo: 'A1', nombre: 'Foo' }
    expect(buildRowMatchKey(row, ['Codigo', 'nombre'])).toBe('A1Foo')
    // case-insensitive fallback
    expect(buildRowMatchKey(row, ['codigo'])).toBe('A1')
  })
  test('returns empty for non-object or empty fields', () => {
    expect(buildRowMatchKey(null, ['a'])).toBe('')
    expect(buildRowMatchKey({ a: 1 }, [])).toBe('')
  })
})

describe('isUniqueKeyForRows', () => {
  test('true when no rows or no fields', () => {
    expect(isUniqueKeyForRows([], ['id'])).toBe(true)
    expect(isUniqueKeyForRows([{ id: 1 }], [])).toBe(true)
  })
  test('detects unique vs duplicate composite keys', () => {
    const rows = [{ codigo: 'A' }, { codigo: 'B' }]
    expect(isUniqueKeyForRows(rows, ['codigo'])).toBe(true)
    const dup = [{ codigo: 'A' }, { codigo: 'A' }]
    expect(isUniqueKeyForRows(dup, ['codigo'])).toBe(false)
  })
})

describe('resolveMatchKeyFields', () => {
  test('falls back to ["id"] when no sample row', () => {
    expect(resolveMatchKeyFields([], [])).toEqual(['id'])
  })
  test('uses configured match fields when all present', () => {
    const data = [{ codigo: 'A', nombre: 'x', extra: 1 }]
    expect(resolveMatchKeyFields(data, [], ['codigo', 'nombre'])).toEqual([
      'codigo',
      'nombre',
    ])
  })
  test('ignores configured match fields when not all present, falls to heuristic', () => {
    const data = [
      { codigo: 'A', nombre: 'x' },
      { codigo: 'B', nombre: 'y' },
    ]
    const result = resolveMatchKeyFields(data, [], ['codigo', 'missing'])
    expect(result).toContain('codigo')
  })
  test('grows to a unique composite key across datasets', () => {
    const instance = [
      { codigo: 'A', nombre: 'x' },
      { codigo: 'A', nombre: 'y' },
    ]
    const master = [
      { codigo: 'A', nombre: 'x' },
      { codigo: 'A', nombre: 'y' },
    ]
    const result = resolveMatchKeyFields(instance, master)
    expect(result.length).toBeGreaterThanOrEqual(1)
    expect(isUniqueKeyForRows(instance, result)).toBe(true)
  })
})

// ─── getExcludedKeysForMasterTableCompare ────────────────────────────────────

describe('getExcludedKeysForMasterTableCompare', () => {
  test('returns empty set without props', () => {
    expect(getExcludedKeysForMasterTableCompare(null).size).toBe(0)
    expect(getExcludedKeysForMasterTableCompare({}).size).toBe(0)
  })
  test('excludes FK columns and backing FK of dependent fields', () => {
    const tableConfig = {
      get_list: {
        response_schema: {
          type: 'array',
          items: {
            properties: {
              factoria_id: { columnsToJoin: ['factoria'], isForeignKey: true },
              factoria: { joinFrom: 'factorias.nombre', isDependentField: true },
              nombre: { type: 'string' },
            },
          },
        },
      },
    }
    const set = getExcludedKeysForMasterTableCompare(tableConfig)
    expect(set.has('factoria_id')).toBe(true)
    expect(set.has('factoria')).toBe(false)
    expect(set.has('nombre')).toBe(false)
  })
})

// ─── applyMasterTableDisplayNormalization ────────────────────────────────────

describe('applyMasterTableDisplayNormalization', () => {
  test('returns rows unchanged when empty or no dictionaries', () => {
    const rows = [{ a: 1 }]
    expect(applyMasterTableDisplayNormalization([], {}, undefined)).toEqual([])
    expect(applyMasterTableDisplayNormalization(rows, {}, undefined)).toBe(rows)
    expect(
      applyMasterTableDisplayNormalization(rows, {}, { dictionaries: {} } as any),
    ).toBe(rows)
  })
  test('fills display field from source dictionary when empty or equal to code', () => {
    const rows = [{ codigo: 'C1', nombre: '' }, { codigo: 'C1', nombre: 'C1' }]
    const fullInstanceData = {
      factorias: [{ codigo: 'C1', nombre: 'Factoria Uno' }],
    }
    const strategy = {
      dictionaries: {
        d1: {
          sourceTable: 'factorias',
          keyField: 'codigo',
          valueField: 'nombre',
          targetFields: ['nombre'],
        },
      },
    } as any
    const out = applyMasterTableDisplayNormalization(
      rows,
      fullInstanceData,
      strategy,
    ) as any[]
    expect(out[0].nombre).toBe('Factoria Uno')
    expect(out[1].nombre).toBe('Factoria Uno')
  })
})

// ─── resolveTableConfigTitles ────────────────────────────────────────────────

describe('resolveTableConfigTitles', () => {
  test('returns input when falsy', () => {
    expect(resolveTableConfigTitles(null, 'en')).toBeNull()
  })
  test('resolves table, group, and nested schema titles', () => {
    const tableConfig = {
      areas: {
        _originalTitle: { en: 'Areas', es: 'Áreas' },
        _originalGroup: { en: 'Input', es: 'Entrada' },
        title: 'old',
        group: 'old',
        get_list: {
          response_schema: {
            _originalTitle: { en: 'Schema', es: 'Esquema' },
            _originalDescription: { en: 'Desc', es: 'Descripción' },
            properties: { name: { _originalTitle: { en: 'Name', es: 'Nombre' } } },
            items: { _originalTitle: { en: 'Item', es: 'Elemento' } },
          },
        },
      },
      empty: null,
    }
    const resolved = resolveTableConfigTitles(tableConfig, 'es')
    expect(resolved.areas.title).toBe('Áreas')
    expect(resolved.areas.group).toBe('Entrada')
    expect(resolved.areas.get_list.response_schema.title).toBe('Esquema')
    expect(resolved.areas.get_list.response_schema.description).toBe('Descripción')
    expect(resolved.areas.get_list.response_schema.properties.name.title).toBe('Nombre')
    expect(resolved.areas.get_list.response_schema.items.title).toBe('Elemento')
  })
})

// ─── FK helpers ──────────────────────────────────────────────────────────────

describe('getForeignKeyFieldName / getDependentFields', () => {
  const schema = {
    properties: {
      factoria_id: { columnsToJoin: ['factoria', 'codigo_factoria'] },
      factoria: { joinFrom: 'factorias.nombre' },
    },
  }
  test('finds FK field for a dependent field', () => {
    expect(getForeignKeyFieldName('factoria', schema)).toBe('factoria_id')
    expect(getForeignKeyFieldName('unknown', schema)).toBeNull()
    expect(getForeignKeyFieldName('factoria', {})).toBeNull()
  })
  test('lists dependent fields for an FK', () => {
    expect(getDependentFields('factoria_id', schema)).toEqual([
      'factoria',
      'codigo_factoria',
    ])
    expect(getDependentFields('missing', schema)).toEqual([])
    expect(getDependentFields('x', {})).toEqual([])
  })
})

// ─── getAvailableLocales ─────────────────────────────────────────────────────

describe('getAvailableLocales', () => {
  test('collects sorted unique locales from a multilingual object', () => {
    // isMultilingualTitle treats any plain object as multilingual, so the
    // multilingual record must be reached directly (an array wrapper lets the
    // recursion descend before hitting the locale-keyed object).
    const obj = [{ es: 'B', en: 'A' }, { fr: 'C', en: 'D' }]
    expect(getAvailableLocales(obj)).toEqual(['en', 'es', 'fr'])
  })
})

// ─── isParameterTableSchema and friends ──────────────────────────────────────

describe('isParameterTableSchema', () => {
  test('true only for object-with-properties non-array schemas', () => {
    expect(isParameterTableSchema({ type: 'object', properties: { a: {} } })).toBe(true)
    expect(isParameterTableSchema({ type: 'array', items: {} })).toBe(false)
    expect(isParameterTableSchema({ type: 'object' })).toBe(false)
    expect(isParameterTableSchema(null)).toBe(false)
  })
})

describe('isParameterTableAutomationConfig', () => {
  test('uses flag or get_list response schema', () => {
    expect(isParameterTableAutomationConfig({ isParameterTable: true })).toBe(true)
    expect(
      isParameterTableAutomationConfig({
        get_list: { response_schema: { type: 'object', properties: { a: {} } } },
      }),
    ).toBe(true)
    expect(isParameterTableAutomationConfig({})).toBe(false)
  })
})

describe('getListResponseRowProperties', () => {
  test('returns null without response schema', () => {
    expect(getListResponseRowProperties(null)).toBeNull()
    expect(getListResponseRowProperties({ get_list: {} })).toBeNull()
  })
  test('returns array items props', () => {
    const cfg = {
      get_list: {
        response_schema: {
          type: 'array',
          items: { properties: { a: {} }, required: ['a'] },
        },
      },
    }
    expect(getListResponseRowProperties(cfg)).toEqual({
      properties: { a: {} },
      required: ['a'],
      order: null,
    })
  })
  test('returns object props for parameter tables', () => {
    const cfg = {
      get_list: { response_schema: { type: 'object', properties: { a: {} } } },
    }
    expect(getListResponseRowProperties(cfg)).toEqual({
      properties: { a: {} },
      required: [],
      order: null,
    })
  })
  test("surfaces the schema's declared column order", () => {
    const onItems = {
      get_list: {
        response_schema: {
          type: 'array',
          items: { properties: { a: {}, b: {} }, required: [], order: ['b', 'a'] },
        },
      },
    }
    expect(getListResponseRowProperties(onItems)!.order).toEqual(['b', 'a'])

    // Also when written one level up, beside `description`.
    const onTable = {
      get_list: {
        response_schema: {
          type: 'array',
          order: ['b', 'a'],
          items: { properties: { a: {}, b: {} }, required: [] },
        },
      },
    }
    expect(getListResponseRowProperties(onTable)!.order).toEqual(['b', 'a'])
  })
})

describe('normalizeGetListResponseToRows', () => {
  const arrayCfg = {
    get_list: {
      response_schema: { type: 'array', items: { properties: { a: {} } } },
    },
  }
  test('handles null, array, primitives', () => {
    expect(normalizeGetListResponseToRows(null, arrayCfg)).toEqual([])
    expect(normalizeGetListResponseToRows([{ a: 1 }], arrayCfg)).toEqual([{ a: 1 }])
    expect(normalizeGetListResponseToRows(42, arrayCfg)).toEqual([])
  })
  test('unwraps results/data/items envelopes', () => {
    expect(normalizeGetListResponseToRows({ results: [{ a: 1 }] }, arrayCfg)).toEqual([
      { a: 1 },
    ])
    expect(normalizeGetListResponseToRows({ data: [{ b: 2 }] }, arrayCfg)).toEqual([
      { b: 2 },
    ])
  })
  test('wraps single object for parameter tables', () => {
    const paramCfg = {
      get_list: { response_schema: { type: 'object', properties: { a: {} } } },
    }
    expect(normalizeGetListResponseToRows({ a: 1 }, paramCfg)).toEqual([{ a: 1 }])
  })
  test('wraps single object for array tables when not paginated envelope', () => {
    expect(normalizeGetListResponseToRows({ a: 1 }, arrayCfg)).toEqual([{ a: 1 }])
  })
})

describe('isAllowLoadFromDbDisabled / isParameterPropertySchemaVisible', () => {
  test('allow_load_from_db', () => {
    expect(isAllowLoadFromDbDisabled({ allow_load_from_db: false })).toBe(true)
    expect(isAllowLoadFromDbDisabled({ allow_load_from_db: true })).toBe(false)
    expect(isAllowLoadFromDbDisabled(null)).toBeFalsy()
    expect(isAllowLoadFromDbDisabled({})).toBe(false)
  })
  test('visible', () => {
    expect(isParameterPropertySchemaVisible({ visible: false })).toBe(false)
    expect(isParameterPropertySchemaVisible({ visible: true })).toBe(true)
    expect(isParameterPropertySchemaVisible({})).toBe(true)
    expect(isParameterPropertySchemaVisible(null)).toBe(true)
  })
})

describe('normalizeJsonSchemaPropertyTypeForUi', () => {
  test('formats and compound types', () => {
    expect(normalizeJsonSchemaPropertyTypeForUi(null)).toBe('string')
    expect(normalizeJsonSchemaPropertyTypeForUi({ format: 'date' })).toBe('date')
    expect(normalizeJsonSchemaPropertyTypeForUi({ format: 'date-time' })).toBe('datetime')
    expect(normalizeJsonSchemaPropertyTypeForUi({ format: 'time' })).toBe('time')
    expect(normalizeJsonSchemaPropertyTypeForUi({ type: ['integer', 'null'] })).toBe('number')
    expect(normalizeJsonSchemaPropertyTypeForUi({ type: 'boolean' })).toBe('boolean')
    expect(normalizeJsonSchemaPropertyTypeForUi({ type: 'string' })).toBe('string')
    expect(normalizeJsonSchemaPropertyTypeForUi({ type: 'object' })).toBe('string')
  })
})

// ─── Instance / solution schema roots ────────────────────────────────────────

describe('getInstanceSchemaRootForTables / getSolutionSchemaRootForTables', () => {
  test('instance variants', () => {
    expect(getInstanceSchemaRootForTables(null)).toBeNull()
    const withInstance = { instance: { properties: { a: {} } } }
    expect(getInstanceSchemaRootForTables(withInstance)).toBe(withInstance.instance)
    const withRoot = { properties: { b: {} } }
    expect(getInstanceSchemaRootForTables(withRoot)).toBe(withRoot)
    expect(getInstanceSchemaRootForTables({ foo: 1 })).toBeNull()
  })
  test('solution variants', () => {
    expect(getSolutionSchemaRootForTables(null)).toBeNull()
    const withSolution = { solution: { properties: { a: {} } } }
    expect(getSolutionSchemaRootForTables(withSolution)).toBe(withSolution.solution)
    const withRoot = { properties: { b: {} } }
    expect(getSolutionSchemaRootForTables(withRoot)).toBe(withRoot)
    expect(getSolutionSchemaRootForTables({ foo: 1 })).toBeNull()
  })
})

describe('normalizeTableNameForEtlLookup', () => {
  test('handles empty, spaces, dashes, camelCase', () => {
    expect(normalizeTableNameForEtlLookup('')).toBe('')
    expect(normalizeTableNameForEtlLookup('My Table')).toBe('my_table')
    expect(normalizeTableNameForEtlLookup('my-table')).toBe('my_table')
    expect(normalizeTableNameForEtlLookup('myTable')).toBe('my_table')
    expect(normalizeTableNameForEtlLookup('ALLCAPS')).toBe('allcaps')
  })
})

describe('getInstanceTableJsonSchemaForKey / getSolutionTableJsonSchemaForKey', () => {
  const instanceSchema = {
    instance: { properties: { my_table: { type: 'array' }, 'other-table': { type: 'object' } } },
  }
  const solutionSchema = {
    solution: { properties: { sol_table: { type: 'array' } } },
  }
  test('exact and normalized lookups for instance', () => {
    expect(getInstanceTableJsonSchemaForKey('', instanceSchema)).toBeNull()
    expect(getInstanceTableJsonSchemaForKey('my_table', instanceSchema)).toEqual({
      type: 'array',
    })
    // normalized match (dash vs underscore)
    expect(getInstanceTableJsonSchemaForKey('other_table', instanceSchema)).toEqual({
      type: 'object',
    })
    expect(getInstanceTableJsonSchemaForKey('nope', instanceSchema)).toBeNull()
    expect(getInstanceTableJsonSchemaForKey('x', {})).toBeNull()
  })
  test('solution lookups', () => {
    expect(getSolutionTableJsonSchemaForKey('', solutionSchema)).toBeNull()
    expect(getSolutionTableJsonSchemaForKey('sol_table', solutionSchema)).toEqual({
      type: 'array',
    })
    expect(getSolutionTableJsonSchemaForKey('nope', solutionSchema)).toBeNull()
  })
})

describe('getInstanceTableSchemaColumns', () => {
  test('handles array, object, and invalid schemas', () => {
    expect(getInstanceTableSchemaColumns(null)).toBeUndefined()
    expect(
      getInstanceTableSchemaColumns({ items: { properties: { a: {}, b: {} } } }),
    ).toEqual(['a', 'b'])
    expect(getInstanceTableSchemaColumns({ properties: { c: {} } })).toEqual(['c'])
    expect(getInstanceTableSchemaColumns({ type: 'string' })).toBeUndefined()
  })
})

describe('getMasterJoinedDisplayColumns', () => {
  test('collects columns_to_join targets', () => {
    expect(getMasterJoinedDisplayColumns(null)).toEqual([])
    const cfg = {
      get_list: {
        response_schema: {
          type: 'array',
          items: {
            properties: {
              factoria_id: { columns_to_join: ['factoria', 'codigo'] },
              puerto_id: { columnsToJoin: ['puerto'] },
              plain: { type: 'string' },
            },
          },
        },
      },
    }
    expect(getMasterJoinedDisplayColumns(cfg)).toEqual(['factoria', 'codigo', 'puerto'])
  })
})

describe('buildLowercasedKeyMap', () => {
  test('lowercases keys', () => {
    const map = buildLowercasedKeyMap({ Name: 'x', AGE: 1 })
    expect(map.get('name')).toBe('x')
    expect(map.get('age')).toBe(1)
    expect(buildLowercasedKeyMap(null).size).toBe(0)
  })
})

describe('resolveComparableLowercasedKeys', () => {
  test('uses allowedColumns and excludes ignored/excluded keys', () => {
    const result = resolveComparableLowercasedKeys({
      allowedColumns: ['Name', 'id', 'FactoriaId'],
      excludedKeys: new Set(['FactoriaId']),
    })
    expect(result).toContain('name')
    expect(result).not.toContain('id')
    expect(result).not.toContain('factoriaid')
  })
  test('uses union of row keys when no allowedColumns', () => {
    const result = resolveComparableLowercasedKeys({
      row1: { A: 1, created_at: 'x' },
      row2: { B: 2 },
    })
    expect(result.sort()).toEqual(['a', 'b'])
  })
})

// ─── pickInstanceDataForEtlPayload ───────────────────────────────────────────

describe('pickInstanceDataForEtlPayload', () => {
  const instanceSchema = { instance: { properties: { areas: {}, shared: {} } } }
  const solutionSchema = { solution: { properties: { result: {}, shared: {} } } }
  test('returns empty for invalid data', () => {
    expect(pickInstanceDataForEtlPayload(null, instanceSchema)).toEqual({})
  })
  test('keeps __metadata__, skips other __keys, drops solution-only keys', () => {
    const data = {
      __metadata__: { v: 1 },
      __other__: { v: 2 },
      areas: [1],
      shared: [2],
      result: [3],
    }
    const out = pickInstanceDataForEtlPayload(data, instanceSchema, solutionSchema)
    expect(out.__metadata__).toEqual({ v: 1 })
    expect(out.__other__).toBeUndefined()
    expect(out.areas).toEqual([1])
    expect(out.shared).toEqual([2])
    expect(out.result).toBeUndefined()
  })
})

describe('getMasterDataTableConfigForKey', () => {
  const masterData = {
    my_table: { get_list: {} },
    'other-table': { get_list: {} },
    no_get: {},
  }
  test('exact and normalized lookups, requires get_list', () => {
    expect(getMasterDataTableConfigForKey(null, 'x')).toBeNull()
    expect(getMasterDataTableConfigForKey(masterData, 'my_table')).toBe(masterData.my_table)
    expect(getMasterDataTableConfigForKey(masterData, 'other_table')).toBe(
      masterData['other-table'],
    )
    expect(getMasterDataTableConfigForKey(masterData, 'no_get')).toBeNull()
    expect(getMasterDataTableConfigForKey(masterData, 'missing')).toBeNull()
  })
})

// ─── Alternative parameter payload shape & build ─────────────────────────────

describe('resolveAlternativeParameterPayloadShapeForTable', () => {
  test('object from instance parameter table schema', () => {
    const instanceSchema = {
      instance: { properties: { params: { type: 'object', properties: { a: {} } } } },
    }
    expect(
      resolveAlternativeParameterPayloadShapeForTable('params', instanceSchema, null),
    ).toBe('object')
  })
  test('arrayNameValue for name/value array items', () => {
    const instanceSchema = {
      instance: {
        properties: {
          eav: {
            type: 'array',
            items: { properties: { name: {}, value: {} } },
          },
        },
      },
    }
    expect(
      resolveAlternativeParameterPayloadShapeForTable('eav', instanceSchema, null),
    ).toBe('arrayNameValue')
  })
  test('arrayWide for generic array tables', () => {
    const instanceSchema = {
      instance: {
        properties: { rows: { type: 'array', items: { properties: { a: {}, b: {}, c: {} } } } },
      },
    }
    expect(
      resolveAlternativeParameterPayloadShapeForTable('rows', instanceSchema, null),
    ).toBe('arrayWide')
  })
  test('falls back to automation config then default arrayWide', () => {
    expect(resolveAlternativeParameterPayloadShapeForTable('x', null, { isParameterTable: true })).toBe(
      'object',
    )
    expect(resolveAlternativeParameterPayloadShapeForTable('x', null, null)).toBe('arrayWide')
  })
})

describe('buildAlternativeParameterInstanceData', () => {
  test('builds object, arrayWide and arrayNameValue shapes', () => {
    const fields = [
      { id: 'f1', instancePath: 'params.alpha', type: 'number' },
      { id: 'f2', instancePath: 'rows.beta', type: 'string' },
      { id: 'f3', instancePath: 'bad', type: 'string' },
    ]
    const values = { f1: '12', f2: 'hello' }
    const instanceSchema = {
      instance: {
        properties: {
          params: { type: 'object', properties: { alpha: {} } },
          rows: { type: 'array', items: { properties: { beta: {}, gamma: {} } } },
        },
      },
    }
    const out = buildAlternativeParameterInstanceData(fields as any, values, instanceSchema, null)
    expect(out.params).toEqual({ alpha: 12 })
    expect(out.rows).toEqual([{ beta: 'hello' }])
    expect(out.bad).toBeUndefined()
  })
})

describe('convertParameterNameValueArraysToObjectsForInstance', () => {
  test('converts name/value arrays for parameter tables only', () => {
    const data = {
      params: [
        { name: 'a', value: 1 },
        { name: 'b', value: 2 },
      ],
      notParam: [{ name: 'x', value: 9 }],
      plain: [{ foo: 1 }],
    }
    const instanceSchema = {
      instance: {
        properties: {
          params: { type: 'object', properties: { a: {} } },
          notParam: { type: 'array', items: {} },
        },
      },
    }
    const out = convertParameterNameValueArraysToObjectsForInstance(data, instanceSchema)
    expect(out.params).toEqual({ a: 1, b: 2 })
    // notParam is not a parameter object table → unchanged
    expect(Array.isArray(out.notParam)).toBe(true)
    expect(out.plain).toBe(data.plain)
  })
  test('returns input for non-object', () => {
    expect(convertParameterNameValueArraysToObjectsForInstance(null as any, {})).toBeNull()
  })
})

describe('patchInstanceSchemaRootForParameterTableEtlExport', () => {
  test('returns root when no properties', () => {
    expect(patchInstanceSchemaRootForParameterTableEtlExport({}, null)).toBeNull()
  })
  test('rewrites parameter tables to array, name/value layout preserved', () => {
    const root = {
      properties: {
        params: { type: 'object', properties: { start_date: {}, end_date: {} }, required: ['start_date'] },
        eav: { type: 'object', properties: { x: {} } },
        untouched: { type: 'array', items: {} },
      },
    }
    const data = {
      params: { start_date: '2020', end_date: '2021' },
      eav: [{ name: 'k', value: 'v' }],
      untouched: [],
    }
    const out = patchInstanceSchemaRootForParameterTableEtlExport(data, root) as any
    expect(out.properties.params.type).toBe('array')
    expect(out.properties.params.items.properties).toEqual({ start_date: {}, end_date: {} })
    expect(out.properties.eav.items.properties).toEqual({
      name: { type: 'string' },
      value: {},
    })
    expect(out.properties.untouched).toBe(root.properties.untouched)
  })
})

describe('isMasterDataParameterObjectTable', () => {
  test('uses automation config or instance schema', () => {
    expect(isMasterDataParameterObjectTable('t', null, null)).toBe(false)
    expect(
      isMasterDataParameterObjectTable('t', { isParameterTable: true }, null),
    ).toBe(true)
    const instanceSchema = {
      instance: { properties: { t: { type: 'object', properties: { a: {} } } } },
    }
    expect(
      isMasterDataParameterObjectTable('t', { foo: 1 }, instanceSchema),
    ).toBe(true)
  })
})

describe('filterParameterObjectByVisibleProperties', () => {
  test('drops invisible props, keeps __keys', () => {
    const instanceSchema = {
      instance: {
        properties: {
          params: { properties: { a: { visible: true }, b: { visible: false } } },
        },
      },
    }
    const objectData = { a: 1, b: 2, c: { visible: false }, d: 4, __meta: 'x' }
    const out = filterParameterObjectByVisibleProperties(objectData, 'params', instanceSchema)
    expect(out.a).toBe(1)
    expect(out.b).toBeUndefined()
    expect(out.c).toBeUndefined()
    expect(out.d).toBe(4)
    expect(out.__meta).toBe('x')
  })
  test('returns empty for invalid input', () => {
    expect(filterParameterObjectByVisibleProperties(null as any, 't', {})).toEqual({})
  })
})

describe('stripInvisibleParameterPropertiesFromInstanceData', () => {
  test('filters parameter-object tables only', () => {
    const instanceSchema = {
      instance: {
        properties: {
          params: { type: 'object', properties: { a: { visible: true }, b: { visible: false } } },
          arr: { type: 'array', items: {} },
        },
      },
    }
    const data = {
      params: { a: 1, b: 2 },
      arr: [{ x: 1 }],
    }
    const out = stripInvisibleParameterPropertiesFromInstanceData(data, instanceSchema)
    expect(out.params).toEqual({ a: 1 })
    expect(out.arr).toEqual([{ x: 1 }])
  })
  test('returns clone when no root props', () => {
    const data = { a: 1 }
    expect(stripInvisibleParameterPropertiesFromInstanceData(data, {})).toEqual({ a: 1 })
    expect(stripInvisibleParameterPropertiesFromInstanceData(null as any, {})).toBeNull()
  })
})

describe('stripFrontendRowIdsFromInstanceData', () => {
  const instanceSchema = {
    properties: {
      products: {
        type: 'array',
        items: { properties: { name: { type: 'string' }, qty: { type: 'number' } } },
      },
      Stations: {
        type: 'array',
        items: { properties: { id: { type: 'integer' }, name: { type: 'string' } } },
      },
      params: { type: 'object', properties: { id: { type: 'string' }, a: {} } },
    },
  }

  test('removes UI row ids from tables whose schema has no id column', () => {
    const data = {
      products: [
        { id: 'products_0_1a2b3c4d5e6f', name: 'A', qty: 1 },
        { id: 'products_9f8e7d6c5b4a', name: 'B', qty: 2 },
      ],
    }
    const out = stripFrontendRowIdsFromInstanceData(data, instanceSchema)
    expect(out.products).toEqual([
      { name: 'A', qty: 1 },
      { name: 'B', qty: 2 },
    ])
  })

  test('keeps id when the table schema declares it (key matched case-insensitively)', () => {
    const data = { stations: [{ id: 7, name: 'S1' }] }
    const out = stripFrontendRowIdsFromInstanceData(data, instanceSchema)
    expect(out.stations).toEqual([{ id: 7, name: 'S1' }])
  })

  test('removes generated ids even when the table schema declares id', () => {
    const data = {
      stations: [
        { id: 7, name: 'S1' },
        { id: 'stations_1_1a2b3c4d5e6f', name: 'S2' },
        { id: 'stations_abcdef012345', name: 'S3' },
      ],
    }
    const out = stripFrontendRowIdsFromInstanceData(data, instanceSchema)
    expect(out.stations).toEqual([
      { id: 7, name: 'S1' },
      { name: 'S2' },
      { name: 'S3' },
    ])
  })

  test('leaves parameter objects and tables missing from the schema untouched', () => {
    const data = {
      params: { id: 'p', a: 1 },
      unknown: [{ id: 'x', v: 1 }],
    }
    const out = stripFrontendRowIdsFromInstanceData(data, instanceSchema)
    expect(out.params).toEqual({ id: 'p', a: 1 })
    expect(out.unknown).toEqual([{ id: 'x', v: 1 }])
  })

  test('removes generated ids from tables with no known schema', () => {
    const data = { unknown: [{ id: 'unknown_0_1a2b3c4d5e6f', v: 1 }, { id: 'x', v: 2 }] }
    expect(stripFrontendRowIdsFromInstanceData(data, instanceSchema).unknown).toEqual([
      { v: 1 },
      { id: 'x', v: 2 },
    ])
    expect(stripFrontendRowIdsFromInstanceData(data, null).unknown).toEqual([
      { v: 1 },
      { id: 'x', v: 2 },
    ])
  })

  test('does not mutate the input data', () => {
    const row = { id: 'products_0_abc', name: 'A', qty: 1 }
    const data = { products: [row] }
    stripFrontendRowIdsFromInstanceData(data, instanceSchema)
    expect(row.id).toBe('products_0_abc')
    expect(data.products[0]).toBe(row)
  })

  test('handles empty values', () => {
    expect(stripFrontendRowIdsFromInstanceData(null as any, instanceSchema)).toBeNull()
    expect(stripFrontendRowIdsFromInstanceData({ products: [] }, instanceSchema)).toEqual({
      products: [],
    })
    expect(stripFrontendRowIdsFromInstanceData({ products: [{ id: 'x' }] }, null)).toEqual({
      products: [{ id: 'x' }],
    })
  })
})

describe('normalizeMasterListToParameterRows', () => {
  test('returns empty for empty data', () => {
    expect(normalizeMasterListToParameterRows([], {})).toEqual([])
  })
  test('key/value rows (multi-row with name)', () => {
    const data = [
      { name: 'p1', value: 10 },
      { name: 'p2', value: 20 },
    ]
    const out = normalizeMasterListToParameterRows(data, {})
    expect(out).toEqual([
      { id: 'p1', parameter: 'p1', value: 10 },
      { id: 'p2', parameter: 'p2', value: 20 },
    ])
  })
  test('single object row expands to per-key rows respecting visibility', () => {
    const cfg = {
      get_list: {
        response_schema: {
          type: 'object',
          properties: { a: { visible: true }, b: { visible: false } },
        },
      },
    }
    const out = normalizeMasterListToParameterRows([{ a: 1, b: 2, id: 9 }], cfg)
    expect(out).toEqual([{ id: 'a', parameter: 'a', value: 1 }])
  })
  test('generic multi-row fallback', () => {
    const out = normalizeMasterListToParameterRows([{ value: 1 }, { value: 2 }], {})
    expect(out[0].parameter).toBe('0')
    expect(out[1].value).toBe(2)
  })
})

describe('parameterRowsToParameterObject', () => {
  test('builds object keyed by parameter/name/key/id', () => {
    const rows = [
      { parameter: 'a', value: 1 },
      { name: 'b', value: 2 },
      { id: 'c', value: 3 },
      null,
      { value: 4 },
    ]
    expect(parameterRowsToParameterObject(rows as any)).toEqual({ a: 1, b: 2, c: 3 })
    expect(parameterRowsToParameterObject(null as any)).toEqual({})
  })
})

// ─── transformJsonSchemaToAutomationFormat ───────────────────────────────────

describe('transformJsonSchemaToAutomationFormat', () => {
  test('returns empty when no properties', () => {
    expect(transformJsonSchemaToAutomationFormat(null, null, 'instance')).toEqual({})
  })
  test('builds array tables, parameter tables and checks', () => {
    const schema = {
      properties: {
        rows: { type: 'array', items: { properties: { a: { type: 'string' } } } },
        params: { type: 'object', properties: { p: { type: 'integer', title: 'P' } }, title: 'Params' },
      },
    }
    const checksSchema = {
      properties: {
        chk: { type: 'array', items: { type: 'string', title: 'C' }, is_warning: true },
      },
    }
    const result = transformJsonSchemaToAutomationFormat(schema, checksSchema, 'instance')
    expect(result.rows.group).toBe('input-tables')
    expect(result.rows.get_list.response_schema.type).toBe('array')
    expect(result.params.isParameterTable).toBe(true)
    expect(result.params.get_list.response_schema.properties.p.type).toBe('number')
    expect(result.chk.group).toBe('validations')
    expect(result.chk.is_warning).toBe(true)
    expect(result.chk.isPrimitiveArray).toBe(true)
  })
  test('leaves out array and parameter tables declared visible: false', () => {
    const schema = {
      properties: {
        shown: { type: 'array', items: { properties: { a: { type: 'string' } } } },
        explicitlyShown: {
          type: 'array',
          visible: true,
          items: { properties: { a: { type: 'string' } } },
        },
        hiddenRows: {
          type: 'array',
          visible: false,
          items: { properties: { a: { type: 'string' } } },
        },
        hiddenParams: {
          type: 'object',
          visible: false,
          properties: { p: { type: 'integer' } },
        },
      },
    }
    const result = transformJsonSchemaToAutomationFormat(schema, null, 'solution')
    expect(Object.keys(result).sort()).toEqual(['explicitlyShown', 'shown'])
  })
})

describe('isTableSchemaVisible', () => {
  test('is false only for an explicit visible: false', () => {
    expect(isTableSchemaVisible({ type: 'array', visible: false })).toBe(false)
    expect(isTableSchemaVisible({ type: 'array', visible: true })).toBe(true)
    expect(isTableSchemaVisible({ type: 'array' })).toBe(true)
    expect(isTableSchemaVisible(undefined)).toBe(true)
  })
})

// ─── displayValueMatchesValueNone ────────────────────────────────────────────

describe('displayValueMatchesValueNone', () => {
  test('matches multilingual or string value_none titles', () => {
    expect(displayValueMatchesValueNone('ALL', { valueNone: { title: { en: 'ALL', es: 'TODOS' } } })).toBe(
      true,
    )
    expect(displayValueMatchesValueNone('todos', { value_none: { title: { es: 'TODOS' } } })).toBe(true)
    expect(displayValueMatchesValueNone('Other', { valueNone: { title: 'ALL' } })).toBe(false)
    expect(displayValueMatchesValueNone(null, { valueNone: { title: 'ALL' } })).toBe(false)
    expect(displayValueMatchesValueNone('ALL', null)).toBe(false)
    expect(displayValueMatchesValueNone('ALL', {})).toBe(false)
  })
})

// ─── resolveDisplayValuesToFkIds (async) ─────────────────────────────────────

describe('resolveDisplayValuesToFkIds', () => {
  const tableConfig = {
    get_list: {
      response_schema: {
        type: 'array',
        items: {
          properties: {
            factoria_id: { columnsToJoin: ['factoria'] },
            factoria: {
              joinFrom: 'factorias.nombre',
              isDependentField: true,
              valueNone: { title: { en: 'ALL' } },
            },
            plain: { type: 'string' },
          },
        },
      },
    },
  }
  const loadTableData = async (table: string) => {
    if (table === 'factorias') {
      return [{ id: 7, nombre: 'Factoria Uno' }]
    }
    return []
  }
  test('returns shallow copy when no properties', async () => {
    const payload = { a: 1 }
    const out = await resolveDisplayValuesToFkIds(payload, {}, loadTableData)
    expect(out).toEqual({ a: 1 })
    expect(out).not.toBe(payload)
  })
  test('resolves display value to FK id', async () => {
    const out = await resolveDisplayValuesToFkIds(
      { factoria: 'Factoria Uno', plain: 'x' },
      tableConfig,
      loadTableData,
    )
    expect(out.factoria_id).toBe(7)
    expect(out.factoria).toBeUndefined()
    expect(out.plain).toBe('x')
  })
  test('value_none sets FK null', async () => {
    const out = await resolveDisplayValuesToFkIds({ factoria: 'ALL' }, tableConfig, loadTableData)
    expect(out.factoria_id).toBeNull()
    expect(out.factoria).toBeUndefined()
  })
  test('empty display sets FK null', async () => {
    const out = await resolveDisplayValuesToFkIds({ factoria: '' }, tableConfig, loadTableData)
    expect(out.factoria_id).toBeNull()
  })
})

// ─── getExecutionConfigFromSchemaConfig ──────────────────────────────────────

describe('getExecutionConfigFromSchemaConfig', () => {
  test('returns null for invalid config', () => {
    expect(getExecutionConfigFromSchemaConfig(null)).toBeNull()
    expect(getExecutionConfigFromSchemaConfig({})).toBeNull()
  })
  test('builds solver config and config fields', () => {
    const schemaConfig = {
      properties: {
        solver: { enum: ['cbc', 'gurobi'], default: 'gurobi' },
        msg: { type: 'string' },
        timeLimit: { type: 'number', minutes: true },
        otherTime: { type: 'integer' },
        mode: { type: 'string', enum: ['a', 'b'] },
        flag: { type: 'boolean', default: false },
      },
    }
    const result = getExecutionConfigFromSchemaConfig(schemaConfig)!
    expect(result.executionSolvers).toEqual(['cbc', 'gurobi'])
    expect(result.solverConfig.defaultSolver).toBe('gurobi')
    const keys = result.configFields.map((f) => f.key)
    expect(keys).not.toContain('solver')
    expect(keys).not.toContain('msg')
    const timeLimit = result.configFields.find((f) => f.key === 'timeLimit')!
    expect(timeLimit.minutes).toBe(true)
    expect(timeLimit.suffix).toBe('configParams.minutesSuffix')
    const mode = result.configFields.find((f) => f.key === 'mode')!
    expect(mode.type).toBe('select')
    expect(mode.options).toEqual([
      { value: 'a', label: 'a' },
      { value: 'b', label: 'b' },
    ])
    const flag = result.configFields.find((f) => f.key === 'flag')!
    expect(flag.type).toBe('boolean')
    expect(flag.default).toBe(false)
  })
  test('default solver when no solver prop', () => {
    const result = getExecutionConfigFromSchemaConfig({ properties: { x: { type: 'string' } } })!
    expect(result.solverConfig.defaultSolver).toBe('MIPModel.gurobi')
  })
  test('carries pre_etl, required and date-format fields', () => {
    const schemaConfig = {
      properties: {
        horizon_days: { type: 'integer', default: 1, pre_etl: true },
        date: { type: ['string', 'null'], format: 'date', pre_etl: true },
        n_scenarios: { type: 'integer' },
        plain: { type: 'string' },
      },
      required: ['n_scenarios'],
    }
    const fields = getExecutionConfigFromSchemaConfig(schemaConfig)!.configFields
    const byKey = Object.fromEntries(fields.map((f) => [f.key, f]))

    expect(byKey.horizon_days.preEtl).toBe(true)
    expect(byKey.date.preEtl).toBe(true)
    expect(byKey.n_scenarios.preEtl).toBeUndefined()

    // Only the root `required` list marks a field as mandatory.
    expect(byKey.n_scenarios.required).toBe(true)
    expect(byKey.horizon_days.required).toBeUndefined()

    // `format: date` is what tells a date apart from any other string.
    expect(byKey.date.type).toBe('date')
    expect(byKey.date.icon).toBe('mdi-calendar')
    expect(byKey.plain.type).toBe('text')
  })
})

// ─── pre-ETL config selectors ───────────────────────────────────────────────

describe('getPreEtlConfigFields / pickPreEtlConfigValues', () => {
  const fields = [
    { key: 'horizon_days', title: '', type: 'number', preEtl: true },
    { key: 'date', title: '', type: 'date', preEtl: true },
    { key: 'n_scenarios', title: '', type: 'number' },
  ]

  test('selects only the fields the schema marked pre_etl', () => {
    expect(getPreEtlConfigFields(fields).map((f) => f.key)).toEqual([
      'horizon_days',
      'date',
    ])
    expect(getPreEtlConfigFields(null)).toEqual([])
  })

  test('picks the pre-ETL values out of an execution config', () => {
    expect(
      pickPreEtlConfigValues(
        { horizon_days: 3, date: '2026-09-28', n_scenarios: 10 },
        fields,
      ),
    ).toEqual({ horizon_days: 3, date: '2026-09-28' })
  })

  test('drops empty values instead of sending them blank', () => {
    // A loose form field cannot carry null, so an unset parameter is left out and the
    // backend reads that as "not given" rather than as an empty value.
    expect(
      pickPreEtlConfigValues(
        { horizon_days: 1, date: null, other: undefined },
        [...fields, { key: 'other', title: '', type: 'text', preEtl: true }],
      ),
    ).toEqual({ horizon_days: 1 })
    expect(pickPreEtlConfigValues({ date: '' }, fields)).toEqual({})
    expect(pickPreEtlConfigValues(null, fields)).toEqual({})
  })

  test('keeps falsy values that are real answers', () => {
    const boolFields = [{ key: 'flag', title: '', type: 'boolean', preEtl: true }]
    expect(pickPreEtlConfigValues({ flag: false }, boolFields)).toEqual({
      flag: false,
    })
  })
})

// ─── coerceValueToJsonSchemaField / coerceSolutionDataBySchema ───────────────

describe('coerceValueToJsonSchemaField', () => {
  test('returns value when no types', () => {
    expect(coerceValueToJsonSchemaField('x', {})).toBe('x')
  })
  test('null handling with nullable types', () => {
    expect(coerceValueToJsonSchemaField('', { type: ['number', 'null'] })).toBeNull()
    expect(coerceValueToJsonSchemaField(undefined, { type: ['string', 'null'] })).toBeNull()
    expect(coerceValueToJsonSchemaField(null, { type: 'string' })).toBeNull()
  })
  test('numeric coercion', () => {
    expect(coerceValueToJsonSchemaField('12.5', { type: 'number' })).toBe(12.5)
    expect(coerceValueToJsonSchemaField('12.5', { type: 'integer' })).toBe(12)
    expect(coerceValueToJsonSchemaField(3.9, { type: 'integer' })).toBe(3)
    expect(coerceValueToJsonSchemaField(true, { type: 'number' })).toBe(1)
    expect(coerceValueToJsonSchemaField('abc', { type: 'number' })).toBe('abc')
    expect(coerceValueToJsonSchemaField('', { type: 'number' })).toBe('')
  })
  test('boolean coercion', () => {
    expect(coerceValueToJsonSchemaField('true', { type: 'boolean' })).toBe(true)
    expect(coerceValueToJsonSchemaField('0', { type: 'boolean' })).toBe(false)
    expect(coerceValueToJsonSchemaField(1, { type: 'boolean' })).toBe(true)
  })
  test('string coercion', () => {
    expect(coerceValueToJsonSchemaField(42, { type: 'string' })).toBe('42')
    expect(coerceValueToJsonSchemaField('keep', { type: 'string' })).toBe('keep')
  })
})

describe('coerceSolutionDataBySchema', () => {
  test('returns input for invalid', () => {
    expect(coerceSolutionDataBySchema(null as any, {})).toBeNull()
    expect(coerceSolutionDataBySchema({ a: 1 }, null)).toEqual({ a: 1 })
  })
  test('coerces array tables by items schema, skips __keys and non-arrays', () => {
    const solutionData = {
      __meta: { skip: true },
      result: [{ qty: '5', name: 'x' }],
      scalar: 3,
    }
    const solutionSchema = {
      properties: {
        result: { items: { properties: { qty: { type: 'integer' }, name: { type: 'string' } } } },
      },
    }
    const out = coerceSolutionDataBySchema(solutionData, solutionSchema)
    expect(out.result).toEqual([{ qty: 5, name: 'x' }])
    expect(out.__meta).toEqual({ skip: true })
    expect(out.scalar).toBe(3)
  })
})
