/**
 * plugins/languages.ts
 *
 * Single registry of the UI languages. Core ships en/es/fr; each project can add languages,
 * override core ones or hide them by declaring them in `src/app/plugins/locales/index.ts`
 * (optional). Without that file, the legacy `src/app/plugins/locales/{en,es,fr}.ts` are used.
 */
import { deepMerge } from '@cornflow-ui/core/utils/deepMerge'
import en from './locales/en.ts'
import es from './locales/es.ts'
import fr from './locales/fr.ts'

export interface LanguageDefinition {
  /** Locale code used by vue-i18n, e.g. 'pt'. */
  code: string
  /** Label shown in the language selector (usually the native name, e.g. 'Português'). */
  label?: string
  /** i18n key for the label; takes precedence over `label`. Used by core languages. */
  labelKey?: string
  /** BCP-47 code used by Vuetify's date adapter, e.g. 'pt-PT'. */
  dateLocale: string
  messages: Record<string, any>
}

/** Shape of the default export of a project's `src/app/plugins/locales/index.ts`. */
export interface AppLocalesConfig {
  languages?: Array<Partial<LanguageDefinition> & { code: string }>
  /** Codes of core languages to remove from the registry. 'en' cannot be hidden. */
  hidden?: string[]
}

export const FALLBACK_LANGUAGE = 'en'

export const CORE_LANGUAGES: LanguageDefinition[] = [
  // 'es-ES' on purpose: keeps DD/MM/YYYY dates for English (en-US would switch to MM/DD).
  { code: 'en', labelKey: 'settings.english', dateLocale: 'es-ES', messages: en },
  { code: 'es', labelKey: 'settings.spanish', dateLocale: 'es-ES', messages: es },
  { code: 'fr', labelKey: 'settings.french', dateLocale: 'fr-FR', messages: fr },
]

/** Combines core languages with the project config. Pure: no globals, no side effects. */
export function buildLanguageRegistry(
  core: LanguageDefinition[],
  appConfig: AppLocalesConfig = {},
): LanguageDefinition[] {
  const registry = new Map<string, LanguageDefinition>(
    core.map((lang) => [lang.code, { ...lang }]),
  )

  for (const appLang of appConfig.languages ?? []) {
    const existing = registry.get(appLang.code)
    if (existing) {
      registry.set(appLang.code, {
        ...existing,
        ...(appLang.label !== undefined && { label: appLang.label }),
        ...(appLang.labelKey !== undefined && { labelKey: appLang.labelKey }),
        ...(appLang.dateLocale !== undefined && { dateLocale: appLang.dateLocale }),
        messages: deepMerge(existing.messages, appLang.messages ?? {}),
      })
      continue
    }
    if (!appLang.dateLocale) {
      console.warn(
        `[i18n] Language '${appLang.code}' has no dateLocale; using '${appLang.code}' for dates.`,
      )
    }
    registry.set(appLang.code, {
      code: appLang.code,
      label: appLang.label,
      labelKey: appLang.labelKey,
      dateLocale: appLang.dateLocale || appLang.code,
      messages: appLang.messages ?? {},
    })
  }

  for (const code of appConfig.hidden ?? []) {
    if (code === FALLBACK_LANGUAGE) {
      console.warn(`[i18n] '${FALLBACK_LANGUAGE}' is the fallback language and cannot be hidden.`)
      continue
    }
    registry.delete(code)
  }

  return [...registry.values()]
}

type LocaleModule = { default: any }

/**
 * Builds the project config from the modules found under `src/app/plugins/locales/`.
 * `index.ts` wins; otherwise each legacy `<code>.ts` becomes a language entry.
 */
export function resolveAppLocalesConfig(
  indexModules: Record<string, LocaleModule>,
  legacyModules: Record<string, LocaleModule>,
): AppLocalesConfig {
  const index = Object.values(indexModules)[0]
  if (index) return index.default ?? {}

  return {
    languages: Object.entries(legacyModules).map(([path, mod]) => ({
      code: path.split('/').pop()!.replace(/\.ts$/, ''),
      messages: mod.default ?? {},
    })),
  }
}

// Use the `@/app` alias (NOT a relative path): when this package is consumed as source,
// `@/` resolves to the CONSUMER's src, so their locales are picked up. Globs (instead of
// static imports) make every file optional.
const appConfig = resolveAppLocalesConfig(
  import.meta.glob<LocaleModule>('@/app/plugins/locales/index.ts', { eager: true }),
  import.meta.glob<LocaleModule>('@/app/plugins/locales/{en,es,fr}.ts', { eager: true }),
)

export const languages: LanguageDefinition[] = buildLanguageRegistry(CORE_LANGUAGES, appConfig)

export function isRegisteredLanguage(code: string): boolean {
  return languages.some((lang) => lang.code === code)
}

/** Maps each vue-i18n locale to the BCP-47 code used by Vuetify's date adapter. */
export function getDateLocaleMap(
  langs: LanguageDefinition[] = languages,
): Record<string, string> {
  return Object.fromEntries(langs.map((lang) => [lang.code, lang.dateLocale]))
}
