import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useGeneralStore } from '@cornflow-ui/core/stores/general'
import {
  getSectionType,
  getConfigurationBySection,
  filterValidationTablesWithData,
  enrichConfigWithChecksData,
} from '@cornflow-ui/core/services/FrontendAutomationService'
import { applyKpiDisplayMode } from '@cornflow-ui/core/utils/kpiTableUtils'

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
  const { locale } = useI18n()

  const sectionType = computed(() => {
    return getSectionType(route.path)
  })

  const currentConfiguration = computed(() => {
    const configurations = generalStore.getConfigurations
    if (!configurations) return {}

    let config = getConfigurationBySection(configurations, sectionType.value)

    const shouldFilterValidationTables =
      sectionType.value === 'input-data' || sectionType.value === 'results'

    if (shouldFilterValidationTables && generalStore.selectedExecution) {
      const executionData = generalStore.selectedExecution

      let dataSource
      if (sectionType.value === 'input-data') {
        dataSource =
          executionData.experiment?.instance || executionData.instance
      } else if (sectionType.value === 'results') {
        dataSource =
          executionData.experiment?.solution || executionData.solution
      }

      if (dataSource) {
        config = enrichConfigWithChecksData(config, dataSource, locale.value)
        config = filterValidationTablesWithData(config, dataSource)
      }

      if (sectionType.value === 'results') {
        const kpiMode =
          generalStore.appConfig?.parameters?.kpiTablesDisplayMode ?? 'disabled'
        if (kpiMode !== 'disabled') {
          const solution =
            executionData.experiment?.solution || executionData.solution
          const rawKpis = solution?.rawKpis ?? null
          config = applyKpiDisplayMode(config, rawKpis, kpiMode, locale.value)
        }
      }
    }

    return config
  })

  return {
    sectionType,
    currentConfiguration,
  }
}
