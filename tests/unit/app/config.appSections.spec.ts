import { describe, test, expect, beforeEach } from 'vitest'
import appConfig from '@/app/config'

const page = () => Promise.resolve({})

function declareAppSections(sections: unknown[]) {
  ;(
    appConfig as unknown as { config: { appSections: unknown[] } }
  ).config.appSections = sections
}

describe('appSections config collectors', () => {
  beforeEach(() => {
    appConfig.updateConfig()
  })

  test('getInstanceDependentAppRoutePrefixes returns empty by default', () => {
    expect(appConfig.getInstanceDependentAppRoutePrefixes()).toEqual([])
  })

  test('getLoadingOnEnterAppRoutePrefixes returns empty by default', () => {
    expect(appConfig.getLoadingOnEnterAppRoutePrefixes()).toEqual([])
  })

  test('isAppSectionShowsLoadingOnEnter returns false by default', () => {
    expect(appConfig.isAppSectionShowsLoadingOnEnter('/my-page')).toBe(false)
  })

  test('drawer items keep the roles and DAGs a section is declared for', () => {
    declareAppSections([
      {
        path: 'admin-board',
        name: 'Admin board',
        titleKey: 'admin',
        icon: 'mdi-a',
        component: page,
        roles: ['admin'],
        subPages: [
          {
            path: 'stock-board',
            name: 'Stock board',
            titleKey: 'stock',
            icon: 'mdi-b',
            component: page,
            schemas: ['stock_dag'],
          },
        ],
      },
    ])

    const [section] = appConfig.getAppSections()

    expect(section.roles).toEqual(['admin'])
    expect(section.subPages?.[0].schemas).toEqual(['stock_dag'])
  })

  test('routes carry the roles and DAGs in their meta, for the router guard', () => {
    declareAppSections([
      {
        path: 'admin-board',
        name: 'Admin board',
        titleKey: 'admin',
        icon: 'mdi-a',
        component: page,
        roles: ['admin'],
        schemas: ['planning_dag'],
      },
      {
        path: 'open-board',
        name: 'Open board',
        titleKey: 'open',
        icon: 'mdi-b',
        component: page,
      },
    ])

    const [gated, open] = appConfig.getAppSectionRoutes()

    expect(gated.meta).toEqual({
      showsLoadingOnEnter: false,
      roles: ['admin'],
      schemas: ['planning_dag'],
    })
    expect(open.meta).toEqual({ showsLoadingOnEnter: false })
  })

  test('multi-DAG and executions history settings default to none', () => {
    const parameters = appConfig.getCore().parameters

    expect(parameters.schemaLabels).toEqual({})
    expect(parameters.executionFilters).toEqual([])
    expect(parameters.executionsListEndpoint).toBeNull()
  })
})
