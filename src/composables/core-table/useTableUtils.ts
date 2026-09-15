import { computed } from 'vue'
import useFilters from '@cornflow-ui/core/utils/useFilters'

const COLUMN_ALIGNMENT: Record<string, string> = {
  boolean: 'center',
}

export function useTableUtils(
  tableConfig: any,
  allItems: any,
  searchText: any,
  $t: any,
) {
  const getColumnAlignment = (type: string): string =>
    COLUMN_ALIGNMENT[type] || 'start'

  const isBooleanField = (fieldKey: string): boolean => {
    return tableConfig.value?.properties?.[fieldKey]?.type === 'boolean'
  }

  const formatBooleanValue = (value: boolean): string =>
    value ? $t('table.yes') : $t('table.no')

  const getFieldType = (fieldKey: string): string => {
    return tableConfig.value?.properties?.[fieldKey]?.type || 'string'
  }

  const filteredItems = computed(() => {
    if (!searchText.value?.trim()) return allItems.value

    return useFilters(
      allItems.value,
      searchText.value,
      {},
      ['id'],
    )
  })

  const handleSearch = (_searchTextValue: string) => {
    // Filtering is handled by the filteredItems computed property.
  }

  return {
    getColumnAlignment,
    isBooleanField,
    formatBooleanValue,
    getFieldType,
    filteredItems,
    handleSearch,
  }
}
