import client from '../api/Api'
import type { LoginResult } from '../interfaces/AuthProvider'

export interface MFASetupData {
  secret: string
  provisioningUri: string
}

export interface MFAVerifyData {
  backupCodes: string[]
}

export interface ApiKeyResult {
  success: boolean
  apiKey?: string
  // true when the endpoint reported the feature is disabled on the deployment
  disabled?: boolean
  message?: string
}

class AuthService {
  async initialize(): Promise<void> {
    // Cornflow auth doesn't need initialization
  }

  async login(
    username: string,
    password: string,
    totpCode?: string,
  ): Promise<LoginResult> {
    const body: Record<string, string> = { username, password }
    if (totpCode) {
      body.totp_code = totpCode
    }
    const response = await client.post('/login/', body, {
      'Content-Type': 'application/json',
    })
    const content = (response.content || {}) as Record<string, any>

    if (response.status !== 200) {
      sessionStorage.setItem('isAuthenticated', 'false')
      // The rate limiter answers 429 with its text in `message`, not in
      // `error`: without reading both, a throttled attempt would be reported
      // as bad credentials even though they were never checked.
      return {
        success: false,
        rateLimited: response.status === 429,
        errorMessage: content.error ?? content.message,
      }
    }

    if (content.mfa_required) {
      // Password accepted, the TOTP code is missing: no session yet
      return { success: false, mfaRequired: true }
    }

    if (content.mfa_setup_required) {
      // Password accepted but the user must enroll in two-factor
      // authentication. The temporary token is stored so the enrollment
      // endpoints can be called; it is not a session token.
      // Abandoning the enrollment must clear it — see clearPendingEnrollment().
      sessionStorage.setItem('isAuthenticated', 'false')
      sessionStorage.setItem('token', content.temp_token)
      client.initializeToken()
      return { success: false, mfaSetupRequired: true }
    }

    sessionStorage.setItem('isAuthenticated', 'true')
    sessionStorage.setItem('token', content.token)
    // The refresh token backs the sliding-inactivity session; the Api layer
    // uses it to renew the short-lived access token transparently. Service
    // users / refresh-disabled deployments return only the access token.
    if (content.refresh_token) {
      sessionStorage.setItem('refreshToken', content.refresh_token)
    } else {
      sessionStorage.removeItem('refreshToken')
    }
    sessionStorage.setItem('userId', content.id)
    // Point the Api client at the token just issued: it caches the Bearer in
    // memory and would otherwise keep using a stale one for this session.
    client.initializeToken()
    // isAdmin and userRoles are determined after fetching user role assignments (see general store fetchUser)
    sessionStorage.removeItem('isAdmin')
    sessionStorage.removeItem('isPlatformAdmin')
    sessionStorage.removeItem('userRoles')
    if (content.change_password) {
      sessionStorage.setItem('pwdChangeRequired', 'true')
    } else {
      sessionStorage.removeItem('pwdChangeRequired')
    }

    return {
      success: true,
      changePassword: !!content.change_password,
      lastLogin: content.last_login ?? null,
    }
  }

  /**
   * Starts the two-factor authentication enrollment. Requires either a
   * session token or the temporary enrollment token stored by login().
   */
  async mfaSetup(): Promise<MFASetupData | null> {
    const response = await client.post(
      '/mfa/setup/',
      {},
      { 'Content-Type': 'application/json' },
    )
    if (response.status !== 200) {
      return null
    }
    const content = response.content as Record<string, any>
    return {
      secret: content.secret,
      provisioningUri: content.provisioning_uri,
    }
  }

  /**
   * Verifies the first TOTP code and activates the two-factor
   * authentication. On success the returned full session token replaces the
   * temporary enrollment token and the one-time backup codes are returned
   * (this is the only time they are visible).
   */
  async mfaVerify(totpCode: string): Promise<MFAVerifyData | null> {
    const response = await client.post(
      '/mfa/verify/',
      { totp_code: totpCode },
      { 'Content-Type': 'application/json' },
    )
    if (response.status !== 200) {
      return null
    }
    const content = response.content as Record<string, any>
    sessionStorage.setItem('isAuthenticated', 'true')
    sessionStorage.setItem('token', content.token)
    if (content.refresh_token) {
      sessionStorage.setItem('refreshToken', content.refresh_token)
    } else {
      sessionStorage.removeItem('refreshToken')
    }
    sessionStorage.setItem('userId', content.id)
    // Same as in login(): the enrollment exchanges the temporary token for a
    // real session one, so the Api client must pick it up.
    client.initializeToken()
    sessionStorage.removeItem('isAdmin')
    sessionStorage.removeItem('isPlatformAdmin')
    sessionStorage.removeItem('userRoles')
    return { backupCodes: content.backup_codes || [] }
  }

