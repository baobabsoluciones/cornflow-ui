import { AuthProvider } from '@cornflow-ui/core/interfaces/AuthProvider'
import { PublicClientApplication, Configuration } from '@azure/msal-browser'
import { Amplify } from 'aws-amplify'
import { signInWithRedirect, signOut, fetchAuthSession } from 'aws-amplify/auth'
import client from '@cornflow-ui/core/api/Api'
import config from '@cornflow-ui/core/config'
import { getRouter } from '@cornflow-ui/core/router'

export class OpenIDAuthService implements AuthProvider {
  private msalInstance: PublicClientApplication | null = null
  private initialized: boolean = false
  private handlingRedirect: boolean = false
  private loginAttempted: boolean = false
  private initializationPromise: Promise<void> | null = null

  constructor(private readonly provider: 'azure' | 'cognito') {}

  /**
   * Initializes the authentication service based on the provider.
   * This should be called immediately after creating an instance.
   */
  async initialize(): Promise<void> {
    if (this.initializationPromise !== null) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.provider === 'azure' 
      ? this.initializeAzure()
      : this.initializeCognito();

    return this.initializationPromise;
  }

  private async initializeAzure() {
    if (this.initialized) return

    try {
      const msalConfig = {
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
      } as Configuration
      
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

  private async initializeCognito(skipSessionCheck: boolean = false) {
    if (this.initialized) return

    try {
      const redirectUrls = [globalThis.location.origin];
      
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

      if (!skipSessionCheck && !this.handlingRedirect) {
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
      const base64 = base64Url.replaceAll('-', '+').replaceAll('_', '/')
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + (c.codePointAt(0) ?? 0).toString(16)).slice(-2)
      }).join(''))
      return JSON.parse(jsonPayload)
    } catch (error) {
      console.error('Error decoding token:', error)
      return null
    }
  }

  async login(): Promise<boolean> {
    try {
      // First clear any stale auth data before attempting login
      this.clearLocalStorageAuthData();
      
      // Ensure service is initialized
      await this.initialize();

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
      
      // Clear any partial authentication data that might be causing issues
      this.clearLocalStorageAuthData();
      
      throw error;
    }
  }

  /**
   * Stores authentication session data including tokens and user claims
   */
  private storeAuthSessionData(
    backendToken: string,
    userId: string,
    tokenClaims: any,
    originalToken: string,
    response: any,
  ): void {
    sessionStorage.setItem('isAuthenticated', 'true')
    sessionStorage.setItem('token', backendToken)
    sessionStorage.setItem('userId', userId)

    // Store token expiration
    if (tokenClaims?.exp) {
      const expirationTime = tokenClaims.exp * 1000
      sessionStorage.setItem('tokenExpiration', expirationTime.toString())
      sessionStorage.setItem('originalToken', originalToken)
    }

    // Store Azure-specific token metadata
    if (this.provider === 'azure' && response.expiresOn) {
      sessionStorage.setItem('azureTokenExpiration', response.expiresOn.getTime().toString())
    }

    // Store refresh token expiration if available
    if (response.refreshTokenExpiresIn) {
      const refreshExpiration = Date.now() + response.refreshTokenExpiresIn * 1000
      sessionStorage.setItem('refreshTokenExpiration', refreshExpiration.toString())
    }
  }

  /**
   * Stores user claims from the token
   */
  private storeUserClaims(tokenClaims: any): void {
    if (!tokenClaims) return

    sessionStorage.setItem(
      'username',
      tokenClaims['cognito:username'] || tokenClaims.preferred_username || tokenClaims.email || '',
    )
    sessionStorage.setItem(
      'email',
      tokenClaims.email || tokenClaims.preferred_username || '',
    )
    sessionStorage.setItem('name', tokenClaims.name || '')
    sessionStorage.setItem('given_name', tokenClaims.given_name || '')
    sessionStorage.setItem('family_name', tokenClaims.family_name || '')
  }

  /**
   * Authenticates with the backend using the OpenID token
   */
  private async authenticateWithBackend(token: string): Promise<any> {
    return client.post(
      '/login/',
      {},
      {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    )
  }

  /**
   * Handles successful backend authentication
   */
  private handleSuccessfulAuth(
    backendResponse: any,
    token: string,
    tokenClaims: any,
    response: any,
  ): void {
    this.storeAuthSessionData(
      backendResponse.content.token,
      backendResponse.content.id,
      tokenClaims,
      token,
      response,
    )
    this.storeUserClaims(tokenClaims)
    client.initializeToken()
    // '/' so the router guard resolves the landing view for this user's role;
    // hard-pushing the creation wizard sent read-only roles straight to the
    // forbidden page right after logging in.
    getRouter().push('/')
  }

  private async handleAuthResponse(response: any) {
    if (!response) return

    try {
      const token = response.idToken || response.accessToken
      const tokenClaims = this.decodeToken(token)

      if (!tokenClaims) {
        this.loginAttempted = false
        await this.retryAuthentication()
        return
      }

      const backendResponse = await this.authenticateWithBackend(token)

      if (backendResponse.status === 200) {
        this.handleSuccessfulAuth(backendResponse, token, tokenClaims, response)
      } else {
        console.error('Backend Response:', backendResponse)
        await this.retryAuthentication()
      }
    } catch (error) {
      console.error('Authentication error:', error)
      const shouldRetry = !error.response || error.response?.status === 400
      if (shouldRetry) {
        await this.retryAuthentication()
      } else {
        throw error
      }
    }
  }



  private async retryAuthentication() {
    this.loginAttempted = false
    this.initialized = false
    
    // Clear session data including new token tracking keys
    sessionStorage.removeItem('token')
    sessionStorage.removeItem('tokenExpiration')
    sessionStorage.removeItem('originalToken')
    sessionStorage.removeItem('openIdToken')
    sessionStorage.setItem('isAuthenticated', 'false')
    
    // Clear local storage auth data
    this.clearLocalStorageAuthData()
    
    // For cognito, we need to handle this differently
    if (this.provider === 'cognito') {
      try {
        // Try to sign out first - this helps clear Cognito browser state
        await signOut({ global: true })
        
        // Reinitialize with skipSessionCheck to avoid loops
        await this.initializeCognito(true)
        
        // Redirect through router to ensure query params are set
        getRouter().push({ path: '/sign-in', query: { expired: 'true' } })
      } catch (error) {
        console.error('Failed to retry authentication with Cognito:', error)
        // If that fails, force hard redirect to sign-in page
        globalThis.location.href = globalThis.location.origin + '/sign-in?expired=true'
      }
    } else if (this.provider === 'azure' && this.msalInstance) {
      await this.msalInstance.loginRedirect({
        scopes: ['openid', 'profile', 'email', 'User.Read'],
        prompt: 'select_account'
      })
    }
  }

  logout(): void {
    this.loginAttempted = false;
    this.initialized = false;
    this.handlingRedirect = false;
    
    // Clear all session data
    sessionStorage.clear();
    
    // Clear specific Cognito/Azure entries from localStorage
    this.clearLocalStorageAuthData();
    
    // Clear specific session items including new token tracking keys
    sessionStorage.setItem('isAuthenticated', 'false');
    sessionStorage.removeItem('openIdToken');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('tokenExpiration');
    sessionStorage.removeItem('originalToken');
    sessionStorage.removeItem('userId');
    sessionStorage.removeItem('username');
    sessionStorage.removeItem('name');
    sessionStorage.removeItem('email');
    sessionStorage.removeItem('given_name');
    sessionStorage.removeItem('family_name');
    
    if (this.provider === 'azure' && this.msalInstance) {
      this.msalInstance.logoutRedirect({
        postLogoutRedirectUri: globalThis.location.origin + '/sign-in?from=logout'
      });
    } else if (this.provider === 'cognito') {
      // Sign out from Cognito with global option
      signOut({ global: true }).then(() => {
        // Reset all service state
        this.initialized = false;
        this.handlingRedirect = false;
        this.loginAttempted = false;
        this.initializationPromise = null;
        
        // Navigate after state reset
        getRouter().push({ path: '/sign-in', query: { from: 'logout' } });
      }).catch((error) => {
        console.error('Error during Cognito sign out:', error);
        // Even if there's an error, clear state and redirect
        this.initialized = false;
        this.handlingRedirect = false;
        this.loginAttempted = false;
        this.initializationPromise = null;
        getRouter().push({ path: '/sign-in', query: { from: 'logout' } });
      });
    }
  }

  /**
   * Clears authentication-related data from localStorage
   * This is important to handle expired tokens and avoid issues with Cognito/Azure auth
   */
  private clearLocalStorageAuthData(): void {
    // Get all localStorage keys
    const keys = Object.keys(localStorage);
    
    // Patterns to match auth-related items in localStorage
    const authPatterns = [
      'CognitoIdentityServiceProvider',
      'amplify-signin-with-hostedUI',
      'amplify', 
      'MSAL',
      'msal.',
      'microsoft.',
      'azure.',
      'auth.',
      'refresh_token',
      'id_token',
      'access_token'
    ];
    
    // Remove all matching items
    keys.forEach(key => {
      if (authPatterns.some(pattern => key.toLowerCase().includes(pattern.toLowerCase()))) {
        localStorage.removeItem(key);
      }
    });
  }

  getToken = () => sessionStorage.getItem('token')
  getUserId = () => sessionStorage.getItem('userId')
  isAuthenticated = () => sessionStorage.getItem('isAuthenticated') === 'true'
  getUsername = () => sessionStorage.getItem('username')
  getName = () => sessionStorage.getItem('name')
  getEmail = () => sessionStorage.getItem('email')
  getGivenName = () => sessionStorage.getItem('given_name')
  getFamilyName = () => sessionStorage.getItem('family_name')

  /**
   * Gets comprehensive token status information
   * Useful for debugging and monitoring token expiration
   */
  getTokenStatus(): {
    hasToken: boolean;
    tokenExpiration: Date | null;
    refreshTokenExpiration: Date | null;
    timeUntilExpiration: number | null;
    timeUntilRefreshExpiration: number | null;
    shouldRefreshSoon: boolean;
    refreshTokenExpiresSoon: boolean;
  } {
    const tokenExpiration = sessionStorage.getItem('tokenExpiration');
    const refreshTokenExpiration = sessionStorage.getItem('refreshTokenExpiration');
    const now = Date.now();
    
    const tokenExp = tokenExpiration ? new Date(Number.parseInt(tokenExpiration)) : null;
    const refreshExp = refreshTokenExpiration ? new Date(Number.parseInt(refreshTokenExpiration)) : null;
    
    const timeUntilExpiration = tokenExp ? tokenExp.getTime() - now : null;
    const timeUntilRefreshExpiration = refreshExp ? refreshExp.getTime() - now : null;
    
    return {
      hasToken: !!this.getToken(),
      tokenExpiration: tokenExp,
      refreshTokenExpiration: refreshExp,
      timeUntilExpiration,
      timeUntilRefreshExpiration,
      shouldRefreshSoon: timeUntilExpiration ? timeUntilExpiration < (15 * 60 * 1000) : false, // 15 min
      refreshTokenExpiresSoon: timeUntilRefreshExpiration ? timeUntilRefreshExpiration < (24 * 60 * 60 * 1000) : false // 24 hours
    };
  }

  /**
   * Checks if the refresh token itself is about to expire
   * This is important because if the refresh token expires, the user needs to re-authenticate
   */
  isRefreshTokenNearExpiration(): boolean {
    const refreshTokenExpiration = sessionStorage.getItem('refreshTokenExpiration');
    if (!refreshTokenExpiration) return false;
    
    const expTime = Number.parseInt(refreshTokenExpiration);
    const now = Date.now();
    const twentyFourHours = 24 * 60 * 60 * 1000;
    
    return (expTime - now) < twentyFourHours;
  }

  private async refreshAzureToken(): Promise<{ token: string; expiresAt: number } | null> {
    if (!this.msalInstance) return null;

    const accounts = this.msalInstance.getAllAccounts();
    if (accounts.length === 0) {
      console.warn('No MSAL accounts found for token refresh');
      return null;
    }

    const silentRequest = {
      scopes: ['openid', 'profile', 'email', 'User.Read'],
      account: accounts[0],
      forceRefresh: false
    };

    return this.acquireAzureToken(silentRequest);
  }

  private async acquireAzureToken(request: any): Promise<{ token: string; expiresAt: number } | null> {
    try {
      const response = await this.msalInstance.acquireTokenSilent(request);
      return this.processAzureTokenResponse(response);
    } catch (error) {
      console.warn('Silent token acquisition failed, trying force refresh:', error);
      const forceRefreshRequest = { ...request, forceRefresh: true };
      const response = await this.msalInstance.acquireTokenSilent(forceRefreshRequest);
      return this.processAzureTokenResponse(response);
    }
  }

  private processAzureTokenResponse(response: any): { token: string; expiresAt: number } | null {
    if (!response?.idToken) return null;

    const tokenClaims = this.decodeToken(response.idToken);
    if (!tokenClaims?.exp) return null;

    const newExpiration = tokenClaims.exp * 1000;
    sessionStorage.setItem('tokenExpiration', newExpiration.toString());
    
    if (response.expiresOn) {
      sessionStorage.setItem('azureTokenExpiration', response.expiresOn.getTime().toString());
    }

    return {
      token: response.idToken,
      expiresAt: newExpiration
    };
  }

  private async refreshCognitoToken(): Promise<{ token: string; expiresAt: number } | null> {
    const session = await fetchAuthSession();
    if (!session.tokens?.idToken) return null;

    const tokenString = session.tokens.idToken.toString();
    const tokenClaims = this.decodeToken(tokenString);
    if (!tokenClaims?.exp) return null;

    const newExpiration = tokenClaims.exp * 1000;
    sessionStorage.setItem('tokenExpiration', newExpiration.toString());

    return {
      token: tokenString,
      expiresAt: newExpiration
    };
  }

  async refreshToken(): Promise<{ token: string; expiresAt: number } | null> {
    try {
      if (this.provider === 'azure') {
        return await this.refreshAzureToken();
      } else if (this.provider === 'cognito') {
        return await this.refreshCognitoToken();
      }
    } catch (error) {
      console.error(`Token refresh failed for ${this.provider}:`, error);
      
      if (error.message?.includes('refresh_token') || error.message?.includes('expired')) {
        this.clearAuthState();
      }
    }
    
    return null;
  }



  /**
   * Clears authentication state when refresh tokens are no longer valid
   */
  private clearAuthState(): void {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('tokenExpiration');
    sessionStorage.removeItem('refreshTokenExpiration');
    sessionStorage.removeItem('azureTokenExpiration');
    sessionStorage.removeItem('originalToken');
    sessionStorage.setItem('isAuthenticated', 'false');
  }

  public async makeAuthenticatedRequest(url: string, options: RequestInit = {}): Promise<Response> {
    const token = this.getToken();
    
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
