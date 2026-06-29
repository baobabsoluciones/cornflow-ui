import { describe, expect, it } from 'vitest'
import {
  toUrlFriendly,
  fromUrlFriendly,
  getGroupsFromConfig,
  getNavigationItemsFromConfig,
  normalizeTableKeyForHierarchyMatch,
  getMasterDataTableRankByDrawerHierarchy,
  getInstanceTableKeysOrderedByMasterHierarchy,
  getMasterDataNavigationWithSections,
  getGetListQueryParameters,
  getGlobalSearchQueryParameterName,
  filterTypeMatchesUiOperator,
  getDateRangeFilterConfigs,
  getDefaultListQueryParams,
  getDefaultListLimit,
  getListDeclaresLimitParam,
  getListDeclaresOffsetParam,
  getOperationConfig,
  isOperationSupported,
  getSupportedOperations,
  getSectionType,
  isFrontendAutomationRoute,
  isExecutionDataSectionRoute,
  hasValidationTableData,
  filterValidationTablesWithData,
  enrichConfigWithChecksData,
  isValidationGroup,
  isValidationLikeGroup,
  getConfigurationBySection,
  isTableVisibleInCurrentSchema,
  filterTablesByCurrentSchema,
  canUserAccessTable,
  filterTablesByUserSchemas,
  filterConfigurationsByUserSchemas,
} from '@/services/FrontendAutomationService'
import { TableOperation } from '@/types/table'

// ---------------------------------------------------------------------------
// toUrlFriendly
// ---------------------------------------------------------------------------
describe('toUrlFriendly', () => {
  it('lowercases and replaces spaces with hyphens', () => {
    expect(toUrlFriendly('Hello World')).toBe('hello-world')
  })

  it('removes special characters except hyphens and underscores', () => {
    expect(toUrlFriendly('Café & Bar!')).toBe('caf-bar')
  })

  it('collapses multiple hyphens into one', () => {
    expect(toUrlFriendly('a   b')).toBe('a-b')
  })

  it('removes leading and trailing hyphens', () => {
    expect(toUrlFriendly('  spaced  ')).toBe('spaced')
  })

  it('keeps underscores', () => {
    expect(toUrlFriendly('my_table_name')).toBe('my_table_name')
  })

  it('returns empty string for only-special input', () => {
    expect(toUrlFriendly('!!!')).toBe('')
  })
})

// ---------------------------------------------------------------------------
// fromUrlFriendly
// ---------------------------------------------------------------------------
describe('fromUrlFriendly', () => {
  const config: any = {
    My_Table: { title: 'My Table', group: null },
    other: { title: 'Some Other Title', group: null },
  }

  it('finds key by url-friendly key match', () => {
    expect(fromUrlFriendly('my_table', config)).toBe('My_Table')
  })

  it('finds key by url-friendly title match', () => {
    expect(fromUrlFriendly('some-other-title', config)).toBe('other')
  })

  it('returns the input unchanged when no match', () => {
    expect(fromUrlFriendly('nonexistent', config)).toBe('nonexistent')
  })
})

// ---------------------------------------------------------------------------
// getGroupsFromConfig
// ---------------------------------------------------------------------------
describe('getGroupsFromConfig', () => {
  it('puts null-group tables under "null" with per-table routes', () => {
    const config: any = {
      tableA: { title: 'Table A', group: null },
    }
    const groups = getGroupsFromConfig(config)
    expect(groups.null).toHaveLength(1)
    expect(groups.null[0]).toEqual({
      key: 'tableA',
      title: 'Table A',
      to: '/configuration/tablea',
    })
  })

  it('groups non-null tables under shared group route', () => {
    const config: any = {
      t1: { title: 'T1', group: 'Sales' },
      t2: { title: 'T2', group: 'Sales' },
    }
    const groups = getGroupsFromConfig(config)
    expect(groups.Sales).toHaveLength(2)
    expect(groups.Sales[0].to).toBe('/configuration/group/sales')
  })

  it('uses _groupKey when present', () => {
    const config: any = {
      t1: { title: 'T1', group: 'Sales', _groupKey: 'sales-group' },
    }
    const groups = getGroupsFromConfig(config)
    expect(groups['sales-group']).toBeDefined()
    expect(groups['sales-group'][0].to).toBe('/configuration/group/sales-group')
  })
})

