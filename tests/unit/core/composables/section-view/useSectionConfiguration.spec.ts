import { describe, test, expect, vi, beforeEach } from 'vitest'

// ─── Mocks ───────────────────────────────────────────────────────────────────

const route = vi.hoisted(() => ({ path: '/configuration' }))
vi.mock('vue-router', () => ({
  useRoute: () => route,
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ locale: { value: 'en' } }),
}))

let storeState: any
vi.mock('@cornflow-ui/core/stores/general', () => ({
  useGeneralStore: () => storeState,
}))

const mockGetSectionType = vi.fn((path: string) => {
  if (path.includes('input')) return 'input-data'
  if (path.includes('results')) return 'results'
  return 'configuration'
})
const mockGetConfigurationBySection = vi.fn(
  (_configs: any, section: string) => ({ __section: section, tableA: {} }),
)
const mockFilterValidationTables = vi.fn((config: any) => ({
  ...config,
  __filtered: true,
}))
const mockEnrichConfig = vi.fn((config: any) => ({ ...config, __enriched: true }))
vi.mock('@cornflow-ui/core/services/FrontendAutomationService', () => ({
  getSectionType: (p: string) => mockGetSectionType(p),
  getConfigurationBySection: (c: any, s: string) =>
    mockGetConfigurationBySection(c, s),
  filterValidationTablesWithData: (c: any, d: any) =>
    mockFilterValidationTables(c, d),
  enrichConfigWithChecksData: (c: any, d: any, l: any) =>
    mockEnrichConfig(c, d, l),
}))

const mockApplyKpi = vi.fn((config: any) => ({ ...config, __kpi: true }))
vi.mock('@cornflow-ui/core/utils/kpiTableUtils', () => ({
  applyKpiDisplayMode: (...args: any[]) => mockApplyKpi(...args),
}))

import { useSectionConfiguration } from '@cornflow-ui/core/composables/section-view/useSectionConfiguration'

beforeEach(() => {
  vi.clearAllMocks()
  route.path = '/configuration'
  storeState = {
    getConfigurations: { some: 'config' },
    selectedExecution: null,
    appConfig: { parameters: {} },
  }
})

describe('useSectionConfiguration', () => {
  test('sectionType reflects route path', () => {
    route.path = '/input-data'
    const { sectionType } = useSectionConfiguration()
    expect(sectionType.value).toBe('input-data')
  })

  test('returns empty object when no configurations', () => {
    storeState.getConfigurations = null
    const { currentConfiguration } = useSectionConfiguration()
    expect(currentConfiguration.value).toEqual({})
  })

  test('configuration section: returns plain config without filtering', () => {
    route.path = '/configuration'
    const { currentConfiguration } = useSectionConfiguration()
    const cfg = currentConfiguration.value
    expect(cfg.__section).toBe('configuration')
    // No validation filtering for configuration section
    expect(mockFilterValidationTables).not.toHaveBeenCalled()
  })

  test('input-data with selectedExecution enriches and filters validation tables', () => {
    route.path = '/input-data'
    storeState.selectedExecution = {
      experiment: { instance: { id: 'inst-1' } },
    }
    const { currentConfiguration } = useSectionConfiguration()
    const cfg = currentConfiguration.value
    expect(mockEnrichConfig).toHaveBeenCalled()
    expect(mockFilterValidationTables).toHaveBeenCalled()
    expect(cfg.__filtered).toBe(true)
  })

  test('input-data without dataSource skips enrichment', () => {
    route.path = '/input-data'
    storeState.selectedExecution = { experiment: {} } // no instance
    const { currentConfiguration } = useSectionConfiguration()
    currentConfiguration.value
    expect(mockEnrichConfig).not.toHaveBeenCalled()
  })

  test('results section applies kpi display mode when enabled', () => {
    route.path = '/results'
    storeState.selectedExecution = {
      solution: { rawKpis: { kpi1: 1 } },
    }
    storeState.appConfig = {
      parameters: { kpiTablesDisplayMode: 'tables' },
    }
    const { currentConfiguration } = useSectionConfiguration()
    const cfg = currentConfiguration.value
    expect(mockApplyKpi).toHaveBeenCalled()
    expect(cfg.__kpi).toBe(true)
  })

  test('results section with kpi mode disabled does not apply kpi', () => {
    route.path = '/results'
    storeState.selectedExecution = {
      solution: { rawKpis: { kpi1: 1 } },
    }
    storeState.appConfig = { parameters: { kpiTablesDisplayMode: 'disabled' } }
    const { currentConfiguration } = useSectionConfiguration()
    currentConfiguration.value
    expect(mockApplyKpi).not.toHaveBeenCalled()
  })

  test('results section falls back to instance/solution when no experiment', () => {
    route.path = '/results'
    storeState.selectedExecution = {
      solution: { rawKpis: null },
    }
    storeState.appConfig = { parameters: {} } // kpiMode defaults to disabled
    const { currentConfiguration } = useSectionConfiguration()
    currentConfiguration.value
    expect(mockEnrichConfig).toHaveBeenCalled()
  })
})
