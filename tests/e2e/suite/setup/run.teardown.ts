/**
 * Runs once after the tests, even when some failed: deletes whatever carries this run's id
 * (executions, instances and the users the set-up made), so the backend is left as it was.
 */
import { test as teardown } from '@playwright/test'
import {
  cornflowApiFor,
  credentials,
  type Deployment,
  readDeployment,
} from '../harness/run'

teardown('clean up the run', async ({ baseURL }) => {
  const deployment = readDeploymentOrNull()
  if (!deployment) {
    // The set-up stopped before it reached the backend: nothing to clean up.
    console.log('[cornflow-e2e] Nothing to clean up: the set-up did not start.')
    return
  }
  const { username, password } = credentials()
  const api = cornflowApiFor(deployment, baseURL)
  await api.login(username, password)
  const removed = await api.sweepRun()
  console.log(
    `[cornflow-e2e] Cleaned up run ${api.runId}: ${removed.executions} executions, ` +
      `${removed.instances} instances, ${removed.users} users, ${removed.roles} roles.`,
  )
})

function readDeploymentOrNull(): Deployment | null {
  try {
    return readDeployment()
  } catch {
    return null
  }
}
