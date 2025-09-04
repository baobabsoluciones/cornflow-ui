import { AuthProvider } from '@/interfaces/AuthProvider';
import { OpenIDAuthService } from './OpenIDAuthService';
import CornflowAuthService from './AuthService';
import config from '@/config';

export interface AuthServices {
  cornflow: AuthProvider;
  azure: AuthProvider | null;
  cognito: AuthProvider | null;
}

export class AuthServiceFactory {
  private static instances: Partial<AuthServices> = {};
  private static initialized = false;

  static async getAllAuthServices(): Promise<AuthServices> {
    // Wait for config initialization if it hasn't happened yet
    if (!config.auth.type) {
      await config.initConfig();
    }

    if (!this.initialized) {
      await this.initializeServices();
      this.initialized = true;
    }

    return {
      cornflow: this.instances.cornflow!,
      azure: this.instances.azure || null,
      cognito: this.instances.cognito || null
    };
  }

  static async getAuthService(type: 'cornflow' | 'azure' | 'cognito'): Promise<AuthProvider | null> {
    const services = await this.getAllAuthServices();
    return services[type];
  }

  static async getDefaultAuthService(): Promise<AuthProvider> {
    const services = await this.getAllAuthServices();
    
    // Return the configured default service, or fallback to cornflow
    switch (config.auth.type) {
      case 'azure':
        return services.azure || services.cornflow;
      case 'cognito':
        return services.cognito || services.cornflow;
      default:
        return services.cornflow;
    }
  }

  private static async initializeServices(): Promise<void> {
    // Always initialize cornflow auth
    this.instances.cornflow = CornflowAuthService;

    // Initialize Azure auth if configured
    if (this.isAzureConfigured()) {
      try {
        this.instances.azure = new OpenIDAuthService('azure');
        await this.instances.azure.initialize();
      } catch (error) {
        console.warn('Failed to initialize Azure auth service:', error);
        this.instances.azure = null;
      }
    }

    // Initialize Cognito auth if configured
    if (this.isCognitoConfigured()) {
      try {
        this.instances.cognito = new OpenIDAuthService('cognito');
        await this.instances.cognito.initialize();
      } catch (error) {
        console.warn('Failed to initialize Cognito auth service:', error);
        this.instances.cognito = null;
      }
    }
  }

  static isAzureConfigured(): boolean {
    return !!(config.auth.clientId && config.auth.authority && config.auth.redirectUri);
  }

  static isCognitoConfigured(): boolean {
    return !!(config.auth.clientId && config.auth.userPoolId && config.auth.region && config.auth.domain);
  }

  static isServiceAvailable(type: 'azure' | 'cognito'): boolean {
    switch (type) {
      case 'azure':
        return this.isAzureConfigured();
      case 'cognito':
        return this.isCognitoConfigured();
      default:
        return false;
    }
  }
}

// Export a function that ensures we have the default auth service
let defaultAuthServicePromise: Promise<AuthProvider> | null = null;

export default async function getAuthService(): Promise<AuthProvider> {
  if (!defaultAuthServicePromise) {
    defaultAuthServicePromise = AuthServiceFactory.getDefaultAuthService();
  }
  return defaultAuthServicePromise;
}

// Export function to get all services
export async function getAllAuthServices(): Promise<AuthServices> {
  return AuthServiceFactory.getAllAuthServices();
}

// Export function to get specific service
export async function getSpecificAuthService(type: 'cornflow' | 'azure' | 'cognito'): Promise<AuthProvider | null> {
  return AuthServiceFactory.getAuthService(type);
}

// Export function to check if service is available
export function isAuthServiceAvailable(type: 'azure' | 'cognito'): boolean {
  return AuthServiceFactory.isServiceAvailable(type);
}
