import { createCornflowE2EConfig } from './configFactory.mjs'

/**
 * The suite in core: the same factory the apps use. Core has no backend or DAGs of its own, so it
 * runs against the deployment of an app that is given from outside:
 *
 * - core itself is started on its own port, with the root .env (`VITE_APP_BACKEND_URL`,
 *   `VITE_APP_SCHEMA`…) pointing at that deployment's backend;
 * - the user (`E2E_USER`, `E2E_PASSWORD`) and the UAT file (`E2E_UAT_FILE`) go in
 *   tests/e2e/.env.test, never in the repository.
 *
 * Against an environment others use, the UAT file says `"mode": "shared"`. To check the suite with
 * an app's own configuration, run it from the app instead, with core installed from this copy
 * (see tests/e2e/README.md, "Developing the suite in core").
 */
export default createCornflowE2EConfig({
  devCommand: 'npm run dev -- --port 3060 --strictPort',
  baseURL: 'http://localhost:3060',
})
