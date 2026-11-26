/**
 * usePasswordPolicy — the checks of a new password and its confirmation, for a password form.
 *
 * `checks` lists cornflow's policy plus "the two passwords match", each with its label, ready to
 * tick as the user types; `ready` is true once all of them are met.
 *
 *   const { checks, ready, mismatch } = usePasswordPolicy(newPassword, confirmPassword)
 */
import { computed, shallowRef, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  PASSWORD_MIN_LENGTH,
  loadStrengthScorer,
  passwordChecks,
  type StrengthScorer,
} from '@cornflow-ui/core/utils/passwordPolicy'

export function usePasswordPolicy(password: Ref<string>, confirmation: Ref<string>) {
  const { t } = useI18n()
  const scorer = shallowRef<StrengthScorer>()

  loadStrengthScorer()
    .then((score) => {
      scorer.value = score
    })
    .catch((error) => console.error('Could not load the password strength check:', error))

  const checks = computed(() => [
    ...passwordChecks(password.value, scorer.value).map((check) => ({
      ...check,
      label: t(`settings.passwordRules.${check.key}`, { length: PASSWORD_MIN_LENGTH }),
    })),
    {
      key: 'match',
      met: password.value !== '' && password.value === confirmation.value,
      label: t('settings.passwordRules.match'),
    },
  ])

  const ready = computed(() => checks.value.every((check) => check.met))

  const mismatch = computed(
    () => confirmation.value !== '' && confirmation.value !== password.value,
  )

  return { checks, ready, mismatch }
}
