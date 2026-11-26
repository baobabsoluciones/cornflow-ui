import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'

const mockParameters = vi.hoisted(() => ({}) as Record<string, unknown>)

vi.mock('@/app/config', () => ({
  default: { getCore: () => ({ parameters: mockParameters }) },
}))

import { resolveExecutionEndpoint } from '@cornflow-ui/core/utils/executionEndpoints'
import type { FrontendConfig } from '@cornflow-ui/core/utils/frontendConfig'

/** One DAG with its own list only, another with every operation of its own. */
const frontendConfig: FrontendConfig = {
  executions: {
    dag_list: { get_list: '/executions/' },
    dag_all: {
      get_list: '/executions/',
      get_detail: '/executions/{id}/',
      put_detail: '/executions/{id}/solution/',
      delete_detail: '/executions/{id}/',
      get_data: '/executions/{id}/data/',
      get_instance_data: '/instances/{id}/data/',
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
      ['get_list', undefined, '/execution/'],
      ['get_detail', 'e1', '/execution/e1/'],
      ['put_detail', 'e1', '/execution/e1/'],
      ['delete_detail', 'e1', '/execution/e1/'],
      ['get_data', 'e1', '/execution/e1/data/'],
      ['get_instance_data', 'i1', '/instance/i1/data/'],
    ] as const)('sends %s to Cornflow', (key, id, path) => {
      expect(resolveExecutionEndpoint(null, 'dag_all', key, id)).toEqual({
        path,
        isExternal: false,
      })
    })

    test('reads the list from executionsListEndpoint when the app declares it', () => {
      mockParameters.executionsListEndpoint = { path: '/app-executions/', isExternal: true }

      expect(resolveExecutionEndpoint(null, 'dag_all', 'get_list')).toEqual({
        path: '/app-executions/',
        isExternal: true,
      })
    })
  })

  describe('with the routes of the DAG in the frontend config', () => {
    test.each([
      ['get_list', undefined, '/executions/'],
      ['get_detail', 'e1', '/executions/e1/'],
      ['put_detail', 'e1', '/executions/e1/solution/'],
      ['delete_detail', 'e1', '/executions/e1/'],
      ['get_data', 'e1', '/executions/e1/data/'],
      ['get_instance_data', 'i1', '/instances/i1/data/'],
    ] as const)('sends %s to the external backend', (key, id, path) => {
      expect(resolveExecutionEndpoint(frontendConfig, 'dag_all', key, id)).toEqual({
        path,
        isExternal: true,
      })
    })

    test('the list of the frontend config comes before executionsListEndpoint', () => {
      mockParameters.executionsListEndpoint = { path: '/app-executions/', isExternal: true }

      expect(resolveExecutionEndpoint(frontendConfig, 'dag_list', 'get_list')).toEqual({
        path: '/executions/',
        isExternal: true,
      })
    })

    test('an operation the DAG leaves out goes to Cornflow', () => {
      expect(resolveExecutionEndpoint(frontendConfig, 'dag_list', 'get_detail', 'e1')).toEqual({
        path: '/execution/e1/',
        isExternal: false,
      })
    })

    test('each operation on one execution goes where the DAG declares it', () => {
      const config: FrontendConfig = {
        executions: { dag_read: { get_detail: '/executions/{id}/' } },
      }

      expect(resolveExecutionEndpoint(config, 'dag_read', 'get_detail', 'e1')).toEqual({
        path: '/executions/e1/',
        isExternal: true,
      })
      expect(resolveExecutionEndpoint(config, 'dag_read', 'put_detail', 'e1')).toEqual({
        path: '/execution/e1/',
        isExternal: false,
      })
      expect(resolveExecutionEndpoint(config, 'dag_read', 'delete_detail', 'e1')).toEqual({
        path: '/execution/e1/',
        isExternal: false,
      })
    })

    test('a DAG the frontend config leaves out reads everything from Cornflow', () => {
      expect(resolveExecutionEndpoint(frontendConfig, 'dag_other', 'get_list')).toEqual({
        path: '/execution/',
        isExternal: false,
      })
      expect(resolveExecutionEndpoint(frontendConfig, 'dag_other', 'get_data', 'e1')).toEqual({
        path: '/execution/e1/data/',
        isExternal: false,
      })
    })

    test('the id goes into the path encoded', () => {
      expect(resolveExecutionEndpoint(frontendConfig, 'dag_all', 'get_detail', 'a/b c')).toEqual({
        path: '/executions/a%2Fb%20c/',
        isExternal: true,
      })
    })
  })

  describe('an unusable route', () => {
    test.each([
      ['get_detail', 'not a path', 'e1', '/execution/e1/'],
      ['put_detail', '/executions/', 'e1', '/execution/e1/'],
      ['get_data', 42, 'e1', '/execution/e1/data/'],
      ['get_instance_data', '', 'i1', '/instance/i1/data/'],
      ['get_list', 'executions/', undefined, '/execution/'],
    ])('a %s route %j is ignored for the next source', (key, route, id, path) => {
      const config = { executions: { dag_bad: { [key]: route } } } as FrontendConfig

      expect(
        resolveExecutionEndpoint(config, 'dag_bad', key as 'get_list', id as string | undefined),
      ).toEqual({ path, isExternal: false })
      expect(warn).toHaveBeenCalled()
    })

    test('warns once, however many times it is read', () => {
      const config = { executions: { dag_once: { get_detail: '/no-id/' } } } as FrontendConfig

      resolveExecutionEndpoint(config, 'dag_once', 'get_detail', 'e1')
      resolveExecutionEndpoint(config, 'dag_once', 'get_detail', 'e2')

      expect(warn).toHaveBeenCalledTimes(1)
    })
  })
})
