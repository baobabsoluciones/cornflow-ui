import path from 'path';

/**
 * Absolute path of the saved authentication state (cookies + localStorage + sessionStorage).
 *
 * It is resolved from the PROJECT ROOT (`process.cwd()` — where the Playwright config lives),
 * NOT from this file's location. That distinction matters for consumer apps: when the suite is
 * consumed from `@cornflow-ui/core`, the specs run from a mirrored copy inside the consumer
 * (`tests/e2e/.cornflow-core/`, which is wiped and regenerated on every run), so a path relative
 * to this file would point into that throwaway folder and would not match the `storageState`
 * configured by `configFactory.mjs`. Anchoring on the project root keeps setup, fixtures and the
 * config in agreement for both the core repo and any consumer.
 *
 * Override with `CORNFLOW_E2E_AUTH_FILE` when the config uses a custom location.
 */
export const AUTH_FILE =
  process.env.CORNFLOW_E2E_AUTH_FILE ||
  path.join(process.cwd(), 'tests', 'e2e', '.auth', 'user.json');
