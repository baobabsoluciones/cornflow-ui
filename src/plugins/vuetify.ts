/**
 * plugins/vuetify.ts
 *
 * Framework documentation: https://vuetifyjs.com`
 */

// Styles
import '@mdi/font/css/materialdesignicons.css'
import 'vuetify/styles'

// Composables
import { createVuetify } from 'vuetify'
import * as labs from 'vuetify/labs/components'
import { createVueI18nAdapter } from 'vuetify/locale/adapters/vue-i18n'
import { useI18n } from 'vue-i18n'
import { i18n } from './i18n'
import { CORE_LANGUAGES } from './languages'

// https://vuetifyjs.com/en/introduction/why-vuetify/#feature-guides
export default createVuetify({
  components: {
    ...labs,
  },
  locale: {
    adapter: createVueI18nAdapter({ i18n, useI18n }),
  },
  // Map vue-i18n locales to BCP-47 codes used by the date adapter.
  // Without this, Vuetify's date components default to en-US (MM/DD/YYYY).
  // Taken from the core language registry (`dateLocale` of each language).
  date: {
    locale: Object.fromEntries(
      CORE_LANGUAGES.map((l) => [l.code, l.dateLocale]),
    ),
  },
  theme: {
    themes: {
      light: {
        colors: {
          primary: '#213c52',
          secondary: '#5CBBF6',
        },
      },
    },
  },
})
