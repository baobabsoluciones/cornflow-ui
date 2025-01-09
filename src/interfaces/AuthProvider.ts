export interface AuthProvider {
  login(username?: string, password?: string): Promise<boolean>;
  logout(): void;
  getToken(): string | null;
  getUserId(): string | null;
  isAuthenticated(): boolean;
  getUsername?(): string | null;
  getName?(): string | null;
  getEmail?(): string | null;
  getGivenName?(): string | null;
  getFamilyName?(): string | null;
}
