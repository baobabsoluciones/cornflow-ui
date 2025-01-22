import { AuthProvider } from '@/interfaces/AuthProvider'
import { PublicClientApplication, Configuration } from '@azure/msal-browser'
import { Amplify } from 'aws-amplify'
import { signInWithRedirect, signOut, fetchAuthSession } from 'aws-amplify/auth'
import client from '@/api/Api'
import config from '@/config'
import { ResourcesConfig } from '@aws-amplify/core'

export class OpenIDAuthService implements AuthProvider {
  private msalInstance: PublicClientApplication | null = null
  private initialized: boolean = false
  private handlingRedirect: boolean = false
  private loginAttempted: boolean = false
  private initializationPromise: Promise<void> | null = null

  constructor(private provider: 'azure' | 'cognito') {
    console.log("OpenIDAuthService constructor")
    if (provider === 'azure') {
      this.initializationPromise = this.initializeAzure()
    } else if (provider === 'cognito') {
      console.log("OpenIDAuthService call initializeCognito")
      this.initializationPromise = this.initializeCognito()
    }
  }

  private async initializeAzure() {
    if (this.initialized) return

    try {
      const msalConfig: Configuration = {
        auth: {
          clientId: config.auth.clientId,
          authority: config.auth.authority,
          redirectUri: config.auth.redirectUri,
          navigateToLoginRequestUrl: false,
        },
        cache: { 
          cacheLocation: 'sessionStorage',
          storeAuthStateInCookie: false
        }
      }
      
      this.msalInstance = new PublicClientApplication(msalConfig)
      await this.msalInstance.initialize()
      this.initialized = true

      if (!this.handlingRedirect) {
        this.handlingRedirect = true
        try {
          const response = await this.msalInstance.handleRedirectPromise()
          console.log('Redirect Response:', response)
          if (response) {
            await this.handleAuthResponse(response)
          }
        } catch (error) {
          console.error('Failed to handle redirect:', error)
          this.loginAttempted = true
        } finally {
          this.handlingRedirect = false
        }
      }
    } catch (error) {
      console.error('Failed to initialize MSAL:', error)
      this.handlingRedirect = false
      throw error
    }
  }

  private async initializeCognito() {
    if (this.initialized) return

    try {
      const redirectUrls = [window.location.origin];
      
      if (!config.auth.domain) {
        throw new Error('Cognito domain is not configured');
      }

      const cognitoConfig: ResourcesConfig = {
        Auth: {
          Cognito: {
            userPoolId: config.auth.userPoolId,
            userPoolClientId: config.auth.clientId,
            loginWith: {
              oauth: {
                domain: config.auth.domain,
                scopes: ['openid', 'email'],
                redirectSignIn: redirectUrls,
                redirectSignOut: redirectUrls,
                responseType: 'code'
              }
            }
          }
        } 
      };

      Amplify.configure(cognitoConfig);
      this.initialized = true;

      try {
        const session = await fetchAuthSession();
        if (session.tokens?.idToken) {
          await this.handleAuthResponse({
            idToken: session.tokens.idToken.toString(),
            provider: 'cognito'
          });
        }
      } catch (error) {
        console.log('Initial session check:', error);
      }
    } catch (error) {
      console.error('Failed to initialize Cognito:', error);
      throw error;
    }
  }

