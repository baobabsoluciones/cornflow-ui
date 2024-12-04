export interface AuthConfig {
  type: 'cornflow' | 'azure' | 'cognito';
  clientId?: string;
  userPoolId?: string;
  authority?: string;
  redirectUri?: string;
  domain?: string;
}

const auth: AuthConfig = {
  type: (import.meta.env.VITE_APP_AUTH_TYPE as AuthConfig['type']) || 'cornflow',
  clientId: import.meta.env.VITE_APP_AUTH_CLIENT_ID,
  userPoolId: import.meta.env.VITE_APP_AUTH_USER_POOL_ID,
  authority: import.meta.env.VITE_APP_AUTH_AUTHORITY,
  redirectUri: import.meta.env.VITE_APP_AUTH_REDIRECT_URI,
  domain: `https://${import.meta.env.VITE_APP_AUTH_DOMAIN}`,
};

export default auth;
