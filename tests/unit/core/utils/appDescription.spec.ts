import { describe, test, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const { runtime, store, messages } = vi.hoisted(() => ({
  store: { frontendConfig: null as Record<string, unknown> | null },
  messages: {
    en: { general: {}, createExecution: {}, $vuetify: {} },
    es: { general: {}, createExecution: {}, $vuetify: {}, reports: {} },
  } as Record<string, Record<string, unknown>>,
  runtime: {
    name: 'Planner',
    schema: 'planning',
    schemas: [] as string[],
    hasExternalApp: true,
    isDeveloperMode: false,
    auth: { type: 'azure', clientId: 'client-id', authority: 'https://login.example/tenant' },
  },
}))
vi.mock('@cornflow-ui/core/config', () => ({ default: runtime }))

vi.mock('@/app/config', () => ({
  default: {
    getCore: () => ({
      Instance: class Instance {},
      parameters: {
        enableDarkMode: true,
        solverConfig: { showSolverStep: false, defaultSolver: 'default' },
        createExecution: { component: null, proposeName: () => 'name' },
      },
    }),
    getLanguages: () => ['en', 'es'],
    getAppSections: () => [{ titleKey: 'app.reports', icon: 'mdi-chart', to: '/reports' }],
    getHelpMenuFiles: () => [{ labelKey: 'helpMenu.download', publicPath: 'manual.pdf' }],
    getDashboardPages: () => [],
    getInstanceDashboardPages: () => [],
  },
}))

vi.mock('@cornflow-ui/core/plugins/extensions', () => ({
  getRegisteredPremiumModules: () => [{ id: 'frontend-automation' }, { id: 'latest-plan' }],
}))

vi.mock('@cornflow-ui/core/plugins/i18n', () => ({
  default: {
    global: {
      availableLocales: Object.keys(messages),
      getLocaleMessage: (locale: string) => messages[locale],
    },
  },
}))

vi.mock('@cornflow-ui/core/stores/general', () => ({ useGeneralStore: () => store }))

import {
  describeApp,
  plainData,
  publishAppDescription,
} from '@cornflow-ui/core/utils/appDescription'

describe('plainData', () => {
  test('keeps data and leaves functions out', () => {
    expect(plainData({ on: true, count: 2, run: () => 1, list: [1, 'a', null] })).toEqual({
      on: true,
      count: 2,
      list: [1, 'a', null],
    })
  })

  test('leaves out an object it has already met', () => {
    const loop: Record<string, unknown> = { name: 'a' }
    loop.self = loop
    expect(plainData(loop)).toEqual({ name: 'a' })
  })

  test('a function alone is null', () => {
    expect(plainData(() => 1)).toBeNull()
  })
})

describe('describeApp', () => {
  beforeEach(() => {
    runtime.schemas = []
    store.frontendConfig = null
    setActivePinia(undefined as any)
  })

  test('describes the configuration the app took, as data', () => {
    expect(describeApp()).toEqual({
      name: 'Planner',
      schemas: ['planning'],
      authType: 'azure',
      hasExternalApp: true,
      isDeveloperMode: false,
      languages: ['en', 'es'],
      modules: ['frontend-automation', 'latest-plan'],
      core: {
        parameters: {
          enableDarkMode: true,
          solverConfig: { showSolverStep: false, defaultSolver: 'default' },
          createExecution: { component: null },
        },
      },
      appSections: [{ titleKey: 'app.reports', icon: 'mdi-chart', to: '/reports' }],
      helpMenuFiles: [{ labelKey: 'helpMenu.download', publicPath: 'manual.pdf' }],
      dashboards: { solution: [], instance: [] },
      frontendConfig: null,
      i18nNamespaces: ['$vuetify', 'createExecution', 'general', 'reports'],
    })
  })

  test('carries what the backend said about each DAG, once the store has it', () => {
    setActivePinia(createPinia())
    store.frontendConfig = {
      etl: { planning: { exists: true, query: { properties: { week: { type: 'string' } } } } },
      executions: { planning: { list: '/executions/' } },
    }
    expect(describeApp().frontendConfig).toEqual(store.frontendConfig)
  })

  test('has no backend answer before the store exists', () => {
    store.frontendConfig = { executions: { planning: { list: '/executions/' } } }
    expect(describeApp().frontendConfig).toBeNull()
  })

  test('lists the first-level text keys of every language, each once', () => {
    expect(describeApp().i18nNamespaces).toEqual([
      '$vuetify',
      'createExecution',
      'general',
      'reports',
    ])
  })

  test('lists every schema of a deployment on several', () => {
    runtime.schemas = ['planning', 'forecast']
    expect(describeApp().schemas).toEqual(['planning', 'forecast'])
  })

  test('keeps only the provider type of the sign-in settings', () => {
    const text = JSON.stringify(describeApp())
    expect(text).not.toContain('client-id')
    expect(text).not.toContain('login.example')
  })
})

describe('publishAppDescription', () => {
  test('publishes describe() on window, describing the app as it is when called', () => {
    publishAppDescription()
    runtime.schemas = ['planning', 'forecast']
    expect(window.cornflowUi?.describe().schemas).toEqual(['planning', 'forecast'])
  })
})
