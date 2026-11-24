import { createCornflowE2EConfig } from './configFactory.mjs'

/**
 * The suite in core, run against the stack (tests/e2e/stack): the same factory the apps use, with
 * core's own UAT file (tests/e2e/uat.json). Start the stack first:
 *
 *   docker compose -f tests/e2e/stack/docker-compose.yml up -d --wait
 *   npm run test:e2e
 *
 * The app is started on its own port with the stack's settings, whatever the root .env says. Any
 * of them can be changed in tests/e2e/.env.test or the environment.
 */
export default createCornflowE2EConfig({
  devCommand: 'npm run dev -- --port 3060 --strictPort',
  baseURL: 'http://localhost:3060',
  envDefaults: {
    VITE_APP_BACKEND_URL: 'http://localhost:5091',
    VITE_APP_SCHEMA: 'e2e_planning',
    VITE_APP_AUTH_TYPE: 'cornflow',
    VITE_APP_EXTERNAL_APP: 'false',
    // The stack's admin, in its docker-compose.yml: the stack is thrown away after each use.
    E2E_USER: 'cornflow_admin',
    E2E_PASSWORD: 'Tz8!qw-Lmb#Rv4x',
  },
})
