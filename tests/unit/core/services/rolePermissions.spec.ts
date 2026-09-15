import { describe, test, expect } from 'vitest'
import {
  isViewAllowed,
  getRoleDefaultView,
  isEndpointAllowed,
  type RolesConfig,
} from '@cornflow-ui/core/services/rolePermissions'

const config: RolesConfig = {
  viewer: {
    forbidden_views: ['project-execution'],
    forbidden_endpoints: ['POST /execution/', 'DELETE /execution/*'],
    defaultView: 'configuration',
  },
  admin: {},
}

describe('rolePermissions.isViewAllowed', () => {
  test('no roles → always allowed (backwards-compatible)', () => {
    expect(isViewAllowed([], 'project-execution', config)).toBe(true)
    expect(isViewAllowed(undefined, 'anything', config)).toBe(true)
  })

  test('forbidden view denied for the configured role', () => {
    expect(isViewAllowed(['viewer'], 'project-execution', config)).toBe(false)
    expect(isViewAllowed(['viewer'], 'dashboard', config)).toBe(true)
  })

  test('unconfigured role adds no restrictions', () => {
    expect(isViewAllowed(['ghost'], 'project-execution', config)).toBe(true)
  })

  test('restrictive union: forbidden if ANY role forbids the view', () => {
    expect(isViewAllowed(['viewer', 'admin'], 'project-execution', config)).toBe(
      false,
    )
  })
})

describe('rolePermissions.getRoleDefaultView', () => {
  test('returns the first role default view, or null', () => {
    expect(getRoleDefaultView(['viewer'], config)).toBe('configuration')
    expect(getRoleDefaultView(['admin'], config)).toBeNull()
    expect(getRoleDefaultView([], config)).toBeNull()
  })
})

describe('rolePermissions.isEndpointAllowed', () => {
  test('exact pattern denied; wildcard matches a single segment', () => {
    expect(isEndpointAllowed(['viewer'], 'POST', '/execution/', config)).toBe(false)
    expect(isEndpointAllowed(['viewer'], 'DELETE', '/execution/42', config)).toBe(
      false,
    )
    expect(isEndpointAllowed(['viewer'], 'GET', '/execution/', config)).toBe(true)
  })

  test('no roles → always allowed', () => {
    expect(isEndpointAllowed([], 'POST', '/execution/', config)).toBe(true)
  })
})
