<template>
  <div class="view-container">
    <PTitleView
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
              <v-list-item-subtitle class="mb-2">{{
                $t('settings.changePassword')
              }}</v-list-item-subtitle>
              <v-form>
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
          </v-list>
        </v-col>
      </template>
    </MTabTable>
  </div>
</template>

<script>
import { useGeneralStore } from '@/stores/general'
import { useI18n } from 'vue-i18n'
import { inject } from 'vue'

export default {
  components: {},
  data() {
    return {
      generalStore: useGeneralStore(),
      showSnackbar: null,
      selectedTab: 'user-settings',
      theme: 'light',
      language: 'en',
      languages: [
        { title: this.$t('settings.english'), value: 'en' },
        { title: this.$t('settings.spanish'), value: 'es' },
        { title: this.$t('settings.french'), value: 'fr' },
      ],
      passwordRules: [
        (value) =>
          (value !== undefined && value.length >= 5) ||
          this.$t('settings.passwordRuleLength', { length: '5' }),
        (value) =>
          /[A-Z]/.test(value) || this.$t('settings.passwordRuleCharacters'),
        (value) =>
          /[a-z]/.test(value) || this.$t('settings.passwordRuleCharacters'),
        (value) =>
          /[0-9]/.test(value) || this.$t('settings.passwordRuleCharacters'),
        (value) =>
          /[!?@#$%^&*)(+=.<>{}[\],/¿¡:;'"|~`_-]/.test(value) ||
          this.$t('settings.passwordRuleCharacters'),
        (value) => !/\s/.test(value) || this.$t('settings.passWordRuleNoSpace'),
        (value) =>
          value === this.newPassword ||
          this.$t('settings.passwordRuleNotMatch'),
      ],
      newPassword: '',
      confirmPassword: '',
    }
  },
  created() {
    this.showSnackbar = inject('showSnackbar')
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
    },
  },
  methods: {
    resetPasswordFields() {
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
        )
        if (result) {
          this.resetPasswordFields()
          this.showSnackbar(this.$t('settings.snackbarMessageSuccess'))
        } else {
          this.showSnackbar(this.$t('settings.snackbarMessageError'), 'error')
        }
      } catch (error) {
        this.showSnackbar(this.$t('settings.snackbarMessageError'), 'error')
      }
    },
  },
  computed: {
    validPassword() {
      return (
        this.newPassword?.length > 0 &&
        this.confirmPassword?.length > 0 &&
        this.newPassword === this.confirmPassword &&
        this.passwordRules.every((rule) => rule(this.confirmPassword) === true)
      )
    },
    userTabs() {
      return [
        {
          text: this.$t('settings.userSettings'),
          value: 'user-settings',
        },
        {
          text: this.$t('settings.userProfile'),
          value: 'user-profile',
        },
      ]
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
        )
        if (result) {
          this.resetPasswordFields()
          this.showSnackbar(this.$t('settings.snackbarMessageSuccess'))
        } else {
          this.showSnackbar(this.$t('settings.snackbarMessageError'), 'error')
        }
      } catch (error) {
        this.showSnackbar(this.$t('settings.snackbarMessageError'), 'error')
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
