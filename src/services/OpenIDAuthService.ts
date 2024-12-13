import { AuthProvider } from '@/interfaces/AuthProvider'
import { PublicClientApplication, Configuration } from '@azure/msal-browser'
import { Amplify } from 'aws-amplify'
import { signInWithRedirect, signOut, fetchAuthSession } from 'aws-amplify/auth'
import client from '@/api/Api'
import config from '@/config'

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
            signUpVerificationMethod: 'code',
            loginWith: {
              oauth: {
                domain: config.auth.domain,
                scopes: ['openid', 'email', 'profile'],
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

  async login(): Promise<boolean> {
    try {
      console.log('OpenIDAuthService login called for provider:', this.provider);
      
      if (this.initializationPromise) {
        console.log('Waiting for initialization...');
        await this.initializationPromise;
        console.log('Initialization complete');
      }

      if (this.provider === 'cognito') {
        console.log('Starting Cognito login flow');
        if (!this.initialized) {
          console.log('Initializing Cognito...');
          await this.initializeCognito();
        }

        try {
          console.log('Calling signInWithRedirect...');
          await signInWithRedirect();
          // Note: Code after this point won't execute due to redirect
          return true;
        } catch (error) {
          console.error('Cognito authentication failed:', error);
          throw error;
        }
      } else if (this.provider === 'azure' && this.msalInstance) {
        if (this.handlingRedirect) {
          return false
        }

        if (this.isAuthenticated()) {
          return true
        }

        if (this.loginAttempted) {
          return false
        }

        const loginRequest = {
          scopes: ['openid', 'profile', 'email', 'User.Read'],
          prompt: 'select_account'
        }

        this.loginAttempted = true
        await this.msalInstance.loginRedirect(loginRequest)
        return true
      }
      return false
    } catch (error) {
      this.loginAttempted = true
      console.error('OpenIDAuthService: Login failed:', error)
      throw error
    }
  }

  private async handleAuthResponse(response: any) {
    if (response) {
      try {
        console.log('Auth Response:', {
          hasIdToken: !!response.idToken,
          hasAccessToken: !!response.accessToken,
          account: response.account
        })

        const token = response.idToken || response.accessToken
        const tokenClaims = this.decodeToken(token)
        
        if (!tokenClaims) {
          this.loginAttempted = false
          await this.retryAuthentication()
          return
        }

        console.log('Token Claims:', tokenClaims)

        sessionStorage.setItem('openIdToken', token)
        
        try {
          const backendResponse = await client.post(
            '/login/',
            { 
              token: token,
              provider: 'azure',
              grant_type: 'authorization_code'
            },
            { 
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            }
          )

          if (backendResponse.status === 200) {
            const backendToken = backendResponse.content.token
            
            sessionStorage.setItem('isAuthenticated', 'true')
            sessionStorage.setItem('token', backendToken)
            sessionStorage.setItem('userId', backendResponse.content.id)
            
            if (tokenClaims) {
              sessionStorage.setItem('username', tokenClaims.preferred_username || tokenClaims.email || '')
              sessionStorage.setItem('name', tokenClaims.name || '')
              sessionStorage.setItem('email', tokenClaims.email || tokenClaims.preferred_username || '')
              sessionStorage.setItem('given_name', tokenClaims.given_name || '')
              sessionStorage.setItem('family_name', tokenClaims.family_name || '')
            }
            
            client.getHeaders = () => ({
              Accept: 'application/json',
              Authorization: `access_token ${backendToken}`
            })

            window.location.replace('/')
          } else {
            console.error('Backend Response:', backendResponse)
            await this.retryAuthentication()
          }
        } catch (error) {
          console.error('Backend authentication failed:', error)
          if (error.response?.status === 400) {
            await this.retryAuthentication()
          } else {
            throw error
          }
        }
      } catch (error) {
        console.error('Authentication error:', error)
        await this.retryAuthentication()
      }
    }
  }

  private async retryAuthentication() {
    this.loginAttempted = false
    
    sessionStorage.removeItem('openIdToken')
    sessionStorage.removeItem('token')
    sessionStorage.setItem('isAuthenticated', 'false')

    if (this.provider === 'azure' && this.msalInstance) {
      await this.msalInstance.loginRedirect({
        scopes: ['openid', 'profile', 'email', 'User.Read'],
        prompt: 'select_account'
      })
    } else if (this.provider === 'cognito') {
      await signInWithRedirect()
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
}