  /**
   * Requests a password reset link for the given email. The backend always
   * answers with the same message whether the email exists or not.
   */
  async requestPasswordReset(email: string): Promise<boolean> {
    const response = await client.put(
      '/user/recover-password/',
      { email },
      { 'Content-Type': 'application/json' },
    )
    return response.status === 200
  }

  /**
   * Sets a new password using the single-use token carried in the reset
   * link. The token is sent as the Authorization header and is only valid
   * on this endpoint.
   */
  async resetPassword(
    token: string,
    password: string,
  ): Promise<{ success: boolean; message?: string; linkInvalid?: boolean }> {
    const response = await client.put(
      '/user/reset-password/',
      { password },
      {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    )
    if (response.status === 200) {
      return { success: true }
    }
    return {
      success: false,
      message: (response.content as { error?: string })?.error,
      // 401/403: the link was already used, revoked or forged
      linkInvalid: response.status === 401 || response.status === 403,
    }
  }

  /**
   * Generates a personal API key for the current session. When the user has
   * MFA enabled the server requires a fresh TOTP code (step-up). The key is
   * returned only once; generating a new one revokes the previous key.
   */
  async createApiKey(totpCode?: string, scope?: string): Promise<ApiKeyResult> {
    const body: Record<string, string> = {}
    if (totpCode) {
      body.totp_code = totpCode
    }
    // "read" asks for a read-only key (refused by the server on writes)
    if (scope) {
      body.scope = scope
    }
    const response = await client.post('/user/api-key/', body, {
      'Content-Type': 'application/json',
    })
    if (response.status === 201) {
      return {
        success: true,
        apiKey: (response.content as { api_key?: string }).api_key,
      }
    }
    return {
      success: false,
      disabled: response.status === 501,
      message: (response.content as { error?: string })?.error,
    }
  }

  async signup(
    email: string,
    username: string,
    password: string,
  ): Promise<boolean> {
    const response = await client.post(
      '/signup/',
      { email, username, password },
      { 'Content-Type': 'application/json' },
    )
    return response.status === 201
  }

  /**
   * Drops the temporary enrollment token kept after a login that demands MFA
   * setup, for when the user backs out instead of finishing the enrollment.
   *
   * Without this the temp token stays in sessionStorage under `token` (with
   * `isAuthenticated=false`) and would be sent as the Bearer of any later
   * request. Never touches a real session: it is a no-op once authenticated.
   */
  clearPendingEnrollment(): void {
    if (sessionStorage.getItem('isAuthenticated') === 'true') return
    sessionStorage.removeItem('token')
    client.initializeToken()
  }

  logout(): void {
    // Best-effort server-side revocation of the refresh-token session (do not
    // block the local logout on the network call).
    const refreshToken = sessionStorage.getItem('refreshToken')
    if (refreshToken) {
      client
        .post(
          '/logout/',
          { refresh_token: refreshToken },
          { 'Content-Type': 'application/json' },
        )
        .catch(() => {})
    }
    sessionStorage.setItem('isAuthenticated', 'false')
    sessionStorage.removeItem('token')
    sessionStorage.removeItem('refreshToken')
    sessionStorage.removeItem('userId')
    sessionStorage.removeItem('isAdmin')
    sessionStorage.removeItem('isPlatformAdmin')
    sessionStorage.removeItem('userRoles')
    sessionStorage.removeItem('pwdChangeRequired')
    // Drop the Bearer the Api client keeps in memory. It caches the token and
    // only re-reads sessionStorage when it holds none, so without this a
    // re-login in the same tab would keep sending the previous user's token
    // (the app never reloads on logout: it just routes to /sign-in).
    client.initializeToken()
  }

  isAdmin(): boolean {
    return sessionStorage.getItem('isAdmin') === 'true'
  }

  getToken = () => sessionStorage.getItem('token')

  getUserId = () => sessionStorage.getItem('userId')

  isAuthenticated(): boolean {
    const isAuthenticated = sessionStorage.getItem('isAuthenticated') === 'true'
    return isAuthenticated
  }

  // The cornflow access token is renewed transparently by the Api layer using
  // the stored refresh token (see ApiClient.refreshCornflowToken). This hook,
  // used by the external-provider refresh path, is a no-op for cornflow auth.
  async refreshToken(): Promise<{ token: string; expiresAt: number } | null> {
    return null
  }
}

export default new AuthService()
