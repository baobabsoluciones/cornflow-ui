import { describe, test, expect, vi, beforeEach } from 'vitest'

const { runtime } = vi.hoisted(() => ({
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
    })
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
