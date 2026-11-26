<!--
  SignInForm: the sign-in form of the sign-in page, which both layouts use. It goes through the
  steps of useSignIn:

  - Username and password, a link to recover the password, and below them single sign-on with
    Microsoft and Google.
  - The two-factor code, when the user has two-factor authentication.
  - The two-factor enrollment, when the deployment requires it and the user has none yet: a QR code
    for the authenticator app, its secret to type it in, and the first code.
  - The backup codes of the enrollment, shown this once.
  - The e-mail to send a password reset link to.

  `compact` shows the providers side by side with their name only ("Microsoft"); otherwise one per
  row, "Continue with Microsoft".

  <SignInForm compact />
-->
<template>
  <div class="sign-in-form" :data-step="step">
    <template v-if="step === 'credentials'">
      <form class="sign-in-form__fields" novalidate @submit.prevent="submit">
        <label class="sign-in-form__field">
          <span class="sign-in-form__label">{{ $t('logIn.username_textfield_label') }}</span>
          <CoreTextField
            v-model="username"
            size="large"
            name="username"
            autocomplete="username"
            :invalid="missingUsername"
            data-testid="sign-in-username"
          />
          <span v-if="missingUsername" class="sign-in-form__error">{{ $t('rules.required') }}</span>
        </label>

        <label class="sign-in-form__field">
          <span class="sign-in-form__label">{{ $t('logIn.password_textfield_label') }}</span>
          <CoreTextField
            v-model="password"
            size="large"
            :type="showPassword ? 'text' : 'password'"
            name="password"
            autocomplete="current-password"
            :invalid="missingPassword"
            data-testid="sign-in-password"
          >
            <template #append>
              <CoreButton
                variant="icon"
                size="small"
                data-testid="sign-in-show-password"
                :icon="showPassword ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
                :aria-label="showPassword ? $t('logIn.hide_password') : $t('logIn.show_password')"
                :title="showPassword ? $t('logIn.hide_password') : $t('logIn.show_password')"
                :aria-pressed="showPassword"
                @click="showPassword = !showPassword"
              />
            </template>
          </CoreTextField>
          <span v-if="missingPassword" class="sign-in-form__error">{{ $t('rules.required') }}</span>
        </label>

        <button
          type="button"
          class="sign-in-form__link"
          data-testid="sign-in-forgot"
          @click="showForgot"
        >
          {{ $t('logIn.forgot_password_link') }}
        </button>

        <CoreButton
          type="submit"
          size="large"
          block
          class="sign-in-form__submit"
          :text="$t('logIn.button_label')"
          :loading="submitting"
          data-testid="sign-in-submit"
        />
      </form>

      <div class="sign-in-form__divider" role="separator">{{ $t('logIn.or_divider') }}</div>
      <div class="sign-in-form__providers" :class="{ 'is-compact': compact }">
        <button
          v-for="provider in providers"
          :key="provider.key"
          type="button"
          class="sign-in-form__provider"
          :data-testid="`sign-in-${provider.key}`"
          @click="signInWith(provider.key)"
        >
          <img :src="provider.logo" alt="" />
          <span>{{ compact ? provider.name : $t(`logIn.${provider.key}_button`) }}</span>
        </button>
      </div>

      <p class="sign-in-form__legal" data-testid="sign-in-legal-notice">{{ $t('logIn.legal_notice') }}</p>
    </template>

    <form
      v-else-if="step === 'mfa-code'"
      class="sign-in-form__fields"
      novalidate
      @submit.prevent="submit"
    >
      <header class="sign-in-form__step-head">
        <h3 class="sign-in-form__step-title">{{ $t('logIn.mfa_code_title') }}</h3>
        <p class="sign-in-form__hint">{{ $t('logIn.mfa_code_hint') }}</p>
      </header>
      <label class="sign-in-form__field">
        <span class="sign-in-form__label">{{ $t('logIn.mfa_code_label') }}</span>
        <CoreTextField
          v-model="totpCode"
          size="large"
          name="totp"
          autocomplete="one-time-code"
          inputmode="numeric"
          :invalid="missingCode"
          data-testid="sign-in-mfa-code"
        />
        <span v-if="missingCode" class="sign-in-form__error">{{ $t('rules.required') }}</span>
      </label>
      <CoreButton
        type="submit"
        size="large"
        block
        :text="$t('logIn.mfa_verify_button')"
        :loading="submitting"
        data-testid="sign-in-mfa-submit"
      />
      <CoreButton
        variant="text"
        block
        :text="$t('logIn.back_button')"
        data-testid="sign-in-back"
        @click="backToCredentials"
      />
    </form>

    <form
      v-else-if="step === 'mfa-enroll'"
      class="sign-in-form__fields"
      novalidate
      @submit.prevent="verifyEnrollment"
    >
      <header class="sign-in-form__step-head">
        <h3 class="sign-in-form__step-title">{{ $t('logIn.mfa_enroll_title') }}</h3>
        <p class="sign-in-form__hint">{{ $t('logIn.mfa_enroll_hint') }}</p>
      </header>
      <img
        v-if="enrollQr"
        class="sign-in-form__qr"
        :src="enrollQr"
        :alt="$t('logIn.mfa_enroll_qr')"
        data-testid="sign-in-mfa-qr"
      />
      <p v-if="enrollSecret" class="sign-in-form__hint">
        {{ $t('logIn.mfa_enroll_secret') }}
        <code class="sign-in-form__code" data-testid="sign-in-mfa-secret">{{ enrollSecret }}</code>
      </p>
      <label class="sign-in-form__field">
        <span class="sign-in-form__label">{{ $t('logIn.mfa_code_label') }}</span>
        <CoreTextField
          v-model="totpCode"
          size="large"
          name="totp"
          autocomplete="one-time-code"
          inputmode="numeric"
          :invalid="missingCode"
          data-testid="sign-in-mfa-enroll-code"
        />
        <span v-if="missingCode" class="sign-in-form__error">{{ $t('rules.required') }}</span>
      </label>
      <CoreButton
        type="submit"
        size="large"
        block
        :text="$t('logIn.mfa_verify_button')"
        :loading="submitting"
        data-testid="sign-in-mfa-enroll-submit"
      />
      <CoreButton
        variant="text"
        block
        :text="$t('logIn.back_button')"
        data-testid="sign-in-back"
        @click="backToCredentials"
      />
    </form>

    <div v-else-if="step === 'mfa-backup'" class="sign-in-form__fields">
      <header class="sign-in-form__step-head">
        <h3 class="sign-in-form__step-title">{{ $t('logIn.mfa_backup_title') }}</h3>
        <p class="sign-in-form__hint">{{ $t('logIn.mfa_backup_hint') }}</p>
      </header>
      <ul class="sign-in-form__backup-codes" data-testid="sign-in-backup-codes">
        <li v-for="code in backupCodes" :key="code"><code class="sign-in-form__code">{{ code }}</code></li>
      </ul>
      <CoreButton
        variant="outlined"
        block
        icon="mdi-content-copy"
        :text="$t('logIn.mfa_backup_copy')"
        data-testid="sign-in-backup-copy"
        @click="copyBackupCodes"
      />
      <CoreButton
        size="large"
        block
        :text="$t('logIn.mfa_backup_continue')"
        data-testid="sign-in-backup-continue"
        @click="finishEnrollment"
      />
    </div>

    <form
      v-else-if="step === 'forgot'"
      class="sign-in-form__fields"
      novalidate
      @submit.prevent="requestPasswordReset"
    >
      <header class="sign-in-form__step-head">
        <h3 class="sign-in-form__step-title">{{ $t('logIn.forgot_title') }}</h3>
        <p class="sign-in-form__hint">{{ $t('logIn.forgot_hint') }}</p>
      </header>
      <label class="sign-in-form__field">
        <span class="sign-in-form__label">{{ $t('logIn.forgot_email_label') }}</span>
        <CoreTextField
          v-model="forgotEmail"
          size="large"
          type="email"
          name="email"
          autocomplete="email"
          :invalid="missingEmail"
          data-testid="sign-in-forgot-email"
        />
        <span v-if="missingEmail" class="sign-in-form__error">{{ $t('rules.required') }}</span>
      </label>
      <CoreButton
        type="submit"
        size="large"
        block
        :text="$t('logIn.forgot_submit')"
        :loading="submitting"
        data-testid="sign-in-forgot-submit"
      />
      <CoreButton
        variant="text"
        block
        :text="$t('logIn.back_button')"
        data-testid="sign-in-back"
        @click="backToCredentials"
      />
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import CoreButton from '@cornflow-ui/core/components/core/CoreButton.vue'
import CoreTextField from '@cornflow-ui/core/components/core/CoreTextField.vue'
import { useSignIn } from '@cornflow-ui/core/composables/sign-in/useSignIn'

