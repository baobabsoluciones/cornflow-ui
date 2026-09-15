import { createI18n } from 'vue-i18n'
import { createVuetify } from 'vuetify'
import { vi } from 'vitest'

/**
 * Pre-built Vuetify instance shared across all component tests.
 * Avoids calling `createVuetify()` in every spec file's `beforeEach`.
 */
export const vuetify = createVuetify()

/**
 * Creates a minimal vue-i18n instance for component testing.
 * Default: non-legacy mode, locale 'en', empty messages.
 */
export function createTestI18n(
  messages: Record<string, Record<string, string>> = { en: {} },
) {
  return createI18n({ legacy: false, locale: 'en', messages })
}

/**
 * Returns a mock `t()` that echoes its key — the most common pattern
 * when mocking `useI18n().t` via `vi.mock('vue-i18n', …)`.
 */
export function createMockT() {
  return vi.fn((key: string) => key)
}

/**
 * Builds a mock API client with the specified HTTP verbs as vi.fn() stubs.
 * Useful inside
 * `vi.mock('@cornflow-ui/core/api/Api', () => ({ default: createMockApiClient() }))`.
 */
export function createMockApiClient(
  methods: string[] = ['get', 'post', 'put', 'remove', 'getBlob'],
) {
  return Object.fromEntries(methods.map((m) => [m, vi.fn()]))
}
