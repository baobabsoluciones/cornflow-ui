import { describe, test, expect, vi, beforeEach } from 'vitest'
import AuthService from '@cornflow-ui/core/services/AuthService'

// Mock API client
vi.mock('@cornflow-ui/core/api/Api', () => ({
  default: {
    post: vi.fn(),
    put: vi.fn(),
    // The client caches the Bearer in memory; AuthService must tell it to
    // re-read sessionStorage whenever the session token changes.
    initializeToken: vi.fn()
  }
}))

describe('AuthService', () => {
  // Mock sessionStorage
  const mockStorage: { [key: string]: string } = {}
  const sessionStorageMock = {
    getItem: vi.fn((key: string) => mockStorage[key] || null),
    setItem: vi.fn((key: string, value: string) => { mockStorage[key] = value }),
    removeItem: vi.fn((key: string) => delete mockStorage[key]),
    clear: vi.fn(() => { Object.keys(mockStorage).forEach(key => delete mockStorage[key]) })
  }
  Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock })

  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorageMock.clear()
  })

  describe('login', () => {
    test('successful login stores authentication data', async () => {
      const mockResponse = {
        status: 200,
        content: {
          token: 'mock-token',
          id: 'user-123'
        }
      }

      const { default: client } = await import('@cornflow-ui/core/api/Api')
      vi.mocked(client.post).mockResolvedValue(mockResponse)

      const result = await AuthService.login('testuser', 'password123')

      expect(client.post).toHaveBeenCalledWith(
        '/login/',
        { username: 'testuser', password: 'password123' },
        { 'Content-Type': 'application/json' }
      )
      expect(result).toEqual({ success: true, changePassword: false, lastLogin: null })
      expect(sessionStorageMock.setItem).toHaveBeenCalledWith('isAuthenticated', 'true')
      expect(sessionStorageMock.setItem).toHaveBeenCalledWith('token', 'mock-token')
      expect(sessionStorageMock.setItem).toHaveBeenCalledWith('userId', 'user-123')
      expect(sessionStorageMock.removeItem).toHaveBeenCalledWith('isAdmin')
      expect(sessionStorageMock.removeItem).toHaveBeenCalledWith('userRoles')
      expect(sessionStorageMock.removeItem).toHaveBeenCalledWith('pwdChangeRequired')
      // The Api client must adopt the token just issued instead of any cached one
      expect(client.initializeToken).toHaveBeenCalled()
    })

    test('successful login includes the TOTP code in the request body when given', async () => {
      const mockResponse = {
        status: 200,
        content: {
          token: 'mock-token',
          id: 'user-123'
        }
      }

      const { default: client } = await import('@cornflow-ui/core/api/Api')
      vi.mocked(client.post).mockResolvedValue(mockResponse)

      const result = await AuthService.login('testuser', 'password123', '123456')

      expect(client.post).toHaveBeenCalledWith(
        '/login/',
        { username: 'testuser', password: 'password123', totp_code: '123456' },
        { 'Content-Type': 'application/json' }
      )
      expect(result).toEqual({ success: true, changePassword: false, lastLogin: null })
    })

    test('successful login stores the refresh token when returned', async () => {
      const mockResponse = {
        status: 200,
        content: { token: 'mock-token', id: 'user-123', refresh_token: 'refresh-abc' }
      }

      const { default: client } = await import('@cornflow-ui/core/api/Api')
      vi.mocked(client.post).mockResolvedValue(mockResponse)

      await AuthService.login('testuser', 'password123')

      expect(sessionStorageMock.setItem).toHaveBeenCalledWith('refreshToken', 'refresh-abc')
    })

    test('login without a refresh token clears any stored one (service user)', async () => {
      const mockResponse = {
        status: 200,
        content: { token: 'mock-token', id: 'user-123' }
      }

      const { default: client } = await import('@cornflow-ui/core/api/Api')
      vi.mocked(client.post).mockResolvedValue(mockResponse)

      await AuthService.login('serviceuser', 'password123')

      expect(sessionStorageMock.removeItem).toHaveBeenCalledWith('refreshToken')
    })

    test('successful login with change_password flags the forced rotation', async () => {
      const mockResponse = {
        status: 200,
        content: {
          token: 'mock-token',
          id: 'user-123',
          change_password: true
        }
      }

      const { default: client } = await import('@cornflow-ui/core/api/Api')
      vi.mocked(client.post).mockResolvedValue(mockResponse)

      const result = await AuthService.login('testuser', 'password123')

      expect(result).toEqual({ success: true, changePassword: true, lastLogin: null })
      expect(sessionStorageMock.setItem).toHaveBeenCalledWith('pwdChangeRequired', 'true')
    })

    test('failed login sets authentication to false and returns the error message', async () => {
      const mockResponse = {
        status: 401,
        content: { error: 'Invalid credentials' }
      }

      const { default: client } = await import('@cornflow-ui/core/api/Api')
      vi.mocked(client.post).mockResolvedValue(mockResponse)

      const result = await AuthService.login('testuser', 'wrongpassword')

      expect(result).toEqual({
        success: false,
        rateLimited: false,
        errorMessage: 'Invalid credentials'
      })
      expect(sessionStorageMock.setItem).toHaveBeenCalledWith('isAuthenticated', 'false')
    })

    test('rate-limited login is reported as such, not as bad credentials', async () => {
      // the limiter answers 429 with its text in `message`, not in `error`
      const mockResponse = {
        status: 429,
        content: { message: 'Too many requests. Please slow down and try again later.' }
      }

      const { default: client } = await import('@cornflow-ui/core/api/Api')
      vi.mocked(client.post).mockResolvedValue(mockResponse)

      const result = await AuthService.login('testuser', 'whatever')

      expect(result.success).toBe(false)
      expect(result.rateLimited).toBe(true)
      expect(result.errorMessage).toContain('Too many requests')
      expect(sessionStorageMock.setItem).toHaveBeenCalledWith('isAuthenticated', 'false')
    })

    test('a plain failed login is not flagged as rate limited', async () => {
      const mockResponse = {
        status: 400,
        content: { error: 'Invalid credentials' }
      }

      const { default: client } = await import('@cornflow-ui/core/api/Api')
      vi.mocked(client.post).mockResolvedValue(mockResponse)

      const result = await AuthService.login('testuser', 'wrongpassword')

      expect(result.rateLimited).toBe(false)
      expect(result.errorMessage).toBe('Invalid credentials')
    })

    test('mfa_required response asks for the code without storing tokens', async () => {
      const mockResponse = {
        status: 200,
        content: { mfa_required: true }
      }

      const { default: client } = await import('@cornflow-ui/core/api/Api')
      vi.mocked(client.post).mockResolvedValue(mockResponse)

      const result = await AuthService.login('testuser', 'password123')

      expect(result).toEqual({ success: false, mfaRequired: true })
      expect(sessionStorageMock.setItem).not.toHaveBeenCalledWith('token', expect.anything())
      expect(sessionStorageMock.setItem).not.toHaveBeenCalledWith('isAuthenticated', 'true')
    })

    test('mfa_setup_required response stores the temporary token without a session', async () => {
      const mockResponse = {
        status: 200,
        content: { mfa_setup_required: true, temp_token: 'temp-token-123' }
      }

      const { default: client } = await import('@cornflow-ui/core/api/Api')
      vi.mocked(client.post).mockResolvedValue(mockResponse)

      const result = await AuthService.login('testuser', 'password123')

      expect(result).toEqual({ success: false, mfaSetupRequired: true })
      expect(sessionStorageMock.setItem).toHaveBeenCalledWith('isAuthenticated', 'false')
      expect(sessionStorageMock.setItem).toHaveBeenCalledWith('token', 'temp-token-123')
    })
  })

  describe('clearPendingEnrollment', () => {
    test('drops the temporary token left by an abandoned MFA enrollment', async () => {
      // Backing out of the enrollment must not leave a usable Bearer behind
      mockStorage['isAuthenticated'] = 'false'
      mockStorage['token'] = 'temp-token-123'
      const { default: client } = await import('@cornflow-ui/core/api/Api')

      AuthService.clearPendingEnrollment()

      expect(sessionStorageMock.removeItem).toHaveBeenCalledWith('token')
      expect(client.initializeToken).toHaveBeenCalled()
    })

    test('leaves an established session untouched', () => {
      mockStorage['isAuthenticated'] = 'true'
      mockStorage['token'] = 'real-session-token'

      AuthService.clearPendingEnrollment()

      expect(sessionStorageMock.removeItem).not.toHaveBeenCalledWith('token')
      expect(mockStorage['token']).toBe('real-session-token')
    })

    test('handles API errors gracefully', async () => {
      const { default: client } = await import('@cornflow-ui/core/api/Api')
      vi.mocked(client.post).mockRejectedValue(new Error('Network error'))

      await expect(AuthService.login('testuser', 'password123')).rejects.toThrow('Network error')
    })
  })

  describe('mfaSetup', () => {
    test('returns the secret and provisioning URI on success', async () => {
      const mockResponse = {
        status: 200,
        content: {
          secret: 'BASE32SECRET',
          provisioning_uri: 'otpauth://totp/app:user?secret=BASE32SECRET'
        }
      }

      const { default: client } = await import('@cornflow-ui/core/api/Api')
      vi.mocked(client.post).mockResolvedValue(mockResponse)

      const result = await AuthService.mfaSetup()

      expect(client.post).toHaveBeenCalledWith(
        '/mfa/setup/',
        {},
        { 'Content-Type': 'application/json' }
      )
      expect(result).toEqual({
        secret: 'BASE32SECRET',
        provisioningUri: 'otpauth://totp/app:user?secret=BASE32SECRET'
      })
    })

    test('returns null on non-200 status', async () => {
      const { default: client } = await import('@cornflow-ui/core/api/Api')
      vi.mocked(client.post).mockResolvedValue({ status: 400, content: {} })

      const result = await AuthService.mfaSetup()

      expect(result).toBeNull()
    })
  })

  describe('mfaVerify', () => {
    test('stores the full session and returns the backup codes on success', async () => {
      const mockResponse = {
        status: 200,
        content: {
          token: 'full-token',
          id: 'user-123',
          backup_codes: ['aaaa-bbbb', 'cccc-dddd']
        }
      }

      const { default: client } = await import('@cornflow-ui/core/api/Api')
      vi.mocked(client.post).mockResolvedValue(mockResponse)

      const result = await AuthService.mfaVerify('123456')

      expect(client.post).toHaveBeenCalledWith(
        '/mfa/verify/',
        { totp_code: '123456' },
        { 'Content-Type': 'application/json' }
      )
      expect(result).toEqual({ backupCodes: ['aaaa-bbbb', 'cccc-dddd'] })
      expect(sessionStorageMock.setItem).toHaveBeenCalledWith('isAuthenticated', 'true')
      expect(sessionStorageMock.setItem).toHaveBeenCalledWith('token', 'full-token')
      expect(sessionStorageMock.setItem).toHaveBeenCalledWith('userId', 'user-123')
      expect(sessionStorageMock.removeItem).toHaveBeenCalledWith('isAdmin')
      expect(sessionStorageMock.removeItem).toHaveBeenCalledWith('userRoles')
    })

    test('returns empty backup codes when the response omits them', async () => {
      const mockResponse = {
        status: 200,
        content: { token: 'full-token', id: 'user-123' }
      }

      const { default: client } = await import('@cornflow-ui/core/api/Api')
      vi.mocked(client.post).mockResolvedValue(mockResponse)

      const result = await AuthService.mfaVerify('123456')

      expect(result).toEqual({ backupCodes: [] })
    })

    test('stores the refresh token returned after enrollment', async () => {
      const mockResponse = {
        status: 200,
        content: { token: 'full-token', id: 'user-123', refresh_token: 'refresh-xyz' }
      }

      const { default: client } = await import('@cornflow-ui/core/api/Api')
      vi.mocked(client.post).mockResolvedValue(mockResponse)

      await AuthService.mfaVerify('123456')

      expect(sessionStorageMock.setItem).toHaveBeenCalledWith('refreshToken', 'refresh-xyz')
    })

    test('returns null on invalid code', async () => {
      const { default: client } = await import('@cornflow-ui/core/api/Api')
      vi.mocked(client.post).mockResolvedValue({ status: 400, content: {} })

      const result = await AuthService.mfaVerify('000000')

      expect(result).toBeNull()
      expect(sessionStorageMock.setItem).not.toHaveBeenCalledWith('isAuthenticated', 'true')
    })
  })

  describe('requestPasswordReset', () => {
    test('sends the email to the recover-password endpoint and returns true on 200', async () => {
      const { default: client } = await import('@cornflow-ui/core/api/Api')
      vi.mocked(client.put).mockResolvedValue({ status: 200, content: {} })

      const result = await AuthService.requestPasswordReset('user@example.com')

      expect(client.put).toHaveBeenCalledWith(
        '/user/recover-password/',
        { email: 'user@example.com' },
        { 'Content-Type': 'application/json' }
      )
      expect(result).toBe(true)
    })

    test('returns false on a non-200 status', async () => {
      const { default: client } = await import('@cornflow-ui/core/api/Api')
      vi.mocked(client.put).mockResolvedValue({ status: 400, content: {} })

      const result = await AuthService.requestPasswordReset('user@example.com')

      expect(result).toBe(false)
    })

    test('handles API errors gracefully', async () => {
      const { default: client } = await import('@cornflow-ui/core/api/Api')
      vi.mocked(client.put).mockRejectedValue(new Error('Network error'))

      await expect(AuthService.requestPasswordReset('user@example.com')).rejects.toThrow('Network error')
    })
  })

  describe('resetPassword', () => {
    test('sends the new password with the reset token as Bearer authorization', async () => {
      const { default: client } = await import('@cornflow-ui/core/api/Api')
      vi.mocked(client.put).mockResolvedValue({ status: 200, content: {} })

      const result = await AuthService.resetPassword('reset-token-123', 'NewPassword1!')

      expect(client.put).toHaveBeenCalledWith(
        '/user/reset-password/',
        { password: 'NewPassword1!' },
        {
          'Content-Type': 'application/json',
          Authorization: 'Bearer reset-token-123'
        }
      )
      expect(result).toEqual({ success: true })
    })

    test('marks the link invalid on a 401 response', async () => {
      const { default: client } = await import('@cornflow-ui/core/api/Api')
      vi.mocked(client.put).mockResolvedValue({
        status: 401,
        content: { error: 'Invalid token' }
      })

      const result = await AuthService.resetPassword('used-token', 'NewPassword1!')

      expect(result).toEqual({
        success: false,
        message: 'Invalid token',
        linkInvalid: true
      })
    })

    test('marks the link invalid on a 403 response', async () => {
      const { default: client } = await import('@cornflow-ui/core/api/Api')
      vi.mocked(client.put).mockResolvedValue({
        status: 403,
        content: { error: 'Forbidden' }
      })

      const result = await AuthService.resetPassword('forged-token', 'NewPassword1!')

      expect(result).toEqual({
        success: false,
        message: 'Forbidden',
        linkInvalid: true
      })
    })

    test('returns the backend message without flagging the link on other failures', async () => {
      const { default: client } = await import('@cornflow-ui/core/api/Api')
      vi.mocked(client.put).mockResolvedValue({
        status: 400,
        content: { error: 'Password too weak' }
      })

      const result = await AuthService.resetPassword('reset-token-123', 'weak')

      expect(result).toEqual({
        success: false,
        message: 'Password too weak',
        linkInvalid: false
      })
    })

    test('handles a failure response without content', async () => {
      const { default: client } = await import('@cornflow-ui/core/api/Api')
      vi.mocked(client.put).mockResolvedValue({ status: 500, content: undefined })

      const result = await AuthService.resetPassword('reset-token-123', 'NewPassword1!')

      expect(result).toEqual({
        success: false,
        message: undefined,
        linkInvalid: false
      })
    })

    test('handles API errors gracefully', async () => {
      const { default: client } = await import('@cornflow-ui/core/api/Api')
      vi.mocked(client.put).mockRejectedValue(new Error('Network error'))

      await expect(AuthService.resetPassword('reset-token-123', 'NewPassword1!')).rejects.toThrow('Network error')
    })
  })

  describe('createApiKey', () => {
    test('returns the generated key on a 201 response', async () => {
      const { default: client } = await import('@cornflow-ui/core/api/Api')
      vi.mocked(client.post).mockResolvedValue({
        status: 201,
        content: { api_key: 'generated-api-key' }
      })

      const result = await AuthService.createApiKey()

      expect(client.post).toHaveBeenCalledWith(
        '/user/api-key/',
        {},
        { 'Content-Type': 'application/json' }
      )
      expect(result).toEqual({ success: true, apiKey: 'generated-api-key' })
    })

    test('includes the TOTP code in the request body when given', async () => {
      const { default: client } = await import('@cornflow-ui/core/api/Api')
      vi.mocked(client.post).mockResolvedValue({
        status: 201,
        content: { api_key: 'generated-api-key' }
      })

      const result = await AuthService.createApiKey('123456')

      expect(client.post).toHaveBeenCalledWith(
        '/user/api-key/',
        { totp_code: '123456' },
        { 'Content-Type': 'application/json' }
      )
      expect(result).toEqual({ success: true, apiKey: 'generated-api-key' })
    })

    test('flags the feature as disabled on a 501 response', async () => {
      const { default: client } = await import('@cornflow-ui/core/api/Api')
      vi.mocked(client.post).mockResolvedValue({
        status: 501,
        content: { error: 'Personal tokens are disabled' }
      })

      const result = await AuthService.createApiKey()

      expect(result).toEqual({
        success: false,
        disabled: true,
        message: 'Personal tokens are disabled'
      })
    })

    test('returns the backend error without flagging disabled on other failures', async () => {
      const { default: client } = await import('@cornflow-ui/core/api/Api')
      vi.mocked(client.post).mockResolvedValue({
        status: 400,
        content: { error: 'A valid TOTP code is required' }
      })

      const result = await AuthService.createApiKey()

      expect(result).toEqual({
        success: false,
        disabled: false,
        message: 'A valid TOTP code is required'
      })
    })

    test('handles API errors gracefully', async () => {
      const { default: client } = await import('@cornflow-ui/core/api/Api')
      vi.mocked(client.post).mockRejectedValue(new Error('Network error'))

      await expect(AuthService.createApiKey()).rejects.toThrow('Network error')
    })
  })

  describe('signup', () => {
    test('successful signup returns true', async () => {
      const mockResponse = {
        status: 201,
        content: {}
      }

      const { default: client } = await import('@cornflow-ui/core/api/Api')
      vi.mocked(client.post).mockResolvedValue(mockResponse)

      const result = await AuthService.signup('test@example.com', 'testuser', 'password123')

      expect(client.post).toHaveBeenCalledWith(
        '/signup/',
        { email: 'test@example.com', username: 'testuser', password: 'password123' },
        { 'Content-Type': 'application/json' }
      )
      expect(result).toBe(true)
    })

    test('failed signup returns false', async () => {
      const mockResponse = {
        status: 400,
        content: {}
      }

      const { default: client } = await import('@cornflow-ui/core/api/Api')
      vi.mocked(client.post).mockResolvedValue(mockResponse)

      const result = await AuthService.signup('test@example.com', 'testuser', 'password123')

      expect(result).toBe(false)
    })

    test('handles API errors gracefully', async () => {
      const { default: client } = await import('@cornflow-ui/core/api/Api')
      vi.mocked(client.post).mockRejectedValue(new Error('Network error'))

      await expect(AuthService.signup('test@example.com', 'testuser', 'password123')).rejects.toThrow('Network error')
    })
  })

  describe('logout', () => {
    test('clears authentication data from session storage', () => {
      // Set up initial state
      mockStorage['isAuthenticated'] = 'true'
      mockStorage['token'] = 'mock-token'
      mockStorage['userId'] = 'user-123'
      mockStorage['pwdChangeRequired'] = 'true'

      AuthService.logout()

      expect(sessionStorageMock.setItem).toHaveBeenCalledWith('isAuthenticated', 'false')
      expect(sessionStorageMock.removeItem).toHaveBeenCalledWith('token')
      expect(sessionStorageMock.removeItem).toHaveBeenCalledWith('refreshToken')
      expect(sessionStorageMock.removeItem).toHaveBeenCalledWith('userId')
      expect(sessionStorageMock.removeItem).toHaveBeenCalledWith('pwdChangeRequired')
    })

    test('revokes the refresh-token session server-side when one exists', async () => {
      mockStorage['refreshToken'] = 'refresh-abc'
      const { default: client } = await import('@cornflow-ui/core/api/Api')
      vi.mocked(client.post).mockResolvedValue({ status: 200, content: {} })

      AuthService.logout()

      expect(client.post).toHaveBeenCalledWith(
        '/logout/',
        { refresh_token: 'refresh-abc' },
        { 'Content-Type': 'application/json' }
      )
      expect(sessionStorageMock.removeItem).toHaveBeenCalledWith('refreshToken')
    })

    test('drops the Bearer cached in the Api client', async () => {
      // Without this the client keeps the previous user's token in memory and
      // a re-login in the same tab would send it (the app does not reload).
      mockStorage['token'] = 'mock-token'
      const { default: client } = await import('@cornflow-ui/core/api/Api')

      AuthService.logout()

      expect(client.initializeToken).toHaveBeenCalled()
    })
  })

  describe('getToken', () => {
    test('returns token from session storage', () => {
      mockStorage['token'] = 'mock-token'

      const token = AuthService.getToken()

      expect(token).toBe('mock-token')
      expect(sessionStorageMock.getItem).toHaveBeenCalledWith('token')
    })

    test('returns null when no token exists', () => {
      const token = AuthService.getToken()

      expect(token).toBeNull()
    })
  })

  describe('getUserId', () => {
    test('returns user ID from session storage', () => {
      mockStorage['userId'] = 'user-123'

      const userId = AuthService.getUserId()

      expect(userId).toBe('user-123')
      expect(sessionStorageMock.getItem).toHaveBeenCalledWith('userId')
    })

    test('returns null when no user ID exists', () => {
      const userId = AuthService.getUserId()

      expect(userId).toBeNull()
    })
  })

  describe('isAuthenticated', () => {
    test('returns true when authenticated', () => {
      mockStorage['isAuthenticated'] = 'true'

      const result = AuthService.isAuthenticated()

      expect(result).toBe(true)
    })

    test('returns false when not authenticated', () => {
      mockStorage['isAuthenticated'] = 'false'

      const result = AuthService.isAuthenticated()

      expect(result).toBe(false)
    })

    test('returns false when authentication status is not set', () => {
      const result = AuthService.isAuthenticated()

      expect(result).toBe(false)
    })
  })

  describe('refreshToken', () => {
    test('returns null as refresh is not supported', async () => {
      const result = await AuthService.refreshToken()

      expect(result).toBeNull()
    })
  })
})
