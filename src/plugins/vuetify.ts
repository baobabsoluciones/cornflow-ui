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

/**
 * Resolved value of a CSS custom property on `element` (by default `body`, where tokens live). A
 * colour written otherwise than in hex (a `color-mix`, as the dark tokens are) comes back in hex.
 */
export function readCssToken(name: string, element: Element = document.body): string {
  const raw = getComputedStyle(element).getPropertyValue(name).trim()
  if (!raw || HEX_COLOR.test(raw)) return raw
  return toHex(computedColor(name, element)) ?? raw
}

/** The colour the browser computes for `var(name)`, read from a hidden probe inside `element`. */
function computedColor(name: string, element: Element): string {
  const probe = document.createElement('span')
  probe.style.display = 'none'
  probe.style.color = `var(${name})`
  element.appendChild(probe)
  const color = getComputedStyle(probe).color
  probe.remove()
  return color
}

/** `rgb(r, g, b)` or `color(srgb r g b)` as `#rrggbb`; anything else as `null`. */
function toHex(color: string): string | null {
  const hex = (channels: number[]) =>
    '#' + channels.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')
  const rgb = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/.exec(color)
  if (rgb) return hex(rgb.slice(1, 4).map(Number))
  const srgb = /^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/.exec(color)
  if (srgb) return hex(srgb.slice(1, 4).map((c) => Number(c) * 255))
  return null
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
      // The dark mode (`plugins/theme.ts`), with the surfaces of the dark tokens.
      dark: {
        dark: true,
        colors: {
          primary: '#5f8ead',
          secondary: '#5CBBF6',
          background: '#121417',
          surface: '#1b1f24',
        },
      },
    },
  },
})

/**
 * Sets the theme colours listed in `THEME_COLOR_TOKENS` to the app's tokens, so Vuetify components
 * (`color="primary"`) paint with the same colour as the core's own components. Runs once the app's
 * stylesheets are loaded, and on each change between light and dark (`name`, the theme the tokens
 * are in); a token that is unset or not a colour leaves the theme colour as it is.
 */
export function applyTokensToTheme(
  theme = vuetify.theme,
  read: (name: string) => string = readCssToken,
  name: 'light' | 'dark' = 'light',
): void {
  const colors = theme.themes.value[name].colors
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
