import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'

const mockParameters = vi.hoisted(() => ({}) as Record<string, unknown>)

vi.mock('@/app/config', () => ({
  default: { getCore: () => ({ parameters: mockParameters }) },
}))

import { resolveExecutionEndpoint } from '@cornflow-ui/core/utils/executionEndpoints'
import type { FrontendConfig } from '@cornflow-ui/core/utils/frontendConfig'

/** One DAG with its own list only, another with every read of its own. */
const frontendConfig: FrontendConfig = {
  executions: {
    dag_list: { list: '/executions/' },
    dag_all: {
      list: '/executions/',
      details: '/executions/{id}/',
      data: '/executions/{id}/data/',
      instance_data: '/instances/{id}/data/',
    },
  },
}

describe('resolveExecutionEndpoint', () => {
  let warn: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    for (const key of Object.keys(mockParameters)) delete mockParameters[key]
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    warn.mockRestore()
  })

  describe('without a frontend config', () => {
    test.each([
      ['list', undefined, '/execution/'],
      ['details', 'e1', '/execution/e1/'],
      ['data', 'e1', '/execution/e1/data/'],
      ['instance_data', 'i1', '/instance/i1/data/'],
    ] as const)('reads %s from Cornflow', (key, id, path) => {
      expect(resolveExecutionEndpoint(null, 'dag_all', key, id)).toEqual({
        path,
        isExternal: false,
      })
    })

    test('reads the list from executionsListEndpoint when the app declares it', () => {
      mockParameters.executionsListEndpoint = { path: '/app-executions/', isExternal: true }

      expect(resolveExecutionEndpoint(null, 'dag_all', 'list')).toEqual({
        path: '/app-executions/',
        isExternal: true,
      })
    })
  })

  describe('with the routes of the DAG in the frontend config', () => {
    test.each([
      ['list', undefined, '/executions/'],
      ['details', 'e1', '/executions/e1/'],
      ['data', 'e1', '/executions/e1/data/'],
      ['instance_data', 'i1', '/instances/i1/data/'],
    ] as const)('reads %s from the external backend', (key, id, path) => {
      expect(resolveExecutionEndpoint(frontendConfig, 'dag_all', key, id)).toEqual({
        path,
        isExternal: true,
      })
    })

    test('the list of the frontend config comes before executionsListEndpoint', () => {
      mockParameters.executionsListEndpoint = { path: '/app-executions/', isExternal: true }

      expect(resolveExecutionEndpoint(frontendConfig, 'dag_list', 'list')).toEqual({
        path: '/executions/',
        isExternal: true,
      })
    })

    test('a read the DAG leaves out is read from Cornflow', () => {
      expect(resolveExecutionEndpoint(frontendConfig, 'dag_list', 'details', 'e1')).toEqual({
        path: '/execution/e1/',
        isExternal: false,
      })
    })

    test('a DAG the frontend config leaves out reads everything from Cornflow', () => {
      expect(resolveExecutionEndpoint(frontendConfig, 'dag_other', 'list')).toEqual({
        path: '/execution/',
        isExternal: false,
      })
      expect(resolveExecutionEndpoint(frontendConfig, 'dag_other', 'data', 'e1')).toEqual({
        path: '/execution/e1/data/',
        isExternal: false,
      })
    })

    test('the id goes into the path encoded', () => {
      expect(resolveExecutionEndpoint(frontendConfig, 'dag_all', 'details', 'a/b c')).toEqual({
        path: '/executions/a%2Fb%20c/',
        isExternal: true,
      })
    })
  })

  describe('an unusable route', () => {
    test.each([
      ['details', 'not a path', 'e1', '/execution/e1/'],
      ['details', '/executions/', 'e1', '/execution/e1/'],
      ['data', 42, 'e1', '/execution/e1/data/'],
      ['instance_data', '', 'i1', '/instance/i1/data/'],
      ['list', 'executions/', undefined, '/execution/'],
    ])('a %s route %j is ignored for the next source', (key, route, id, path) => {
      const config = { executions: { dag_bad: { [key]: route } } } as FrontendConfig

      expect(
        resolveExecutionEndpoint(config, 'dag_bad', key as 'list', id as string | undefined),
      ).toEqual({ path, isExternal: false })
      expect(warn).toHaveBeenCalled()
    })

    test('warns once, however many times it is read', () => {
      const config = { executions: { dag_once: { details: '/no-id/' } } } as FrontendConfig

      resolveExecutionEndpoint(config, 'dag_once', 'details', 'e1')
      resolveExecutionEndpoint(config, 'dag_once', 'details', 'e2')

      expect(warn).toHaveBeenCalledTimes(1)
    })
  })
})
