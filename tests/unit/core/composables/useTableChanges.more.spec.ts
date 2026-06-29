import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { useTableChanges } from '@cornflow-ui/core/composables/useTableChanges'

describe('useTableChanges (more coverage)', () => {
  let tc: ReturnType<typeof useTableChanges>

  beforeEach(() => {
    tc = useTableChanges()
    tc.clearAllChanges()
  })

  afterEach(() => {
    tc.clearAllChanges()
  })

  describe('recordChange', () => {
    test('records a change and returns true', () => {
      const result = tc.recordChange('t1', 1, 'name', 'old', 'new', 'Name', 'Table 1')
      expect(result).toBe(true)
      expect(tc.isCellModified('t1', 1, 'name')).toBe(true)
      expect(tc.tableTitles.value.t1).toBe('Table 1')
    })

    test('returns false and records nothing for null/undefined/empty/"undefined" rowId', () => {
      expect(tc.recordChange('t1', null as any, 'f', 'a', 'b')).toBe(false)
      expect(tc.recordChange('t1', undefined as any, 'f', 'a', 'b')).toBe(false)
      expect(tc.recordChange('t1', '', 'f', 'a', 'b')).toBe(false)
      expect(tc.recordChange('t1', '   ', 'f', 'a', 'b')).toBe(false)
      expect(tc.recordChange('t1', 'undefined', 'f', 'a', 'b')).toBe(false)
      expect(tc.hasChanges.value).toBe(false)
    })

    test('uses fieldKey as fieldTitle fallback when not provided', () => {
      tc.recordChange('t1', 1, 'amount', 5, 10)
      const summary = tc.getChangesSummary()
      expect(summary[0].fieldTitle).toBe('amount')
    })

    test('recording back to original value removes the change and cleans up', () => {
      tc.recordChange('t1', 1, 'name', 'old', 'new')
      expect(tc.isCellModified('t1', 1, 'name')).toBe(true)
      // set back to original -> change removed
      const result = tc.recordChange('t1', 1, 'name', 'new', 'old')
      expect(result).toBe(false)
      expect(tc.isCellModified('t1', 1, 'name')).toBe(false)
      // table fully cleaned up
      expect(tc.getChangesForTable('t1')).toBeNull()
    })

    test('cleans up empty row but keeps other rows in the table', () => {
      tc.recordChange('t1', 1, 'name', 'old', 'new')
      tc.recordChange('t1', 2, 'name', 'foo', 'bar')
      // revert row 1 back to original
      tc.recordChange('t1', 1, 'name', 'new', 'old')
      expect(tc.isRowModified('t1', 1)).toBe(false)
      expect(tc.isRowModified('t1', 2)).toBe(true)
      expect(tc.getChangesForTable('t1')).not.toBeNull()
    })

    test('keeps the original oldValue when the same cell is edited twice', () => {
      tc.recordChange('t1', 1, 'qty', 1, 2)
      tc.recordChange('t1', 1, 'qty', 2, 3)
      const summary = tc.getChangesSummary()
      expect(summary[0].oldValue).toBe(1)
      expect(summary[0].newValue).toBe(3)
    })
  })

  describe('areValuesEqual', () => {
    test('null and undefined are equal to each other', () => {
      expect(tc.areValuesEqual(null, undefined)).toBe(true)
      expect(tc.areValuesEqual(undefined, null)).toBe(true)
      expect(tc.areValuesEqual(null, 'x')).toBe(false)
    })

    test('boolean comparison coerces values', () => {
      expect(tc.areValuesEqual(true, true)).toBe(true)
      expect(tc.areValuesEqual(false, 0)).toBe(true)
      expect(tc.areValuesEqual(true, 0)).toBe(false)
    })

    test('number comparison coerces strings', () => {
      expect(tc.areValuesEqual(5, '5')).toBe(true)
      expect(tc.areValuesEqual(5, 6)).toBe(false)
    })

    test('string comparison', () => {
      expect(tc.areValuesEqual('abc', 'abc')).toBe(true)
      expect(tc.areValuesEqual('abc', 'abd')).toBe(false)
    })
  })

  describe('revertChange', () => {
    test('returns null when change does not exist', () => {
      expect(tc.revertChange('t1', 1, 'name')).toBeNull()
    })

    test('reverts a change and returns it, cleaning empty row/table', () => {
      tc.recordChange('t1', 1, 'name', 'old', 'new')
      const change = tc.revertChange('t1', 1, 'name')
      expect(change).not.toBeNull()
      expect(change?.newValue).toBe('new')
      expect(tc.getChangesForTable('t1')).toBeNull()
    })

    test('reverting one field keeps other fields in the same row', () => {
      tc.recordChange('t1', 1, 'a', 1, 2)
      tc.recordChange('t1', 1, 'b', 3, 4)
      tc.revertChange('t1', 1, 'a')
      expect(tc.isCellModified('t1', 1, 'a')).toBe(false)
      expect(tc.isCellModified('t1', 1, 'b')).toBe(true)
    })
  })

  describe('revertRowChanges', () => {
    test('returns null when row does not exist', () => {
      expect(tc.revertRowChanges('t1', 99)).toBeNull()
    })

    test('reverts all changes for a row and cleans table when last row', () => {
      tc.recordChange('t1', 1, 'a', 1, 2)
      tc.recordChange('t1', 1, 'b', 3, 4)
      const changes = tc.revertRowChanges('t1', 1)
      expect(Object.keys(changes ?? {})).toEqual(['a', 'b'])
      expect(tc.getChangesForTable('t1')).toBeNull()
    })

    test('keeps table when other rows still modified', () => {
      tc.recordChange('t1', 1, 'a', 1, 2)
      tc.recordChange('t1', 2, 'a', 1, 2)
      tc.revertRowChanges('t1', 1)
      expect(tc.getChangesForTable('t1')).not.toBeNull()
      expect(tc.isRowModified('t1', 2)).toBe(true)
    })
  })

  describe('revertTableChanges', () => {
    test('returns null when table does not exist', () => {
      expect(tc.revertTableChanges('nope')).toBeNull()
    })

    test('reverts all changes for a table and removes title', () => {
      tc.recordChange('t1', 1, 'a', 1, 2, 'A', 'Title 1')
      const changes = tc.revertTableChanges('t1')
      expect(changes).not.toBeNull()
      expect(tc.getChangesForTable('t1')).toBeNull()
      expect(tc.tableTitles.value.t1).toBeUndefined()
    })
  })

  describe('clearAllChanges', () => {
    test('clears edits, creates, deletes and titles', () => {
      tc.recordChange('t1', 1, 'a', 1, 2, 'A', 'T1')
      tc.recordCreate('t1', { name: 'x' })
      tc.recordDelete('t1', 5)
      tc.setTableTitle('t1', 'T1')
      tc.clearAllChanges()
      expect(tc.hasChanges.value).toBe(false)
      expect(tc.totalChangesCount.value).toBe(0)
      expect(tc.modifiedTableKeys.value).toEqual([])
      expect(tc.getPendingCreates('t1')).toEqual([])
      expect(tc.getPendingDeletes('t1')).toEqual([])
    })
  })

  describe('getChangesForTable / getAllChanges', () => {
    test('getChangesForTable returns null for unknown table', () => {
      expect(tc.getChangesForTable('unknown')).toBeNull()
    })

    test('getAllChanges returns the full pending changes object', () => {
      tc.recordChange('t1', 1, 'a', 1, 2)
      const all = tc.getAllChanges()
      expect(all.t1['1'].a.newValue).toBe(2)
    })
  })

  describe('isCellModified / isRowModified / isTableModified', () => {
    test('all return false when nothing recorded', () => {
      expect(tc.isCellModified('t1', 1, 'a')).toBe(false)
      expect(tc.isRowModified('t1', 1)).toBe(false)
      expect(tc.isTableModified('t1')).toBe(false)
    })

    test('all return true after a change is recorded', () => {
      tc.recordChange('t1', 1, 'a', 1, 2)
      expect(tc.isCellModified('t1', 1, 'a')).toBe(true)
      expect(tc.isRowModified('t1', 1)).toBe(true)
      expect(tc.isTableModified('t1')).toBe(true)
    })
  })

  describe('getCurrentValue', () => {
    test('returns original value when no change exists', () => {
      expect(tc.getCurrentValue('t1', 1, 'a', 'orig')).toBe('orig')
    })

    test('returns new value when a change exists', () => {
      tc.recordChange('t1', 1, 'a', 'orig', 'changed')
      expect(tc.getCurrentValue('t1', 1, 'a', 'orig')).toBe('changed')
    })
  })

  describe('getChangesSummary', () => {
    test('returns empty array when no changes', () => {
      expect(tc.getChangesSummary()).toEqual([])
    })

    test('flattens changes across multiple tables/rows/fields and sorts by timestamp desc', () => {
      tc.recordChange('t1', 1, 'a', 1, 2, 'A', 'Table 1')
      tc.recordChange('t1', 2, 'b', 3, 4)
      tc.recordChange('t2', 5, 'c', 5, 6)
      const summary = tc.getChangesSummary()
      expect(summary).toHaveLength(3)
      // sorted desc by timestamp
      for (let i = 1; i < summary.length; i++) {
        expect(summary[i - 1].timestamp).toBeGreaterThanOrEqual(summary[i].timestamp)
      }
      const t1a = summary.find((s) => s.tableKey === 't1' && s.fieldKey === 'a')!
      expect(t1a.tableTitle).toBe('Table 1')
      expect(t1a.rowIdentifier).toBe('1')
    })

    test('uses tableKey as title fallback and applies getRowIdentifier callback', () => {
      tc.recordChange('tt', 7, 'f', 'x', 'y')
      const summary = tc.getChangesSummary(
        (tableKey, rowId) => `${tableKey}:${rowId}`,
      )
      expect(summary[0].tableTitle).toBe('tt')
      expect(summary[0].rowIdentifier).toBe('tt:7')
    })
  })

  describe('computed: hasChanges / totalChangesCount / modifiedTablesCount / modifiedTableKeys', () => {
    test('reflect edits only', () => {
      tc.recordChange('t1', 1, 'a', 1, 2)
      tc.recordChange('t1', 1, 'b', 3, 4)
      expect(tc.hasChanges.value).toBe(true)
      expect(tc.totalChangesCount.value).toBe(2)
      expect(tc.modifiedTablesCount.value).toBe(1)
      expect(tc.modifiedTableKeys.value).toEqual(['t1'])
    })

    test('totalChangesCount sums edits + creates + deletes', () => {
      tc.recordChange('t1', 1, 'a', 1, 2)
      tc.recordCreate('t1', { name: 'x' })
      tc.recordCreate('t2', { name: 'y' })
      tc.recordDelete('t3', 9)
      expect(tc.totalChangesCount.value).toBe(4)
    })

    test('modifiedTableKeys unions edits, creates and deletes', () => {
      tc.recordChange('t1', 1, 'a', 1, 2)
      tc.recordCreate('t2', { name: 'x' })
      tc.recordDelete('t3', 9)
      const keys = tc.modifiedTableKeys.value.sort()
      expect(keys).toEqual(['t1', 't2', 't3'])
    })

    test('hasChanges true with only creates and only deletes', () => {
      tc.recordCreate('t1', { name: 'x' })
      expect(tc.hasChanges.value).toBe(true)
      tc.clearAllChanges()
      tc.recordDelete('t1', 5)
      expect(tc.hasChanges.value).toBe(true)
    })
  })

  describe('applyChangesToData', () => {
    test('applies pending edits to matching rows by id', () => {
      tc.recordChange('t1', 1, 'name', 'old', 'new')
      const data = {
        t1: [
          { id: 1, name: 'old' },
          { id: 2, name: 'keep' },
        ],
      }
      const result = tc.applyChangesToData(data)
      expect(result.t1[0].name).toBe('new')
      expect(result.t1[1].name).toBe('keep')
      // original data not mutated (deep clone)
      expect(data.t1[0].name).toBe('old')
    })

    test('skips tables not present in data', () => {
      tc.recordChange('missing', 1, 'name', 'old', 'new')
      const data = { t1: [{ id: 1, name: 'x' }] }
      const result = tc.applyChangesToData(data)
      expect(result).toEqual({ t1: [{ id: 1, name: 'x' }] })
    })

    test('skips rows whose id is not found', () => {
      tc.recordChange('t1', 999, 'name', 'old', 'new')
      const data = { t1: [{ id: 1, name: 'x' }] }
      const result = tc.applyChangesToData(data)
      expect(result.t1[0].name).toBe('x')
    })
  })

  describe('getChangesGroupedByTable', () => {
    test('returns empty array when no edits', () => {
      expect(tc.getChangesGroupedByTable()).toEqual([])
    })

    test('groups edits by table and row with title fallback', () => {
      tc.recordChange('t1', 1, 'a', 1, 2, 'A', 'Table One')
      tc.recordChange('t1', 1, 'b', 3, 4)
      tc.recordChange('t2', 9, 'c', 5, 6)
      const grouped = tc.getChangesGroupedByTable()
      const t1 = grouped.find((g) => g.tableKey === 't1')!
      expect(t1.tableTitle).toBe('Table One')
      expect(t1.changes).toHaveLength(1)
      expect(t1.changes[0].rowId).toBe('1')
      expect(t1.changes[0].fields.map((f) => f.fieldKey).sort()).toEqual(['a', 'b'])
      const t2 = grouped.find((g) => g.tableKey === 't2')!
      expect(t2.tableTitle).toBe('t2')
    })
  })

  describe('getFullGroupedChanges', () => {
    test('returns empty array when nothing pending', () => {
      expect(tc.getFullGroupedChanges()).toEqual([])
    })

    test('combines edits, creates and deletes per table', () => {
      tc.recordChange('t1', 1, 'a', 1, 2, 'A', 'Table 1')
      tc.recordCreate('t1', { name: 'new' })
      tc.recordDelete('t1', 5, { id: 5, name: 'del' })
      const full = tc.getFullGroupedChanges()
      const t1 = full.find((g) => g.tableKey === 't1')!
      expect(t1.tableTitle).toBe('Table 1')
      expect(t1.changes).toHaveLength(1)
      expect(t1.changes[0].fields[0].fieldKey).toBe('a')
      expect(t1.creates).toHaveLength(1)
      expect(t1.deletes).toEqual([{ rowId: '5', data: { id: 5, name: 'del' } }])
    })

    test('includes tables that only have creates or only deletes', () => {
      tc.recordCreate('onlyCreate', { x: 1 })
      tc.recordDelete('onlyDelete', 7)
      const full = tc.getFullGroupedChanges()
      const keys = full.map((g) => g.tableKey).sort()
      expect(keys).toEqual(['onlyCreate', 'onlyDelete'])
      const c = full.find((g) => g.tableKey === 'onlyCreate')!
      expect(c.changes).toEqual([])
      expect(c.creates).toHaveLength(1)
    })
  })

  describe('setTableTitle', () => {
    test('sets the title used by summary/grouping', () => {
      tc.setTableTitle('t1', 'My Title')
      expect(tc.tableTitles.value.t1).toBe('My Title')
    })
  })

  describe('recordCreate / getPendingCreates / revertCreate / clearCreatesForTable', () => {
    test('getPendingCreates returns empty array for unknown table', () => {
      expect(tc.getPendingCreates('nope')).toEqual([])
    })

    test('recordCreate stores a copy of row data and sets title', () => {
      const src = { name: 'x', n: 1 }
      const tempId = tc.recordCreate('t1', src, 'Title')
      src.name = 'mutated'
      const creates = tc.getPendingCreates('t1')
      expect(creates[0].tempId).toBe(tempId)
      expect(creates[0].data.name).toBe('x')
      expect(tc.tableTitles.value.t1).toBe('Title')
    })

    test('revertCreate by tempId removes it; deletes table key when empty', () => {
      const tempId = tc.recordCreate('t1', { name: 'a' })
      expect(tc.revertCreate('t1', tempId)).toBe(true)
      expect(tc.getPendingCreates('t1')).toEqual([])
    })

    test('revertCreate by numeric index', () => {
      tc.recordCreate('t1', { name: 'a' })
      tc.recordCreate('t1', { name: 'b' })
      expect(tc.revertCreate('t1', 0)).toBe(true)
      const creates = tc.getPendingCreates('t1')
      expect(creates).toHaveLength(1)
      expect(creates[0].data.name).toBe('b')
    })

    test('revertCreate returns false for empty table or unknown tempId', () => {
      expect(tc.revertCreate('t1', 'x')).toBe(false)
      tc.recordCreate('t1', { name: 'a' })
      expect(tc.revertCreate('t1', 'unknown-temp')).toBe(false)
    })

    test('clearCreatesForTable removes all creates for the table', () => {
      tc.recordCreate('t1', { name: 'a' })
      tc.clearCreatesForTable('t1')
      expect(tc.getPendingCreates('t1')).toEqual([])
    })
  })

  describe('recordDelete branches / getPendingDeletesWithData / revertDelete / clearDeletesForTable', () => {
    test('ignores empty or "undefined" rowId', () => {
      tc.recordDelete('t1', '')
      tc.recordDelete('t1', 'undefined')
      expect(tc.getPendingDeletes('t1')).toEqual([])
    })

    test('does not duplicate the same delete id', () => {
      tc.recordDelete('t1', 5)
      tc.recordDelete('t1', 5)
      expect(tc.getPendingDeletes('t1')).toEqual(['5'])
    })

    test('deleting a pending create cancels the create instead of recording a delete', () => {
      const tempId = tc.recordCreate('t1', { name: 'a' })
      // also add a transient edit on the temp row to exercise defensive cleanup
      tc.recordChange('t1', tempId, 'name', 'a', 'b')
      tc.recordDelete('t1', tempId)
      expect(tc.getPendingCreates('t1')).toEqual([])
      expect(tc.getPendingDeletes('t1')).toEqual([])
      expect(tc.getChangesForTable('t1')).toBeNull()
    })

    test('canceling one create of many keeps the rest', () => {
      const id1 = tc.recordCreate('t1', { name: 'a' })
      tc.recordCreate('t1', { name: 'b' })
      tc.recordDelete('t1', id1)
      const creates = tc.getPendingCreates('t1')
      expect(creates).toHaveLength(1)
      expect(creates[0].data.name).toBe('b')
    })

    test('getPendingDeletesWithData returns full entries', () => {
      tc.recordDelete('t1', 5, { id: 5, code: 'X' })
      expect(tc.getPendingDeletesWithData('t1')).toEqual([
        { rowId: '5', data: { id: 5, code: 'X' } },
      ])
      expect(tc.getPendingDeletesWithData('none')).toEqual([])
    })

    test('revertDelete removes a delete and returns true/false appropriately', () => {
      expect(tc.revertDelete('t1', 5)).toBe(false)
      tc.recordDelete('t1', 5)
      expect(tc.revertDelete('t1', 99)).toBe(false)
      expect(tc.revertDelete('t1', 5)).toBe(true)
      expect(tc.getPendingDeletes('t1')).toEqual([])
    })

    test('clearDeletesForTable removes all deletes', () => {
      tc.recordDelete('t1', 5)
      tc.clearDeletesForTable('t1')
      expect(tc.getPendingDeletes('t1')).toEqual([])
    })
  })
})
