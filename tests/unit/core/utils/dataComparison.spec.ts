import { describe, expect, test, vi } from 'vitest'

vi.mock('@cornflow-ui/core/utils/appParameters', () => ({
  getAppParameters: () => ({
    masterTableMatchingConfig: {
      compareStrategies: { products: { matchFields: ['code'] } },
    },
  }),
}))

import {
  comparisonBucket,
  comparisonLinesFrom,
} from '@cornflow-ui/core/utils/dataComparison'

const master = [
  { id: 1, code: 'P-101', name: 'Water 1.5 L', weight: 0.15 },
  { id: 2, code: 'P-102', name: 'Yogurt pack', weight: 0.52 },
  { id: 3, code: 'P-103', name: 'Tuna 3x80 g', weight: 0.75 },
  { id: 4, code: 'P-099', name: 'Sparkling water', weight: 1.05 },
]

const lines = (instanceRows: Record<string, any>[]) =>
  comparisonLinesFrom({
    tableKey: 'products',
    instanceRows,
    masterRows: master,
    instanceSchemaColumns: ['code', 'name', 'weight'],
  })

describe('comparisonLinesFrom', () => {
  test('gives one line per key: master rows first, then the rows only in the loaded data', () => {
    const result = lines([
      { id: 'a', code: 'P-101', name: 'Water 1.5 L', weight: 0.15 },
      { id: 'b', code: 'P-102', name: 'Yogurt pack', weight: 0.52 },
      { id: 'c', code: 'P-103', name: 'Tuna 3x80 g', weight: 0.89 },
      { id: 'd', code: 'P-135', name: 'Crackers', weight: 1.93 },
    ])

    expect(result.map((line) => [line.status, line.changedKeys])).toEqual([
      ['identical', []],
      ['identical', []],
      ['modified', ['weight']],
      ['removed', []],
      ['added', []],
    ])
    expect(result[2].loaded?.weight).toBe(0.89)
    expect(result[2].master?.weight).toBe(0.75)
    expect(result[3].masterRow).toBe(master[3])
    expect(result[4].loadedRow?.id).toBe('d')
  })

  test('says which loaded rows already have a pending delete, create or restore', () => {
    const result = lines([
      { id: 'a', code: 'P-101', name: 'Water 1.5 L', weight: 0.15, __pendingDelete: true },
      { id: 'b', code: 'P-102', name: 'Yogurt pack', weight: 0.52, __pendingEdit: true },
      { id: 'c', code: 'P-103', name: 'Tuna 3x80 g', weight: 0.89, __pendingEdit: true },
      { id: 'create-x', code: 'P-099', name: 'Sparkling water', weight: 1.05, __pendingCreate: true },
    ])

    expect(result.map((line) => line.status)).toEqual([
      'pendingDelete',
      'pendingRestore',
      'modified',
      'pendingCreate',
    ])
  })

  test('uses the casing of the shown columns for the changed keys', () => {
    const [line] = comparisonLinesFrom({
      tableKey: 'products',
      instanceRows: [{ CODE: 'P-101', NAME: 'Other', weight: 0.15 }],
      masterRows: [{ code: 'P-101', name: 'Water 1.5 L', weight: 0.15 }],
      columnKeys: ['Code', 'Name', 'Weight'],
    })

    expect(line.changedKeys).toEqual(['Name'])
  })
})

describe('comparisonBucket', () => {
  test('counts pending deletes as removed and pending creates and restores as identical', () => {
    expect(comparisonBucket('pendingDelete')).toBe('removed')
    expect(comparisonBucket('pendingCreate')).toBe('identical')
    expect(comparisonBucket('pendingRestore')).toBe('identical')
    expect(comparisonBucket('modified')).toBe('modified')
  })
})
