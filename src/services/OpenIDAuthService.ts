import { AuthProvider } from '@/interfaces/AuthProvider'
import { PublicClientApplication, Configuration } from '@azure/msal-browser'
import { Amplify } from 'aws-amplify'
import { signIn, signOut, getCurrentUser, fetchAuthSession } from 'aws-amplify/auth'
import client from '@/api/Api'
import config from '@/config'

export class OpenIDAuthService implements AuthProvider {
  private msalInstance: PublicClientApplication | null = null
  private initialized: boolean = false

  constructor(private provider: 'azure' | 'cognito') {
    if (provider === 'azure') {
      this.initializeAzure()
    } else if (provider === 'cognito') {
      this.initializeCognito()
    }
  }

  private async initializeAzure() {
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
    } catch (error) {
      console.error('Failed to initialize MSAL:', error)
      throw error
    }
  }

  private async initializeCognito() {
    try {
      Amplify.configure({
        Auth: {
          Cognito: {
            region: config.auth.region,
            userPoolId: config.auth.userPoolId,
            userPoolClientId: config.auth.clientId,
            oauth: {
              redirectSignIn: config.auth.redirectUri,
              redirectSignOut: window.location.origin,
            }
          }
        }
      })
      this.initialized = true
    } catch (error) {
      console.error('Failed to initialize Cognito:', error)
      throw error
    }
  }

  private decodeToken(token: string): any {
    try {
      const base64Url = token.split('.')[1]
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
      if (this.provider === 'azure' && this.msalInstance) {
        if (!this.initialized) {
          await this.initializeAzure()
        }

        const loginRequest = {
          scopes: ['openid', 'profile', 'email']
        }

        const authResult = await this.msalInstance.loginPopup(loginRequest)
        
        if (authResult) {
          try {
            const tokenClaims = this.decodeToken(authResult.idToken)

            sessionStorage.setItem('openIdToken', authResult.idToken)
            const response = await client.post(
              '/login/',
              { 
                token: authResult.idToken,
              },
              { 'Content-Type': 'application/json' }
            )

            if (response.status === 200) {
              const backendToken = response.content.token
              
              sessionStorage.setItem('isAuthenticated', 'true')
              sessionStorage.setItem('token', backendToken)
              sessionStorage.setItem('userId', response.content.id)
              
              if (tokenClaims) {
                sessionStorage.setItem('username', tokenClaims.preferred_username || '')
                sessionStorage.setItem('name', tokenClaims.name || '')
                sessionStorage.setItem('email', tokenClaims.email || '')
                sessionStorage.setItem('given_name', tokenClaims.given_name || '')
                sessionStorage.setItem('family_name', tokenClaims.family_name || '')
              }
              
              client.getHeaders = () => ({
                Accept: 'application/json',
                Authorization: `access_token ${backendToken}`
              })

              return true
            }
          } catch (error) {
            console.error('Backend authentication failed:', error)
            throw error
          }
        }
      } else if (this.provider === 'cognito') {
        if (!this.initialized) {
          await this.initializeCognito()
        }

        try {
          const user = await signIn()
          const session = await fetchAuthSession()
          const idToken = session.tokens?.idToken?.toString()

          if (!idToken) {
            throw new Error('No ID token found in session')
          }

          try {
            const response = await client.post(
              '/login/',
              { 
                token: idToken,
              },
              { 'Content-Type': 'application/json' }
            )

            if (response.status === 200) {
              const backendToken = response.content.token
              const tokenClaims = this.decodeToken(idToken)
              
              sessionStorage.setItem('isAuthenticated', 'true')
              sessionStorage.setItem('token', backendToken)
              sessionStorage.setItem('userId', response.content.id)
              sessionStorage.setItem('openIdToken', idToken)
              
              if (tokenClaims) {
                sessionStorage.setItem('username', tokenClaims['cognito:username'] || '')
                sessionStorage.setItem('email', tokenClaims.email || '')
                sessionStorage.setItem('name', tokenClaims.name || '')
                sessionStorage.setItem('given_name', tokenClaims.given_name || '')
                sessionStorage.setItem('family_name', tokenClaims.family_name || '')
              }

              client.getHeaders = () => ({
                Accept: 'application/json',
                Authorization: `access_token ${backendToken}`
              })

              return true
            }
          } catch (error) {
            console.error('Backend authentication failed:', error)
            throw error
          }
        } catch (error) {
          console.error('Cognito authentication failed:', error)
          throw error
        }
      }
      return false
    } catch (error) {
      console.error('OpenIDAuthService: Login failed:', error)
      throw error
    }
  }

  logout(): void {
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
      this.msalInstance.logout({
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
