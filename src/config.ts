import configService from '@/services/ConfigService';

const config = {
  backend: import.meta.env.VITE_APP_BACKEND_URL || '',
  schema: import.meta.env.VITE_APP_SCHEMA || 'rostering',
  name: import.meta.env.VITE_APP_NAME || 'Rostering',
  auth: {
    type: import.meta.env.VITE_APP_AUTH_TYPE || 'cornflow',
    clientId: import.meta.env.VITE_APP_AUTH_CLIENT_ID,
    authority: import.meta.env.VITE_APP_AUTH_AUTHORITY,
    redirectUri: import.meta.env.VITE_APP_AUTH_REDIRECT_URI,
    region: import.meta.env.VITE_APP_AUTH_REGION,
    userPoolId: import.meta.env.VITE_APP_AUTH_USER_POOL_ID,
    domain: import.meta.env.VITE_APP_AUTH_DOMAIN
  },
  async initConfig() {
    try {
      console.log('Starting config initialization...');
      const values = await configService.getConfig();
      console.log('Loaded config values:', values);
      
      this.backend = values.backend_url;
      this.schema = values.schema;
      this.name = values.name;
      
      // More detailed auth configuration
      if (values.auth_type === 'cognito' && values.cognito) {
        this.auth = {
          type: 'cognito',
          clientId: values.cognito.client_id,
          region: values.cognito.region,
          userPoolId: values.cognito.user_pool_id,
          domain: values.cognito.domain
        };
      } else if (values.auth_type === 'azure' && values.azure) {
        this.auth = {
          type: 'azure',
          clientId: values.azure.client_id,
          authority: values.azure.authority,
          redirectUri: values.azure.redirect_uri
        };
      } else {
        this.auth = {
          type: 'cornflow'
        };
      }
      
      console.log('Final config:', {
        backend: this.backend,
        schema: this.schema,
        name: this.name,
        auth: this.auth
      });
    } catch (error) {
      console.error('Error initializing config:', error);
    }
  }
};

export default config;