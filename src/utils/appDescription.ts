/**
 * What a running deployment is made of: the configuration it took (app config, values.json or
 * the environment), the schemas it works on, the languages it shows, its own sections and the
 * modules it registered.
 *
 * The end-to-end suite reads it to know what a deployment has to show: a step, a column or a
 * section that the configuration turns on and is not on the screen is a fault, one it turns off
 * must not be there. It is published once the app starts as `window.cornflowUi.describe()`.
 *
 * It carries data only: functions and components are left out, and of the sign-in settings only
 * the provider type is kept.
 */
import config from '@cornflow-ui/core/config'
import appConfig from '@/app/config'
import { getRegisteredPremiumModules } from '@cornflow-ui/core/plugins/extensions'
import {
  readConfiguredLanguages,
  resolveVisibleLanguages,
} from '@cornflow-ui/core/plugins/languages'

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
