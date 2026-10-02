/**
 * Registry of the languages available in the app.
 *
 * Languages (and their translations) are defined ONLY here in the core. Projects can only choose
 * which of them are shown in the settings selector, via `languages` in `src/app/config.ts`.
 *
 * IMPORTANT: this file (and `i18n.ts`) must NOT import `@/app/config`, or an import cycle is formed
 * (`i18n.ts` → `@/app/config` → `app/models` → `data_io.ts` → `i18n.ts`). The helpers below receive
 * the project's list as a parameter; `appConfig.getLanguages()` is read at runtime by the callers.
 */
import en from './locales/en.ts'
import es from './locales/es.ts'
import fr from './locales/fr.ts'
import pt from './locales/pt.ts'

export interface LanguageDefinition {
  /** Language code, e.g. 'en', 'es', 'fr', 'pt'. */
  code: string
  /** i18n key with the language name, e.g. 'settings.english'. */
  labelKey: string
  /** BCP-47 code used by the date adapter, e.g. 'es-ES'. */
  dateLocale: string
  messages: Record<string, any>
}

export const FALLBACK_LANGUAGE = 'en'

export const CORE_LANGUAGES: LanguageDefinition[] = [
  // 'en' uses 'es-ES' dates on purpose: keeps the DD/MM/YYYY format instead of en-US.
  { code: 'en', labelKey: 'settings.english', dateLocale: 'es-ES', messages: en },
  { code: 'es', labelKey: 'settings.spanish', dateLocale: 'es-ES', messages: es },
  { code: 'fr', labelKey: 'settings.french', dateLocale: 'fr-FR', messages: fr },
  { code: 'pt', labelKey: 'settings.portuguese', dateLocale: 'pt-PT', messages: pt },
]

export function getCoreLanguageCodes(): string[] {
  return CORE_LANGUAGES.map((l) => l.code)
}

export function isCoreLanguage(code: unknown): code is string {
  return typeof code === 'string' && CORE_LANGUAGES.some((l) => l.code === code)
}

/**
 * Reads `languages` out of the project's app config.
 *
 * `appConfig` here is the **consumer's** `src/app/config.ts`, not the core's: every client
 * keeps its own `Config` class, and the ones written before this setting existed have no
 * `getLanguages` at all. Optional chaining alone does not cover that — TypeScript rejects
 * the property outright on a class that never declares it, which broke `vue-tsc` in every
 * client consuming core v3.4.0 while the app itself ran fine.
 *
 * Reading it through this helper keeps the call sites typed against what a client may
 * actually provide, and a config without the method simply shows all core languages.
 */
export function readConfiguredLanguages(appConfig: unknown): string[] {
  const getLanguages = (appConfig as { getLanguages?: () => string[] } | null)
    ?.getLanguages
  if (typeof getLanguages !== 'function') return []

  const languages = getLanguages.call(appConfig)
  return Array.isArray(languages) ? languages : []
}

/**
 * Core languages to show, in the order given by `codes`.
 * Empty/undefined `codes` → all core languages. Unknown codes are ignored with a warning.
 */
export function resolveVisibleLanguages(codes?: string[] | null): LanguageDefinition[] {
  if (!codes || codes.length === 0) return [...CORE_LANGUAGES]

  const visible: LanguageDefinition[] = []
  for (const code of codes) {
    const lang = CORE_LANGUAGES.find((l) => l.code === code)
    if (!lang) {
      console.warn(
        `[i18n] Language "${code}" in config.languages does not exist in the core and is ignored. ` +
          `Available: ${getCoreLanguageCodes().join(', ')}.`,
      )
      continue
    }
    if (!visible.includes(lang)) visible.push(lang)
  }

  if (visible.length === 0) {
    console.warn('[i18n] No valid language in config.languages; showing all core languages.')
    return [...CORE_LANGUAGES]
  }
  return visible
}

/**
 * Language to start the app with: `requested` if it is visible; otherwise the first visible one
 * (or the fallback), warning when `requested` was set.
 */
export function resolveDefaultLanguage(
  requested: string | undefined | null,
  visible: LanguageDefinition[],
): string {
  if (requested && visible.some((l) => l.code === requested)) return requested

  const resolved = visible[0]?.code ?? FALLBACK_LANGUAGE
  if (requested) {
    console.warn(
      `[i18n] Default language "${requested}" is not among the visible languages; using "${resolved}".`,
    )
  }
  return resolved
}
