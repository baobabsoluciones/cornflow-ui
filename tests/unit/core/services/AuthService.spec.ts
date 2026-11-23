import { describe, test, expect, vi, beforeEach } from 'vitest'
import AuthService from '@cornflow-ui/core/services/AuthService'

const client = vi.hoisted(() => ({
  post: vi.fn(),
  put: vi.fn(),
  initializeToken: vi.fn(),
}))

vi.mock('@cornflow-ui/core/api/Api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@cornflow-ui/core/api/Api')>()
  return { default: client, isEndedSession: actual.isEndedSession }
})

const JSON_HEADERS = { 'Content-Type': 'application/json' }

describe('AuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
  })

  describe('login', () => {
    test('a successful login keeps the session and its refresh token', async () => {
      client.post.mockResolvedValue({
        status: 200,
        content: { token: 'access', refresh_token: 'refresh', id: 7, last_login: '2026-11-20T08:00:00Z' },
      })

      const result = await AuthService.login('planner', 'secret')

      expect(client.post).toHaveBeenCalledWith(
        '/login/',
        { username: 'planner', password: 'secret' },
        JSON_HEADERS,
      )
      expect(result).toEqual({ success: true, changePassword: false, lastLogin: '2026-11-20T08:00:00Z' })
      expect(sessionStorage.getItem('isAuthenticated')).toBe('true')
      expect(sessionStorage.getItem('token')).toBe('access')
      expect(sessionStorage.getItem('refreshToken')).toBe('refresh')
      expect(sessionStorage.getItem('userId')).toBe('7')
      expect(client.initializeToken).toHaveBeenCalled()
    })

    test("another user's role flags are dropped", async () => {
      sessionStorage.setItem('userId', '3')
      sessionStorage.setItem('isAdmin', 'true')
      client.post.mockResolvedValue({ status: 200, content: { token: 'access', id: 7 } })

      await AuthService.login('planner', 'secret')

      expect(sessionStorage.getItem('isAdmin')).toBeNull()
    })

    test('a session without refresh token leaves none from a previous session', async () => {
      sessionStorage.setItem('refreshToken', 'stale')
      client.post.mockResolvedValue({ status: 200, content: { token: 'access', id: 7 } })

      await AuthService.login('service', 'secret')

      expect(sessionStorage.getItem('refreshToken')).toBeNull()
    })

    test('sends the two-factor code when there is one', async () => {
      client.post.mockResolvedValue({ status: 200, content: { token: 'access', id: 7 } })

      await AuthService.login('planner', 'secret', '123456')

      expect(client.post).toHaveBeenCalledWith(
        '/login/',
        { username: 'planner', password: 'secret', totp_code: '123456' },
        JSON_HEADERS,
      )
    })

    test('asks for the two-factor code without opening a session', async () => {
      client.post.mockResolvedValue({ status: 200, content: { mfa_required: true } })

      const result = await AuthService.login('planner', 'secret')

      expect(result).toEqual({ success: false, mfaRequired: true })
      expect(sessionStorage.getItem('isAuthenticated')).toBeNull()
      expect(sessionStorage.getItem('token')).toBeNull()
    })

    test('a required enrollment keeps its temporary token as the Bearer, not as a session', async () => {
      client.post.mockResolvedValue({
        status: 200,
        content: { mfa_setup_required: true, temp_token: 'enrollment' },
      })

      const result = await AuthService.login('planner', 'secret')

      expect(result).toEqual({ success: false, mfaSetupRequired: true })
      expect(sessionStorage.getItem('isAuthenticated')).toBe('false')
      expect(sessionStorage.getItem('token')).toBe('enrollment')
      expect(client.initializeToken).toHaveBeenCalled()
    })

    test('a password to change is kept for the router', async () => {
      client.post.mockResolvedValue({
        status: 200,
        content: { token: 'access', id: 7, change_password: true },
      })

      const result = await AuthService.login('planner', 'secret')

      expect(result.changePassword).toBe(true)
      expect(sessionStorage.getItem('pwdChangeRequired')).toBe('true')
    })

    test('wrong credentials', async () => {
      client.post.mockResolvedValue({ status: 400, content: { error: 'Invalid credentials' } })

      const result = await AuthService.login('planner', 'wrong')

      expect(result).toEqual({
        success: false,
        rateLimited: false,
        accountLocked: false,
        serverError: false,
        errorMessage: 'Invalid credentials',
      })
      expect(sessionStorage.getItem('isAuthenticated')).toBe('false')
    })

    test('a throttled attempt says so, with the limiter message', async () => {
      client.post.mockResolvedValue({ status: 429, content: { message: 'Too many requests' } })

      const result = await AuthService.login('planner', 'secret')

      expect(result).toMatchObject({ success: false, rateLimited: true, errorMessage: 'Too many requests' })
    })

    test('a locked account says so', async () => {
      client.post.mockResolvedValue({
        status: 403,
        content: { error: 'The account is locked', error_code: 'account_locked' },
      })

      const result = await AuthService.login('planner', 'secret')

      expect(result).toMatchObject({ success: false, accountLocked: true })
    })

    test('a server failure is told apart from wrong credentials', async () => {
      client.post.mockResolvedValue({ status: 500, content: { error: 'Internal error' } })

      expect(await AuthService.login('planner', 'secret')).toMatchObject({ success: false, serverError: true })
    })

    test('a network error reaches the caller', async () => {
      client.post.mockRejectedValue(new Error('Network error'))

      await expect(AuthService.login('planner', 'secret')).rejects.toThrow('Network error')
    })
  })

  describe('two-factor enrollment', () => {
    test('mfaSetup gives the secret and the URI of the QR code', async () => {
      client.post.mockResolvedValue({
        status: 200,
        content: { secret: 'ABC', provisioning_uri: 'otpauth://totp/app:planner?secret=ABC' },
      })

      const setup = await AuthService.mfaSetup()

      expect(client.post).toHaveBeenCalledWith('/mfa/setup/', {}, JSON_HEADERS)
      expect(setup).toEqual({ secret: 'ABC', provisioningUri: 'otpauth://totp/app:planner?secret=ABC' })
    })

    test('mfaSetup gives null when cornflow refuses', async () => {
      client.post.mockResolvedValue({ status: 400, content: {} })

      expect(await AuthService.mfaSetup()).toBeNull()
    })

    test('mfaVerify opens the session and gives the backup codes', async () => {
      sessionStorage.setItem('token', 'enrollment')
      client.post.mockResolvedValue({
        status: 200,
        content: { token: 'access', refresh_token: 'refresh', id: 7, backup_codes: ['a1', 'b2'] },
      })

      const verified = await AuthService.mfaVerify('123456')

      expect(client.post).toHaveBeenCalledWith('/mfa/verify/', { totp_code: '123456' }, JSON_HEADERS)
      expect(verified).toEqual({ backupCodes: ['a1', 'b2'] })
      expect(sessionStorage.getItem('isAuthenticated')).toBe('true')
      expect(sessionStorage.getItem('token')).toBe('access')
      expect(sessionStorage.getItem('refreshToken')).toBe('refresh')
    })

    test('turning it on from the settings keeps the role flags of the signed-in user', async () => {
      sessionStorage.setItem('isAuthenticated', 'true')
      sessionStorage.setItem('userId', '7')
      sessionStorage.setItem('isAdmin', 'true')
      client.post.mockResolvedValue({ status: 200, content: { token: 'access', id: 7, backup_codes: [] } })

      await AuthService.mfaVerify('123456')

      expect(sessionStorage.getItem('isAdmin')).toBe('true')
    })

    test('mfaVerify with a wrong code gives null and opens no session', async () => {
      client.post.mockResolvedValue({ status: 400, content: { error: 'Invalid code' } })

      expect(await AuthService.mfaVerify('000000')).toBeNull()
      expect(sessionStorage.getItem('isAuthenticated')).toBeNull()
    })

    test('an abandoned enrollment drops its temporary token', () => {
      sessionStorage.setItem('isAuthenticated', 'false')
      sessionStorage.setItem('token', 'enrollment')

      AuthService.clearPendingEnrollment()

      expect(sessionStorage.getItem('token')).toBeNull()
      expect(client.initializeToken).toHaveBeenCalled()
    })

    test('clearing an enrollment never touches a real session', () => {
      sessionStorage.setItem('isAuthenticated', 'true')
      sessionStorage.setItem('token', 'access')

      AuthService.clearPendingEnrollment()

      expect(sessionStorage.getItem('token')).toBe('access')
    })
  })

  describe('password recovery', () => {
    test('a processed request', async () => {
      client.put.mockResolvedValue({ status: 200, content: {} })

      const result = await AuthService.requestPasswordReset('planner@example.com')

      expect(client.put).toHaveBeenCalledWith(
        '/user/recover-password/',
        { email: 'planner@example.com' },
        JSON_HEADERS,
      )
      expect(result).toEqual({ sent: true, rateLimited: false })
    })

    test('a throttled request', async () => {
      client.put.mockResolvedValue({ status: 429, content: {} })

      expect(await AuthService.requestPasswordReset('planner@example.com')).toEqual({
        sent: false,
        rateLimited: true,
      })
    })

    test('resetPassword sends the link token as the Bearer', async () => {
      client.put.mockResolvedValue({ status: 200, content: {} })

      const result = await AuthService.resetPassword('link-token', 'N3w-Passphrase!x')

      expect(client.put).toHaveBeenCalledWith(
        '/user/reset-password/',
        { password: 'N3w-Passphrase!x' },
        { ...JSON_HEADERS, Authorization: 'Bearer link-token' },
      )
      expect(result).toEqual({ success: true })
    })

    test('an expired link', async () => {
      client.put.mockResolvedValue({
        status: 400,
        content: { error: 'The token has expired, please login again' },
      })

      expect(await AuthService.resetPassword('link-token', 'N3w-Passphrase!x')).toMatchObject({
        success: false,
        linkInvalid: true,
      })
    })

    test('a password the policy rejects is not a bad link', async () => {
      client.put.mockResolvedValue({
        status: 400,
        content: { error: 'The password has been used recently' },
      })

      expect(await AuthService.resetPassword('link-token', 'N3w-Passphrase!x')).toEqual({
        success: false,
        message: 'The password has been used recently',
        linkInvalid: false,
      })
    })
  })

  describe('createApiKey', () => {
    test('a read-only key confirmed with a code', async () => {
      client.post.mockResolvedValue({ status: 201, content: { api_key: 'key' } })

      const result = await AuthService.createApiKey('123456', 'read')

      expect(client.post).toHaveBeenCalledWith(
        '/user/api-key/',
        { totp_code: '123456', scope: 'read' },
        JSON_HEADERS,
      )
      expect(result).toEqual({ success: true, apiKey: 'key' })
    })

    test('a deployment with personal tokens off', async () => {
      client.post.mockResolvedValue({ status: 501, content: { error: 'Disabled' } })

      expect(await AuthService.createApiKey()).toEqual({
        success: false,
        disabled: true,
        message: 'Disabled',
      })
    })
  })

  describe('logout', () => {
    test('closes the session on the server and forgets it here', () => {
      client.post.mockResolvedValue({ status: 200, content: {} })
      sessionStorage.setItem('isAuthenticated', 'true')
      sessionStorage.setItem('token', 'access')
      sessionStorage.setItem('refreshToken', 'refresh')
      sessionStorage.setItem('userId', '7')
      sessionStorage.setItem('isPlatformAdmin', 'true')
      sessionStorage.setItem('pwdChangeRequired', 'true')

      AuthService.logout()

      expect(client.post).toHaveBeenCalledWith('/logout/', { refresh_token: 'refresh' }, JSON_HEADERS)
      expect(sessionStorage.getItem('isAuthenticated')).toBe('false')
      for (const key of ['token', 'refreshToken', 'userId', 'isPlatformAdmin', 'pwdChangeRequired']) {
        expect(sessionStorage.getItem(key)).toBeNull()
      }
      expect(client.initializeToken).toHaveBeenCalled()
    })

    test('without a refresh token there is nothing to close on the server', () => {
      AuthService.logout()

      expect(client.post).not.toHaveBeenCalled()
    })
  })

  describe('getToken', () => {
    test('returns token from session storage', () => {
      sessionStorage.setItem('token', 'mock-token')

      expect(AuthService.getToken()).toBe('mock-token')
    })

    test('returns null when no token exists', () => {
      expect(AuthService.getToken()).toBeNull()
    })
  })

  describe('getUserId', () => {
    test('returns user ID from session storage', () => {
      sessionStorage.setItem('userId', 'user-123')

      expect(AuthService.getUserId()).toBe('user-123')
    })

    test('returns null when no user ID exists', () => {
      expect(AuthService.getUserId()).toBeNull()
    })
  })

  describe('isAuthenticated', () => {
    test('returns true when authenticated', () => {
      sessionStorage.setItem('isAuthenticated', 'true')

      expect(AuthService.isAuthenticated()).toBe(true)
    })

    test('returns false when not authenticated', () => {
      sessionStorage.setItem('isAuthenticated', 'false')

      expect(AuthService.isAuthenticated()).toBe(false)
    })

    test('returns false when authentication status is not set', () => {
      expect(AuthService.isAuthenticated()).toBe(false)
    })
  })

  describe('refreshToken', () => {
    test('has nothing to do: the Api client renews a cornflow session', async () => {
      expect(await AuthService.refreshToken()).toBeNull()
    })
  })
})
