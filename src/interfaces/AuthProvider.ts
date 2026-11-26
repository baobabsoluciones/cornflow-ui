export type SsoIdentityProvider = 'microsoft' | 'google';

/** How a username and password sign-in went. */
export interface LoginResult {
  success: boolean
  /** The password is right and the user has two-factor authentication: the code is missing. */
  mfaRequired?: boolean
  /**
   * The password is right and the deployment requires two-factor authentication, which the user
   * has not set up yet: the enrollment comes before the session.
   */
  mfaSetupRequired?: boolean
  /** The password has expired or was reset, and must be changed before going on. */
  changePassword?: boolean
  /** When the previous successful sign-in was (ISO 8601), if there was one. */
  lastLogin?: string | null
  /** Too many attempts from this address (HTTP 429): the credentials were not checked. */
  rateLimited?: boolean
  /** Too many failed attempts on this account: only a platform administrator can unlock it. */
  accountLocked?: boolean
  /** The server failed (5xx): neither the credentials nor the code were judged. */
  serverError?: boolean
  errorMessage?: string
}

export interface MfaSetupResult {
  success: boolean
  secret?: string
  provisioningUri?: string
  /** The deployment does not offer two-factor authentication: turned off (501) or missing (404). */
  unavailable?: boolean
}

export interface MfaVerifyData {
  backupCodes: string[]
}

export interface ApiKeyResult {
  success: boolean
  apiKey?: string
  /** The deployment has personal tokens turned off. */
  disabled?: boolean
  message?: string
}

export interface AuthProvider {
  login(username?: string, password?: string, totpCode?: string): Promise<boolean | LoginResult>;
  /** Single sign-on with the identity provider the user picked (external auth only). */
  loginWith?(provider: SsoIdentityProvider): Promise<boolean>;
  initialize(): Promise<void>;
  logout(): void;
  getToken(): string | null;
  getUserId(): string | null;
  isAuthenticated(): boolean;
  refreshToken?(): Promise<{ token: string; expiresAt: number } | null>;
  /** Starts the two-factor enrollment: the secret and the URI its QR code encodes. */
  mfaSetup?(): Promise<MfaSetupResult>;
  /** Activates two-factor authentication with the first code; returns the one-time backup codes. */
  mfaVerify?(totpCode: string): Promise<MfaVerifyData | null>;
  /** Drops the temporary token of an enrollment left half way. */
  clearPendingEnrollment?(): void;
  requestPasswordReset?(email: string): Promise<{ sent: boolean; rateLimited: boolean }>;
  resetPassword?(
    token: string,
    password: string,
  ): Promise<{ success: boolean; message?: string; linkInvalid?: boolean }>;
  /** A personal API key; `scope: 'read'` asks for a read-only one. */
  createApiKey?(totpCode?: string, scope?: 'read'): Promise<ApiKeyResult>;
  getUsername?(): string | null;
  getName?(): string | null;
  getEmail?(): string | null;
  getGivenName?(): string | null;
  getFamilyName?(): string | null;
}

/** A provider's login answer as a LoginResult (external providers answer with a boolean). */
export const toLoginResult = (result: boolean | LoginResult): LoginResult =>
  typeof result === 'boolean' ? { success: result } : result
