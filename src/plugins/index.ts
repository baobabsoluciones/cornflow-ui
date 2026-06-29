/**
 * plugins/index.ts
 *
 * Automatically included in `./src/main.ts`
 */

// Plugins
import { loadFonts } from './webfontloader'
import vuetify from './vuetify'
import router from '../router'
import i18n from './i18n'
import { applyPremiumRoutes, applyPremiumLocales } from './extensions'

// Types
import type { App } from 'vue'

export function registerPlugins (app: App) {
  loadFonts()
  app
    .use(vuetify)
    .use(router)
    .use(i18n)

  // Inject premium contributions (enterprise) into the already-built router/i18n.
  // Requires premium modules to be registered first (done in createCornflowApp).
  // No-ops when no modules are registered.
  applyPremiumRoutes(router)
  applyPremiumLocales(i18n)
}
