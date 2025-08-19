import { describe, test, expect } from 'vitest'
import type { RequestOptions } from '@/interfaces/RequestOptions'

describe('RequestOptions Interface', () => {
  test('should allow all properties to be optional', () => {
    const minimalOptions: RequestOptions = {}
    
    expect(minimalOptions.method).toBeUndefined()
    expect(minimalOptions.mode).toBeUndefined()
    expect(minimalOptions.body).toBeUndefined()
    expect(minimalOptions.params).toBeUndefined()
    expect(minimalOptions.headers).toBeUndefined()
    expect(minimalOptions._retried).toBeUndefined()
    expect(minimalOptions.isExternal).toBeUndefined()
  })

  test('should accept all HTTP methods', () => {
    const getOptions: RequestOptions = { method: 'GET' }
    const postOptions: RequestOptions = { method: 'POST' }
    const putOptions: RequestOptions = { method: 'PUT' }
    const deleteOptions: RequestOptions = { method: 'DELETE' }
    const patchOptions: RequestOptions = { method: 'PATCH' }

    expect(getOptions.method).toBe('GET')
    expect(postOptions.method).toBe('POST')
    expect(putOptions.method).toBe('PUT')
    expect(deleteOptions.method).toBe('DELETE')
    expect(patchOptions.method).toBe('PATCH')
  })

  test('should accept valid RequestMode values', () => {
    const corsOptions: RequestOptions = { mode: 'cors' }
    const noCorsOptions: RequestOptions = { mode: 'no-cors' }
    const sameOriginOptions: RequestOptions = { mode: 'same-origin' }

    expect(corsOptions.mode).toBe('cors')
    expect(noCorsOptions.mode).toBe('no-cors')
    expect(sameOriginOptions.mode).toBe('same-origin')
  })

  test('should accept any body type', () => {
    const stringBodyOptions: RequestOptions = { body: 'string data' }
    const objectBodyOptions: RequestOptions = { body: { key: 'value' } }
    const formDataBodyOptions: RequestOptions = { body: new FormData() }
    const arrayBodyOptions: RequestOptions = { body: [1, 2, 3] }
    const nullBodyOptions: RequestOptions = { body: null }

    expect(stringBodyOptions.body).toBe('string data')
    expect(objectBodyOptions.body).toEqual({ key: 'value' })
    expect(formDataBodyOptions.body).toBeInstanceOf(FormData)
    expect(arrayBodyOptions.body).toEqual([1, 2, 3])
    expect(nullBodyOptions.body).toBeNull()
  })

  test('should accept params as string record', () => {
    const options: RequestOptions = {
      params: {
        page: '1',
        limit: '10',
        search: 'test query',
        filter: 'active'
      }
    }

    expect(options.params).toEqual({
      page: '1',
      limit: '10',
      search: 'test query',
      filter: 'active'
    })
    expect(typeof options.params!.page).toBe('string')
    expect(typeof options.params!.limit).toBe('string')
  })

  test('should accept headers as string record', () => {
    const options: RequestOptions = {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer token123',
        'X-Custom-Header': 'custom-value'
      }
    }

    expect(options.headers).toEqual({
      'Content-Type': 'application/json',
      'Authorization': 'Bearer token123',
      'X-Custom-Header': 'custom-value'
    })
    expect(typeof options.headers!['Content-Type']).toBe('string')
  })

  test('should accept _retried boolean flag', () => {
    const retriedOptions: RequestOptions = { _retried: true }
    const notRetriedOptions: RequestOptions = { _retried: false }

    expect(retriedOptions._retried).toBe(true)
    expect(notRetriedOptions._retried).toBe(false)
    expect(typeof retriedOptions._retried).toBe('boolean')
  })

  test('should accept isExternal boolean flag', () => {
    const externalOptions: RequestOptions = { isExternal: true }
    const internalOptions: RequestOptions = { isExternal: false }

    expect(externalOptions.isExternal).toBe(true)
    expect(internalOptions.isExternal).toBe(false)
    expect(typeof externalOptions.isExternal).toBe('boolean')
  })

  test('should accept complete options configuration', () => {
    const completeOptions: RequestOptions = {
      method: 'POST',
      mode: 'cors',
      body: { data: 'test' },
      params: { id: '123', type: 'user' },
      headers: { 'Content-Type': 'application/json' },
      _retried: false,
      isExternal: true
    }

    expect(completeOptions.method).toBe('POST')
    expect(completeOptions.mode).toBe('cors')
    expect(completeOptions.body).toEqual({ data: 'test' })
    expect(completeOptions.params).toEqual({ id: '123', type: 'user' })
    expect(completeOptions.headers).toEqual({ 'Content-Type': 'application/json' })
    expect(completeOptions._retried).toBe(false)
    expect(completeOptions.isExternal).toBe(true)
  })

  test('should work with empty objects for params and headers', () => {
    const options: RequestOptions = {
      params: {},
      headers: {}
    }

    expect(options.params).toEqual({})
    expect(options.headers).toEqual({})
    expect(Object.keys(options.params!)).toHaveLength(0)
    expect(Object.keys(options.headers!)).toHaveLength(0)
  })

  test('should handle JSON-like body structure', () => {
    const options: RequestOptions = {
      body: {
        user: {
          name: 'John Doe',
          email: 'john@example.com',
          preferences: {
            theme: 'dark',
            notifications: true
          }
        },
        metadata: {
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      }
    }

    expect(options.body).toBeDefined()
    expect(options.body.user.name).toBe('John Doe')
    expect(options.body.user.preferences.theme).toBe('dark')
    expect(options.body.metadata.version).toBe('1.0.0')
  })

  test('should handle array body types', () => {
    const arrayOptions: RequestOptions = {
      body: [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' }
      ]
    }

    expect(Array.isArray(arrayOptions.body)).toBe(true)
    expect(arrayOptions.body).toHaveLength(2)
    expect(arrayOptions.body[0].id).toBe(1)
  })

  test('should handle FormData body', () => {
    const formData = new FormData()
    formData.append('file', new Blob(['test content']))
    formData.append('name', 'test-file')

    const formOptions: RequestOptions = {
      body: formData
    }

    expect(formOptions.body).toBeInstanceOf(FormData)
  })

  test('should handle common REST API patterns', () => {
    // GET request
    const getOptions: RequestOptions = {
      method: 'GET',
      params: { page: '1', limit: '20' },
      headers: { 'Accept': 'application/json' }
    }

    // POST request
    const postOptions: RequestOptions = {
      method: 'POST',
      body: { name: 'New Resource' },
      headers: { 'Content-Type': 'application/json' }
    }

    // PUT request with authentication
    const putOptions: RequestOptions = {
      method: 'PUT',
      body: { name: 'Updated Resource' },
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': 'Bearer token123'
      }
    }

    expect(getOptions.method).toBe('GET')
    expect(postOptions.method).toBe('POST')
    expect(putOptions.method).toBe('PUT')
    expect(getOptions.params).toBeDefined()
    expect(postOptions.body).toBeDefined()
    expect(putOptions.headers!['Authorization']).toBe('Bearer token123')
  })
})
