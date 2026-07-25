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
