<!--
  SignInForm: the username and password form of the sign-in page, and below it single sign-on
  with Microsoft and Google. Both sign-in layouts use it.

  `compact` shows the providers side by side with their name only ("Microsoft"); otherwise one per
  row, "Continue with Microsoft".

  <SignInForm compact />
-->
<template>
  <div class="sign-in-form">
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
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import CoreButton from '@cornflow-ui/core/components/core/CoreButton.vue'
import CoreTextField from '@cornflow-ui/core/components/core/CoreTextField.vue'
import { useSignIn } from '@cornflow-ui/core/composables/sign-in/useSignIn'

defineOptions({ name: 'SignInForm' })

withDefaults(defineProps<{ compact?: boolean }>(), { compact: false })

const { username, password, submitting, missingUsername, missingPassword, providers, submit, signInWith } =
  useSignIn()

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
</style>
