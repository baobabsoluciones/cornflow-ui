import { createCornflowE2EConfig } from './configFactory';

/**
 * Cornflow core E2E config. Uses the shared factory (the same one consumer apps import
 * from `@cornflow-ui/core/e2e/configFactory`), so core dogfoods exactly what consumers run.
 *
 * Here `consumerDir` defaults to this repo, so `.env.test` and `.auth` resolve under
 * `tests/e2e/` as before, and the dev server is this repo's `npm run dev`.
 */
export default createCornflowE2EConfig();
