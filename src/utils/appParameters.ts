/**
 * appParameters.ts — Where the core reads `src/app/config.ts` from.
 *
 * The general store holds `core` and keeps `core.parameters` set to the active DAG's settings
 * (see `schemaOverrides`). Reading them through the store makes computed properties and watchers
 * follow a DAG switch; before Pinia is installed, the app config is read as it is.
 */
import { getActivePinia } from 'pinia'
import appConfig from '@/app/config'
import { useGeneralStore } from '@cornflow-ui/core/stores/general'

export type AppCoreConfig = ReturnType<typeof appConfig.getCore>
export type AppParameters = AppCoreConfig['parameters']

/** `core` of the app config, with the active DAG's `parameters`. */
export function getAppCoreConfig(): AppCoreConfig {
  return getActivePinia()
    ? (useGeneralStore().appConfig as AppCoreConfig)
    : appConfig.getCore()
}

/** `core.parameters` of the active DAG. */
export function getAppParameters(): AppParameters {
  return getAppCoreConfig().parameters
}
