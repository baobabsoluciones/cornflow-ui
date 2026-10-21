/**
 * Entry of the component catalog. Loads the same stylesheets as an application (the core's, then
 * the app's variables), and Vuetify with its colours taken from the design tokens.
 */
import { createApp } from 'vue'
import '../../src/assets/styles/main.css'
import '../../src/app/assets/styles/main.css'
import '../../src/app/assets/styles/variables.css'

import vuetify, { applyTokensToTheme } from '@cornflow-ui/core/plugins/vuetify'
import i18n from '@cornflow-ui/core/plugins/i18n'
import CatalogApp from './CatalogApp.vue'

applyTokensToTheme()
createApp(CatalogApp).use(vuetify).use(i18n).mount('#catalog')
