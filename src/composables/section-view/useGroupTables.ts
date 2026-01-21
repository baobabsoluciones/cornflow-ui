import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { TableConfig } from './useSectionConfiguration'
import {
  fromUrlFriendly,
  toUrlFriendly,
} from '@/services/FrontendAutomationService'

// Types
export interface TabData {
  value: string
  text: string
}

export function useGroupTables(currentConfiguration: any, sectionType: any) {
  const route = useRoute()
  const router = useRouter()

  // State - convert URL-friendly params back to original keys
  const tableKey = ref<string>('')
  const groupName = ref<string>('')

  // Initialize with URL-friendly conversion
  const initializeFromRoute = () => {
    const urlTableKey = route?.params?.tableKey as string
    const urlGroupName = route?.params?.groupName as string

    if (urlTableKey && currentConfiguration.value) {
      tableKey.value = fromUrlFriendly(urlTableKey, currentConfiguration.value)
    } else {
      tableKey.value = urlTableKey || ''
    }

    if (urlGroupName) {
      // For group names, we need to find the original group name
      // by looking through all tables and finding one with matching URL-friendly group
      groupName.value = urlGroupName
      if (currentConfiguration.value) {
        for (const [key, config] of Object.entries(
          currentConfiguration.value,
        )) {
          const tableConfig = config as TableConfig
          if (
            tableConfig.group &&
            toUrlFriendly(tableConfig.group) === urlGroupName
          ) {
            groupName.value = tableConfig.group
            break
          }
        }
      }
    } else {
      groupName.value = urlGroupName || ''
    }
  }
  const selectedTable = ref<string | null>(null)
  const selectedTabIndex = ref<number>(0)

  // Computed
  const isGroupView = computed(() => {
    return !!groupName.value
  })

  const groupTables = computed(() => {
    if (!isGroupView.value) return {}
    const tablesInGroup: Record<string, TableConfig> = {}
    Object.entries(currentConfiguration.value).forEach(([key, config]) => {
      // Handle null group comparison properly
      const configGroup =
        (config as TableConfig).group === null
          ? 'null'
          : (config as TableConfig).group
      if (configGroup === groupName.value) {
        tablesInGroup[key] = config as TableConfig
      }
    })
    return tablesInGroup
  })

  // Helper function to find table key in configuration (handles URL-friendly and case variations)
  const findTableKeyInConfig = (
    searchKey: string,
    config: Record<string, any>,
  ): string | null => {
    if (!searchKey || !config || Object.keys(config).length === 0) return null

    // Try direct lookup first
    if (config[searchKey]) return searchKey

    // Try fromUrlFriendly conversion
    const resolvedKey = fromUrlFriendly(searchKey, config)
    if (resolvedKey && config[resolvedKey]) return resolvedKey

    // Try case-insensitive and underscore/hyphen variations
    const normalizedSearchKey = searchKey.toLowerCase().replace(/-/g, '_')
    for (const key of Object.keys(config)) {
      const normalizedKey = key.toLowerCase().replace(/-/g, '_')
      if (normalizedKey === normalizedSearchKey) {
        return key
      }
    }

    return null
  }

  const tableConfig = computed(() => {
    if (isGroupView.value) return null
    if (!currentConfiguration.value || !tableKey.value) return null

    // Find the actual key in configuration
    const actualKey = findTableKeyInConfig(
      tableKey.value,
      currentConfiguration.value,
    )

    if (actualKey) {
      return currentConfiguration.value[actualKey] as TableConfig
    }

    return null
  })

  // Resolved table key that matches the configuration
  const resolvedTableKey = computed(() => {
    if (!tableKey.value || !currentConfiguration.value) return tableKey.value
    return (
      findTableKeyInConfig(tableKey.value, currentConfiguration.value) ||
      tableKey.value
    )
  })

  const selectedTableConfig = computed(() => {
    if (!isGroupView.value) return null

    // If no selectedTable, try to set it to the first available table
    if (!selectedTable.value && Object.keys(groupTables.value).length > 0) {
      const firstTable = Object.keys(groupTables.value)[0]
      selectedTable.value = firstTable
    }

    const result = selectedTable.value
      ? groupTables.value[selectedTable.value] || null
      : null
    return result
  })

  const tabsData = computed((): TabData[] => {
    if (!isGroupView.value) return []
    return Object.entries(groupTables.value).map(([key, config]) => ({
      value: key,
      text: config.title,
    }))
  })

  // Methods
  const handleTabChange = (tabIndex: number) => {
    selectedTabIndex.value = tabIndex
    const tableKeyValue = tabsData.value[tabIndex]?.value
    if (tableKeyValue && tableKeyValue !== selectedTable.value) {
      selectedTable.value = tableKeyValue
      // Update the URL to reflect the selected table
      if (isGroupView.value) {
        const basePath = `/${sectionType.value}/group/${toUrlFriendly(groupName.value)}`
        router.push(`${basePath}/${toUrlFriendly(tableKeyValue)}`)
      }
    }
  }

  const initializeSelectedTable = async () => {
    if (isGroupView.value) {
      // If tableKey is provided in route, use it; otherwise use first table
      const availableTables = Object.keys(groupTables.value)
      if (availableTables.length > 0) {
        const targetTable = tableKey.value || availableTables[0]
        selectedTable.value = targetTable

        // Wait for DOM update
        await nextTick()

        // Set the correct tab index
        const tabIndex = tabsData.value.findIndex(
          (tab) => tab.value === targetTable,
        )
        selectedTabIndex.value = tabIndex >= 0 ? tabIndex : 0

        // If no tableKey in route, navigate to the first table
        if (!tableKey.value && targetTable) {
          const currentPath = route.path
          const newPath = `${currentPath}/${toUrlFriendly(targetTable)}`
          router.replace(newPath)
        }
      }
    }
  }

  // Watchers
  watch(
    () => route?.params?.tableKey,
    (newKey) => {
      const urlTableKey = newKey as string
      if (urlTableKey && currentConfiguration.value) {
        tableKey.value = fromUrlFriendly(
          urlTableKey,
          currentConfiguration.value,
        )
      } else {
        tableKey.value = urlTableKey || ''
      }

      if (isGroupView.value) {
        selectedTable.value = tableKey.value
        // Update tab index when route changes
        const tabIndex = tabsData.value.findIndex(
          (tab) => tab.value === tableKey.value,
        )
        selectedTabIndex.value = tabIndex >= 0 ? tabIndex : 0
      }
    },
  )

  watch(
    () => route?.params?.groupName,
    (newGroup) => {
      const urlGroupName = newGroup as string
      if (urlGroupName && currentConfiguration.value) {
        // Find original group name
        for (const [key, config] of Object.entries(
          currentConfiguration.value,
        )) {
          const tableConfig = config as TableConfig
          if (
            tableConfig.group &&
            toUrlFriendly(tableConfig.group) === urlGroupName
          ) {
            groupName.value = tableConfig.group
            break
          }
        }
      } else {
        groupName.value = urlGroupName || ''
      }
      initializeSelectedTable()
    },
  )

  watch(
    groupTables,
    () => {
      initializeSelectedTable()
    },
    { immediate: true },
  )

  // Watch for configuration changes to re-initialize
  watch(
    currentConfiguration,
    (newConfig) => {
      if (newConfig && Object.keys(newConfig).length > 0) {
        // Re-initialize from route when configurations are loaded
        initializeFromRoute()
        initializeSelectedTable()
      }
    },
    { immediate: true },
  )

  // Lifecycle
  onMounted(() => {
    // Initialize from route first
    initializeFromRoute()
    initializeSelectedTable()

    // Force initialization after a delay if needed
    setTimeout(() => {
      if (
        isGroupView.value &&
        !selectedTable.value &&
        Object.keys(groupTables.value).length > 0
      ) {
        const firstTable = Object.keys(groupTables.value)[0]
        selectedTable.value = firstTable
      }
    }, 200)
  })

  return {
    // State
    tableKey,
    groupName,
    selectedTable,
    selectedTabIndex,

    // Computed
    isGroupView,
    groupTables,
    tableConfig,
    selectedTableConfig,
    tabsData,
    resolvedTableKey,

    // Methods
    handleTabChange,
    initializeSelectedTable,
    findTableKeyInConfig,
  }
}
