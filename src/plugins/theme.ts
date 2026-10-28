/**
 * Light or dark: the user's choice (light, dark, or as the system is), kept in the browser and
 * applied as `data-theme` on `body` (the dark tokens of `tokens.css`) and as Vuetify's theme.
 *
 * Only for apps that turn it on (`enableDarkMode` in their parameters): the core's own screens are
 * ready for it, the app's own screens and dashboards may not be. Without it the app stays light.
 *
 * `initTheme()` applies it when the app starts; `useTheme()` reads and changes it.
 */
import { computed, ref, watch } from 'vue'
import vuetify, { applyTokensToTheme, readCssToken } from '@cornflow-ui/core/plugins/vuetify'
import { getAppParameters } from '@cornflow-ui/core/utils/appParameters'

export type ThemePreference = 'light' | 'dark' | 'system'
export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'cornflow-ui:theme'
const DARK_QUERY = '(prefers-color-scheme: dark)'
const PREFERENCES: ThemePreference[] = ['light', 'dark', 'system']

function storedPreference(): ThemePreference {
  try {
    const stored = globalThis.localStorage?.getItem(STORAGE_KEY)
    return PREFERENCES.includes(stored as ThemePreference) ? (stored as ThemePreference) : 'light'
  } catch {
    return 'light'
  }
}

const preference = ref<ThemePreference>(storedPreference())
const systemIsDark = ref(false)

/** Whether the app offers dark mode (`enableDarkMode`). */
export const isDarkModeEnabled = (): boolean => getAppParameters()?.enableDarkMode === true

const theme = computed<Theme>(() => {
  if (!isDarkModeEnabled()) return 'light'
  if (preference.value === 'system') return systemIsDark.value ? 'dark' : 'light'
  return preference.value
})

/**
 * ApexCharts' defaults for the charts drawn from now on (the core's dashboards and the app's):
 * the mode, the text and grid colours of the tokens, and no background of their own.
 */
function applyToCharts(value: Theme) {
  const apex = ((globalThis as { Apex?: Record<string, any> }).Apex ??= {})
  apex.theme = { ...apex.theme, mode: value }
  apex.chart = { ...apex.chart, background: 'transparent', foreColor: readCssToken('--color-text-muted') }
  apex.grid = { ...apex.grid, borderColor: readCssToken('--color-divider') }
  apex.tooltip = { ...apex.tooltip, theme: value }
}

function apply(value: Theme) {
  document.body.dataset.theme = value
  vuetify.theme.global.name.value = value
  applyTokensToTheme(vuetify.theme, undefined, value)
  applyToCharts(value)
}

let started = false

/** Applies the theme and follows the system's when that is the choice. Once, when the app starts. */
export function initTheme(): void {
  if (started) return
  started = true
  const query = typeof globalThis.matchMedia === 'function' ? globalThis.matchMedia(DARK_QUERY) : null
  systemIsDark.value = query?.matches ?? false
  query?.addEventListener?.('change', (event) => (systemIsDark.value = event.matches))
  watch(theme, apply, { immediate: true })
}

/** The user's choice and the theme it gives, to read and change it (user settings). */
export function useTheme() {
  function setPreference(value: ThemePreference) {
    preference.value = value
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, value)
    } catch {
      // A browser that keeps nothing still switches for this visit.
    }
  }
  return { enabled: isDarkModeEnabled(), preference, theme, setPreference }
}
