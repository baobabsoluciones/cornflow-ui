import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { useTableChanges } from '@/composables/useTableChanges'

describe('useTableChanges', () => {
  let tableChanges: ReturnType<typeof useTableChanges>

  beforeEach(() => {
    tableChanges = useTableChanges()
  })

  afterEach(() => {
    tableChanges.clearAllChanges()
  })

  describe('getRowClass', () => {
    const tableKey = 'test_table'

    test('returns empty string for null or undefined item', () => {
      expect(tableChanges.getRowClass(tableKey, null)).toBe('')
      expect(tableChanges.getRowClass(tableKey, undefined)).toBe('')
    })

    test('returns "row-deleted" when item id is in pending deletes', () => {
      tableChanges.recordDelete(tableKey, '42', { id: 42, name: 'Row' })
      expect(tableChanges.getRowClass(tableKey, { id: 42 })).toBe('row-deleted')
      expect(tableChanges.getRowClass(tableKey, { id: '42' })).toBe(
        'row-deleted',
      )
    })

    test('returns "row-new" when item id matches a pending create tempId', () => {
      const tempId = tableChanges.recordCreate(tableKey, { name: 'New' })
      expect(tableChanges.getRowClass(tableKey, { id: tempId })).toBe('row-new')
    })

    test('returns "row-new" when item id is a string starting with "create-"', () => {
      expect(
        tableChanges.getRowClass(tableKey, { id: 'create-foo-0-123' }),
      ).toBe('row-new')
    })

    test('returns empty string for unmodified row', () => {
      expect(
        tableChanges.getRowClass(tableKey, { id: 99, name: 'Other' }),
      ).toBe('')
    })

    test('checks deleted before creates so deleted rows get row-deleted', () => {
      tableChanges.recordCreate(tableKey, { id: 'create-x-0-1', name: 'New' })
      tableChanges.recordDelete(tableKey, 'create-x-0-1')
      expect(tableChanges.getRowClass(tableKey, { id: 'create-x-0-1' })).toBe(
        'row-deleted',
      )
    })
  })

  describe('recordCreate and updateCreateField', () => {
    const tableKey = 'my_table'

    test('recordCreate returns a tempId and getRowClass marks that id as row-new', () => {
      const tempId = tableChanges.recordCreate(tableKey, {
        name: 'Test',
        value: 10,
      })
      expect(tempId).toMatch(/^create-my_table-\d+-\d+$/)
      expect(tableChanges.getRowClass(tableKey, { id: tempId })).toBe('row-new')
    })

    test('updateCreateField updates a field on a pending create', () => {
      const tempId = tableChanges.recordCreate(tableKey, {
        name: 'Original',
        count: 0,
      })
      const updated = tableChanges.updateCreateField(
        tableKey,
        tempId,
        'name',
        'Updated',
      )
      expect(updated).toBe(true)
      const creates = tableChanges.getPendingCreates(tableKey)
      expect(creates).toHaveLength(1)
      expect(creates[0].data.name).toBe('Updated')
      expect(creates[0].data.count).toBe(0)
    })

    test('updateCreateField returns false when tempId not found', () => {
      tableChanges.recordCreate(tableKey, { name: 'A' })
      const updated = tableChanges.updateCreateField(
        tableKey,
        'create-other-0-999',
        'name',
        'X',
      )
      expect(updated).toBe(false)
    })

    test('updateCreateField returns false when table has no creates', () => {
      const updated = tableChanges.updateCreateField(
        tableKey,
        'create-my_table-0-1',
        'name',
        'X',
      )
      expect(updated).toBe(false)
    })
  })

  describe('recordDelete and getRowClass', () => {
    const tableKey = 'deletes_table'

    test('recordDelete adds id to pending deletes and getRowClass returns row-deleted', () => {
      tableChanges.recordDelete(tableKey, 100, { id: 100, code: 'X' })
      expect(tableChanges.getRowClass(tableKey, { id: 100 })).toBe(
        'row-deleted',
      )
      expect(tableChanges.getRowClass(tableKey, { id: '100' })).toBe(
        'row-deleted',
      )
    })

    test('getPendingDeletes returns row ids', () => {
      tableChanges.recordDelete(tableKey, 'a', { id: 'a' })
      tableChanges.recordDelete(tableKey, 'b')
      expect(tableChanges.getPendingDeletes(tableKey)).toEqual(['a', 'b'])
    })
  })
})
