/**
 * useSignIn — the sign-in page: the username and password form, the two-factor steps, the
 * password recovery request, and single sign-on with Microsoft and Google.
 *
 * The form always signs in against Cornflow, in steps (`step`):
 *
 * - `credentials`: username and password.
 * - `mfa-code`: the user has two-factor authentication; the code from their authenticator app, or
 *   one of their backup codes.
 * - `mfa-enroll`: the deployment requires two-factor authentication and the user has none yet; a
 *   QR code (and its secret, to type it in) to add the account to an authenticator app, and its
 *   first code to activate it.
 * - `mfa-backup`: the one-time backup codes of the enrollment just done, shown this once.
 * - `forgot`: an e-mail to send a password reset link to.
 *
 * Once signed in, a password that has expired or was reset takes the user to change it.
 *
 * Microsoft and Google are always offered and go through the deployment's external auth (Azure or
 * Cognito); on a deployment without them configured, picking one says so.
 */
import { computed, inject, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import config from '@cornflow-ui/core/config'
import { getSpecificAuthService } from '@cornflow-ui/core/services/AuthServiceFactory'
import {
  toLoginResult,
  type LoginResult,
  type SsoIdentityProvider,
} from '@cornflow-ui/core/interfaces/AuthProvider'
import { googleLogo, microsoftLogo } from '@cornflow-ui/core/utils/assets'
import { useMfaEnrollment } from '@cornflow-ui/core/composables/useMfaEnrollment'

export interface SsoProvider {
  key: SsoIdentityProvider
  name: string
  logo: string
}

export type SignInStep = 'credentials' | 'mfa-code' | 'mfa-enroll' | 'mfa-backup' | 'forgot'

const PROVIDERS: SsoProvider[] = [
  { key: 'microsoft', name: 'Microsoft', logo: microsoftLogo },
  { key: 'google', name: 'Google', logo: googleLogo },
]

export function useSignIn() {
  const { t } = useI18n()
  const router = useRouter()
  const showSnackbar = inject<(message: string, type: string) => void>('showSnackbar')

  const step = ref<SignInStep>('credentials')
  const username = ref('')
  const password = ref('')
  const totpCode = ref('')
  const forgotEmail = ref('')
  const enrollment = useMfaEnrollment()
  /** Set once the user sends the current step, so its empty field says so only from then on. */
  const attempted = ref(false)
  const submitting = ref(false)

  /** What the sign-in said, kept until the backup codes are saved. */
  let signedIn: LoginResult = { success: false }

  const missingUsername = computed(() => attempted.value && !username.value)
  const missingPassword = computed(() => attempted.value && !password.value)
  const missingCode = computed(() => attempted.value && !totpCode.value)
  const missingEmail = computed(() => attempted.value && !forgotEmail.value)

  const providers = PROVIDERS

  const isConfigured = (provider: SsoIdentityProvider) =>
    provider === 'microsoft' ? config.isMicrosoftConfigured() : config.isGoogleConfigured()

  const cornflowAuth = () => getSpecificAuthService('cornflow')

  function goTo(next: SignInStep) {
    step.value = next
    attempted.value = false
    totpCode.value = ''
  }

  /** While a request is out, the step's button waits; any error is reported as a server error. */
  async function run(action: () => Promise<void>) {
    if (submitting.value) return
    submitting.value = true
    try {
      await action()
    } catch (error) {
      console.error('Sign-in error:', error)
      showSnackbar?.(t('logIn.snackbar_message_error_server'), 'error')
    } finally {
      submitting.value = false
    }
  }

  function enterApp(result: LoginResult) {
    if (result.changePassword) {
      showSnackbar?.(t('logIn.password_change_required'), 'warning')
      void router.push({ path: '/user-settings', query: { changePassword: 'true' } })
      return
    }
    void router.push('/')
    if (result.lastLogin) {
      const date = new Date(result.lastLogin).toLocaleString()
      showSnackbar?.(t('logIn.last_login_info', { date }), 'info')
    } else {
      showSnackbar?.(t('logIn.snackbar_message_success'), 'success')
    }
  }

  async function startEnrollment() {
    if (await enrollment.start()) goTo('mfa-enroll')
    else showSnackbar?.(t('logIn.mfa_setup_error'), 'error')
  }

  function reportFailure(result: LoginResult) {
    if (result.serverError) {
      showSnackbar?.(t('logIn.snackbar_message_error_server'), 'error')
    } else if (result.rateLimited) {
      showSnackbar?.(t('logIn.snackbar_message_error_rate_limited'), 'error')
    } else if (result.accountLocked) {
      showSnackbar?.(t('logIn.account_locked'), 'error')
    } else if (step.value === 'mfa-code') {
      totpCode.value = ''
      showSnackbar?.(t('logIn.mfa_invalid_code'), 'error')
    } else {
      showSnackbar?.(t('logIn.snackbar_message_error_auth'), 'error')
    }
  }

  /** Sends the credentials, and the code on the `mfa-code` step. */
  async function submit() {
    attempted.value = true
    if (!username.value || !password.value) return
    if (step.value === 'mfa-code' && !totpCode.value) return
    await run(async () => {
      const auth = await cornflowAuth()
      if (!auth) {
        showSnackbar?.(t('logIn.snackbar_message_error_server'), 'error')
        return
      }
      const result = toLoginResult(
        await auth.login(username.value, password.value, totpCode.value || undefined),
      )
      if (result.success) enterApp(result)
      else if (result.mfaRequired) {
        if (step.value === 'mfa-code') showSnackbar?.(t('logIn.mfa_invalid_code'), 'error')
        goTo('mfa-code')
      } else if (result.mfaSetupRequired) await startEnrollment()
      else reportFailure(result)
    })
  }

  /** Activates two-factor authentication with the first code of the authenticator app. */
  async function verifyEnrollment() {
    attempted.value = true
    if (!totpCode.value) return
    await run(async () => {
      if (!(await enrollment.verify(totpCode.value))) {
        totpCode.value = ''
        showSnackbar?.(t('logIn.mfa_invalid_code'), 'error')
        return
      }
      // The enrollment signs the user in: what the next sign-in would say is not known here.
      signedIn = { success: true, lastLogin: null }
      goTo('mfa-backup')
    })
  }

  async function copyBackupCodes() {
    try {
      await navigator.clipboard.writeText(enrollment.backupCodes.value.join('\n'))
      showSnackbar?.(t('logIn.mfa_backup_copied'), 'success')
    } catch (error) {
      console.error('Could not copy the backup codes:', error)
    }
  }

  function finishEnrollment() {
    enrollment.clear()
    enterApp(signedIn)
  }

  /** Asks for a password reset link; the answer never says whether the e-mail has an account. */
  async function requestPasswordReset() {
    attempted.value = true
    if (!forgotEmail.value) return
    await run(async () => {
      const auth = await cornflowAuth()
      const result = await auth?.requestPasswordReset?.(forgotEmail.value)
      if (result?.rateLimited) {
        showSnackbar?.(t('logIn.snackbar_message_error_rate_limited'), 'error')
      } else if (result?.sent) {
        showSnackbar?.(t('logIn.forgot_sent'), 'success')
        await backToCredentials()
      } else {
        showSnackbar?.(t('logIn.forgot_error'), 'error')
      }
    })
  }

  function showForgot() {
    goTo('forgot')
  }

  /** Back to the username and password, leaving behind a half-way enrollment. */
  async function backToCredentials() {
    goTo('credentials')
    forgotEmail.value = ''
    enrollment.clear()
    const auth = await cornflowAuth()
    auth?.clearPendingEnrollment?.()
  }

  async function signInWith(provider: SsoIdentityProvider) {
    if (!isConfigured(provider)) {
      showSnackbar?.(t(`logIn.${provider}_not_configured`), 'error')
      return
    }
    try {
      const authService = await getSpecificAuthService(config.auth.type === 'cognito' ? 'cognito' : 'azure')
      if (!authService) {
        showSnackbar?.(t(`logIn.${provider}_not_available`), 'error')
        return
      }
      if (authService.loginWith) await authService.loginWith(provider)
      else await authService.login()
    } catch (error) {
      console.error(`${provider} login failed:`, error)
      showSnackbar?.(t('logIn.snackbar_message_error_server'), 'error')
    }
  }

  return {
    step,
    username,
    password,
    totpCode,
    forgotEmail,
    enrollSecret: enrollment.secret,
    enrollQr: enrollment.qr,
    backupCodes: enrollment.backupCodes,
    submitting,
    missingUsername,
    missingPassword,
    missingCode,
    missingEmail,
    providers,
    submit,
    verifyEnrollment,
    copyBackupCodes,
    finishEnrollment,
    requestPasswordReset,
    showForgot,
    backToCredentials,
    signInWith,
  }
}
