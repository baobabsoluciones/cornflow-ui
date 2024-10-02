import { createI18n } from 'vue-i18n'
import en from './locales/en.ts'
import fr from './locales/fr.ts'
import es from './locales/es.ts'
import enApp from '../app/plugins/locales/en.ts'
import frApp from '../app/plugins/locales/fr.ts'
import esApp from '../app/plugins/locales/es.ts'

export const i18n = createI18n({
  locale: 'en', // set locale
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
