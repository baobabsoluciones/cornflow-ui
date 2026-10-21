import { describe, test, expect, vi, beforeEach } from 'vitest'

// Mock vuetify imports
vi.mock('vuetify', () => ({
  createVuetify: vi.fn(() => ({
    theme: {
      themes: {
        light: {
          colors: {
            primary: '#1b5e8a',
            secondary: '#5CBBF6',
          },
        },
      },
    },
    components: {},
    install: vi.fn()
  }))
}))

vi.mock('vuetify/labs/components', () => ({
  VBtn: {},
  VCard: {},
  // Mock other lab components as needed
}))

// Mock CSS imports
vi.mock('@mdi/font/css/materialdesignicons.css', () => ({}))
vi.mock('vuetify/styles', () => ({}))

describe('plugins/vuetify', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('should create vuetify instance with correct configuration', async () => {
    const { createVuetify } = await import('vuetify')
    const vuetifyInstance = await import('@cornflow-ui/core/plugins/vuetify')

    expect(createVuetify).toHaveBeenCalledTimes(1)
    expect(createVuetify).toHaveBeenCalledWith({
      components: expect.any(Object),
      locale: expect.any(Object),
      date: expect.any(Object),
      theme: {
        themes: {
          light: {
            colors: {
              primary: '#1b5e8a',
              secondary: '#5CBBF6',
            },
          },
        },
      },
    })

    expect(vuetifyInstance.default).toBeDefined()
  })

  test('should include lab components', async () => {
    const vuetifyInstance = await import('@cornflow-ui/core/plugins/vuetify')

    // Verify that the vuetify instance exists and has expected structure
    expect(vuetifyInstance.default).toBeDefined()
    expect(typeof vuetifyInstance.default).toBe('object')
  })

  test('should have correct theme configuration', async () => {
    const vuetifyInstance = await import('@cornflow-ui/core/plugins/vuetify')

    // Verify that the vuetify instance exists
    expect(vuetifyInstance.default).toBeDefined()
    expect(vuetifyInstance.default.theme).toBeDefined()
  })

  test('should export a vuetify instance', async () => {
    const vuetifyInstance = await import('@cornflow-ui/core/plugins/vuetify')
    
    expect(vuetifyInstance.default).toBeDefined()
    expect(typeof vuetifyInstance.default).toBe('object')
  })

  test('should handle vuetify creation errors', async () => {
    const { createVuetify } = await import('vuetify')
    vi.mocked(createVuetify).mockImplementationOnce(() => {
      throw new Error('Vuetify creation failed')
    })

    await expect(async () => {
      // Clear the module cache to trigger re-creation
      vi.resetModules()
      await import('@cornflow-ui/core/plugins/vuetify')
    }).rejects.toThrow('Vuetify creation failed')
  })

  describe('design tokens', () => {
    // A test above leaves the module failed in the cache: load it again.
    beforeEach(() => {
      vi.resetModules()
    })

    function lightTheme() {
      return {
        themes: {
          value: { light: { colors: { primary: '#1b5e8a', secondary: '#5CBBF6' } } },
        },
      }
    }

    test("sets the primary colour to the app's --color-primary", async () => {
      const { applyTokensToTheme } = await import('@cornflow-ui/core/plugins/vuetify')
      const theme = lightTheme()
      const read = vi.fn((name: string) => (name === '--color-primary' ? '#ff6600' : ''))

      applyTokensToTheme(theme as any, read)

      expect(read).toHaveBeenCalledWith('--color-primary')
      expect(theme.themes.value.light.colors).toEqual({
        primary: '#ff6600',
        secondary: '#5CBBF6',
      })
    })

    test('keeps the theme colour when the token is unset', async () => {
      const { applyTokensToTheme } = await import('@cornflow-ui/core/plugins/vuetify')
      const theme = lightTheme()

      applyTokensToTheme(theme as any, () => '')

      expect(theme.themes.value.light.colors.primary).toBe('#1b5e8a')
    })

    test('keeps the theme colour, with a warning, when the token is not a hex colour', async () => {
      const { applyTokensToTheme } = await import('@cornflow-ui/core/plugins/vuetify')
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const theme = lightTheme()

      applyTokensToTheme(theme as any, () => 'rgb(255, 102, 0)')

      expect(theme.themes.value.light.colors.primary).toBe('#1b5e8a')
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('--color-primary'))
      warn.mockRestore()
    })

    test('readCssToken reads a custom property set on body', async () => {
      const { readCssToken } = await import('@cornflow-ui/core/plugins/vuetify')
      document.body.style.setProperty('--color-primary', '#034c5e')

      expect(readCssToken('--color-primary')).toBe('#034c5e')

      document.body.style.removeProperty('--color-primary')
    })
  })
})
