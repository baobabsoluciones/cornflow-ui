import session from '@/services/AuthService'
import { RequestOptions } from '@/interfaces/RequestOptions'
import config from '../config'

export const makeClient = ({ baseUrl = config.backend }) => {
  const getHeaders = () => ({
    Accept: 'application/json',
    Authorization: `access_token ${session.getToken()}`,
  })

  const request = (url = '', options: RequestOptions = {}) => {
    console.log('request', url, baseUrl)
    const completeUrl = new URL(baseUrl + url)
    if (options.params) {
      completeUrl.search = new URLSearchParams(options.params).toString()
    }

    return fetch(completeUrl.toString(), {
      ...options,
      headers: {
        ...getHeaders(),
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

  const get = (url: string, queryParams = {}, getHeaders = {}) =>
    request(url, { method: 'GET', params: queryParams, headers: getHeaders })

  const post = (url: string, data: object, postHeaders = {}) =>
    request(url, { method: 'POST', body: data, headers: postHeaders })

  const put = (url: string, data: object, putHeaders = {}) =>
    request(url, { method: 'PUT', body: data, headers: putHeaders })

  const patch = (url: string, data: object, patchHeaders = {}) =>
    request(url, { method: 'PATCH', body: data, headers: patchHeaders })

  const remove = (url: string, deleteHeaders = {}) =>
    request(url, { method: 'DELETE', headers: deleteHeaders })

  return {
    getHeaders,
    get,
    post,
    put,
    patch,
    remove,
  }
}

export default makeClient({ baseUrl: config.backend })
