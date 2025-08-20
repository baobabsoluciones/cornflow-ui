import { fileURLToPath } from 'url'
import vue from '@vitejs/plugin-vue'

export default {
  testMatch: '**/*.spec.ts', // pattern to find test files
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    hmr: false, // disable hot module replacement
  },
  coverage: true, // enable code coverage
  test: {
    globals: true,
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'tests/**',
        'src/app/tests/**',
        '**/*.d.ts',
        'vite.config.ts',
        'vitest.config.ts'
      ],
      include: [
        'src/**/*.{ts,vue}'
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    },
    setupFiles: ['./tests/unit/core/setup.ts'], // setup file to configure the testing environment
    server: {
      deps: {
        inline: ['vuetify'],
      },
    },
    include: [
      './tests/unit/core/**/*.spec.ts', // core tests (do not modify)
      './tests/unit/app/**/*.spec.ts', // app-specific tests
      './src/app/tests/**/*.spec.ts', // additional app tests
    ],
    // silent: true, // disable warnings
  },
  testDir: '.', // set the root directory for tests
}
