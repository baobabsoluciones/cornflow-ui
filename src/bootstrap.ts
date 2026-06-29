/**
 * bootstrap.ts — Punto de arranque del core: `createCornflowApp`.
 *
 * Encapsula el arranque de la aplicación (config externa, i18n, Pinia, Vuetify, componentes
 * mango-vue, prefetch de usuario, mount) y acepta una lista de `PremiumModule` (enterprise).
 * Registra los módulos ANTES de `registerPlugins`, de modo que `applyPremiumRoutes` /
 * `applyPremiumLocales` (dentro de registerPlugins) inyecten sus contribuciones en el router/i18n
 * ya construidos.
 *
 * En el modelo objetivo (npm) esta función vive en `@cornflow-ui/core`; cada proyecto es un shell
 * delgado que la invoca (o usa `createEnterpriseApp` de `@cornflow-ui/enterprise`). Ver
 * docs/PLAN_MIGRACION_NPM_PACKAGES.md y docs/CONTRATO_PUNTOS_EXTENSION.md.
 */
import { createApp, type App as VueApp, type Component } from 'vue'
import { createPinia, setActivePinia } from 'pinia'

import { registerPlugins } from '@/plugins'

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

import config from '@/config'
import appConfig from '@/app/config'
import { setDefaultLanguage } from '@/plugins/i18n'
import { useGeneralStore } from '@/stores/general'
import getAuthService from '@/services/AuthServiceFactory'
import { registerPremiumModules } from '@/plugins/extensions'
import type { PremiumModule } from '@/types/extension'

export interface CreateCornflowAppOptions {
  /** Componente raíz (normalmente App.vue del shell). */
  rootComponent: Component
  /** Módulos premium (enterprise). Vacío en proyectos core-only. */
  premiumModules?: PremiumModule[]
  /** Selector de montaje, o `false` para no montar (devuelve la app sin montar). Default '#app'. */
  mount?: string | false
}

export async function createCornflowApp(
  options: CreateCornflowAppOptions,
): Promise<VueApp> {
  // Register premium modules first so registerPlugins() can inject their routes/locales.
  registerPremiumModules(options.premiumModules ?? [])

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
