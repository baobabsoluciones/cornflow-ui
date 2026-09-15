import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vuetify, { transformAssetUrls } from 'vite-plugin-vuetify'
import { fileURLToPath, URL } from 'node:url'

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
      // Self-reference: el core resuelve sus propios imports `@cornflow-ui/core/*` a ./src
      // (en standalone). Los consumidores aliasan esto a node_modules/@cornflow-ui/core/src.
      '@cornflow-ui/core': fileURLToPath(new URL('./src', import.meta.url))
    },
    extensions: ['.js', '.json', '.jsx', '.mjs', '.ts', '.tsx', '.vue']
  },
  server: {
    port: 3000
  },
  worker: {
    format: 'es'
  },
  base: './',
  css: {
    preprocessorOptions: {
      scss: {
        charset: false
      }
    }
  }
})
