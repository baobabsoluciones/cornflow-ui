import { describe, test, expect } from 'vitest'
import es from '@cornflow-ui/core/plugins/locales/es'
import en from '@cornflow-ui/core/plugins/locales/en'
import fr from '@cornflow-ui/core/plugins/locales/fr'

const locales = { es, en, fr } as const

describe('rolesManagement locales - platform role TOTP keys', () => {
  const requiredKeys = [
    'platformRoleTotpLabel',
    'platformRoleTotpHint',
    'errorPlatformRoleTotp',
  ] as const

  for (const [name, messages] of Object.entries(locales)) {
    test(`${name} defines every platform role TOTP key with a non-empty string`, () => {
      const section = (messages as any).rolesManagement
      expect(section).toBeDefined()
      for (const key of requiredKeys) {
        expect(section[key]).toBeDefined()
        expect(typeof section[key]).toBe('string')
        expect(section[key].length).toBeGreaterThan(0)
      }
    })
  }
})
