import { describe, test, expect } from 'vitest'
import {
  buildPasswordRules,
  isPasswordStrongEnough,
  passwordStrengthScore,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MIN_STRENGTH_SCORE,
} from '@cornflow-ui/core/utils/passwordStrength'

// Echoes the key so each failing rule is identifiable by name
const t = (key: string) => key

/** Runs every rule and returns the keys of the ones that rejected the value. */
const failures = (value: string): string[] =>
  buildPasswordRules(t)
    .map((rule) => rule(value))
    .filter((result): result is string => result !== true)

describe('passwordStrength', () => {
  describe('scoring', () => {
    test('rates a weak password below the required score', () => {
      expect(passwordStrengthScore('password')).toBeLessThan(
        PASSWORD_MIN_STRENGTH_SCORE,
      )
      expect(isPasswordStrongEnough('password')).toBe(false)
    })

    test('accepts a strong passphrase', () => {
      expect(isPasswordStrongEnough('Tr4ktor-Wolke!Sunset')).toBe(true)
    })
  })

  describe('buildPasswordRules', () => {
    test('accepts a password meeting the whole policy', () => {
      expect(failures('Tr4ktor-Wolke!Sunset')).toEqual([])
    })

    test('rejects one shorter than the minimum length', () => {
      const short = 'Ab1!cdef'
      expect(short.length).toBeLessThan(PASSWORD_MIN_LENGTH)
      expect(failures(short)).toContain('settings.passwordRuleLength')
    })

    test('requires upper case, lower case, a digit and a symbol', () => {
      expect(failures('alllowercase!1x')).toContain(
        'settings.passwordRuleCharacters',
      )
      expect(failures('ALLUPPERCASE!1X')).toContain(
        'settings.passwordRuleCharacters',
      )
      expect(failures('NoDigitsHere!xyz')).toContain(
        'settings.passwordRuleCharacters',
      )
      expect(failures('NoSymbolsHere1xyz')).toContain(
        'settings.passwordRuleCharacters',
      )
    })

    test('rejects whitespace', () => {
      expect(failures('Tr4ktor Wolke!Sun')).toContain(
        'settings.passWordRuleNoSpace',
      )
    })

    test('rejects six or more consecutive digits', () => {
      expect(failures('Tr4ktor!123456xy')).toContain(
        'settings.passwordRuleDigitSequence',
      )
    })

    test('rejects a long but weak password', () => {
      // Long enough and formally correct, yet trivially guessable
      expect(failures('Password123456!')).toContain(
        'settings.passwordRuleStrength',
      )
    })

    test('produces the same rules on every call', () => {
      // The three screens that set a password build them separately; they must
      // not drift apart.
      const weak = 'abc'
      expect(
        buildPasswordRules(t)
          .map((rule) => rule(weak))
          .filter((r) => r !== true),
      ).toEqual(
        buildPasswordRules(t)
          .map((rule) => rule(weak))
          .filter((r) => r !== true),
      )
    })
  })
})
