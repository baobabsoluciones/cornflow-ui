/**
 * useDataTableRows — the rows a data table shows when it has all of them in the browser: those
 * that match the search (in any column, as the table shows the values) and pass every filter,
 * in the order picked.
 *
 *   const { rows: shownRows, filteredCount } = useDataTableRows(rows, columns, { search, filters, sort })
 *   <CoreDataTable :rows="shownRows" :filtered-count="filteredCount" … />
 */
import { computed, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type {
  DataColumn,
  DataFilter,
  DataRow,
  DataSort,
} from '@cornflow-ui/core/components/core/data-table/types'
import {
  formatCellValue,
  sortRows,
  valuePassesFilter,
} from '@cornflow-ui/core/utils/dataTable'

export function useDataTableRows(
  rows: Ref<DataRow[]>,
  columns: Ref<DataColumn[]>,
  state: {
    search: Ref<string>
    filters: Ref<DataFilter[]>
    sort: Ref<DataSort | null>
    /** A cell's value; the pending one when the cell was edited. */
    cellValue?: (row: DataRow, key: string) => unknown
  },
) {
  const { t, locale } = useI18n()
  const cellValue = state.cellValue ?? ((row: DataRow, key: string) => row[key])

  function matchesSearch(row: DataRow, text: string): boolean {
    return columns.value.some((column) => {
      const shown = formatCellValue(cellValue(row, column.key), column, locale.value, t)
      return shown?.toLowerCase().includes(text) ?? false
    })
  }

  const filtered = computed(() => {
    const text = state.search.value.trim().toLowerCase()
    const filters = state.filters.value
    if (!text && filters.length === 0) return rows.value
    return rows.value.filter(
      (row) =>
        (!text || matchesSearch(row, text)) &&
        filters.every((filter) => valuePassesFilter(cellValue(row, filter.field), filter)),
    )
  })

  const sorted = computed(() => {
    const sort = state.sort.value
    const column = sort ? columns.value.find((c) => c.key === sort.key) : undefined
    return sortRows(filtered.value, sort, column, cellValue)
  })

  return {
    rows: sorted,
    filteredCount: computed(() => filtered.value.length),
  }
}
