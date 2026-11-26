<!--
  UserSettingsView: the user's own settings, a card for each subject.

  - Account: the name, the e-mail, the user name and the roles of who is signed in.
  - Appearance, when the app offers dark mode (`enableDarkMode`): light, dark or as the system is.
  - Language of the app, among the ones the app offers (`languages` in its config).
  - Password, when the app signs in with Cornflow: the current one and the new one twice, with
    what cornflow's password policy needs ticked as it is typed; it is sent once it meets all of
    it. Changing it closes every session, so the user signs in again with the new one. When the
    password has expired or must be renewed, the card says so and the app waits for it here.
  - Two-factor authentication, when the app signs in with Cornflow: whether it is on; turning it on
    (QR code, first code, backup codes) or resetting it, which closes every session.
  - Personal access token, when the app signs in with Cornflow and offers it
    (`enablePersonalTokens`): generates one, read-only if asked, confirmed with a two-factor code
    when the user has it; it is shown once.
-->
<template>
  <div class="view-container user-settings-view">
    <CoreTitleView
      icon="mdi-account-cog"
      :title="$t('settings.user')"
      :description="$t('settings.userDescription')"
    />

    <div class="user-settings">
      <section v-if="account" class="user-settings__card user-settings__account" data-testid="settings-account" data-tour="settings-account">
        <span class="user-settings__avatar" aria-hidden="true">{{ account.initial }}</span>
        <div class="user-settings__account-text">
          <span class="user-settings__name">{{ account.name }}</span>
          <span v-if="account.email" class="user-settings__meta">{{ account.email }}</span>
          <span v-if="account.username !== account.name" class="user-settings__meta">
            {{ $t('settings.username') }}: {{ account.username }}
          </span>
          <div v-if="account.roles.length" class="user-settings__roles" :aria-label="$t('settings.roles')">
            <CoreBadge v-for="role in account.roles" :key="role" :label="role" tone="neutral" size="small" />
          </div>
        </div>
      </section>

      <section
        v-if="themeEnabled"
        class="user-settings__card"
        aria-labelledby="settings-theme-title"
        data-tour="settings-theme"
      >
        <header class="user-settings__head">
          <h2 id="settings-theme-title" class="user-settings__title">{{ $t('settings.theme') }}</h2>
          <p class="user-settings__hint">{{ $t('settings.selectTheme') }}</p>
        </header>
        <CoreSegmentedControl
          :model-value="themePreference"
          :options="themeOptions"
          :aria-label="$t('settings.theme')"
          data-testid="settings-theme"
          @update:model-value="setThemePreference($event as ThemePreference)"
        />
      </section>

      <section class="user-settings__card" aria-labelledby="settings-language-title" data-tour="settings-language">
        <header class="user-settings__head">
          <h2 id="settings-language-title" class="user-settings__title">{{ $t('settings.language') }}</h2>
          <p class="user-settings__hint">{{ $t('settings.selectLanguage') }}</p>
        </header>
        <CoreSelect
          v-model="language"
          class="user-settings__field"
          :options="languages"
          :aria-label="$t('settings.language')"
          data-testid="settings-language"
        />
      </section>

      <section
        v-if="canChangePassword"
        class="user-settings__card"
        aria-labelledby="settings-password-title"
        data-tour="settings-password"
      >
        <header class="user-settings__head">
          <h2 id="settings-password-title" class="user-settings__title">{{ $t('settings.password') }}</h2>
          <p class="user-settings__hint">{{ $t('settings.changePassword') }}</p>
        </header>
        <CoreAlert
          v-if="passwordChangeForced"
          tone="warning"
          :message="$t('settings.passwordChangeForced')"
          data-testid="settings-password-forced"
        />
        <form class="user-settings__password" data-testid="settings-password" @submit.prevent="changePassword">
          <label class="user-settings__label">
            {{ $t('settings.currentPassword') }}
            <CoreTextField
              v-model="currentPassword"
              class="user-settings__field"
              :type="showPasswords ? 'text' : 'password'"
              autocomplete="current-password"
              data-testid="settings-current-password"
            />
          </label>
          <label class="user-settings__label">
            {{ $t('settings.newPassword') }}
            <CoreTextField
              v-model="newPassword"
              class="user-settings__field"
              :type="showPasswords ? 'text' : 'password'"
              autocomplete="new-password"
              data-testid="settings-new-password"
            >
              <template #append>
                <CoreButton
                  variant="icon"
                  size="small"
                  :icon="showPasswords ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
                  :aria-label="$t(showPasswords ? 'settings.hidePasswords' : 'settings.showPasswords')"
                  :title="$t(showPasswords ? 'settings.hidePasswords' : 'settings.showPasswords')"
                  data-testid="settings-show-passwords"
                  @click="showPasswords = !showPasswords"
                />
              </template>
            </CoreTextField>
          </label>
          <label class="user-settings__label">
            {{ $t('settings.confirmPassword') }}
            <CoreTextField
              v-model="confirmPassword"
              class="user-settings__field"
              :type="showPasswords ? 'text' : 'password'"
              :invalid="mismatch"
              autocomplete="new-password"
              data-testid="settings-confirm-password"
            />
          </label>
          <ul class="user-settings__rules" :aria-label="$t('settings.passwordNeeds')">
            <li
              v-for="rule in passwordChecks"
              :key="rule.key"
              class="user-settings__rule"
              :class="{ 'is-met': rule.met }"
              :data-testid="`settings-rule-${rule.key}`"
            >
              <CoreIcon :name="rule.met ? 'mdi-check-circle' : 'mdi-circle-outline'" :size="16" />
              {{ rule.label }}
            </li>
          </ul>
          <CoreButton
            type="submit"
            class="user-settings__submit"
            :text="$t('settings.savePassword')"
            :disabled="!passwordReady"
            :loading="saving"
            data-testid="settings-save-password"
          />
        </form>
      </section>

      <section
        v-if="canChangePassword"
        class="user-settings__card"
        aria-labelledby="settings-mfa-title"
        data-testid="settings-mfa"
      >
        <header class="user-settings__head">
          <h2 id="settings-mfa-title" class="user-settings__title">
            {{ $t('settings.mfaTitle') }}
            <CoreBadge
              :label="$t(mfaEnabled ? 'settings.mfaOn' : 'settings.mfaOff')"
              :tone="mfaEnabled ? 'success' : 'neutral'"
              size="small"
              data-testid="settings-mfa-status"
            />
          </h2>
          <p class="user-settings__hint">
            {{ $t(mfaEnabled ? 'settings.mfaResetDescription' : 'settings.mfaEnableDescription') }}
          </p>
        </header>

        <div v-if="mfaStep === 'backup'" class="user-settings__password">
          <p class="user-settings__hint">{{ $t('settings.mfaBackupHint') }}</p>
          <ul class="user-settings__backup-codes" data-testid="settings-mfa-backup-codes">
            <li v-for="code in enrollment.backupCodes.value" :key="code">
              <code class="user-settings__code">{{ code }}</code>
            </li>
          </ul>
          <div class="user-settings__actions">
            <CoreButton
              variant="outlined"
              icon="mdi-content-copy"
              :text="$t('logIn.mfa_backup_copy')"
              data-testid="settings-mfa-backup-copy"
              @click="copyText(enrollment.backupCodes.value.join('\n'), 'logIn.mfa_backup_copied')"
            />
            <CoreButton
              :text="$t('settings.mfaBackupContinue')"
              data-testid="settings-mfa-backup-done"
              @click="finishMfa"
            />
          </div>
        </div>

        <CoreButton
          v-else-if="mfaEnabled"
          variant="outlined"
          tone="danger"
          class="user-settings__action"
          icon="mdi-shield-off-outline"
          :text="$t('settings.mfaResetButton')"
          data-testid="settings-mfa-reset"
          @click="mfaResetOpen = true"
        />

        <CoreAlert
          v-else-if="mfaUnavailable"
          tone="info"
          :message="$t('settings.mfaUnavailable')"
          data-testid="settings-mfa-unavailable"
        />

        <CoreButton
          v-else-if="mfaStep === 'idle'"
          class="user-settings__action"
          icon="mdi-shield-key-outline"
          :text="$t('settings.mfaEnableButton')"
          :loading="mfaBusy"
          data-testid="settings-mfa-enable"
          @click="startMfa"
        />

        <form
          v-else
          class="user-settings__password"
          novalidate
          data-testid="settings-mfa-enroll"
          @submit.prevent="verifyMfa"
        >
          <p class="user-settings__hint">{{ $t('settings.mfaEnrollHint') }}</p>
          <img
            v-if="enrollment.qr.value"
            class="user-settings__qr"
            :src="enrollment.qr.value"
            :alt="$t('logIn.mfa_enroll_qr')"
            data-testid="settings-mfa-qr"
          />
          <p v-if="enrollment.secret.value" class="user-settings__hint">
            {{ $t('settings.mfaEnrollSecret') }}
            <code class="user-settings__code" data-testid="settings-mfa-secret">{{ enrollment.secret.value }}</code>
          </p>
          <label class="user-settings__label">
            {{ $t('settings.mfaCodeLabel') }}
            <CoreTextField
              v-model="mfaCode"
              class="user-settings__field"
              autocomplete="one-time-code"
              inputmode="numeric"
              data-testid="settings-mfa-code"
            />
          </label>
          <div class="user-settings__actions">
            <CoreButton
              type="submit"
              :text="$t('settings.mfaVerifyButton')"
              :disabled="!mfaCode"
              :loading="mfaBusy"
              data-testid="settings-mfa-verify"
            />
            <CoreButton
              variant="text"
              :text="$t('settings.cancel')"
              data-testid="settings-mfa-cancel"
              @click="cancelMfa"
            />
          </div>
        </form>

        <CoreConfirmDialog
          v-model="mfaResetOpen"
          :title="$t('settings.mfaResetButton')"
          :message="$t('settings.mfaResetConfirm')"
          :confirm-text="$t('settings.mfaResetButton')"
          :cancel-text="$t('settings.cancel')"
          tone="danger"
          icon="mdi-shield-off-outline"
          :loading="mfaBusy"
          @confirm="resetMfa"
          @cancel="mfaResetOpen = false"
        />
      </section>

      <section
        v-if="personalTokensEnabled"
        class="user-settings__card"
        aria-labelledby="settings-api-key-title"
        data-testid="settings-api-key"
      >
        <header class="user-settings__head">
          <h2 id="settings-api-key-title" class="user-settings__title">{{ $t('settings.apiKeyTitle') }}</h2>
          <p class="user-settings__hint">{{ $t('settings.apiKeyDescription') }}</p>
        </header>

        <CoreAlert
          v-if="apiKeyDisabled"
          tone="info"
          :message="$t('settings.apiKeyDisabled')"
          data-testid="settings-api-key-disabled"
        />

        <form
          v-else
          class="user-settings__password"
          novalidate
          data-testid="settings-api-key-form"
          @submit.prevent="generateApiKey"
        >
          <label v-if="mfaEnabled" class="user-settings__label">
            {{ $t('settings.mfaCodeLabel') }}
            <CoreTextField
              v-model="apiKeyCode"
              class="user-settings__field"
              autocomplete="one-time-code"
              inputmode="numeric"
              data-testid="settings-api-key-code"
            />
          </label>
          <div class="user-settings__check">
            <CoreCheckbox
              v-model="apiKeyReadOnly"
              :label="$t('settings.apiKeyReadOnlyLabel')"
              data-testid="settings-api-key-read-only"
            />
            <p class="user-settings__hint">{{ $t('settings.apiKeyReadOnlyHint') }}</p>
          </div>
          <CoreButton
            type="submit"
            icon="mdi-key-plus"
            :text="$t('settings.apiKeyGenerateButton')"
            :disabled="mfaEnabled && !apiKeyCode"
            :loading="generatingApiKey"
            data-testid="settings-api-key-generate"
          />
        </form>

        <div v-if="apiKey" class="user-settings__password" data-testid="settings-api-key-result">
          <CoreAlert tone="warning" :message="$t('settings.apiKeyOnceWarning')" />
          <code class="user-settings__code user-settings__key" data-testid="settings-api-key-value">{{ apiKey }}</code>
          <CoreButton
            variant="outlined"
            icon="mdi-content-copy"
            :text="$t('settings.apiKeyCopy')"
            data-testid="settings-api-key-copy"
            @click="copyText(apiKey, 'settings.apiKeyCopied')"
          />
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import CoreAlert from '@cornflow-ui/core/components/core/CoreAlert.vue'
import CoreBadge from '@cornflow-ui/core/components/core/CoreBadge.vue'
import CoreButton from '@cornflow-ui/core/components/core/CoreButton.vue'
import CoreCheckbox from '@cornflow-ui/core/components/core/CoreCheckbox.vue'
import CoreConfirmDialog from '@cornflow-ui/core/components/core/table/CoreConfirmDialog.vue'
import CoreIcon from '@cornflow-ui/core/components/core/CoreIcon.vue'
import CoreSegmentedControl from '@cornflow-ui/core/components/core/CoreSegmentedControl.vue'
import CoreSelect from '@cornflow-ui/core/components/core/CoreSelect.vue'
import CoreTextField from '@cornflow-ui/core/components/core/CoreTextField.vue'
import CoreTitleView from '@cornflow-ui/core/components/core/CoreTitleView.vue'
import { useGeneralStore } from '@cornflow-ui/core/stores/general'
import { showSnackbar } from '@cornflow-ui/core/services/SnackbarService'
import { changeLanguage } from '@cornflow-ui/core/plugins/i18n'
import { useTheme, type ThemePreference } from '@cornflow-ui/core/plugins/theme'
import {
  resolveVisibleLanguages,
  readConfiguredLanguages,
} from '@cornflow-ui/core/plugins/languages'
import config from '@cornflow-ui/core/config'
import { usePasswordPolicy } from '@cornflow-ui/core/composables/usePasswordPolicy'
import { useMfaEnrollment } from '@cornflow-ui/core/composables/useMfaEnrollment'
import { getAppParameters } from '@cornflow-ui/core/utils/appParameters'
import { getSpecificAuthService } from '@cornflow-ui/core/services/AuthServiceFactory'
import appConfig from '@/app/config'

