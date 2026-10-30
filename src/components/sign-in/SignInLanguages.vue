<!--
  SignInLanguages: the languages of the sign-in page ("ES · EN"), the current one marked. They are
  the ones the app shows in its settings (`languages` in its config); with a single one, nothing.

  <SignInLanguages />
-->
<template>
  <div v-if="languages.length > 1" class="sign-in-languages" role="group" :aria-label="$t('logIn.language')">
    <button
      v-for="language in languages"
      :key="language.code"
      type="button"
      class="sign-in-languages__option"
      :class="{ 'is-current': language.code === current }"
      :aria-pressed="language.code === current"
      :title="$t(language.labelKey)"
      :data-testid="`sign-in-language-${language.code}`"
      @click="changeLanguage(language.code)"
    >
      {{ language.code.toUpperCase() }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import appConfig from '@/app/config'
import { changeLanguage, locale } from '@cornflow-ui/core/plugins/i18n'
import { readConfiguredLanguages, resolveVisibleLanguages } from '@cornflow-ui/core/plugins/languages'

defineOptions({ name: 'SignInLanguages' })

const languages = resolveVisibleLanguages(readConfiguredLanguages(appConfig))
const current = computed(() => locale.value)
</script>

<style scoped>
.sign-in-languages {
  display: flex;
  align-items: center;
}

.sign-in-languages__option {
  padding: 2px 4px;
  border: 0;
  border-radius: var(--radius-sm);
  background: none;
  font: inherit;
  color: inherit;
  cursor: pointer;
}

.sign-in-languages__option + .sign-in-languages__option::before {
  content: '·';
  margin-right: calc(var(--spacing) * 2);
  color: var(--color-text-subtle);
}

.sign-in-languages__option:hover {
  color: var(--color-text);
}

.sign-in-languages__option.is-current {
  font-weight: var(--font-weight-bold);
  color: var(--color-text);
}
</style>
