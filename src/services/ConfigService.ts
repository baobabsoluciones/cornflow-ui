import appConfig from "@/app/config";

interface ConfigValues {
    backend_url: string;
    auth_type: string;
    schema: string;
    name: string;
    hasExternalApp?: boolean;
    isStagingEnvironment?: boolean;
    useHashMode?: boolean;
    defaultLanguage?: string;
    isDeveloperMode?: boolean;
    enableSignup?: boolean;
    cognito?: {
      region: string;
      user_pool_id: string;
      client_id: string;
      domain: string;
      providers?: string[]; // Array of supported providers: ['google', 'microsoft', 'facebook', etc.]
    };
    azure?: {
      client_id: string;
      authority: string;
      redirect_uri: string;
    };
  }
  
  class ConfigService {
    private static instance: ConfigService | null = null;
    private loadPromise: Promise<ConfigValues> | null = null;
    private values: ConfigValues | null = null;
  
    private constructor() {}
  
    public static getInstance(): ConfigService {
      if (!ConfigService.instance) {
        ConfigService.instance = new ConfigService();
      }
      return ConfigService.instance;
    }
  
    async getConfig(): Promise<ConfigValues> {
      if (this.values) return this.values;
      
      // Auto-detect configuration source: if VITE_APP_SCHEMA or VITE_APP_BACKEND_URL exist, use env vars
      const hasEnvConfig = !!(import.meta.env.VITE_APP_SCHEMA || import.meta.env.VITE_APP_BACKEND_URL);
      
      if (hasEnvConfig) {
        // Return env-based config
        const envConfig = {
          backend_url: import.meta.env.VITE_APP_BACKEND_URL || '',
          auth_type: import.meta.env.VITE_APP_AUTH_TYPE || 'cornflow',
          schema: import.meta.env.VITE_APP_SCHEMA || '',
          name: import.meta.env.VITE_APP_NAME || '',
          hasExternalApp: import.meta.env.VITE_APP_EXTERNAL_APP == '1',
          isStagingEnvironment: import.meta.env.VITE_APP_IS_STAGING_ENVIRONMENT == '1',
          useHashMode: import.meta.env.VITE_APP_USE_HASH_MODE == '1',
          defaultLanguage: import.meta.env.VITE_APP_DEFAULT_LANGUAGE || '',
          isDeveloperMode: import.meta.env.VITE_APP_IS_DEVELOPER_MODE == '1',
          enableSignup: import.meta.env.VITE_APP_ENABLE_SIGNUP == '1',
          cognito: {
            region: import.meta.env.VITE_APP_AUTH_REGION || '',
            user_pool_id: import.meta.env.VITE_APP_AUTH_USER_POOL_ID || '',
            client_id: import.meta.env.VITE_APP_AUTH_CLIENT_ID || '',
            domain: import.meta.env.VITE_APP_AUTH_DOMAIN || '',
            providers: import.meta.env.VITE_APP_AUTH_PROVIDERS ? import.meta.env.VITE_APP_AUTH_PROVIDERS.split(',') : []
          },
          azure: {
            client_id: import.meta.env.VITE_APP_AUTH_CLIENT_ID || '',
            authority: import.meta.env.VITE_APP_AUTH_AUTHORITY || '',
            redirect_uri: import.meta.env.VITE_APP_AUTH_REDIRECT_URI || ''
          }
        };
        this.values = envConfig;
        return envConfig;
      }
      
      return this.loadConfig();
    }
  
    private async loadConfig(): Promise<ConfigValues> {
      if (this.loadPromise) return this.loadPromise;
  
      this.loadPromise = new Promise<ConfigValues>((resolve, reject) => {
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const valuesJsonPath = appConfig.getCore().parameters.valuesJsonPath;
        const configUrl = isLocalhost ? valuesJsonPath : `https://${window.location.hostname}${valuesJsonPath}`;
        
        fetch(configUrl)
          .then(response => response.json())
          .then(values => {
            this.values = values;
            resolve(values);
          })
          .catch(error => {
            reject(error);
          });
      });
  
      return this.loadPromise;
    }
  }
  
  const configService = ConfigService.getInstance();
  export default configService;