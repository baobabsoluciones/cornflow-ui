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
import 'mango-ui/dist/style.css'
import { MAppDrawer } from 'mango-ui'
import { MFilterSearch } from 'mango-ui'
import { MButton } from 'mango-ui'
import { MFormSteps } from 'mango-ui'
import { MDragNDropFile } from 'mango-ui'
import { MSnackbar } from 'mango-ui'

import { MTitleView } from 'mango-ui'
import { MAppBarTab } from 'mango-ui'
import { MInfoCard } from 'mango-ui'
import { MPanelData } from 'mango-ui'
import { MTabTable } from 'mango-ui'


const pinia = createPinia()
const app = createApp(App)

registerPlugins(app)

app.component('MAppDrawer', MAppDrawer)
app.component('MFilterSearch', MFilterSearch)
app.component('MButton', MButton)
app.component('MFormSteps', MFormSteps)
app.component('MDragNDropFile', MDragNDropFile)
app.component('MTitleView', MTitleView)
app.component('MAppBarTab', MAppBarTab)
app.component('MInfoCard', MInfoCard)
app.component('MPanelData', MPanelData)
app.component('MSnackbar', MSnackbar)
app.component('MTabTable', MTabTable)


app.use(pinia)
app.mount('#app')