  private decodeToken(token: string): any {
    try {
      if (!token) {
        console.error('No token provided to decode')
        return null
      }
      const base64Url = token.split('.')[1]
      if (!base64Url) {
        console.error('Invalid token format')
        return null
      }
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
      }).join(''))
      return JSON.parse(jsonPayload)
    } catch (error) {
      console.error('Error decoding token:', error)
      return null
    }
  }

  private isTokenExpired(token: string): boolean {
    try {
      const tokenClaims = this.decodeToken(token);
      
      if (!tokenClaims || !tokenClaims.exp) return true;

      const expirationTime = tokenClaims.exp * 1000;
      const currentTime = Date.now();
      
      // 5-minute buffer before actual expiration
      return expirationTime <= (currentTime + 5 * 60 * 1000);
    } catch {
      return true;
    }
  }

  async login(username?: string, password?: string): Promise<boolean> {
    try {
      // Check if JWT is already in session storage
      const existingToken = sessionStorage.getItem('openIdToken');
      if (existingToken) {
        console.log('Existing OpenID token found');
        
        // Verify token is still valid and not expired
        const tokenClaims = this.decodeToken(existingToken);
        if (tokenClaims && !this.isTokenExpired(existingToken)) {
          console.log('Existing token is valid, restoring authentication state');
          // Restore authentication state
          sessionStorage.setItem('isAuthenticated', 'true');
          sessionStorage.setItem('token', existingToken);
          sessionStorage.setItem('openIdToken', existingToken);
          sessionStorage.setItem('userId', tokenClaims.sub || '');
          
          return true;
        } else {
          console.log('Existing token is expired or invalid, initiating re-authentication');
          // Clear expired token
          sessionStorage.removeItem('openIdToken');
          sessionStorage.removeItem('token');
          sessionStorage.removeItem('userId');
        }
      }

      // Remove redirect flag on new login attempt
      sessionStorage.removeItem('redirected');

      // If username and password are provided, it's likely a Cornflow-style login
      if (username && password) {
        // This should be handled by the Cornflow auth service
        return false;
      }

      // Wait for initialization if not done
      if (this.initializationPromise) {
        await this.initializationPromise;
      }

      // Check if already authenticated
      if (this.isAuthenticated()) {
        console.log('Already authenticated');
        return true;
      }

      // Prevent multiple login attempts
      if (this.loginAttempted) {
        console.log('Login already in progress');
        return false;
      }

      this.loginAttempted = true;

      // Check if we're already handling a redirect
      if (this.handlingRedirect) {
        console.log('Already handling redirect');
        return false;
      }

      this.handlingRedirect = true;
      try {
        if (this.provider === 'azure' && this.msalInstance) {
          // For Azure, use loginRedirect
          await this.msalInstance.loginRedirect({
            scopes: ['openid', 'profile', 'email', 'User.Read'],
            prompt: 'select_account'
          });
        } else if (this.provider === 'cognito') {
          await signInWithRedirect({provider:{ custom: 'AzureAD'}});
        }
      } catch (error) {
        console.error('Login redirect failed:', error);
        this.handlingRedirect = false;
        this.loginAttempted = false;
        throw error;
      }

      return true;
    } catch (error) {
      console.error('Login failed:', error);
      this.loginAttempted = false;
      this.handlingRedirect = false;
      throw error;
    }
  }

  private async handleAuthResponse(response: any) {
    if (!response) {
      console.error('No auth response received');
      this.loginAttempted = false;
      this.handlingRedirect = false;
      return;
    }

    try {
      const token = response.idToken || response.accessToken;
      const tokenClaims = this.decodeToken(token);

      if (!tokenClaims) {
        console.error('Failed to decode token claims');
        this.loginAttempted = false;
        this.handlingRedirect = false;
        return;
      } else {
        sessionStorage.setItem('openIdToken', token);
      }

      // Call backend to validate token and user info
      const loginResponse = await client.post(
        '/login/',
        { 
          token: token,
        },
        { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      );

      const isAuthenticated = loginResponse.status === 200;
      if (!isAuthenticated) {
        throw new Error('Backend authentication failed');
      }

      const openIdtoken = loginResponse.content.token;
      const userId = loginResponse.content.id;

      sessionStorage.setItem('isAuthenticated', 'true');
      sessionStorage.setItem('token', openIdtoken);
      sessionStorage.setItem('openIdToken', openIdtoken);
      sessionStorage.setItem('userId', userId);

      // Reset login and redirect flags
      this.loginAttempted = false;
      this.handlingRedirect = false;

      this.updateClientHeaders(token);
      this.safeRedirectToProjectExecution();
      
    } catch (error) {
      console.error('Authentication error:', error);
      // Clear all auth state on failure
      sessionStorage.clear();
      sessionStorage.setItem('isAuthenticated', 'false');
      this.loginAttempted = false;
      this.handlingRedirect = false;
      throw error; // Let the login method handle the error
    }
  }

  private safeRedirectToProjectExecution() {
    const currentPath = window.location.pathname;
    if (currentPath !== '/project-execution') {
      console.log('Redirecting to project-execution');
      window.location.replace('/project-execution');
    } else {
      console.log('Already on project-execution page');
    }
  }

  logout(): void {
    this.loginAttempted = false
    sessionStorage.setItem('isAuthenticated', 'false')
    sessionStorage.removeItem('openIdToken')
    sessionStorage.removeItem('token')
    sessionStorage.removeItem('userId')
    sessionStorage.removeItem('username')
    sessionStorage.removeItem('name')
    sessionStorage.removeItem('email')
    sessionStorage.removeItem('given_name')
    sessionStorage.removeItem('family_name')
    
    if (this.provider === 'azure' && this.msalInstance) {
      this.msalInstance.logoutRedirect({
        postLogoutRedirectUri: window.location.origin
      })
    } else if (this.provider === 'cognito') {
      signOut()
    }
  }

  getToken = () => sessionStorage.getItem('token')
  getUserId = () => sessionStorage.getItem('userId')
  isAuthenticated = () => {
    const isAuthenticatedFlag = sessionStorage.getItem('isAuthenticated') === 'true';
    const token = sessionStorage.getItem('token');
    const hasToken = !!token;
    const hasUserId = !!sessionStorage.getItem('userId');

    // Additional check for token expiration
    const isTokenValid = hasToken ? !this.isTokenExpired(token) : false;

    const result = isAuthenticatedFlag && isTokenValid && hasUserId;
    
    console.log('Authentication comprehensive check:', {
      isAuthenticatedFlag,
      hasToken,
      hasUserId,
      isTokenValid,
      result,
      openIdToken: !!sessionStorage.getItem('openIdToken')
    });

    return result;
  }
  getUsername = () => sessionStorage.getItem('username')
  getName = () => sessionStorage.getItem('name')
  getEmail = () => sessionStorage.getItem('email')
  getGivenName = () => sessionStorage.getItem('given_name')
  getFamilyName = () => sessionStorage.getItem('family_name')

  private updateClientHeaders(token: string) {
    client.updateHeaders({
      Accept: 'application/json',
      Authorization: `access_token ${token}`
    });
  }

  async getValidToken(): Promise<string | null> {
    return this.getToken();
  }
}
