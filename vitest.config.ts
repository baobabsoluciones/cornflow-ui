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
    },
    setupFiles: ['./tests/setup.ts'], // setup file to configure the testing environment
    server: {
      deps: {
        inline: ['vuetify'],
      },
    },
    include: [
      './tests/**/*.spec.ts', // specific tests
      './src/app/tests/**/*.spec.ts', // global tests
    ],
    // silent: true, // disable warnings
  },
  testDir: '.', // set the root directory for tests
}