defineOptions({ name: 'UserSettingsView' })

const { t, locale } = useI18n()
const store = useGeneralStore()
const route = useRoute()
const router = useRouter()

// ── Account ──────────────────────────────────────────────────────────────────

const account = computed(() => {
  const user = store.getUser
  if (!user?.username) return null
  const name = user.fullName?.trim() || user.username
  return {
    name,
    username: user.username,
    email: user.email ?? '',
    initial: String(name)[0].toUpperCase(),
    roles: (user.roles ?? []).map((role: { name: string }) => role.name),
  }
})

// ── Appearance ───────────────────────────────────────────────────────────────

const {
  enabled: themeEnabled,
  preference: themePreference,
  setPreference: setThemePreference,
} = useTheme()

const themeOptions = computed(() => [
  { value: 'light', label: t('settings.light'), icon: 'mdi-white-balance-sunny' },
  { value: 'dark', label: t('settings.dark'), icon: 'mdi-weather-night' },
  { value: 'system', label: t('settings.system'), icon: 'mdi-monitor' },
])

// ── Language ─────────────────────────────────────────────────────────────────

const language = ref(locale.value)

/** The core languages the app offers (`languages` in its config), in its order. */
const languages = computed(() =>
  resolveVisibleLanguages(readConfiguredLanguages(appConfig)).map((l) => ({
    label: t(l.labelKey),
    value: l.code,
  })),
)

