import { describe, test, expect, vi, beforeEach } from 'vitest'
import { computed } from 'vue'
import { createPinia, setActivePinia } from 'pinia'

const mockParameters = vi.hoisted(() => ({
  enableRecalculationOnMasterEdit: true,
}))
const mockSchemaOverrides = vi.hoisted(() => ({
  stock_dag: { parameters: { enableRecalculationOnMasterEdit: false } },
}))
vi.mock('@/app/config', () => ({
  default: {
    getCore: () => ({
      parameters: mockParameters,
      schemaOverrides: mockSchemaOverrides,
    }),
    getDashboardRoutes: () => [],
    getDashboardPages: () => [],
    getDashboardLayout: () => [],
    getInstanceDashboardRoutes: () => [],
    getInstanceDashboardPages: () => [],
    getInstanceDashboardLayout: () => [],
  },
}))
vi.mock('@cornflow-ui/core/config', () => ({
  default: {
    schema: 'planning_dag',
    schemas: ['planning_dag', 'stock_dag'],
    auth: { type: 'cornflow' },
    initConfig: vi.fn().mockResolvedValue(undefined),
  },
}))
vi.mock('@cornflow-ui/core/utils/assets', () => ({
  mainLogo: 'logo.png',
  fullLogo: 'full_logo.png',
}))

import { getAppParameters } from '@cornflow-ui/core/utils/appParameters'
import { useGeneralStore } from '@cornflow-ui/core/stores/general'

describe('getAppParameters', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockParameters.enableRecalculationOnMasterEdit = true
  })

  test('a computed that reads it follows the settings of the active DAG', () => {
    const store = useGeneralStore()
    const replans = computed(
      () => getAppParameters().enableRecalculationOnMasterEdit,
    )
    expect(replans.value).toBe(true)

    store.schema = 'stock_dag'
    store.applyAppConfigForSchema()

    expect(replans.value).toBe(false)

    store.schema = 'planning_dag'
    store.applyAppConfigForSchema()

    expect(replans.value).toBe(true)
  })
})
