import { describe, expect, test } from 'vitest'
import { defineComponent, ref, type Ref } from 'vue'
import { mount } from '@vue/test-utils'
import { useDataTableRows } from '@cornflow-ui/core/composables/core-table/useDataTableRows'
import type { DataColumn, DataFilter, DataRow, DataSort } from '@cornflow-ui/core/components/core/data-table/types'
import { createEnI18n } from '../../components/core/data-table/i18nEn'

const columns: DataColumn[] = [
  { key: 'line', title: 'Line', type: 'text' },
  { key: 'capacity', title: 'Capacity', type: 'number' },
  { key: 'active', title: 'Active', type: 'boolean' },
]

const rows: DataRow[] = [
  { id: 1, line: 'L1', capacity: 1200, active: true },
  { id: 2, line: 'L2', capacity: 300, active: false },
  { id: 3, line: 'L3', capacity: 5000, active: true },
]

function setup(state: { search?: string; filters?: DataFilter[]; sort?: DataSort | null } = {}) {
  const search = ref(state.search ?? '')
  const filters = ref<DataFilter[]>(state.filters ?? [])
  const sort = ref<DataSort | null>(state.sort ?? null)
  let result!: ReturnType<typeof useDataTableRows>
  mount(
    defineComponent({
      setup() {
        result = useDataTableRows(ref(rows), ref(columns), {
          search,
          filters,
          sort,
          cellValue: (row, key) => row[key],
        })
        return () => null
      },
    }),
    { global: { plugins: [createEnI18n()] } },
  )
  return { result, search, filters, sort } as {
    result: ReturnType<typeof useDataTableRows>
    search: Ref<string>
    filters: Ref<DataFilter[]>
    sort: Ref<DataSort | null>
  }
}

const ids = (list: DataRow[]) => list.map((row) => row.id)

describe('useDataTableRows', () => {
  test('without search, filters or sort gives every row as it is', () => {
    const { result } = setup()
    expect(ids(result.rows.value)).toEqual([1, 2, 3])
    expect(result.filteredCount.value).toBe(3)
  })

  test('searches the values as the table shows them', () => {
    const { result, search } = setup({ search: '1,200' })
    expect(ids(result.rows.value)).toEqual([1])
    search.value = 'no'
    expect(ids(result.rows.value)).toEqual([2])
  })

  test('keeps the rows that pass every filter', () => {
    const { result } = setup({
      filters: [
        { id: 'a', field: 'active', operator: 'is', value: 'true' },
        { id: 'b', field: 'capacity', operator: 'is_between', value: '1000', value2: '' },
      ],
    })
    expect(ids(result.rows.value)).toEqual([1, 3])
    expect(result.filteredCount.value).toBe(2)
  })

  test('orders the rows by the picked column', () => {
    const { result, sort } = setup({ sort: { key: 'capacity', direction: 'desc' } })
    expect(ids(result.rows.value)).toEqual([3, 1, 2])
    sort.value = { key: 'capacity', direction: 'asc' }
    expect(ids(result.rows.value)).toEqual([2, 1, 3])
  })
})
