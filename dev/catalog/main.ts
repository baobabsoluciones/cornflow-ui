/**
 * Entry of the component catalog. Loads the same stylesheets as an application (the core's, then
 * the app's variables), Vuetify with its colours taken from the design tokens, the store (the
 * history pieces read the app config from it) and the snackbar state the toast shows.
 */
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import '@/assets/styles/main.css'
import '@/app/assets/styles/main.css'
import '@/app/assets/styles/variables.css'

import vuetify, { applyTokensToTheme } from '@cornflow-ui/core/plugins/vuetify'
import i18n from '@cornflow-ui/core/plugins/i18n'
import {
  snackbar,
  showSnackbar,
} from '@cornflow-ui/core/services/SnackbarService'
import CatalogApp from './CatalogApp.vue'

applyTokensToTheme()
createApp(CatalogApp)
  .use(createPinia())
  .use(vuetify)
  .use(i18n)
  .provide('snackbar', snackbar)
  .provide('showSnackbar', showSnackbar)
  .mount('#catalog')
