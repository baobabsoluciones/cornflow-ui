/**
 * Dev server of the documentation screenshots: the app as `npm run dev` serves it, on port 3100,
 * with two differences:
 *
 * - It reads no `.env` from the project root (`envDir` points here, where there is none), so the
 *   app takes its external configuration from `values.json`, which the mock backend serves.
 * - `@/app/config` and `@/app/rolesConfig` resolve to the wrappers in `./app`, which turn on the
 *   features each screenshot needs, and the app's texts to the demo ones in `./app/locales`.
 */
import { defineConfig, mergeConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import baseConfig from '../../../vite.config'

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url))

export default mergeConfig(
  baseConfig,
  defineConfig({
    envDir: here('./'),
    resolve: {
      alias: [
        { find: /^@\/app\/config$/, replacement: here('./app/config.ts') },
        { find: /^@\/app\/rolesConfig$/, replacement: here('./app/rolesConfig.ts') },
        // The demo app's own texts (config parameters, filters).
        { find: /^@\/app\/plugins\/locales\//, replacement: here('./app/locales/') },
      ],
    },
    server: {
      port: 3100,
      strictPort: true,
    },
  }),
)
