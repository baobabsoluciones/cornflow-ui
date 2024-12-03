export interface OpenIDConfig {
  clientId: string;
  clientSecret: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  redirectUri: string;
  scope: string;
  logoutUrl?: string;
}

export interface AuthConfig {
  type: 'cornflow' | 'openid';
  openId?: OpenIDConfig;
}

const auth: AuthConfig = {
  type: process.env.VUE_APP_AUTH_TYPE || 'cornflow',
  openId: process.env.VUE_APP_AUTH_TYPE === 'openid' ? {
    clientId: process.env.VUE_APP_OPENID_CLIENT_ID || '',
    clientSecret: process.env.VUE_APP_OPENID_CLIENT_SECRET || '',
    authorizationEndpoint: process.env.VUE_APP_OPENID_AUTH_ENDPOINT || '',
    tokenEndpoint: process.env.VUE_APP_OPENID_TOKEN_ENDPOINT || '',
    redirectUri: process.env.VUE_APP_OPENID_REDIRECT_URI || '',
    scope: process.env.VUE_APP_OPENID_SCOPE || 'openid profile email',
    logoutUrl: process.env.VUE_APP_OPENID_LOGOUT_URL,
  } : undefined
};

export default auth;
