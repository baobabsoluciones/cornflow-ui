<!--
  UserSettingsView: the user's own settings, a card for each subject.

  - Account: the name, the e-mail, the user name and the roles of who is signed in.
  - Appearance, when the app offers dark mode (`enableDarkMode`): light, dark or as the system is.
  - Language of the app, among the ones the app offers (`languages` in its config).
  - Password, when the app signs in with Cornflow: the new one twice, with what it needs ticked
    as it is typed; it is sent once it meets all of it.
-->
<template>
  <div class="view-container user-settings-view">
    <CoreTitleView
      icon="mdi-account-cog"
      :title="$t('settings.user')"
      :description="$t('settings.userDescription')"
    />

    <div class="user-settings">
      <section v-if="account" class="user-settings__card user-settings__account" data-testid="settings-account">
        <span class="user-settings__avatar" aria-hidden="true">{{ account.initial }}</span>
        <div class="user-settings__account-text">
          <span class="user-settings__name">{{ account.name }}</span>
          <span v-if="account.email" class="user-settings__meta">{{ account.email }}</span>
          <span v-if="account.username !== account.name" class="user-settings__meta">
            {{ $t('settings.username') }}: {{ account.username }}
          </span>
          <div v-if="account.roles.length" class="user-settings__roles" :aria-label="$t('settings.roles')">
            <CoreBadge v-for="role in account.roles" :key="role" :label="role" tone="neutral" size="sm" />
          </div>
        </div>
      </section>

      <section v-if="themeEnabled" class="user-settings__card" aria-labelledby="settings-theme-title">
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

      <section class="user-settings__card" aria-labelledby="settings-language-title">
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

      <section v-if="canChangePassword" class="user-settings__card" aria-labelledby="settings-password-title">
        <header class="user-settings__head">
          <h2 id="settings-password-title" class="user-settings__title">{{ $t('settings.password') }}</h2>
          <p class="user-settings__hint">{{ $t('settings.changePassword') }}</p>
        </header>
        <form class="user-settings__password" data-testid="settings-password" @submit.prevent="changePassword">
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
              v-for="rule in rules"
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
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import CoreBadge from '@cornflow-ui/core/components/core/CoreBadge.vue'
import CoreButton from '@cornflow-ui/core/components/core/CoreButton.vue'
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
import appConfig from '@/app/config'

defineOptions({ name: 'UserSettingsView' })

const { t, locale } = useI18n()
const store = useGeneralStore()

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

const MIN_LENGTH = 5
const SPECIAL = /[!?@#$%^&*)(+=.<>{}[\],/¿¡:;'"|~`_-]/

const canChangePassword = computed(() => config.auth.type === 'cornflow')
const newPassword = ref('')
const confirmPassword = ref('')
const showPasswords = ref(false)
const saving = ref(false)

const rules = computed(() => {
  const value = newPassword.value
  return [
    {
      key: 'length',
      label: t('settings.passwordRules.length', { length: MIN_LENGTH }),
      met: value.length >= MIN_LENGTH,
    },
    {
      key: 'characters',
      label: t('settings.passwordRules.characters'),
      met: /[A-Z]/.test(value) && /[a-z]/.test(value) && /\d/.test(value) && SPECIAL.test(value),
    },
    { key: 'spaces', label: t('settings.passwordRules.spaces'), met: value !== '' && !/\s/.test(value) },
    {
      key: 'match',
      label: t('settings.passwordRules.match'),
      met: value !== '' && value === confirmPassword.value,
    },
  ]
})

const mismatch = computed(
  () => confirmPassword.value !== '' && confirmPassword.value !== newPassword.value,
)
const passwordReady = computed(() => rules.value.every((rule) => rule.met))

async function changePassword() {
  if (!passwordReady.value || saving.value) return
  saving.value = true
  try {
    const changed = await store.changeUserPassword(store.getUser.id, newPassword.value)
    if (changed) {
      newPassword.value = ''
      confirmPassword.value = ''
      showSnackbar(t('settings.snackbarMessageSuccess'), 'success')
    } else {
      showSnackbar(t('settings.snackbarMessageError'), 'error')
    }
  } catch (error) {
    console.error('Failed to change password:', error)
    showSnackbar(t('settings.snackbarMessageError'), 'error')
  } finally {
    saving.value = false
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
</style>
