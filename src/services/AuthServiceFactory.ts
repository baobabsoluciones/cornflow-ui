import { AuthProvider } from '@/interfaces/AuthProvider';
import { OpenIDAuthService } from './OpenIDAuthService';
import CornflowAuthService from './AuthService';
import config from '@/config';

export class AuthServiceFactory {
  static createAuthService(): AuthProvider {
    switch (config.auth.type) {
      case 'azure':
        return new OpenIDAuthService('azure');
      case 'cognito':
        return new OpenIDAuthService('cognito');
      default:
        return CornflowAuthService;
    }
  }
}

export default AuthServiceFactory.createAuthService();
