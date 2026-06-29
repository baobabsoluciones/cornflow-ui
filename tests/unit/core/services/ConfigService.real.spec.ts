import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'

// Exercises the REAL ConfigService source (the sibling ConfigService.spec.ts
// replaces the module with a re-implementation, so it does not cover the real
// file). Here we control import.meta.env via vi.stubEnv and reset modules to
// get a fresh singleton per test.

vi.mock('@/app/config', () => ({
  default: { getCore: () => ({ parameters: { valuesJsonPath: '/values.json' } }) },
}))

async function freshService() {
  vi.resetModules()
  const mod = await import('@/services/ConfigService')
  return mod.default
}

beforeEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('ConfigService (real) — env-based config', () => {
  test('builds and caches config from VITE_APP_* env vars', async () => {
    vi.stubEnv('VITE_APP_SCHEMA', 'myschema')
    vi.stubEnv('VITE_APP_BACKEND_URL', 'https://api.test')
    vi.stubEnv('VITE_APP_AUTH_TYPE', 'cognito')
    // Blank the azure client id so the assertion is independent of any
    // ambient .env (this repo's .env sets a real VITE_APP_AUTH_CLIENT_ID).
    vi.stubEnv('VITE_APP_AUTH_CLIENT_ID', '')
    vi.stubEnv('VITE_APP_EXTERNAL_APP', '1')
    vi.stubEnv('VITE_APP_USE_HASH_MODE', '1')
    vi.stubEnv('VITE_APP_AUTH_PROVIDERS', 'google,microsoft')
    const svc = await freshService()
    const cfg = await svc.getConfig()
    expect(cfg.schema).toBe('myschema')
    expect(cfg.backend_url).toBe('https://api.test')
    expect(cfg.auth_type).toBe('cognito')
    expect(cfg.hasExternalApp).toBe(true)
    expect(cfg.useHashMode).toBe(true)
    expect(cfg.cognito?.providers).toEqual(['google', 'microsoft'])
    expect(cfg.azure?.client_id).toBe('')

    const again = await svc.getConfig()
    expect(again).toBe(cfg) // cached
  })

  test('defaults auth_type to cornflow and providers to empty', async () => {
    vi.stubEnv('VITE_APP_SCHEMA', 's')
    vi.stubEnv('VITE_APP_BACKEND_URL', '')
    vi.stubEnv('VITE_APP_AUTH_TYPE', '')
    vi.stubEnv('VITE_APP_AUTH_PROVIDERS', '')
    const svc = await freshService()
    const cfg = await svc.getConfig()
    expect(cfg.auth_type).toBe('cornflow')
    expect(cfg.cognito?.providers).toEqual([])
  })
})

describe('ConfigService (real) — fetched config (no env)', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_APP_SCHEMA', '')
    vi.stubEnv('VITE_APP_BACKEND_URL', '')
  })

  test('fetches values.json from the local path on localhost', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: () =>
        Promise.resolve({ schema: 'fetched', backend_url: 'x', auth_type: 'cornflow', name: 'n' }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const svc = await freshService()
    const cfg = await svc.getConfig()
    expect(cfg.schema).toBe('fetched')
    expect(fetchMock).toHaveBeenCalledWith('/values.json')
    // cached: a second call does not re-fetch
    await svc.getConfig()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  test('rejects when the fetch fails', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'))
    vi.stubGlobal('fetch', fetchMock)
    const svc = await freshService()
    await expect(svc.getConfig()).rejects.toThrow('network down')
  })
})

describe('ConfigService (real) — singleton', () => {
  test('getInstance returns the same instance', async () => {
    vi.stubEnv('VITE_APP_SCHEMA', 's')
    vi.resetModules()
    const mod = await import('@/services/ConfigService')
    const a = mod.default
    const b = (a.constructor as any).getInstance()
    expect(a).toBe(b)
  })
})
