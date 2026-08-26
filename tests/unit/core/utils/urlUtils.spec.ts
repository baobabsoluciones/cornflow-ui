import { describe, test, expect } from 'vitest'
import { buildApiUrl } from '@cornflow-ui/core/utils/urlUtils'

describe('buildApiUrl', () => {
  describe('new format {key}', () => {
    test('replaces a single parameter', () => {
      expect(buildApiUrl('/api/users/{id}', { id: 42 })).toBe('/api/users/42')
    })

    test('replaces multiple parameters', () => {
      const url = buildApiUrl('/api/{resource}/{id}', {
        resource: 'users',
        id: 7,
      })
      expect(url).toBe('/api/users/7')
    })
  })

  describe('old format <int:key>', () => {
    test('replaces a single int parameter', () => {
      expect(buildApiUrl('/api/users/<int:id>', { id: 99 })).toBe(
        '/api/users/99',
      )
    })

    test('replaces multiple int parameters', () => {
      const url = buildApiUrl('/api/<int:projectId>/tasks/<int:taskId>', {
        projectId: 1,
        taskId: 5,
      })
      expect(url).toBe('/api/1/tasks/5')
    })
  })

  describe('old format <key>', () => {
    test('replaces a single parameter', () => {
      expect(buildApiUrl('/api/users/<id>', { id: 'abc' })).toBe(
        '/api/users/abc',
      )
    })

    test('replaces multiple parameters', () => {
      const url = buildApiUrl('/api/<resource>/<id>', {
        resource: 'projects',
        id: 10,
      })
      expect(url).toBe('/api/projects/10')
    })
  })

  describe('mixed formats', () => {
    test('replaces parameters in different formats within the same URL', () => {
      const url = buildApiUrl('/api/{version}/<int:projectId>/<name>', {
        version: 'v2',
        projectId: 3,
        name: 'test',
      })
      expect(url).toBe('/api/v2/3/test')
    })
  })

  describe('no params / empty params', () => {
    test('returns base URL when no params argument is provided', () => {
      expect(buildApiUrl('/api/users')).toBe('/api/users')
    })

    test('returns base URL when params is an empty object', () => {
      expect(buildApiUrl('/api/users', {})).toBe('/api/users')
    })

    test('leaves placeholders intact when params do not match', () => {
      expect(buildApiUrl('/api/users/{id}', { name: 'foo' })).toBe(
        '/api/users/{id}',
      )
    })
  })

  describe('value coercion', () => {
    test('converts numeric values to string', () => {
      expect(buildApiUrl('/api/{id}', { id: 0 })).toBe('/api/0')
    })

    test('converts boolean values to string', () => {
      expect(buildApiUrl('/api/{flag}', { flag: true })).toBe('/api/true')
    })
  })
})
