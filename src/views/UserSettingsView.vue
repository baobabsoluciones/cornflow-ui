<template>
  <div class="view-container">
    <MTitleView
      :icon="'mdi-account-cog'"
      :title="title"
      :description="description"
    />
    <MTabTable
      class="mt-5"
      style="height: 90vh !important"
      :tabsData="userTabs"
      @update:selectedTab="handleTabSelected"
      :selectedTable="selectedTab"
      :direction="'horizontal'"
    >
      <template #table="{ tabSelected }">
        <!-- User settings -->
        <v-col
          cols="12"
          class="ml-3"
          style="margin-top: -20px !important"
          v-if="selectedTab === 'user-settings'"
        >
          <v-list>
            <v-list-item>
              <v-list-item-title class="mb-2 settings-title">{{
                $t('settings.theme')
              }}</v-list-item-title>
              <v-list-item-subtitle class="mb-1">{{
                $t('settings.selectTheme')
              }}</v-list-item-subtitle>
              <v-radio-group v-model="theme">
                <v-radio value="light">
                  <template #label>
                    <v-icon class="mr-1">mdi-white-balance-sunny</v-icon>
                    {{ $t('settings.light') }}
                  </template>
                </v-radio>
                <!-- <v-radio label="Dark" value="dark">
            <template #label>
              <v-icon class="mr-1">mdi-weather-night</v-icon>
              {{ $t('settings.dark') }}
            </template>
          </v-radio> -->
              </v-radio-group>
            </v-list-item>

            <v-divider></v-divider>

            <v-list-item class="mt-6">
              <v-list-item-title class="mb-2 settings-title">{{
                $t('settings.language')
              }}</v-list-item-title>
              <v-list-item-subtitle class="mb-2">{{
                $t('settings.selectLanguage')
              }}</v-list-item-subtitle>
              <v-select
                style="width: 300px !important"
                variant="outlined"
                v-model="language"
                :items="languages"
              ></v-select>
            </v-list-item>
          </v-list>
        </v-col>

        <!-- User profile -->
        <v-col
          cols="12"
          class="ml-3"
          style="margin-top: -20px !important"
          v-else
        >
          <v-list>
            <v-list-item>
              <v-list-item-title class="mb-2 settings-title">{{
                $t('settings.userSecurity')
              }}</v-list-item-title>
              <v-alert
                v-if="passwordChangeForced"
                type="warning"
                variant="tonal"
                class="mb-3"
                style="max-width: 600px"
                data-test="forced-change-alert"
              >
                {{ $t('settings.passwordChangeForced') }}
              </v-alert>
              <v-list-item-subtitle class="mb-2">{{
                $t('settings.changePassword')
              }}</v-list-item-subtitle>
              <v-form>
                <MInputField
                  style="width: 300px !important"
                  class="mt-4"
                  v-model="currentPassword"
                  :title="$t('settings.currentPassword')"
                  type="password"
                >
                </MInputField>
                <MInputField
                  style="width: 300px !important"
                  class="mt-4"
                  v-model="newPassword"
                  :rules="newPassword ? passwordRules : []"
                  :title="$t('settings.newPassword')"
                  type="password"
                >
                </MInputField>
                <MInputField
                  style="width: 300px !important"
                  class="mt-4"
                  v-model="confirmPassword"
                  :rules="confirmPassword ? passwordRules : []"
                  :title="$t('settings.confirmPassword')"
                  type="password"
                >
                </MInputField>
                <v-btn
                  :disabled="!validPassword"
                  color="primary"
                  class="my-4"
                  @click="changePassword"
                  >{{ $t('settings.submit') }}</v-btn
                >
              </v-form>
            </v-list-item>

            <v-divider></v-divider>

            <v-list-item class="mt-6">
              <v-list-item-title class="mb-2 settings-title">{{
                $t('settings.mfaTitle')
              }}</v-list-item-title>
              <v-list-item-subtitle class="mb-2">{{
                $t('settings.mfaResetDescription')
              }}</v-list-item-subtitle>
              <v-btn
                color="primary"
                variant="outlined"
                class="my-2"
                @click="resetMfa"
                data-test="mfa-reset-button"
                >{{ $t('settings.mfaResetButton') }}</v-btn
              >
            </v-list-item>
          </v-list>
        </v-col>
      </template>
    </MTabTable>
  </div>
</template>

<script>
import { useGeneralStore } from '@cornflow-ui/core/stores/general'
import { useI18n } from 'vue-i18n'
import { inject } from 'vue'
import config from '@cornflow-ui/core/config'
import { changeLanguage } from '@cornflow-ui/core/plugins/i18n'
import {
  isPasswordStrongEnough,
  PASSWORD_MIN_LENGTH,
} from '@cornflow-ui/core/utils/passwordStrength'

