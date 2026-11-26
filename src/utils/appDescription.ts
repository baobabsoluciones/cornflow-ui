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
import * as appRoles from '@/app/rolesConfig'
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
  /**
   * The backend the app talks to, as it took it (values.json or the environment): the suite
   * prepares and cleans up its data there, so both work on the same one.
   */
  backendUrl: string
  hasExternalApp: boolean
  isDeveloperMode: boolean
  /** Codes of the languages the user can choose. */
  languages: string[]
  /** Ids of the modules registered at start-up (frontend automation, premium modules). */
  modules: string[]
  /** The `core` block of the app config, data only. */
  core: Record<string, unknown>
  appSections: unknown[]
  /**
   * Per role, what it cannot reach and where it lands (`@/app/rolesConfig`): `forbidden_views`,
   * `forbidden_endpoints` and `defaultView`. A role it does not name has no restriction.
   */
  rolesConfig: Record<string, unknown>
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
   * The master tables the app has from frontend automation (`/external/frontend-automation/`), as
   * it took them: per table, its title, section, group and DAGs, and the endpoint of each
   * operation it allows (`get_list`, `download_excel_table`…); and the sections and groups of the
   * menu, in their order. Null until the app has asked, once the user signs in; no tables where
   * the backend has no frontend automation.
   */
  masterData: MasterDataDescription | null
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

/** A master table, as `describe()` gives it. */
export interface MasterTableDescription {
  /** As the backend gives it: a text, or one per language. */
  title: unknown
  section: string | null
  /** The key of its group, if it is in one. */
  group: string | null
  /** The DAGs it is for; null for every DAG. */
  schemas: string[] | null
  /** Each operation it allows, by name: its endpoint, HTTP method and parameters. */
  operations: Record<
    string,
    { url: string; method: string; parameters: MasterParameterDescription[] }
  >
}

/** A parameter of an operation of a master table. */
export interface MasterParameterDescription {
  name: string
  /** Where it goes (`query`, `path`…); `query` when the backend does not say. */
  in: string
  /** Its default value, which the app sends; null when it has none. */
  default: unknown
  /** What it filters by, for a filter (`filter_info.filter_type`: `limit`, `offset`…). */
  filterType: string | null
}

export interface MasterDataDescription {
  tables: Record<string, MasterTableDescription>
  sections: unknown[]
  groups: unknown[]
}

/** The master tables the store took from frontend automation; null before it asked. */
function readMasterData(): MasterDataDescription | null {
  if (!getActivePinia()) return null
  const store = useGeneralStore()
  if (!store.rawConfigurations) return null
  const raw = (store.rawConfigurations.masterData ?? {}) as Record<string, any>
  const tables = Object.fromEntries(
    Object.entries(raw).map(([key, table]) => {
      const operations = Object.fromEntries(
        Object.entries(table ?? {})
          .filter(([, value]: [string, any]) => value && typeof value === 'object' && value.url)
          .map(([name, value]: [string, any]) => [
            name,
            {
              url: String(value.url),
              method: String(value.http_method ?? 'get'),
              parameters: Array.isArray(value.parameters)
                ? value.parameters.map(
                    (parameter: any): MasterParameterDescription => ({
                      name: String(parameter?.name ?? parameter),
                      in: String(parameter?.in || 'query'),
                      default: plainData(parameter?.default ?? null),
                      filterType: parameter?.is_filter
                        ? (parameter?.filter_info?.filter_type ?? null)
                        : null,
                    }),
                  )
                : [],
            },
          ]),
      )
      return [
        key,
        {
          title: plainData(table?._originalTitle ?? table?.title ?? key),
          section: table?.section ?? null,
          group: table?._groupKey ?? null,
          schemas: Array.isArray(table?.schemas) ? [...table.schemas] : null,
          operations,
        },
      ]
    }),
  )
  return {
    tables,
    sections: (plainData(store.masterDataSections ?? []) as unknown[]) ?? [],
    groups: (plainData(store.masterDataGroups ?? []) as unknown[]) ?? [],
  }
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
    backendUrl: config.backend,
    hasExternalApp: config.hasExternalApp,
    isDeveloperMode: config.isDeveloperMode,
    languages: resolveVisibleLanguages(readConfiguredLanguages(appConfig)).map(
      (language) => language.code,
    ),
    modules: getRegisteredPremiumModules().map((module) => module.id),
    core: plainData(appConfig.getCore()) as Record<string, unknown>,
    appSections: plainData(fromAppConfig('getAppSections', [])) as unknown[],
    // The default export, by name: a project's `rolesConfig` may not have one, and then has none.
    rolesConfig: (plainData(
      (appRoles as { default?: unknown }).default ?? {},
    ) ?? {}) as Record<string, unknown>,
    helpMenuFiles: plainData(fromAppConfig('getHelpMenuFiles', [])) as unknown[],
    dashboards: {
      solution: plainData(fromAppConfig('getDashboardPages', [])) as unknown[],
      instance: plainData(fromAppConfig('getInstanceDashboardPages', [])) as unknown[],
    },
    frontendConfig: readFrontendConfig(),
    masterData: readMasterData(),
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
