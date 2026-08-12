<template>
  <div class="reset-password-view">
    <v-card class="reset-card" :elevation="2" rounded="lg">
      <h2 class="reset-title">{{ t('resetPassword.title') }}</h2>

      <template v-if="!token">
        <p class="reset-hint">{{ t('resetPassword.missingToken') }}</p>
        <v-btn
          color="var(--primary)"
          block
          rounded="sm"
          @click="router.push('/sign-in')"
        >
          {{ t('resetPassword.backToLogin') }}
        </v-btn>
      </template>

      <v-form v-else @submit.prevent="submit" class="reset-form">
        <p class="reset-hint">{{ t('resetPassword.hint') }}</p>
        <MInputField
          v-model="newPassword"
          :title="t('resetPassword.newPassword')"
          :placeholder="t('resetPassword.newPassword')"
          type="password"
          :rules="newPassword ? passwordRules : []"
          data-test="reset-new-password"
        />
        <MInputField
          v-model="confirmPassword"
          :title="t('resetPassword.confirmPassword')"
          :placeholder="t('resetPassword.confirmPassword')"
          type="password"
          :rules="confirmPassword ? passwordRules : []"
          data-test="reset-confirm-password"
        />
        <v-btn
          type="submit"
          color="var(--primary)"
          class="mt-2"
          block
          rounded="sm"
          :disabled="!validPassword || submitting"
          :loading="submitting"
          data-test="reset-submit"
        >
          {{ t('resetPassword.submit') }}
        </v-btn>
        <v-btn variant="text" size="small" block @click="router.push('/sign-in')">
          {{ t('resetPassword.backToLogin') }}
        </v-btn>
      </v-form>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { getSpecificAuthService } from '@cornflow-ui/core/services/AuthServiceFactory'
import { buildPasswordRules } from '@cornflow-ui/core/utils/passwordStrength'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const showSnackbar =
  inject<(message: string, type?: string) => void>('showSnackbar')

/**
 * Reset token, captured once and immediately stripped from the URL.
 *
 * A token in the query string ends up in the browser history and in the
 * `Referer` of anything the page loads afterwards. It can also reach proxy and
 * CDN access logs — that part is on whoever generates the link, but everything
 * after the first read is on us, so the URL is cleaned right away.
 *
 * A fragment (`#token=…`) is read first and never leaves the browser at all;
 * the query string stays supported because the recovery email is built by the
 * backend and may still use it.
 */
const tokenFromFragment = (): string => {
  const hash = window.location.hash
  // In hash routing the fragment holds the route itself; the query is parsed
  // by vue-router and read below.
  if (!hash || hash.startsWith('#/')) return ''
  return new URLSearchParams(hash.replace(/^#/, '')).get('token') ?? ''
}

const token = ref(tokenFromFragment() || String(route.query.token ?? ''))

if (token.value && (route.query.token || tokenFromFragment())) {
  // Replace, not push: no history entry keeps the token.
  void router.replace({ path: route.path, query: {}, hash: '' })
}

const newPassword = ref('')
const confirmPassword = ref('')
const submitting = ref(false)

// Policy rules come from utils/passwordStrength so every screen enforces the
// same ones; only the confirmation rule belongs to this view.
const passwordRules = [
  ...buildPasswordRules(t),
  (value: string) =>
    value === newPassword.value || t('settings.passwordRuleNotMatch'),
]

const validPassword = computed(
  () =>
    newPassword.value.length > 0 &&
    confirmPassword.value.length > 0 &&
    newPassword.value === confirmPassword.value &&
    passwordRules.every((rule) => rule(confirmPassword.value) === true),
)

const submit = async () => {
  if (!validPassword.value || submitting.value) return
  submitting.value = true
  try {
    const cornflowAuth = await getSpecificAuthService('cornflow')
    const result = await cornflowAuth?.resetPassword?.(
      token.value,
      newPassword.value,
    )
    if (result?.success) {
      showSnackbar?.(t('resetPassword.success'), 'success')
      router.push({ path: '/sign-in', query: { changed: 'true' } })
    } else if (result?.linkInvalid) {
      showSnackbar?.(t('resetPassword.linkExpired'), 'error')
    } else {
      showSnackbar?.(
        result?.message || t('resetPassword.error'),
        'error',
      )
    }
  } catch (error) {
    console.error('Password reset error:', error)
    showSnackbar?.(t('resetPassword.error'), 'error')
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped lang="scss">
.reset-password-view {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.reset-card {
  width: 100%;
  max-width: 420px;
  padding: 32px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.reset-title {
  text-align: center;
  font-size: 1.2rem;
}

.reset-hint {
  font-size: 0.85rem;
  color: rgba(0, 0, 0, 0.6);
  text-align: center;
}

.reset-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
