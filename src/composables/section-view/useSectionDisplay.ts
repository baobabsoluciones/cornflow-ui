import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

export function useSectionDisplay(
  sectionType: any,
  isGroupView: any,
  groupName: any,
  tableConfig: any,
  tableKey: any,
  groupTables: any,
) {
  const { t: $t } = useI18n()

  const getSectionDisplayName = (): string => {
    switch (sectionType.value) {
      case 'configuration':
        return $t('navigation.masterData')
      case 'input-data':
        return $t('navigation.inputData')
      case 'results':
        return $t('navigation.results')
      default:
        return $t('navigation.masterData')
    }
  }

  const title = computed(() => {
    if (isGroupView.value) {
      // Capitalize group name for title
      return groupName.value.charAt(0).toUpperCase() + groupName.value.slice(1)
    }
    return tableConfig.value?.title || tableKey.value
  })

  const description = computed(() => {
    const sectionName = getSectionDisplayName()
    if (isGroupView.value) {
      return `${sectionName} - ${title.value}`
    }
    return `${sectionName} - ${title.value}`
  })

  const currentIcon = computed(() => {
    if (isGroupView.value) {
      // For group view, get icon from first table in group (they should all have the same icon)
      const firstTableKey = Object.keys(groupTables.value)[0]
      const firstTableConfig = firstTableKey
        ? groupTables.value[firstTableKey]
        : null
      return firstTableConfig?.icon || 'mdi-folder-table'
    } else {
      // For single table view, get icon from table config
      return tableConfig.value?.icon || 'mdi-table'
    }
  })

  return {
    title,
    description,
    currentIcon,
    getSectionDisplayName,
  }
}