defineOptions({ name: 'SignInForm' })

withDefaults(defineProps<{ compact?: boolean }>(), { compact: false })

const {
  step,
  username,
  password,
  totpCode,
  forgotEmail,
  enrollSecret,
  enrollQr,
  backupCodes,
  submitting,
  missingUsername,
  missingPassword,
  missingCode,
  missingEmail,
  providers,
  submit,
  verifyEnrollment,
  copyBackupCodes,
  finishEnrollment,
  requestPasswordReset,
  showForgot,
  backToCredentials,
  signInWith,
} = useSignIn()

const showPassword = ref(false)
</script>

<style scoped>
.sign-in-form {
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 7);
  font-family: var(--font-sans);
  color: var(--color-text);
}

.sign-in-form__fields {
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 4);
}

.sign-in-form__field {
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 1.5);
}

.sign-in-form__label {
  font-size: var(--text-md);
  font-weight: var(--font-weight-medium);
}

.sign-in-form__error {
  font-size: var(--text-sm);
  color: var(--color-danger);
}

.sign-in-form__link {
  align-self: flex-end;
  margin-top: calc(var(--spacing) * -2);
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  font-size: var(--text-sm);
  color: var(--color-primary);
  cursor: pointer;
}

.sign-in-form__link:hover {
  text-decoration: underline;
}

