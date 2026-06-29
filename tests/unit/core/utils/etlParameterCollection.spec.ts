import { describe, test, expect, vi } from 'vitest'

vi.mock('@/utils/schemaUtils', () => ({
  normalizeTableNameForEtlLookup: (s: string) => String(s).toLowerCase().replace(/[\s-]/g, '_'),
}))

import {
  ETL_OBJECT_ROW_ID,
  resolveInstanceDataKeyForChangeKey,
  collectEtlParameterKeysForTable,
  collectEditedEtlParameterKeysFromPendingChanges,
} from '@/utils/etlParameterCollection'

describe('resolveInstanceDataKeyForChangeKey', () => {
  test('matches a key by normalized name, skipping meta keys', () => {
    const data = { Orders: [], __metadata__: {}, Other: [] }
    expect(resolveInstanceDataKeyForChangeKey(data, 'orders')).toBe('Orders')
    expect(resolveInstanceDataKeyForChangeKey(data, 'OTHER')).toBe('Other')
  })
  test('returns null when no data key matches', () => {
    expect(resolveInstanceDataKeyForChangeKey({ Orders: [] }, 'products')).toBeNull()
  })
})

describe('collectEtlParameterKeysForTable', () => {
  test('horizontal (object) changes resolve per field', () => {
    const out = new Set<string>()
    const metaByNorm = new Map([['orders.p1', 'Orders.P1']])
    collectEtlParameterKeysForTable(
      { [ETL_OBJECT_ROW_ID]: { p1: 'x', pX: 'ignored' } },
      'Orders',
      metaByNorm,
      out,
    )
    expect([...out]).toEqual(['Orders.P1'])
  })

  test('row changes resolve per row id (object row id excluded)', () => {
    const out = new Set<string>()
    const metaByNorm = new Map([['orders.r1', 'CANON']])
    // __object__ falsy -> not the horizontal branch; row loop skips the object row id
    collectEtlParameterKeysForTable(
      { r1: {}, [ETL_OBJECT_ROW_ID]: null },
      'Orders',
      metaByNorm,
      out,
    )
    expect([...out]).toEqual(['CANON'])
  })
})

describe('collectEditedEtlParameterKeysFromPendingChanges', () => {
  const deps = (changesByKey: Record<string, any>, modifiedTableKeys: string[]) => ({
    modifiedTableKeys,
    getChangesForTable: (k: string) => changesByKey[k] ?? null,
  })

  test('returns [] when there are no parameters_from_db', () => {
    expect(
      collectEditedEtlParameterKeysFromPendingChanges({ Orders: [] }, [], deps({}, ['orders'])),
    ).toEqual([])
  })

  test('collects canonical keys from pending changes', () => {
    const out = collectEditedEtlParameterKeysFromPendingChanges(
      { Orders: [] },
      ['Orders.P1'],
      deps({ orders: { [ETL_OBJECT_ROW_ID]: { p1: 'x' } } }, ['orders']),
    )
    expect(out).toEqual(['Orders.P1'])
  })

  test('skips keys that do not resolve or have no changes', () => {
    const out = collectEditedEtlParameterKeysFromPendingChanges(
      { Orders: [] },
      ['Orders.P1'],
      deps({ orders: null }, ['nomatch', 'orders']),
    )
    expect(out).toEqual([])
  })
})
