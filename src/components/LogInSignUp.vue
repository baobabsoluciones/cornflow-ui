<template>
  <div class="d-flex justify-center align-center" style="height: 100vh; background-color: #FFFDE7;">
    <v-card flat width="25%" style="background-color: #FFFDE7;" >
      <v-card-title>
        <v-col>
          <v-img
          contain
          src="@\app\assets\logo\full_logo.png"
          height="48px"/>
        </v-col>
      </v-card-title>
      <divider/>
      <v-card-subtitle v-if="!signUpMode">
        {{ $t('logIn.subtitle') }}
      </v-card-subtitle>
      <v-card-subtitle v-else>
        {{ $t('signUp.subtitle') }}
      </v-card-subtitle>
      <divider/>

      <v-card-text>
        <v-form v-if="!signUpMode">
          <div class="form-content">
            <label class="label">{{ $t('logIn.username_textfield_label') }}</label>
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
                bg-color="#FFFEEF"
                @keydown.enter.prevent="submitLogIn()"
              >
              </v-text-field>

              <label class="label">{{ $t('logIn.password_textfield_label') }}</label>
              <v-text-field
                v-model ="password"
                :rules="[rules.required]"
                class="password"
                variant="outlined"
                density="compact"
                prepend-inner-icon="mdi-lock-outline"
                single-line
                rounded
                bg-color="#FFFEEF"
                :type="show1 ? 'text' : 'password'"
                :append-inner-icon="!show1 ? 'mdi-eye' : 'mdi-eye-off'"
                @click:append-inner="show1 = !show1"
                @keydown.enter.prevent="submitLogIn()"
              >
              </v-text-field>
        </div>
        </v-form>
        <v-form v-else>
          <div class="form-content">
            <label class="label">{{ $t('signUp.email_textfield_label') }}</label>
              <v-text-field
                v-model="newUser.email"
                :rules="[emailRules.required, emailRules.format]"
                class="email"
                variant="outlined"
                density="compact"
                prepend-inner-icon="mdi-email-outline"
                single-line
                rounded
                type="text"
                style="margin-bottom: -16px"
                bg-color="#FFFEEF"
              >
              </v-text-field>
            <label class="label">{{ $t('signUp.username_textfield_label') }}</label>
              <v-text-field
                v-model="newUser.username"
                :rules="[rules.required]"
                class="username"
                variant="outlined"
                density="compact"
                prepend-inner-icon="mdi-account-outline"
                single-line
                rounded
                type="text"
                style="margin-bottom: -16px"
                bg-color="#FFFEEF"
              >
              </v-text-field>

              <label class="label">{{ $t('signUp.password_textfield_label') }}</label>
              <v-text-field
                v-model="newUser.password"
                :rules="[passwordRules.required, passwordRules.length, passwordRules.capitalLetters, passwordRules.lowerCaseLetters, passwordRules.numbers, passwordRules.specialCharacter, passwordRules.noSpace]"
                class="password"
                variant="outlined"
                density="compact"
                prepend-inner-icon="mdi-lock-outline"
                single-line
                rounded
                bg-color="#FFFEEF"
                style="margin-bottom: -16px"
                :type="show2 ? 'text' : 'password'"
                :append-inner-icon="!show2 ? 'mdi-eye' : 'mdi-eye-off'"
                @click:append-inner="show2 = !show2"
              >
              </v-text-field>

              <label class="label">{{ $t('signUp.password_confirmation_textfield_label') }}</label>
              <v-text-field
                v-model="newUser.passwordConfirmation"
                :rules="[passwordConfirmationRules.required, passwordConfirmationRules.match]"
                class="password"
                variant="outlined"
                density="compact"
                prepend-inner-icon="mdi-lock-outline"
                single-line
                rounded
                bg-color="#FFFEEF"
                :type="show3 ? 'text' : 'password'"
                :append-inner-icon="!show3 ? 'mdi-eye' : 'mdi-eye-off'"
                @click:append-inner="show3 = !show3"
              >
              </v-text-field>
        </div>
        </v-form>
      </v-card-text>
      <v-card-actions>
        <v-col flex v-if="!signUpMode">
          <v-row justify="center">
            <MButton
                :label="$t('logIn.button_label')"
                color="#0460bf"
                rounded="xl"
                :variant="'flat'"
                style="margin-top: -32px; margin-bottom: 16px"
                @click="submitLogIn()"
              />
          </v-row>
          <v-row justify="center" >
            <span style="color: gray;">{{ $t('logIn.question') }} 
              <a
              href="#"
              @click="signUpMode = true"
              style="color: inherit; font-weight: inherit;"
              >{{ $t('logIn.alternative') }}</a>
            </span>
          </v-row>
        </v-col>
        <v-col v-else>
          <v-row justify="center">
            <MButton
              :label="$t('signUp.button_label')"
              color="#0460bf"
              rounded="xl"
              :variant="'flat'"
              style="margin-top: -32px; margin-bottom: 16px"
              @click="submitSignUp()"
            />
          </v-row>
          <v-row justify="center">
            <span style="color: gray;">{{ $t('signUp.question') }}
              <a
              href="#"
              @click="signUpMode = false"
              style="color: inherit; font-weight: inherit;">
              {{ $t('signUp.alternative') }}
              </a>
            </span>
          </v-row>
        </v-col>
      </v-card-actions>
    </v-card> 
  </div>
  <footer style="text-align: center; font-size: smaller; font-weight: lighter; background-color: #FFFDE7">
    Powered by <a href="https://baobabsoluciones.es/" style="color: inherit; text-decoration: none; font-weight: bolder; background: none;">Baobab Soluciones</a>
  </footer>
