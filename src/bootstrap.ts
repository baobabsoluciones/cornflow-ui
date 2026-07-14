/**
 * bootstrap.ts — Core entry point: `createCornflowApp`.
 *
 * Encapsulates application startup (external config, i18n, Pinia, Vuetify, mango-vue
 * components, user prefetch, mount) and accepts a list of `PremiumModule` (enterprise).
 * Registers the modules BEFORE `registerPlugins`, so that `applyPremiumRoutes` /
 * `applyPremiumLocales` (inside registerPlugins) inject their contributions into the already-built
 * router/i18n.
 *
 * In the target model (npm) this function lives in `@cornflow-ui/core`; each project is a thin
 * shell that invokes it (or uses `createEnterpriseApp` from `@cornflow-ui/enterprise`). See
 * docs/PLAN_MIGRACION_NPM_PACKAGES.md and docs/CONTRATO_PUNTOS_EXTENSION.md.
 */
import { createApp, type App as VueApp, type Component } from 'vue'
import { createPinia, setActivePinia } from 'pinia'

import { registerPlugins } from '@cornflow-ui/core/plugins'

import {
  MAppDrawer,
  MFilterSearch,
  MButton,
  MFormSteps,
  MDragNDropFile,
  MBaseModal,
  MSnackbar,
  MTitleView,
  MAppBarTab,
  MInfoCard,
  MPanelData,
  MInputField,
  MDataTable,
  MCheckboxOptions,
  MTabTable,
} from 'mango-vue'

import config from '@cornflow-ui/core/config'
import appConfig from '@/app/config'
import { setDefaultLanguage } from '@cornflow-ui/core/plugins/i18n'
import { useGeneralStore } from '@cornflow-ui/core/stores/general'
import getAuthService from '@cornflow-ui/core/services/AuthServiceFactory'
import { registerPremiumModules } from '@cornflow-ui/core/plugins/extensions'
import type { PremiumModule } from '@cornflow-ui/core/types/extension'
import { frontendAutomationModule } from '@cornflow-ui/core/modules/frontend-automation'

export interface CreateCornflowAppOptions {
  /** Root component (normally the shell's App.vue). */
  rootComponent: Component
  /** Premium modules (enterprise). Empty in core-only projects. */
  premiumModules?: PremiumModule[]
  /** Mount selector, or `false` to skip mounting (returns the app unmounted). Default '#app'. */
  mount?: string | false
}

export async function createCornflowApp(
  options: CreateCornflowAppOptions,
): Promise<VueApp> {
  // Register modules first so registerPlugins() can inject their routes/locales.
  // `frontend-automation` ships in core (master-data config source, always on);
  // enterprise/consumer premium modules are appended after it.
  registerPremiumModules([
    frontendAutomationModule,
    ...(options.premiumModules ?? []),
  ])

  // Initialize external config first
  await config.initConfig()

  // Update app config with initialized values
  appConfig.updateConfig()

  // Set the document title from config
  if (config.name) {
    document.title = config.name
  }

  // Set the default language from external config
  const defaultLanguage = config.defaultLanguage
  if (
    defaultLanguage === 'en' ||
    defaultLanguage === 'es' ||
    defaultLanguage === 'fr'
  ) {
    setDefaultLanguage(defaultLanguage)
  }

  const app = createApp(options.rootComponent)
  const pinia = createPinia()

  registerPlugins(app)

  app.component('MAppDrawer', MAppDrawer)
  app.component('MFilterSearch', MFilterSearch)
  app.component('MButton', MButton)
  app.component('MFormSteps', MFormSteps)
  app.component('MDragNDropFile', MDragNDropFile)
  app.component('MBaseModal', MBaseModal)
  app.component('MTitleView', MTitleView)
  app.component('MAppBarTab', MAppBarTab)
  app.component('MInfoCard', MInfoCard)
  app.component('MPanelData', MPanelData)
  app.component('MSnackbar', MSnackbar)
  app.component('MInputField', MInputField)
  app.component('MDataTable', MDataTable)
  app.component('MCheckboxOptions', MCheckboxOptions)
  app.component('MTabTable', MTabTable)

  app.use(pinia)
  setActivePinia(pinia)

  // Pre-fetch user data before app.mount() so the router's beforeEach guard
  // has roles available on the very first navigation.
  const authService = await getAuthService()
  if (authService.isAuthenticated()) {
    await useGeneralStore().initializeData()
  }

  if (options.mount !== false) {
    app.mount(options.mount ?? '#app')
  }

  return app
}
