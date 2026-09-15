import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import type { TableConfig } from './useSectionConfiguration'
import {
  fromUrlFriendly,
  toUrlFriendly,
  getMasterDataTableRankByDrawerHierarchy,
  normalizeTableKeyForHierarchyMatch,
} from '@cornflow-ui/core/services/FrontendAutomationService'
import { useGeneralStore } from '@cornflow-ui/core/stores/general'
import { resolveTitle } from '@cornflow-ui/core/utils/i18nUtils'
import { formatTitle } from '@cornflow-ui/core/utils/schemaUtils'

// Types
export interface TabData {
  value: string
  text: string
}

export function useGroupTables(currentConfiguration: any, sectionType: any) {
  const route = useRoute()
  const router = useRouter()
  const generalStore = useGeneralStore()
  const { locale } = useI18n()

  // State - convert URL-friendly params back to original keys
  const tableKey = ref<string>('')
  const groupName = ref<string>('')

  // Resolve URL group param to the display group title. URL uses schema group id
  const resolveGroupNameFromUrl = (urlGroupName: string): string => {
    if (!currentConfiguration.value) return ''
    for (const [, config] of Object.entries(currentConfiguration.value)) {
      const tableConfig = config as TableConfig
      if (!tableConfig.group) continue
      const urlMatchesTitle = toUrlFriendly(tableConfig.group) === urlGroupName
      const urlMatchesGroupKey =
        tableConfig._groupKey != null &&
        (tableConfig._groupKey === urlGroupName ||
          toUrlFriendly(tableConfig._groupKey) === urlGroupName)
      if (urlMatchesTitle || urlMatchesGroupKey) {
        return tableConfig.group
      }
    }
    return ''
  }

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
      groupName.value = resolveGroupNameFromUrl(urlGroupName) || urlGroupName
    } else {
      groupName.value = ''
    }
  }
  const selectedTable = ref<string | null>(null)
  const selectedTabIndex = ref<number>(0)

  // Computed
  const isGroupView = computed(() => {
    return !!groupName.value
  })

  const masterRankByNormalizedTableKey = computed(() => {
    const masterData = generalStore.getConfigurations?.masterData
    if (!masterData || typeof masterData !== 'object') {
      return new Map<string, number>()
    }
    return getMasterDataTableRankByDrawerHierarchy(
      masterData,
      generalStore.masterDataSections ?? undefined,
      generalStore.masterDataGroups ?? undefined,
    )
  })

  const groupTables = computed(() => {
    if (!isGroupView.value || !currentConfiguration.value) return {}
    const name = groupName.value
    const matchingEntries: Array<[string, TableConfig]> = []
    Object.entries(currentConfiguration.value).forEach(([key, config]) => {
      const tableConfig = config as TableConfig
      const configGroup =
        tableConfig.group === null ? 'null' : tableConfig.group
      const matchesByTitle = configGroup === name
      const matchesByGroupKey =
        tableConfig._groupKey != null &&
        (tableConfig._groupKey === name ||
          toUrlFriendly(tableConfig._groupKey) === name)
      if (matchesByTitle || matchesByGroupKey) {
        matchingEntries.push([key, tableConfig])
      }
    })
    matchingEntries.sort((a, b) => {
      const aCfg = a[1] as any
      const bCfg = b[1] as any
      const aOwnOrder = aCfg?.order
      const bOwnOrder = bCfg?.order

      // For instance tables, if local order is missing, use the same master
      // hierarchy rank as AppDrawer (section -> group -> table) when names match.
      const aMasterRank =
        sectionType.value === 'input-data'
          ? masterRankByNormalizedTableKey.value.get(
              normalizeTableKeyForHierarchyMatch(a[0]),
            )
          : undefined
      const aEffectiveOrder =
        typeof aOwnOrder === 'number' && Number.isFinite(aOwnOrder)
          ? aOwnOrder
          : aMasterRank
      const bMasterRank =
        sectionType.value === 'input-data'
          ? masterRankByNormalizedTableKey.value.get(
              normalizeTableKeyForHierarchyMatch(b[0]),
            )
          : undefined
      const bEffectiveOrder =
        typeof bOwnOrder === 'number' && Number.isFinite(bOwnOrder)
          ? bOwnOrder
          : bMasterRank

      const aRank = aEffectiveOrder ?? Number.POSITIVE_INFINITY
      const bRank = bEffectiveOrder ?? Number.POSITIVE_INFINITY
      return aRank - bRank
    })
    const tablesInGroup: Record<string, TableConfig> = {}
    matchingEntries.forEach(([key, config]) => {
      tablesInGroup[key] = config
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
    const normalizedSearchKey = searchKey.toLowerCase().replaceAll('-', '_')
    for (const key of Object.keys(config)) {
      const normalizedKey = key.toLowerCase().replaceAll('-', '_')
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
    // Read the locale so titles recompute when the language changes.
    // (The guard never triggers — locale is always a string — it only
    // registers the reactive dependency without a bare/void expression.)
    if (locale.value === undefined) return []
    return Object.entries(groupTables.value).map(([key, config]) => {
      const cfg = config
      const raw = cfg.title as string | Record<string, string> | undefined | null
      const fallback = formatTitle(key.replaceAll('-', '_'))
      const text =
        raw == null
          ? fallback
          : resolveTitle(raw, fallback)
      return {
        value: key,
        text,
      }
    })
  })

  /**
   * True while a tab switch is in flight. Set synchronously on click and
   * cleared two rAFs after the actual table change, so consumers (CoreTable /
   * SectionView) can show a loading overlay that is *painted before* the
   * heavy reactivity work runs. Without the deferral below, the spinner
   * would only become visible after the freeze, defeating the purpose.
   */
  const tableSwitching = ref(false)
  let tableSwitchingClearHandle: ReturnType<typeof requestAnimationFrame> | null =
    null

  // Two rAFs: first lets Vue commit + the browser paint the new table;
  // second clears the overlay after that paint is on screen.
  const clearTableSwitchingAfterPaint = () => {
    tableSwitchingClearHandle = requestAnimationFrame(() => {
      tableSwitchingClearHandle = requestAnimationFrame(() => {
        tableSwitching.value = false
        tableSwitchingClearHandle = null
      })
    })
  }

  const handleTabChange = (tabIndex: number) => {
    const tableKeyValue = tabsData.value[tabIndex]?.value
    selectedTabIndex.value = tabIndex
    if (!tableKeyValue || tableKeyValue === selectedTable.value) return

    tableSwitching.value = true
    if (tableSwitchingClearHandle != null) {
      cancelAnimationFrame(tableSwitchingClearHandle)
      tableSwitchingClearHandle = null
    }

    // Yield to the browser so it paints the overlay before the synchronous
    // reactivity cascade (heavy computeds, header rebuild, virtual scroll
    // mount) blocks the main thread. setTimeout(..., 0) is enough — we just
    // need a single task boundary between the click and the switch.
    setTimeout(() => {
      selectedTable.value = tableKeyValue
      if (isGroupView.value) {
        const basePath = `/${sectionType.value}/group/${toUrlFriendly(groupName.value)}`
        router.push(`${basePath}/${toUrlFriendly(tableKeyValue)}`)
      }
      clearTableSwitchingAfterPaint()
    }, 0)
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
        selectedTabIndex.value = Math.max(tabIndex, 0)

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
        selectedTabIndex.value = Math.max(tabIndex, 0)
      }
    },
  )

  watch(
    () => route?.params?.groupName,
    (newGroup) => {
      const urlGroupName = newGroup as string
      if (urlGroupName && currentConfiguration.value) {
        groupName.value = urlGroupName
        for (const config of Object.values(currentConfiguration.value)) {
          const tableConfig = config as TableConfig
          if (!tableConfig.group) continue
          const urlMatchesTitle =
            toUrlFriendly(tableConfig.group) === urlGroupName
          const urlMatchesGroupKey =
            tableConfig._groupKey != null &&
            (tableConfig._groupKey === urlGroupName ||
              toUrlFriendly(tableConfig._groupKey) === urlGroupName)
          if (urlMatchesTitle || urlMatchesGroupKey) {
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

    // Loading state for the UI overlay
    tableSwitching,
  }
}
