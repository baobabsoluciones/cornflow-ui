import { describe, test, expect, vi } from 'vitest'

// Deterministic stand-ins for the schema helpers used by FK resolution.
vi.mock('@cornflow-ui/core/utils/schemaUtils', () => ({
  getListResponseRowProperties: (cfg: any) => (cfg ? { properties: cfg.properties } : null),
  parseJoinFrom: (jf: string) => ({ table: String(jf).split('.')[0] }),
}))

import {
  getTableKeyFromTempId,
  sortKeysByCreateDependency,
  getFkFieldNameForReferencedTable,
  resolveTempIdsInPayload,
} from '@cornflow-ui/core/utils/tableCreateDependencies'

describe('getTableKeyFromTempId', () => {
  test('extracts the table key from a create temp id', () => {
    expect(getTableKeyFromTempId('create-orders-abc-123')).toBe('orders')
    expect(getTableKeyFromTempId('create-my-table-x-y')).toBe('my-table')
  })
  test('returns null for non-temp ids or malformed ids', () => {
    expect(getTableKeyFromTempId('orders')).toBeNull()
    expect(getTableKeyFromTempId('create-x')).toBeNull()
    expect(getTableKeyFromTempId(123 as any)).toBeNull()
  })
})

describe('sortKeysByCreateDependency', () => {
  test('orders referenced tables before the tables that reference them', () => {
    const getCreates = (k: string) =>
      k === 'b' ? [{ data: { ref: 'create-a-1-2' } }] : []
    expect(sortKeysByCreateDependency(['b', 'a'], getCreates)).toEqual(['a', 'b'])
  })

  test('keeps order when there are no dependencies', () => {
    expect(sortKeysByCreateDependency(['x', 'y'], () => [])).toEqual(['x', 'y'])
  })

  test('appends remaining keys when a cycle blocks the topological pick', () => {
    const getCreates = (k: string) =>
      k === 'a'
        ? [{ data: { ref: 'create-b-1-2' } }]
        : [{ data: { ref: 'create-a-1-2' } }]
    // a<->b cycle: still returns all keys (order is best-effort)
    expect(sortKeysByCreateDependency(['a', 'b'], getCreates).sort()).toEqual(['a', 'b'])
  })
})

describe('getFkFieldNameForReferencedTable', () => {
  const config = {
    properties: {
      orderId: { columnsToJoin: ['dep'] },
      dep: { joinFrom: 'orders.id' },
    },
  }

  test('finds the FK field that joins to the referenced table', () => {
    expect(getFkFieldNameForReferencedTable(config, 'orders')).toBe('orderId')
    // case/hyphen-insensitive
    expect(getFkFieldNameForReferencedTable(config, 'Orders')).toBe('orderId')
  })

  test('returns null when nothing references the table or props are absent', () => {
    expect(getFkFieldNameForReferencedTable(config, 'products')).toBeNull()
    expect(getFkFieldNameForReferencedTable(null, 'orders')).toBeNull()
  })
})

describe('resolveTempIdsInPayload', () => {
  const config = {
    properties: {
      orderId: { columnsToJoin: ['dep'] },
      dep: { joinFrom: 'orders.id' },
    },
  }

  test('rewrites a temp id under the resolved FK field name', () => {
    const out = resolveTempIdsInPayload(
      { someField: 'create-orders-1-2' },
      { 'create-orders-1-2': 99 },
      config,
    )
    // FK field 'orderId' resolved -> original key dropped, value under FK field
    expect(out).toEqual({ orderId: 99 })
  })

  test('keeps the original key when no FK field matches', () => {
    const out = resolveTempIdsInPayload(
      { ref: 'create-products-1-2' },
      { 'create-products-1-2': 7 },
      config,
    )
    expect(out).toEqual({ ref: 7 })
  })

  test('leaves non-temp-id values untouched', () => {
    const out = resolveTempIdsInPayload({ a: 1, b: 'plain' }, {}, config)
    expect(out).toEqual({ a: 1, b: 'plain' })
  })
})
