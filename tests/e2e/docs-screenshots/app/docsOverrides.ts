/**
 * Turns features of the app config on and off for one screenshot.
 *
 * The screenshot specs write the settings a shot needs to localStorage (`DOCS_OVERRIDES_KEY`)
 * before the app loads; the demo app config and roles config read them when the app starts. Only
 * the documentation screenshots use this: no application is built with it.
 */
export { DOCS_OVERRIDES_KEY } from '../overridesKey.mjs'
import { DOCS_OVERRIDES_KEY } from '../overridesKey.mjs'

export interface DocsOverrides {
  /** Merged into `core.parameters` (plain objects key by key; arrays and other values replace). */
  parameters?: Record<string, unknown>
  /** Merged into `core.schemaOverrides`. */
  schemaOverrides?: Record<string, unknown>
  /** Replaces top-level keys of the app config (`languages`, `helpMenuFiles`…). */
  app?: Record<string, unknown>
  /** Role name → permissions, merged into the roles config. */
  roles?: Record<string, unknown>
  /** Adds the demo app's own dashboard ("Resumen del plan") to the results. */
  demoDashboard?: boolean
}

export function readDocsOverrides(): DocsOverrides {
  try {
    return JSON.parse(globalThis.localStorage?.getItem(DOCS_OVERRIDES_KEY) || '{}')
  } catch {
    return {}
  }
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>) {
  for (const [key, value] of Object.entries(source)) {
    if (isPlainObject(value) && isPlainObject(target[key])) {
      deepMerge(target[key] as Record<string, unknown>, value)
    } else {
      target[key] = value
    }
  }
}

interface ConfigLike {
  updateConfig: () => void
}

/** Applies the overrides to the app config now and every time it is rebuilt. */
export function withDocsOverrides<T extends ConfigLike>(appConfig: T): T {
  const apply = () => {
    const overrides = readDocsOverrides()
    // The config object is private to the Config class; the screenshots reach it on purpose.
    const config = (appConfig as unknown as { ensureConfig: () => any }).ensureConfig()
    if (overrides.parameters) deepMerge(config.core.parameters, overrides.parameters)
    if (overrides.schemaOverrides) {
      config.core.schemaOverrides = config.core.schemaOverrides ?? {}
      deepMerge(config.core.schemaOverrides, overrides.schemaOverrides)
    }
    if (overrides.app) Object.assign(config, overrides.app)
    if (overrides.demoDashboard) {
      config.dashboardPages = [{ title: 'Resumen del plan', icon: 'mdi-view-dashboard', to: '/resumen-del-plan' }]
      config.dashboardRoutes = [
        { path: 'resumen-del-plan', name: 'Resumen del plan', component: () => import('./DemoDashboard.vue') },
      ]
    }
  }
  const updateConfig = appConfig.updateConfig.bind(appConfig)
  appConfig.updateConfig = () => {
    updateConfig()
    apply()
  }
  apply()
  return appConfig
}
