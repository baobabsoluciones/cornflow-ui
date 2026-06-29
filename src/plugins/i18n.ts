import { createI18n } from 'vue-i18n'
import { ref, computed } from 'vue'
import en from './locales/en.ts'
import fr from './locales/fr.ts'
import es from './locales/es.ts'
import enApp from '../app/plugins/locales/en.ts'
import frApp from '../app/plugins/locales/fr.ts'
import esApp from '../app/plugins/locales/es.ts'

// Default language - will be overridden by config
let defaultLanguage = 'en'

// Reactive locale state
export const currentLocale = ref<string>(defaultLanguage)

function deepMerge(
  base: Record<string, any>,
  override: Record<string, any>,
): Record<string, any> {
  const result = { ...base }
  for (const key of Object.keys(override)) {
    if (
      override[key] !== null &&
      typeof override[key] === 'object' &&
      !Array.isArray(override[key]) &&
      typeof base[key] === 'object' &&
      base[key] !== null &&
      !Array.isArray(base[key])
    ) {
      result[key] = deepMerge(base[key], override[key])
    } else {
      result[key] = override[key]
    }
  }
  return result
}

// Function to update the default language from config
export function setDefaultLanguage(language: 'en' | 'es' | 'fr') {
  defaultLanguage = language
  currentLocale.value = language
  if (i18n.global) {
    i18n.global.locale.value = language as any
  }
}

// Function to change language dynamically
export function changeLanguage(language: 'en' | 'es' | 'fr') {
  currentLocale.value = language
  if (i18n.global) {
    i18n.global.locale.value = language as any
  }
}

// Computed property to get current locale reactively
export const locale = computed(() => currentLocale.value)

// Core + app messages are merged at build time. Premium modules (enterprise) inject their
// locale messages AFTER module registration via `applyPremiumLocales` (see plugins/index.ts),
// so this stays free of any premium/registry dependency.
export const i18n = createI18n({
  locale: defaultLanguage, // set locale (will be updated later)
  fallbackLocale: 'en', // set fallback locale
  legacy: false,
  messages: {
    // set locale messages
    en: deepMerge(en, enApp),
    fr: deepMerge(fr, frApp),
    es: deepMerge(es, esApp),
  },
})

export default i18n