</template>
<script>
import AuthService from '@/services/AuthService'
import { inject } from 'vue'

export default {
  data () {
    return {
      signUpMode: false,
      show1: false,
      show2: false,
      show3: false,
      showSnackbar: null,
      password: '',
      username: '',
      newUser: {
        username: '',
        email: '',
        password: '',
        passwordConfirmation: '',
      },
      rules: {
        required: (value) => !!value ||  this.$t('rules.required'),
      },
      emailRules: {
        required: value => value !== undefined || this.$t('rules.required'),
        format: value => /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(.\w{2,3})+$/.test(value) || this.$t('rules.valid_email'),
      },
      passwordRules: {
        required: value => value !== undefined || this.$t('rules.required'),
        length: value => value.length >= 8 || this.$t('rules.password_length', { length: '8' }),
        capitalLetters: value => value.split('').filter(letter => /[A-Z]/.test(letter)).length > 0 || this.$t('rules.password_capital_letters'),
        lowerCaseLetters: value => value.split('').filter(letter => /[a-z]/.test(letter)).length > 0 || this.$t('rules.password_lower_case_letters'),
        numbers: value => value.split('').filter(letter => /[0-9]/.test(letter)).length > 0 || this.$t('rules.password_numbers'),
        specialCharacter: value => value.split('').filter(letter => /[!?@#$%^&*)(+=.<>{}[\],/¿¡:;'|~`_-]/.test(letter)).length > 0 || this.$t('rules.password_special_characters'),
        noSpace: value => value.split('').filter(letter => letter === ' ').length === 0 || this.$t('rules.password_no_space'),
      },
      passwordConfirmationRules: {
        required: value => value !== undefined || this.$t('rules.required'),
        match: value => value === this.newUser.password || this.$t('rules.password_match'),
      },
    }
  },
  created() {
    this.showSnackbar = inject('showSnackbar')
  },
  methods: {
    async submitLogIn() {
      const isAuthenticated = await AuthService.login(
        this.username,
        this.password,
      )
      if (isAuthenticated) {
        this.$router.push('/')
        this.showSnackbar(this.$t('logIn.snackbar_message_success'), 'success')
      } else {
        this.showSnackbar(this.$t('logIn.snackbar_message_error'), 'error')
      }
    },
    async submitSignUp() {
      const isRegistered = await AuthService.signup(
        this.newUser.email,
        this.newUser.username,
        this.newUser.password,
      )
      if (isRegistered) {
        this.showSnackbar( this.$t('signUp.snackbar_message_success'), 'success')
        this.signUpMode = false;
      } else {
        this.showSnackbar(this.$t('signUp.snackbar_message_error'), 'error')
      }
    }
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
</style>