watch(language, (code) => {
  locale.value = code
  changeLanguage(code)
})

// ── Password ─────────────────────────────────────────────────────────────────

const canChangePassword = computed(() => config.auth.type === 'cornflow')
const passwordChangeForced = computed(
  () =>
    route.query.changePassword === 'true' || sessionStorage.getItem('pwdChangeRequired') === 'true',
)
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const showPasswords = ref(false)
const saving = ref(false)

const {
  checks: passwordChecks,
  ready: newPasswordReady,
  mismatch,
} = usePasswordPolicy(newPassword, confirmPassword)

const passwordReady = computed(() => currentPassword.value !== '' && newPasswordReady.value)

async function changePassword() {
  if (!passwordReady.value || saving.value) return
  saving.value = true
  try {
    const result = await store.changeUserPassword(
      store.getUser.id,
      newPassword.value,
      currentPassword.value,
    )
    if (result.success) {
      // Cornflow closes every session of the user, this one too.
      await signInAgain('settings.snackbarMessageSuccessRelogin')
    } else {
      showSnackbar(result.message || t('settings.snackbarMessageError'), 'error')
    }
  } catch (error) {
    console.error('Failed to change password:', error)
    showSnackbar(t('settings.snackbarMessageError'), 'error')
  } finally {
    saving.value = false
  }
}

