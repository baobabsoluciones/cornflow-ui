/**
 * main.ts — Startup shell for the standalone core (@cornflow-ui/core).
 *
 * No premium modules: boots the core alone via createCornflowApp. An enterprise project uses
 * createEnterpriseApp instead (from @cornflow-ui/enterprise), which pre-registers the premium modules.
 */
import App from './App.vue'

// Styles
import './assets/styles/main.css'
import './app/assets/styles/main.css'
import './app/assets/styles/variables.css'
import 'mango-vue/dist/style.css'

import { createCornflowApp } from '@cornflow-ui/core/bootstrap'

export async function initApp() {
  await createCornflowApp({ rootComponent: App })
}

try {
  await initApp()
} catch (error) {
  console.error('Failed to initialize app:', error)
}
