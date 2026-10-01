import { createI18n } from 'vue-i18n'
import { ref, computed } from 'vue'
import {
  CORE_LANGUAGES,
  FALLBACK_LANGUAGE,
  isCoreLanguage,
  type LanguageDefinition,
} from './languages'

// Project texts: one optional file per core language in src/app/plugins/locales/<code>.ts.
// Use the `@/app` alias (NOT a relative path): when this package is consumed as source,
// `@/` resolves to the CONSUMER's src, so their src/app/plugins/locales get merged in. A
// relative `../app/...` would resolve inside this package and silently ignore the consumer's
// translations. Standalone (core's own build) `@/` still points here, so behaviour is unchanged.
// NOTE: do not import `@/app/config` here (import cycle, see languages.ts).
const appLocaleModules = import.meta.glob('@/app/plugins/locales/*.ts', {
  eager: true,
}) as Record<string, { default?: Record<string, any> }>

// Default language - will be overridden by config
let defaultLanguage = FALLBACK_LANGUAGE

// Reactive locale state
export const currentLocale = ref<string>(defaultLanguage)

function isPlainObject(value: unknown): value is Record<string, any> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Adds the project's keys to the core ones. Keys that already exist in the core are discarded
 * (with a warning): a project can add its own texts but never change core translations.
 */
function mergeAppOnly(
  core: Record<string, any>,
  app: Record<string, any>,
  lang: string,
  path = '',
): Record<string, any> {
  const result = { ...core }
  for (const key of Object.keys(app)) {
    const keyPath = path ? `${path}.${key}` : key
    if (!(key in core)) {
      result[key] = app[key]
    } else if (isPlainObject(core[key]) && isPlainObject(app[key])) {
      result[key] = mergeAppOnly(core[key], app[key], lang, keyPath)
    } else {
      console.warn(
        `[i18n] Project key "${keyPath}" (${lang}) already exists in the core and is ignored.`,
      )
    }
  }
  return result
}

/**
 * Builds the vue-i18n messages: every core language, plus the project's own keys for it.
 * Project files for languages that are not in the core are ignored with a warning.
 */
export function buildMessages(
  coreLanguages: LanguageDefinition[],
  appModules: Record<string, { default?: Record<string, any> }>,
): Record<string, Record<string, any>> {
  const appByCode: Record<string, Record<string, any>> = {}
  for (const [filePath, mod] of Object.entries(appModules)) {
    const code = filePath.match(/([^/]+)\.ts$/)?.[1]
    if (!code) continue
    if (!coreLanguages.some((l) => l.code === code)) {
      console.warn(
        `[i18n] Project locale file "${filePath}" is ignored: "${code}" is not a core language.`,
      )
      continue
    }
    if (isPlainObject(mod?.default)) appByCode[code] = mod.default
  }

  const messages: Record<string, Record<string, any>> = {}
  for (const lang of coreLanguages) {
    messages[lang.code] = appByCode[lang.code]
      ? mergeAppOnly(lang.messages, appByCode[lang.code], lang.code)
      : lang.messages
  }
  return messages
}

// Validates the language against the core registry and applies it to the i18n instance.
function applyLanguage(language: string, action: string): boolean {
  if (!isCoreLanguage(language)) {
    console.warn(`[i18n] Unknown language "${language}"; ${action} not changed.`)
    return false
  }
  currentLocale.value = language
  if (i18n.global) {
    i18n.global.locale.value = language as any
  }
  return true
}

// Function to update the default language from config
export function setDefaultLanguage(language: string) {
  if (applyLanguage(language, 'default language')) {
    defaultLanguage = language
  }
}

// Function to change language dynamically
export function changeLanguage(language: string) {
  applyLanguage(language, 'language')
}

// Computed property to get current locale reactively
export const locale = computed(() => currentLocale.value)

// Core + app messages are merged at build time. Premium modules (enterprise) inject their
// locale messages AFTER module registration via `applyPremiumLocales` (see plugins/index.ts),
// so this stays free of any premium/registry dependency.
export const i18n = createI18n({
  locale: defaultLanguage, // set locale (will be updated later)
  fallbackLocale: FALLBACK_LANGUAGE, // set fallback locale
  legacy: false,
  // Cast to `any` to avoid inferring the (huge) message schema: this way `t` accepts string keys and
  // TS2589 ("type instantiation excessively deep") is avoided in heavy contexts (stores, arrays).
  messages: buildMessages(CORE_LANGUAGES, appLocaleModules) as any,
})

export default i18n
