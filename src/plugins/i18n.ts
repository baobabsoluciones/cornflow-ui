import { createI18n } from 'vue-i18n'
import en from './locales/en.ts'
import fr from './locales/fr.ts'
import es from './locales/es.ts'

export const i18n = createI18n({
  locale: 'en', // set locale
  fallbackLocale: 'en', // set fallback locale
  legacy: false,
  messages: {
    // set locale messages
    en,
    fr,
    es,
  },
})

export default i18n
