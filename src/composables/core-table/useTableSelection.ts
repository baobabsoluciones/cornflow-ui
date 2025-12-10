import { ref, computed } from 'vue'

export function useTableSelection<T extends { id: string | number }>(
  filteredItems: any,
) {
  const selectedItems = ref<T[]>([])

  const isAllSelected = computed(() => {
    return (
      filteredItems.value.length > 0 &&
      selectedItems.value.length === filteredItems.value.length
    )
  })

  const isIndeterminate = computed(() => {
    return (
      selectedItems.value.length > 0 &&
      selectedItems.value.length < filteredItems.value.length
    )
  })

  const hasSelectedItems = computed(() => {
    return selectedItems.value.length > 0
  })

  const isItemSelected = (item: T): boolean => {
    return selectedItems.value.some(
      (selectedItem) => selectedItem.id === item.id,
    )
  }

  const toggleItemSelection = (item: T) => {
    const index = selectedItems.value.findIndex(
      (selectedItem) => selectedItem.id === item.id,
    )
    if (index > -1) {
      selectedItems.value.splice(index, 1)
    } else {
      selectedItems.value.push(item)
    }
  }

  const toggleSelectAll = () => {
    if (isAllSelected.value) {
      selectedItems.value = []
    } else {
      selectedItems.value = [...filteredItems.value]
    }
  }

  const clearSelection = () => {
    selectedItems.value = []
  }

  return {
    selectedItems,
    isAllSelected,
    isIndeterminate,
    hasSelectedItems,
    isItemSelected,
    toggleItemSelection,
    toggleSelectAll,
    clearSelection,
  }
}
