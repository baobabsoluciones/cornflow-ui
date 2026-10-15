import { describe, test, expect, beforeEach } from 'vitest'
import appConfig from '@/app/config'

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

  test('declares no execution history filters and lists executions from Cornflow by default', () => {
    const parameters = appConfig.getCore().parameters

    expect(parameters.executionFilters).toEqual([])
    expect(parameters.executionsListEndpoint).toBeNull()
  })
})
