<template>
  <div class="view-container">
    <MTitleView
      :icon="'mdi-account-cog'"
      :title="title"
      :description="description"
    />
    <!-- Sin altura fija: con 90vh clavados, el contenido que no cabe (MFA y
         token personal) quedaba cortado sin scroll, porque el desplazamiento
         vive en .view-container y no dentro del componente de pestañas. -->
    <MTabTable
      class="mt-5"
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

              <!-- Already enrolled: allow resetting/disabling -->
              <template v-if="mfaEnabled">
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
              </template>

              <!-- Not enrolled: allow opting in -->
              <template v-else>
                <template v-if="mfaStep === 'idle'">
                  <v-list-item-subtitle class="mb-2">{{
                    $t('settings.mfaEnableDescription')
                  }}</v-list-item-subtitle>
                  <v-btn
                    color="primary"
                    class="my-2"
                    @click="startMfaEnroll"
                    data-test="mfa-enable-button"
                    >{{ $t('settings.mfaEnableButton') }}</v-btn
                  >
                </template>

                <template v-else-if="mfaStep === 'qr'">
                  <v-list-item-subtitle class="mb-2">{{
                    $t('settings.mfaEnrollHint')
                  }}</v-list-item-subtitle>
                  <img
                    v-if="mfaQrDataUrl"
                    :src="mfaQrDataUrl"
                    alt="TOTP QR code"
                    style="width: 200px; max-width: 100%"
                    data-test="mfa-qr"
                  />
                  <p class="mfa-secret" v-if="mfaSecret">
                    {{ $t('settings.mfaEnrollSecret') }}
                    <code>{{ mfaSecret }}</code>
                  </p>
                  <MInputField
                    style="width: 300px !important"
                    class="mt-2"
                    v-model="mfaCode"
                    :title="$t('settings.mfaCodeLabel')"
                    type="text"
                  >
                  </MInputField>
                  <div class="mt-2">
                    <v-btn
                      color="primary"
                      class="mr-2"
                      :disabled="!mfaCode"
                      @click="verifyMfaEnroll"
                      data-test="mfa-verify-button"
                      >{{ $t('settings.mfaVerifyButton') }}</v-btn
                    >
                    <v-btn variant="text" @click="cancelMfaEnroll">{{
                      $t('settings.cancel')
                    }}</v-btn>
                  </div>
                </template>

                <template v-else-if="mfaStep === 'backup'">
                  <v-list-item-subtitle class="mb-2">{{
                    $t('settings.mfaBackupHint')
                  }}</v-list-item-subtitle>
                  <div class="mfa-backup-codes" data-test="mfa-backup-codes">
                    <code v-for="code in mfaBackupCodes" :key="code">{{
                      code
                    }}</code>
                  </div>
                  <v-btn
                    color="primary"
                    class="mt-2"
                    @click="finishMfaEnroll"
                    data-test="mfa-backup-done"
                    >{{ $t('settings.mfaBackupContinue') }}</v-btn
                  >
                </template>
              </template>
            </v-list-item>

            <v-divider v-if="personalTokenEnabled"></v-divider>

            <v-list-item v-if="personalTokenEnabled" class="mt-6">
              <v-list-item-title class="mb-2 settings-title">{{
                $t('settings.apiKeyTitle')
              }}</v-list-item-title>
              <v-list-item-subtitle class="mb-2">{{
                $t('settings.apiKeyDescription')
              }}</v-list-item-subtitle>

              <!-- The server said generation is disabled on this deployment -->
              <v-alert
                v-if="apiKeyServerDisabled"
                type="info"
                variant="tonal"
                style="max-width: 600px"
                data-test="api-key-disabled-alert"
              >
                {{ $t('settings.apiKeyDisabled') }}
              </v-alert>

              <template v-else>
              <!-- Optional step-up TOTP for MFA users -->
              <MInputField
                v-if="mfaEnabled"
                style="width: 300px !important"
                class="mt-2"
                v-model="apiKeyTotp"
                :title="$t('settings.mfaCodeLabel')"
                type="text"
                data-test="api-key-totp"
              >
              </MInputField>
              <!-- Read-only scope: the key is refused on anything but GET -->
              <v-checkbox
                v-model="apiKeyReadOnly"
                :label="$t('settings.apiKeyReadOnlyLabel')"
                :hint="$t('settings.apiKeyReadOnlyHint')"
                persistent-hint
                density="compact"
                class="mt-2"
                data-test="api-key-read-only"
              ></v-checkbox>
              <v-btn
                color="primary"
                class="my-2"
                @click="generateApiKey"
                data-test="api-key-generate-button"
                >{{ $t('settings.apiKeyGenerateButton') }}</v-btn
              >

              <!-- Shown once -->
              <div v-if="apiKey" class="api-key-box" data-test="api-key-box">
                <v-alert type="warning" variant="tonal" class="mb-2">
                  {{ $t('settings.apiKeyOnceWarning') }}
                </v-alert>
                <code class="api-key-value">{{ apiKey }}</code>
                <v-btn
                  variant="outlined"
                  size="small"
                  class="mt-2"
                  @click="copyApiKey"
                  >{{ $t('settings.apiKeyCopy') }}</v-btn
                >
              </div>
              </template>
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
import QRCode from 'qrcode'
import config from '@cornflow-ui/core/config'
import appConfig from '@/app/config'
import { changeLanguage } from '@cornflow-ui/core/plugins/i18n'
import { getSpecificAuthService } from '@cornflow-ui/core/services/AuthServiceFactory'
import { buildPasswordRules } from '@cornflow-ui/core/utils/passwordStrength'

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
      // Policy rules come from utils/passwordStrength so every screen enforces
      // the same ones; only the confirmation rule belongs to this view.
      passwordRules: [
        ...buildPasswordRules((key, params) => this.$t(key, params)),
        (value) =>
          value === this.newPassword ||
          this.$t('settings.passwordRuleNotMatch'),
      ],
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
      // Two-factor enrollment (opt-in) flow state
      mfaStep: 'idle',
      mfaSecret: '',
      mfaQrDataUrl: '',
      mfaCode: '',
      mfaBackupCodes: [],
      // Personal API key
      apiKeyTotp: '',
      apiKeyReadOnly: false,
      // Set when the server answers 501: generation is disabled on this
      // deployment (PERSONAL_TOKEN_ENABLED=0), so the form is hidden and a
      // persistent notice shown instead of failing on every attempt
      apiKeyServerDisabled: false,
      apiKey: '',
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
    mfaEnabled() {
      return !!this.generalStore.getUser?.mfaEnabled
    },
    personalTokenEnabled() {
      // Personal API keys are a cornflow-auth feature; hidden when the
      // deployment disables them (backend also enforces it). Defaults on.
      return (
        config.auth.type === 'cornflow' &&
        appConfig.getCore().parameters.enablePersonalTokens !== false
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
          if (user) user.mfaEnabled = false
          this.showSnackbar(this.$t('settings.mfaResetSuccess'))
        } else {
          this.showSnackbar(this.$t('settings.mfaResetError'), 'error')
        }
      } catch (error) {
        console.error('Failed to reset the two-factor authentication:', error)
        this.showSnackbar(this.$t('settings.mfaResetError'), 'error')
      }
    },
    async startMfaEnroll() {
      try {
        const cornflowAuth = await getSpecificAuthService('cornflow')
        const setupData = await cornflowAuth?.mfaSetup?.()
        if (!setupData) {
          this.showSnackbar(this.$t('settings.mfaEnrollError'), 'error')
          return
        }
        this.mfaSecret = setupData.secret
        try {
          this.mfaQrDataUrl = await QRCode.toDataURL(
            setupData.provisioningUri,
            { width: 200, margin: 1 },
          )
        } catch (qrError) {
          // The manual secret still allows enrollment
          console.error('Could not render the QR code:', qrError)
          this.mfaQrDataUrl = ''
        }
        this.mfaStep = 'qr'
      } catch (error) {
        console.error('Failed to start MFA enrollment:', error)
        this.showSnackbar(this.$t('settings.mfaEnrollError'), 'error')
      }
    },
    async verifyMfaEnroll() {
      try {
        if (!this.mfaCode) {
          return
        }
        const cornflowAuth = await getSpecificAuthService('cornflow')
        const verifyData = await cornflowAuth?.mfaVerify?.(this.mfaCode)
        if (!verifyData) {
          this.showSnackbar(this.$t('settings.mfaInvalidCode'), 'error')
          return
        }
        this.mfaBackupCodes = verifyData.backupCodes
        this.mfaStep = 'backup'
      } catch (error) {
        console.error('Failed to verify MFA enrollment:', error)
        this.showSnackbar(this.$t('settings.mfaEnrollError'), 'error')
      }
    },
    cancelMfaEnroll() {
      this.mfaStep = 'idle'
      this.mfaSecret = ''
      this.mfaQrDataUrl = ''
      this.mfaCode = ''
    },
    async generateApiKey() {
      try {
        const cornflowAuth = await getSpecificAuthService('cornflow')
        const result = await cornflowAuth?.createApiKey?.(
          this.apiKeyTotp || undefined,
          this.apiKeyReadOnly ? 'read' : undefined,
        )
        if (result?.success) {
          this.apiKey = result.apiKey
          this.apiKeyTotp = ''
          this.showSnackbar(this.$t('settings.apiKeySuccess'))
        } else if (result?.disabled) {
          this.apiKeyServerDisabled = true
          this.showSnackbar(this.$t('settings.apiKeyDisabled'), 'error')
        } else {
          this.showSnackbar(
            result?.message || this.$t('settings.apiKeyError'),
            'error',
          )
        }
      } catch (error) {
        console.error('Failed to generate the API key:', error)
        this.showSnackbar(this.$t('settings.apiKeyError'), 'error')
      }
    },
    async copyApiKey() {
      try {
        await navigator.clipboard.writeText(this.apiKey)
        this.showSnackbar(this.$t('settings.apiKeyCopied'))
      } catch (error) {
        console.error('Could not copy the API key:', error)
      }
    },
    finishMfaEnroll() {
      const user = this.generalStore.getUser
      if (user) user.mfaEnabled = true
      this.mfaStep = 'idle'
      this.mfaSecret = ''
      this.mfaQrDataUrl = ''
      this.mfaCode = ''
      this.mfaBackupCodes = []
      this.showSnackbar(this.$t('settings.mfaEnableSuccess'))
    },
  },
}
</script>
<style scoped>
/* The global `.view-container` rule in SectionView.css pins `overflow: hidden`
   for all views. Dropping the tab component's fixed 90vh took away the inner
   scroller it used to rely on, so without this override the MFA and personal
   token blocks are still unreachable on a short viewport. Same fix as
   ProjectExecutionView. */
.view-container {
  overflow-y: auto;
}

.settings-title {
  font-weight: 500 !important;
  font-size: 1.1rem !important;
  color: var(--title) !important;
}

.mfa-secret {
  font-size: 0.8rem;
  word-break: break-all;
  margin: 8px 0;
}

.mfa-secret code {
  user-select: all;
}

.mfa-backup-codes {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 160px));
  gap: 6px;
  padding: 12px;
  border: 1px dashed rgba(0, 0, 0, 0.3);
  border-radius: 8px;
  margin: 8px 0;
}

.mfa-backup-codes code {
  text-align: center;
  user-select: all;
}

.api-key-box {
  margin-top: 8px;
  max-width: 600px;
}

.api-key-value {
  display: block;
  padding: 10px 12px;
  border: 1px dashed rgba(0, 0, 0, 0.3);
  border-radius: 8px;
  word-break: break-all;
  user-select: all;
  font-size: 0.85rem;
}
</style>
