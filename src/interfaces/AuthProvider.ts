export interface AuthProvider {
  login(username?: string, password?: string): Promise<boolean>;
  initialize(): Promise<void>;
  logout(): void;
  getToken(): string | null;
  getUserId(): string | null;
  isAuthenticated(): boolean;
  refreshToken?(): Promise<{ token: string; expiresAt: number } | null>;
  getUsername?(): string | null;
  getName?(): string | null;
  getEmail?(): string | null;
  getGivenName?(): string | null;
  getFamilyName?(): string | null;
}
