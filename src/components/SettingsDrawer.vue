<template>
  <v-navigation-drawer
    location="right"
    temporary
    width="400"
    style="height: 100%"
  >
    <v-row class="pa-6 pt-8" style="background-color: var(--background)">
      <span class="title" style="font-size: 1.2rem !important">{{
        $t('settings.settings')
      }}</span>
      <v-spacer></v-spacer>
      <v-icon @click="$emit('close')">mdi-close</v-icon>
    </v-row>
    <v-divider class="mt-3"></v-divider>

    <v-list>
      <v-list-item>
        <v-list-item-title class="mb-2 mt-5 settings-title">{{
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
          variant="outlined"
          v-model="language"
          :items="languages"
        ></v-select>
      </v-list-item>

      <v-divider></v-divider>

      <v-list-item class="mt-6">
        <v-list-item-title class="mb-2 settings-title">{{
          $t('settings.userSettings')
        }}</v-list-item-title>
        <v-list-item-subtitle class="mb-2">{{
          $t('settings.changePassword')
        }}</v-list-item-subtitle>
        <v-form>
          <InputField
            class="mt-4"
            v-model="newPassword"
            :rules="newPassword ? passwordRules : []"
            :title="$t('settings.newPassword')"
            type="password"
          >
          </InputField>
          <InputField
            class="mt-4"
            v-model="confirmPassword"
            :rules="confirmPassword ? passwordRules : []"
            :title="$t('settings.confirmPassword')"
            type="password"
          >
          </InputField>
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
  </v-navigation-drawer>
</template>

<script>
import InputField from './core/InputField.vue'
import { useI18n } from 'vue-i18n'
import { useGeneralStore } from '@/stores/general'
import { inject } from 'vue'

export default {
  components: {
    InputField,
  },
  data() {
    return {
      generalStore: useGeneralStore(),
      showSnackbar: null,
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
      currentPassword: '',
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
  computed: {
    validPassword() {
      return (
        this.newPassword?.length > 0 &&
        this.confirmPassword?.length > 0 &&
        this.newPassword === this.confirmPassword &&
        this.passwordRules.every((rule) => rule(this.confirmPassword) === true)
      )
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
        console.log(error)
        this.showSnackbar(this.$t('settings.snackbarMessageError'), 'error')
      }
    },
  },
}
</script>
<style>
.settings-title {
  font-weight: 500 !important;
  color: var(--title) !important;
}
</style>
