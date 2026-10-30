import { beforeEach, describe, expect, test } from 'vitest'
import { ref } from 'vue'
import {
  pendingChangeGroups,
  useDataTableChanges,
} from '@cornflow-ui/core/composables/core-table/useDataTableChanges'
import { useTableChanges } from '@cornflow-ui/core/composables/useTableChanges'
import type { DataColumn, DataRow } from '@cornflow-ui/core/components/core/data-table/types'

const columns: DataColumn[] = [
  { key: 'line', title: 'Line', type: 'text' },
  { key: 'capacity', title: 'Capacity', type: 'number' },
]

const baseRows: DataRow[] = [
  { id: 1, line: 'L1', capacity: 1200 },
  { id: 2, line: 'L2', capacity: 1579 },
  { id: 3, line: 'L3', capacity: 1958 },
]

const setup = () =>
  useDataTableChanges(ref('lines'), ref('Lines'), ref(baseRows), ref(columns))

beforeEach(() => {
  useTableChanges().clearAllChanges()
})

describe('useDataTableChanges', () => {
  test('an edit is a pending change; the cell shows the new value', () => {
    const changes = setup()
    changes.setCell(baseRows[1], 'capacity', 1650)
    expect(changes.cellValue(baseRows[1], 'capacity')).toBe(1650)
    expect(changes.cellModified(baseRows[1], 'capacity')).toBe(true)
    expect(changes.rowState(baseRows[1])).toBe('modified')
    expect(useTableChanges().getChangesForTable('lines')?.['2']?.capacity).toMatchObject({
      oldValue: 1579,
      newValue: 1650,
      fieldTitle: 'Capacity',
    })
  })

  test('an added row comes first, as new; editing it changes its data', () => {
    const changes = setup()
    changes.addRow({ line: 'L9', capacity: 100 })
    const added = changes.rows.value[0]
    expect(String(added.id)).toMatch(/^create-lines-/)
    expect(changes.rowState(added)).toBe('new')
    expect(changes.rows.value).toHaveLength(4)
    changes.setCell(added, 'capacity', 250)
    expect(changes.rows.value[0].capacity).toBe(250)
    expect(useTableChanges().getChangesForTable('lines')).toBeNull()
  })

  test('deleting marks the rows, restoring brings them back; deleting an added row drops it', () => {
    const changes = setup()
    changes.addRow({ line: 'L9', capacity: 100 })
    const added = changes.rows.value[0]
    changes.deleteRows([1, added.id])
    expect(changes.rowState(baseRows[0])).toBe('deleted')
    expect(changes.rows.value).toHaveLength(3)
    changes.restoreRows([1])
    expect(changes.rowState(baseRows[0])).toBeUndefined()
  })

  test('a bulk edit changes every selected row but the deleted ones', () => {
    const changes = setup()
    changes.deleteRows([3])
    changes.bulkEdit([1, 2, 3], { capacity: 10 })
    expect(changes.cellValue(baseRows[0], 'capacity')).toBe(10)
    expect(changes.cellValue(baseRows[1], 'capacity')).toBe(10)
    expect(changes.cellModified(baseRows[2], 'capacity')).toBe(false)
  })

  test('the review groups the changes by table, labelled by the first column', () => {
    const changes = setup()
    changes.setCell(baseRows[0], 'capacity', 1300)
    changes.addRow({ line: 'L9', capacity: 100 })
    changes.deleteRows([2])
    const [group] = pendingChangeGroups([{ key: 'lines', title: 'Lines', columns, rows: baseRows }])
    expect(group.title).toBe('Lines')
    expect(group.items.map((item) => [item.kind, item.label])).toEqual([
      ['modified', 'Line L1'],
      ['new', 'Line L9'],
      ['deleted', 'Line L2'],
    ])
    expect(group.items[0]).toMatchObject({ changedKeys: ['capacity'], original: { capacity: 1200 } })
    expect(group.items[0].row.capacity).toBe(1300)
  })
})