// ---------------------------------------------------------------------------
// getNavigationItemsFromConfig
// ---------------------------------------------------------------------------
describe('getNavigationItemsFromConfig', () => {
  it('builds nav items for null group tables sorted by order', () => {
    const config: any = {
      a: { title: 'A', group: null, order: 2, icon: 'mdi-a' },
      b: { title: 'B', group: null, order: 1 },
    }
    const items = getNavigationItemsFromConfig(config)
    expect(items[0].title).toBe('B') // lower order first
    expect(items[1].title).toBe('A')
    expect(items[1].icon).toBe('mdi-a')
    expect(items[0].icon).toBe('mdi-table') // default icon
  })

  it('builds grouped nav items with subPages', () => {
    const config: any = {
      t1: { title: 'T1', group: 'Sales', order: 2, icon: 'mdi-sales' },
      t2: { title: 'T2', group: 'Sales', order: 1 },
    }
    const items = getNavigationItemsFromConfig(config)
    expect(items).toHaveLength(1)
    const group = items[0]
    expect(group.title).toBe('Sales')
    expect(group.icon).toBe('mdi-folder-table') // first sorted table (t2) has no icon -> group default
    expect(group.subPages).toHaveLength(2)
    // sorted: t2 (order 1) then t1 (order 2)
    expect(group.subPages![0].key).toBe('t2')
    expect(group.subPages![0].to).toContain('/configuration/group/sales/t2')
  })

  it('applies basePath replacement', () => {
    const config: any = {
      a: { title: 'A', group: null },
    }
    const items = getNavigationItemsFromConfig(config, '/results')
    expect(items[0].to).toBe('/results/a')
  })

  it('uses groupOrder to order groups', () => {
    const config: any = {
      x: { title: 'X', group: 'GroupX' },
      y: { title: 'Y', group: 'GroupY' },
    }
    const items = getNavigationItemsFromConfig(config, '/configuration', [
      { id: 'GroupY', order: 1 },
      { id: 'GroupX', order: 2 },
    ])
    expect(items[0].title).toBe('GroupY')
    expect(items[1].title).toBe('GroupX')
  })

  it('buckets validation groups last for /results basePath', () => {
    const config: any = {
      reg: { title: 'Regular', group: null, order: 1 },
      val: { title: 'Val', group: 'Validations', order: 1 },
    }
    const items = getNavigationItemsFromConfig(config, '/results')
    // regular (bucket 1) before validation (bucket 3)
    const titles = items.map((i) => i.title)
    expect(titles.indexOf('Regular')).toBeLessThan(titles.indexOf('Validations'))
  })

  it('buckets rawKpis tables in bucket 2 for /results', () => {
    const config: any = {
      kpi: { title: 'Kpi', group: null, order: 1, _isFromRawKpis: true },
      val: { title: 'Val', group: 'Validations', order: 1 },
      reg: { title: 'Regular', group: null, order: 1 },
    }
    const items = getNavigationItemsFromConfig(config, '/results')
    const titles = items.map((i) => i.title)
    // bucket order: Regular(1) < Kpi(2) < Val(3)
    expect(titles.indexOf('Regular')).toBeLessThan(titles.indexOf('Kpi'))
    expect(titles.indexOf('Kpi')).toBeLessThan(titles.indexOf('Validations'))
  })

  it('uses group resolved title from first table config when present', () => {
    const config: any = {
      t1: { title: 'T1', group: 'Operaciones', _groupKey: 'ops' },
    }
    const items = getNavigationItemsFromConfig(config)
    expect(items[0].title).toBe('Operaciones')
  })
})

// ---------------------------------------------------------------------------
// normalizeTableKeyForHierarchyMatch
// ---------------------------------------------------------------------------
describe('normalizeTableKeyForHierarchyMatch', () => {
  it('lowercases and strips dashes/underscores', () => {
    expect(normalizeTableKeyForHierarchyMatch('My_Table-Name')).toBe('mytablename')
  })

  it('handles empty/undefined input', () => {
    expect(normalizeTableKeyForHierarchyMatch('')).toBe('')
    // @ts-expect-error testing falsy
    expect(normalizeTableKeyForHierarchyMatch(undefined)).toBe('')
  })
})

