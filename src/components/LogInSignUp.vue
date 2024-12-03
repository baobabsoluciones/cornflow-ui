<template>
  <div
    class="d-flex justify-center align-center"
    style="height: 100vh; background-color: var(--primary-light-variant)"
  >
    <v-card
      flat
      width="25%"
      style="background-color: var(--primary-light-variant)"
    >
      <v-card-title>
        <v-col>
          <v-img contain src="@\app\assets\logo\full_logo.png" height="48px" />
        </v-col>
      </v-card-title>
      <divider />
      <v-card-subtitle v-if="!signUpMode" :class="{ 'text-center': !isCornflowAuth }">
        {{ $t('logIn.subtitle') }}
      </v-card-subtitle>
      <v-card-subtitle v-else>
        {{ $t('signUp.subtitle') }}
      </v-card-subtitle>
      <divider />

      <v-card-text>
        <v-form v-if="!signUpMode && isCornflowAuth">
          <div class="form-content">
            <label class="label">{{
              $t('logIn.username_textfield_label')
            }}</label>
            <v-text-field
              v-model="username"
              :rules="[rules.required]"
              class="username"
              variant="outlined"
              density="compact"
              prepend-inner-icon="mdi-account-outline"
              single-line
              rounded
              type="text"
              style="margin-bottom: -8px"
              bg-color="white"
              @keydown.enter.prevent="submitLogIn()"
            >
            </v-text-field>

            <label class="label">{{
              $t('logIn.password_textfield_label')
            }}</label>
            <v-text-field
              v-model="password"
              :rules="[rules.required]"
              class="password"
              variant="outlined"
              density="compact"
              prepend-inner-icon="mdi-lock-outline"
              single-line
              rounded
              bg-color="white"
              :type="show1 ? 'text' : 'password'"
              :append-inner-icon="!show1 ? 'mdi-eye' : 'mdi-eye-off'"
              @click:append-inner="show1 = !show1"
              @keydown.enter.prevent="submitLogIn()"
            >
            </v-text-field>
          </div>
        </v-form>

        <v-form v-else-if="signUpMode && isCornflowAuth">
          <div class="form-content">
            <label class="label mt-3">{{
              $t('signUp.email_textfield_label')
            }}</label>
            <v-text-field
              v-model="newUser.email"
              :rules="[emailRules.required, emailRules.format]"
              class="email"
              variant="outlined"
              density="compact"
              prepend-inner-icon="mdi-email-outline"
              rounded
              type="text"
              style="margin-bottom: -16px"
              bg-color="white"
            >
            </v-text-field>
            <label class="label mt-3">{{
              $t('signUp.username_textfield_label')
            }}</label>
            <v-text-field
              v-model="newUser.username"
              :rules="[rules.required]"
              class="username"
              variant="outlined"
              density="compact"
              prepend-inner-icon="mdi-account-outline"
              rounded
              type="text"
              style="margin-bottom: -16px"
              bg-color="white"
            >
            </v-text-field>

            <label class="label mt-3">{{
              $t('signUp.password_textfield_label')
            }}</label>
            <v-text-field
              v-model="newUser.password"
              :rules="[
                passwordRules.required,
                passwordRules.length,
                passwordRules.capitalLetters,
                passwordRules.lowerCaseLetters,
                passwordRules.numbers,
                passwordRules.specialCharacter,
                passwordRules.noSpace,
              ]"
              class="password"
              variant="outlined"
              density="compact"
              prepend-inner-icon="mdi-lock-outline"
              rounded
              bg-color="white"
              style="margin-bottom: -16px"
              :type="show2 ? 'text' : 'password'"
              :append-inner-icon="!show2 ? 'mdi-eye' : 'mdi-eye-off'"
              @click:append-inner="show2 = !show2"
            >
            </v-text-field>

            <label class="label mt-3">{{
              $t('signUp.password_confirmation_textfield_label')
            }}</label>
            <v-text-field
              v-model="newUser.passwordConfirmation"
              :rules="[
                passwordConfirmationRules.required,
                passwordConfirmationRules.match,
              ]"
              class="password"
              variant="outlined"
              density="compact"
              prepend-inner-icon="mdi-lock-outline"
              rounded
              bg-color="white"
              :type="show3 ? 'text' : 'password'"
              :append-inner-icon="!show3 ? 'mdi-eye' : 'mdi-eye-off'"
              @click:append-inner="show3 = !show3"
            >
            </v-text-field>
          </div>
        </v-form>
      </v-card-text>
      <v-card-actions>
        <v-col flex>
          <v-row justify="center" v-if="isAzureAuth">
            <MButton
              :label="$t('logIn.azure_button')"
              color="#0078d4"
              rounded="xl"
              :variant="'flat'"
              style="margin-top: -32px; margin-bottom: 16px"
              @click="submitLogIn()"
            >

            </MButton>
          </v-row>

          <v-row justify="center" v-else-if="isCognitoAuth">
            <MButton
              :label="$t('logIn.cognito_button')"
              color="#FF9900"
              rounded="xl"
              :variant="'flat'"
              style="margin-top: -32px; margin-bottom: 16px"
              @click="submitLogIn()"
            >
            </MButton>
          </v-row>

          <v-row justify="center" v-else>
            <MButton
              :label="$t('logIn.button_label')"
              color="#0460bf"
              rounded="xl"
              :variant="'flat'"
              style="margin-top: -32px; margin-bottom: 16px"
              @click="submitLogIn()"
            />
          </v-row>

          <v-row justify="center" v-if="enableSignUp && isCornflowAuth">
            <span style="color: gray"
              >{{ $t('logIn.question') }}
              <a
                href="#"
                data-test="signup-link"
                @click="signUpMode = true"
                style="color: inherit; font-weight: inherit"
                >{{ $t('logIn.alternative') }}</a
              >
            </span>
          </v-row>
        </v-col>
      </v-card-actions>
    </v-card>
  </div>
  <footer
    style="
      text-align: center;
      font-size: smaller;
      font-weight: lighter;
      background-color: var(--primary-light-variant);
    "
  >
    Powered by
    <a
      href="https://baobabsoluciones.es/"
      style="
        color: inherit;
        text-decoration: none;
        font-weight: bolder;
        background: none;
      "
      >Baobab Soluciones</a
    >
  </footer>
