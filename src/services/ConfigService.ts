import config from "@/app/config";

interface ConfigValues {
    backend_url: string;
    auth_type: string;
    schema: string;
    name: string;
    cognito?: {
      region: string;
      user_pool_id: string;
      client_id: string;
      domain: string;
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
      
      const useConfigJson = config.getCore().parameters.useConfigJson
      
      if (!useConfigJson) {
        // Return env-based config
        const config = {
          backend_url: import.meta.env.VITE_APP_BACKEND_URL,
          auth_type: import.meta.env.VITE_APP_AUTH_TYPE,
          schema: import.meta.env.VITE_APP_SCHEMA,
          name: import.meta.env.VITE_APP_NAME,
          cognito: {
            region: import.meta.env.VITE_APP_AUTH_REGION,
            user_pool_id: import.meta.env.VITE_APP_AUTH_USER_POOL_ID,
            client_id: import.meta.env.VITE_APP_AUTH_CLIENT_ID,
            domain: import.meta.env.VITE_APP_AUTH_DOMAIN
          }
        };
        this.values = config;
        return config;
      }
      
      return this.loadConfig();
    }
  
    private async loadConfig(): Promise<ConfigValues> {
      if (this.loadPromise) return this.loadPromise;
  
      this.loadPromise = new Promise<ConfigValues>((resolve, reject) => {
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const configUrl = isLocalhost ? '/values.json' : `https://${window.location.hostname}/values.json`;
        
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