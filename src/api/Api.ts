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
  }

  updateBaseUrl(newUrl: string) {
    this.baseUrl = newUrl
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    return headers;
  }

  private isTokenExpired(): boolean {
    if (!this.tokenExpiration) return true
    // Añadimos un margen de 5 minutos para evitar problemas con tokens a punto de expirar
    return Date.now() >= (this.tokenExpiration - 5 * 60 * 1000)
  }

  private async refreshToken(): Promise<void> {
    // Si ya hay un refresco en curso, esperamos a que termine
    if (this.refreshingToken) {
      return this.refreshTokenPromise
    }

    this.refreshingToken = true
    this.refreshTokenPromise = (async () => {
      try {
        // Solo refrescamos el token de Cognito si estamos usando autenticación externa
        if (config.auth.type === 'cognito' || config.auth.type === 'azure') {
          const session = await fetchAuthSession()
          if (!session.tokens?.idToken) {
            throw new Error('No ID token available')
          }
          // Guardamos la expiración del token
          this.tokenExpiration = session.tokens.idToken.payload.exp * 1000 // Convertimos a milisegundos
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

    // Si el token está expirado y no es una petición de login, refrescamos
    if ((config.auth.type === 'cognito' || config.auth.type === 'azure') && 
        !url.includes('/login/') && 
        this.isTokenExpired()) {
      try {
        await this.refreshToken()
      } catch (error) {
        console.error('Token refresh failed:', error)
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

      const content = await response.json()
      return { status: response.status, content }
    } catch (error) {
      console.error('Request failed:', error)
      throw error
    }
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

  delete(url: string, deleteHeaders = {}) {
    return this.request(url, { method: 'DELETE', headers: deleteHeaders })
  }

  // Si existe un método específico para login
  public async login(credentials: LoginCredentials): Promise<LoginResponse> {
    // ... existing code ...
    
    // Asegurarse de que cuando se guarda el token, se use correctamente en las peticiones
    if (response.token) {
      this.authToken = response.token;
      // Si hay algún almacenamiento local del token, asegurarse de que se guarda correctamente
    }
    
    // ... existing code ...
  }
}

const apiClient = new ApiClient()

// Update the baseUrl when config is initialized
config.initConfig().then(() => {
  console.log('Updating API baseUrl with:', config.backend)
  apiClient.updateBaseUrl(config.backend)
})

export default apiClient
