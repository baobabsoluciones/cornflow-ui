/**
 * useSignIn — the sign-in page: the username and password form, and single sign-on with Microsoft
 * and Google.
 *
 * The form always signs in against Cornflow. Microsoft and Google are always offered and go
 * through the deployment's external auth (Azure or Cognito); on a deployment without them
 * configured, picking one says so.
 */
import { computed, inject, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import config from '@cornflow-ui/core/config'
import { getSpecificAuthService } from '@cornflow-ui/core/services/AuthServiceFactory'
import { googleLogo, microsoftLogo } from '@cornflow-ui/core/utils/assets'

export type SsoProviderKey = 'microsoft' | 'google'

export interface SsoProvider {
  key: SsoProviderKey
  name: string
  logo: string
}

const PROVIDERS: SsoProvider[] = [
  { key: 'microsoft', name: 'Microsoft', logo: microsoftLogo },
  { key: 'google', name: 'Google', logo: googleLogo },
]

export function useSignIn() {
  const { t } = useI18n()
  const router = useRouter()
  const showSnackbar = inject<(message: string, type: string) => void>('showSnackbar')

  const username = ref('')
  const password = ref('')
  /** Set once the user tries to sign in, so empty fields say so only from then on. */
  const attempted = ref(false)
  const submitting = ref(false)

  const missingUsername = computed(() => attempted.value && !username.value)
  const missingPassword = computed(() => attempted.value && !password.value)

  const providers = PROVIDERS

  const isConfigured = (provider: SsoProviderKey) =>
    provider === 'microsoft' ? config.isMicrosoftConfigured() : config.isGoogleConfigured()

  async function submit() {
    attempted.value = true
    if (!username.value || !password.value || submitting.value) return
    submitting.value = true
    try {
      const cornflowAuth = await getSpecificAuthService('cornflow')
      if (!cornflowAuth) {
        showSnackbar?.(t('logIn.snackbar_message_error_server'), 'error')
        return
      }
      if (await cornflowAuth.login(username.value, password.value)) {
        void router.push('/')
        showSnackbar?.(t('logIn.snackbar_message_success'), 'success')
      } else {
        showSnackbar?.(t('logIn.snackbar_message_error_auth'), 'error')
      }
    } catch (error) {
      console.error('Login error:', error)
      showSnackbar?.(t('logIn.snackbar_message_error_server'), 'error')
    } finally {
      submitting.value = false
    }
  }

  async function signInWith(provider: SsoProviderKey) {
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
      await authService.login()
    } catch (error) {
      console.error(`${provider} login failed:`, error)
      showSnackbar?.(t('logIn.snackbar_message_error_server'), 'error')
    }
  }

  return {
    username,
    password,
    submitting,
    missingUsername,
    missingPassword,
    providers,
    submit,
    signInWith,
  }
}
