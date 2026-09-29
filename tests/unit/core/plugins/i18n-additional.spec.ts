import { describe, test, expect, vi } from 'vitest'

describe('i18n Plugin - Additional Coverage', () => {
  test('should define setDefaultLanguage function', async () => {
    const i18nModule = await import('@cornflow-ui/core/plugins/i18n')
    
    expect(i18nModule.setDefaultLanguage).toBeDefined()
    expect(typeof i18nModule.setDefaultLanguage).toBe('function')
  })

  test('should export i18n instance', async () => {
    const i18nModule = await import('@cornflow-ui/core/plugins/i18n')
    
    expect(i18nModule.i18n).toBeDefined()
    expect(i18nModule.default).toBeDefined()
    expect(typeof i18nModule.i18n).toBe('object')
  })

  test('should export default as i18n instance', async () => {
    const i18nModule = await import('@cornflow-ui/core/plugins/i18n')
    
    expect(i18nModule.default).toBe(i18nModule.i18n)
  })

  test('should handle setDefaultLanguage function calls', async () => {
    const i18nModule = await import('@cornflow-ui/core/plugins/i18n')
    
    // Should not throw errors for valid language codes
    expect(() => i18nModule.setDefaultLanguage('en')).not.toThrow()
    expect(() => i18nModule.setDefaultLanguage('es')).not.toThrow()
    expect(() => i18nModule.setDefaultLanguage('fr')).not.toThrow()
  })

  test('should have i18n instance with expected properties', async () => {
    const i18nModule = await import('@cornflow-ui/core/plugins/i18n')
    
    expect(i18nModule.i18n).toHaveProperty('global')
    expect(i18nModule.i18n.global).toHaveProperty('locale')
  })

  test('should maintain consistency between named and default export', async () => {
    const i18nModule = await import('@cornflow-ui/core/plugins/i18n')
    
    // Both exports should reference the same object
    expect(i18nModule.default).toStrictEqual(i18nModule.i18n)
  })

  test('should have working locale value access', async () => {
    const i18nModule = await import('@cornflow-ui/core/plugins/i18n')
    
    expect(i18nModule.i18n.global.locale).toBeDefined()
    expect(typeof i18nModule.i18n.global.locale.value).toBe('string')
  })

  test('should accept valid language parameters', async () => {
    const i18nModule = await import('@cornflow-ui/core/plugins/i18n')
    
    const validLanguages = ['en', 'es', 'fr'] as const
    
    validLanguages.forEach(lang => {
      expect(() => i18nModule.setDefaultLanguage(lang)).not.toThrow()
    })
  })
})

describe('i18n Plugin - language validation', () => {
  test('falls back to en with a warning for an unregistered language', async () => {
    const i18nModule = await import('@cornflow-ui/core/plugins/i18n')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    i18nModule.setDefaultLanguage('es')
    i18nModule.setDefaultLanguage('xx')

    expect(warn).toHaveBeenCalledWith(expect.stringContaining("'xx' is not registered"))
    expect(i18nModule.i18n.global.locale.value).toBe('en')
    expect(i18nModule.currentLocale.value).toBe('en')
    warn.mockRestore()
  })

  test('changeLanguage also falls back to en for an unregistered language', async () => {
    const i18nModule = await import('@cornflow-ui/core/plugins/i18n')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    i18nModule.changeLanguage('fr')
    expect(i18nModule.i18n.global.locale.value).toBe('fr')

    i18nModule.changeLanguage('xx')
    expect(warn).toHaveBeenCalled()
    expect(i18nModule.i18n.global.locale.value).toBe('en')
    warn.mockRestore()
  })

  test('registers messages for every registered language', async () => {
    const i18nModule = await import('@cornflow-ui/core/plugins/i18n')

    expect(i18nModule.i18n.global.availableLocales.sort()).toEqual(['en', 'es', 'fr'])
  })
})
