export interface LoginResult {
  success: boolean
  // The user has two-factor authentication enabled and must provide a code
  mfaRequired?: boolean
  // The deployment requires two-factor authentication and the user must
  // enroll before getting a session (a temporary enrollment token is stored)
  mfaSetupRequired?: boolean
  // The password has expired or was reset and must be changed
  changePassword?: boolean
  // ISO timestamp of the previous successful login, if any
  lastLogin?: string | null
  errorMessage?: string
}

export interface AuthProvider {
  login(
    username?: string,
    password?: string,
    totpCode?: string,
  ): Promise<boolean | LoginResult>;
  initialize(): Promise<void>;
  logout(): void;
  getToken(): string | null;
  getUserId(): string | null;
  isAuthenticated(): boolean;
  refreshToken?(): Promise<{ token: string; expiresAt: number } | null>;
  mfaSetup?(): Promise<{ secret: string; provisioningUri: string } | null>;
  mfaVerify?(totpCode: string): Promise<{ backupCodes: string[] } | null>;
  requestPasswordReset?(email: string): Promise<boolean>;
  resetPassword?(
    token: string,
    password: string,
  ): Promise<{ success: boolean; message?: string; linkInvalid?: boolean }>;
  getUsername?(): string | null;
  getName?(): string | null;
  getEmail?(): string | null;
  getGivenName?(): string | null;
  getFamilyName?(): string | null;
}
