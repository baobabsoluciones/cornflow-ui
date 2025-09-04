import configService from '@/services/ConfigService';
import appConfig from '@/app/config';
import { parseBoolean } from '@/utils/common';

const config = {
  backend: '',
  schema: '',
  name: '',
  hasExternalApp: false,
  isStagingEnvironment: false,
  useHashMode: false,
  defaultLanguage: '',
  isDeveloperMode: false,
  enableSignup: false,
  valuesJsonPath: '/values.json',
  auth: {
    type: 'cornflow',
    clientId: '',
    authority: '',
    redirectUri: '',
    region: '',
    userPoolId: '',
    domain: '',
    providers: []
  },
  async initConfig() {
    try {
      // Auto-detect configuration source: if VITE_APP_SCHEMA or VITE_APP_BACKEND_URL exist, use env vars
      // Otherwise, use values.json from the configured path
      const hasEnvConfig = !!(import.meta.env.VITE_APP_SCHEMA || import.meta.env.VITE_APP_BACKEND_URL);
      const useConfigJson = !hasEnvConfig; 
      
      if (useConfigJson) {
        // Get valuesJsonPath from app config before loading
        this.valuesJsonPath = appConfig.getCore().parameters.valuesJsonPath || '/values.json';
        
        // Get values from values.json
        const values = await configService.getConfig();
        
        this.backend = values.backend_url;
        this.schema = values.schema;
        this.name = values.name;
        this.hasExternalApp = parseBoolean(values.hasExternalApp) ?? config.hasExternalApp;
        this.isStagingEnvironment = parseBoolean(values.isStagingEnvironment) ?? config.isStagingEnvironment;
        this.useHashMode = parseBoolean(values.useHashMode) ?? config.useHashMode;
        this.defaultLanguage = values.defaultLanguage || config.defaultLanguage;
        this.isDeveloperMode = parseBoolean(values.isDeveloperMode) ?? config.isDeveloperMode;
        this.enableSignup = parseBoolean(values.enableSignup) ?? config.enableSignup;
        
        // More detailed auth configuration
        if (values.auth_type === 'cognito' && values.cognito) {
          this.auth = {
            type: 'cognito',
            clientId: values.cognito.client_id,
            region: values.cognito.region,
            userPoolId: values.cognito.user_pool_id,
            domain: values.cognito.domain,
            providers: values.cognito.providers || []
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
      } else {
        // Use environment variables
        this.backend = import.meta.env.VITE_APP_BACKEND_URL || '';
        this.schema = import.meta.env.VITE_APP_SCHEMA || '';
        this.name = import.meta.env.VITE_APP_NAME || '';
        this.hasExternalApp = parseBoolean(import.meta.env.VITE_APP_EXTERNAL_APP) ?? config.hasExternalApp;
        this.isStagingEnvironment = parseBoolean(import.meta.env.VITE_APP_IS_STAGING_ENVIRONMENT) ?? config.isStagingEnvironment;
        this.useHashMode = parseBoolean(import.meta.env.VITE_APP_USE_HASH_MODE) ?? config.useHashMode;
        this.defaultLanguage = import.meta.env.VITE_APP_DEFAULT_LANGUAGE || config.defaultLanguage;
        this.isDeveloperMode = parseBoolean(import.meta.env.VITE_APP_IS_DEVELOPER_MODE) ?? config.isDeveloperMode;
        this.enableSignup = parseBoolean(import.meta.env.VITE_APP_ENABLE_SIGNUP) ?? config.enableSignup;
        
        this.auth = {
          type: import.meta.env.VITE_APP_AUTH_TYPE || 'cornflow',
          clientId: import.meta.env.VITE_APP_AUTH_CLIENT_ID || '',
          authority: import.meta.env.VITE_APP_AUTH_AUTHORITY || '',
          redirectUri: import.meta.env.VITE_APP_AUTH_REDIRECT_URI || '',
          region: import.meta.env.VITE_APP_AUTH_REGION || '',
          userPoolId: import.meta.env.VITE_APP_AUTH_USER_POOL_ID || '',
          domain: import.meta.env.VITE_APP_AUTH_DOMAIN || '',
          providers: import.meta.env.VITE_APP_AUTH_PROVIDERS ? import.meta.env.VITE_APP_AUTH_PROVIDERS.split(',') : []
        };
      }
    } catch (error) {
      console.error('Error initializing config:', error);
      
      // Fallback to environment variables if values.json fails
      this.backend = import.meta.env.VITE_APP_BACKEND_URL || '';
      this.schema = import.meta.env.VITE_APP_SCHEMA || '';
      this.name = import.meta.env.VITE_APP_NAME || '';
      this.hasExternalApp = parseBoolean(import.meta.env.VITE_APP_EXTERNAL_APP) ?? false;
      this.isStagingEnvironment = parseBoolean(import.meta.env.VITE_APP_IS_STAGING_ENVIRONMENT) ?? false;
      this.useHashMode = parseBoolean(import.meta.env.VITE_APP_USE_HASH_MODE) ?? false;
      this.defaultLanguage = import.meta.env.VITE_APP_DEFAULT_LANGUAGE || '';
      this.isDeveloperMode = parseBoolean(import.meta.env.VITE_APP_IS_DEVELOPER_MODE) ?? false;
      this.enableSignup = parseBoolean(import.meta.env.VITE_APP_ENABLE_SIGNUP) ?? false;
      
      this.auth = {
        type: import.meta.env.VITE_APP_AUTH_TYPE || 'cornflow',
        clientId: import.meta.env.VITE_APP_AUTH_CLIENT_ID || '',
        authority: import.meta.env.VITE_APP_AUTH_AUTHORITY || '',
        redirectUri: import.meta.env.VITE_APP_AUTH_REDIRECT_URI || '',
        region: import.meta.env.VITE_APP_AUTH_REGION || '',
        userPoolId: import.meta.env.VITE_APP_AUTH_USER_POOL_ID || '',
        domain: import.meta.env.VITE_APP_AUTH_DOMAIN || '',
        providers: import.meta.env.VITE_APP_AUTH_PROVIDERS ? import.meta.env.VITE_APP_AUTH_PROVIDERS.split(',') : []
      };
    }
  },
  
  // Helper methods to determine OAuth provider capabilities
  isMicrosoftConfigured(): boolean {
    if (this.auth.type === 'cornflow') return false;
    
    // Azure is always Microsoft
    if (this.auth.type === 'azure') {
      return !!(this.auth.clientId && this.auth.authority);
    }
    
    // For Cognito, check if it's configured and if Microsoft is in the providers list
    if (this.auth.type === 'cognito') {
      const isConfigured = !!(this.auth.clientId && this.auth.region && this.auth.userPoolId);
      const hasMicrosoftProvider = this.auth.providers?.includes('microsoft') || this.auth.providers?.includes('Microsoft');
      return isConfigured && hasMicrosoftProvider;
    }
    
    return false;
  },
  
  isGoogleConfigured(): boolean {
    if (this.auth.type === 'cornflow') return false;
    
    // Azure is primarily for Microsoft auth
    if (this.auth.type === 'azure') {
      return false;
    }
    
    // For Cognito, check if it's configured and if Google is in the providers list
    if (this.auth.type === 'cognito') {
      const isConfigured = !!(this.auth.clientId && this.auth.region && this.auth.userPoolId);
      const hasGoogleProvider = this.auth.providers?.includes('google') || this.auth.providers?.includes('Google');
      return isConfigured && hasGoogleProvider;
    }
    
    return false;
  },
  
  getConfiguredOAuthProvider(): 'microsoft' | 'google' | 'both' | 'none' {
    if (this.auth.type === 'cornflow') return 'none';
    
    const microsoftConfigured = this.isMicrosoftConfigured();
    const googleConfigured = this.isGoogleConfigured();
    
    if (microsoftConfigured && googleConfigured) return 'both';
    if (microsoftConfigured) return 'microsoft';
    if (googleConfigured) return 'google';
    
    return 'none';
  }
};

export default config;