async function copyText(text: string, doneKey: string) {
  try {
    await navigator.clipboard.writeText(text)
    showSnackbar(t(doneKey), 'success')
  } catch (error) {
    console.error('Could not copy to the clipboard:', error)
  }
}

/** Signs out, for the changes cornflow answers by closing every session of the user. */
async function signInAgain(messageKey: string) {
  showSnackbar(t(messageKey), 'success')
  const auth = await getSpecificAuthService('cornflow')
  auth?.logout()
  void router.push('/sign-in')
}

// ── Two-factor authentication ────────────────────────────────────────────────

const mfaEnabled = computed(() => !!store.getUser?.mfaEnabled)
const mfaStep = ref<'idle' | 'enroll' | 'backup'>('idle')
const mfaCode = ref('')
const mfaBusy = ref(false)
const mfaResetOpen = ref(false)
const enrollment = useMfaEnrollment()

/** The deployment does not offer two-factor authentication, which the server says on `start()`. */
const mfaUnavailable = ref(false)

async function startMfa() {
  mfaBusy.value = true
  try {
    const started = await enrollment.start()
    if (started === 'started') mfaStep.value = 'enroll'
    else if (started === 'unavailable') mfaUnavailable.value = true
    else showSnackbar(t('settings.mfaEnrollError'), 'error')
  } finally {
    mfaBusy.value = false
  }
}

