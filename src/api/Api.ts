import session from '@/services/AuthService'
import { RequestOptions } from '@/interfaces/RequestOptions'
import config from '../config'

class ApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = config.backend || '';
  }

  private getHeaders() {
    return {
      Accept: 'application/json',
      Authorization: `access_token ${session.getToken()}`,
    }
  }

  updateBaseUrl(newUrl: string) {
    this.baseUrl = newUrl;
  }

  private async request(url = '', options: RequestOptions = {}) {
    const completeUrl = new URL(this.baseUrl + url)
    if (options.params) {
      completeUrl.search = new URLSearchParams(options.params).toString()
    }

    return fetch(completeUrl.toString(), {
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
    }).then((response) =>
      response.json().then((content) => ({ status: response.status, content })),
    )
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
