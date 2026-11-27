import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const { runtime, store, messages } = vi.hoisted(() => ({
  store: {
    frontendConfig: null as Record<string, unknown> | null,
    rawConfigurations: null as Record<string, unknown> | null,
    masterDataSections: null as unknown[] | null,
    masterDataGroups: null as unknown[] | null,
  },
  messages: {
    en: { general: {}, createExecution: {}, $vuetify: {} },
    es: { general: {}, createExecution: {}, $vuetify: {}, reports: {} },
  } as Record<string, Record<string, unknown>>,
  runtime: {
    name: 'Planner',
    schema: 'planning',
    schemas: [] as string[],
    backend: 'https://backend.example',
    hasExternalApp: true,
    isDeveloperMode: false,
    isStagingEnvironment: true,
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

vi.mock('@/app/rolesConfig', () => ({
  default: { viewer: { forbidden_views: ['project-execution'], defaultView: 'history-execution' } },
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

  test('leaves out an object inside itself', () => {
    const loop: Record<string, unknown> = { name: 'a', list: [] }
    loop.self = loop
    ;(loop.list as unknown[]).push(loop)
    expect(plainData(loop)).toEqual({ name: 'a', list: [null] })
  })

  test('keeps an object met in two places that do not hold each other', () => {
    const views = ['project-execution']
    expect(
      plainData({ viewer: { forbidden_views: views }, auditor: { forbidden_views: views } }),
    ).toEqual({
      viewer: { forbidden_views: ['project-execution'] },
      auditor: { forbidden_views: ['project-execution'] },
    })
  })

  test('a function alone is null', () => {
    expect(plainData(() => 1)).toBeNull()
  })
})

describe('describeApp', () => {
  beforeEach(() => {
    runtime.schemas = []
    store.frontendConfig = null
    store.rawConfigurations = null
    store.masterDataSections = null
    store.masterDataGroups = null
    setActivePinia(undefined as any)
  })

  test('describes the configuration the app took, as data', () => {
    expect(describeApp()).toEqual({
      name: 'Planner',
      schemas: ['planning'],
      authType: 'azure',
      backendUrl: 'https://backend.example',
      hasExternalApp: true,
      isDeveloperMode: false,
      isStagingEnvironment: true,
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
      rolesConfig: {
        viewer: { forbidden_views: ['project-execution'], defaultView: 'history-execution' },
      },
      helpMenuFiles: [{ labelKey: 'helpMenu.download', publicPath: 'manual.pdf' }],
      dashboards: { solution: [], instance: [] },
      frontendConfig: null,
      masterData: null,
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

  test('has no master tables before the app asked for them', () => {
    setActivePinia(createPinia())
    expect(describeApp().masterData).toBeNull()
  })

  test('gives each master table with its operations, and the sections and groups in order', () => {
    setActivePinia(createPinia())
    store.rawConfigurations = {
      masterData: {
        plants: {
          title: 'Plants',
          _originalTitle: { en: 'Plants', es: 'Plantas' },
          section: 'network',
          _groupKey: 'sites',
          schemas: ['planning'],
          get_list: {
            url: '/plants/',
            http_method: 'get',
            response_schema: { type: 'array' },
            parameters: [
              {
                name: 'limit',
                in: 'query',
                default: 50,
                is_filter: true,
                filter_info: { filter_type: 'limit' },
              },
              { name: 'active', default: true },
              { name: 'id', in: 'path' },
            ],
          },
          download_excel_table: { url: '/plants/excel/', http_method: 'get' },
          icon: 'mdi-factory',
        },
        prices: {
          title: 'Prices',
          get_list: { url: '/prices/', http_method: 'get' },
        },
      },
      inputData: {},
      resultsData: {},
    }
    store.masterDataSections = [{ id: 'network', title: 'Network', order: 1 }]
    store.masterDataGroups = [{ id: 'sites', title: 'Sites', order: 1 }]
    expect(describeApp().masterData).toEqual({
      tables: {
        plants: {
          title: { en: 'Plants', es: 'Plantas' },
          section: 'network',
          group: 'sites',
          schemas: ['planning'],
          operations: {
            get_list: {
              url: '/plants/',
              method: 'get',
              parameters: [
                {
                  name: 'limit',
                  in: 'query',
                  default: 50,
                  filterType: 'limit',
                },
                {
                  name: 'active',
                  in: 'query',
                  default: true,
                  filterType: null,
                },
                { name: 'id', in: 'path', default: null, filterType: null },
              ],
            },
            download_excel_table: {
              url: '/plants/excel/',
              method: 'get',
              parameters: [],
            },
          },
        },
        prices: {
          title: 'Prices',
          section: null,
          group: null,
          schemas: null,
          operations: {
            get_list: { url: '/prices/', method: 'get', parameters: [] },
          },
        },
      },
      sections: [{ id: 'network', title: 'Network', order: 1 }],
      groups: [{ id: 'sites', title: 'Sites', order: 1 }],
    })
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
  afterEach(() => {
    delete window.cornflowUi
    delete window.__cornflowE2E
  })

  test('on a page of the end-to-end suite, publishes describe(), describing the app as it is when called', () => {
    window.__cornflowE2E = true
    publishAppDescription()
    runtime.schemas = ['planning', 'forecast']
    expect(window.cornflowUi?.describe().schemas).toEqual(['planning', 'forecast'])
  })

  test('on any other page, as in production, publishes nothing', () => {
    publishAppDescription()
    expect(window.cornflowUi).toBeUndefined()
  })
})