export default {
  components: {},
  data() {
    return {
      generalStore: useGeneralStore(),
      showSnackbar: null,
      selectedTab: 'user-settings',
      theme: 'light',
      language: this.$i18n.locale,
      languages: [
        { title: this.$t('settings.english'), value: 'en' },
        { title: this.$t('settings.spanish'), value: 'es' },
        { title: this.$t('settings.french'), value: 'fr' },
      ],
      passwordRules: [
        (value) =>
          (value !== undefined && value.length >= PASSWORD_MIN_LENGTH) ||
          this.$t('settings.passwordRuleLength', {
            length: `${PASSWORD_MIN_LENGTH}`,
          }),
        (value) =>
          /[A-Z]/.test(value) || this.$t('settings.passwordRuleCharacters'),
        (value) =>
          /[a-z]/.test(value) || this.$t('settings.passwordRuleCharacters'),
        (value) =>
          /\d/.test(value) || this.$t('settings.passwordRuleCharacters'),
        (value) =>
          /[!?@#$%^&*)(+=.<>{}[\],/¿¡:;'"|~`_-]/.test(value) ||
          this.$t('settings.passwordRuleCharacters'),
        (value) => !/\s/.test(value) || this.$t('settings.passWordRuleNoSpace'),
        (value) =>
          !/\d{6,}/.test(value || '') ||
          this.$t('settings.passwordRuleDigitSequence'),
        (value) =>
          !value ||
          isPasswordStrongEnough(value) ||
          this.$t('settings.passwordRuleStrength'),
        (value) =>
          value === this.newPassword ||
          this.$t('settings.passwordRuleNotMatch'),
      ],
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    }
  },
  created() {
    this.showSnackbar = inject('showSnackbar')
    if (
      config.auth.type !== 'cornflow' &&
      this.selectedTab === 'user-profile'
    ) {
      this.selectedTab = 'user-settings'
    }
    // When the password has expired (or a change is forced) the user lands
    // here and the profile tab is opened directly
    if (this.passwordChangeForced && config.auth.type === 'cornflow') {
      this.selectedTab = 'user-profile'
    }
    // Initialize language from current i18n locale
    this.language = this.$i18n.locale
  },
  updated() {
    this.resetPasswordFields()
  },
  setup() {
    const { locale } = useI18n()

    return {
      locale,
    }
  },
  watch: {
    language(newLang) {
      this.locale = newLang
      // Use the new changeLanguage function to update configurations
      changeLanguage(newLang)
    },
  },
  computed: {
    passwordChangeForced() {
      return (
        this.$route?.query?.changePassword === 'true' ||
        sessionStorage.getItem('pwdChangeRequired') === 'true'
      )
    },
    validPassword() {
      return (
        this.currentPassword?.length > 0 &&
        this.newPassword?.length > 0 &&
        this.confirmPassword?.length > 0 &&
        this.newPassword === this.confirmPassword &&
        this.passwordRules.every((rule) => rule(this.confirmPassword) === true)
      )
    },
    userTabs() {
      const tabs = [
        {
          text: this.$t('settings.userSettings'),
          value: 'user-settings',
        },
      ]

      if (config.auth.type === 'cornflow') {
        tabs.push({
          text: this.$t('settings.userProfile'),
          value: 'user-profile',
        })
      }

      return tabs
    },
    title() {
      return this.$t('settings.user')
    },
    description() {
      return this.$t('settings.userDescription')
    },
  },
  methods: {
    handleTabSelected(newTab) {
      this.selectedTab = newTab
    },
    resetPasswordFields() {
      this.currentPassword = undefined
      this.newPassword = undefined
      this.confirmPassword = undefined
      this.passwordRules.every((rule) => rule(this.newPassword) === true)
      this.passwordRules.every((rule) => rule(this.confirmPassword) === true)
    },
    async changePassword() {
      try {
        const user = this.generalStore.getUser
        const result = await this.generalStore.changeUserPassword(
          user.id,
          this.newPassword,
          this.currentPassword,
        )
        if (result?.success) {
          this.resetPasswordFields()
          // Changing the password revokes every session token (including
          // the current one), so the user must log in again
          this.showSnackbar(this.$t('settings.snackbarMessageSuccessRelogin'))
          const { default: authService } = await import(
            '@cornflow-ui/core/services/AuthService'
          )
          authService.logout()
          this.$router.push({ path: '/sign-in', query: { changed: 'true' } })
        } else {
          this.showSnackbar(
            result?.message || this.$t('settings.snackbarMessageError'),
            'error',
          )
        }
      } catch (error) {
        console.error('Failed to change password:', error)
        this.showSnackbar(this.$t('settings.snackbarMessageError'), 'error')
      }
    },
    async resetMfa() {
      try {
        const confirmed = window.confirm(
          this.$t('settings.mfaResetConfirm'),
        )
        if (!confirmed) {
          return
        }
        const user = this.generalStore.getUser
        const success = await this.generalStore.resetUserMfa(user.id)
        if (success) {
          this.showSnackbar(this.$t('settings.mfaResetSuccess'))
        } else {
          this.showSnackbar(this.$t('settings.mfaResetError'), 'error')
        }
      } catch (error) {
        console.error('Failed to reset the two-factor authentication:', error)
        this.showSnackbar(this.$t('settings.mfaResetError'), 'error')
      }
    },
  },
}
</script>
<style scoped>
.settings-title {
  font-weight: 500 !important;
  font-size: 1.1rem !important;
  color: var(--title) !important;
}
</style>
