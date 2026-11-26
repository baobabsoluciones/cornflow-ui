<!--
  ResetPasswordView: the page the password reset e-mail links to (`/reset-password?token=…`). The
  new password twice, with what cornflow's password policy needs ticked as it is typed; once saved,
  the user goes to sign in with it.

  The link's token is read once and taken out of the address at once, so it stays neither in the
  browser history nor in the `Referer` of what the page loads. A `#token=…` fragment is read too.
-->
<template>
  <div class="reset-password">
    <main class="reset-password__card">
      <header class="reset-password__head">
        <h1 class="reset-password__title">{{ $t('resetPassword.title') }}</h1>
        <p class="reset-password__hint">{{ $t('resetPassword.hint') }}</p>
      </header>

      <CoreAlert
        v-if="!token"
        tone="warning"
        :message="$t('resetPassword.missingToken')"
        data-testid="reset-password-missing-token"
      />
      <CoreAlert
        v-else-if="linkExpired"
        tone="danger"
        :message="$t('resetPassword.linkExpired')"
        data-testid="reset-password-link-expired"
      />

      <form
        v-if="token && !linkExpired"
        class="reset-password__form"
        novalidate
        data-testid="reset-password-form"
        @submit.prevent="submit"
      >
        <label class="reset-password__label">
          {{ $t('settings.newPassword') }}
          <CoreTextField
            v-model="newPassword"
            size="large"
            :type="showPasswords ? 'text' : 'password'"
            autocomplete="new-password"
            data-testid="reset-password-new"
          >
            <template #append>
              <CoreButton
                variant="icon"
                size="small"
                :icon="showPasswords ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
                :aria-label="$t(showPasswords ? 'settings.hidePasswords' : 'settings.showPasswords')"
                :title="$t(showPasswords ? 'settings.hidePasswords' : 'settings.showPasswords')"
                :aria-pressed="showPasswords"
                @click="showPasswords = !showPasswords"
              />
            </template>
          </CoreTextField>
        </label>
        <label class="reset-password__label">
          {{ $t('settings.confirmPassword') }}
          <CoreTextField
            v-model="confirmPassword"
            size="large"
            :type="showPasswords ? 'text' : 'password'"
            :invalid="mismatch"
            autocomplete="new-password"
            data-testid="reset-password-confirm"
          />
        </label>
        <ul class="reset-password__rules" :aria-label="$t('settings.passwordNeeds')">
          <li
            v-for="rule in checks"
            :key="rule.key"
            class="reset-password__rule"
            :class="{ 'is-met': rule.met }"
            :data-testid="`reset-password-rule-${rule.key}`"
          >
            <CoreIcon :name="rule.met ? 'mdi-check-circle' : 'mdi-circle-outline'" :size="16" />
            {{ rule.label }}
          </li>
        </ul>
        <CoreButton
          type="submit"
          size="large"
          block
          :text="$t('resetPassword.submit')"
          :disabled="!ready"
          :loading="submitting"
          data-testid="reset-password-submit"
        />
      </form>

      <CoreButton
        variant="text"
        block
        :text="$t('resetPassword.backToLogin')"
        data-testid="reset-password-back"
        @click="router.push('/sign-in')"
      />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import CoreAlert from '@cornflow-ui/core/components/core/CoreAlert.vue'
import CoreButton from '@cornflow-ui/core/components/core/CoreButton.vue'
import CoreIcon from '@cornflow-ui/core/components/core/CoreIcon.vue'
import CoreTextField from '@cornflow-ui/core/components/core/CoreTextField.vue'
import { usePasswordPolicy } from '@cornflow-ui/core/composables/usePasswordPolicy'
import { getSpecificAuthService } from '@cornflow-ui/core/services/AuthServiceFactory'
import { showSnackbar } from '@cornflow-ui/core/services/SnackbarService'

defineOptions({ name: 'ResetPasswordView' })

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

/** The token of a `#token=…` fragment; with hash routing the fragment is the route itself. */
function tokenFromFragment(): string {
  const hash = window.location.hash
  if (!hash || hash.startsWith('#/')) return ''
  return new URLSearchParams(hash.slice(1)).get('token') ?? ''
}

const fragmentToken = tokenFromFragment()
const token = ref(fragmentToken || String(route.query.token ?? ''))
if (fragmentToken || route.query.token) {
  void router.replace({ path: route.path, query: {}, hash: '' })
}

const newPassword = ref('')
const confirmPassword = ref('')
const showPasswords = ref(false)
const submitting = ref(false)
const linkExpired = ref(false)

const { checks, ready, mismatch } = usePasswordPolicy(newPassword, confirmPassword)

async function submit() {
  if (!ready.value || submitting.value) return
  submitting.value = true
  try {
    const auth = await getSpecificAuthService('cornflow')
    const result = await auth?.resetPassword?.(token.value, newPassword.value)
    if (result?.success) {
      showSnackbar(t('resetPassword.success'), 'success')
      void router.push('/sign-in')
    } else if (result?.linkInvalid) {
      linkExpired.value = true
    } else {
      showSnackbar(result?.message || t('resetPassword.error'), 'error')
    }
  } catch (error) {
    console.error('Password reset error:', error)
    showSnackbar(t('resetPassword.error'), 'error')
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.reset-password {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: calc(var(--spacing) * 6) 16px;
  background: var(--color-background);
  font-family: var(--font-sans);
  color: var(--color-text);
}

.reset-password__card {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 6);
  width: 100%;
  max-width: 480px;
  padding: 40px 48px;
  border-radius: var(--radius-xl);
  background: var(--color-surface);
  box-shadow: var(--shadow-xl);
}

.reset-password__head {
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 2);
}

.reset-password__title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: var(--font-weight-medium);
}

.reset-password__hint {
  margin: 0;
  font-size: var(--text-base);
  line-height: 1.5;
  color: var(--color-text-muted);
}

.reset-password__form {
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 4);
}

.reset-password__label {
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 1.5);
  font-size: var(--text-md);
  font-weight: var(--font-weight-medium);
}

.reset-password__rules {
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 1.5);
  margin: 0;
  padding: 0;
  list-style: none;
}

.reset-password__rule {
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 2);
  font-size: var(--text-md);
  color: var(--color-text-muted);
}

.reset-password__rule .core-icon {
  color: var(--color-text-subtle);
}

.reset-password__rule.is-met {
  color: var(--color-text);
}

.reset-password__rule.is-met .core-icon {
  color: var(--color-success);
}

@media (max-width: 560px) {
  .reset-password__card {
    padding: 32px 24px;
  }
}
</style>
