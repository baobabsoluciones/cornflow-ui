import config from '@/config'
import { RequestOptions } from '@/interfaces/RequestOptions'

class ApiClient {
  private baseUrl: string
  private refreshingToken: boolean = false
  private refreshTokenPromise: Promise<void> | null = null
  private tokenExpiration: number | null = null
  private authToken: string | null = null
  private refreshTimer: NodeJS.Timeout | null = null

  constructor() {
    this.baseUrl = config.backend || ''
    this.initializeToken()
  }

  public initializeToken() {
    // Load token from sessionStorage during initialization
    this.authToken = sessionStorage.getItem('token')
    
    // Load token expiration if available
    const tokenExpiration = sessionStorage.getItem('tokenExpiration')
    if (tokenExpiration) {
      this.tokenExpiration = parseInt(tokenExpiration, 10)
      // Start proactive refresh timer if we have expiration info
      this.scheduleTokenRefresh()
    }
  }

  /**
   * Schedules automatic token refresh before expiration
   * This makes token renewal completely transparent to the user
   */
  private scheduleTokenRefresh() {
    // Clear any existing timer
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer)
      this.refreshTimer = null
    }

    if (!this.tokenExpiration || (config.auth.type !== 'cognito' && config.auth.type !== 'azure')) {
      return // Don't schedule if no expiration or not external auth
    }

    const now = Date.now()
    const timeUntilRefresh = this.tokenExpiration - now - (15 * 60 * 1000) // Refresh 15 minutes before expiry

    if (timeUntilRefresh > 0) {
      this.refreshTimer = setTimeout(async () => {
        try {
          await this.refreshToken()
        } catch (error) {
          console.error('Scheduled token refresh failed:', error)
          // Don't handle as auth failure here since user might not even be using the app
        }
      }, timeUntilRefresh)
    }
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
    if (!this.tokenExpiration) {
      // If no expiration info, check if we have it in sessionStorage
      const tokenExpiration = sessionStorage.getItem('tokenExpiration')
      if (tokenExpiration) {
        this.tokenExpiration = parseInt(tokenExpiration, 10)
      } else {
        return false // Don't assume expiration if we don't have the info
      }
    }
    
    // Add a 10-minute margin to refresh proactively before expiration
    return Date.now() >= (this.tokenExpiration - 10 * 60 * 1000)
  }

  private async refreshToken(): Promise<void> {
    // If a refresh is already in progress, wait for it to complete
    if (this.refreshingToken) {
      return this.refreshTokenPromise
    }

    this.refreshingToken = true
    this.refreshTokenPromise = (async () => {
      try {
        // Only refresh external auth tokens (Azure/Cognito), not Cornflow tokens
        if (config.auth.type === 'cognito' || config.auth.type === 'azure') {
          // Dynamically import to avoid circular dependency
          const getAuthService = await import('@/services/AuthServiceFactory')
          const authService = await getAuthService.default()
          
          if (authService.refreshToken) {
            const refreshResult = await authService.refreshToken()
            if (refreshResult) {
              // Update the stored token expiration in both memory and sessionStorage
              this.tokenExpiration = refreshResult.expiresAt
              sessionStorage.setItem('tokenExpiration', refreshResult.expiresAt.toString())
              
              // For external auth, we need to exchange the refreshed token with backend
              try {
                const backendResponse = await fetch(this.baseUrl + (config.hasExternalApp ? '/cornflow' : '') + '/login/', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${refreshResult.token}`
                  },
                  body: JSON.stringify({}),
                  mode: 'cors'
                })
                
                if (backendResponse.ok) {
                  const backendData = await backendResponse.json()
                  if (backendData.token) {
                    // Update the backend token in sessionStorage and memory
                    sessionStorage.setItem('token', backendData.token)
                    this.authToken = backendData.token
                    sessionStorage.setItem('originalToken', refreshResult.token)
                    
                    // Schedule the next automatic refresh
                    this.scheduleTokenRefresh()
                  }
                } else {
                  throw new Error('Backend token exchange failed')
                }
              } catch (error) {
                console.error('Failed to exchange refreshed token with backend:', error)
                throw error
              }
            } else {
              throw new Error('Token refresh returned null')
            }
          } else {
            throw new Error('Auth service does not support token refresh')
          }
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
    const isExternal = options.isExternal || false
    const basePath = isExternal ? '/external' : config.hasExternalApp ? '/cornflow' : ''
    const completeUrl = new URL(this.baseUrl + basePath + url)
    
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

      if (response.status === 401 && !url.includes('/login/')) {
        console.warn('Received 401 Unauthorized response, session may have expired')
        this.handleAuthFailure()
        throw new Error('Unauthorized: Session expired')
      }
      
      let content;
      const contentType = response.headers.get('Content-Type');
      if (contentType && contentType.includes('application/json')) {
        try {
          content = await response.json();
        } catch (e) {
          content = { message: 'Could not parse response' };
        }
      } else {
        content = await response.blob();
      }
      
      return { status: response.status, content }
    } catch (error) {
      console.error('Request failed:', error)
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
    // Clear any active refresh timer
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer)
      this.refreshTimer = null
    }

    // Clear session storage
    sessionStorage.removeItem('token')
    sessionStorage.removeItem('tokenExpiration')
    sessionStorage.removeItem('originalToken')
    sessionStorage.setItem('isAuthenticated', 'false')
    this.authToken = null
    this.tokenExpiration = null

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

  get(url: string, queryParams = {}, getHeaders = {}, isExternal: boolean = false) {
    return this.request(url, { method: 'GET', params: queryParams, headers: getHeaders, isExternal })
  }

  post(url: string, data: object, postHeaders = {}, isExternal: boolean = false) {
    return this.request(url, { method: 'POST', body: data, headers: postHeaders, isExternal })
  }

  put(url: string, data: object, putHeaders = {}, isExternal: boolean = false) {
    return this.request(url, { method: 'PUT', body: data, headers: putHeaders, isExternal })
  }

  remove(url: string, deleteHeaders = {}, isExternal: boolean = false) {
    return this.request(url, { method: 'DELETE', headers: deleteHeaders, isExternal })
  }
}

const apiClient = new ApiClient()

// Update the baseUrl when config is initialized
config.initConfig().then(() => {
  apiClient.updateBaseUrl(config.backend)
})

export default apiClient