// ---------------------------------------------------------------------------
// getMasterDataTableRankByDrawerHierarchy
// ---------------------------------------------------------------------------
describe('getMasterDataTableRankByDrawerHierarchy', () => {
  it('returns empty map for empty config', () => {
    expect(getMasterDataTableRankByDrawerHierarchy({} as any).size).toBe(0)
    expect(getMasterDataTableRankByDrawerHierarchy(null as any).size).toBe(0)
  })

  it('ranks tables by group order then table order (no sections)', () => {
    const config: any = {
      b: { title: 'B', group: 'G1', order: 2 },
      a: { title: 'A', group: 'G1', order: 1 },
      c: { title: 'C', group: 'G2', order: 1 },
    }
    const rank = getMasterDataTableRankByDrawerHierarchy(config, undefined, [
      { id: 'G1', order: 1 },
      { id: 'G2', order: 2 },
    ])
    expect(rank.get('a')).toBe(0)
    expect(rank.get('b')).toBe(1)
    expect(rank.get('c')).toBe(2)
  })

  it('ranks across explicit sections plus trailing no-section block', () => {
    const config: any = {
      inSec: { title: 'InSec', group: 'G1', section: 's1', order: 1 },
      noSec: { title: 'NoSec', group: 'G1', order: 1 },
    }
    const rank = getMasterDataTableRankByDrawerHierarchy(
      config,
      [{ id: 's1', title: 'Section 1' }],
      [],
    )
    expect(rank.get('insec')).toBe(0)
    expect(rank.get('nosec')).toBe(1)
  })

  it('falls back to first-seen index when group orders tie', () => {
    const config: any = {
      first: { title: 'F', group: 'Galpha', order: 1 },
      second: { title: 'S', group: 'Gbeta', order: 1 },
    }
    const rank = getMasterDataTableRankByDrawerHierarchy(config)
    // both groups order 999 -> tie -> first-seen wins
    expect(rank.get('first')).toBe(0)
    expect(rank.get('second')).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// getInstanceTableKeysOrderedByMasterHierarchy
// ---------------------------------------------------------------------------
describe('getInstanceTableKeysOrderedByMasterHierarchy', () => {
  const masterConfig: any = {
    alpha: { title: 'Alpha', group: 'G', order: 1 },
    beta: { title: 'Beta', group: 'G', order: 2 },
  }

  it('returns [] for empty/invalid instance keys', () => {
    expect(getInstanceTableKeysOrderedByMasterHierarchy([], masterConfig)).toEqual([])
    expect(
      getInstanceTableKeysOrderedByMasterHierarchy(null as any, masterConfig),
    ).toEqual([])
  })

  it('returns copy of keys when master config empty', () => {
    expect(
      getInstanceTableKeysOrderedByMasterHierarchy(['x', 'y'], {} as any),
    ).toEqual(['x', 'y'])
  })

  it('orders matched keys by hierarchy, unmatched keep order after', () => {
    const result = getInstanceTableKeysOrderedByMasterHierarchy(
      ['unknown', 'beta', 'alpha'],
      masterConfig,
    )
    expect(result).toEqual(['alpha', 'beta', 'unknown'])
  })

  it('returns copy of keys when no keys match', () => {
    const result = getInstanceTableKeysOrderedByMasterHierarchy(
      ['zzz', 'qqq'],
      masterConfig,
    )
    expect(result).toEqual(['zzz', 'qqq'])
  })

  it('returns copy when rank map is empty (config keys exist but no groups produce ranks is impossible) -> covered by empty config path', () => {
    // rankByKey.size === 0 path: pass config with no entries via {}? handled above.
    expect(
      getInstanceTableKeysOrderedByMasterHierarchy(['a'], { } as any),
    ).toEqual(['a'])
  })
})

// ---------------------------------------------------------------------------
// getMasterDataNavigationWithSections
// ---------------------------------------------------------------------------
describe('getMasterDataNavigationWithSections', () => {
  it('returns [] when no sections', () => {
    expect(getMasterDataNavigationWithSections({} as any, [])).toEqual([])
    expect(
      getMasterDataNavigationWithSections({} as any, undefined as any),
    ).toEqual([])
  })

  it('builds blocks per section plus a no-section block', () => {
    const config: any = {
      a: { title: 'A', group: null, section: 's1' },
      b: { title: 'B', group: null },
    }
    const result = getMasterDataNavigationWithSections(config, [
      { id: 's1', title: { en: 'Section 1' }, icon: 'mdi-x' },
    ])
    expect(result).toHaveLength(2)
    expect(result[0].sectionId).toBe('s1')
    expect(result[0].icon).toBe('mdi-x')
    expect(result[1].sectionId).toBeNull()
    expect(result[1].title).toBe('masterData')
    expect(result[1].icon).toBe('mdi-database')
  })

  it('skips sections with no matching tables', () => {
    const config: any = {
      a: { title: 'A', group: null, section: 's1' },
    }
    const result = getMasterDataNavigationWithSections(config, [
      { id: 's1', title: 'S1' },
      { id: 'empty', title: 'Empty' },
    ])
    expect(result.map((r) => r.sectionId)).toEqual(['s1'])
  })

  it('uses default icon when section icon missing', () => {
    const config: any = { a: { title: 'A', group: null, section: 's1' } }
    const result = getMasterDataNavigationWithSections(config, [
      { id: 's1', title: 'S1' },
    ])
    expect(result[0].icon).toBe('mdi-folder')
  })

  it('omits no-section block when all tables have a section', () => {
    const config: any = { a: { title: 'A', group: null, section: 's1' } }
    const result = getMasterDataNavigationWithSections(config, [
      { id: 's1', title: 'S1' },
    ])
    expect(result).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// getGetListQueryParameters
// ---------------------------------------------------------------------------
describe('getGetListQueryParameters', () => {
  it('returns [] when parameters missing or not array', () => {
    expect(getGetListQueryParameters({})).toEqual([])
    expect(getGetListQueryParameters({ parameters: undefined })).toEqual([])
    expect(
      getGetListQueryParameters({ parameters: 'bad' as any }),
    ).toEqual([])
  })

  it('keeps query params and params with no "in" (default query), drops others', () => {
    const result = getGetListQueryParameters({
      parameters: [
        { name: 'q', in: 'query' },
        { name: 'noIn' } as any,
        { name: 'id', in: 'path' as any },
      ],
    })
    expect(result.map((p) => p.name)).toEqual(['q', 'noIn'])
  })
})

// ---------------------------------------------------------------------------
// getGlobalSearchQueryParameterName
// ---------------------------------------------------------------------------
describe('getGlobalSearchQueryParameterName', () => {
  it('returns name for a global string filter with empty filters_on', () => {
    const name = getGlobalSearchQueryParameterName({
      parameters: [
        {
          name: 'search',
          in: 'query',
          is_filter: true,
          filter_info: { filters_on: null, filter_type: 'string_contains' },
        },
      ],
    })
    expect(name).toBe('search')
  })

  it('skips filters bound to a specific column', () => {
    const name = getGlobalSearchQueryParameterName({
      parameters: [
        {
          name: 'foo',
          in: 'query',
          is_filter: true,
          filter_info: { filters_on: 'col', filter_type: 'string_contains' },
        },
      ],
    })
    expect(name).toBeNull()
  })

  it('skips non-filter params and unsupported filter types', () => {
    const name = getGlobalSearchQueryParameterName({
      parameters: [
        { name: 'a', in: 'query' },
        {
          name: 'b',
          in: 'query',
          is_filter: true,
          filter_info: { filters_on: '', filter_type: 'numeric_eq' },
        },
      ],
    })
    expect(name).toBeNull()
  })

  it('treats whitespace filters_on as empty and matches any_column_contains', () => {
    const name = getGlobalSearchQueryParameterName({
      parameters: [
        {
          name: 'g',
          in: 'query',
          is_filter: true,
          filter_info: { filters_on: '   ', filter_type: 'any_column_contains' },
        },
      ],
    })
    expect(name).toBe('g')
  })
})

// ---------------------------------------------------------------------------
// filterTypeMatchesUiOperator
// ---------------------------------------------------------------------------
describe('filterTypeMatchesUiOperator', () => {
  it('value_is_none never matches', () => {
    expect(filterTypeMatchesUiOperator('value_is_none', 'is', 'single')).toBe(false)
  })

  it('contains operator', () => {
    expect(filterTypeMatchesUiOperator('string_contains', 'contains', 'single')).toBe(true)
    expect(filterTypeMatchesUiOperator('string', 'contains', 'single')).toBe(true)
    expect(filterTypeMatchesUiOperator('numeric_eq', 'contains', 'single')).toBe(false)
  })

  it('is operator requires single role', () => {
    expect(filterTypeMatchesUiOperator('string_eq', 'is', 'single')).toBe(true)
    expect(filterTypeMatchesUiOperator('boolean', 'is', 'single')).toBe(true)
    expect(filterTypeMatchesUiOperator('string_eq', 'is', 'range_gte')).toBe(false)
  })

  it('is_not operator covers explicit and _not_eq suffix', () => {
    expect(filterTypeMatchesUiOperator('string_not_eq', 'is_not', 'single')).toBe(true)
    expect(filterTypeMatchesUiOperator('numeric_ne', 'is_not', 'single')).toBe(true)
    expect(filterTypeMatchesUiOperator('foo_not_eq', 'is_not', 'single')).toBe(true)
    expect(filterTypeMatchesUiOperator('string_not_eq', 'is_not', 'range_gte')).toBe(false)
  })

  it('is_between maps gte/lte roles', () => {
    expect(filterTypeMatchesUiOperator('numeric_gte', 'is_between', 'range_gte')).toBe(true)
    expect(filterTypeMatchesUiOperator('datetime_lte', 'is_between', 'range_lte')).toBe(true)
    expect(filterTypeMatchesUiOperator('numeric_gte', 'is_between', 'single')).toBe(false)
    expect(filterTypeMatchesUiOperator('numeric_lte', 'is_between', 'range_gte')).toBe(false)
  })

  it('has_any_value maps value_is_not_none', () => {
    expect(filterTypeMatchesUiOperator('value_is_not_none', 'has_any_value', 'single')).toBe(true)
    expect(filterTypeMatchesUiOperator('string', 'has_any_value', 'single')).toBe(false)
  })

  it('default branch returns true only for single role', () => {
    expect(filterTypeMatchesUiOperator('string', 'unknown_op', 'single')).toBe(true)
    expect(filterTypeMatchesUiOperator('string', 'unknown_op', 'range_gte')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// getDateRangeFilterConfigs
// ---------------------------------------------------------------------------
describe('getDateRangeFilterConfigs', () => {
  it('returns [] when no parameters', () => {
    expect(getDateRangeFilterConfigs({})).toEqual([])
  })

  it('builds a config for a symmetric datetime range on "fecha"', () => {
    const result = getDateRangeFilterConfigs({
      parameters: [
        {
          name: 'fecha_gte',
          is_filter: true,
          filter_info: {
            filters_on: 'fecha',
            filter_type: 'datetime_gte',
            symmetric: 'fecha_lte',
          },
        },
        {
          name: 'fecha_lte',
          is_filter: true,
          filter_info: { filters_on: 'fecha', filter_type: 'datetime_lte' },
        },
      ],
    })
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      paramGte: 'fecha_gte',
      paramLte: 'fecha_lte',
      filtersOn: 'fecha',
      label: 'Fecha',
    })
  })

  it('skips ranges where filters_on is not "fecha"', () => {
    const result = getDateRangeFilterConfigs({
      parameters: [
        {
          name: 'creado_gte',
          is_filter: true,
          filter_info: {
            filters_on: 'f_creacion',
            filter_type: 'datetime_gte',
            symmetric: 'creado_lte',
          },
        },
        {
          name: 'creado_lte',
          is_filter: true,
          filter_info: { filters_on: 'f_creacion', filter_type: 'datetime_lte' },
        },
      ],
    })
    expect(result).toEqual([])
  })

  it('ignores gte without a matching lte symmetric', () => {
    const result = getDateRangeFilterConfigs({
      parameters: [
        {
          name: 'fecha_gte',
          is_filter: true,
          filter_info: {
            filters_on: 'fecha',
            filter_type: 'datetime_gte',
            symmetric: 'missing',
          },
        },
      ],
    })
    expect(result).toEqual([])
  })

  it('skips non-filter params', () => {
    const result = getDateRangeFilterConfigs({
      parameters: [{ name: 'x', is_filter: false } as any],
    })
    expect(result).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// getDefaultListQueryParams
// ---------------------------------------------------------------------------
describe('getDefaultListQueryParams', () => {
  it('returns only params with defaults', () => {
    const result = getDefaultListQueryParams({
      parameters: [
        { name: 'limit', in: 'query', default: 500 },
        { name: 'offset', in: 'query', default: 0 },
        { name: 'q', in: 'query' },
        { name: 'nullable', in: 'query', default: null as any },
      ],
    })
    expect(result).toEqual({ limit: 500, offset: 0 })
  })

  it('returns {} for no parameters', () => {
    expect(getDefaultListQueryParams({})).toEqual({})
  })
})

// ---------------------------------------------------------------------------
// getDefaultListLimit
// ---------------------------------------------------------------------------
describe('getDefaultListLimit', () => {
  it('returns limit by param name', () => {
    expect(
      getDefaultListLimit({ parameters: [{ name: 'limit', default: 200 }] }),
    ).toBe(200)
  })

  it('returns limit by filter_type', () => {
    expect(
      getDefaultListLimit({
        parameters: [
          {
            name: 'max',
            is_filter: true,
            filter_info: { filter_type: 'limit' },
            default: 100,
          },
        ],
      }),
    ).toBe(100)
  })

  it('coerces string default to number', () => {
    expect(
      getDefaultListLimit({
        parameters: [{ name: 'limit', default: '50' }],
      }),
    ).toBe(50)
  })

  it('returns null for non-positive or non-integer default', () => {
    expect(
      getDefaultListLimit({ parameters: [{ name: 'limit', default: 0 }] }),
    ).toBeNull()
    expect(
      getDefaultListLimit({ parameters: [{ name: 'limit', default: 1.5 }] }),
    ).toBeNull()
  })

  it('returns null when no limit param present', () => {
    expect(
      getDefaultListLimit({ parameters: [{ name: 'q' }] }),
    ).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// getListDeclaresLimitParam / getListDeclaresOffsetParam
// ---------------------------------------------------------------------------
describe('getListDeclaresLimitParam', () => {
  it('true by name', () => {
    expect(getListDeclaresLimitParam({ parameters: [{ name: 'limit' }] })).toBe(true)
  })
  it('true by filter_type', () => {
    expect(
      getListDeclaresLimitParam({
        parameters: [
          { name: 'x', is_filter: true, filter_info: { filter_type: 'limit' } },
        ],
      }),
    ).toBe(true)
  })
  it('false otherwise', () => {
    expect(getListDeclaresLimitParam({ parameters: [{ name: 'q' }] })).toBe(false)
  })
})

describe('getListDeclaresOffsetParam', () => {
  it('true by name', () => {
    expect(getListDeclaresOffsetParam({ parameters: [{ name: 'offset' }] })).toBe(true)
  })
  it('true by filter_type', () => {
    expect(
      getListDeclaresOffsetParam({
        parameters: [
          { name: 'x', is_filter: true, filter_info: { filter_type: 'offset' } },
        ],
      }),
    ).toBe(true)
  })
  it('false otherwise', () => {
    expect(getListDeclaresOffsetParam({ parameters: [{ name: 'q' }] })).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// getOperationConfig / isOperationSupported / getSupportedOperations
// ---------------------------------------------------------------------------
describe('getOperationConfig', () => {
  it('returns the operation config object', () => {
    const cfg: any = { get_list: { url: '/x' } }
    expect(getOperationConfig(cfg, TableOperation.GET_LIST)).toEqual({ url: '/x' })
  })
  it('returns null when missing or tableConfig nullish', () => {
    expect(getOperationConfig({}, TableOperation.GET_LIST)).toBeNull()
    expect(getOperationConfig(null, TableOperation.GET_LIST)).toBeNull()
  })
})

describe('isOperationSupported', () => {
  it('true only when operation has a url', () => {
    expect(isOperationSupported({ get_list: { url: '/x' } }, TableOperation.GET_LIST)).toBe(true)
    expect(isOperationSupported({ get_list: {} }, TableOperation.GET_LIST)).toBe(false)
    expect(isOperationSupported(null, TableOperation.GET_LIST)).toBe(false)
  })
})

describe('getSupportedOperations', () => {
  it('returns all operations with urls', () => {
    const cfg: any = {
      get_list: { url: '/a' },
      post_item: { url: '/b' },
      delete_item: {},
    }
    const ops = getSupportedOperations(cfg)
    expect(ops).toContain(TableOperation.GET_LIST)
    expect(ops).toContain(TableOperation.POST_ITEM)
    expect(ops).not.toContain(TableOperation.DELETE_ITEM)
  })

  it('returns empty for config without operations', () => {
    expect(getSupportedOperations({})).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// getSectionType
// ---------------------------------------------------------------------------
describe('getSectionType', () => {
  it('detects configuration', () => {
    expect(getSectionType('/configuration/x')).toBe('configuration')
  })
  it('detects input-data', () => {
    expect(getSectionType('/input-data/x')).toBe('input-data')
  })
  it('detects results from output-data and results', () => {
    expect(getSectionType('/output-data/x')).toBe('results')
    expect(getSectionType('/results/x')).toBe('results')
  })
  it('defaults to configuration', () => {
    expect(getSectionType('/something-else')).toBe('configuration')
  })
})

// ---------------------------------------------------------------------------
// isFrontendAutomationRoute / isExecutionDataSectionRoute
// ---------------------------------------------------------------------------
describe('isFrontendAutomationRoute', () => {
  it('true for configuration paths', () => {
    expect(isFrontendAutomationRoute('/configuration/x')).toBe(true)
    expect(isFrontendAutomationRoute('/results/x')).toBe(false)
  })
})

describe('isExecutionDataSectionRoute', () => {
  it('false for empty path', () => {
    expect(isExecutionDataSectionRoute('')).toBe(false)
  })
  it('true for input-data/results/output-data', () => {
    expect(isExecutionDataSectionRoute('/input-data/x')).toBe(true)
    expect(isExecutionDataSectionRoute('/results/x')).toBe(true)
    expect(isExecutionDataSectionRoute('/output-data/x')).toBe(true)
  })
  it('false for configuration', () => {
    expect(isExecutionDataSectionRoute('/configuration/x')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// hasValidationTableData
// ---------------------------------------------------------------------------
describe('hasValidationTableData', () => {
  it('false when no executionData or not a validation table', () => {
    expect(hasValidationTableData('t', null, true)).toBe(false)
    expect(hasValidationTableData('t', { dataChecks: { t: [1] } }, false)).toBe(false)
  })
  it('false when dataChecks missing or table empty', () => {
    expect(hasValidationTableData('t', {}, true)).toBe(false)
    expect(hasValidationTableData('t', { dataChecks: { t: [] } }, true)).toBe(false)
  })
  it('true when table has rows', () => {
    expect(hasValidationTableData('t', { dataChecks: { t: [{ a: 1 }] } }, true)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// filterValidationTablesWithData
// ---------------------------------------------------------------------------
describe('filterValidationTablesWithData', () => {
  it('returns input when configuration or executionData missing', () => {
    const cfg: any = { a: {} }
    expect(filterValidationTablesWithData(null, {})).toBeNull()
    expect(filterValidationTablesWithData(cfg, null)).toBe(cfg)
  })

  it('removes validation tables without data, keeps others', () => {
    const config: any = {
      regular: { group: 'Other' },
      valEmpty: { group: 'Validations' },
      valFull: { group: 'Validations' },
    }
    const executionData = {
      dataChecks: { valFull: [{ x: 1 }], valEmpty: [] },
    }
    const result = filterValidationTablesWithData(config, executionData)
    expect(result).toHaveProperty('regular')
    expect(result).toHaveProperty('valFull')
    expect(result).not.toHaveProperty('valEmpty')
  })
})

// ---------------------------------------------------------------------------
// enrichConfigWithChecksData
// ---------------------------------------------------------------------------
describe('enrichConfigWithChecksData', () => {
  it('returns input when configuration or executionData missing', () => {
    expect(enrichConfigWithChecksData(null, {})).toBeNull()
    const cfg: any = { a: {} }
    expect(enrichConfigWithChecksData(cfg, null)).toBe(cfg)
  })

  it('returns config unchanged when dataChecks missing/invalid', () => {
    const cfg: any = { a: {} }
    expect(enrichConfigWithChecksData(cfg, {})).toBe(cfg)
    expect(enrichConfigWithChecksData(cfg, { dataChecks: 'bad' })).toBe(cfg)
  })

  it('skips checks already in config or empty arrays', () => {
    const cfg: any = { existing: {} }
    const result = enrichConfigWithChecksData(cfg, {
      dataChecks: { existing: [{ a: 1 }], emptyOne: [] },
    })
    expect(result).toBe(cfg) // nothing enriched -> same reference
  })

  it('enriches from schemaChecks properties when available', () => {
    const cfg: any = {}
    const result = enrichConfigWithChecksData(
      cfg,
      {
        dataChecks: { chk: [{ col1: 'v' }] },
        schemaChecks: {
          properties: {
            chk: {
              title: 'My Check',
              items: { properties: { col1: { type: 'string', title: 'Col One' } }, required: ['col1'] },
            },
          },
        },
      },
      'es',
    )
    expect(result.chk).toBeDefined()
    expect(result.chk.title).toBe('My Check')
    expect(result.chk.group).toBe('Validaciones')
    expect(result.chk.get_list.response_schema.items.properties.col1.title).toBe('Col One')
    expect(result.chk.get_list.response_schema.items.required).toEqual(['col1'])
  })

  it('builds config from object data when no schema entry', () => {
    const cfg: any = {}
    const result = enrichConfigWithChecksData(cfg, {
      dataChecks: { chk: [{ name: 'a', count: 3, ratio: 1.5, flag: true }] },
    })
    const props = result.chk.get_list.response_schema.items.properties
    expect(props.name.type).toBe('string')
    expect(props.count.type).toBe('integer')
    expect(props.ratio.type).toBe('number')
    expect(props.flag.type).toBe('boolean')
    expect(result.chk.group).toBe('Validations') // default en locale
  })

  it('builds primitive-array config when data is array of strings', () => {
    const cfg: any = {}
    const result = enrichConfigWithChecksData(cfg, {
      dataChecks: { chk: ['msg1', 'msg2'] },
    })
    expect(result.chk.isPrimitiveArray).toBe(true)
    expect(result.chk.get_list.response_schema.items.type).toBe('string')
  })
})

// ---------------------------------------------------------------------------
// isValidationGroup / isValidationLikeGroup
// ---------------------------------------------------------------------------
describe('isValidationGroup', () => {
  it('true for known validation group names', () => {
    expect(isValidationGroup('Validations')).toBe(true)
    expect(isValidationGroup('Validaciones')).toBe(true)
    expect(isValidationGroup('validations')).toBe(true)
  })
  it('false for null/other', () => {
    expect(isValidationGroup(null)).toBe(false)
    expect(isValidationGroup('Sales')).toBe(false)
  })
})

describe('isValidationLikeGroup', () => {
  it('false for nullish', () => {
    expect(isValidationLikeGroup(null)).toBe(false)
    expect(isValidationLikeGroup(undefined)).toBe(false)
  })
  it('true for exact group names', () => {
    expect(isValidationLikeGroup('Validations')).toBe(true)
  })
  it('true for substring matches', () => {
    expect(isValidationLikeGroup('Data Validation Report')).toBe(true)
    expect(isValidationLikeGroup('Validacion de datos')).toBe(true)
  })
  it('false for unrelated', () => {
    expect(isValidationLikeGroup('Sales')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// getConfigurationBySection
// ---------------------------------------------------------------------------
describe('getConfigurationBySection', () => {
  const configs: any = {
    masterData: { m: {} },
    inputData: { i: {} },
    resultsData: { r: {} },
  }
  it('returns the correct section', () => {
    expect(getConfigurationBySection(configs, 'configuration')).toBe(configs.masterData)
    expect(getConfigurationBySection(configs, 'input-data')).toBe(configs.inputData)
    expect(getConfigurationBySection(configs, 'results')).toBe(configs.resultsData)
  })
  it('defaults to masterData for unknown section', () => {
    expect(getConfigurationBySection(configs, 'other' as any)).toBe(configs.masterData)
  })
})

// ---------------------------------------------------------------------------
// isTableVisibleInCurrentSchema / filterTablesByCurrentSchema
// ---------------------------------------------------------------------------
describe('isTableVisibleInCurrentSchema', () => {
  it('visible when schemas undefined', () => {
    expect(isTableVisibleInCurrentSchema(undefined, 'dagA')).toBe(true)
  })
  it('hidden when empty array', () => {
    expect(isTableVisibleInCurrentSchema([], 'dagA')).toBe(false)
  })
  it('visible only when current schema in list', () => {
    expect(isTableVisibleInCurrentSchema(['dagA'], 'dagA')).toBe(true)
    expect(isTableVisibleInCurrentSchema(['dagB'], 'dagA')).toBe(false)
  })
})

describe('filterTablesByCurrentSchema', () => {
  it('returns {} when config nullish', () => {
    expect(filterTablesByCurrentSchema(null as any, 'dagA')).toEqual({})
  })
  it('returns config unchanged when currentSchema falsy', () => {
    const cfg: any = { a: {} }
    expect(filterTablesByCurrentSchema(cfg, '')).toBe(cfg)
  })
  it('filters out tables not in current schema', () => {
    const config: any = {
      always: { schemas: undefined },
      onlyA: { schemas: ['dagA'] },
      onlyB: { schemas: ['dagB'] },
      hidden: { schemas: [] },
    }
    const result = filterTablesByCurrentSchema(config, 'dagA')
    expect(Object.keys(result).sort()).toEqual(['always', 'onlyA'])
  })
})

// ---------------------------------------------------------------------------
// canUserAccessTable / filterTablesByUserSchemas / filterConfigurationsByUserSchemas
// ---------------------------------------------------------------------------
describe('canUserAccessTable', () => {
  it('visible to all when table schemas undefined', () => {
    expect(canUserAccessTable(undefined, ['x'])).toBe(true)
  })
  it('hidden to all when empty array', () => {
    expect(canUserAccessTable([], ['x'])).toBe(false)
  })
  it('full access when user has no schema restrictions', () => {
    expect(canUserAccessTable(['a'], undefined)).toBe(true)
    expect(canUserAccessTable(['a'], [])).toBe(true)
  })
  it('access when user has any required schema', () => {
    expect(canUserAccessTable(['a', 'b'], ['b'])).toBe(true)
    expect(canUserAccessTable(['a', 'b'], ['c'])).toBe(false)
  })
})

describe('filterTablesByUserSchemas', () => {
  it('returns config unchanged when nullish', () => {
    expect(filterTablesByUserSchemas(null as any, ['x'])).toBeNull()
  })
  it('keeps only accessible tables', () => {
    const config: any = {
      open: { schemas: undefined },
      restricted: { schemas: ['a'] },
      noone: { schemas: [] },
    }
    const result = filterTablesByUserSchemas(config, ['a'])
    expect(Object.keys(result).sort()).toEqual(['open', 'restricted'])
  })
})

describe('filterConfigurationsByUserSchemas', () => {
  it('returns input when configurations nullish', () => {
    expect(filterConfigurationsByUserSchemas(null as any, ['x'])).toBeNull()
  })
  it('filters each section by user schemas', () => {
    const configs: any = {
      masterData: { m1: { schemas: ['a'] }, m2: { schemas: ['b'] } },
      inputData: { i1: { schemas: undefined } },
      resultsData: { r1: { schemas: [] } },
    }
    const result = filterConfigurationsByUserSchemas(configs, ['a'])
    expect(Object.keys(result.masterData)).toEqual(['m1'])
    expect(Object.keys(result.inputData)).toEqual(['i1'])
    expect(Object.keys(result.resultsData)).toEqual([])
  })
})
