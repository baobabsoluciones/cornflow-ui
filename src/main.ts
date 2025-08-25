/**
 * main.ts
 *
 * Bootstraps Vuetify and other plugins then mounts the App`
 */

// Components
import App from './App.vue'

// Composables
import { createApp } from 'vue'
import { createPinia } from 'pinia'

/* PrimeVue config */
import PrimeVue from 'primevue/config'
import Aura from '@primeuix/themes/aura'
import Tooltip from 'primevue/tooltip'

// Plugins
import { registerPlugins } from '@/plugins'

//Styles
import './assets/styles/main.css' // Main styles
import './app/assets/styles/main.css' // Main app custom styles
import './app/assets/styles/variables.css' // App custom variables
import '@/plugins'
/* import 'mango-ui/style.css' */
/* import '../../mango-ui/src/assets/styles/style.css' */

import { MAppDrawer } from 'mango-vue'
import { MFilterSearch } from 'mango-vue'
import { MButton } from 'mango-vue'
import { MFormSteps } from 'mango-vue'
import { MDragNDropFile } from 'mango-vue'
import { MBaseModal } from 'mango-vue'
import { MSnackbar } from 'mango-vue'
import { MTitleView } from 'mango-vue'
import { MAppBarTab } from 'mango-vue'
import { MInfoCard } from 'mango-vue'
import { MPanelData } from 'mango-vue'
import { MInputField } from 'mango-vue'
import { MDataTable } from 'mango-vue'
import { MCheckboxOptions } from 'mango-vue'
import { MTabTable } from 'mango-vue'

import { PTitleView } from 'mango-vue'
import { PDataTable } from 'mango-vue'
import { PFormSteps } from 'mango-vue'
import { PAppBarTab } from 'mango-vue'
import { PAppDrawer } from 'mango-vue'
import { PTabTable } from 'mango-vue'

import config from '@/config'
import appConfig from '@/app/config'

async function initApp() {
  console.log('Starting app initialization...');
  
  // Initialize config first
  await config.initConfig();
  console.log('Config initialized');
  
  // Update app config with initialized values
  appConfig.updateConfig();

  const app = createApp(App);
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

  app.component('PTitleView', PTitleView)
  app.component('PDataTable', PDataTable)
  app.component('PFormSteps', PFormSteps)
  app.component('PAppBarTab', PAppBarTab)
  app.component('PAppDrawer', PAppDrawer)
  app.component('PTabTable', PTabTable)

  app.use(pinia)
  app.use(PrimeVue, {
    theme: {
      preset: Aura
    }
  });
  app.directive('tooltip', Tooltip)
  app.mount('#app')
}

initApp().catch(error => {
  console.error('Failed to initialize app:', error);
});
