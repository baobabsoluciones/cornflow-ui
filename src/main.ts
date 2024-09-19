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

// Plugins
import { registerPlugins } from '@/plugins'

//Styles
import './assets/styles/main.css' // Main styles
import './app/assets/styles/main.css' // Main app custom styles
import './app/assets/styles/variables.css' // App custom variables
import '@/plugins'
import 'mango-vue/dist/style.css'

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

const pinia = createPinia()
const app = createApp(App)

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
app.mount('#app')
