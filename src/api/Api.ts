import { RequestOptions } from '@/interfaces/RequestOptions'
import config from '../config'

class ApiClient {
  private baseUrl: string;
  private headers: Record<string, string> = {
    Accept: 'application/json'
  }

  constructor() {
    this.baseUrl = config.backend || '';
    
    // Defer header initialization
    this.initializeHeadersAsync();
  }

  private async initializeHeadersAsync() {
    try {
      // Dynamically import AuthService to avoid initialization issues
      const { default: AuthService } = await import('@/services/AuthService');
      
      // Update headers with token if available
      const token = AuthService.getToken();
      if (token) {
        this.headers['Authorization'] = `access_token ${token}` ;
      }
    } catch (error) {
      console.error('Failed to initialize AuthService headers:', error);
    }
  }

  private getHeaders() {
    return this.headers;
  }

  updateHeaders(newHeaders: Record<string, string>) {
    this.headers = { ...this.headers, ...newHeaders };
  }

  updateBaseUrl(newUrl: string) {
    this.baseUrl = newUrl;
  }

  private async request(url = '', options: RequestOptions = {}) {
    // Ensure headers are up-to-date before each request
    await this.updateAuthorizationHeaderAsync();

    const completeUrl = new URL(this.baseUrl + url)
    if (options.params) {
      completeUrl.search = new URLSearchParams(options.params).toString()
    }

    // Default options for all requests
    const defaultOptions: RequestInit = {
      method: options.method || 'GET',
      mode: 'cors',
      cache: 'no-cache',
      credentials: 'same-origin',
      headers: {
        ...this.getHeaders(),
        ...options.headers,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      }
    }

    // Prepare body for non-GET requests
    if (options.method !== 'GET' && options.body) {
      defaultOptions.body = 
        options.body instanceof FormData
          ? options.body
          : JSON.stringify(options.body)
    }

    console.log('Request Details:', {
      url: completeUrl.toString(),
      method: defaultOptions.method,
      headers: defaultOptions.headers
    });

    try {
      const response = await fetch(completeUrl.toString(), defaultOptions);

      // Log response details for debugging
      console.log('Response Details:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      });

      // Handle redirects explicitly
      if (response.status === 308) {
        console.error('Permanent Redirect encountered');
        throw new Error('Permanent Redirect');
      }

      return response.json().then((content) => ({ 
        status: response.status, 
        content 
      }));
    } catch (error) {
      console.error('Request Error:', error);
      throw error;
    }
  }

  private async updateAuthorizationHeaderAsync() {
    try {
      // Dynamically import AuthService for each request
      const { default: AuthService } = await import('@/services/AuthService');
      
      // Use standard getToken method
      const token = AuthService.getToken();
      
      if (token) {
        this.headers['Authorization'] = `access_token ${token}`;
      } else {
        delete this.headers['Authorization'];
      }
    } catch (error) {
      console.error('Failed to update authorization header:', error);
      delete this.headers['Authorization'];
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

  patch(url: string, data: object, patchHeaders = {}) {
    return this.request(url, { method: 'PATCH', body: data, headers: patchHeaders })
  }

  remove(url: string, deleteHeaders = {}) {
    return this.request(url, { method: 'DELETE', headers: deleteHeaders })
  }
}

const apiClient = new ApiClient();

// Update the baseUrl when config is initialized
config.initConfig().then(() => {
  console.log('Updating API baseUrl with:', config.backend);
  apiClient.updateBaseUrl(config.backend);
});

export default apiClient;
