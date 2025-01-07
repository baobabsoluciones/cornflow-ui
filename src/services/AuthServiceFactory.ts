import { AuthProvider } from '@/interfaces/AuthProvider';
import { OpenIDAuthService } from './OpenIDAuthService';
import CornflowAuthService from './AuthService';
import config from '@/config';

export class AuthServiceFactory {
  private static instance: AuthProvider | null = null;

  static async createAuthService(): Promise<AuthProvider> {    
    // Wait for config initialization if it hasn't happened yet
    if (!config.auth.type) {
      await config.initConfig();
    }
    
    // Only create new instance if we don't have one or if auth type changed
    if (!this.instance || this.instance.constructor.name !== this.getServiceName(config.auth.type)) {
      switch (config.auth.type) {
        case 'azure':
          this.instance = new OpenIDAuthService('azure');
          break;
        case 'cognito':
          this.instance = new OpenIDAuthService('cognito');
          break;
        default:
          this.instance = CornflowAuthService;
      }
    }
    
    return this.instance;
  }

  private static getServiceName(type: string): string {
    switch (type) {
      case 'azure':
      case 'cognito':
        return 'OpenIDAuthService';
      default:
        return 'AuthService';
    }
  }
}

// Export a function that ensures we have an initialized auth service
let authServicePromise: Promise<AuthProvider> | null = null;

export default async function getAuthService(): Promise<AuthProvider> {
  if (!authServicePromise) {
    authServicePromise = AuthServiceFactory.createAuthService();
  }
  return authServicePromise;
}
