import { createI18n } from 'vue-i18n'
import { ref, computed } from 'vue'
import {
  languages,
  isRegisteredLanguage,
  FALLBACK_LANGUAGE,
} from './languages'

// Default language - will be overridden by config
let defaultLanguage = FALLBACK_LANGUAGE

// Reactive locale state
export const currentLocale = ref<string>(defaultLanguage)

// Unregistered codes fall back to English with a warning.
function resolveLanguage(language: string): string {
  if (isRegisteredLanguage(language)) return language
  console.warn(
    `[i18n] Language '${language}' is not registered; falling back to '${FALLBACK_LANGUAGE}'.`,
  )
  return FALLBACK_LANGUAGE
}

// Function to update the default language from config
export function setDefaultLanguage(language: string) {
  const resolved = resolveLanguage(language)
  defaultLanguage = resolved
  currentLocale.value = resolved
  if (i18n.global) {
    i18n.global.locale.value = resolved as any
  }
}

// Function to change language dynamically
export function changeLanguage(language: string) {
  const resolved = resolveLanguage(language)
  currentLocale.value = resolved
  if (i18n.global) {
    i18n.global.locale.value = resolved as any
  }
}

// Computed property to get current locale reactively
export const locale = computed(() => currentLocale.value)

// Core + app messages are merged at build time in the language registry (see languages.ts).
// Premium modules (enterprise) inject their locale messages AFTER module registration via
// `applyPremiumLocales` (see plugins/index.ts), so this stays free of any premium/registry dependency.
export const i18n = createI18n({
  locale: defaultLanguage, // set locale (will be updated later)
  fallbackLocale: FALLBACK_LANGUAGE, // missing keys in any language are shown in English
  legacy: false,
  // Cast to `any` to avoid inferring the (huge) message schema: this way `t` accepts string keys and
  // TS2589 ("type instantiation excessively deep") is avoided in heavy contexts (stores, arrays).
  messages: Object.fromEntries(
    languages.map((lang) => [lang.code, lang.messages]),
  ) as any,
})

export default i18n
