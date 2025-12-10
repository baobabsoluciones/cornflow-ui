import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useGeneralStore } from '@/stores/general'
import {
  getSectionType,
  getConfigurationBySection,
  filterValidationTablesWithData,
} from '@/services/FrontendAutomationService'

// Types
export interface TableConfig {
  title: string
  icon?: string
  group?: string | null
  [key: string]: any
}

export function useSectionConfiguration() {
  const route = useRoute()
  const generalStore = useGeneralStore()

  const sectionType = computed(() => {
    return getSectionType(route.path)
  })

  const currentConfiguration = computed(() => {
    const configurations = generalStore.getConfigurations
    if (!configurations) return {}

    let config = getConfigurationBySection(configurations, sectionType.value)

    // Filter validation tables without data for input-data and results sections
    const shouldFilterValidationTables =
      sectionType.value === 'input-data' || sectionType.value === 'results'

    if (shouldFilterValidationTables && generalStore.selectedExecution) {
      const executionData = generalStore.selectedExecution

      // Get the appropriate data source based on section type
      let dataSource
      if (sectionType.value === 'input-data') {
        dataSource =
          executionData.experiment?.instance || executionData.instance
      } else if (sectionType.value === 'results') {
        dataSource =
          executionData.experiment?.solution || executionData.solution
      }

      // Apply the filter if we have data source
      if (dataSource) {
        config = filterValidationTablesWithData(config, dataSource)
      }
    }

    return config
  })

  return {
    sectionType,
    currentConfiguration,
  }
}
