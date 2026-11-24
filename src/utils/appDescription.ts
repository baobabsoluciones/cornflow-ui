/**
 * What a running deployment is made of: the configuration it took (app config, values.json or
 * the environment), the schemas it works on, the languages it shows, its own sections, the
 * modules it registered, what its backend says about each DAG and the texts it has.
 *
 * The end-to-end suite reads it to know what a deployment has to show: a step, a column or a
 * section that the configuration turns on and is not on the screen is a fault, one it turns off
 * must not be there. It is published once the app starts as `window.cornflowUi.describe()`.
 *
 * It carries data only: functions and components are left out, and of the sign-in settings only
 * the provider type is kept.
 */
import { getActivePinia } from 'pinia'
import config from '@cornflow-ui/core/config'
import appConfig from '@/app/config'
import { getRegisteredPremiumModules } from '@cornflow-ui/core/plugins/extensions'
import i18n from '@cornflow-ui/core/plugins/i18n'
import {
  readConfiguredLanguages,
  resolveVisibleLanguages,
} from '@cornflow-ui/core/plugins/languages'
import { useGeneralStore } from '@cornflow-ui/core/stores/general'
import type { FrontendConfig } from '@cornflow-ui/core/utils/frontendConfig'

export interface AppDescription {
  name: string
  /** DAGs the deployment works on; the first is the one it opens with. */
  schemas: string[]
  authType: string
  hasExternalApp: boolean
  isDeveloperMode: boolean
  /** Codes of the languages the user can choose. */
  languages: string[]
  /** Ids of the modules registered at start-up (frontend automation, premium modules). */
  modules: string[]
  /** The `core` block of the app config, data only. */
  core: Record<string, unknown>
  appSections: unknown[]
  helpMenuFiles: unknown[]
  dashboards: { solution: unknown[]; instance: unknown[] }
  /**
   * What the backend tells the interface about each DAG (`GET /external/frontend-config/`): the
   * load filters its ETL asks for and the endpoints its executions are read from. The app asks for
   * it once the user signs in; null before that, and when the backend has no such endpoint (then
   * there are no load filters and every execution is read from Cornflow).
   */
  frontendConfig: FrontendConfig | null
  /**
   * The first-level keys of the texts the app has, in any language: those of core, the project's
   * own and the modules'. A text key starts with one of them (`createExecution.title`).
   */
  i18nNamespaces: string[]
}

/** `value` with what is not data left out: functions, and objects already met (cycles). */
export function plainData(value: unknown): unknown {
  const seen = new WeakSet<object>()
  const text = JSON.stringify(value, (_key, item: unknown) => {
    if (typeof item === 'function' || typeof item === 'symbol') return undefined
    if (item && typeof item === 'object') {
      if (seen.has(item)) return undefined
      seen.add(item)
    }
    return item
  })
  return text === undefined ? null : JSON.parse(text)
}

/** Calls an optional getter of the app config: a client's own config may not have it. */
function fromAppConfig<T>(getter: string, fallback: T): T {
  const read = (appConfig as unknown as Record<string, unknown>)[getter]
  return typeof read === 'function' ? (read.call(appConfig) as T) : fallback
}

/** What the backend said about each DAG, as the store keeps it. None before the store exists. */
function readFrontendConfig(): FrontendConfig | null {
  if (!getActivePinia()) return null
  return plainData(useGeneralStore().frontendConfig) as FrontendConfig | null
}

/** The first-level keys of the messages of every language, sorted. */
function readI18nNamespaces(): string[] {
  const namespaces = new Set<string>()
  for (const locale of i18n.global.availableLocales) {
    for (const key of Object.keys(i18n.global.getLocaleMessage(locale) ?? {})) {
      namespaces.add(key)
    }
  }
  return [...namespaces].sort()
}

export function describeApp(): AppDescription {
  const schemas = config.schemas.length ? config.schemas : [config.schema].filter(Boolean)
  return {
    name: config.name,
    schemas,
    authType: config.auth.type,
    hasExternalApp: config.hasExternalApp,
    isDeveloperMode: config.isDeveloperMode,
    languages: resolveVisibleLanguages(readConfiguredLanguages(appConfig)).map(
      (language) => language.code,
    ),
    modules: getRegisteredPremiumModules().map((module) => module.id),
    core: plainData(appConfig.getCore()) as Record<string, unknown>,
    appSections: plainData(fromAppConfig('getAppSections', [])) as unknown[],
    helpMenuFiles: plainData(fromAppConfig('getHelpMenuFiles', [])) as unknown[],
    dashboards: {
      solution: plainData(fromAppConfig('getDashboardPages', [])) as unknown[],
      instance: plainData(fromAppConfig('getInstanceDashboardPages', [])) as unknown[],
    },
    frontendConfig: readFrontendConfig(),
    i18nNamespaces: readI18nNamespaces(),
  }
}

declare global {
  interface Window {
    cornflowUi?: { describe: () => AppDescription }
  }
}

/** Publishes `window.cornflowUi.describe()`. Each call describes the app as it is then. */
export function publishAppDescription(): void {
  window.cornflowUi = Object.freeze({ describe: describeApp })
}
