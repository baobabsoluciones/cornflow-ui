/** An i18n with the core's English texts, for the data-table specs. */
import { createI18n } from 'vue-i18n'
import en from '@cornflow-ui/core/plugins/locales/en'

export const createEnI18n = () =>
  createI18n({
    legacy: false,
    locale: 'en',
    missingWarn: false,
    fallbackWarn: false,
    messages: { en },
  })
