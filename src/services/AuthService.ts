import client from '../api/Api'
import type { LoginResult } from '../interfaces/AuthProvider'

export interface MFASetupData {
  secret: string
  provisioningUri: string
}

export interface MFAVerifyData {
  backupCodes: string[]
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
      return { success: false, errorMessage: content.error }
    }

    if (content.mfa_required) {
      // Password accepted, the TOTP code is missing: no session yet
      return { success: false, mfaRequired: true }
    }

    if (content.mfa_setup_required) {
      // Password accepted but the user must enroll in two-factor
      // authentication. The temporary token is stored so the enrollment
      // endpoints can be called; it is not a session token.
      sessionStorage.setItem('isAuthenticated', 'false')
      sessionStorage.setItem('token', content.temp_token)
      return { success: false, mfaSetupRequired: true }
    }

    sessionStorage.setItem('isAuthenticated', 'true')
    sessionStorage.setItem('token', content.token)
    sessionStorage.setItem('userId', content.id)
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
    sessionStorage.setItem('userId', content.id)
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

  logout(): void {
    sessionStorage.setItem('isAuthenticated', 'false')
    sessionStorage.removeItem('token')
    sessionStorage.removeItem('userId')
    sessionStorage.removeItem('isAdmin')
    sessionStorage.removeItem('isPlatformAdmin')
    sessionStorage.removeItem('userRoles')
    sessionStorage.removeItem('pwdChangeRequired')
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

  // Cornflow doesn't support token refresh from front-end side, tokens are managed by the backend
  async refreshToken(): Promise<{ token: string; expiresAt: number } | null> {
    return null
  }
}

export default new AuthService()