async function verifyMfa() {
  if (!mfaCode.value || mfaBusy.value) return
  mfaBusy.value = true
  try {
    if (await enrollment.verify(mfaCode.value)) {
      store.getUser.mfaEnabled = true
      mfaStep.value = 'backup'
    } else {
      showSnackbar(t('settings.mfaInvalidCode'), 'error')
    }
    mfaCode.value = ''
  } finally {
    mfaBusy.value = false
  }
}

function cancelMfa() {
  enrollment.clear()
  mfaCode.value = ''
  mfaStep.value = 'idle'
}

function finishMfa() {
  enrollment.clear()
  mfaStep.value = 'idle'
  showSnackbar(t('settings.mfaEnableSuccess'), 'success')
}

async function resetMfa() {
  mfaBusy.value = true
  try {
    if (await store.resetUserMfa(store.getUser.id)) {
      mfaResetOpen.value = false
      // Cornflow closes every session and API key of the user.
      await signInAgain('settings.mfaResetSuccess')
    } else {
      showSnackbar(t('settings.mfaResetError'), 'error')
    }
  } finally {
    mfaBusy.value = false
  }
}

// ── Personal access token ────────────────────────────────────────────────────

const personalTokensEnabled = computed(
  () => canChangePassword.value && getAppParameters().enablePersonalTokens !== false,
)
const apiKeyCode = ref('')
const apiKeyReadOnly = ref(false)
const apiKey = ref('')
/** The server answered that personal tokens are off on this deployment. */
const apiKeyDisabled = ref(false)
const generatingApiKey = ref(false)

