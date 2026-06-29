import { describe, test, expect, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useTableSelection } from '@/composables/core-table/useTableSelection'

interface Item {
  id: number
  name: string
}

const a: Item = { id: 1, name: 'a' }
const b: Item = { id: 2, name: 'b' }
const c: Item = { id: 3, name: 'c' }

let filtered: ReturnType<typeof ref<Item[]>>

function setup(items: Item[] = [a, b, c]) {
  filtered = ref(items)
  return useTableSelection<Item>(filtered)
}

beforeEach(() => {
  filtered = ref([])
})

describe('useTableSelection', () => {
  test('initial state has empty selection and no flags', () => {
    const s = setup()
    expect(s.selectedItems.value).toEqual([])
    expect(s.isAllSelected.value).toBe(false)
    expect(s.isIndeterminate.value).toBe(false)
    expect(s.hasSelectedItems.value).toBe(false)
  })

  test('isAllSelected false when filtered list empty', () => {
    const s = setup([])
    expect(s.isAllSelected.value).toBe(false)
  })

  test('toggleItemSelection adds then removes an item', () => {
    const s = setup()
    s.toggleItemSelection(a)
    expect(s.selectedItems.value).toEqual([a])
    expect(s.isItemSelected(a)).toBe(true)
    expect(s.hasSelectedItems.value).toBe(true)
    expect(s.isIndeterminate.value).toBe(true)
    expect(s.isAllSelected.value).toBe(false)

    s.toggleItemSelection(a)
    expect(s.selectedItems.value).toEqual([])
    expect(s.isItemSelected(a)).toBe(false)
  })

  test('isItemSelected matches by id', () => {
    const s = setup()
    s.toggleItemSelection(a)
    expect(s.isItemSelected({ id: 1, name: 'different' })).toBe(true)
    expect(s.isItemSelected(b)).toBe(false)
  })

  test('selecting all items flips isAllSelected and clears indeterminate', () => {
    const s = setup()
    s.toggleItemSelection(a)
    s.toggleItemSelection(b)
    s.toggleItemSelection(c)
    expect(s.isAllSelected.value).toBe(true)
    expect(s.isIndeterminate.value).toBe(false)
  })

  test('toggleSelectAll selects all when none selected', () => {
    const s = setup()
    s.toggleSelectAll()
    expect(s.selectedItems.value).toHaveLength(3)
    expect(s.isAllSelected.value).toBe(true)
  })

  test('toggleSelectAll clears when all already selected', () => {
    const s = setup()
    s.toggleSelectAll()
    s.toggleSelectAll()
    expect(s.selectedItems.value).toEqual([])
  })

  test('clearSelection empties the selection', () => {
    const s = setup()
    s.toggleItemSelection(a)
    s.clearSelection()
    expect(s.selectedItems.value).toEqual([])
    expect(s.hasSelectedItems.value).toBe(false)
  })
})
