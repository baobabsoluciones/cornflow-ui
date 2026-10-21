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

/** Vuetify theme colours that follow a design token (`src/assets/styles/tokens.css`). */
const THEME_COLOR_TOKENS: Record<string, string> = {
  primary: '--color-primary',
}

const HEX_COLOR = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i

/** Resolved value of a CSS custom property on `element` (by default `body`, where tokens live). */
export function readCssToken(name: string, element: Element = document.body): string {
  return getComputedStyle(element).getPropertyValue(name).trim()
}

// https://vuetifyjs.com/en/introduction/why-vuetify/#feature-guides
const vuetify = createVuetify({
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
          // Replaced by the app's `--color-primary` when the app starts (`applyTokensToTheme`).
          primary: '#1b5e8a',
          secondary: '#5CBBF6',
        },
      },
    },
  },
})

/**
 * Sets the theme colours listed in `THEME_COLOR_TOKENS` to the app's tokens, so Vuetify components
 * (`color="primary"`) paint with the same colour as the core's own components. Runs once the app's
 * stylesheets are loaded; a token that is unset or not a hex colour leaves the theme colour as it is.
 */
export function applyTokensToTheme(
  theme = vuetify.theme,
  read: (name: string) => string = readCssToken,
): void {
  const colors = theme.themes.value.light.colors
  for (const [color, token] of Object.entries(THEME_COLOR_TOKENS)) {
    const value = read(token)
    if (!value) continue
    if (!HEX_COLOR.test(value)) {
      console.warn(`${token} is not a hex colour (${value}): the theme keeps ${colors[color]}`)
      continue
    }
    colors[color] = value
  }
}

export default vuetify
