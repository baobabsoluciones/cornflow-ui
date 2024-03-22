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
import './assets/styles/main.css'; // Main styles
import './app/assets/styles/main.css'; // Main app custom styles
import './app/assets/styles/variables.css' // App custom variables
import '@/plugins'


const pinia = createPinia()
const app = createApp(App)

registerPlugins(app)

app.use(pinia)
app.mount('#app')
