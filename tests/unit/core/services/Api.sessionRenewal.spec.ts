import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'

const mockConfig = vi.hoisted(() => ({
  backend: 'http://cornflow.test',
  auth: { type: 'cornflow' },
  hasExternalApp: false,
  initConfig: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@cornflow-ui/core/config', () => ({ default: mockConfig }))

const mockRouter = vi.hoisted(() => ({
  push: vi.fn(),
  currentRoute: { value: { fullPath: '/history-execution?tab=2' } },
}))
vi.mock('@cornflow-ui/core/router', () => ({ default: mockRouter, getRouter: () => mockRouter }))

import apiClient from '@cornflow-ui/core/api/Api'

const json = (status: number, body: object) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const EXPIRED = { error: 'The token has expired, please login again' }

/**
 * A Cornflow server with refresh-token sessions: only `Bearer fresh-token` is accepted; anything
 * else is answered with the expired-token rejection (`expiredStatus`: 400 today, 401 on newer servers).
 */
function serve(options: { expiredStatus?: number; refresh?: () => Response } = {}) {
  const {
    expiredStatus = 400,
    refresh = () => json(200, { token: 'fresh-token', refresh_token: 'refresh-2', id: 1 }),
  } = options
  const calls = { refresh: [] as any[], data: 0 }
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: any) => {
      if (url.endsWith('/token/refresh/')) {
        calls.refresh.push(JSON.parse(init.body))
        await new Promise((resolve) => setTimeout(resolve, 5))
        return refresh()
      }
      calls.data++
      return init.headers.Authorization === 'Bearer fresh-token'
        ? json(200, { data: url })
        : json(expiredStatus, EXPIRED)
    }),
  )
  return calls
}

function signedIn(refreshToken: string | null) {
  sessionStorage.setItem('isAuthenticated', 'true')
  sessionStorage.setItem('token', 'old-token')
  if (refreshToken) sessionStorage.setItem('refreshToken', refreshToken)
  apiClient.initializeToken()
}

describe('a session that renews itself (database auth with refresh tokens)', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.clearAllMocks()
    mockRouter.currentRoute.value.fullPath = '/history-execution?tab=2'
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    apiClient['authToken'] = null
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  test.each([400, 401])('an expired token (%i) is renewed and the request is repeated', async (expiredStatus) => {
    const calls = serve({ expiredStatus })
    signedIn('refresh-1')

    const response = await apiClient.get('/execution/')

    expect(response.status).toBe(200)
    expect(calls.refresh).toEqual([{ refresh_token: 'refresh-1' }])
    expect(sessionStorage.getItem('token')).toBe('fresh-token')
    expect(sessionStorage.getItem('refreshToken')).toBe('refresh-2')
    expect(sessionStorage.getItem('isAuthenticated')).toBe('true')
    expect(mockRouter.push).not.toHaveBeenCalled()
  })

  test('requests that expire together share one renewal', async () => {
    const calls = serve()
    signedIn('refresh-1')

    const responses = await Promise.all([
      apiClient.get('/execution/'),
      apiClient.get('/instance/'),
      apiClient.post('/case/', { name: 'x' }),
    ])

    expect(responses.map((r) => r.status)).toEqual([200, 200, 200])
    expect(calls.refresh).toHaveLength(1)
  })

  test('a rejected renewal ends the session and remembers the page to come back to', async () => {
    serve({ refresh: () => json(401, { error: 'The session has expired, please log in again' }) })
    signedIn('refresh-1')

    await expect(apiClient.get('/execution/')).rejects.toThrow('Session expired')

    expect(sessionStorage.getItem('isAuthenticated')).toBe('false')
    expect(sessionStorage.getItem('token')).toBeNull()
    expect(sessionStorage.getItem('refreshToken')).toBeNull()
    await vi.waitFor(() =>
      expect(mockRouter.push).toHaveBeenCalledWith({ path: '/sign-in', query: { expired: 'true' } }),
    )
    expect(sessionStorage.getItem('returnTo')).toBe('/history-execution?tab=2')
  })

  test('without a refresh token (an older server) the session ends as before', async () => {
    const calls = serve()
    signedIn(null)

    await expect(apiClient.get('/execution/')).rejects.toThrow('Session expired')

    expect(calls.refresh).toHaveLength(0)
    expect(calls.data).toBe(1)
    expect(sessionStorage.getItem('isAuthenticated')).toBe('false')
    await vi.waitFor(() => expect(mockRouter.push).toHaveBeenCalled())
  })
})
