import config from '@/config'
import { fetchAuthSession } from 'aws-amplify/auth'
import session from '@/services/AuthService'
import { RequestOptions } from '@/interfaces/RequestOptions'

class ApiClient {
  private baseUrl: string
  private refreshingToken: boolean = false
  private refreshTokenPromise: Promise<void> | null = null
  private tokenExpiration: number | null = null
  private authToken: string | null = null

  constructor() {
    this.baseUrl = config.backend || ''
    this.initializeToken()
  }

  public initializeToken() {
    // Load token from sessionStorage during initialization
    this.authToken = sessionStorage.getItem('token')
  }

  updateBaseUrl(newUrl: string) {
    this.baseUrl = newUrl
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    // Load token from sessionStorage if not already set
    if (!this.authToken) {
      this.authToken = sessionStorage.getItem('token');
    }

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    } else {
      console.warn('No Authorization header added - no token available');
    }

    return headers;
  }

  private isTokenExpired(): boolean {
    if (!this.tokenExpiration) return true
    // Add a 5-minute margin to avoid issues with tokens about to expire
    return Date.now() >= (this.tokenExpiration - 5 * 60 * 1000)
  }

  private async refreshToken(): Promise<void> {
    // If a refresh is already in progress, wait for it to complete
    if (this.refreshingToken) {
      return this.refreshTokenPromise
    }

    this.refreshingToken = true
    this.refreshTokenPromise = (async () => {
      try {
        // Only refresh Cognito token if using external authentication
        if (config.auth.type === 'cognito' || config.auth.type === 'azure') {
          const session = await fetchAuthSession()
          if (!session.tokens?.idToken) {
            throw new Error('No ID token available')
          }
          // Save token expiration
          this.tokenExpiration = session.tokens.idToken.payload.exp * 1000 // Convert to milliseconds
        } else {
          throw new Error('Token refresh not supported for this auth type')
        }
      } finally {
        this.refreshingToken = false
        this.refreshTokenPromise = null
      }
    })()

    return this.refreshTokenPromise
  }

  private async request(url = '', options: RequestOptions = {}) {
    const completeUrl = new URL(this.baseUrl + url)
    if (options.params) {
      completeUrl.search = new URLSearchParams(options.params).toString()
    }

    // If token is expired and it's not a login request, refresh it
    if ((config.auth.type === 'cognito' || config.auth.type === 'azure') && 
        !url.includes('/login/') && 
        this.isTokenExpired()) {
      try {
        await this.refreshToken()
      } catch (error) {
        console.error('Token refresh failed:', error)
        // If refresh token fails, redirect to login
        this.handleAuthFailure()
        throw error
      }
    }

    try {
      const response = await fetch(completeUrl.toString(), {
        ...options,
        headers: {
          ...this.getHeaders(),
          ...options.headers,
        },
        body:
          options.body instanceof FormData
            ? options.body
            : JSON.stringify(options.body),
        mode: 'cors',
      })

      // Check for 401 Unauthorized response, which indicates expired or invalid token
      if (response.status === 401 && !url.includes('/login/')) {
        console.warn('Received 401 Unauthorized response, session may have expired')
        this.handleAuthFailure()
        throw new Error('Unauthorized: Session expired')
      }
      
      // Try to parse response content
      let content;
      try {
        content = await response.json()
      } catch (e) {
        content = { message: 'Could not parse response' }
      }
      
      return { status: response.status, content }
    } catch (error) {
      console.error('Request failed:', error)
      // Only handle auth failures if not already handling a login request
      if (!url.includes('/login/') && error.message?.includes('Unauthorized')) {
        this.handleAuthFailure()
      }
      throw error
    }
  }

  /**
   * Handles authentication failure by clearing session and redirecting to login
   */
  private handleAuthFailure() {
    // Clear session storage
    sessionStorage.removeItem('token')
    sessionStorage.setItem('isAuthenticated', 'false')
    this.authToken = null

    // Clear auth-related data from localStorage
    this.clearLocalStorageAuthData()

    // Use setTimeout to ensure this runs after the current execution context
    setTimeout(() => {
      // Import dynamically to avoid circular dependency
      import('@/router').then(({ default: router }) => {
        // Redirect to sign-in page with expired flag
        router.push({ path: '/sign-in', query: { expired: 'true' } })
      })
    }, 0)
  }

  /**
   * Clears authentication-related data from localStorage
   * This helps prevent authentication issues with external providers
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

  get(url: string, queryParams = {}, getHeaders = {}) {
    return this.request(url, { method: 'GET', params: queryParams, headers: getHeaders })
  }

  post(url: string, data: object, postHeaders = {}) {
    return this.request(url, { method: 'POST', body: data, headers: postHeaders })
  }

  put(url: string, data: object, putHeaders = {}) {
    return this.request(url, { method: 'PUT', body: data, headers: putHeaders })
  }

  remove(url: string, deleteHeaders = {}) {
    return this.request(url, { method: 'DELETE', headers: deleteHeaders })
  }
}

const apiClient = new ApiClient()

// Update the baseUrl when config is initialized
config.initConfig().then(() => {
  console.log('Updating API baseUrl with:', config.backend)
  apiClient.updateBaseUrl(config.backend)
})

export default apiClient
