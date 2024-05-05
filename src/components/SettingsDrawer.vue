<template>
  <v-navigation-drawer
    v-model="settingsDrawer"
    location="right"
    temporary
    width="400"
    style="height: 100%"
  >
    <v-row class="mx-5 my-2">
      <span class="title" style="font-size: 1.2rem !important">{{
        $t('settings.settings')
      }}</span>
      <v-spacer></v-spacer>
      <v-icon @click="$emit('close')">mdi-close</v-icon>
    </v-row>
    <v-divider></v-divider>

    <v-list>
      <v-list-item>
        <v-list-item-title class="mb-2 mt-5">{{
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
          <v-radio label="Dark" value="dark">
            <template #label>
              <v-icon class="mr-1">mdi-weather-night</v-icon>
              {{ $t('settings.dark') }}
            </template>
          </v-radio>
        </v-radio-group>
      </v-list-item>

      <v-divider></v-divider>

      <v-list-item class="mt-4">
        <v-list-item-title class="mb-2">{{
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

      <v-list-item class="mt-4">
        <v-list-item-title class="mb-2">{{
          $t('settings.userSettings')
        }}</v-list-item-title>
        <v-list-item-subtitle class="mb-2">{{
          $t('settings.changePassword')
        }}</v-list-item-subtitle>
        <InputField
          class="mt-4"
          v-model="currentPassword"
          :title="$t('settings.currentPassword')"
          type="password"
        >
        </InputField>
        <InputField
          class="mt-4"
          v-model="newPassword"
          :title="$t('settings.newPassword')"
          type="password"
        >
        </InputField>
        <InputField
          class="mt-4"
          v-model="confirmPassword"
          :title="$t('settings.confirmPassword')"
          type="password"
        >
        </InputField>
        <v-btn color="primary" class="my-4" @click="changePassword">{{
          $t('settings.submit')
        }}</v-btn>
      </v-list-item>
    </v-list>
  </v-navigation-drawer>
</template>

<script>
import InputField from './core/InputField.vue'
import { useI18n } from 'vue-i18n'

export default {
  props: {
    drawer: Boolean,
  },
  components: {
    InputField,
  },
  data() {
    return {
      settingsDrawer: false,
      theme: 'light',
      language: 'en',
      languages: [
        { title: this.$t('settings.english'), value: 'en' },
        { title: this.$t('settings.spanish'), value: 'es' },
        { title: this.$t('settings.french'), value: 'fr' },
      ],
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    }
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
    changePassword() {
      // Implement password change logic here
    },
  },
}
</script>