.sign-in-form__submit {
  margin-top: calc(var(--spacing) * 1);
}

.sign-in-form__divider {
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 3);
  font-size: var(--text-sm);
  color: var(--color-text-subtle);
}

.sign-in-form__divider::before,
.sign-in-form__divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--color-divider);
}

.sign-in-form__providers {
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 2.5);
}

.sign-in-form__providers.is-compact {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(0, 1fr));
  gap: calc(var(--spacing) * 3);
}

.sign-in-form__provider {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: calc(var(--spacing) * 2.5);
  height: 44px;
  border: 1px solid var(--color-border-input);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  font: inherit;
  font-size: var(--text-base);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
  cursor: pointer;
}

.sign-in-form__provider:hover {
  border-color: var(--color-border-strong);
  background: var(--color-surface-hover);
}

.sign-in-form__provider img {
  width: 18px;
  height: 18px;
  object-fit: contain;
}

.sign-in-form__legal {
  margin: 0;
  font-size: var(--text-xs);
  line-height: 1.5;
  color: var(--color-text-subtle);
  text-wrap: pretty;
}

.sign-in-form__step-head {
  display: flex;
  flex-direction: column;
  gap: calc(var(--spacing) * 1.5);
}

.sign-in-form__step-title {
  margin: 0;
  font-size: var(--text-lg);
  font-weight: var(--font-weight-medium);
}

.sign-in-form__hint {
  margin: 0;
  font-size: var(--text-md);
  line-height: 1.5;
  color: var(--color-text-muted);
  text-wrap: pretty;
}

/* The QR code keeps its white quiet zone in dark mode, or authenticator apps cannot read it. */
.sign-in-form__qr {
  align-self: center;
  width: 200px;
  height: 200px;
  padding: calc(var(--spacing) * 2);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-md);
  background: #fff;
}

.sign-in-form__code {
  font-family: var(--font-mono);
  font-size: var(--text-md);
  word-break: break-all;
  color: var(--color-text);
}

.sign-in-form__backup-codes {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: calc(var(--spacing) * 2);
  margin: 0;
  padding: calc(var(--spacing) * 4);
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
  list-style: none;
  text-align: center;
}
</style>
