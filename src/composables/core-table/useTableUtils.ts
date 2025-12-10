import { computed } from 'vue'
import useFilters from '@/utils/useFilters'

export function useTableUtils(
  tableConfig: any,
  allItems: any,
  searchText: any,
  $t: any,
) {
  const getColumnAlignment = (type: string) => {
    switch (type) {
      case 'boolean':
        return 'center'
      default:
        return 'start'
    }
  }

  const isBooleanField = (fieldKey: string) => {
    if (!tableConfig.value?.properties) return false
    const field = tableConfig.value.properties[fieldKey]
    return field?.type === 'boolean'
  }

  const formatBooleanValue = (value: boolean) => {
    return value ? $t('table.yes') : $t('table.no')
  }

  const getFieldType = (fieldKey: string) => {
    if (!tableConfig.value?.properties) return 'string'
    const field = tableConfig.value.properties[fieldKey]
    return field?.type || 'string'
  }

  const filteredItems = computed(() => {
    if (!searchText.value || searchText.value.trim() === '') {
      return allItems.value
    }

    // Use the useFilters utility to filter items
    return useFilters(
      allItems.value,
      searchText.value,
      {}, // No additional filters for now
      ['id'], // Ignore 'id' field in search
    )
  })

  const handleSearch = (searchTextValue: string) => {
    // The filtering is handled automatically by the filteredItems computed property
    // This method can be used for additional search logic if needed
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