</template>
<script>
import { inject } from 'vue'
import { useGeneralStore } from '@/stores/general'
import auth from '@/services/AuthServiceFactory'
import config from '@/config'

export default {
  data() {
    return {
      signUpMode: false,
      show1: false,
      show2: false,
      show3: false,
      showSnackbar: null,
      store: useGeneralStore(),
      password: '',
      username: '',
      newUser: {
        username: '',
        email: '',
        password: '',
        passwordConfirmation: '',
      },
      rules: {
        required: (value) => !!value || this.$t('rules.required'),
      },
      emailRules: {
        required: (value) => value !== undefined || this.$t('rules.required'),
        format: (value) =>
          /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(.\w{2,3})+$/.test(value) ||
          this.$t('rules.valid_email'),
      },
      passwordRules: {
        required: (value) => value !== undefined || this.$t('rules.required'),
        length: (value) =>
          value.length >= 8 ||
          this.$t('rules.password_length', { length: '8' }),
        capitalLetters: (value) =>
          value.split('').filter((letter) => /[A-Z]/.test(letter)).length > 0 ||
          this.$t('rules.password_capital_letters'),
        lowerCaseLetters: (value) =>
          value.split('').filter((letter) => /[a-z]/.test(letter)).length > 0 ||
          this.$t('rules.password_lower_case_letters'),
        numbers: (value) =>
          value.split('').filter((letter) => /[0-9]/.test(letter)).length > 0 ||
          this.$t('rules.password_numbers'),
        specialCharacter: (value) =>
          value
            .split('')
            .filter((letter) =>
              /[!?@#$%^&*)(+=.<>{}[\],/¿¡:;'|~`_-]/.test(letter),
            ).length > 0 || this.$t('rules.password_special_characters'),
        noSpace: (value) =>
          value.split('').filter((letter) => letter === ' ').length === 0 ||
          this.$t('rules.password_no_space'),
      },
      passwordConfirmationRules: {
        required: (value) => value !== undefined || this.$t('rules.required'),
        match: (value) =>
          value === this.newUser.password || this.$t('rules.password_match'),
      },
    }
  },
  created() {
    this.showSnackbar = inject('showSnackbar')
  },
  computed: {
    enableSignUp() {
      return this.store.appConfig.parameters.enableSignup
    },
    isAzureAuth() {
      return config.auth.type === 'azure'
    },
    isCognitoAuth() {
      return config.auth.type === 'cognito'
    },
    isCornflowAuth() {
      return config.auth.type === 'cornflow'
    }
  },
  methods: {
    async submitLogIn() {
      try {
        let isAuthenticated;
        
        if (!this.isCornflowAuth) {
          isAuthenticated = await auth.login()
        } else {
          isAuthenticated = await auth.login(this.username, this.password)
        }

        if (isAuthenticated) {
          this.$router.push('/')
          this.showSnackbar(this.$t('logIn.snackbar_message_success'), 'success')
        } else {
          this.showSnackbar(this.$t('logIn.snackbar_message_error'), 'error')
        }
      } catch (error) {
        console.error('Login error:', error)
        this.showSnackbar(this.$t('logIn.snackbar_message_error'), 'error')
      }
    },
    async submitSignUp() {
      if (!this.enableSignUp) {
        return
      }
      const isRegistered = await auth.signup(
        this.newUser.email,
        this.newUser.username,
        this.newUser.password,
      )
      if (isRegistered) {
        this.showSnackbar(this.$t('signUp.snackbar_message_success'), 'success')
        this.signUpMode = false
      } else {
        this.showSnackbar(this.$t('signUp.snackbar_message_error'), 'error')
      }
    },
  },
}
</script>
<style>
.align-center {
  display: flex;
  align-items: center;
}
.justify-center {
  justify-content: center;
}
.text-center {
  text-align: center;
}
</style>
