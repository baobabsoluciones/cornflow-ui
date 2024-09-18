import { fileURLToPath } from 'url'
import vue from '@vitejs/plugin-vue'

export default {
  rootDir: './src', // where your source code is located
  testDir: './tests', // where your tests are located
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
    // silent: true, // disable warnings
  },
}
