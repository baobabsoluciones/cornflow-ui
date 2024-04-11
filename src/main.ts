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

const pinia = createPinia()
const app = createApp(App)

registerPlugins(app)

app.component('MAppDrawer', MAppDrawer)
app.component('MFilterSearch', MFilterSearch)

app.use(pinia)
app.mount('#app')
