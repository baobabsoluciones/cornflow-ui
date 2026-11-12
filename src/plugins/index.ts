/**
 * plugins/index.ts
 *
 * Automatically included in `./src/main.ts`
 */

// Plugins
import { loadFonts } from './webfontloader'
import vuetify from './vuetify'
import { getRouter } from '../router'
import i18n from './i18n'
import { applyPremiumRoutes, applyPremiumLocales } from './extensions'

// Types
import type { App } from 'vue'

export function registerPlugins (app: App) {
  loadFonts()

  // Built here (not at import time) so it picks up the resolved `config.useHashMode`.
  const router = getRouter()

  // Inject premium contributions (enterprise) into the already-built router/i18n BEFORE installing
  // them: `app.use(router)` starts the first navigation, so premium routes must already exist or a
  // hard load of a premium URL would match the catch-all and land on /not-found.
  // Requires premium modules to be registered first (done in createCornflowApp).
  // No-ops when no modules are registered.
  applyPremiumRoutes(router)
  applyPremiumLocales(i18n)

  app
    .use(vuetify)
    .use(router)
    .use(i18n)
}
