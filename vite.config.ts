import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vuetify, { transformAssetUrls } from 'vite-plugin-vuetify'
import { fileURLToPath, URL } from 'node:url'
import { createRequire } from 'module'
import path from 'path'

const require = createRequire(import.meta.url)
// resuelve la ubicación real de vue (package.json) según Node resolution
let vuePkgPath: string
try {
  vuePkgPath = require.resolve('vue/package.json')
} catch (e) {
  // si falla, dejamos undefined y Vite seguirá intentando; revisa instalación de vue
  vuePkgPath = ''
}
const vueDir = vuePkgPath ? path.dirname(vuePkgPath) : path.resolve(__dirname, 'node_modules/vue')

export default defineConfig({
  plugins: [
    vue({
      template: { transformAssetUrls }
    }),
    vuetify({
      autoImport: true,
    }),
  ],
  define: { 'process.env': {} },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'mango-ui': path.resolve(__dirname, '../mango-ui/src'),
      // alias la ruta real de vue (evita múltiples instancias)
      vue: vueDir
    },
    dedupe: ['vue'],
    extensions: ['.js', '.json', '.jsx', '.mjs', '.ts', '.tsx', '.vue']
  },
  server: {
    port: 3000,
    fs: {
      allow: [
        path.resolve(__dirname),
        path.resolve(__dirname, 'src'),
        path.resolve(__dirname, 'node_modules'),
        path.resolve(__dirname, '..'),
        path.resolve(__dirname, '../mango-ui'),
        path.resolve(__dirname, '../mango-ui/src')
      ]
    }
  },
  optimizeDeps: {
    include: ['mango-ui', 'vuetify']
  },
  base: './'
})
