import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { createI18n } from 'vue-i18n'

/**
 * Shared test harness for the dashboard presentational components.
 * Provides a Vuetify instance (with all components/directives registered so
 * v-card/v-select/etc. resolve) plus an i18n stub whose t() echoes the key.
 */
export const vuetify = createVuetify({ components, directives })
export const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: {} } })

export const mountDashboard = (
  component: any,
  options: Record<string, any> = {},
) => {
  const { global: globalOpts = {}, ...rest } = options
  return mount(component, {
    ...rest,
    global: {
      plugins: [vuetify, i18n],
      ...globalOpts,
    },
  })
}