async function generateApiKey() {
  if (generatingApiKey.value) return
  generatingApiKey.value = true
  try {
    const auth = await getSpecificAuthService('cornflow')
    const result = await auth?.createApiKey?.(
      apiKeyCode.value || undefined,
      apiKeyReadOnly.value ? 'read' : undefined,
    )
    apiKeyCode.value = ''
    if (result?.success) {
      apiKey.value = result.apiKey ?? ''
      showSnackbar(t('settings.apiKeySuccess'), 'success')
    } else if (result?.disabled) {
      apiKeyDisabled.value = true
    } else {
      showSnackbar(result?.message || t('settings.apiKeyError'), 'error')
    }
  } catch (error) {
    console.error('Failed to generate the API key:', error)
    showSnackbar(t('settings.apiKeyError'), 'error')
  } finally {
    generatingApiKey.value = false
  }
}

defineExpose({ languages })
</script>

<style scoped>
.user-settings {
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 4);
  max-width: 720px;
  margin-top: calc(var(--spacing) * 5);
  font-family: var(--font-sans);
  color: var(--color-text);
}

.user-settings__card {
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 4);
  padding: calc(var(--spacing) * 5) calc(var(--spacing) * 6);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-sm);
}

.user-settings__account {
  flex-direction: row;
  align-items: center;
}

.user-settings__avatar {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: var(--radius-full);
  background: var(--color-primary);
  font-size: var(--text-xl);
  font-weight: var(--font-weight-medium);
  color: var(--color-on-primary);
}

.user-settings__account-text {
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 1);
  min-width: 0;
}

.user-settings__name {
  font-size: var(--text-lg);
  font-weight: var(--font-weight-medium);
}

.user-settings__meta {
  font-size: var(--text-md);
  color: var(--color-text-muted);
}

.user-settings__roles {
  display: flex;
  flex-wrap: wrap;
  gap: calc(var(--spacing) * 1.5);
  margin-top: calc(var(--spacing) * 1);
}

.user-settings__head {
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 1);
}

.user-settings__title {
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 2);
  margin: 0;
  font-size: var(--text-base);
  font-weight: var(--font-weight-medium);
}

.user-settings__hint {
  margin: 0;
  font-size: var(--text-md);
  color: var(--color-text-muted);
}

.user-settings__field {
  width: 320px;
  max-width: 100%;
}

.user-settings__password {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: calc(var(--spacing) * 3);
}

.user-settings__label {
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 1.5);
  font-size: var(--text-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-muted);
}

.user-settings__rules {
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 1.5);
  margin: 0;
  padding: 0;
  list-style: none;
}

.user-settings__rule {
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 2);
  font-size: var(--text-md);
  color: var(--color-text-muted);
}

.user-settings__rule .core-icon {
  color: var(--color-text-subtle);
}

.user-settings__rule.is-met {
  color: var(--color-text);
}

.user-settings__rule.is-met .core-icon {
  color: var(--color-success);
}

.user-settings__submit {
  margin-top: calc(var(--spacing) * 1);
}

.user-settings__action {
  align-self: flex-start;
}

.user-settings__actions {
  display: flex;
  flex-wrap: wrap;
  gap: calc(var(--spacing) * 2);
}

.user-settings__check {
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 1);
}

/* The QR code keeps its white quiet zone in dark mode, or authenticator apps cannot read it. */
.user-settings__qr {
  width: 200px;
  height: 200px;
  padding: calc(var(--spacing) * 2);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-md);
  background: #fff;
}

.user-settings__code {
  font-family: var(--font-mono);
  font-size: var(--text-md);
  word-break: break-all;
  color: var(--color-text);
}

.user-settings__key {
  box-sizing: border-box;
  width: 100%;
  padding: calc(var(--spacing) * 3);
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
}

.user-settings__backup-codes {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: calc(var(--spacing) * 2) calc(var(--spacing) * 8);
  margin: 0;
  padding: calc(var(--spacing) * 4);
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
  list-style: none;
}
</style>
