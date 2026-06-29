/**
 * main.ts — Shell de arranque del core standalone (@cornflow-ui/core).
 *
 * Sin módulos premium: arranca solo el core vía createCornflowApp. Un proyecto enterprise usa en su
 * lugar createEnterpriseApp (de @cornflow-ui/enterprise), que pre-registra los módulos premium.
 */
import App from './App.vue'

// Styles
import './assets/styles/main.css'
import './app/assets/styles/main.css'
import './app/assets/styles/variables.css'
import 'mango-vue/dist/style.css'

import { createCornflowApp } from '@/bootstrap'

export async function initApp() {
  await createCornflowApp({ rootComponent: App })
}

try {
  await initApp()
} catch (error) {
  console.error('Failed to initialize app:', error)
}
