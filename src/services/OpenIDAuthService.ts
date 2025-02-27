import { AuthProvider } from '@/interfaces/AuthProvider'
import { PublicClientApplication, Configuration } from '@azure/msal-browser'
import { Amplify } from 'aws-amplify'
import { signInWithRedirect, signOut, fetchAuthSession } from 'aws-amplify/auth'
import client from '@/api/Api'
import config from '@/config'
import router from '@/router'

export class OpenIDAuthService implements AuthProvider {
  private msalInstance: PublicClientApplication | null = null
  private initialized: boolean = false
  private handlingRedirect: boolean = false
  private loginAttempted: boolean = false
  private initializationPromise: Promise<void> | null = null

  constructor(private provider: 'azure' | 'cognito') {
    if (provider === 'azure') {
      this.initializationPromise = this.initializeAzure()
    } else if (provider === 'cognito') {
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

      const cognitoConfig = {
        Auth: {
          Cognito: {
            userPoolId: config.auth.userPoolId,
            userPoolClientId: config.auth.clientId,
            signUpVerificationMethod: 'code' as const,
            loginWith: {
              oauth: {
                domain: config.auth.domain,
                scopes: ['openid', 'email', 'profile'],
                redirectSignIn: redirectUrls,
                redirectSignOut: redirectUrls,
                responseType: 'code' as const
              }
            }
          }
        } 
      };

      Amplify.configure(cognitoConfig);
      this.initialized = true;

      if (!this.handlingRedirect) {
        this.handlingRedirect = true;
        try {
          const session = await fetchAuthSession();
          if (session.tokens?.idToken) {
            await this.handleAuthResponse({
              idToken: session.tokens.idToken.toString(),
              provider: 'cognito'
            });
          }
        } catch (error) {
          console.error('Failed to handle Cognito redirect:', error);
          this.loginAttempted = true;
        } finally {
          this.handlingRedirect = false;
        }
      }
    } catch (error) {
      console.error('Failed to initialize Cognito:', error);
      this.handlingRedirect = false;
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

  async login(): Promise<boolean> {
    try {
      
      if (this.initializationPromise) {
        await this.initializationPromise;
      }

      if (this.handlingRedirect) {
        return false;
      }

      if (this.isAuthenticated()) {
        return true;
      }

      if (this.loginAttempted) {
        return false;
      }

      if (this.provider === 'azure' && this.msalInstance) {
        const loginRequest = {
          scopes: ['openid', 'profile', 'email', 'User.Read'],
          prompt: 'select_account'
        };

        this.loginAttempted = true;
        await this.msalInstance.loginRedirect(loginRequest);
        return true;
      } else if (this.provider === 'cognito') {
        this.loginAttempted = true;
        await signInWithRedirect({ provider: { custom: 'AzureAD' } });
        return true;
      }

      return false;
    } catch (error) {
      this.loginAttempted = true;
      console.error('OpenIDAuthService: Login failed:', error);
      throw error;
    }
  }

  private async handleAuthResponse(response: any) {
    if (response) {
      try {
          const token = response.idToken || response.accessToken;
        const tokenClaims = this.decodeToken(token);
        
        if (!tokenClaims) {
          this.loginAttempted = false;
          await this.retryAuthentication();
          return;
        }
        
        try {
          const backendResponse = await client.post(
            '/login/',
            {},
            { 
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization': `Bearer ${token}`
            }
          );

          if (backendResponse.status === 200) {
            const backendToken = backendResponse.content.token;
            
            sessionStorage.setItem('isAuthenticated', 'true');
            sessionStorage.setItem('token', backendToken);
            sessionStorage.setItem('userId', backendResponse.content.id);
            
            if (tokenClaims) {
              sessionStorage.setItem('username', 
                tokenClaims['cognito:username'] || 
                tokenClaims.preferred_username || 
                tokenClaims.email || 
                '');
              sessionStorage.setItem('email', 
                tokenClaims.email || 
                tokenClaims.preferred_username || 
                '');
              sessionStorage.setItem('name', tokenClaims.name || '');
              sessionStorage.setItem('given_name', tokenClaims.given_name || '');
              sessionStorage.setItem('family_name', tokenClaims.family_name || '');
            }
            
            client.getHeaders = () => ({
              Accept: 'application/json',
              Authorization: `Bearer ${backendToken}`
            });

            router.push('/project-execution');
          } else {
            console.error('Backend Response:', backendResponse);
            await this.retryAuthentication();
          }
        } catch (error) {
          console.error('Backend authentication failed:', error);
          if (error.response?.status === 400) {
            await this.retryAuthentication();
          } else {
            throw error;
          }
        }
      } catch (error) {
        console.error('Authentication error:', error);
        await this.retryAuthentication();
      }
    }
  }

  private async retryAuthentication() {
    this.loginAttempted = false
    
    sessionStorage.removeItem('token')
    sessionStorage.setItem('isAuthenticated', 'false')

    if (this.provider === 'azure' && this.msalInstance) {
      await this.msalInstance.loginRedirect({
        scopes: ['openid', 'profile', 'email', 'User.Read'],
        prompt: 'select_account'
      })
    } else if (this.provider === 'cognito') {
      await signInWithRedirect({provider:{ custom: 'AzureAD'}})
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
  isAuthenticated = () => sessionStorage.getItem('isAuthenticated') === 'true'
  getUsername = () => sessionStorage.getItem('username')
  getName = () => sessionStorage.getItem('name')
  getEmail = () => sessionStorage.getItem('email')
  getGivenName = () => sessionStorage.getItem('given_name')
  getFamilyName = () => sessionStorage.getItem('family_name')

  public async makeAuthenticatedRequest(url: string, options: RequestInit = {}): Promise<Response> {
    const token = await this.getToken();
    
    const headers = new Headers(options.headers || {});
    headers.set('Authorization', `Bearer ${token}`);
    
    return fetch(url, {
      ...options,
      headers
    });
  }

  private setAuthHeader(headers: Headers): void {
    const token = this.getToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }
}
