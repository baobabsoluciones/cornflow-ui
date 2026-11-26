/**
 * Cornflow's password policy, as the checks a password form ticks while the user types.
 *
 * Every screen that sets a password (user settings, the reset page) uses these, so they all
 * accept the same passwords cornflow does. Cornflow has the last word: it also rejects the user's
 * personal data and the last passwords, which only it knows.
 */

export const PASSWORD_MIN_LENGTH = 12

/** The lowest zxcvbn score (0-4) cornflow accepts. */
export const PASSWORD_MIN_STRENGTH_SCORE = 3

const SPECIAL = /[!?@#$%^&*)(+=.<>{}[\],/¿¡:;'"|~`_-]/

export type PasswordCheckKey = 'length' | 'characters' | 'spaces' | 'digits' | 'strength'

export interface PasswordCheck {
  key: PasswordCheckKey
  met: boolean
}

/** Scores a password from 0 (guessable) to 4 (very unguessable). */
export type StrengthScorer = (password: string) => number

let scorer: Promise<StrengthScorer> | null = null

/**
 * The zxcvbn scorer, with the common-password and keyboard-pattern dictionaries. They weigh a
 * couple of megabytes, so they load the first time a password form asks for them.
 */
export function loadStrengthScorer(): Promise<StrengthScorer> {
  scorer ??= Promise.all([import('@zxcvbn-ts/core'), import('@zxcvbn-ts/language-common')]).then(
    ([{ zxcvbn, zxcvbnOptions }, common]) => {
      zxcvbnOptions.setOptions({ dictionary: common.dictionary, graphs: common.adjacencyGraphs })
      return (password: string) => zxcvbn(password).score
    },
  )
  return scorer
}

/**
 * The policy checks of a password. Until the scorer has loaded, the strength check is not met.
 */
export function passwordChecks(password: string, score?: StrengthScorer): PasswordCheck[] {
  return [
    { key: 'length', met: password.length >= PASSWORD_MIN_LENGTH },
    {
      key: 'characters',
      met:
        /[A-Z]/.test(password) &&
        /[a-z]/.test(password) &&
        /\d/.test(password) &&
        SPECIAL.test(password),
    },
    { key: 'spaces', met: password !== '' && !/\s/.test(password) },
    { key: 'digits', met: password !== '' && !/\d{6,}/.test(password) },
    {
      key: 'strength',
      met: password !== '' && !!score && score(password) >= PASSWORD_MIN_STRENGTH_SCORE,
    },
  ]
}
