import { describe, test, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

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
    
    const validLanguages = ['en', 'es', 'fr', 'pt'] as const
    
    validLanguages.forEach(lang => {
      expect(() => i18nModule.setDefaultLanguage(lang)).not.toThrow()
    })
  })
})

describe('i18n Plugin - buildMessages (project texts)', () => {
  const core = [
    { code: 'en', labelKey: 'settings.english', dateLocale: 'es-ES', messages: { settings: { english: 'English' } } },
    { code: 'es', labelKey: 'settings.spanish', dateLocale: 'es-ES', messages: { settings: { english: 'Inglés' } } },
  ]

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('merges new project keys into any core language, including nested sections', async () => {
    const { buildMessages } = await import('@cornflow-ui/core/plugins/i18n')

    const messages = buildMessages(core, {
      '/src/app/plugins/locales/es.ts': {
        default: { settings: { custom: 'Propio' }, myApp: { title: 'Mi app' } },
      },
    })

    expect(messages.es).toEqual({
      settings: { english: 'Inglés', custom: 'Propio' },
      myApp: { title: 'Mi app' },
    })
  })

  test('keeps only core texts for a language without project file', async () => {
    const { buildMessages } = await import('@cornflow-ui/core/plugins/i18n')

    const messages = buildMessages(core, {
      '/src/app/plugins/locales/es.ts': { default: { myApp: { title: 'Mi app' } } },
    })

    expect(messages.en).toEqual({ settings: { english: 'English' } })
  })

  test('ignores (with a warning) project files for languages not in the core', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { buildMessages } = await import('@cornflow-ui/core/plugins/i18n')

    const messages = buildMessages(core, {
      '/src/app/plugins/locales/de.ts': { default: { myApp: { title: 'Meine App' } } },
    })

    expect(Object.keys(messages)).toEqual(['en', 'es'])
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"de"'))
  })

  test('discards (with a warning) project keys that already exist in the core', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { buildMessages } = await import('@cornflow-ui/core/plugins/i18n')

    const messages = buildMessages(core, {
      '/src/app/plugins/locales/en.ts': {
        default: { settings: { english: 'Changed', custom: 'Custom' } },
      },
    })

    expect(messages.en.settings).toEqual({ english: 'English', custom: 'Custom' })
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"settings.english"'))
  })
})

describe('i18n Plugin - language validation', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('changeLanguage and setDefaultLanguage ignore unknown codes with a warning', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { i18n, changeLanguage, setDefaultLanguage, currentLocale } =
      await import('@cornflow-ui/core/plugins/i18n')

    changeLanguage('es')
    changeLanguage('de')
    setDefaultLanguage('xx')

    expect(currentLocale.value).toBe('es')
    expect(i18n.global.locale.value).toBe('es')
    expect(warn).toHaveBeenCalledTimes(2)
  })
})

describe('i18n Plugin - no import of @/app/config', () => {
  // Importing the app config from these modules forms an import cycle
  // (i18n.ts → @/app/config → app/models → data_io.ts → i18n.ts). Only real import
  // statements are checked (quoted specifier), so mentions in comments are allowed.
  const APP_CONFIG_IMPORT =
    /(?:from\s+|import\s*\(?\s*)['"]@\/app\/config(?:\.ts)?['"]/

  test.each(['src/plugins/languages.ts', 'src/plugins/i18n.ts'])(
    '%s does not import @/app/config',
    (file) => {
      const source = readFileSync(resolve(process.cwd(), file), 'utf-8')
      expect(source).not.toMatch(APP_CONFIG_IMPORT)
    },
  )

  test('the pattern detects static, side-effect and dynamic imports', () => {
    expect("import appConfig from '@/app/config'").toMatch(APP_CONFIG_IMPORT)
    expect("import type { X } from '@/app/config.ts'").toMatch(APP_CONFIG_IMPORT)
    expect("import '@/app/config'").toMatch(APP_CONFIG_IMPORT)
    expect("await import('@/app/config')").toMatch(APP_CONFIG_IMPORT)
    expect('// must NOT import `@/app/config`').not.toMatch(APP_CONFIG_IMPORT)
  })
})
