import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'

const { getConfigMock, getCoreMock } = vi.hoisted(() => ({
  getConfigMock: vi.fn(),
  getCoreMock: vi.fn(() => ({ parameters: { valuesJsonPath: '/v.json' } })),
}))
vi.mock('@cornflow-ui/core/services/ConfigService', () => ({ default: { getConfig: getConfigMock } }))
vi.mock('@/app/config', () => ({ default: { getCore: getCoreMock } }))

import config from '@cornflow-ui/core/config'

beforeEach(() => {
  vi.clearAllMocks()
  // The test env may define these; blank them so initConfig defaults to the
  // values.json branch. Tests that exercise the env branch re-stub them.
  vi.stubEnv('VITE_APP_SCHEMA', '')
  vi.stubEnv('VITE_APP_BACKEND_URL', '')
  vi.stubEnv('VITE_APP_AUTH_TYPE', '')
  vi.stubEnv('VITE_APP_AUTH_PROVIDERS', '')
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('config - OAuth provider helpers', () => {
  test('cornflow auth reports nothing configured', () => {
    config.auth = { type: 'cornflow' } as any
    expect(config.isMicrosoftConfigured()).toBe(false)
    expect(config.isGoogleConfigured()).toBe(false)
    expect(config.getConfiguredOAuthProvider()).toBe('none')
  })

  test('azure is Microsoft when clientId + authority are present', () => {
    config.auth = { type: 'azure', clientId: 'c', authority: 'a' } as any
    expect(config.isMicrosoftConfigured()).toBe(true)
    expect(config.isGoogleConfigured()).toBe(false)
    expect(config.getConfiguredOAuthProvider()).toBe('microsoft')
  })

  test('cognito reflects its providers list', () => {
    config.auth = {
      type: 'cognito',
      clientId: 'c',
      region: 'r',
      userPoolId: 'p',
      providers: ['Microsoft', 'google'],
    } as any
    expect(config.isMicrosoftConfigured()).toBe(true)
    expect(config.isGoogleConfigured()).toBe(true)
    expect(config.getConfiguredOAuthProvider()).toBe('both')
  })

  test('cognito without provider list configures neither', () => {
    config.auth = { type: 'cognito', clientId: 'c', region: 'r', userPoolId: 'p', providers: [] } as any
    expect(config.isMicrosoftConfigured()).toBe(false)
    expect(config.isGoogleConfigured()).toBe(false)
    expect(config.getConfiguredOAuthProvider()).toBe('none')
  })
})

describe('config - initConfig', () => {
  test('uses values.json when no env config is present (cognito auth)', async () => {
    getConfigMock.mockResolvedValueOnce({
      backend_url: 'http://api',
      schema: 'sch',
      name: 'App',
      hasExternalApp: 'true',
      auth_type: 'cognito',
      cognito: { client_id: 'c', region: 'r', user_pool_id: 'p', domain: 'd', providers: ['google'] },
    })
    await config.initConfig()
    expect(config.backend).toBe('http://api')
    expect(config.schema).toBe('sch')
    expect(config.hasExternalApp).toBe(true)
    expect(config.auth.type).toBe('cognito')
    expect(config.auth.clientId).toBe('c')
  })

  test('maps azure auth from values.json', async () => {
    getConfigMock.mockResolvedValueOnce({
      backend_url: 'b',
      auth_type: 'azure',
      azure: { client_id: 'ac', authority: 'au', redirect_uri: 'ru' },
    })
    await config.initConfig()
    expect(config.auth).toMatchObject({ type: 'azure', clientId: 'ac', authority: 'au', redirectUri: 'ru' })
  })

  test('falls back to cornflow when auth_type is unknown', async () => {
    getConfigMock.mockResolvedValueOnce({ backend_url: 'b', auth_type: 'other' })
    await config.initConfig()
    expect(config.auth).toEqual({ type: 'cornflow' })
  })

  test('reads from env vars when VITE_APP_SCHEMA is set', async () => {
    vi.stubEnv('VITE_APP_SCHEMA', 'env-schema')
    vi.stubEnv('VITE_APP_BACKEND_URL', 'env-backend')
    vi.stubEnv('VITE_APP_AUTH_TYPE', 'azure')
    await config.initConfig()
    expect(config.schema).toBe('env-schema')
    expect(config.backend).toBe('env-backend')
    expect(config.auth.type).toBe('azure')
    expect(getConfigMock).not.toHaveBeenCalled()
  })

  test('falls back to env vars when values.json loading throws', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    getConfigMock.mockRejectedValueOnce(new Error('no file'))
    await config.initConfig()
    expect(spy).toHaveBeenCalled()
    expect(config.auth.type).toBe('cornflow') // env default
  })
})
