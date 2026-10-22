/**
 * Component catalog: every core component on its own, with its variants and states, for design
 * review without running the app. Development only: it is not part of the build the applications
 * consume.
 *
 *   npm run catalog   →   http://localhost:3020/dev/catalog/index.html
 */
import { defineConfig, mergeConfig } from 'vite'
import baseConfig from '../../vite.config'

export default mergeConfig(
  baseConfig,
  defineConfig({
    server: {
      port: 3020,
      open: '/dev/catalog/index.html',
    },
  }),
)
