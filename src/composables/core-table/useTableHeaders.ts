import { computed } from 'vue'

export function useTableHeaders(
  localizedTableConfig: any,
  tableConfig: any,
  canDeleteItems: any,
  showActionsColumn: any,
  getColumnAlignment: any,
  $t: any,
) {
  const headers = computed(() => {
    const headersList: any[] = []

    // Add selection column if delete is supported
    if (canDeleteItems.value) {
      headersList.push({
        title: '',
        key: 'selection',
        sortable: false,
        align: 'center',
        width: 50,
      })
    }

    // Generate headers from localized table config schema
    const configToUse = localizedTableConfig.value || tableConfig.value
    if (configToUse?.get_list?.response_schema?.items?.properties) {
      const properties = configToUse.get_list.response_schema.items.properties
      const dataHeaders = Object.entries(properties)
        .filter(([key, value]: [string, any]) => {
          // Filter out 'id' column and readOnly fields
          return key !== 'id' && !value.readOnly
        })
        .map(([key, value]: [string, any]) => ({
          title: value.title || key,
          key: key,
          sortable: true,
          align: getColumnAlignment(value.type),
        }))

      headersList.push(...dataHeaders)

      // Add actions column only if we have write operations
      if (showActionsColumn.value) {
        headersList.push({
          title: $t('table.actions'),
          key: 'actions',
          sortable: false,
          align: 'center',
          width: 120,
        })
      }

      return headersList
    }

    // Default headers if no schema available (also filter out id)
    const defaultHeaders = [{ title: 'Name', key: 'name', sortable: true }]

    headersList.push(...defaultHeaders)

    if (showActionsColumn.value) {
      headersList.push({
        title: $t('table.actions'),
        key: 'actions',
        sortable: false,
        align: 'center',
        width: 120,
      })
    }

    return headersList
  })

  return {
    headers,
  }
}
