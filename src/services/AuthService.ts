import client, { isEndedSession } from '../api/Api'
import type {
  ApiKeyResult,
  LoginResult,
  MfaSetupResult,
  MfaVerifyData,
} from '../interfaces/AuthProvider'

const JSON_HEADERS = { 'Content-Type': 'application/json' }

type Content = Record<string, any>

/** The role flags are worked out again from the role assignments once the user is fetched. */
function clearRoleFlags() {
  sessionStorage.removeItem('isAdmin')
  sessionStorage.removeItem('isPlatformAdmin')
  sessionStorage.removeItem('userRoles')
}

/**
 * Keeps the session cornflow has just issued: the access token, the refresh token that renews it
 * (service users and deployments with refresh tokens off get none) and the user id. The role flags
 * of another user are dropped; the same user, renewing their session, keeps theirs.
 */
function storeSession(content: Content) {
  const sameUser = sessionStorage.getItem('userId') === String(content.id)
  sessionStorage.setItem('isAuthenticated', 'true')
  sessionStorage.setItem('token', content.token)
  if (content.refresh_token) sessionStorage.setItem('refreshToken', content.refresh_token)
  else sessionStorage.removeItem('refreshToken')
  sessionStorage.setItem('userId', content.id)
  // The Api client keeps the Bearer in memory: point it at the token just issued.
  client.initializeToken()
  if (!sameUser) clearRoleFlags()
}

class AuthService {
  async initialize(): Promise<void> {
    // Cornflow auth doesn't need initialization
  }

  /**
   * Signs in with a username and password, and the two-factor code when the user has one.
   *
   * When the password is right but two-factor authentication is missing, there is no session yet:
   * `mfaRequired` asks for the code, and `mfaSetupRequired` for the enrollment, whose temporary
   * token is kept as the Bearer of the enrollment endpoints only.
   */
  async login(username: string, password: string, totpCode?: string): Promise<LoginResult> {
    const body: Record<string, string> = { username, password }
    if (totpCode) body.totp_code = totpCode
    const response = await client.post('/login/', body, JSON_HEADERS)
    const content = (response.content ?? {}) as Content

    if (response.status !== 200) {
      sessionStorage.setItem('isAuthenticated', 'false')
      return {
        success: false,
        rateLimited: response.status === 429,
        accountLocked: content.error_code === 'account_locked',
        serverError: response.status >= 500,
        // The rate limiter gives its text in `message`, cornflow in `error`.
        errorMessage: content.error ?? content.message,
      }
    }

    if (content.mfa_required) return { success: false, mfaRequired: true }

    if (content.mfa_setup_required) {
      sessionStorage.setItem('isAuthenticated', 'false')
      sessionStorage.setItem('token', content.temp_token)
      client.initializeToken()
      return { success: false, mfaSetupRequired: true }
    }

    storeSession(content)
    if (content.change_password) sessionStorage.setItem('pwdChangeRequired', 'true')
    else sessionStorage.removeItem('pwdChangeRequired')

    return {
      success: true,
      changePassword: !!content.change_password,
      lastLogin: content.last_login ?? null,
    }
  }

  /**
   * Starts the two-factor enrollment, with the session or with the temporary token of a sign-in
   * that requires it. A deployment that does not offer it answers 501 (turned off) or 404 (a
   * server without two-factor authentication).
   */
  async mfaSetup(): Promise<MfaSetupResult> {
    const response = await client.post('/mfa/setup/', {}, JSON_HEADERS)
    if (response.status !== 200) {
      return { success: false, unavailable: response.status === 501 || response.status === 404 }
    }
    const content = response.content as Content
    return { success: true, secret: content.secret, provisioningUri: content.provisioning_uri }
  }

  /**
   * Activates two-factor authentication with the first code. Cornflow answers with a full session,
   * which replaces the temporary enrollment token, and with the one-time backup codes: this is the
   * only time they are shown.
   */
  async mfaVerify(totpCode: string): Promise<MfaVerifyData | null> {
    const response = await client.post('/mfa/verify/', { totp_code: totpCode }, JSON_HEADERS)
    if (response.status !== 200) return null
    const content = response.content as Content
    storeSession(content)
    return { backupCodes: content.backup_codes ?? [] }
  }

  /**
   * Drops the temporary token of an enrollment the user backed out of, so it is not sent as the
   * Bearer of later requests. A real session is never touched.
   */
  clearPendingEnrollment(): void {
    if (sessionStorage.getItem('isAuthenticated') === 'true') return
    sessionStorage.removeItem('token')
    client.initializeToken()
  }

  /**
   * Asks for a password reset link. Cornflow answers the same whether the e-mail belongs to an
   * account or not; a request cut by the rate limit is told apart, since no e-mail will come.
   */
  async requestPasswordReset(email: string): Promise<{ sent: boolean; rateLimited: boolean }> {
    const response = await client.put('/user/recover-password/', { email }, JSON_HEADERS)
    return { sent: response.status === 200, rateLimited: response.status === 429 }
  }

  /** Sets a new password with the single-use token of the reset link, sent as the Bearer. */
  async resetPassword(
    token: string,
    password: string,
  ): Promise<{ success: boolean; message?: string; linkInvalid?: boolean }> {
    const response = await client.put(
      '/user/reset-password/',
      { password },
      { ...JSON_HEADERS, Authorization: `Bearer ${token}` },
    )
    if (response.status === 200) return { success: true }
    return {
      success: false,
      message: (response.content as Content)?.error,
      // The link's token is used, revoked, expired or forged; any other 400 is the password policy.
      linkInvalid: response.status === 403 || isEndedSession(response.status, response.content),
    }
  }

  /**
   * Generates the user's personal API key; it replaces the previous one and is shown only once.
   * A user with two-factor authentication confirms it with a fresh code.
   */
  async createApiKey(totpCode?: string, scope?: 'read'): Promise<ApiKeyResult> {
    const body: Record<string, string> = {}
    if (totpCode) body.totp_code = totpCode
    if (scope) body.scope = scope
    const response = await client.post('/user/api-key/', body, JSON_HEADERS)
    const content = (response.content ?? {}) as Content
    if (response.status === 201) return { success: true, apiKey: content.api_key }
    return { success: false, disabled: response.status === 501, message: content.error }
  }

  logout(): void {
    // Closes the session on the server too, without making the user wait for it.
    const refreshToken = sessionStorage.getItem('refreshToken')
    if (refreshToken) {
      client.post('/logout/', { refresh_token: refreshToken }, JSON_HEADERS).catch(() => {})
    }
    sessionStorage.setItem('isAuthenticated', 'false')
    sessionStorage.removeItem('token')
    sessionStorage.removeItem('refreshToken')
    sessionStorage.removeItem('userId')
    sessionStorage.removeItem('pwdChangeRequired')
    clearRoleFlags()
    // Without this, a sign-in in the same tab would go on sending the previous user's Bearer.
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

  /**
   * External providers renew their token through this hook. A cornflow session is renewed by the
   * Api client with the refresh token (ApiClient.renewSession), so there is nothing to do here.
   */
  async refreshToken(): Promise<{ token: string; expiresAt: number } | null> {
    return null
  }
}

export default new AuthService()
