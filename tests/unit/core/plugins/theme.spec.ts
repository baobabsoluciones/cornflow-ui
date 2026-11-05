import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { nextTick } from 'vue'

const { parameters, vuetify, applyTokensToTheme, media } = vi.hoisted(() => ({
  parameters: { enableDarkMode: true } as Record<string, unknown>,
  vuetify: { theme: { global: { name: { value: 'light' } } } },
  applyTokensToTheme: vi.fn(),
  media: { matches: false, listener: null as ((event: { matches: boolean }) => void) | null },
}))

vi.mock('@cornflow-ui/core/utils/appParameters', () => ({ getAppParameters: () => parameters }))
vi.mock('@cornflow-ui/core/plugins/vuetify', () => ({
  default: vuetify,
  applyTokensToTheme,
  readCssToken: (name: string) => (name === '--color-text-muted' ? '#a3abb3' : '#2b3138'),
}))

async function loadTheme() {
  vi.resetModules()
  return import('@cornflow-ui/core/plugins/theme')
}

describe('theme', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    parameters.enableDarkMode = true
    media.matches = false
    media.listener = null
    vi.stubGlobal('matchMedia', () => ({
      get matches() {
        return media.matches
      },
      addEventListener: (_: string, listener: (event: { matches: boolean }) => void) => (media.listener = listener),
    }))
    delete (globalThis as { Apex?: unknown }).Apex
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete document.body.dataset.theme
  })

  test('starts light, on the page, Vuetify and the charts', async () => {
    const { initTheme } = await loadTheme()
    initTheme()
    expect(document.body.dataset.theme).toBe('light')
    expect(vuetify.theme.global.name.value).toBe('light')
    expect(applyTokensToTheme).toHaveBeenCalledWith(vuetify.theme, undefined, 'light')
    expect((globalThis as any).Apex.theme.mode).toBe('light')
  })

  test('starts with the choice kept in the browser', async () => {
    localStorage.setItem('cornflow-ui:theme', 'dark')
    const { initTheme } = await loadTheme()
    initTheme()
    expect(document.body.dataset.theme).toBe('dark')
    expect(vuetify.theme.global.name.value).toBe('dark')
    expect((globalThis as any).Apex).toMatchObject({
      theme: { mode: 'dark' },
      chart: { background: 'transparent', foreColor: '#a3abb3' },
      grid: { borderColor: '#2b3138' },
      tooltip: { theme: 'dark' },
    })
  })

  test('changing the choice switches the theme and keeps it', async () => {
    const { initTheme, useTheme } = await loadTheme()
    initTheme()
    const { preference, setPreference } = useTheme()
    setPreference('dark')
    await nextTick()
    expect(preference.value).toBe('dark')
    expect(document.body.dataset.theme).toBe('dark')
    expect(localStorage.getItem('cornflow-ui:theme')).toBe('dark')
  })

  test('as the system is: follows it, also when it changes', async () => {
    localStorage.setItem('cornflow-ui:theme', 'system')
    media.matches = true
    const { initTheme, useTheme } = await loadTheme()
    initTheme()
    expect(document.body.dataset.theme).toBe('dark')
    expect(useTheme().theme.value).toBe('dark')

    media.listener?.({ matches: false })
    await nextTick()
    expect(document.body.dataset.theme).toBe('light')
  })

  test('an app without dark mode stays light, whatever was chosen', async () => {
    parameters.enableDarkMode = false
    localStorage.setItem('cornflow-ui:theme', 'dark')
    const { initTheme, useTheme } = await loadTheme()
    initTheme()
    expect(document.body.dataset.theme).toBe('light')
    expect(useTheme().enabled).toBe(false)
  })

  test('an unknown choice in the browser reads as light', async () => {
    localStorage.setItem('cornflow-ui:theme', 'sepia')
    const { useTheme } = await loadTheme()
    expect(useTheme().preference.value).toBe('light')
    expect(useTheme().theme.value).toBe('light')
  })
})
