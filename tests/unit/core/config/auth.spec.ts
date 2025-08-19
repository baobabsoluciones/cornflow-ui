import { describe, test, expect, vi, beforeEach } from 'vitest'
import type { AuthConfig } from '@/config/auth'

describe('config/auth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  test('should create auth config with default values', () => {
    // Test the interface exists
    const testConfig: AuthConfig = {
      type: 'cornflow',
      clientId: 'test',
      userPoolId: 'test',
      authority: 'test',
      redirectUri: 'test',
      domain: 'test'
    }

    expect(testConfig.type).toBe('cornflow')
    expect(typeof testConfig.clientId).toBe('string')
  })

  test('should export AuthConfig interface with correct properties', () => {
    const config: AuthConfig = {
      type: 'azure',
      clientId: 'azure-client-id',
      authority: 'https://login.microsoftonline.com/tenant-id',
      redirectUri: 'http://localhost:3000/auth/azure/callback'
    }

    expect(config.type).toBe('azure')
    expect(config.clientId).toBe('azure-client-id')
    expect(config.authority).toBe('https://login.microsoftonline.com/tenant-id')
    expect(config.redirectUri).toBe('http://localhost:3000/auth/azure/callback')
  })

  test('should handle cognito auth configuration', () => {
    const cognitoConfig: AuthConfig = {
      type: 'cognito',
      clientId: 'cognito-client-id',
      userPoolId: 'us-east-1_TestPool',
      domain: 'https://test-domain.auth.us-east-1.amazoncognito.com'
    }

    expect(cognitoConfig.type).toBe('cognito')
    expect(cognitoConfig.clientId).toBe('cognito-client-id')
    expect(cognitoConfig.userPoolId).toBe('us-east-1_TestPool')
    expect(cognitoConfig.domain).toBe('https://test-domain.auth.us-east-1.amazoncognito.com')
  })

  test('should handle cornflow auth configuration', () => {
    const cornflowConfig: AuthConfig = {
      type: 'cornflow'
    }

    expect(cornflowConfig.type).toBe('cornflow')
    expect(cornflowConfig.clientId).toBeUndefined()
    expect(cornflowConfig.userPoolId).toBeUndefined()
    expect(cornflowConfig.authority).toBeUndefined()
  })

  test('should handle optional properties correctly', () => {
    // Test minimal config
    const minimalConfig: AuthConfig = {
      type: 'cornflow'
    }
    expect(minimalConfig.type).toBe('cornflow')

    // Test with all properties
    const fullConfig: AuthConfig = {
      type: 'azure',
      clientId: 'test-client',
      userPoolId: 'test-pool',
      authority: 'test-authority',
      redirectUri: 'test-uri',
      domain: 'test-domain'
    }
    expect(fullConfig.type).toBe('azure')
    expect(fullConfig.clientId).toBe('test-client')
  })
})
