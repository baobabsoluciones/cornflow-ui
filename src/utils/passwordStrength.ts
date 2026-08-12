import { zxcvbn, zxcvbnOptions } from '@zxcvbn-ts/core'
import * as zxcvbnCommonPackage from '@zxcvbn-ts/language-common'

// Mirrors the backend CCN-STIC-807 password policy
export const PASSWORD_MIN_LENGTH = 12
export const PASSWORD_MIN_STRENGTH_SCORE = 3

zxcvbnOptions.setOptions({
  dictionary: zxcvbnCommonPackage.dictionary,
  graphs: zxcvbnCommonPackage.adjacencyGraphs,
})

/**
 * Returns the zxcvbn strength score (0-4) of a password, using the common
 * dictionaries (leaked passwords, common words, keyboard patterns, dates).
 */
export function passwordStrengthScore(password: string): number {
  return zxcvbn(password).score
}

/**
 * True when the password reaches the minimum strength required by the
 * backend password policy.
 */
export function isPasswordStrongEnough(password: string): boolean {
  return passwordStrengthScore(password) >= PASSWORD_MIN_STRENGTH_SCORE
}

/** A Vuetify-style validation rule: `true` when valid, the error text otherwise. */
export type PasswordRule = (value: string) => boolean | string

/** Minimal shape of `t` / `$t`, so this file needs no i18n import. */
type Translate = (key: string, params?: Record<string, unknown>) => string

/**
 * The password policy as validation rules, in one place.
 *
 * Every screen that sets a password (sign-up, user settings, password reset)
 * must use these: with the rules copied per screen, a policy change on the
 * backend leaves whichever copy was missed silently out of sync — and each
 * screen would then reject or accept a different set of passwords.
 *
 * Confirmation ("both fields match") is NOT here: it belongs to each screen,
 * which owns the field it compares against.
 */
export function buildPasswordRules(t: Translate): PasswordRule[] {
  return [
    (value) =>
      (value !== undefined && value.length >= PASSWORD_MIN_LENGTH) ||
      t('settings.passwordRuleLength', { length: `${PASSWORD_MIN_LENGTH}` }),
    (value) => /[A-Z]/.test(value) || t('settings.passwordRuleCharacters'),
    (value) => /[a-z]/.test(value) || t('settings.passwordRuleCharacters'),
    (value) => /\d/.test(value) || t('settings.passwordRuleCharacters'),
    (value) =>
      /[!?@#$%^&*)(+=.<>{}[\],/¿¡:;'"|~`_-]/.test(value) ||
      t('settings.passwordRuleCharacters'),
    (value) => !/\s/.test(value) || t('settings.passWordRuleNoSpace'),
    (value) =>
      !/\d{6,}/.test(value || '') || t('settings.passwordRuleDigitSequence'),
    (value) =>
      !value || isPasswordStrongEnough(value) || t('settings.passwordRuleStrength'),
  ]
}
