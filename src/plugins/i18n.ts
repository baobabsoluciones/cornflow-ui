import { createI18n } from 'vue-i18n'
import en from './locales/en.ts'
import fr from './locales/fr.ts'
import es from './locales/es.ts'
import enApp from '../app/plugins/locales/en.ts'
import frApp from '../app/plugins/locales/fr.ts'
import esApp from '../app/plugins/locales/es.ts'

// Default language - will be overridden by config
let defaultLanguage = 'en'

// Function to update the default language from config
export function setDefaultLanguage(language: 'en' | 'es' | 'fr') {
  defaultLanguage = language
  if (i18n.global) {
    i18n.global.locale.value = language as any
  }
}

export const i18n = createI18n({
  locale: defaultLanguage, // set locale (will be updated later)
  fallbackLocale: 'en', // set fallback locale
  legacy: false,
  messages: {
    // set locale messages
    en: { ...en, ...enApp },
    fr: { ...fr, ...frApp },
    es: { ...es, ...esApp },
  },
})

export default i18n
