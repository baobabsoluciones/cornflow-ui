export default {
  backend: import.meta.env.VITE_APP_BACKEND_URL,
  auth: {
    type: import.meta.env.VITE_APP_AUTH_TYPE || 'cornflow',
    clientId: import.meta.env.VITE_APP_AUTH_CLIENT_ID,
    authority: import.meta.env.VITE_APP_AUTH_AUTHORITY,
    redirectUri: import.meta.env.VITE_APP_AUTH_REDIRECT_URI,
    region: import.meta.env.VITE_APP_AUTH_REGION,
    userPoolId: import.meta.env.VITE_APP_AUTH_USER_POOL_ID,
    domain: import.meta.env.VITE_APP_AUTH_DOMAIN
  }
};